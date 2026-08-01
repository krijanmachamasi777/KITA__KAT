const mongoose = require("mongoose");

const watchlistEntrySchema = new mongoose.Schema({
  scrip:      { type: String, required: true, index: true },
  sector:     { type: String, default: "" },
  breakout:   { type: Number, default: 0 },
  support:    { type: Number, default: 0 },
  resistance: { type: Number, default: 0 },
  notes:      { type: String, default: "" },
}, { timestamps: true });

module.exports = { watchlistEntrySchema };