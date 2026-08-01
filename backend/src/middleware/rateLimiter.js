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

// ── Email notification limiter ────────────────────────────────────────────
//
// FIX [HIGH — SEC-5]: No rate limiting on POST /notifications/send-email
//
// BUG (original): The notification email endpoint had no rate limiter. Any
// authenticated user could call it in a tight loop, sending thousands of
// emails through the configured SMTP account (Gmail App Password). This could:
//   • Exhaust the Gmail account's daily sending quota instantly
//   • Trigger Google's abuse detection and permanently suspend the sending account
//   • Be used to harass a user by flooding their inbox
//
// FIX: A per-user rate limiter (keyed on req.user.id, set by the auth
// middleware that runs before this endpoint) allows at most 10 notification
// emails per hour. The user-ID key ensures the limit is per account, not per
// IP — important because the same user could make requests from multiple IPs
// (VPN, mobile data, etc.) or multiple users could share an office IP.
//
// NOTE: This limiter must be applied AFTER the `protect` middleware in
// routes/index.js so that req.user.id is available for the keyGenerator.
//
const emailNotificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,                    // 10 emails per user per hour

  standardHeaders: true,
  legacyHeaders: false,

  // Key by authenticated user ID — set by auth middleware before this runs.
  // Falls back to IP if (somehow) user is missing, which should never happen
  // on a protected route.
  keyGenerator: (req) => req.user?.id?.toString() || ipKeyGenerator(req.ip),

  message: {
    success: false,
    message: "Too many notification emails sent. Please try again in an hour.",
  },

  handler: (req, res, _next, options) => {
    logger.warn(
      `🚫 Email rate limit hit | User: ${req.user?.username || req.ip}`
    );
    res.status(options.statusCode).json(options.message);
  },
});

module.exports = { loginLimiter, emailNotificationLimiter };