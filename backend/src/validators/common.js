const Joi = require("joi");
const { ethers } = require("ethers");

// wallet address -> checksummed
const walletAddress = Joi.string()
  .trim()
  .custom((value, helpers) => {
    if (!ethers.isAddress(value)) return helpers.error("any.invalid");
    return ethers.getAddress(value);
  })
  .messages({ "any.invalid": "{{#label}} must be a valid wallet address" });

const txHash = Joi.string()
  .trim()
  .pattern(/^0x[0-9a-fA-F]{64}$/)
  .messages({ "string.pattern.base": "{{#label}} must be a transaction hash (0x + 64 hex characters)" });

// letters, numbers, dash, underscore, slash, dot – what usually appears on medicine packs
const batchId = Joi.string()
  .trim()
  .min(3)
  .max(64)
  .pattern(/^[A-Za-z0-9._\-/]+$/)
  .messages({ "string.pattern.base": "Batch ID can only contain letters, numbers, - _ . /" });

const objectId = Joi.string().hex().length(24).messages({ "string.length": "{{#label}} is not a valid id" });

const pagination = {
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
};

const participantRole = Joi.string().valid("Manufacturer", "Distributor", "Wholesaler", "Pharmacy");

module.exports = { Joi, walletAddress, txHash, batchId, objectId, pagination, participantRole };