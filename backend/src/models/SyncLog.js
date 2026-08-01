// src/models/SyncLog.js
const mongoose = require("mongoose");

const syncLogSchema = new mongoose.Schema(
  { userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true }, // ← ADD
    boid: { type: String, index: true },
    status: {
      type: String,
      enum: ["success", "partial", "failed"],
      default: "success",
    },
    steps: [
      {
        name: { type: String },           // e.g. "shares", "portfolio"
        status: { type: String },         // "ok" | "error"
        recordsUpserted: { type: Number, default: 0 },
        error: { type: String },
      },
    ],
    startedAt: { type: Date },
    finishedAt: { type: Date },
    durationMs: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SyncLog", syncLogSchema);