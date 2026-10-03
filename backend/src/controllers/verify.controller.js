const asyncHandler = require("../utils/asyncHandler");
const { verifyBatch } = require("../services/verification.service");

// GET /api/verify/:batchId   (public – no login)
const verify = asyncHandler(async (req, res) => {
  const result = await verifyBatch(req.params.batchId, {
    ip: req.ip,
    userAgent: req.get("user-agent") || null,
  });
  res.json({ success: true, data: result });
});

module.exports = { verify };