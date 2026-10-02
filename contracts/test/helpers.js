const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const Role = { None: 0, Manufacturer: 1, Distributor: 2, Wholesaler: 3, Pharmacy: 4 };
const Status = { Pending: 0, Confirmed: 1, Rejected: 2, Cancelled: 3 };

const DAY = 24 * 60 * 60;

async function deployFixture() {
  const [admin, manufacturer, distributor, wholesaler, pharmacy, outsider, manufacturer2] =
    await ethers.getSigners();

  const accessControl = await (await ethers.getContractFactory("AccessControlManager")).deploy();
  const registry = await (
    await ethers.getContractFactory("BatchRegistry")
  ).deploy(await accessControl.getAddress());
  const transfer = await (
    await ethers.getContractFactory("SupplyChainTransfer")
  ).deploy(await accessControl.getAddress(), await registry.getAddress());

  await registry.setTransferContract(await transfer.getAddress());

  await accessControl.addParticipant(manufacturer.address, "Sun Pharma Labs", Role.Manufacturer);
  await accessControl.addParticipant(distributor.address, "MedLink Distributors", Role.Distributor);
  await accessControl.addParticipant(wholesaler.address, "Kovai Wholesale", Role.Wholesaler);
  await accessControl.addParticipant(pharmacy.address, "CityCare Pharmacy", Role.Pharmacy);
  await accessControl.addParticipant(manufacturer2.address, "Other Pharma", Role.Manufacturer);

  return {
    accessControl,
    registry,
    transfer,
    admin,
    manufacturer,
    distributor,
    wholesaler,
    pharmacy,
    outsider,
    manufacturer2,
  };
}

async function batchParams(overrides = {}) {
  const now = await time.latest();
  const p = {
    batchId: "PCM-2026-001",
    medicineName: "Paracetamol 500mg",
    manufacturingDate: now - 10 * DAY,
    expiryDate: now + 365 * DAY,
    quantity: 10000,
    ...overrides,
  };
  p.dataHash =
    overrides.dataHash ||
    ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify([p.batchId, p.medicineName, p.manufacturingDate, p.expiryDate, p.quantity]))
    );
  return p;
}

async function registerBatch(registry, signer, overrides = {}) {
  const p = await batchParams(overrides);
  await registry
    .connect(signer)
    .registerBatch(p.batchId, p.medicineName, p.manufacturingDate, p.expiryDate, p.quantity, p.dataHash);
  return p;
}

// request + confirm in one go, returns the transfer id
async function moveBatch(transfer, batchId, from, to) {
  const id = await transfer.transferCount();
  await transfer.connect(from).requestTransfer(batchId, to.address);
  await transfer.connect(to).confirmTransfer(id);
  return id;
}

module.exports = { Role, Status, DAY, deployFixture, batchParams, registerBatch, moveBatch };