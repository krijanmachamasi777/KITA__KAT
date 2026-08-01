// src/models/Wacc.js
const mongoose = require("mongoose");

const waccSchema = new mongoose.Schema(
  { userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true }, // ← ADD
    boid: { type: String, required: true, index: true },
    scrip: { type: String, required: true, index: true },
    isin: { type: String },
    transactionQuantity: { type: Number },
    rate: { type: Number },
    purchaseSource: { type: String },
    transactionDate: { type: Date },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One WACC entry per scrip+boid+date+source combination
waccSchema.index(
  {  userId: 1, boid: 1, scrip: 1, transactionDate: 1, purchaseSource: 1 },
  { unique: true }
);

module.exports = mongoose.model("Wacc", waccSchema);
