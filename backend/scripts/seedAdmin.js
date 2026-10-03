/**
 * Creates the first admin login from ADMIN_EMAIL / ADMIN_PASSWORD in .env
 *   npm run seed:admin
 * Safe to run again: it won't create duplicates (and won't change an existing password).
 */
const env = require("../src/config/env");
const { connectDB, disconnectDB } = require("../src/config/db");
const User = require("../src/models/User");

async function main() {
  if (!env.adminEmail || !env.adminPassword) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env first.");
  }
  await connectDB();

  const email = env.adminEmail.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
  } else {
    await User.create({ name: "System Admin", email, password: env.adminPassword, role: "admin" });
    console.log(`✅ Admin created: ${email}`);
  }
}

main()
  .catch((err) => {
    console.error("❌", err.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());