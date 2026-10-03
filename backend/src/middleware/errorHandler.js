const env = require("../config/env");

// 404 for unknown routes
function notFound(req, res) {
  res.status(404).json({
    success: false,
    error: { code: "RouteNotFound", message: `No route for ${req.method} ${req.originalUrl}` },
  });
}

// Every error ends up here and is returned as { success: false, error: { code, message, details } }
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let code = err.code || "ServerError";
  let message = err.message || "Something went wrong.";
  let details = err.details;

  // mongoose duplicate key
  if (err.code === 11000) {
    status = 409;
    code = "Duplicate";
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0] || "value";
    message = `A record with this ${field} already exists.`;
  }
  // mongoose validation
  if (err.name === "ValidationError" && err.errors) {
    status = 400;
    code = "ValidationError";
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = details[0]?.message || "Invalid data.";
  }
  if (err.name === "CastError") {
    status = 400;
    code = "InvalidId";
    message = `Invalid ${err.path}.`;
  }
  // bad JSON body
  if (err.type === "entity.parse.failed") {
    status = 400;
    code = "InvalidJSON";
    message = "Request body is not valid JSON.";
  }

  if (typeof code !== "string") code = "ServerError";
  if (status >= 500) console.error(`[error] ${req.method} ${req.originalUrl}:`, err);

  res.status(status).json({
    success: false,
    error: {
      code,
      message: status >= 500 && env.isProduction ? "Something went wrong." : message,
      ...(details ? { details } : {}),
    },
  });
}

module.exports = { notFound, errorHandler };