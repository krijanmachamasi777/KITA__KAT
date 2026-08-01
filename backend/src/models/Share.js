// src/models/Share.js
const mongoose = require("mongoose");

const shareSchema = new mongoose.Schema(
  {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true }, // ← ADD
    boid: { type: String, required: true, index: true },
    script: { type: String, required: true, index: true },
    scriptDesc: { type: String },
    isin: { type: String },
    currentBalance: { type: Number, default: 0 },
    freeBalance: { type: Number, default: 0 },
    freezeBalance: { type: Number, default: 0 },
    pledgeBalance: { type: Number, default: 0 },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Compound unique index: one record per script per boid
shareSchema.index({userId: 1, boid: 1, script: 1 }, { unique: true });

module.exports = mongoose.model("Share", shareSchema);
