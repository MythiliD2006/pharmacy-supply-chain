const env = require("./config/env");
const { connectDB, disconnectDB } = require("./config/db");
const app = require("./app");
const bc = require("./services/blockchain.service");
const { createSyncedListener } = require("./services/sync.service");

async function start() {
  await connectDB();

  // the API still starts if the chain is down; the health check will show it
  let listener = null;
  try {
    const info = await bc.getNetworkInfo();
    console.log(`[chain] connected – chainId ${info.chainId}, block ${info.blockNumber}`);
    listener = await createSyncedListener();
    listener.start();
  } catch (err) {
    console.error(`[chain] not reachable (${err.message}). Is the Hardhat node running? Event sync is off.`);
  }

  const server = app.listen(env.port, () => {
    console.log(`[api] running on http://localhost:${env.port}  (health: /api/health)`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[api] ${signal} received, shutting down`);
    listener?.stop();
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();