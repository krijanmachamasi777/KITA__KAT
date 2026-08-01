// src/index.js — App entry point
require("dotenv").config();

const cron = require("node-cron");
const app = require("./app");
const { connect, disconnect } = require("./config/database");
const { runFullSync } = require("./services/syncService");
const { validateEncryptionKey } = require("./utils/encryption");
const logger = require("./utils/logger");

const PORT = process.env.PORT || 5000;
const SYNC_CRON = process.env.SYNC_CRON || "0 6 * * *";

async function listenOnPort(port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
    server.on("error", reject);
  });
}

// ── FIX [HIGH — SEC-4]: Validate JWT_SECRET at startup ───────────────────
//
// BUG (original): JWT_SECRET was never validated. If the env var was missing
// or too short, the server would start without error. The first call to
// jwt.sign() would throw a cryptic "secretOrPrivateKey must have a value"
// error at runtime — after the user has already submitted their credentials —
// with no clear diagnostic in the startup logs.
//
// Additionally, a short or predictable secret makes the JWT trivially
// brute-forceable. HS256 tokens signed with a short key (< 32 bytes) provide
// effectively no security.
//
// FIX: Validate presence and minimum length before the server starts, the same
// way validateEncryptionKey() validates the AES key.
//
function validateJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "JWT_SECRET is not set. Generate a strong random secret with: " +
      `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))" ` +
      "and add it to your .env file."
    );
  }

  // HS256 requires at least 256 bits (32 bytes) of entropy.
  // Enforce 32 chars as an absolute floor; 48+ recommended.
  if (secret.length < 32) {
    throw new Error(
      `JWT_SECRET is too short (${secret.length} chars). ` +
      "Use at least 32 random characters (48+ recommended). " +
      `Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
  }
}

async function start() {
  // 0a. Validate the MeroShare token encryption key — fail loudly at boot
  //     rather than crashing on the first login attempt.
  try {
    validateEncryptionKey();
  } catch (err) {
    logger.error(`❌ ${err.message}`);
    process.exit(1);
  }

  // 0b. Validate JWT_SECRET — same philosophy as above.
  //     A missing or weak JWT secret is a critical security misconfiguration.
  try {
    validateJwtSecret();
  } catch (err) {
    logger.error(`❌ ${err.message}`);
    process.exit(1);
  }

  // 1. Connect to MongoDB — server will NOT start if DB is unavailable
  //    (for a financial app, we want to fail loudly, not silently)
  try {
    await connect();
  } catch (err) {
    logger.error("❌ Cannot start server without a database connection. Fix MONGO_URI in your .env file.");
    process.exit(1); // Stop the app completely — do not run without DB
  }

  // 2. Start Express server
  let currentPort = Number(PORT) || 5000;
  let server;
  const maxPort = currentPort + 10;

  while (!server) {
    try {
      server = await listenOnPort(currentPort);
    } catch (err) {
      if (err.code !== "EADDRINUSE") {
        throw err;
      }
      logger.warn(`⚠️ Port ${currentPort} is already in use. Trying port ${currentPort + 1}...`);
      currentPort += 1;
      if (currentPort > maxPort) {
        logger.error(`❌ All ports from ${PORT} to ${maxPort} are in use. Cannot start server.`);
        process.exit(1);
      }
    }
  }

  logger.info(`🚀 Server running on http://localhost:${currentPort}`);
  logger.info(`📡 API base: http://localhost:${currentPort}/api`);

  // 3. Schedule automatic data sync (default: every day at 6 AM)
  if (cron.validate(SYNC_CRON)) {
    cron.schedule(SYNC_CRON, async () => {
      logger.info(`⏰ Scheduled sync triggered (cron: ${SYNC_CRON})`);
      await runFullSync();
    });
    logger.info(`📅 Sync scheduled: ${SYNC_CRON}`);
  } else {
    logger.warn(`⚠️  Invalid SYNC_CRON expression: "${SYNC_CRON}". Scheduler disabled.`);
  }

  // 4. Graceful shutdown — cleanly closes DB connection on Ctrl+C or server stop
  const shutdown = async (signal) => {
    logger.info(`\n${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await disconnect();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
}

start().catch((err) => {
  logger.error("Fatal startup error:", err);
  process.exit(1);
});