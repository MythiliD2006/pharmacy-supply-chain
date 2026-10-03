require("dotenv").config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`\n❌ Missing ${name} in backend/.env (see .env.example)\n`);
    process.exit(1);
  }
  return value;
}

const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",

  // comma-separated list allowed for CORS; the first one is used for QR links
  frontendUrls: (process.env.FRONTEND_URL || "http://localhost:3000")
    .split(",")
    .map((u) => u.trim().replace(/\/$/, ""))
    .filter(Boolean),

  mongoUri: required("MONGO_URI"),

  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",

  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
  demoPassword: process.env.DEMO_PASSWORD || "Demo@1234",
};

env.frontendUrl = env.frontendUrls[0];

if (env.isProduction && env.jwtSecret.length < 32) {
  console.error("\n❌ JWT_SECRET must be at least 32 characters in production\n");
  process.exit(1);
}

module.exports = env;