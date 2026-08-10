// src/middleware/rateLimiter.js
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const logger = require("../utils/logger");

// ── Login limiter ─────────────────────────────────────────────────────────
//
// Combines IP + username so different users on the same WiFi are not blocked
// together. ipKeyGenerator normalizes IPv6 addresses (collapses them to a /64
// subnet) so IPv6 clients can't bypass the limit by rotating addresses
// within their prefix. Required by express-rate-limit v8.
//
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,

  standardHeaders: true,
  legacyHeaders: false,

  // KEY CHANGE: per user + IP combination (with IPv6 support)
  keyGenerator: (req, res) => {
    const ipKey = ipKeyGenerator(req, res);
    const username = req.body?.username || "unknown";
    return `${ipKey}-${username}`;
  },

  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
  },

  handler: (req, res, _next, options) => {
    logger.warn(
      `🚫 Login rate limit hit | IP: ${req.ip} | User: ${req.body?.username}`
    );
    res.status(options.statusCode).json(options.message);
  },
});

// ── General API limiter ───────────────────────────────────────────────────
//
// FIX [MEDIUM — SEC-6]: No rate limit on any endpoint except /auth/login.
//
// BUG (original): Once a client had a valid JWT, every other endpoint —
// creating/editing trades, refreshing the portfolio, watchlist, purchase
// source lookups (which call the live MeroShare API), etc. — could be
// called as fast as the caller wanted. A leaked/stolen token, a buggy
// frontend retry loop, or a malicious script could hammer the API and the
// upstream MeroShare service with no limit at all.
//
// FIX: A general-purpose limiter (300 requests / 15 min) applied to every
// route AFTER `protect` in routes/index.js. Keyed by the authenticated
// user's account ID (not IP) — because this only runs on protected routes,
// req.user.id is always set by then. This means one heavy user never
// throttles other users on the same network (office WiFi, VPN, etc.), and
// it can't be bypassed by switching IPs since it follows the account, not
// the connection.
//
// This is intentionally a generous ceiling — it exists to stop runaway
// scripts/loops and credential-stuffing style abuse, not to limit normal
// human usage of the app.
//
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,

  standardHeaders: true,
  legacyHeaders: false,

  // Always runs after `protect`, so req.user.id is guaranteed to be set.
  // ipKeyGenerator fallback kept only as a defensive safety net.
  keyGenerator: (req, res) => (req.user?.id ? `user-${req.user.id}` : ipKeyGenerator(req, res)),

  message: {
    success: false,
    message: "Too many requests. Please slow down and try again shortly.",
  },

  handler: (req, res, _next, options) => {
    logger.warn(
      `🚫 API rate limit hit | User: ${req.user?.username || "unknown"} | Path: ${req.originalUrl}`
    );
    res.status(options.statusCode).json(options.message);
  },
});

module.exports = { loginLimiter, apiLimiter };