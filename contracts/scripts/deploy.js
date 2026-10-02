const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();

  console.log(`Deploying to ${network.name} from ${deployer.address}`);

  const AccessControl = await ethers.getContractFactory("AccessControlManager");
  const accessControl = await AccessControl.deploy();
  await accessControl.waitForDeployment();
  const accessControlAddress = await accessControl.getAddress();
  console.log("AccessControlManager:", accessControlAddress);

  const Registry = await ethers.getContractFactory("BatchRegistry");
  const registry = await Registry.deploy(accessControlAddress);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("BatchRegistry:", registryAddress);

  const Transfer = await ethers.getContractFactory("SupplyChainTransfer");
  const transfer = await Transfer.deploy(accessControlAddress, registryAddress);
  await transfer.waitForDeployment();
  const transferAddress = await transfer.getAddress();
  console.log("SupplyChainTransfer:", transferAddress);

  const tx = await registry.setTransferContract(transferAddress);
  await tx.wait();
  console.log("Linked registry -> transfer contract");

  const deployment = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      AccessControlManager: accessControlAddress,
      BatchRegistry: registryAddress,
      SupplyChainTransfer: transferAddress,
    },
  };

  const deployDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deployDir, { recursive: true });
  fs.writeFileSync(path.join(deployDir, `${network.name}.json`), JSON.stringify(deployment, null, 2));

  // copy ABIs to the backend if it's sitting next to this folder
  const backendAbiDir = path.join(__dirname, "..", "..", "backend", "src", "abi");
  if (fs.existsSync(path.join(__dirname, "..", "..", "backend"))) {
    fs.mkdirSync(backendAbiDir, { recursive: true });
    for (const name of Object.keys(deployment.contracts)) {
      const artifact = await hre.artifacts.readArtifact(name);
      fs.writeFileSync(path.join(backendAbiDir, `${name}.json`), JSON.stringify(artifact.abi, null, 2));
    }
    console.log("ABIs copied to backend/src/abi");
  }

  console.log(`Saved deployments/${network.name}.json`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});