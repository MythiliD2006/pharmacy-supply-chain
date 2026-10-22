const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { DAY, deployFixture, registerBatch, moveBatch } = require("./helpers");

describe("Batch recall", function () {
  it("lets the batch's manufacturer recall it with a reason", async function () {
    const { registry, manufacturer } = await loadFixture(deployFixture);
    const p = await registerBatch(registry, manufacturer);

    await expect(registry.connect(manufacturer).recallBatch(p.batchId, "Contaminated lot"))
      .to.emit(registry, "BatchRecalled")
      .withArgs(p.batchId, ethers.id(p.batchId), manufacturer.address, "Contaminated lot");

    expect(await registry.isRecalled(p.batchId)).to.equal(true);
    expect(await registry.recalledCount()).to.equal(1);
    const r = await registry.getRecall(p.batchId);
    expect(r.recalled).to.equal(true);
    expect(r.reason).to.equal("Contaminated lot");
    expect(r.recalledAt).to.be.greaterThan(0);

    const v = await registry.verifyBatch(p.batchId);
    expect(v.registered).to.equal(true);
    expect(v.recalled).to.equal(true);
  });

  it("can still be recalled after the batch has moved down the chain", async function () {
    const { registry, transfer, manufacturer, distributor } = await loadFixture(deployFixture);
    const p = await registerBatch(registry, manufacturer);
    await moveBatch(transfer, p.batchId, manufacturer, distributor);

    await expect(registry.connect(manufacturer).recallBatch(p.batchId, "Wrong label")).to.emit(
      registry,
      "BatchRecalled"
    );
  });

  it("only the batch's own active manufacturer can recall", async function () {
    const { registry, accessControl, manufacturer, manufacturer2, distributor, outsider } =
      await loadFixture(deployFixture);
    const p = await registerBatch(registry, manufacturer);

    await expect(registry.connect(manufacturer2).recallBatch(p.batchId, "x")).to.be.revertedWithCustomError(
      registry,
      "NotBatchManufacturer"
    );
    await expect(registry.connect(distributor).recallBatch(p.batchId, "x")).to.be.revertedWithCustomError(
      registry,
      "NotBatchManufacturer"
    );
    await expect(registry.connect(outsider).recallBatch(p.batchId, "x")).to.be.revertedWithCustomError(
      registry,
      "NotBatchManufacturer"
    );

    await accessControl.setParticipantStatus(manufacturer.address, false);
    await expect(registry.connect(manufacturer).recallBatch(p.batchId, "x")).to.be.revertedWithCustomError(
      registry,
      "NotManufacturer"
    );
  });

  it("rejects unknown batches, empty reasons and double recalls", async function () {
    const { registry, manufacturer } = await loadFixture(deployFixture);
    const p = await registerBatch(registry, manufacturer);

    await expect(registry.connect(manufacturer).recallBatch("NOPE", "x")).to.be.revertedWithCustomError(
      registry,
      "BatchNotFound"
    );
    await expect(registry.connect(manufacturer).recallBatch(p.batchId, "")).to.be.revertedWithCustomError(
      registry,
      "EmptyReason"
    );
    await registry.connect(manufacturer).recallBatch(p.batchId, "Contaminated lot");
    await expect(registry.connect(manufacturer).recallBatch(p.batchId, "again")).to.be.revertedWithCustomError(
      registry,
      "AlreadyRecalled"
    );
  });

  it("blocks new transfer requests for a recalled batch", async function () {
    const { registry, transfer, manufacturer, distributor } = await loadFixture(deployFixture);
    const p = await registerBatch(registry, manufacturer);
    await registry.connect(manufacturer).recallBatch(p.batchId, "Contaminated lot");

    await expect(
      transfer.connect(manufacturer).requestTransfer(p.batchId, distributor.address)
    ).to.be.revertedWithCustomError(transfer, "BatchRecalled");
  });

  it("blocks confirming a pending transfer once the batch is recalled, but allows reject/cancel", async function () {
    const { registry, transfer, manufacturer, distributor } = await loadFixture(deployFixture);
    const p = await registerBatch(registry, manufacturer);

    await transfer.connect(manufacturer).requestTransfer(p.batchId, distributor.address);
    await registry.connect(manufacturer).recallBatch(p.batchId, "Contaminated lot");

    await expect(transfer.connect(distributor).confirmTransfer(0)).to.be.revertedWithCustomError(
      transfer,
      "BatchRecalled"
    );
    await expect(transfer.connect(distributor).rejectTransfer(0)).to.emit(transfer, "TransferRejected");
    expect(await registry.currentHolderOf(p.batchId)).to.equal(manufacturer.address);
  });

  it("blocks confirming a pending transfer once the batch has expired", async function () {
    const { registry, transfer, manufacturer, distributor } = await loadFixture(deployFixture);
    const now = await time.latest();
    const p = await registerBatch(registry, manufacturer, { expiryDate: now + 2 * DAY });

    await transfer.connect(manufacturer).requestTransfer(p.batchId, distributor.address);
    await time.increase(3 * DAY);

    await expect(transfer.connect(distributor).confirmTransfer(0)).to.be.revertedWithCustomError(
      transfer,
      "BatchExpired"
    );
    await expect(transfer.connect(manufacturer).cancelTransfer(0)).to.emit(transfer, "TransferCancelled");
  });
});