const mongoose = require("mongoose");

const applicableIssueSchema = new mongoose.Schema({
  companyShareId: { type: Number },
  scrip:          { type: String },
  companyName:    { type: String },
  shareTypeName:  { type: String },
  shareGroupName: { type: String },
  issueOpenDate:  { type: String },
  issueCloseDate: { type: String },
  subGroup:       { type: String },
  statusName:     { type: String },
  lastSyncedAt:   { type: Date, default: Date.now },
}, { timestamps: true });

applicableIssueSchema.index({ companyShareId: 1 }, { unique: true });

module.exports = { applicableIssueSchema };