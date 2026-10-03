const { provider, addresses, RoleName } = require("../config/blockchain");
const bc = require("./blockchain.service");
const { createEventListener } = require("./eventListener.service");
const ApiError = require("../utils/ApiError");

const Participant = require("../models/Participant");
const Batch = require("../models/Batch");
const Transfer = require("../models/Transfer");
const TransactionLog = require("../models/TransactionLog");
const VerificationLog = require("../models/VerificationLog");
const SyncState = require("../models/SyncState");

/**
 * Applies blockchain events to MongoDB.
 * Every handler is idempotent (safe to run twice) and ordered by event position,
 * so the event listener and POST /api/transactions can both call it.
 */

const LOCAL_CHAIN_ID = 31337;
const pos = (e) => Number(e.blockNumber) * 100000 + Number(e.logIndex || 0);
const toDate = (iso) => (iso ? new Date(iso) : null);
const roleName = (r) => (typeof r === "number" ? RoleName[r] : r);

// which contract function produced each event, and who the actor was
const EVENT_ACTION = {
  ParticipantAdded: { action: "addParticipant" },
  ParticipantUpdated: { action: "updateParticipant" },
  ParticipantStatusChanged: { action: "setParticipantStatus" },
  AdminTransferred: { action: "transferAdmin", actor: (a) => a.previousAdmin },
  BatchRegistered: { action: "registerBatch", actor: (a) => a.manufacturer },
  CustodyTransferred: { action: "confirmTransfer", actor: (a) => a.to, onInsertOnly: true },
  TransferRequested: { action: "requestTransfer", actor: (a) => a.from },
  TransferConfirmed: { action: "confirmTransfer", actor: (a) => a.to },
  TransferRejected: { action: "rejectTransfer", actor: (a) => a.to },
  TransferCancelled: { action: "cancelTransfer", actor: (a) => a.from },
};

async function participantName(wallet) {
  const p = await Participant.findOne({ walletAddress: wallet }).select("name").lean();
  if (p) return p.name;
  try {
    return (await bc.getParticipant(wallet)).name;
  } catch (_) {
    return "";
  }
}

// make sure a Transfer doc exists (fills it from the chain if the request event wasn't synced yet)
async function ensureTransfer(transferId) {
  if (await Transfer.exists({ transferId })) return;
  const t = await bc.getTransfer(transferId);
  await Transfer.updateOne(
    { transferId },
    {
      $setOnInsert: {
        batchId: t.batchId,
        from: t.from,
        to: t.to,
        fromRole: t.fromRole,
        toRole: t.toRole,
        status: "Pending",
        requestedAt: toDate(t.requestedAt),
      },
    },
    { upsert: true }
  );
}

const handlers = {
  async ParticipantAdded(e) {
    const { account, name, role } = e.args;
    await Participant.updateOne(
      { walletAddress: account },
      {
        $setOnInsert: { name, role: roleName(role), active: true },
        $set: { "onChain.registered": true, "onChain.txHash": e.txHash, "onChain.blockNumber": e.blockNumber },
      },
      { upsert: true }
    );
  },

  async ParticipantUpdated(e) {
    const { account, name, role } = e.args;
    await Participant.updateOne(
      { walletAddress: account, chainEventPos: { $lt: pos(e) } },
      { $set: { name, role: roleName(role), chainEventPos: pos(e) } }
    );
  },

  async ParticipantStatusChanged(e) {
    const { account, active } = e.args;
    await Participant.updateOne(
      { walletAddress: account, chainEventPos: { $lt: pos(e) } },
      { $set: { active, chainEventPos: pos(e) } }
    );
  },

  async BatchRegistered(e) {
    const { batchId } = e.args;
    const chain = await bc.getBatch(batchId);
    if (!chain) return;
    const existing = await Batch.findOne({ batchId }).select("chainStatus").lean();

    const set = {
      medicineName: chain.medicineName,
      manufacturer: chain.manufacturer,
      manufacturerName: await participantName(chain.manufacturer),
      manufacturingDate: toDate(chain.manufacturingDate),
      expiryDate: toDate(chain.expiryDate),
      quantity: chain.quantity,
      dataHash: chain.dataHash,
      chainStatus: "confirmed",
      registerTxHash: e.txHash,
      registerBlock: e.blockNumber,
      registeredAt: toDate(chain.registeredAt),
    };
    // first time we see it confirmed: holder starts at the manufacturer, later custody events move it
    if (!existing || existing.chainStatus !== "confirmed") {
      set.currentHolder = chain.manufacturer;
      set.holderEventPos = pos(e);
    }
    await Batch.updateOne({ batchId }, { $set: set }, { upsert: true });
  },

  async CustodyTransferred(e) {
    const { batchId, to } = e.args;
    await Batch.updateOne(
      { batchId, holderEventPos: { $lt: pos(e) } },
      { $set: { currentHolder: to, holderEventPos: pos(e) } }
    );
  },

  async TransferRequested(e) {
    const { transferId, batchId, from, to } = e.args;
    let roles = {};
    if (!(await Transfer.exists({ transferId }))) {
      const t = await bc.getTransfer(transferId);
      roles = { fromRole: t.fromRole, toRole: t.toRole };
    }
    await Transfer.updateOne(
      { transferId },
      {
        $setOnInsert: { batchId, from, to, status: "Pending", ...roles },
        $set: { requestTxHash: e.txHash, requestedAt: toDate(e.timestamp) },
      },
      { upsert: true }
    );
  },

  async TransferConfirmed(e) {
    await resolveTransfer(e, "Confirmed");
  },
  async TransferRejected(e) {
    await resolveTransfer(e, "Rejected");
  },
  async TransferCancelled(e) {
    await resolveTransfer(e, "Cancelled");
  },
};

