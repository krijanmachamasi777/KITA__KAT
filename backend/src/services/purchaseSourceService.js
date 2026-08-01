// src/services/purchaseSourceService.js
//
// Live (non-DB) service for the "Purchase Source" module.
//
// WHY LIVE AND NOT DB-SYNCED:
//   Unlike /wacc, /issues, /portfolio (which read from MongoDB, populated by
//   runFullSync at login), the disclaimer text and pending/completed script
//   lists can change at any time on MeroShare's side and must reflect the
//   live state the moment the user opens the Purchase Source tab. There is
//   no "sync" step for this module — every call here goes straight to
//   MeroShare through the user's existing session.
//
// SESSION HANDLING — reuses the exact pattern from runPortfolioSync():
//   1. Load User.meroshareToken (AES-256-GCM ciphertext at rest — see
//      utils/encryption.js) and decrypt() it.
//   2. Restore a MeroShareClient session from that token (no password ever
//      re-sent).
//   3. If restore fails → throw an Error with `.sessionExpired = true`.
//      The controller turns this into HTTP 401 { sessionExpired: true },
//      which the frontend's apiFetch() already knows how to handle (fires
//      "meroshare:sessionExpired" → AuthContext logs the user out).
//   4. On success, persist the (possibly rotated) token back onto the User
//      doc, re-encrypted, exactly like runPortfolioSync does conceptually.
//
// DEMAT SAFETY:
//   The demat/BOID is never accepted from the client. It only ever comes
//   from `client.boid`, set server-side by client.getOwnDetails() during
//   session restore — see MeroShareClient.searchPurchaseWacc().
//
const User              = require("../models/User");
const logger             = require("../utils/logger");
const { encrypt, decrypt } = require("../utils/encryption");

// ── Build an authenticated client from the stored token ────────────────
// Mirrors syncService._buildClient()'s token-restore branch, but kept
// local to this file so the Purchase Source module has no coupling to the
// sync pipeline (per the "don't change unrelated code" requirement).
//
// NOTE ON DECRYPTION: authController.login() always stores the token via
// encrypt() (AES-256-GCM — see utils/encryption.js). This service calls
// decrypt() before using it, since the value in MongoDB is ciphertext, not
// a usable bearer token. (Separately, existing syncService.runPortfolioSync
// reads the same field without decrypting it first — a pre-existing issue
// in code this task does not touch. It's called out in the deliverables
// notes below so it can be fixed independently.)
async function _restoreClient(userId) {
  const MeroShareClient = require("./meroshareClient");

  const userDoc = await User.findById(userId).select("meroshareToken clientId").lean();

  const plainToken = decrypt(userDoc?.meroshareToken);
  if (!plainToken) {
    const e = new Error("MeroShare session expired. Please login again.");
    e.sessionExpired = true;
    throw e;
  }

  const client = new MeroShareClient({ clientId: userDoc.clientId });
  client.token = plainToken;

  try {
    await client.getOwnDetails(); // also sets client.boid (the demat)
  } catch (err) {
    const e = new Error("MeroShare session expired. Please login again.");
    e.sessionExpired = true;
    throw e;
  }

  return client;
}

// Persists a possibly-rotated token back onto the User doc — best effort,
// matches runPortfolioSync's "don't fail the request over this" behaviour.
// Always re-encrypts before writing, since the field is ciphertext at rest.
async function _persistToken(userId, client) {
  try {
    await User.findByIdAndUpdate(userId, {
      meroshareToken: encrypt(client.token),
    });
  } catch (e) {
    logger.warn("⚠️  Could not persist refreshed meroshareToken:", e.message);
  }
}

// ── Public service methods ──────────────────────────────────────────────

async function fetchDisclaimer(userId) {
  const client = await _restoreClient(userId);
  const data   = await client.getPurchaseDisclaimer();
  await _persistToken(userId, client);
  return data;
}

async function fetchScripts(userId, isFilterByAllScript) {
  const client  = await _restoreClient(userId);
  const scripts = await client.getPurchaseShareList(isFilterByAllScript);
  await _persistToken(userId, client);
  return scripts;
}

async function searchScript(userId, scrip) {
  const client = await _restoreClient(userId);
  const result = await client.searchPurchaseWacc(scrip);
  await _persistToken(userId, client);
  // Surface the demat used, for transparency/debugging — never trust a
  // demat sent by the client, only ever this server-resolved value.
  return { ...result, demat: client.boid };
}

// Confirm WACC → POST /api/myPurchase/upload/
// `records` is the edited array exactly as maintained by the UI (see
// MSPurchaseSource.jsx). MeroShareClient.uploadPurchaseSource() re-stamps
// `demat` on every record from the restored session — any demat present
// in the incoming records is discarded, never trusted.
async function uploadWacc(userId, records) {
  const client = await _restoreClient(userId);
  const result = await client.uploadPurchaseSource(records);
  await _persistToken(userId, client);
  return result;
}

// Automatic refresh after a successful upload → POST /api/myPurchase/view/
async function viewSummary(userId, scrip) {
  const client = await _restoreClient(userId);
  const result = await client.viewWaccSummary(scrip);
  await _persistToken(userId, client);
  return { ...result, demat: client.boid };
}

// My Holdings tab → GET /api/myHoldings/wacc/
// No payload. CDSC may answer with a 500 + JSON body ("No EDIS obligation
// left.") when there's nothing to show yet — getMyHoldingsWacc() already
// normalizes that into a plain returned object instead of throwing, so
// this just passes it through.
async function fetchHoldings(userId) {
  const client = await _restoreClient(userId);
  const data   = await client.getMyHoldingsWacc();
  await _persistToken(userId, client);
  return data;
}

// My WACC tab → POST /api/myPurchase/waccReport/
async function fetchWaccReport(userId) {
  const client = await _restoreClient(userId);
  const data   = await client.getWaccReport();
  await _persistToken(userId, client);
  return { ...data, demat: client.boid };
}

module.exports = {
  fetchDisclaimer,
  fetchScripts,
  searchScript,
  uploadWacc,
  viewSummary,
  fetchHoldings,
  fetchWaccReport,
};
