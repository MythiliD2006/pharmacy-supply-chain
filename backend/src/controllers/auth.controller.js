const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { signToken } = require("../middleware/auth");

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+password").populate("participant");

  // same message for wrong email and wrong password
  if (!user || !(await user.checkPassword(password))) {
    throw ApiError.unauthorized("Incorrect email or password.", "InvalidCredentials");
  }
  if (!user.active) throw ApiError.forbidden("Your account is disabled.", "AccountDisabled");
  if (user.role === "participant" && (!user.participant || !user.participant.active)) {
    throw ApiError.forbidden("Your organisation's access is disabled. Contact the admin.", "ParticipantDisabled");
  }

  user.lastLoginAt = new Date();
  await user.save();

  res.json({ success: true, data: { token: signToken(user), user: formatUser(user) } });
});

// GET /api/auth/me
const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});

// POST /api/auth/change-password
const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("+password");
  if (!(await user.checkPassword(req.body.currentPassword))) {
    throw ApiError.badRequest("Current password is incorrect.", "InvalidCredentials");
  }
  user.password = req.body.newPassword;
  await user.save();
  res.json({ success: true, data: { message: "Password changed." } });
});

function formatUser(user) {
  const p = user.participant;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    participant: p
      ? { id: String(p._id), name: p.name, role: p.role, walletAddress: p.walletAddress, active: p.active }
      : null,
  };
}

module.exports = { login, me, changePassword };