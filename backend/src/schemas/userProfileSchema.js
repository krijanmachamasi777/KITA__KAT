const mongoose = require("mongoose");

const userProfileSchema = new mongoose.Schema({
  username:        { type: String, required: true, unique: true, index: true },
  name:            { type: String },
  boid:            { type: String, index: true },
  clientCode:      { type: String },
  email:           { type: String },
  mobileNumber:    { type: String },
  dematExpiryDate: { type: String },
  dpName:          { type: String },
  gender:          { type: String },
  address:         { type: String },
  lastSyncedAt:    { type: Date },
}, { timestamps: true });

module.exports = { userProfileSchema };