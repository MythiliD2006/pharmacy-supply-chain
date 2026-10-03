/**
 * LOCAL ONLY: creates logins for the 4 Hardhat demo participants so you can
 * test every role in the frontend.
 *   npm run seed:demo
 *
 * Also (re)registers them on-chain if needed, so it works even after restarting
 * the Hardhat node. Password for all of them: DEMO_PASSWORD in .env (default Demo@1234)
 */
const env = require("../src/config/env");
const { connectDB, disconnectDB } = require("../src/config/db");
const bc = require("../src/services/blockchain.service");
const { ensureOnChain } = require("../src/services/participant.service");
const Participant = require("../src/models/Participant");
const User = require("../src/models/User");

// Hardhat default accounts #1-#4 (import the same keys into MetaMask)
const DEMO = [
  { email: "manufacturer@demo.com", name: "Sun Pharma Labs", role: "Manufacturer", walletAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", location: "Hyderabad" },
  { email: "distributor@demo.com", name: "MedLink Distributors", role: "Distributor", walletAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", location: "Chennai" },
  { email: "wholesaler@demo.com", name: "Kovai Wholesale Meds", role: "Wholesaler", walletAddress: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", location: "Coimbatore" },
  { email: "pharmacy@demo.com", name: "CityCare Pharmacy", role: "Pharmacy", walletAddress: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", location: "Coimbatore" },
];

async function main() {
  const { chainId } = await bc.getNetworkInfo();
  if (chainId !== 31337) throw new Error("seed:demo is for the local Hardhat chain only. On Sepolia, add participants from the admin portal.");

  await connectDB();

  for (const d of DEMO) {
    const txs = await ensureOnChain({ ...d, active: true }, null);

    const participant = await Participant.findOneAndUpdate(
      { walletAddress: d.walletAddress },
      { $set: { name: d.name, role: d.role, location: d.location, active: true, "onChain.registered": true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    let user = await User.findOne({ email: d.email });
    if (!user) {
      user = await User.create({ name: d.name, email: d.email, password: env.demoPassword, role: "participant", participant: participant._id });
    } else if (String(user.participant) !== String(participant._id)) {
      user.participant = participant._id;
      await user.save();
    }
    if (String(participant.user) !== String(user._id)) {
      participant.user = user._id;
      await participant.save();
    }

    console.log(`✅ ${d.role.padEnd(12)} ${d.email.padEnd(24)} ${d.walletAddress}${txs.length ? "  (registered on-chain)" : ""}`);
  }
  console.log(`\nPassword for all demo accounts: ${env.demoPassword}`);
}

main()
  .catch((err) => {
    console.error("❌", err.code ? `${err.code}: ${err.message}` : err.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());