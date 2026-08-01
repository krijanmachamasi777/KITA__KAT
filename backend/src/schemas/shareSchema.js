const mongoose = require("mongoose");

const shareSchema = new mongoose.Schema({
  boid:           { type: String, required: true, index: true },
  script:         { type: String, required: true, index: true },
  scriptDesc:     { type: String },
  isin:           { type: String },
  currentBalance: { type: Number, default: 0 },
  freeBalance:    { type: Number, default: 0 },
  freezeBalance:  { type: Number, default: 0 },
  pledgeBalance:  { type: Number, default: 0 },
  lastSyncedAt:   { type: Date, default: Date.now },
}, { timestamps: true });

shareSchema.index({ boid: 1, script: 1 }, { unique: true });

module.exports = { shareSchema };