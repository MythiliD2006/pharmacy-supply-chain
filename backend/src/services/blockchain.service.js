const {
  ethers,
  provider,
  adminWallet,
  addresses,
  contracts,
  adminAccessControl,
  Role,
  RoleName,
  TransferStatus,
} = require("../config/blockchain");
const { BlockchainError, toBlockchainError } = require("../utils/blockchainErrors");
const { computeBatchHash, toUnixSeconds } = require("../utils/batchHash");

const { accessControl, registry, transfer } = contracts;


function checkAddress(address, field = "address") {
  if (!address || !ethers.isAddress(address)) {
    throw new BlockchainError("InvalidAddress", `Invalid wallet ${field}.`, 400);
  }
  return ethers.getAddress(address);
}

function toRole(role) {
  if (typeof role === "number" && RoleName[role]) return role;
  const n = Role[String(role)];
  if (!n) throw new BlockchainError("InvalidRole", `Unknown role "${role}".`, 400);
  return n;
}

const toIso = (seconds) => (Number(seconds) ? new Date(Number(seconds) * 1000).toISOString() : null);

async function wrap(fn) {
  try {
    return await fn();
  } catch (err) {
    throw toBlockchainError(err);
  }
}

function requireAdmin() {
  if (!adminAccessControl) {
    throw new BlockchainError("NoAdminKey", "ADMIN_PRIVATE_KEY is not set in backend/.env", 500);
  }
}

// sends an admin transaction, waits for it and returns a tx summary
async function sendAdminTx(method, args) {
  requireAdmin();
  return wrap(async () => {
    await adminAccessControl[method].staticCall(...args); // fail fast with a readable error
    const tx = await adminAccessControl[method](...args);
    const receipt = await tx.wait();
    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      status: receipt.status === 1 ? "success" : "failed",
      gasUsed: receipt.gasUsed.toString(),
    };
  });
}


function formatParticipant(address, p) {
  return {
    address: ethers.getAddress(address),
    name: p.name,
    role: RoleName[Number(p.role)],
    active: p.active,
    registered: Number(p.registeredAt) > 0,
    registeredAt: toIso(p.registeredAt),
  };
}

function formatBatch(b) {
  return {
    batchId: b.batchId,
    medicineName: b.medicineName,
    manufacturer: b.manufacturer,
    manufacturingDate: toIso(b.manufacturingDate),
    expiryDate: toIso(b.expiryDate),
    quantity: Number(b.quantity),
    dataHash: b.dataHash,
    currentHolder: b.currentHolder,
    registeredAt: toIso(b.registeredAt),
  };
}

function formatCustody(r) {
  return {
    from: r.from,
    to: r.to,
    fromRole: RoleName[Number(r.fromRole)],
    toRole: RoleName[Number(r.toRole)],
    timestamp: toIso(r.timestamp),
  };
}

function formatTransfer(t) {
  return {
    transferId: Number(t.id),
    batchId: t.batchId,
    from: t.from,
    to: t.to,
    fromRole: RoleName[Number(t.fromRole)],
    toRole: RoleName[Number(t.toRole)],
    status: TransferStatus[Number(t.status)],
    requestedAt: toIso(t.requestedAt),
    resolvedAt: toIso(t.resolvedAt),
  };
}



async function getNetworkInfo() {
  return wrap(async () => {
    const [network, blockNumber] = await Promise.all([provider.getNetwork(), provider.getBlockNumber()]);
    return {
      chainId: Number(network.chainId),
      blockNumber,
      contracts: addresses,
      admin: adminWallet ? adminWallet.address : null,
    };
  });
}

 

async function addParticipant(address, name, role) {
  return sendAdminTx("addParticipant", [checkAddress(address), String(name || "").trim(), toRole(role)]);
}

async function updateParticipant(address, name, role) {
  return sendAdminTx("updateParticipant", [checkAddress(address), String(name || "").trim(), toRole(role)]);
}

async function setParticipantStatus(address, active) {
  return sendAdminTx("setParticipantStatus", [checkAddress(address), Boolean(active)]);
}

async function getParticipant(address) {
  const addr = checkAddress(address);
  return wrap(async () => formatParticipant(addr, await accessControl.getParticipant(addr)));
}

async function getAllParticipants() {
  return wrap(async () => {
    const list = await accessControl.getAllParticipants();
    return Promise.all(list.map(async (a) => formatParticipant(a, await accessControl.getParticipant(a))));
  });
}


