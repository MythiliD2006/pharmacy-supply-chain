const router = require("express").Router();
const validate = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { requireParticipant } = require("../middleware/role");
const v = require("../validators/batch.validator");
const c = require("../controllers/batch.controller");

router.use(authenticate);

router.post("/prepare", requireParticipant("Manufacturer"), validate(v.prepare), c.prepare);
router.get("/", validate(v.list), c.list);
router.get("/:batchId/qr", validate(v.qr), c.getQr);
router.get("/:batchId", validate(v.batchIdParam), c.getOne);

module.exports = router;