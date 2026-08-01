// src/utils/userFolderService.js
const UserFolder = require("../models/UserFolder");

/**
 * Creates a UserFolder document in MongoDB for a user if it doesn't exist.
 * This is the DB equivalent of creating per-user folders on disk.
 */
async function ensureUserFolders(userId) {
  const existing = await UserFolder.findOne({ userId });
  if (!existing) {
    await UserFolder.create({ userId });
  }
}

module.exports = { ensureUserFolders };