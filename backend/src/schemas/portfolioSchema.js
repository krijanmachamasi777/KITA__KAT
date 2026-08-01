const mongoose = require("mongoose");

const portfolioItemSchema = new mongoose.Schema({
  boid:                  { type: String, required: true, index: true },
  script:                { type: String, required: true },
  scriptDesc:            { type: String },
  currentBalance:        { type: Number, default: 0 },
  lastTransactionPrice:  { type: Number, default: 0 },
  previousClosingPrice:  { type: Number, default: 0 },
  valueOfLastTransPrice: { type: Number, default: 0 },
  lastSyncedAt:          { type: Date, default: Date.now },
}, { timestamps: true });

portfolioItemSchema.index({ boid: 1, script: 1 }, { unique: true });

const portfolioSummarySchema = new mongoose.Schema({
  boid:                       { type: String, required: true, unique: true, index: true },
  totalCostPrice:             { type: Number, default: 0 },
  totalValueOfLastTransPrice: { type: Number, default: 0 },
  lastSyncedAt:               { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = { portfolioItemSchema, portfolioSummarySchema };