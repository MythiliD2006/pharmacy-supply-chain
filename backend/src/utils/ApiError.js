class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, code = "BadRequest", details) {
    return new ApiError(400, code, message, details);
  }
  static unauthorized(message = "Please log in.", code = "Unauthorized") {
    return new ApiError(401, code, message);
  }
  static forbidden(message = "You don't have permission to do this.", code = "Forbidden") {
    return new ApiError(403, code, message);
  }
  static notFound(message = "Not found.", code = "NotFound") {
    return new ApiError(404, code, message);
  }
  static conflict(message, code = "Conflict") {
    return new ApiError(409, code, message);
  }
}

module.exports = ApiError;