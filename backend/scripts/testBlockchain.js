
const { ethers } = require("ethers");
const { provider } = require("../src/config/blockchain");
const bc = require("../src/services/blockchain.service");
const { createEventListener } = require("../src/services/eventListener.service");

// Hardhat default accounts #1-#4 (same as seedRoles.js)
const KEYS = {
  manufacturer: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  distributor: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  wholesaler: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  pharmacy: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
};
const w = Object.fromEntries(Object.entries(KEYS).map(([k, v]) => [k, new ethers.Wallet(v, provider)]));

// what the frontend does: validate via backend -> sign & send in MetaMask -> post tx hash back
async function signAndSend(wallet, validation) {
  const tx = await wallet.sendTransaction({ to: validation.tx.to, data: validation.tx.data });
  return bc.getTransactionDetails(tx.hash);
}

function step(msg) {
  console.log(`\n▶ ${msg}`);
}

async function expectError(promise, code) {
  try {
    await promise;
    throw new Error(`expected ${code} but call succeeded`);
  } catch (err) {
    if (err.code !== code) throw err;
    console.log(`  ✔ rejected: ${err.code} – ${err.message}`);
  }
}

async function main() {
  const network = await bc.getNetworkInfo();
  if (network.chainId !== 31337) throw new Error("This script only runs on the local Hardhat node (chainId 31337).");
  console.log("Connected:", network);

  step("Participants");
  console.table((await bc.getAllParticipants()).map(({ name, role, active }) => ({ name, role, active })));

  step("Admin manages a participant (signed by the backend)");
  const extra = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"; // Hardhat account #5
  if (!(await bc.getParticipant(extra)).registered) {
    const added = await bc.addParticipant(extra, "Test Distributor", "Distributor");
    console.log(`  ✔ added (tx ${added.txHash})`);
  }
  await bc.setParticipantStatus(extra, false);
  console.log(`  ✔ disabled → hasActiveRole: ${await bc.hasActiveRole(extra, "Distributor")}`);
  await bc.setParticipantStatus(extra, true);
  console.log(`  ✔ enabled  → hasActiveRole: ${await bc.hasActiveRole(extra, "Distributor")}`);
  await expectError(bc.addParticipant(extra, "Dup", "Distributor"), "AlreadyRegistered");

  const batchId = `PCM-${Date.now()}`;
  const now = Math.floor(Date.now() / 1000);
  const data = {
    batchId,
    medicineName: "Paracetamol 500mg",
    manufacturingDate: now - 7 * 86400,
    expiryDate: now + 365 * 86400,
    quantity: 5000,
  };

  step("Validation catches bad requests before anything is signed");
  await expectError(bc.validateRegisterBatch(w.distributor.address, data), "NotManufacturer");
  await expectError(bc.validateRegisterBatch(w.manufacturer.address, { ...data, expiryDate: now - 86400 }), "BatchExpired");
  await expectError(
    bc.validateRegisterBatch(w.manufacturer.address, { ...data, manufacturingDate: now + 86400 * 30 }),
    "InvalidBatchData"
  );

  step(`Manufacturer registers ${batchId}`);
  const reg = await bc.validateRegisterBatch(w.manufacturer.address, data);
  const regTx = await signAndSend(w.manufacturer, reg);
  console.log(`  tx ${regTx.txHash} (${regTx.method}) → ${regTx.events.map((e) => e.name).join(", ")}`);

  await expectError(bc.validateRegisterBatch(w.manufacturer.address, data), "BatchAlreadyExists");
  await expectError(bc.validateRequestTransfer(w.distributor.address, batchId, w.wholesaler.address), "NotCurrentHolder");

  step("Manufacturer → Distributor → Wholesaler → Pharmacy");
  const hops = [
    [w.manufacturer, w.distributor],
    [w.distributor, w.wholesaler],
    [w.wholesaler, w.pharmacy],
  ];
  for (const [from, to] of hops) {
    const req = await signAndSend(from, await bc.validateRequestTransfer(from.address, batchId, to.address));
    const transferId = req.events.find((e) => e.name === "TransferRequested").args.transferId;

    const pending = await bc.getIncomingTransfers(to.address, { pendingOnly: true });
    if (!pending.some((t) => t.transferId === transferId)) throw new Error("pending transfer not visible to receiver");

    await signAndSend(to, await bc.validateConfirmTransfer(to.address, transferId));
    console.log(`  ✔ transfer #${transferId} confirmed`);
  }

  await expectError(bc.validateRequestTransfer(w.pharmacy.address, batchId, w.distributor.address), "InvalidReceiverRole");

  step("Customer verification");
  const v = await bc.verifyBatch(batchId, bc.computeBatchHash(data));
  console.log(`  status: ${v.status} – ${v.message}`);
  console.log(`  holder: ${v.currentHolder.name} (${v.currentHolder.role}), dataHashValid: ${v.dataHashValid}`);
  console.table(v.history.map(({ fromRole, toRole, timestamp }) => ({ fromRole, toRole, timestamp })));
  if (v.status !== "VERIFIED") throw new Error("expected VERIFIED");

  const tampered = await bc.verifyBatch(batchId, bc.computeBatchHash({ ...data, quantity: 9999 }));
  console.log(`  tampered DB record → ${tampered.status}`);
  const fake = await bc.verifyBatch("FAKE-000");
  console.log(`  unknown batch      → ${fake.status}`);

  step("Event listener catches up from block 0");
  const seen = {};
  const listener = createEventListener({
    startBlock: 0,
    logger: { log() {}, warn: console.warn, error: console.error },
    onEvent: (e) => (seen[e.event] = (seen[e.event] || 0) + 1),
  });
  const count = await listener.syncOnce();
  console.log(`  ${count} events up to block ${listener.lastBlock}`);
  console.table(seen);

  step("Dashboard stats");
  console.table(await bc.getStats());

  console.log("\n✅ Backend blockchain layer works.");
}

main().catch((err) => {
  console.error("\n❌", err.code ? `${err.code}: ${err.message}` : err);
  process.exitCode = 1;
});