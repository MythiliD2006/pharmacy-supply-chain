const router = require("express").Router();
const validate = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { requireParticipant } = require("../middleware/role");
const v = require("../validators/transfer.validator");
const c = require("../controllers/transfer.controller");

router.use(authenticate);

router.get("/", validate(v.list), c.list);
// pharmacies are the end of the chain, so they can't start transfers
router.post(
  "/prepare",
  requireParticipant("Manufacturer", "Distributor", "Wholesaler"),
  validate(v.prepareRequest),
  c.prepareRequest
);
router.post("/:transferId/:action/prepare", requireParticipant(), validate(v.prepareAction), c.prepareAction);
router.get("/:transferId", c.getOne);

module.exports = router;