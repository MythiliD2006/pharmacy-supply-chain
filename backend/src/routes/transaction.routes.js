const router = require("express").Router();
const validate = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const v = require("../validators/transfer.validator");
const c = require("../controllers/transaction.controller");

router.post("/", authenticate, validate(v.submitTx), c.submit);

module.exports = router;