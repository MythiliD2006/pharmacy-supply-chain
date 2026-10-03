const ApiError = require("../utils/ApiError");

// Only admin accounts
function requireAdmin(req, _res, next) {
  if (req.user?.role !== "admin") return next(ApiError.forbidden("Admin access only."));
  next();
}

// Only supply-chain users; optionally only certain roles
// e.g. requireParticipant("Manufacturer")  or  requireParticipant()
function requireParticipant(...roles) {
  return (req, _res, next) => {
    const p = req.user?.participant;
    if (req.user?.role !== "participant" || !p) {
      return next(ApiError.forbidden("Only supply-chain participants can do this."));
    }
    if (roles.length && !roles.includes(p.role)) {
      return next(ApiError.forbidden(`Only ${roles.join(" / ")} accounts can do this.`, "WrongRole"));
    }
    next();
  };
}

module.exports = { requireAdmin, requireParticipant };