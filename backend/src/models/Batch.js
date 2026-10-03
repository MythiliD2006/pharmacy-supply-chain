const mongoose = require("mongoose");

// Off-chain copy of a batch. On-chain fields are filled from the blockchain
// once the registration transaction is mined (chainStatus: "confirmed").
const batchSchema = new mongoose.Schema(
  {
    batchId: { type: String, required: true, unique: true, trim: true },
    medicineName: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    manufacturer: { type: String, required: true }, // wallet
    manufacturerName: { type: String, default: "" },
    manufacturingDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    quantity: { type: Number, required: true, min: 1 },
    dataHash: { type: String, default: null },
    currentHolder: { type: String, default: null }, // wallet

    // "pending" = prepared but not yet mined, "confirmed" = on-chain
    chainStatus: { type: String, enum: ["pending", "confirmed"], default: "pending" },
    registerTxHash: { type: String, default: null },
    registerBlock: { type: Number, default: null },
    registeredAt: { type: Date, default: null },

    holderEventPos: { type: Number, default: 0 },
  },
  { timestamps: true }
);

batchSchema.index({ currentHolder: 1, chainStatus: 1 });
batchSchema.index({ manufacturer: 1, chainStatus: 1 });

module.exports = mongoose.model("Batch", batchSchema);