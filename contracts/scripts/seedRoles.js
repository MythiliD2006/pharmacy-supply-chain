const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

// Matches the Role enum in IAccessControlManager.sol
const Role = { Manufacturer: 1, Distributor: 2, Wholesaler: 3, Pharmacy: 4 };

async function main() {
  const { ethers, network } = hre;

  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`No deployment found for ${network.name}. Run deploy.js first.`);
  }
  const { contracts } = JSON.parse(fs.readFileSync(file, "utf8"));
  const accessControl = await ethers.getContractAt("AccessControlManager", contracts.AccessControlManager);

  let participants;

  if (network.name === "hardhat" || network.name === "localhost") {
    // use the default hardhat accounts locally
    const [, m, d, w, p] = await ethers.getSigners();
    participants = [
      [m.address, "Sun Pharma Labs", Role.Manufacturer],
      [d.address, "MedLink Distributors", Role.Distributor],
      [w.address, "Kovai Wholesale Meds", Role.Wholesaler],
      [p.address, "CityCare Pharmacy", Role.Pharmacy],
    ];
  } else {
    const env = process.env;
    participants = [
      [env.MANUFACTURER_ADDRESS, "Manufacturer", Role.Manufacturer],
      [env.DISTRIBUTOR_ADDRESS, "Distributor", Role.Distributor],
      [env.WHOLESALER_ADDRESS, "Wholesaler", Role.Wholesaler],
      [env.PHARMACY_ADDRESS, "Pharmacy", Role.Pharmacy],
    ].filter(([addr]) => addr);
  }

  for (const [address, name, role] of participants) {
    const existing = await accessControl.getParticipant(address);
    if (existing.registeredAt > 0n) {
      console.log(`skip ${name} (${address}) - already registered`);
      continue;
    }
    const tx = await accessControl.addParticipant(address, name, role);
    await tx.wait();
    console.log(`added ${name} (${address})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});