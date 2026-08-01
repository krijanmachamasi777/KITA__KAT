const mongoose = require("mongoose");

const userFolderSchema = new mongoose.Schema({
  username:  { type: String },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = { userFolderSchema };