// src/controllers/index.js
//
// Database-first: all endpoints read from MongoDB only.
// External MeroShare API is never called directly from these endpoints —
// data must already be in the DB via sync (runFullSync or runPortfolioSync).
//
// refreshPortfolio():
//   Attempts live LTP update via stored MeroShare token.
//   If token expired → returns 401 { sessionExpired: true }.
//   Frontend must clear session and redirect to login on 401+sessionExpired.
//
const { getModel }         = require("../utils/userCollections");
const { runPortfolioSync } = require("../services/syncService");
const logger               = require("../utils/logger");

const ok  = (res, data, meta = {}) => res.json({ success: true, ...meta, data });
const err = (res, message, status = 500) =>
  res.status(status).json({ success: false, message });

// Escapes regex metacharacters so user-supplied query values can't inject
// a malicious pattern (ReDoS / match-everything). Used for the issues
// `type` filter, which is the only place we build a RegExp from input.
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Uses the unique, immutable username (not the MeroShare display name) so
// per-user MongoDB collections can't collide when two users share a name.
function getUserName(req) {
  return req.user.username;
}

// ── Profile ───────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const UserProfile = await getModel(getUserName(req), "userprofiles");
    const profile = await UserProfile.findOne().sort({ updatedAt: -1 }).lean();
    if (!profile) return err(res, "No profile found. Run a sync first.", 404);
    ok(res, profile);
  } catch (e) {
    logger.error(e);
    err(res, e.message, e.status || 500);
  }
};

// ── Shares ────────────────────────────────────────────────────────────
exports.getShares = async (req, res) => {
  try {
    const Share  = await getModel(getUserName(req), "shares");
    const shares = await Share.find()
      .sort({ script: 1 })
      .select("-__v -createdAt -updatedAt")
      .lean();
    ok(res, shares, { total: shares.length });
  } catch (e) {
    logger.error(e);
    err(res, e.message, e.status || 500);
  }
};

exports.getShareByScript = async (req, res) => {
  try {
    const Share = await getModel(getUserName(req), "shares");
    const share = await Share.findOne({ script: req.params.script.toUpperCase() })
      .select("-__v -createdAt -updatedAt")
      .lean();
    if (!share) return err(res, `Share '${req.params.script.toUpperCase()}' not found.`, 404);
    ok(res, share);
  } catch (e) {
    logger.error(e);
    err(res, e.message, e.status || 500);
  }
};

// ── Portfolio ─────────────────────────────────────────────────────────
exports.getPortfolio = async (req, res) => {
  try {
    const PortfolioSummary = await getModel(getUserName(req), "portfoliosummaries");
    const PortfolioItem    = await getModel(getUserName(req), "portfolioitems");
    const [summary, items] = await Promise.all([
      PortfolioSummary.findOne().select("-__v -createdAt -updatedAt").lean(),
      PortfolioItem.find().sort({ script: 1 }).select("-__v -createdAt -updatedAt").lean(),
    ]);
    ok(res, { summary, items }, { total: items.length });
  } catch (e) {
    logger.error(e);
    err(res, e.message, e.status || 500);
  }
};

