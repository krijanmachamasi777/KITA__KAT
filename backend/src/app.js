// src/app.js — Express app setup
const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const routes  = require("./routes/index");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

// ── Security HTTP headers ─────────────────────────────────────────────
//
// FIX [CRITICAL — SEC-1]: Helmet now includes explicit Content-Security-Policy.
// The default helmet() has no CSP directive; any response (even JSON errors)
// rendered in a browser context had no XSS protection. For a pure JSON API the
// strictest safe policy is `default-src 'none'` — the API returns no scripts,
// styles, or frames so nothing should load from it.
//
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'none'"],
        scriptSrc:   ["'none'"],
        styleSrc:    ["'none'"],
        imgSrc:      ["'none'"],
        connectSrc:  ["'none'"],
        fontSrc:     ["'none'"],
        objectSrc:   ["'none'"],
        frameSrc:    ["'none'"],
        formAction:  ["'none'"],
      },
    },
    // Cross-Origin-Opener-Policy: keep same-origin for API responses
    crossOriginOpenerPolicy: { policy: "same-origin" },
    // Prevent browsers from sniffing MIME types
    noSniff: true,
    // Send Referrer-Policy: no-referrer so the MeroShare token is never
    // exposed via Referer headers on redirects
    referrerPolicy: { policy: "no-referrer" },
  })
);

// Trust the first proxy hop (Render/Railway/nginx/etc). Required so
// express-rate-limit (and req.ip generally) sees the real client IP
// instead of the proxy's IP — without this, all traffic would appear to
// come from one IP and the login rate limiter would lock out everyone
// together.
app.set("trust proxy", 1);

// ── Allowed frontend origins ─────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

// Always allow local dev origins
const DEFAULT_ORIGINS = [
  "http://localhost:5173",  // Vite default
  "http://localhost:3000",  // CRA default
  "http://localhost:4173",  // Vite preview
];

const allowedOrigins = [...new Set([...DEFAULT_ORIGINS, ...ALLOWED_ORIGINS])];

// ── FIX [CRITICAL — SEC-2]: CORS preflight bypass ────────────────────────
//
// BUG (original): `app.options("*", cors())` used bare `cors()` with NO
// configuration, which means the OPTIONS preflight handler accepted requests
// from ANY origin, returning `Access-Control-Allow-Origin: *`. This completely
// bypassed the origin whitelist enforced by the main `app.use(cors(...))`.
// A hostile site could make preflight succeed, then send credentialed
// cross-origin requests.
//
// FIX: Extract the cors options into a shared constant and pass it to BOTH
// the regular handler and the preflight handler so both enforce the same
// origin policy. The origin list, allowed methods, and headers are now
// identical for actual requests and preflight requests.
//
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, Postman, same-origin)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  methods:        ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials:    true,
  // Cache preflight response for 10 minutes to reduce preflight round trips
  maxAge: 600,
};

app.use(cors(corsOptions));

// Preflight for all routes — MUST use the same corsOptions, not bare cors()
app.options("*", cors(corsOptions));

// ── Body parsing ─────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));          // Limit payload size for security
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Request logger ───────────────────────────────────────────────────────
app.use((req, _res, next) => {
  const logger = require("./utils/logger");
  logger.debug(`→ ${req.method} ${req.url}`);
  next();
});

// ── Routes ───────────────────────────────────────────────────────────────
app.use("/api", routes);

// ── Error handling ───────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;