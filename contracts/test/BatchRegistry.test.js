const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { Role, DAY, deployFixture, batchParams, registerBatch, moveBatch } = require("./helpers");

describe("BatchRegistry", function () {
  describe("registration", function () {
    it("lets a manufacturer register a batch", async function () {
      const { registry, manufacturer } = await loadFixture(deployFixture);
      const p = await batchParams();

      await expect(
        registry
          .connect(manufacturer)
          .registerBatch(p.batchId, p.medicineName, p.manufacturingDate, p.expiryDate, p.quantity, p.dataHash)
      )
        .to.emit(registry, "BatchRegistered")
        .withArgs(p.batchId, ethers.id(p.batchId), manufacturer.address, p.medicineName, p.expiryDate, p.quantity);

      const b = await registry.getBatch(p.batchId);
      expect(b.medicineName).to.equal(p.medicineName);
      expect(b.manufacturer).to.equal(manufacturer.address);
      expect(b.currentHolder).to.equal(manufacturer.address);
      expect(b.quantity).to.equal(p.quantity);
      expect(await registry.batchCount()).to.equal(1);
    });

    it("only allows active manufacturers", async function () {
      const { registry, accessControl, manufacturer, distributor, outsider } = await loadFixture(deployFixture);

      await expect(registerBatch(registry, distributor)).to.be.revertedWithCustomError(registry, "NotManufacturer");
      await expect(registerBatch(registry, outsider)).to.be.revertedWithCustomError(registry, "NotManufacturer");

      await accessControl.setParticipantStatus(manufacturer.address, false);
      await expect(registerBatch(registry, manufacturer)).to.be.revertedWithCustomError(
        registry,
        "NotManufacturer"
      );
    });

    it("rejects duplicate batch IDs, even from another manufacturer", async function () {
      const { registry, manufacturer, manufacturer2 } = await loadFixture(deployFixture);
      await registerBatch(registry, manufacturer);

      await expect(registerBatch(registry, manufacturer)).to.be.revertedWithCustomError(
        registry,
        "BatchAlreadyExists"
      );
      await expect(registerBatch(registry, manufacturer2)).to.be.revertedWithCustomError(
        registry,
        "BatchAlreadyExists"
      );
    });

    it("validates batch data", async function () {
      const { registry, manufacturer } = await loadFixture(deployFixture);
      const now = await time.latest();

      const bad = [
        { batchId: "" },
        { medicineName: "" },
        { quantity: 0 },
        { manufacturingDate: now + 10 * DAY }, // in the future
        { manufacturingDate: now - DAY, expiryDate: now - 2 * DAY }, // expiry before mfg
      ];

      for (const overrides of bad) {
        await expect(registerBatch(registry, manufacturer, overrides)).to.be.revertedWithCustomError(
          registry,
          "InvalidBatchData"
        );
      }
    });

    it("reverts getBatch for an unknown batch", async function () {
      const { registry } = await loadFixture(deployFixture);
      await expect(registry.getBatch("NOPE")).to.be.revertedWithCustomError(registry, "BatchNotFound");
    });
  });

  describe("access to custody updates", function () {
    it("only the transfer contract can record transfers", async function () {
      const { registry, manufacturer, distributor } = await loadFixture(deployFixture);
      const p = await registerBatch(registry, manufacturer);

      await expect(
        registry
          .connect(manufacturer)
          .recordTransfer(p.batchId, manufacturer.address, distributor.address, Role.Manufacturer, Role.Distributor)
      ).to.be.revertedWithCustomError(registry, "NotTransferContract");
    });

    it("transfer contract can only be linked once, by the admin", async function () {
      const { registry, manufacturer, outsider } = await loadFixture(deployFixture);

      await expect(registry.setTransferContract(outsider.address)).to.be.revertedWithCustomError(
        registry,
        "TransferContractAlreadySet"
      );
      await expect(
        registry.connect(manufacturer).setTransferContract(outsider.address)
      ).to.be.revertedWithCustomError(registry, "NotAdmin");
    });
  });

  describe("verification", function () {
    it("reports an unknown batch as unregistered", async function () {
      const { registry } = await loadFixture(deployFixture);
      const r = await registry.verifyBatch("FAKE-123");

      expect(r.registered).to.equal(false);
      expect(r.historyValid).to.equal(false);
      expect(r.currentHolder).to.equal(ethers.ZeroAddress);
    });

    it("verifies a fresh batch at the manufacturer", async function () {
      const { registry, manufacturer } = await loadFixture(deployFixture);
      const p = await registerBatch(registry, manufacturer);
      const r = await registry.verifyBatch(p.batchId);

      expect(r.registered).to.equal(true);
      expect(r.expired).to.equal(false);
      expect(r.historyValid).to.equal(true);
      expect(r.currentHolder).to.equal(manufacturer.address);
      expect(r.currentHolderRole).to.equal(Role.Manufacturer);
      expect(r.transferCount).to.equal(0);
    });

    it("verifies a batch that went all the way to the pharmacy", async function () {
      const { registry, transfer, manufacturer, distributor, wholesaler, pharmacy } =
        await loadFixture(deployFixture);
      const p = await registerBatch(registry, manufacturer);

      await moveBatch(transfer, p.batchId, manufacturer, distributor);
      await moveBatch(transfer, p.batchId, distributor, wholesaler);
      await moveBatch(transfer, p.batchId, wholesaler, pharmacy);

      const r = await registry.verifyBatch(p.batchId);
      expect(r.historyValid).to.equal(true);
      expect(r.currentHolder).to.equal(pharmacy.address);
      expect(r.currentHolderRole).to.equal(Role.Pharmacy);
      expect(r.transferCount).to.equal(3);

      const history = await registry.getCustodyHistory(p.batchId);
      expect(history.map((h) => h.to)).to.deep.equal([distributor.address, wholesaler.address, pharmacy.address]);
      expect(history[0].from).to.equal(manufacturer.address);
      expect(history[0].timestamp).to.be.greaterThan(0);
    });

    it("flags an expired batch", async function () {
      const { registry, manufacturer } = await loadFixture(deployFixture);
      const now = await time.latest();
      const p = await registerBatch(registry, manufacturer, { expiryDate: now + 30 * DAY });

      expect((await registry.verifyBatch(p.batchId)).expired).to.equal(false);
      await time.increase(31 * DAY);
      expect((await registry.verifyBatch(p.batchId)).expired).to.equal(true);
      expect(await registry.isExpired(p.batchId)).to.equal(true);
    });

    it("checks the off-chain data hash", async function () {
      const { registry, manufacturer } = await loadFixture(deployFixture);
      const p = await registerBatch(registry, manufacturer);

      expect(await registry.verifyDataHash(p.batchId, p.dataHash)).to.equal(true);
      expect(await registry.verifyDataHash(p.batchId, ethers.id("tampered"))).to.equal(false);
    });

    it("pages through batch IDs", async function () {
      const { registry, manufacturer } = await loadFixture(deployFixture);
      for (let i = 1; i <= 5; i++) {
        await registerBatch(registry, manufacturer, { batchId: `B-${i}` });
      }

      expect(await registry.getBatchIds(0, 2)).to.deep.equal(["B-1", "B-2"]);
      expect(await registry.getBatchIds(3, 10)).to.deep.equal(["B-4", "B-5"]);
      expect(await registry.getBatchIds(10, 2)).to.deep.equal([]);
    });
  });
});