async function resolveTransfer(e, status) {
  const transferId = Number(e.args.transferId);
  await ensureTransfer(transferId);
  await Transfer.updateOne(
    { transferId },
    { $set: { status, resolveTxHash: e.txHash, resolvedAt: toDate(e.timestamp) } }
  );
}

async function logEvent(e) {
  if (!e.txHash) return;
  const meta = EVENT_ACTION[e.event] || { action: e.event };
  const set = { status: "success", blockNumber: e.blockNumber, timestamp: toDate(e.timestamp) };
  const setOnInsert = {};
  (meta.onInsertOnly ? setOnInsert : set).action = meta.action;
  const actor = meta.actor?.(e.args);
  if (actor) (meta.onInsertOnly ? setOnInsert : set).actor = actor;
  if (e.args.batchId) set.batchId = e.args.batchId;
  if (e.args.transferId !== undefined) set.transferId = Number(e.args.transferId);

  const update = { $set: set, $addToSet: { events: e.event } };
  if (Object.keys(setOnInsert).length) update.$setOnInsert = setOnInsert;
  await TransactionLog.updateOne({ txHash: e.txHash }, update, { upsert: true });
}

/** e = { event, args, txHash, blockNumber, logIndex, timestamp } */
async function applyEvent(e) {
  const handler = handlers[e.event];
  if (handler) await handler(e);
  await logEvent(e);
}

// ---------------------------------------------------------------------------
// transactions sent from MetaMask
// ---------------------------------------------------------------------------

/**
 * Called after the frontend sends a transaction with MetaMask.
 * Waits for it, checks it came from the user's wallet, and updates MongoDB right away
 * (the event listener would also catch it a few seconds later).
 */
async function recordTransaction(txHash, user) {
  const d = await bc.getTransactionDetails(txHash);

  if (user.role === "participant") {
    const wallet = user.participant?.walletAddress || "";
    if (d.from.toLowerCase() !== wallet.toLowerCase()) {
      throw ApiError.forbidden(
        "This transaction was sent from a different wallet than the one linked to your account.",
        "WalletMismatch"
      );
    }
  }

  for (const ev of d.events) {
    await applyEvent({
      event: ev.name,
      args: ev.args,
      txHash: d.txHash,
      blockNumber: d.blockNumber,
      logIndex: ev.logIndex,
      timestamp: d.timestamp,
    });
  }

  const batchId = d.events.find((e) => e.args.batchId)?.args.batchId || null;
  const transferEvent = d.events.find((e) => e.args.transferId !== undefined);
  const transferId = transferEvent ? Number(transferEvent.args.transferId) : null;

  await TransactionLog.updateOne(
    { txHash: d.txHash },
    {
      $set: {
        status: d.status,
        action: d.method || "unknown",
        actor: d.from,
        user: user.id,
        blockNumber: d.blockNumber,
        timestamp: toDate(d.timestamp),
        ...(batchId ? { batchId } : {}),
        ...(transferId !== null ? { transferId } : {}),
        ...(d.status === "failed" ? { errorCode: "Reverted", errorMessage: "Transaction reverted on-chain." } : {}),
      },
    },
    { upsert: true }
  );

  return {
    txHash: d.txHash,
    status: d.status,
    method: d.method,
    blockNumber: d.blockNumber,
    timestamp: d.timestamp,
    events: d.events.map((e) => e.name),
    batchId,
    transferId,
  };
}

