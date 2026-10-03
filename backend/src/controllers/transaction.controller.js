const asyncHandler = require("../utils/asyncHandler");
const Batch = require("../models/Batch");
const Transfer = require("../models/Transfer");
const { recordTransaction } = require("../services/sync.service");

/**
 * POST /api/transactions  { txHash }
 * Called by the frontend right after MetaMask sends a transaction.
 * Waits until it's mined, updates MongoDB, and returns the affected batch/transfer.
 */
const submit = asyncHandler(async (req, res) => {
  const result = await recordTransaction(req.body.txHash, req.user);

  const [batch, transfer] = await Promise.all([
    result.batchId ? Batch.findOne({ batchId: result.batchId }).lean() : null,
    result.transferId !== null ? Transfer.findOne({ transferId: result.transferId }).lean() : null,
  ]);

  res.status(result.status === "success" ? 200 : 422).json({
    success: result.status === "success",
    data: { transaction: result, batch, transfer },
    ...(result.status !== "success"
      ? { error: { code: "TransactionFailed", message: "The transaction failed on the blockchain." } }
      : {}),
  });
});

module.exports = { submit };