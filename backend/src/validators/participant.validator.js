const { Joi, walletAddress, objectId, pagination, participantRole } = require("./common");
const { password } = require("./auth.validator");

module.exports = {
  list: {
    query: Joi.object({
      role: participantRole,
      active: Joi.boolean(),
      search: Joi.string().trim().max(100).allow(""),
      ...pagination,
    }),
  },
  directory: {
    query: Joi.object({ role: participantRole }),
  },
  idParam: {
    params: Joi.object({ id: objectId.required() }),
  },
  create: {
    body: Joi.object({
      name: Joi.string().trim().min(2).max(100).required(),
      walletAddress: walletAddress.required(),
      role: participantRole.required(),
      email: Joi.string().trim().lowercase().email().required(),
      password: password.required(),
      location: Joi.string().trim().max(200).allow(""),
      contactPhone: Joi.string().trim().max(30).allow(""),
    }),
  },
  update: {
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({
      name: Joi.string().trim().min(2).max(100),
      role: participantRole,
      email: Joi.string().trim().lowercase().email(),
      location: Joi.string().trim().max(200).allow(""),
      contactPhone: Joi.string().trim().max(30).allow(""),
    }).min(1),
  },
  status: {
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({ active: Joi.boolean().required() }),
  },
};