/** Records an attempt the backend refused before anything was signed */
async function logRejected({ action, user, err, batchId = null, transferId = null }) {
  try {
    await TransactionLog.create({
      action,
      status: "rejected",
      actor: user?.participant?.walletAddress || null,
      user: user?.id || null,
      batchId,
      transferId,
      errorCode: typeof err?.code === "string" ? err.code : "Rejected",
      errorMessage: err?.message || "Rejected",
    });
  } catch (e) {
    console.error("[sync] could not log rejected attempt:", e.message);
  }
}

/** Records an admin transaction sent by the backend wallet */
async function logAdminTx(result, { action, user }) {
  await TransactionLog.updateOne(
    { txHash: result.txHash },
    {
      $set: {
        action,
        status: result.status,
        actor: (await bc.getNetworkInfo()).admin,
        user: user?.id || null,
        blockNumber: result.blockNumber,
      },
    },
    { upsert: true }
  );
}

// ---------------------------------------------------------------------------
// event listener + chain reset detection
// ---------------------------------------------------------------------------

const syncKey = (chainId) => `events:${chainId}:${addresses.BatchRegistry.toLowerCase()}`;

/** Wipes everything that came from the chain (used when the local chain restarts or contracts are redeployed) */
async function resetChainData(reason) {
  console.warn(`[sync] ${reason} – clearing blockchain data from MongoDB and resyncing`);
  await Promise.all([
    Batch.deleteMany({}),
    Transfer.deleteMany({}),
    TransactionLog.deleteMany({}),
    VerificationLog.deleteMany({}),
    Participant.updateMany(
      {},
      {
        $set: {
          "onChain.registered": false,
          "onChain.txHash": null,
          "onChain.blockNumber": null,
          chainEventPos: 0,
        },
      }
    ),
  ]);
}

/** Returns true if MongoDB holds data from a different chain/deployment than the current one */
async function checkChainReset(chainId) {
  const key = syncKey(chainId);
  const genesisHash = (await provider.getBlock(0)).hash;
  const state = await SyncState.findOne({ key });

  if (!state) {
    const others = await SyncState.countDocuments({ key: { $ne: key } });
    if (others > 0) {
      await resetChainData("contracts were redeployed");
      await SyncState.deleteMany({ key: { $ne: key } });
    }
    await SyncState.create({ key, chainId, genesisHash, lastBlock: null });
    return others > 0;
  }

  if (state.genesisHash && state.genesisHash !== genesisHash) {
    await resetChainData("blockchain was restarted");
    await SyncState.updateOne({ key }, { $set: { genesisHash, lastBlock: null } });
    return true;
  }
  if (!state.genesisHash) await SyncState.updateOne({ key }, { $set: { genesisHash } });
  return false;
}

async function createSyncedListener(options = {}) {
  const { chainId } = await bc.getNetworkInfo();
  const key = syncKey(chainId);
  let checkedOnce = false;

  return createEventListener({
    onEvent: applyEvent,
    getLastBlock: async () => (await SyncState.findOne({ key }).lean())?.lastBlock ?? null,
    saveLastBlock: (lastBlock) => SyncState.updateOne({ key }, { $set: { lastBlock } }, { upsert: true }),
    // local chain can be restarted any time, so check every poll; on Sepolia once is enough
    beforeSync: async () => {
      if (checkedOnce && chainId !== LOCAL_CHAIN_ID) return false;
      checkedOnce = true;
      return checkChainReset(chainId);
    },
    ...options,
  });
}

async function getSyncStatus() {
  const info = await bc.getNetworkInfo();
  const state = await SyncState.findOne({ key: syncKey(info.chainId) }).lean();
  return {
    chainId: info.chainId,
    chainHead: info.blockNumber,
    lastSyncedBlock: state?.lastBlock ?? null,
    behindBy: state?.lastBlock != null ? Math.max(0, info.blockNumber - state.lastBlock) : null,
    contracts: info.contracts,
  };
}

module.exports = {
  applyEvent,
  recordTransaction,
  logRejected,
  logAdminTx,
  resetChainData,
  checkChainReset,
  createSyncedListener,
  getSyncStatus,
};