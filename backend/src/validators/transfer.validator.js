const { Joi, walletAddress, batchId, txHash, pagination } = require("./common");

module.exports = {
  list: {
    query: Joi.object({
      direction: Joi.string().valid("incoming", "outgoing", "all").default("all"),
      status: Joi.string().valid("Pending", "Confirmed", "Rejected", "Cancelled"),
      batchId: batchId,
      ...pagination,
    }),
  },
  prepareRequest: {
    body: Joi.object({
      batchId: batchId.required(),
      to: walletAddress.required().label("receiver"),
    }),
  },
  prepareAction: {
    params: Joi.object({
      transferId: Joi.number().integer().min(0).required(),
      action: Joi.string().valid("confirm", "reject", "cancel").required(),
    }),
  },
  submitTx: {
    body: Joi.object({ txHash: txHash.required() }),
  },
};