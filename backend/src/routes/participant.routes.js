const router = require("express").Router();
const validate = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/role");
const v = require("../validators/participant.validator");
const c = require("../controllers/participant.controller");

router.use(authenticate);

// any logged-in user (list of possible transfer receivers)
router.get("/directory", validate(v.directory), c.directory);

// admin only
router.get("/", requireAdmin, validate(v.list), c.list);
router.post("/", requireAdmin, validate(v.create), c.create);
router.get("/:id", requireAdmin, validate(v.idParam), c.getOne);
router.put("/:id", requireAdmin, validate(v.update), c.update);
router.patch("/:id/status", requireAdmin, validate(v.status), c.setStatus);
router.post("/:id/sync", requireAdmin, validate(v.idParam), c.sync);

module.exports = router;