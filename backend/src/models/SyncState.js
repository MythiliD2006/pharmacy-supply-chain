const mongoose = require("mongoose");

// Remembers how far the event listener has synced, per chain + contract
const syncStateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    chainId: { type: Number, required: true },
    genesisHash: { type: String, default: null },
    lastBlock: { type: Number, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SyncState", syncStateSchema);