const Transfer = require("../models/Transfer");
const Batch = require("../models/Batch");
const Participant = require("../models/Participant");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { paginate } = require("../utils/pagination");
const bc = require("../services/blockchain.service");
const { logRejected } = require("../services/sync.service");

// adds names of both parties + medicine name to transfer rows
async function withNames(transfers) {
  const wallets = [...new Set(transfers.flatMap((t) => [t.from, t.to]))];
  const batchIds = [...new Set(transfers.map((t) => t.batchId))];
  const [participants, batches] = await Promise.all([
    Participant.find({ walletAddress: { $in: wallets } }).select("walletAddress name").lean(),
    Batch.find({ batchId: { $in: batchIds } }).select("batchId medicineName").lean(),
  ]);
  const names = Object.fromEntries(participants.map((p) => [p.walletAddress, p.name]));
  const meds = Object.fromEntries(batches.map((b) => [b.batchId, b.medicineName]));
  return transfers.map((t) => ({
    ...t,
    fromName: names[t.from] || null,
    toName: names[t.to] || null,
    medicineName: meds[t.batchId] || null,
  }));
}

// GET /api/transfers?direction=incoming|outgoing|all&status=Pending&batchId=
const list = asyncHandler(async (req, res) => {
  const { direction, status, batchId } = req.query;
  const filter = {};

  if (req.user.role !== "admin") {
    const wallet = req.user.participant.walletAddress;
    if (direction === "incoming") filter.to = wallet;
    else if (direction === "outgoing") filter.from = wallet;
    else filter.$or = [{ from: wallet }, { to: wallet }];
  }
  if (status) filter.status = status;
  if (batchId) filter.batchId = batchId;

  const result = await paginate(Transfer, filter, req.query, { sort: { transferId: -1 } });
  result.items = await withNames(result.items);
  res.json({ success: true, data: result });
});

/**
 * POST /api/transfers/prepare  { batchId, to }
 * Current holder starts a transfer. Returns the tx for MetaMask.
 */
const prepareRequest = asyncHandler(async (req, res) => {
  const { batchId, to } = req.body;
  const wallet = req.user.participant.walletAddress;
  try {
    const validation = await bc.validateRequestTransfer(wallet, batchId, to);
    res.json({ success: true, data: { tx: validation.tx } });
  } catch (err) {
    if (err.status && err.status < 500) {
      await logRejected({ action: "requestTransfer", user: req.user, err, batchId });
    }
    throw err;
  }
});

/**
 * POST /api/transfers/:transferId/:action/prepare   action = confirm | reject | cancel
 * Receiver confirms/rejects, sender cancels. Returns the tx for MetaMask.
 */
const prepareAction = asyncHandler(async (req, res) => {
  const { transferId, action } = req.params;
  const wallet = req.user.participant.walletAddress;
  const fn = {
    confirm: bc.validateConfirmTransfer,
    reject: bc.validateRejectTransfer,
    cancel: bc.validateCancelTransfer,
  }[action];

  const transfer = await Transfer.findOne({ transferId }).lean();
  try {
    const validation = await fn(wallet, transferId);
    res.json({ success: true, data: { tx: validation.tx } });
  } catch (err) {
    if (err.status && err.status < 500) {
      await logRejected({
        action: `${action}Transfer`,
        user: req.user,
        err,
        transferId,
        batchId: transfer?.batchId || null,
      });
    }
    throw err;
  }
});

// GET /api/transfers/:transferId
const getOne = asyncHandler(async (req, res) => {
  const transfer = await Transfer.findOne({ transferId: Number(req.params.transferId) }).lean();
  if (!transfer) throw ApiError.notFound("Transfer not found.", "TransferNotFound");
  const wallet = req.user.participant?.walletAddress;
  if (req.user.role !== "admin" && transfer.from !== wallet && transfer.to !== wallet) {
    throw ApiError.forbidden("This transfer doesn't involve your organisation.");
  }
  const [item] = await withNames([transfer]);
  res.json({ success: true, data: { transfer: item } });
});

module.exports = { list, prepareRequest, prepareAction, getOne, withNames };