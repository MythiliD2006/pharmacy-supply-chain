const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const validate = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const v = require("../validators/auth.validator");
const c = require("../controllers/auth.controller");

// 20 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "TooManyRequests", message: "Too many login attempts. Try again later." } },
});

router.post("/login", loginLimiter, validate(v.login), c.login);
router.get("/me", authenticate, c.me);
router.post("/change-password", authenticate, validate(v.changePassword), c.changePassword);

module.exports = router;