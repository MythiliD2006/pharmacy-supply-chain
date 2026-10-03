const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const validate = require("../middleware/validate");
const v = require("../validators/batch.validator");
const c = require("../controllers/verify.controller");

// public endpoint: 60 checks per minute per IP
const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "TooManyRequests", message: "Too many requests. Try again in a minute." } },
});

router.get("/:batchId", verifyLimiter, validate(v.batchIdParam), c.verify);

module.exports = router;