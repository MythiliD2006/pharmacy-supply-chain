const mongoose = require("mongoose");

// Mirrors SupplyChainTransfer on-chain. Created from the TransferRequested event.
const transferSchema = new mongoose.Schema(
  {
    transferId: { type: Number, required: true, unique: true }, // on-chain id
    batchId: { type: String, required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    fromRole: { type: String, default: null },
    toRole: { type: String, default: null },
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Rejected", "Cancelled"],
      default: "Pending",
    },
    requestTxHash: { type: String, default: null },
    resolveTxHash: { type: String, default: null },
    requestedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

transferSchema.index({ batchId: 1 });
transferSchema.index({ to: 1, status: 1 });
transferSchema.index({ from: 1, status: 1 });

module.exports = mongoose.model("Transfer", transferSchema);