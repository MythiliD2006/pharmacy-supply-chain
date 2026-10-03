const { Joi, batchId, pagination } = require("./common");

module.exports = {
  prepare: {
    body: Joi.object({
      batchId: batchId.required(),
      medicineName: Joi.string().trim().min(2).max(120).required(),
      description: Joi.string().trim().max(500).allow(""),
      manufacturingDate: Joi.date().iso().max("now").required().messages({
        "date.max": "Manufacturing date can't be in the future",
      }),
      expiryDate: Joi.date().iso().greater(Joi.ref("manufacturingDate")).greater("now").required().messages({
        "date.greater": "Expiry date must be after the manufacturing date and in the future",
      }),
      quantity: Joi.number().integer().min(1).max(1e12).required(),
    }),
  },
  list: {
    query: Joi.object({
      scope: Joi.string().valid("holding", "manufactured", "all").default("holding"),
      search: Joi.string().trim().max(100).allow(""),
      ...pagination,
    }),
  },
  batchIdParam: {
    params: Joi.object({ batchId: batchId.required() }),
  },
  qr: {
    params: Joi.object({ batchId: batchId.required() }),
    query: Joi.object({ format: Joi.string().valid("png", "dataurl").default("png") }),
  },
};