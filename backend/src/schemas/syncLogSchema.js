const mongoose = require("mongoose");

const syncLogSchema = new mongoose.Schema({
  boid:       { type: String, index: true },
  status:     { type: String, enum: ["success", "partial", "failed"], default: "success" },
  steps: [{
    name:            { type: String },
    status:          { type: String },
    recordsUpserted: { type: Number, default: 0 },
    error:           { type: String },
  }],
  startedAt:  { type: Date },
  finishedAt: { type: Date },
  durationMs: { type: Number },
}, { timestamps: true });

module.exports = { syncLogSchema };