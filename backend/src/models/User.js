// src/models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    clientId:    { type: Number, required: true },
    username:    { type: String, required: true, unique: true, index: true },

    // NOTE: The MeroShare password is intentionally NOT stored.
    // It is only used transiently during login to authenticate against
    // MeroShare. After login, auth relies on our own JWT and the
    // encrypted `meroshareToken` below, so persisting the password (even
    // hashed) would be needless risk.

    // Stores the live MeroShare JWT captured at login (AES-256-GCM
    // encrypted at rest). Used by runPortfolioSync() on browser refresh.
    // Cleared on logout.
    meroshareToken: { type: String, default: null },

    boid:        { type: String },
    name:        { type: String },
    email:       { type: String },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
