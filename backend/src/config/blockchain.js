const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
require("dotenv").config();

// ABIs are copied here by contracts/scripts/deploy.js
const abiDir = path.join(__dirname, "..", "abi");

function loadAbi(name) {
  const file = path.join(abiDir, `${name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ABI ${file}. Run contracts/scripts/deploy.js first.`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in backend/.env`);
  return value;
}

// Must match the enums in the Solidity contracts
const Role = { None: 0, Manufacturer: 1, Distributor: 2, Wholesaler: 3, Pharmacy: 4 };
const RoleName = ["None", "Manufacturer", "Distributor", "Wholesaler", "Pharmacy"];
const TransferStatus = ["Pending", "Confirmed", "Rejected", "Cancelled"];

const provider = new ethers.JsonRpcProvider(requireEnv("RPC_URL"), Number(process.env.CHAIN_ID) || undefined, {
  staticNetwork: true,
});
provider.pollingInterval = Number(process.env.RPC_POLL_MS || 1000);

// Admin wallet: used only for admin actions (participant management).
// Manufacturers/distributors/etc. sign their own transactions in MetaMask.
const adminWallet = process.env.ADMIN_PRIVATE_KEY
  ? new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider)
  : null;

const addresses = {
  AccessControlManager: requireEnv("ACCESS_CONTROL_ADDRESS"),
  BatchRegistry: requireEnv("BATCH_REGISTRY_ADDRESS"),
  SupplyChainTransfer: requireEnv("SUPPLY_CHAIN_TRANSFER_ADDRESS"),
};

const abis = {
  AccessControlManager: loadAbi("AccessControlManager"),
  BatchRegistry: loadAbi("BatchRegistry"),
  SupplyChainTransfer: loadAbi("SupplyChainTransfer"),
};

// read-only instances
const contracts = {
  accessControl: new ethers.Contract(addresses.AccessControlManager, abis.AccessControlManager, provider),
  registry: new ethers.Contract(addresses.BatchRegistry, abis.BatchRegistry, provider),
  transfer: new ethers.Contract(addresses.SupplyChainTransfer, abis.SupplyChainTransfer, provider),
};

// admin-signed instance (null if no key configured)
const adminAccessControl = adminWallet
  ? new ethers.Contract(addresses.AccessControlManager, abis.AccessControlManager, adminWallet)
  : null;

module.exports = {
  ethers,
  provider,
  adminWallet,
  addresses,
  abis,
  contracts,
  adminAccessControl,
  Role,
  RoleName,
  TransferStatus,
};