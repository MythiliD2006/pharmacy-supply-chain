const { ethers } = require("ethers");


function computeBatchHash({ batchId, medicineName, manufacturingDate, expiryDate, quantity }) {
  return ethers.solidityPackedKeccak256(
    ["string", "string", "uint256", "uint256", "uint256"],
    [
      String(batchId).trim(),
      String(medicineName).trim(),
      toUnixSeconds(manufacturingDate),
      toUnixSeconds(expiryDate),
      BigInt(quantity),
    ]
  );
}

/** Accepts a Date, an ISO string ("2026-10-01") or unix seconds and returns unix seconds */
function toUnixSeconds(value) {
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  if (typeof value === "number" || typeof value === "bigint") return Number(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new Error(`Invalid date: ${value}`);
  return Math.floor(ms / 1000);
}

module.exports = { computeBatchHash, toUnixSeconds };