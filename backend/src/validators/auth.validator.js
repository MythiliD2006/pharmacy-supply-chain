const { Joi } = require("./common");

const password = Joi.string()
  .min(8)
  .max(100)
  .pattern(/[A-Za-z]/)
  .pattern(/[0-9]/)
  .messages({ "string.pattern.base": "Password must contain letters and numbers" });

module.exports = {
  login: {
    body: Joi.object({
      email: Joi.string().trim().lowercase().email().required(),
      password: Joi.string().required(),
    }),
  },
  changePassword: {
    body: Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: password.required().invalid(Joi.ref("currentPassword")).messages({
        "any.invalid": "New password must be different from the current one",
      }),
    }),
  },
  password,
};