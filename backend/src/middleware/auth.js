const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

/**
 * Requires "Authorization: Bearer <token>".
 * Sets req.user = { id, name, email, role, participant: { id, name, role, walletAddress, active } | null }
 */
const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    throw ApiError.unauthorized(
      err.name === "TokenExpiredError" ? "Session expired. Please log in again." : "Invalid token.",
      err.name === "TokenExpiredError" ? "TokenExpired" : "InvalidToken"
    );
  }

  const user = await User.findById(payload.sub).populate("participant").lean();
  if (!user) throw ApiError.unauthorized("Account no longer exists.");
  if (!user.active) throw ApiError.forbidden("Your account is disabled.", "AccountDisabled");
  if (user.role === "participant" && (!user.participant || !user.participant.active)) {
    throw ApiError.forbidden("Your organisation's access is disabled. Contact the admin.", "ParticipantDisabled");
  }

  req.user = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    participant: user.participant
      ? {
          id: String(user.participant._id),
          name: user.participant.name,
          role: user.participant.role,
          walletAddress: user.participant.walletAddress,
          active: user.participant.active,
        }
      : null,
  };
  next();
});

module.exports = { authenticate, signToken };