async function hasActiveRole(address, role) {
  const p = await getParticipant(address);
  if (!p.registered || !p.active) return false;
  return role ? p.role === role : true;
}



async function batchExists(batchId) {
  return wrap(() => registry.batchExists(String(batchId)));
}

/** returns null if the batch doesn't exist */
async function getBatch(batchId) {
  return wrap(async () => {
    if (!(await registry.batchExists(String(batchId)))) return null;
    return formatBatch(await registry.getBatch(String(batchId)));
  });
}

async function getBatchHistory(batchId) {
  return wrap(async () => (await registry.getCustodyHistory(String(batchId))).map(formatCustody));
}

async function getBatchIds(offset = 0, limit = 50) {
  return wrap(async () => [...(await registry.getBatchIds(offset, limit))]);
}


async function verifyBatch(batchId, expectedDataHash) {
  return wrap(async () => {
    const id = String(batchId).trim();
    const r = await registry.verifyBatch(id);

    if (!r.registered) {
      return {
        batchId: id,
        status: "UNREGISTERED",
        registered: false,
        message: "This batch is not registered on the blockchain. It may be counterfeit.",
      };
    }

    const [batch, history] = await Promise.all([registry.getBatch(id), registry.getCustodyHistory(id)]);
    const holder = await accessControl.getParticipant(r.currentHolder);
    const manufacturer = await accessControl.getParticipant(batch.manufacturer);

    let dataHashValid = null;
    if (expectedDataHash) dataHashValid = await registry.verifyDataHash(id, expectedDataHash);

    let status = "VERIFIED";
    let message = "Genuine batch with a valid supply-chain history.";
    if (!r.historyValid || dataHashValid === false) {
      status = "INCONSISTENT";
      message =
        dataHashValid === false
          ? "Batch details don't match the blockchain record."
          : "The recorded transfers don't follow the expected supply-chain order.";
    } else if (r.expired) {
      status = "EXPIRED";
      message = "This medicine has passed its expiry date.";
    }

    return {
      batchId: id,
      status,
      message,
      registered: true,
      expired: r.expired,
      historyValid: r.historyValid,
      dataHashValid,
      batch: { ...formatBatch(batch), manufacturerName: manufacturer.name },
      currentHolder: {
        address: r.currentHolder,
        name: holder.name,
        role: RoleName[Number(r.currentHolderRole)],
      },
      transferCount: Number(r.transferCount),
      history: history.map(formatCustody),
    };
  });
}


async function getTransfer(transferId) {
  return wrap(async () => formatTransfer(await transfer.getTransfer(transferId)));
}

async function getTransfersByIds(ids) {
  return Promise.all([...ids].map((id) => getTransfer(Number(id))));
}

async function getIncomingTransfers(address, { pendingOnly = false } = {}) {
  const list = await getTransfersByIds(await wrap(() => transfer.getIncomingTransfers(checkAddress(address))));
  return pendingOnly ? list.filter((t) => t.status === "Pending") : list;
}

async function getOutgoingTransfers(address) {
  return getTransfersByIds(await wrap(() => transfer.getOutgoingTransfers(checkAddress(address))));
}

async function getBatchTransfers(batchId) {
  return getTransfersByIds(await wrap(() => transfer.getBatchTransfers(String(batchId))));
}



async function simulate(contract, method, args, from) {
  const sender = checkAddress(from, "sender");
  return wrap(async () => {
    await contract[method].staticCall(...args, { from: sender });
    return {
      ok: true,
      tx: {
        from: sender,
        to: await contract.getAddress(),
        data: contract.interface.encodeFunctionData(method, args),
      },
    };
  });
}


async function validateRegisterBatch(from, data) {
  if (!data?.batchId || !data?.medicineName || !data?.quantity) {
    throw new BlockchainError("InvalidBatchData", "batchId, medicineName and quantity are required.", 400);
  }
  const mfg = toUnixSeconds(data.manufacturingDate);
  const exp = toUnixSeconds(data.expiryDate);
  if (exp <= Math.floor(Date.now() / 1000)) {
    throw new BlockchainError("BatchExpired", "Expiry date must be in the future.", 400);
  }
  const dataHash = computeBatchHash(data);
  const args = [String(data.batchId).trim(), String(data.medicineName).trim(), mfg, exp, BigInt(data.quantity), dataHash];
  const result = await simulate(registry, "registerBatch", args, from);
  return { ...result, dataHash };
}

