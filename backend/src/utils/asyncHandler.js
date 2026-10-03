// Lets async route handlers throw, and passes the error to errorHandler
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);