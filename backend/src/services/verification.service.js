const bc = require("./blockchain.service");
const { computeBatchHash } = require("../utils/batchHash");
const Batch = require("../models/Batch");
const Transfer = require("../models/Transfer");
const Participant = require("../models/Participant");
const VerificationLog = require("../models/VerificationLog");

/**
 * Customer verification (section 3 of the spec):
 *   UNREGISTERED – batch not on the blockchain
 *   EXPIRED      – expiry date has passed
 *   INCONSISTENT – transfers out of order, or the database copy was tampered with
 *   VERIFIED     – registered, in date, valid history
 *
 * The blockchain is the source of truth. MongoDB only adds names, description
 * and transaction hashes for display.
 */
async function verifyBatch(batchId, { ip = null, userAgent = null, log = true } = {}) {
  const id = String(batchId).trim();
  const record = await Batch.findOne({ batchId: id, chainStatus: "confirmed" }).lean();

  // hash of what our database says, compared with the hash stored on-chain
  const expectedHash = record
    ? computeBatchHash({
        batchId: record.batchId,
        medicineName: record.medicineName,
        manufacturingDate: record.manufacturingDate,
        expiryDate: record.expiryDate,
        quantity: record.quantity,
      })
    : undefined;

  const result = await bc.verifyBatch(id, expectedHash);

  if (result.registered) {
    const wallets = [
      ...new Set([result.batch.manufacturer, ...result.history.flatMap((h) => [h.from, h.to])]),
    ];
    const participants = await Participant.find({ walletAddress: { $in: wallets } })
      .select("walletAddress name location")
      .lean();
    const byWallet = Object.fromEntries(participants.map((p) => [p.walletAddress, p]));

    const confirmed = await Transfer.find({ batchId: id, status: "Confirmed" }).sort({ transferId: 1 }).lean();

    result.history = result.history.map((h, i) => {
      const t = confirmed[i] && confirmed[i].from === h.from && confirmed[i].to === h.to ? confirmed[i] : null;
      return {
        step: i + 1,
        ...h,
        fromName: byWallet[h.from]?.name || null,
        toName: byWallet[h.to]?.name || null,
        toLocation: byWallet[h.to]?.location || null,
        txHash: t?.resolveTxHash || null,
      };
    });

    result.batch.description = record?.description || "";
    result.batch.manufacturerLocation = byWallet[result.batch.manufacturer]?.location || null;
    result.registration = {
      txHash: record?.registerTxHash || null,
      blockNumber: record?.registerBlock || null,
      timestamp: result.batch.registeredAt,
    };
    result.daysToExpiry = Math.ceil((new Date(result.batch.expiryDate) - Date.now()) / 86400000);
  }

  if (log) {
    VerificationLog.create({ batchId: id, status: result.status, ip, userAgent }).catch((e) =>
      console.error("[verify] could not log verification:", e.message)
    );
  }
  result.checkedAt = new Date().toISOString();
  return result;
}

module.exports = { verifyBatch };