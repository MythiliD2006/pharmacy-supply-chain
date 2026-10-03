const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
const env = require("./config/env");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const bc = require("./services/blockchain.service");

const app = express();

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || env.frontendUrls.includes(origin.replace(/\/$/, ""))),
    credentials: true,
  })
);
app.use(express.json({ limit: "100kb" }));
if (!env.isProduction) app.use(morgan("dev"));

// health check: is the API, database and blockchain reachable?
app.get("/api/health", async (_req, res) => {
  const db = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  let chain = null;
  try {
    const info = await bc.getNetworkInfo();
    chain = { status: "connected", chainId: info.chainId, blockNumber: info.blockNumber };
  } catch (err) {
    chain = { status: "unreachable", error: err.message };
  }
  const ok = db === "connected" && chain.status === "connected";
  res.status(ok ? 200 : 503).json({ success: ok, data: { api: "ok", database: db, blockchain: chain } });
});

app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/participants", require("./routes/participant.routes"));
app.use("/api/batches", require("./routes/batch.routes"));
app.use("/api/transfers", require("./routes/transfer.routes"));
app.use("/api/transactions", require("./routes/transaction.routes"));
app.use("/api/verify", require("./routes/verify.routes"));
app.use("/api/admin", require("./routes/admin.routes"));

app.use(notFound);
app.use(errorHandler);

module.exports = app;