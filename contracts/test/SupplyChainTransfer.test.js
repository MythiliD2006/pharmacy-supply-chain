const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { Role, Status, DAY, deployFixture, registerBatch, moveBatch } = require("./helpers");

describe("SupplyChainTransfer", function () {
  async function withBatch() {
    const ctx = await deployFixture();
    const p = await registerBatch(ctx.registry, ctx.manufacturer);
    return { ...ctx, batchId: p.batchId };
  }

  describe("request", function () {
    it("creates a pending transfer", async function () {
      const { transfer, registry, manufacturer, distributor, batchId } = await loadFixture(withBatch);

      await expect(transfer.connect(manufacturer).requestTransfer(batchId, distributor.address))
        .to.emit(transfer, "TransferRequested")
        .withArgs(0, batchId, manufacturer.address, distributor.address);

      const t = await transfer.getTransfer(0);
      expect(t.status).to.equal(Status.Pending);
      expect(t.fromRole).to.equal(Role.Manufacturer);
      expect(t.toRole).to.equal(Role.Distributor);
      expect(await transfer.hasPendingTransfer(ethers.id(batchId))).to.equal(true);
      expect(await transfer.getIncomingTransfers(distributor.address)).to.deep.equal([0n]);
      expect(await transfer.getOutgoingTransfers(manufacturer.address)).to.deep.equal([0n]);

      // ownership doesn't change until the receiver confirms
      expect(await registry.currentHolderOf(batchId)).to.equal(manufacturer.address);
    });

    it("only the current holder can transfer", async function () {
      const { transfer, distributor, wholesaler, batchId } = await loadFixture(withBatch);
      await expect(
        transfer.connect(distributor).requestTransfer(batchId, wholesaler.address)
      ).to.be.revertedWithCustomError(transfer, "NotCurrentHolder");
    });

    it("rejects unknown batches", async function () {
      const { transfer, manufacturer, distributor } = await loadFixture(withBatch);
      await expect(
        transfer.connect(manufacturer).requestTransfer("NOPE", distributor.address)
      ).to.be.revertedWithCustomError(transfer, "BatchNotFound");
    });

    it("rejects transfers to unregistered or disabled receivers", async function () {
      const { transfer, accessControl, manufacturer, distributor, outsider, batchId } = await loadFixture(withBatch);

      await expect(
        transfer.connect(manufacturer).requestTransfer(batchId, outsider.address)
      ).to.be.revertedWithCustomError(transfer, "ReceiverNotActive");

      await accessControl.setParticipantStatus(distributor.address, false);
      await expect(
        transfer.connect(manufacturer).requestTransfer(batchId, distributor.address)
      ).to.be.revertedWithCustomError(transfer, "ReceiverNotActive");
    });

    it("rejects transfers from a disabled holder", async function () {
      const { transfer, accessControl, manufacturer, distributor, batchId } = await loadFixture(withBatch);
      await accessControl.setParticipantStatus(manufacturer.address, false);

      await expect(
        transfer.connect(manufacturer).requestTransfer(batchId, distributor.address)
      ).to.be.revertedWithCustomError(transfer, "SenderNotActive");
    });

    it("only allows moving forward in the chain", async function () {
      const { transfer, manufacturer, manufacturer2, distributor, wholesaler, batchId } =
        await loadFixture(withBatch);

      // manufacturer -> manufacturer
      await expect(
        transfer.connect(manufacturer).requestTransfer(batchId, manufacturer2.address)
      ).to.be.revertedWithCustomError(transfer, "InvalidReceiverRole");

      // wholesaler -> distributor (backwards)
      await moveBatch(transfer, batchId, manufacturer, wholesaler);
      await expect(
        transfer.connect(wholesaler).requestTransfer(batchId, distributor.address)
      ).to.be.revertedWithCustomError(transfer, "InvalidReceiverRole");
    });

    it("pharmacy is the end of the chain", async function () {
      const { transfer, manufacturer, pharmacy, distributor, batchId } = await loadFixture(withBatch);
      await moveBatch(transfer, batchId, manufacturer, pharmacy);

      await expect(
        transfer.connect(pharmacy).requestTransfer(batchId, distributor.address)
      ).to.be.revertedWithCustomError(transfer, "InvalidReceiverRole");
    });

    it("blocks a second transfer while one is pending", async function () {
      const { transfer, manufacturer, distributor, wholesaler, batchId } = await loadFixture(withBatch);
      await transfer.connect(manufacturer).requestTransfer(batchId, distributor.address);

      await expect(
        transfer.connect(manufacturer).requestTransfer(batchId, wholesaler.address)
      ).to.be.revertedWithCustomError(transfer, "TransferAlreadyPending");
    });

    it("blocks transfers of expired batches", async function () {
      const { transfer, manufacturer, distributor, batchId } = await loadFixture(withBatch);
      await time.increase(400 * DAY);

      await expect(
        transfer.connect(manufacturer).requestTransfer(batchId, distributor.address)
      ).to.be.revertedWithCustomError(transfer, "BatchExpired");
    });

    it("blocks self transfers", async function () {
      const { transfer, manufacturer, batchId } = await loadFixture(withBatch);
      await expect(
        transfer.connect(manufacturer).requestTransfer(batchId, manufacturer.address)
      ).to.be.revertedWithCustomError(transfer, "SelfTransfer");
    });
  });

  describe("confirm / reject / cancel", function () {
    it("receiver confirms and ownership updates", async function () {
      const { transfer, registry, manufacturer, distributor, batchId } = await loadFixture(withBatch);
      await transfer.connect(manufacturer).requestTransfer(batchId, distributor.address);

      await expect(transfer.connect(distributor).confirmTransfer(0))
        .to.emit(transfer, "TransferConfirmed")
        .withArgs(0, batchId, manufacturer.address, distributor.address)
        .and.to.emit(registry, "CustodyTransferred");

      expect(await registry.currentHolderOf(batchId)).to.equal(distributor.address);
      const t = await transfer.getTransfer(0);
      expect(t.status).to.equal(Status.Confirmed);
      expect(t.resolvedAt).to.be.greaterThan(0);
      expect(await transfer.confirmedCount()).to.equal(1);
      expect(await transfer.hasPendingTransfer(ethers.id(batchId))).to.equal(false);
    });

    it("only the receiver can confirm", async function () {
      const { transfer, manufacturer, distributor, wholesaler, batchId } = await loadFixture(withBatch);
      await transfer.connect(manufacturer).requestTransfer(batchId, distributor.address);

      await expect(transfer.connect(wholesaler).confirmTransfer(0)).to.be.revertedWithCustomError(
        transfer,
        "NotReceiver"
      );
      await expect(transfer.connect(manufacturer).confirmTransfer(0)).to.be.revertedWithCustomError(
        transfer,
        "NotReceiver"
      );
    });

    it("a receiver disabled after the request can't confirm", async function () {
      const { transfer, accessControl, manufacturer, distributor, batchId } = await loadFixture(withBatch);
      await transfer.connect(manufacturer).requestTransfer(batchId, distributor.address);
      await accessControl.setParticipantStatus(distributor.address, false);

      await expect(transfer.connect(distributor).confirmTransfer(0)).to.be.revertedWithCustomError(
        transfer,
        "ReceiverNotActive"
      );
    });

    it("receiver can reject, and the batch stays with the sender", async function () {
      const { transfer, registry, manufacturer, distributor, batchId } = await loadFixture(withBatch);
      await transfer.connect(manufacturer).requestTransfer(batchId, distributor.address);

      await expect(transfer.connect(distributor).rejectTransfer(0)).to.emit(transfer, "TransferRejected");

      expect((await transfer.getTransfer(0)).status).to.equal(Status.Rejected);
      expect(await transfer.rejectedCount()).to.equal(1);
      expect(await registry.currentHolderOf(batchId)).to.equal(manufacturer.address);

      // can send it again afterwards
      await transfer.connect(manufacturer).requestTransfer(batchId, distributor.address);
      expect(await transfer.getBatchTransfers(batchId)).to.deep.equal([0n, 1n]);
    });

    it("sender can cancel a pending transfer", async function () {
      const { transfer, manufacturer, distributor, batchId } = await loadFixture(withBatch);
      await transfer.connect(manufacturer).requestTransfer(batchId, distributor.address);

      await expect(transfer.connect(distributor).cancelTransfer(0)).to.be.revertedWithCustomError(
        transfer,
        "NotSender"
      );
      await expect(transfer.connect(manufacturer).cancelTransfer(0)).to.emit(transfer, "TransferCancelled");
      expect((await transfer.getTransfer(0)).status).to.equal(Status.Cancelled);
    });

    it("resolved transfers can't be touched again", async function () {
      const { transfer, manufacturer, distributor, batchId } = await loadFixture(withBatch);
      await moveBatch(transfer, batchId, manufacturer, distributor);

      await expect(transfer.connect(distributor).confirmTransfer(0)).to.be.revertedWithCustomError(
        transfer,
        "NotPending"
      );
      await expect(transfer.connect(distributor).rejectTransfer(0)).to.be.revertedWithCustomError(
        transfer,
        "NotPending"
      );
    });

    it("unknown transfer ids revert", async function () {
      const { transfer, distributor } = await loadFixture(withBatch);
      await expect(transfer.connect(distributor).confirmTransfer(99)).to.be.revertedWithCustomError(
        transfer,
        "TransferNotFound"
      );
      await expect(transfer.getTransfer(99)).to.be.revertedWithCustomError(transfer, "TransferNotFound");
    });
  });
});