const mongoose = require("mongoose");

/**
 * One row per blockchain transaction (status success/failed),
 * plus attempts the backend blocked before anything was signed (status rejected).
 * The admin portal uses this for "transaction status" and "invalid attempts".
 */
const transactionLogSchema = new mongoose.Schema(
  {
    txHash: { type: String, default: null },
    action: { type: String, required: true }, // registerBatch, requestTransfer, addParticipant, ...
    status: { type: String, enum: ["success", "failed", "rejected"], required: true },
    actor: { type: String, default: null }, // wallet
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    batchId: { type: String, default: null },
    transferId: { type: Number, default: null },
    blockNumber: { type: Number, default: null },
    timestamp: { type: Date, default: Date.now },
    events: { type: [String], default: [] },
    errorCode: { type: String, default: null },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true }
);

transactionLogSchema.index({ txHash: 1 });
transactionLogSchema.index({ status: 1, createdAt: -1 });
transactionLogSchema.index({ batchId: 1 });

module.exports = mongoose.model("TransactionLog", transactionLogSchema);