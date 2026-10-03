const bc = require("./blockchain.service");
const { logAdminTx } = require("./sync.service");
const ApiError = require("../utils/ApiError");
const Participant = require("../models/Participant");
const User = require("../models/User");

/**
 * Makes the on-chain record match { walletAddress, name, role, active }.
 * Adds the participant if missing, updates name/role if different, fixes status.
 * Returns the admin transactions that were sent.
 */
async function ensureOnChain({ walletAddress, name, role, active = true }, user) {
  const txs = [];
  const chain = await bc.getParticipant(walletAddress);

  if (!chain.registered) {
    const r = await bc.addParticipant(walletAddress, name, role);
    await logAdminTx(r, { action: "addParticipant", user });
    txs.push({ action: "addParticipant", ...r });
  } else if (chain.name !== name || chain.role !== role) {
    const r = await bc.updateParticipant(walletAddress, name, role);
    await logAdminTx(r, { action: "updateParticipant", user });
    txs.push({ action: "updateParticipant", ...r });
  }

  const isActive = chain.registered ? chain.active : true;
  if (isActive !== active) {
    const r = await bc.setParticipantStatus(walletAddress, active);
    await logAdminTx(r, { action: "setParticipantStatus", user });
    txs.push({ action: "setParticipantStatus", ...r });
  }
  return txs;
}

/** Admin creates an organisation + its login, and registers the wallet on-chain */
async function createParticipant(data, adminUser) {
  const { name, walletAddress, role, email, password, location = "", contactPhone = "" } = data;

  const existing = await Participant.findOne({ walletAddress }).lean();
  if (existing?.user) throw ApiError.conflict("This wallet already belongs to a participant.", "WalletTaken");
  if (await User.exists({ email })) throw ApiError.conflict("This email is already used by another account.", "EmailTaken");

  // chain first: if it fails nothing is saved
  const txs = await ensureOnChain({ walletAddress, name, role, active: true }, adminUser);
  const lastTx = txs[txs.length - 1];

  const participant = await Participant.findOneAndUpdate(
    { walletAddress },
    {
      $set: {
        name,
        role,
        active: true,
        location,
        contactPhone,
        "onChain.registered": true,
        ...(lastTx ? { "onChain.txHash": lastTx.txHash, "onChain.blockNumber": lastTx.blockNumber } : {}),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  let user;
  try {
    user = await User.create({ name, email, password, role: "participant", participant: participant._id });
  } catch (err) {
    if (!existing) await Participant.deleteOne({ _id: participant._id });
    throw err;
  }
  participant.user = user._id;
  await participant.save();

  return { participant: participant.toObject(), user: user.toJSON(), transactions: txs };
}

async function updateParticipant(id, data, adminUser) {
  const participant = await Participant.findById(id);
  if (!participant) throw ApiError.notFound("Participant not found.");

  const name = data.name ?? participant.name;
  const role = data.role ?? participant.role;
  let txs = [];
  if (name !== participant.name || role !== participant.role) {
    txs = await ensureOnChain({ walletAddress: participant.walletAddress, name, role, active: participant.active }, adminUser);
  }

  if (data.email && participant.user) {
    const taken = await User.exists({ email: data.email, _id: { $ne: participant.user } });
    if (taken) throw ApiError.conflict("This email is already used by another account.", "EmailTaken");
    await User.updateOne({ _id: participant.user }, { $set: { email: data.email, name } });
  } else if (participant.user) {
    await User.updateOne({ _id: participant.user }, { $set: { name } });
  }

  Object.assign(participant, {
    name,
    role,
    ...(data.location !== undefined ? { location: data.location } : {}),
    ...(data.contactPhone !== undefined ? { contactPhone: data.contactPhone } : {}),
  });
  await participant.save();
  return { participant: participant.toObject(), transactions: txs };
}

async function setParticipantStatus(id, active, adminUser) {
  const participant = await Participant.findById(id);
  if (!participant) throw ApiError.notFound("Participant not found.");

  const txs = await ensureOnChain(
    { walletAddress: participant.walletAddress, name: participant.name, role: participant.role, active },
    adminUser
  );
  participant.active = active;
  participant.onChain.registered = true;
  await participant.save();
  return { participant: participant.toObject(), transactions: txs };
}

/** Re-registers / fixes the on-chain record from MongoDB (e.g. after restarting the local chain) */
async function syncParticipant(id, adminUser) {
  const participant = await Participant.findById(id);
  if (!participant) throw ApiError.notFound("Participant not found.");
  const txs = await ensureOnChain(participant, adminUser);
  participant.onChain.registered = true;
  if (txs.length) {
    participant.onChain.txHash = txs[txs.length - 1].txHash;
    participant.onChain.blockNumber = txs[txs.length - 1].blockNumber;
  }
  await participant.save();
  return { participant: participant.toObject(), transactions: txs };
}

module.exports = { ensureOnChain, createParticipant, updateParticipant, setParticipantStatus, syncParticipant };