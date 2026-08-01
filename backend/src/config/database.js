// src/config/database.js
const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connect = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGO_URI is not defined in environment variables.");
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info(`✅ MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    logger.error("❌ MongoDB connection failed:", err);
    throw err;
  }
};

// Graceful disconnect on app shutdown
const disconnect = async () => {
  await mongoose.disconnect();
  logger.info("🔌 MongoDB disconnected.");
};

mongoose.connection.on("disconnected", () =>
  logger.warn("⚠️  MongoDB disconnected. Attempting reconnect...")
);

mongoose.connection.on("reconnected", () =>
  logger.info("🔄 MongoDB reconnected.")
);

module.exports = { connect, disconnect };