async function validateRequestTransfer(from, batchId, to) {
  return simulate(transfer, "requestTransfer", [String(batchId).trim(), checkAddress(to, "receiver")], from);
}

async function validateConfirmTransfer(from, transferId) {
  return simulate(transfer, "confirmTransfer", [Number(transferId)], from);
}

async function validateRejectTransfer(from, transferId) {
  return simulate(transfer, "rejectTransfer", [Number(transferId)], from);
}

async function validateCancelTransfer(from, transferId) {
  return simulate(transfer, "cancelTransfer", [Number(transferId)], from);
}



const ourInterfaces = () => [
  [addresses.AccessControlManager, accessControl.interface],
  [addresses.BatchRegistry, registry.interface],
  [addresses.SupplyChainTransfer, transfer.interface],
];


async function getTransactionDetails(txHash, { confirmations = 1, timeoutMs = 120000 } = {}) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash || "")) {
    throw new BlockchainError("InvalidTxHash", "Invalid transaction hash.", 400);
  }

  return wrap(async () => {
    const tx = await provider.getTransaction(txHash);
    if (!tx) throw new BlockchainError("TxNotFound", "Transaction not found.", 404);

    const known = ourInterfaces().map(([a]) => a.toLowerCase());
    if (!tx.to || !known.includes(tx.to.toLowerCase())) {
      throw new BlockchainError("UnknownContract", "Transaction was not sent to a supply-chain contract.", 400);
    }

    const receipt = await provider.waitForTransaction(txHash, confirmations, timeoutMs);
    if (!receipt) throw new BlockchainError("TxTimeout", "Transaction is still pending. Try again shortly.", 202);

    const block = await provider.getBlock(receipt.blockNumber);
    const events = [];
    for (const log of receipt.logs) {
      const entry = ourInterfaces().find(([a]) => a.toLowerCase() === log.address.toLowerCase());
      if (!entry) continue;
      try {
        const parsed = entry[1].parseLog(log);
        if (parsed) events.push({ name: parsed.name, args: serializeArgs(parsed) });
      } catch (_) {
        /* not one of ours */
      }
    }

    let method = null;
    try {
      const entry = ourInterfaces().find(([a]) => a.toLowerCase() === tx.to.toLowerCase());
      method = entry[1].parseTransaction({ data: tx.data, value: tx.value })?.name || null;
    } catch (_) {
      /* ignore */
    }

    return {
      txHash: receipt.hash,
      from: tx.from,
      to: tx.to,
      method,
      status: receipt.status === 1 ? "success" : "failed",
      blockNumber: receipt.blockNumber,
      timestamp: toIso(block.timestamp),
      gasUsed: receipt.gasUsed.toString(),
      events,
    };
  });
}

/** Converts decoded event/function args into plain JSON (bigint -> number/string) */
function serializeArgs(parsed) {
  const out = {};
  parsed.fragment.inputs.forEach((input, i) => {
    let v = parsed.args[i];
    if (typeof v === "bigint") v = v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString();
    out[input.name || String(i)] = v;
  });
  return out;
}



async function getStats() {
  return wrap(async () => {
    const [batches, participants, transfers, confirmed, rejected] = await Promise.all([
      registry.batchCount(),
      accessControl.participantCount(),
      transfer.transferCount(),
      transfer.confirmedCount(),
      transfer.rejectedCount(),
    ]);
    return {
      totalBatches: Number(batches),
      totalParticipants: Number(participants),
      totalTransfers: Number(transfers),
      confirmedTransfers: Number(confirmed),
      rejectedTransfers: Number(rejected),
    };
  });
}

module.exports = {
  // network
  getNetworkInfo,
  // participants
  addParticipant,
  updateParticipant,
  setParticipantStatus,
  getParticipant,
  getAllParticipants,
  hasActiveRole,
  // batches
  batchExists,
  getBatch,
  getBatchHistory,
  getBatchIds,
  verifyBatch,
  // transfers
  getTransfer,
  getIncomingTransfers,
  getOutgoingTransfers,
  getBatchTransfers,
  // validation before signing
  validateRegisterBatch,
  validateRequestTransfer,
  validateConfirmTransfer,
  validateRejectTransfer,
  validateCancelTransfer,
  // tx tracking
  getTransactionDetails,
  serializeArgs,
  // dashboard
  getStats,
  // utils
  computeBatchHash,
};