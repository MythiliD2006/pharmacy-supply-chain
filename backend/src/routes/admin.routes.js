const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/role");
const c = require("../controllers/admin.controller");

router.use(authenticate, requireAdmin);

router.get("/stats", c.stats);
router.get("/batches", c.batches);
router.get("/transfers", c.transfers);
router.get("/transactions", c.transactions);
router.get("/verifications", c.verifications);
router.get("/sync", c.sync);

module.exports = router;