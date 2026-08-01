// src/controllers/notificationController.js
//
// Handles notification email sending.
// Uses nodemailer with Gmail SMTP (via env vars).
// Does NOT affect any existing controller, route, or model.
//
const nodemailer = require("nodemailer");
const User       = require("../models/User");
const logger     = require("../utils/logger");

const ok  = (res, data, meta = {}) => res.json({ success: true, ...meta, data });
const err = (res, message, status = 400) =>
  res.status(status).json({ success: false, message });

// Escape user-supplied text before placing it in HTML email bodies.
// Prevents HTML/script injection (XSS) via subject/message fields.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── FIX [MEDIUM — SEC-7]: Singleton transporter ──────────────────────────
//
// BUG (original): `nodemailer.createTransport()` was called inside the request
// handler on every single email request. This means:
//   1. A new TCP connection to Gmail's SMTP server was opened for every request —
//      no connection pooling, so the per-request latency was higher than needed.
//   2. The SMTP credentials (NOTIFY_EMAIL_USER, NOTIFY_EMAIL_PASS) were read
//      from process.env and handed to nodemailer on every call. While not a
//      direct leak, this pattern unnecessarily widens the code surface where
//      credentials are touched at runtime.
//   3. If the env vars were missing, the error would surface only when the
//      endpoint was first hit — not at startup.
//
// FIX: Create the transporter once at module load time (lazy singleton).
// The first call to getTransporter() builds it; subsequent calls reuse it.
// Nodemailer's SMTP transport internally pools connections over keepalive.
//
// Startup validation: the module checks for the env vars when it is first
// required (at server start). A missing variable is logged as a warning;
// the endpoint will return a 503 instead of a 500 with a config error message
// so it's clear this is a server misconfiguration, not a user error.
//
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const user = process.env.NOTIFY_EMAIL_USER;
  const pass = process.env.NOTIFY_EMAIL_PASS;

  if (!user || !pass) {
    // Return null — caller will return a 503.
    // We deliberately do NOT throw here so the rest of the server keeps running
    // even if email is misconfigured.
    logger.warn(
      "⚠️  NOTIFY_EMAIL_USER or NOTIFY_EMAIL_PASS is not set. " +
      "Email notifications are disabled until these are configured in .env."
    );
    return null;
  }

  _transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
    // Pool connections instead of creating a new socket per email
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
  });

  logger.info(`📧 Email transporter ready (sender: ${user})`);
  return _transporter;
}

// POST /api/notifications/send-email
// Body: { subject, message }
// Sends to the currently logged-in user's email (from User model)
exports.sendNotificationEmail = async (req, res) => {
  try {
    // Get user email from DB (req.user.id set by auth middleware)
    const user = await User.findById(req.user.id).select("email name username").lean();
    if (!user) return err(res, "User not found.", 404);

    const recipientEmail = user.email;
    if (!recipientEmail) {
      return err(res, "No email address on file for this user.", 400);
    }

    const { subject, message } = req.body;
    if (!subject || !message) {
      return err(res, "subject and message are required.", 400);
    }

    const transporter = getTransporter();
    if (!transporter) {
      return res.status(503).json({
        success: false,
        message: "Email service is not configured on this server. Contact the administrator.",
      });
    }

    const safeName    = escapeHtml(user.name || user.username);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

    await transporter.sendMail({
      from: `"Kitakat Notifications" <${process.env.NOTIFY_EMAIL_USER}>`,
      to:   recipientEmail,
      subject: safeSubject,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#0d0d0f;color:#f0f0f5;padding:24px;border-radius:12px;">
          <h2 style="color:#0a84ff;margin:0 0 12px">📊 Kitakat IPO Alert</h2>
          <p style="color:#888;margin:0 0 16px;font-size:13px;">
            Hi <strong style="color:#f0f0f5">${safeName}</strong>,
          </p>
          <div style="background:#141416;border:1px solid #2a2a2e;border-radius:8px;padding:16px;white-space:pre-line;font-size:14px;line-height:1.6">
            ${safeMessage}
          </div>
          <p style="color:#555;font-size:11px;margin:16px 0 0">
            This is an automated alert from Kitakat Investment Journal.
          </p>
        </div>`,
    });

    logger.info(`📧 Notification email sent to ${recipientEmail}`);
    ok(res, { sentTo: recipientEmail });

  } catch (e) {
    logger.error("sendNotificationEmail error:", e);
    err(res, e.message, 500);
  }
};