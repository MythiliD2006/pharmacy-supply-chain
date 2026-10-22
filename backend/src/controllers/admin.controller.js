const asyncHandler = require("../utils/asyncHandler");
const { paginate, escapeRegex } = require("../utils/pagination");
const bc = require("../services/blockchain.service");
const { getSyncStatus } = require("../services/sync.service");
const { withNames } = require("./transfer.controller");

const Batch = require("../models/Batch");
const Participant = require("../models/Participant");
const Transfer = require("../models/Transfer");
const TransactionLog = require("../models/TransactionLog");
const VerificationLog = require("../models/VerificationLog");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");

const countBy = async (model, field, filter = {}) => {
  const rows = await model.aggregate([{ $match: filter }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }]);
  return Object.fromEntries(rows.map((r) => [r._id, r.count]));
};

// GET /api/admin/stats
const stats = asyncHandler(async (_req, res) => {
  const now = new Date();
  const [
    totalBatches,
    expiredBatches,
    recalledBatches,
    participantsTotal,
    participantsActive,
    participantsByRole,
    transfersByStatus,
    verificationsByStatus,
    verifiedBatchIds,
    rejectedAttempts,
    failedTransactions,
    chain,
    sync,
  ] = await Promise.all([
    Batch.countDocuments({ chainStatus: "confirmed" }),
    Batch.countDocuments({ chainStatus: "confirmed", expiryDate: { $lt: now } }),
    Batch.countDocuments({ chainStatus: "confirmed", recalled: true }),
    Participant.countDocuments({}),
    Participant.countDocuments({ active: true }),
    countBy(Participant, "role"),
    countBy(Transfer, "status"),
    countBy(VerificationLog, "status"),
    VerificationLog.distinct("batchId", { status: "VERIFIED" }),
    TransactionLog.countDocuments({ status: "rejected" }),
    TransactionLog.countDocuments({ status: "failed" }),
    bc.getStats().catch(() => null),
    getSyncStatus().catch(() => null),
  ]);

  const totalTransfers = Object.values(transfersByStatus).reduce((a, b) => a + b, 0);
  const totalVerifications = Object.values(verificationsByStatus).reduce((a, b) => a + b, 0);

  res.json({
    success: true,
    data: {
      batches: { total: totalBatches, expired: expiredBatches, recalled: recalledBatches },
      participants: { total: participantsTotal, active: participantsActive, byRole: participantsByRole },
      transfers: { total: totalTransfers, byStatus: transfersByStatus },
      verifications: {
        total: totalVerifications,
        byStatus: verificationsByStatus,
        verifiedMedicines: verifiedBatchIds.length,
      },
      invalidAttempts: { rejectedBeforeSigning: rejectedAttempts, failedOnChain: failedTransactions },
      chain,
      sync,
    },
  });
});

// GET /api/admin/batches?search=&page=
const batches = asyncHandler(async (req, res) => {
  const filter = { chainStatus: "confirmed" };
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), "i");
    filter.$or = [{ batchId: rx }, { medicineName: rx }, { manufacturerName: rx }];
  }
  if (req.query.recalled !== undefined) filter.recalled = req.query.recalled === "true";
  const result = await paginate(Batch, filter, req.query, { sort: { registeredAt: -1 } });
  const holders = await Participant.find({ walletAddress: { $in: result.items.map((b) => b.currentHolder) } })
    .select("walletAddress name role")
    .lean();
  const byWallet = Object.fromEntries(holders.map((p) => [p.walletAddress, p]));
  const now = Date.now();
  result.items = result.items.map((b) => ({
    ...b,
    expired: new Date(b.expiryDate).getTime() < now,
    currentHolderName: byWallet[b.currentHolder]?.name || null,
    currentHolderRole: byWallet[b.currentHolder]?.role || null,
  }));
  res.json({ success: true, data: result });
});

// GET /api/admin/transfers?status=
const transfers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.batchId) filter.batchId = req.query.batchId;
  const result = await paginate(Transfer, filter, req.query, { sort: { transferId: -1 } });
  result.items = await withNames(result.items);
  res.json({ success: true, data: result });
});

// GET /api/admin/transactions?status=success|failed|rejected&action=
// status=rejected -> invalid attempts the backend blocked
const transactions = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.action) filter.action = req.query.action;
  if (req.query.batchId) filter.batchId = req.query.batchId;
  const result = await paginate(TransactionLog, filter, req.query, {
    sort: { createdAt: -1 },
    populate: { path: "user", select: "name email" },
  });
  res.json({ success: true, data: result });
});

// GET /api/admin/verifications?status=
const verifications = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const result = await paginate(VerificationLog, filter, req.query, { sort: { createdAt: -1 } });
  res.json({ success: true, data: result });
});

// GET /api/admin/verifications/suspicious?hours=24&min=25
// batches whose QR code was scanned unusually often (possible copied codes)
const suspiciousScans = asyncHandler(async (req, res) => {
  const hours = Math.min(Number(req.query.hours) || Number(process.env.SCAN_WINDOW_HOURS) || 24, 24 * 30);
  const min = Number(req.query.min) || Number(process.env.SCAN_WARNING_THRESHOLD) || 25;
  const since = new Date(Date.now() - hours * 3600 * 1000);
  const rows = await VerificationLog.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: "$batchId", scans: { $sum: 1 }, ips: { $addToSet: "$ip" }, lastScan: { $max: "$createdAt" } } },
    { $match: { scans: { $gt: min } } },
    { $sort: { scans: -1 } },
    { $limit: 100 },
  ]);
  res.json({
    success: true,
    data: {
      hours,
      threshold: min,
      items: rows.map((r) => ({
        batchId: r._id,
        scans: r.scans,
        uniqueDevices: r.ips.filter(Boolean).length,
        lastScan: r.lastScan,
      })),
    },
  });
});

// GET /api/admin/sync
const sync = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await getSyncStatus() });
});

// POST /api/admin/admins — provision an administrator account (admins only)
const createAdmin = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.exists({ email })) {
    throw ApiError.conflict("This email is already used by another account.", "EmailTaken");
  }

  const user = await User.create({ name, email, password, role: "admin" });
  res.status(201).json({ success: true, data: { user: user.toJSON() } });
});

module.exports = { stats, batches, transfers, transactions, verifications, suspiciousScans, sync, createAdmin };