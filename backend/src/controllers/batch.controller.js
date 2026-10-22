const Batch = require("../models/Batch");
const Transfer = require("../models/Transfer");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { paginate, escapeRegex } = require("../utils/pagination");
const bc = require("../services/blockchain.service");
const qr = require("../services/qr.service");
const { logRejected } = require("../services/sync.service");
const { verifyBatch } = require("../services/verification.service");

/**
 * POST /api/batches/prepare   (Manufacturer)
 * Step 1 of registering a batch: validates everything (incl. a dry run on the
 * blockchain) and returns the transaction for MetaMask to sign.
 * Step 2: frontend sends it with MetaMask and posts the hash to POST /api/transactions.
 */
const prepare = asyncHandler(async (req, res) => {
  const data = req.body;
  const wallet = req.user.participant.walletAddress;

  try {
    const existing = await Batch.findOne({ batchId: data.batchId }).lean();
    if (existing?.chainStatus === "confirmed") {
      throw ApiError.conflict("A batch with this ID already exists.", "BatchAlreadyExists");
    }

    const validation = await bc.validateRegisterBatch(wallet, data);

    // keep a pending draft so off-chain fields (description) survive until the tx is mined
    await Batch.updateOne(
      { batchId: data.batchId },
      {
        $set: {
          medicineName: data.medicineName,
          description: data.description || "",
          manufacturer: wallet,
          manufacturerName: req.user.participant.name,
          manufacturingDate: data.manufacturingDate,
          expiryDate: data.expiryDate,
          quantity: data.quantity,
          dataHash: validation.dataHash,
          chainStatus: "pending",
        },
      },
      { upsert: true }
    );

    res.json({
      success: true,
      data: {
        tx: validation.tx,
        dataHash: validation.dataHash,
        next: "Send `tx` with MetaMask, then POST the transaction hash to /api/transactions",
      },
    });
  } catch (err) {
    if (err.status && err.status < 500) {
      await logRejected({ action: "registerBatch", user: req.user, err, batchId: data.batchId });
    }
    throw err;
  }
});

/**
 * POST /api/batches/:batchId/recall/prepare   (Manufacturer of that batch)
 * Body: { reason }
 * Simulates recallBatch() as the manufacturer and returns the tx for MetaMask.
 * Once recalled, the contracts block every further transfer and every
 * customer scan shows the batch as RECALLED.
 */
const prepareRecall = asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  const { reason } = req.body;
  const wallet = req.user.participant.walletAddress;

  try {
    const batch = await Batch.findOne({ batchId, chainStatus: "confirmed" }).lean();
    if (!batch) throw ApiError.notFound("Batch not found.", "BatchNotFound");
    if (batch.manufacturer.toLowerCase() !== wallet.toLowerCase()) {
      throw ApiError.forbidden("Only the manufacturer that registered this batch can recall it.", "NotBatchManufacturer");
    }
    if (batch.recalled) throw ApiError.conflict("This batch has already been recalled.", "AlreadyRecalled");

    const validation = await bc.validateRecallBatch(wallet, batchId, reason);
    res.json({
      success: true,
      data: {
        tx: validation.tx,
        next: "Send `tx` with MetaMask, then POST the transaction hash to /api/transactions",
      },
    });
  } catch (err) {
    if (err.status && err.status < 500) {
      await logRejected({ action: "recallBatch", user: req.user, err, batchId });
    }
    throw err;
  }
});

// GET /api/batches?scope=holding|manufactured|all&search=&recalled=true
const list = asyncHandler(async (req, res) => {
  const { scope, search } = req.query;
  const filter = { chainStatus: "confirmed" };
  const isAdmin = req.user.role === "admin";

  // admins always see everything; participants see what they hold or made
  if (!isAdmin) {
    const wallet = req.user.participant.walletAddress;
    if (scope === "manufactured") filter.manufacturer = wallet;
    else filter.currentHolder = wallet;
  }
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ batchId: rx }, { medicineName: rx }];
  }
  if (req.query.recalled !== undefined) filter.recalled = req.query.recalled === true || req.query.recalled === "true";

  const result = await paginate(Batch, filter, req.query, { sort: { registeredAt: -1 } });
  const now = Date.now();
  result.items = result.items.map((b) => ({ ...b, expired: new Date(b.expiryDate).getTime() < now }));
  res.json({ success: true, data: result });
});

// GET /api/batches/:batchId
const getOne = asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  const batch = await Batch.findOne({ batchId, chainStatus: "confirmed" }).lean();
  if (!batch) throw ApiError.notFound("Batch not found.", "BatchNotFound");

  if (req.user.role !== "admin") {
    const wallet = req.user.participant.walletAddress;
    const [hasCustodyRecord] = await Transfer.find({ batchId, $or: [{ from: wallet }, { to: wallet }] }).limit(1).select("_id").lean();
    const isManufacturer = batch.manufacturer.toLowerCase() === wallet.toLowerCase();
    const isCurrentHolder = batch.currentHolder?.toLowerCase() === wallet.toLowerCase();
    if (!isManufacturer && !isCurrentHolder && !hasCustodyRecord) {
      throw ApiError.forbidden("This batch is not part of your organisation's records.");
    }
  }

  const [history, transfers, verification, qrCode] = await Promise.all([
    bc.getBatchHistory(batchId),
    Transfer.find({ batchId }).sort({ transferId: 1 }).lean(),
    verifyBatch(batchId, { log: false }),
    qr.toDataUrl(batchId),
  ]);

  const pendingTransfer = transfers.find((t) => t.status === "Pending") || null;
  const wallet = req.user.participant?.walletAddress;

  res.json({
    success: true,
    data: {
      batch: { ...batch, expired: new Date(batch.expiryDate).getTime() < Date.now() },
      status: verification.status,
      statusMessage: verification.message,
      history,
      transfers,
      pendingTransfer,
      isHolder: Boolean(wallet && wallet === batch.currentHolder),
      isManufacturer: Boolean(wallet && wallet.toLowerCase() === batch.manufacturer.toLowerCase()),
      recall: verification.recall || null,
      qrCode,
      verifyUrl: qr.verifyUrl(batchId),
    },
  });
});

// GET /api/batches/:batchId/qr?format=png|dataurl
const getQr = asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  if (!(await Batch.exists({ batchId, chainStatus: "confirmed" }))) {
    throw ApiError.notFound("Batch not found.", "BatchNotFound");
  }
  if (req.query.format === "dataurl") {
    return res.json({ success: true, data: { qrCode: await qr.toDataUrl(batchId), verifyUrl: qr.verifyUrl(batchId) } });
  }
  const png = await qr.toPngBuffer(batchId);
  res.set("Content-Type", "image/png");
  res.set("Content-Disposition", `attachment; filename="${batchId.replace(/[^\w.-]/g, "_")}-qr.png"`);
  res.send(png);
});

module.exports = { prepare, prepareRecall, list, getOne, getQr };