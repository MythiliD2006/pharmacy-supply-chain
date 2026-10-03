const ApiError = require("../utils/ApiError");

/**
 * validate({ body: schema, params: schema, query: schema })
 * Replaces req.body/params/query with the cleaned values.
 */
function validate(schemas) {
  return (req, _res, next) => {
    for (const part of ["params", "query", "body"]) {
      if (!schemas[part]) continue;
      const { value, error } = schemas[part].validate(req[part] || {}, {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });
      if (error) {
        const details = error.details.map((d) => ({ field: d.path.join("."), message: d.message.replace(/"/g, "") }));
        return next(ApiError.badRequest(details[0].message, "ValidationError", details));
      }
      // req.query is a getter in some setups, so copy instead of reassigning
      if (part === "query") {
        Object.keys(req.query).forEach((k) => delete req.query[k]);
        Object.assign(req.query, value);
      } else {
        req[part] = value;
      }
    }
    next();
  };
}

module.exports = validate;