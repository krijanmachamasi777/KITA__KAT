// src/models/UserProfile.js
const mongoose = require("mongoose");

const userProfileSchema = new mongoose.Schema(
  {userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true }, // ← ADD
    username: { type: String, required: true, unique: true, index: true },
    name: { type: String },
    boid: { type: String, index: true },       // demat number
    clientCode: { type: String },
    email: { type: String },
    mobileNumber: { type: String },
    dematExpiryDate: { type: String },
    dpName: { type: String },
    gender: { type: String },
    address: { type: String },
    lastSyncedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserProfile", userProfileSchema);
