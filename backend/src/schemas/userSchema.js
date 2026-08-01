// src/schemas/userSchema.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  clientId:    { type: Number, required: true },
  username:    { type: String, required: true, unique: true, index: true },

  // The MeroShare password is intentionally NOT stored. See models/User.js.

  // Live MeroShare JWT — stored (encrypted) after login, used by portfolio
  // refresh sync. NEVER the password. Cleared on logout.
  meroshareToken: { type: String, default: null },

  boid:        { type: String },
  name:        { type: String },
  email:       { type: String },
  lastLoginAt: { type: Date },
}, { timestamps: true });

module.exports = { userSchema };
