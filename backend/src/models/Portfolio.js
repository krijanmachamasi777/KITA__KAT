// src/models/Portfolio.js
const mongoose = require("mongoose");

const portfolioItemSchema = new mongoose.Schema(
  {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true }, // ← ADD
    boid: { type: String, required: true, index: true },
    script: { type: String, required: true },
    scriptDesc: { type: String },
    currentBalance: { type: Number, default: 0 },
    lastTransactionPrice: { type: Number, default: 0 },
    previousClosingPrice: { type: Number, default: 0 },
    valueOfLastTransPrice: { type: Number, default: 0 },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

portfolioItemSchema.index({userId: 1, boid: 1, script: 1 }, { unique: true });

const portfolioSummarySchema = new mongoose.Schema(
  {
     userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true }, // ← ADD
    boid: { type: String, required: true, unique: true, index: true },
    totalCostPrice: { type: Number, default: 0 },
    totalValueOfLastTransPrice: { type: Number, default: 0 },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
portfolioSummarySchema.index({ userId: 1, boid: 1 }, { unique: true }); 
module.exports = {
  PortfolioItem: mongoose.model("PortfolioItem", portfolioItemSchema),
  PortfolioSummary: mongoose.model("PortfolioSummary", portfolioSummarySchema),
};