// ── Portfolio Refresh (browser refresh — LTP update) ─────────────────
//
// Flow:
//   Browser Refresh
//     → POST /api/portfolio/refresh
//     → runPortfolioSync() uses stored meroshareToken
//     → Updates MongoDB (portfolioitems + portfoliosummaries)
//     → Returns fresh data from MongoDB
//
// Session expiry behavior:
//   If MeroShare token is expired/missing:
//     → Returns HTTP 401 { success: false, sessionExpired: true, message: "..." }
//     → Frontend MUST clear session and redirect to login page immediately.
//
exports.refreshPortfolio = async (req, res) => {
  try {
    const userId   = req.user.id;
    const userName = getUserName(req);

    logger.info(`🔄 Portfolio refresh requested by: ${userName}`);

    try {
      await runPortfolioSync({ userId, name: userName });
      logger.info(`✅ Portfolio live refresh complete for: ${userName}`);
    } catch (syncErr) {
      if (syncErr.sessionExpired) {
        // MeroShare token is expired — user must re-login to get a fresh one.
        // Return 401 with sessionExpired flag so the frontend can handle it.
        logger.warn(`⚠️  MeroShare session expired for ${userName} — forcing re-login.`);
        return res.status(401).json({
          success:        false,
          sessionExpired: true,
          message:        "MeroShare session expired. Please login again.",
        });
      }
      // Unexpected sync error — serve cached data from DB
      logger.warn(`⚠️  Portfolio live refresh failed for ${userName}: ${syncErr.message}`);
    }

    // Return portfolio from MongoDB (freshly updated or cached)
    const PortfolioSummary = await getModel(userName, "portfoliosummaries");
    const PortfolioItem    = await getModel(userName, "portfolioitems");
    const [summary, items] = await Promise.all([
      PortfolioSummary.findOne().select("-__v -createdAt -updatedAt").lean(),
      PortfolioItem.find().sort({ script: 1 }).select("-__v -createdAt -updatedAt").lean(),
    ]);

    logger.info(`📦 Portfolio served for: ${userName} (${items.length} items)`);
    ok(res, { summary, items }, { total: items.length });

  } catch (e) {
    logger.error(e);
    err(res, e.message, e.status || 500);
  }
};

// ── Applicable Issues ─────────────────────────────────────────────────
exports.getApplicableIssues = async (req, res) => {
  try {
    const ApplicableIssue = await getModel(getUserName(req), "applicableissues");
    const { type }  = req.query;
    // Escape + length-cap the user input before building a RegExp to prevent
    // ReDoS and "match everything" injection via crafted patterns.
    const filter    = type
      ? { shareTypeName: new RegExp(escapeRegex(String(type).slice(0, 100)), "i") }
      : {};
    const issues    = await ApplicableIssue.find(filter)
      .sort({ issueOpenDate: -1 })
      .select("-__v -createdAt -updatedAt")
      .lean();
    ok(res, issues, { total: issues.length });
  } catch (e) {
    logger.error(e);
    err(res, e.message, e.status || 500);
  }
};

// ── WACC ──────────────────────────────────────────────────────────────
exports.getWacc = async (req, res) => {
  try {
    const Wacc       = await getModel(getUserName(req), "waccs");
    const { script } = req.query;
    const filter     = script ? { scrip: script.toUpperCase() } : {};
    const records    = await Wacc.find(filter)
      .sort({ transactionDate: -1 })
      .select("-__v -createdAt -updatedAt")
      .lean();
    ok(res, records, { total: records.length });
  } catch (e) {
    logger.error(e);
    err(res, e.message, e.status || 500);
  }
};

// ── Sync Logs ─────────────────────────────────────────────────────────
exports.getSyncLogs = async (req, res) => {
  try {
    const SyncLog = await getModel(getUserName(req), "synclogs");
    const limit   = Math.min(Number(req.query.limit) || 10, 100);
    const logs    = await SyncLog.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("-__v")
      .lean();
    ok(res, logs, { total: logs.length });
  } catch (e) {
    logger.error(e);
    err(res, e.message, e.status || 500);
  }
};

// ── Manual Sync Trigger ───────────────────────────────────────────────
// NOTE: Kept for admin/debug use. Uses stored meroshareToken — never hashed password.
exports.triggerSync = async (req, res) => {
  try {
    logger.info("Manual sync triggered via API.");
    res.json({ success: true, message: "Sync started. Check /api/sync/logs for status." });

    const User     = require("../models/User");
    const lastUser = await User.findOne().sort({ lastLoginAt: -1 }).lean();
    if (lastUser) {
      const { runFullSync } = require("../services/syncService");
      runFullSync({
        clientId:       lastUser.clientId,
        username:       lastUser.username,
        name:           lastUser.name,
        meroshareToken: lastUser.meroshareToken || null,
        userId:         lastUser._id,
        // NOTE: password intentionally omitted — must use stored token only
      });
    } else {
      logger.warn("Manual sync: no user found in DB.");
    }
  } catch (e) {
    logger.error(e);
  }
};