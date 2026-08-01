const mongoose = require("mongoose");

const waccSchema = new mongoose.Schema({
  boid:                { type: String, required: true, index: true },
  scrip:               { type: String, required: true, index: true },
  isin:                { type: String },
  transactionQuantity: { type: Number },
  rate:                { type: Number },
  purchaseSource:      { type: String },
  transactionDate:     { type: Date },
  lastSyncedAt:        { type: Date, default: Date.now },
}, { timestamps: true });

waccSchema.index(
  { boid: 1, scrip: 1, transactionDate: 1, purchaseSource: 1 },
  { unique: true }
);

module.exports = { waccSchema };