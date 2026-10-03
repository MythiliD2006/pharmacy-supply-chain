const mongoose = require("mongoose");

const ROLES = ["Manufacturer", "Distributor", "Wholesaler", "Pharmacy"];

// Supply-chain organisation. Mirrors AccessControlManager on-chain.
const participantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    walletAddress: { type: String, required: true, unique: true }, // checksummed
    role: { type: String, enum: ROLES, required: true },
    active: { type: Boolean, default: true },
    location: { type: String, trim: true, default: "" },
    contactPhone: { type: String, trim: true, default: "" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    onChain: {
      registered: { type: Boolean, default: false },
      txHash: { type: String, default: null },
      blockNumber: { type: Number, default: null },
    },
    // position (block * 1e5 + logIndex) of the last on-chain event applied, so old events never overwrite newer ones
    chainEventPos: { type: Number, default: 0 },
  },
  { timestamps: true }
);

participantSchema.index({ role: 1, active: 1 });

participantSchema.statics.ROLES = ROLES;

module.exports = mongoose.model("Participant", participantSchema);