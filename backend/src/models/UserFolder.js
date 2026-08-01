// src/models/UserFolder.js
const mongoose = require("mongoose");

const userFolderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    folders: {
      applicableissues:    { type: mongoose.Schema.Types.ObjectId, ref: "ApplicableIssue" },
      portfolioitems:      { type: mongoose.Schema.Types.ObjectId, ref: "PortfolioItem" },
      portfoliosummaries:  { type: mongoose.Schema.Types.ObjectId, ref: "PortfolioSummary" },
      shares:              { type: mongoose.Schema.Types.ObjectId, ref: "Share" },
      synclogs:            { type: mongoose.Schema.Types.ObjectId, ref: "SyncLog" },
      userprofiles:        { type: mongoose.Schema.Types.ObjectId, ref: "UserProfile" },
      waccs:               { type: mongoose.Schema.Types.ObjectId, ref: "Wacc" },
    },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserFolder", userFolderSchema);