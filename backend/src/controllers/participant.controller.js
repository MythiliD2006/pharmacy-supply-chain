const Participant = require("../models/Participant");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { paginate, escapeRegex } = require("../utils/pagination");
const service = require("../services/participant.service");

// GET /api/participants          (admin)
const list = asyncHandler(async (req, res) => {
  const { role, active, search } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (active !== undefined) filter.active = active;
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: rx }, { walletAddress: rx }, { location: rx }];
  }
  const result = await paginate(Participant, filter, req.query, {
    sort: { createdAt: -1 },
    populate: { path: "user", select: "email lastLoginAt active" },
  });
  res.json({ success: true, data: result });
});

// GET /api/participants/directory   (any logged-in user)
// active participants, used for picking the receiver of a transfer
const directory = asyncHandler(async (req, res) => {
  const filter = { active: true, "onChain.registered": true };
  if (req.query.role) filter.role = req.query.role;
  if (req.user.participant) filter.walletAddress = { $ne: req.user.participant.walletAddress };
  const items = await Participant.find(filter).select("name role walletAddress location").sort({ role: 1, name: 1 }).lean();
  res.json({ success: true, data: { items } });
});

// GET /api/participants/:id      (admin)
const getOne = asyncHandler(async (req, res) => {
  const participant = await Participant.findById(req.params.id).populate("user", "email lastLoginAt active").lean();
  if (!participant) throw ApiError.notFound("Participant not found.");
  res.json({ success: true, data: { participant } });
});

// POST /api/participants         (admin)
const create = asyncHandler(async (req, res) => {
  const result = await service.createParticipant(req.body, req.user);
  res.status(201).json({ success: true, data: result });
});

// PUT /api/participants/:id      (admin)
const update = asyncHandler(async (req, res) => {
  const result = await service.updateParticipant(req.params.id, req.body, req.user);
  res.json({ success: true, data: result });
});

// PATCH /api/participants/:id/status   (admin)
const setStatus = asyncHandler(async (req, res) => {
  const result = await service.setParticipantStatus(req.params.id, req.body.active, req.user);
  res.json({ success: true, data: result });
});

// POST /api/participants/:id/sync      (admin) – re-register on chain from MongoDB
const sync = asyncHandler(async (req, res) => {
  const result = await service.syncParticipant(req.params.id, req.user);
  res.json({ success: true, data: result });
});

module.exports = { list, directory, getOne, create, update, setStatus, sync };