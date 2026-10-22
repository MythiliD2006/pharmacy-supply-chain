const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/role");
const validate = require("../middleware/validate");
const c = require("../controllers/admin.controller");
const v = require("../validators/admin.validator");

router.use(authenticate, requireAdmin);

router.get("/stats", c.stats);
router.get("/batches", c.batches);
router.get("/transfers", c.transfers);
router.get("/transactions", c.transactions);
router.get("/verifications/suspicious", c.suspiciousScans);
router.get("/verifications", c.verifications);
router.get("/sync", c.sync);
router.post("/admins", validate(v.createAdmin), c.createAdmin);

module.exports = router;