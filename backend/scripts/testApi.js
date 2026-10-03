/**
 * End-to-end test of the whole API on the LOCAL Hardhat chain.
 *
 * Needs: Hardhat node running + contracts deployed, the API running (npm run dev),
 *        npm run seed:admin and npm run seed:demo done.
 * Then:  npm run test:api
 *
 * It signs transactions with the public Hardhat test keys, exactly like
 * MetaMask would in the browser. Never point this at Sepolia.
 */
require("dotenv").config();
const { ethers } = require("ethers");

const BASE = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "http://127.0.0.1:8545", undefined, { cacheTimeout: -1 });
const wallet = (key) => new ethers.Wallet(key, provider);

const KEYS = {
  manufacturer: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  distributor: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  wholesaler: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  pharmacy: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
};
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "Demo@1234";

let passed = 0;
function ok(cond, msg) {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  passed++;
  console.log(`  ✔ ${msg}`);
}
const step = (m) => console.log(`\n▶ ${m}`);

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = res.headers.get("content-type") || "";
  const json = type.includes("json") ? await res.json() : null;
  return { status: res.status, json, type };
}

async function login(email, password) {
  const r = await api("POST", "/api/auth/login", { body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email} failed: ${JSON.stringify(r.json)}`);
  return r.json.data.token;
}

// prepare -> sign with "MetaMask" -> submit hash
async function signAndSubmit(token, signer, prepared) {
  const tx = await signer.sendTransaction({ to: prepared.tx.to, data: prepared.tx.data });
  const r = await api("POST", "/api/transactions", { token, body: { txHash: tx.hash } });
  if (r.status !== 200) throw new Error(`submit failed: ${JSON.stringify(r.json)}`);
  return r.json.data;
}

async function main() {
  step("Health");
  const health = await api("GET", "/api/health");
  ok(health.status === 200 && health.json.data.database === "connected", "API, database and blockchain are up");
  ok(health.json.data.blockchain.chainId === 31337, "connected to the local Hardhat chain");

  step("Auth");
  const bad = await api("POST", "/api/auth/login", { body: { email: "admin@x.com", password: "nope" } });
  ok(bad.status === 400 || bad.status === 401, "bad login is rejected");
  const admin = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  const t = {};
  for (const role of Object.keys(KEYS)) t[role] = await login(`${role}@demo.com`, DEMO_PASSWORD);
  ok(true, "admin + 4 demo participants logged in");
  const me = await api("GET", "/api/auth/me", { token: t.manufacturer });
  ok(me.json.data.user.participant.role === "Manufacturer", "/me returns the participant and wallet");
  ok((await api("GET", "/api/admin/stats")).status === 401, "admin routes need a token");
  ok((await api("GET", "/api/admin/stats", { token: t.manufacturer })).status === 403, "participants can't open admin routes");

  step("Admin manages participants (signed by backend admin wallet)");
  const extraWallet = "0x976EA74026E726554dB657fA54763abd0C3a0aa9"; // Hardhat #6
  let list = await api("GET", `/api/participants?search=${extraWallet}`, { token: admin });
  let extra = list.json.data.items[0];
  if (!extra || !extra.user) {
    const created = await api("POST", "/api/participants", {
      token: admin,
      body: {
        name: "Test Pharmacy",
        walletAddress: extraWallet.toLowerCase(),
        role: "Pharmacy",
        email: `test-pharmacy-${Date.now()}@demo.com`,
        password: "Test@1234",
        location: "Madurai",
      },
    });
    ok(created.status === 201, `participant created (${created.json.data?.transactions?.length} on-chain tx)`);
    extra = created.json.data.participant;
  } else {
    ok(true, "test participant already exists");
  }
  const dupe = await api("POST", "/api/participants", {
    token: admin,
    body: { name: "Dup", walletAddress: extraWallet, role: "Pharmacy", email: "dup@demo.com", password: "Test@1234" },
  });
  ok(dupe.status === 409, `duplicate wallet rejected (${dupe.json.error.code})`);
  const upd = await api("PUT", `/api/participants/${extra._id}`, { token: admin, body: { name: `Test Pharmacy ${Date.now() % 10000}` } });
  ok(upd.status === 200 && upd.json.data.transactions.length === 1, "rename is written on-chain");
  const off = await api("PATCH", `/api/participants/${extra._id}/status`, { token: admin, body: { active: false } });
  ok(off.status === 200 && off.json.data.participant.active === false, "participant disabled");
  const on = await api("PATCH", `/api/participants/${extra._id}/status`, { token: admin, body: { active: true } });
  ok(on.status === 200 && on.json.data.participant.active === true, "participant re-enabled");
  await api("PUT", `/api/participants/${extra._id}`, { token: admin, body: { name: "Test Pharmacy" } });

  step("Batch registration");
  const batchId = `API-${Date.now()}`;
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const batch = { batchId, medicineName: "Amoxicillin 250mg", description: "Capsules, strip of 10", manufacturingDate: today, expiryDate: nextYear, quantity: 2000 };

  const invalid = await api("POST", "/api/batches/prepare", { token: t.manufacturer, body: { ...batch, expiryDate: "2020-01-01" } });
  ok(invalid.status === 400 && invalid.json.error.code === "ValidationError", `bad dates rejected: "${invalid.json.error.message}"`);
  const wrongRole = await api("POST", "/api/batches/prepare", { token: t.distributor, body: batch });
  ok(wrongRole.status === 403, "only manufacturers can register batches");

  const prep = await api("POST", "/api/batches/prepare", { token: t.manufacturer, body: batch });
  ok(prep.status === 200 && prep.json.data.tx.data.startsWith("0x"), "prepare returns a tx for MetaMask");
  const reg = await signAndSubmit(t.manufacturer, wallet(KEYS.manufacturer), prep.json.data);
  ok(reg.batch.chainStatus === "confirmed" && reg.transaction.method === "registerBatch", `batch registered on-chain (block ${reg.transaction.blockNumber})`);
  ok(reg.batch.description === batch.description, "off-chain description kept");

  const again = await api("POST", "/api/batches/prepare", { token: t.manufacturer, body: batch });
  ok(again.status === 409, "same batch ID can't be registered twice");

  const holding = await api("GET", "/api/batches", { token: t.manufacturer });
  ok(holding.json.data.items.some((b) => b.batchId === batchId), "batch listed for its holder");
  const detail = await api("GET", `/api/batches/${batchId}`, { token: t.manufacturer });
  ok(detail.json.data.qrCode.startsWith("data:image/png"), "batch detail includes QR code");
  const png = await api("GET", `/api/batches/${batchId}/qr`, { token: t.manufacturer });
  ok(png.status === 200 && png.type.includes("image/png"), "QR PNG download works");

  step("Transfers");
  const W = Object.fromEntries(Object.entries(KEYS).map(([k, v]) => [k, wallet(v)]));

  const notHolder = await api("POST", "/api/transfers/prepare", { token: t.distributor, body: { batchId, to: W.wholesaler.address } });
  ok(notHolder.status === 400 && notHolder.json.error.code === "NotCurrentHolder", `"${notHolder.json.error.message}"`);
  const pharmacySend = await api("POST", "/api/transfers/prepare", { token: t.pharmacy, body: { batchId, to: W.distributor.address } });
  ok(pharmacySend.status === 403, "pharmacies can't start transfers");

  // manufacturer -> distributor, distributor rejects
  let p = await api("POST", "/api/transfers/prepare", { token: t.manufacturer, body: { batchId, to: W.distributor.address } });
  let r = await signAndSubmit(t.manufacturer, W.manufacturer, p.json.data);
  let id = r.transfer.transferId;
  ok(r.transfer.status === "Pending", `transfer #${id} requested`);
  const incoming = await api("GET", "/api/transfers?direction=incoming&status=Pending", { token: t.distributor });
  ok(incoming.json.data.items.some((x) => x.transferId === id && x.fromName), "receiver sees it in pending, with names");
  const twice = await api("POST", "/api/transfers/prepare", { token: t.manufacturer, body: { batchId, to: W.distributor.address } });
  ok(twice.status === 400 && twice.json.error.code === "TransferAlreadyPending", "can't request twice while pending");
  const notReceiver = await api("POST", `/api/transfers/${id}/confirm/prepare`, { token: t.wholesaler });
  ok(notReceiver.status === 400 && notReceiver.json.error.code === "NotReceiver", "only the receiver can confirm");

  p = await api("POST", `/api/transfers/${id}/reject/prepare`, { token: t.distributor });
  r = await signAndSubmit(t.distributor, W.distributor, p.json.data);
  ok(r.transfer.status === "Rejected", `transfer #${id} rejected by receiver`);

  // wallet mismatch: manufacturer's token, distributor's transaction
  p = await api("POST", "/api/transfers/prepare", { token: t.manufacturer, body: { batchId, to: W.distributor.address } });
  const sent = await W.manufacturer.sendTransaction({ to: p.json.data.tx.to, data: p.json.data.tx.data });
  const mismatch = await api("POST", "/api/transactions", { token: t.distributor, body: { txHash: sent.hash } });
  ok(mismatch.status === 403 && mismatch.json.error.code === "WalletMismatch", "tx from another wallet is refused");
  r = (await api("POST", "/api/transactions", { token: t.manufacturer, body: { txHash: sent.hash } })).json.data;
  id = r.transfer.transferId;

  const hops = [
    ["distributor", null],
    ["wholesaler", "distributor"],
    ["pharmacy", "wholesaler"],
  ];
  for (const [to, from] of hops) {
    if (from) {
      p = await api("POST", "/api/transfers/prepare", { token: t[from], body: { batchId, to: W[to].address } });
      r = await signAndSubmit(t[from], W[from], p.json.data);
      id = r.transfer.transferId;
    }
    p = await api("POST", `/api/transfers/${id}/confirm/prepare`, { token: t[to] });
    r = await signAndSubmit(t[to], W[to], p.json.data);
    ok(r.transfer.status === "Confirmed" && r.batch.currentHolder === W[to].address, `transfer #${id} confirmed → ${to} holds the batch`);
  }

  step("Customer verification (public)");
  const v = await api("GET", `/api/verify/${batchId}`);
  const d = v.json.data;
  ok(d.status === "VERIFIED" && d.dataHashValid === true, `${batchId}: ${d.status} – ${d.message}`);
  ok(d.history.length === 3 && d.history.every((h) => h.fromName && h.toName && h.txHash), "history has names and tx hashes");
  ok(d.currentHolder.role === "Pharmacy" && d.registration.txHash, "current holder + registration tx shown");
  console.log("    " + d.history.map((h) => `${h.fromName} → ${h.toName}`).join("  |  "));
  const fake = await api("GET", "/api/verify/FAKE-123");
  ok(fake.json.data.status === "UNREGISTERED", "unknown batch → UNREGISTERED");

  step("Admin monitoring");
  const stats = (await api("GET", "/api/admin/stats", { token: admin })).json.data;
  ok(stats.batches.total >= 1 && stats.transfers.byStatus.Confirmed >= 3, `stats: ${stats.batches.total} batches, ${stats.transfers.total} transfers, ${stats.participants.total} participants`);
  ok(stats.verifications.verifiedMedicines >= 1, `verifications: ${stats.verifications.total} total, ${stats.verifications.verifiedMedicines} medicines verified`);
  ok(stats.invalidAttempts.rejectedBeforeSigning >= 3, `invalid attempts logged: ${stats.invalidAttempts.rejectedBeforeSigning}`);
  const rejected = await api("GET", "/api/admin/transactions?status=rejected&limit=5", { token: admin });
  ok(rejected.json.data.items.every((x) => x.errorCode), "rejected attempts list has error codes");
  const rejTransfers = await api("GET", "/api/admin/transfers?status=Rejected", { token: admin });
  ok(rejTransfers.json.data.items.length >= 1, "receiver-rejected transfers visible to admin");

  step("Event listener catches up");
  let sync;
  for (let i = 0; i < 15; i++) {
    sync = (await api("GET", "/api/admin/sync", { token: admin })).json.data;
    if (sync.behindBy === 0) break;
    await new Promise((res) => setTimeout(res, 1000));
  }
  ok(sync.behindBy === 0, `event sync is up to date (block ${sync.lastSyncedBlock})`);

  console.log(`\n✅ All ${passed} checks passed.`);
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}`);
  process.exitCode = 1;
});