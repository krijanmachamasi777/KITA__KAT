// src/scripts/sync.js
// Run manually: node src/scripts/sync.js
require("dotenv").config();
const { connect, disconnect } = require("../config/database");
const { runFullSync } = require("../services/syncService");
const logger = require("../utils/logger");

(async () => {
  try {
    await connect();
    await runFullSync();
  } catch (err) {
    logger.error("Sync script failed:", err);
    process.exitCode = 1;
  } finally {
    await disconnect();
  }
})();
