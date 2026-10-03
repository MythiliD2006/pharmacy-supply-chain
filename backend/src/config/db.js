const mongoose = require("mongoose");
const env = require("./env");

async function connectDB() {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("disconnected", () => console.warn("[db] disconnected"));
  mongoose.connection.on("reconnected", () => console.log("[db] reconnected"));

  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10000 });
    const { host, name } = mongoose.connection;
    console.log(`[db] connected to ${host}/${name}`);
  } catch (err) {
    console.error("\n❌ Could not connect to MongoDB:", err.message);
    if (/auth/i.test(err.message)) console.error("   → check the username/password in MONGO_URI");
    if (/ENOTFOUND|querySrv/i.test(err.message)) console.error("   → check the cluster address in MONGO_URI");
    if (/timed out|Server selection/i.test(err.message)) {
      console.error("   → in Atlas, Network Access must allow your IP (or 0.0.0.0/0 for development)");
    }
    process.exit(1);
  }
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };