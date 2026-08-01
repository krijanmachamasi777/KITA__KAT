// src/utils/userStorage.js
//
// ── DEPRECATION NOTICE ────────────────────────────────────────────────────
//
// This file is DEAD CODE. `ensureUserFolders()` is never imported or called
// anywhere in the current codebase. The actual per-user data storage uses
// MongoDB collections managed by `src/utils/userCollections.js`, not the
// filesystem.
//
// The `userdata/` directory layout this file manages no longer matches the
// application's storage model (V5 moved fully to MongoDB in V3).
//
// FIX [MEDIUM — SEC-8]: Path traversal vulnerability patched below.
//
// BUG (original): `ensureUserFolders(userId)` did:
//   const userRoot = path.join(USER_DATA_ROOT, String(userId));
// with NO validation on `userId`. If a caller passed `"../../etc"` or any
// path with traversal sequences, the resolved path would escape USER_DATA_ROOT.
// Because `path.join()` resolves `..` eagerly, the check must happen AFTER
// resolving the full path, not before.
//
// FIX: Validate that the resolved path starts with USER_DATA_ROOT + sep
// (the trailing separator prevents `userdata-evil` from matching `userdata`).
//
// TODO: Remove this file entirely once confirmed there are no external callers.
//
const fs   = require("fs");
const path = require("path");

const USER_DATA_ROOT = path.resolve(__dirname, "../../userdata");

const USER_FOLDERS = [
  "applicableissues",
  "portfolioitems",
  "portfoliosummaries",
  "shares",
  "userprofiles",
  "waccs",
];

/**
 * @deprecated — Not used. MongoDB collections in userCollections.js are the
 * authoritative per-user storage. Do not call this function.
 *
 * Creates the folder structure for a user under USER_DATA_ROOT.
 * Path traversal guard: resolves the full path and rejects any userId that
 * would escape the root directory.
 */
function ensureUserFolders(userId) {
  // Sanitize: only alphanumeric + underscore + hyphen allowed.
  // MongoDB ObjectId strings (24-char hex) pass this check.
  const safeId = String(userId);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(safeId)) {
    throw new Error(
      `ensureUserFolders: invalid userId "${safeId}". ` +
      "Only alphanumeric characters, underscores, and hyphens are allowed."
    );
  }

  const userRoot = path.resolve(USER_DATA_ROOT, safeId);

  // Secondary guard: confirm the resolved path is still inside USER_DATA_ROOT.
  // This catches any edge-case that the regex above doesn't block.
  if (!userRoot.startsWith(USER_DATA_ROOT + path.sep)) {
    throw new Error(
      `ensureUserFolders: resolved path "${userRoot}" escapes the user data ` +
      `root "${USER_DATA_ROOT}". This is a path traversal attempt.`
    );
  }

  for (const folder of USER_FOLDERS) {
    const fullPath = path.join(userRoot, folder);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  return userRoot;
}

module.exports = { ensureUserFolders };