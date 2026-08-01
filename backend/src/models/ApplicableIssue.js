// src/models/ApplicableIssue.js
const mongoose = require("mongoose");

const applicableIssueSchema = new mongoose.Schema(
  { userId:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true }, // ← ADD
    companyShareId: { type: Number, index: true },
    scrip: { type: String, index: true },
    companyName: { type: String },
    shareTypeName: { type: String },   // e.g. "IPO", "FPO", "RIGHT"
    shareGroupName: { type: String },  // e.g. "Ordinary Shares"
    issueOpenDate: { type: String },
    issueCloseDate: { type: String },
    subGroup: { type: String },
    statusName: { type: String },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
applicableIssueSchema.index({ userId: 1, companyShareId: 1 }, { unique: true }); // ← CHANGE
module.exports = mongoose.model("ApplicableIssue", applicableIssueSchema);
