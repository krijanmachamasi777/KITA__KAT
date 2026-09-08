// src/services/ipoApplyService.js
//
// Live (non-DB) service for the "Apply for Company Share" (IPO/FPO)
// module — replicates the real MeroShare Apply flow. Mirrors
// purchaseSourceService.js's session-restore pattern exactly (see that
// file for the full rationale) but is kept fully self-contained — it
// does not import from purchaseSourceService.js — so this new module
// can never change that file's behaviour.
//
// SESSION HANDLING — identical contract to purchaseSourceService.js:
//   1. Load User.meroshareToken (AES-256-GCM ciphertext at rest — see
//      utils/encryption.js) and decrypt() it.
//   2. Restore a MeroShareClient session from that token (no password
//      ever re-sent).
//   3. If restore fails → throw an Error with `.sessionExpired = true`.
//      The controller turns this into HTTP 401 { sessionExpired: true },
//      which the frontend's apiFetch() already knows how to handle.
//   4. On success, persist the (possibly rotated) token back onto the
//      User doc, re-encrypted.
//
// DEMAT/BOID SAFETY: never accepted from the client. Only ever comes
// from `client.boid`, set server-side by client.getOwnDetails() during
// session restore — see MeroShareClient.submitIpoApply(), which also
// derives the short 8-digit `boid` field from it.
//
const User                = require("../models/User");
const logger               = require("../utils/logger");
const { encrypt, decrypt } = require("../utils/encryption");

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

async function checkEligibility(userId, companyShareId) {
  const client = await _restoreClient(userId);
  const data   = await client.checkIpoEligibility(companyShareId);
  await _persistToken(userId, client);
  return data;
}

async function fetchIssueDetail(userId, companyShareId) {
  const client = await _restoreClient(userId);
  const data   = await client.getIpoIssueDetail(companyShareId);
  await _persistToken(userId, client);
  return data;
}

async function fetchBanks(userId) {
  const client = await _restoreClient(userId);
  const data   = await client.getIpoBanks();
  await _persistToken(userId, client);
  return data;
}

async function fetchBankAccount(userId, bankId) {
  const client = await _restoreClient(userId);
  const data   = await client.getIpoBankAccount(bankId);
  await _persistToken(userId, client);
  return data;
}

async function fetchDisclaimer(userId) {
  const client = await _restoreClient(userId);
  const data   = await client.getIpoDisclaimer();
  await _persistToken(userId, client);
  return data;
}

// `params` is the whitelisted body produced by validateIpoApplySubmit —
// demat/boid are never read from it; MeroShareClient.submitIpoApply()
// always re-derives them from the restored session.
async function submitApply(userId, params) {
  const client = await _restoreClient(userId);
  const data   = await client.submitIpoApply(params);
  await _persistToken(userId, client);
  return data;
}

module.exports = {
  checkEligibility,
  fetchIssueDetail,
  fetchBanks,
  fetchBankAccount,
  fetchDisclaimer,
  submitApply,
};