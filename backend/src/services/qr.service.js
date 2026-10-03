const QRCode = require("qrcode");
const env = require("../config/env");

// The QR code opens the public verification page for the batch
function verifyUrl(batchId) {
  return `${env.frontendUrl}/verify/${encodeURIComponent(batchId)}`;
}

const options = { errorCorrectionLevel: "M", margin: 2, width: 320 };

function toDataUrl(batchId) {
  return QRCode.toDataURL(verifyUrl(batchId), options);
}

function toPngBuffer(batchId) {
  return QRCode.toBuffer(verifyUrl(batchId), { ...options, type: "png" });
}

module.exports = { verifyUrl, toDataUrl, toPngBuffer };