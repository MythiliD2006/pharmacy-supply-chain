const mongoose = require("mongoose");

// Every customer verification (QR scan / batch search)
const verificationLogSchema = new mongoose.Schema(
  {
    batchId: { type: String, required: true },
    status: {
      type: String,
      enum: ["VERIFIED", "UNREGISTERED", "EXPIRED", "INCONSISTENT"],
      required: true,
    },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true }
);

verificationLogSchema.index({ status: 1 });
verificationLogSchema.index({ batchId: 1 });

module.exports = mongoose.model("VerificationLog", verificationLogSchema);