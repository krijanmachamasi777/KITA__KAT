// src/routes/index.js
const router           = require("express").Router();
const ctrl             = require("../controllers/index");
const authCtrl         = require("../controllers/authController");
const journalCtrl      = require("../controllers/journalController");
const watchlistCtrl    = require("../controllers/watchlistController");
const purchaseSourceCtrl = require("../controllers/purchaseSourceController");
const protect          = require("../middleware/auth");
const { loginLimiter, apiLimiter } = require("../middleware/rateLimiter");
const {
  validateJournalTrade,
  validateInvestmentTrade,
  validateTradeUpdate,
  validateWatchlistCreate,
  validateWatchlistUpdate,
  validateObjectIdParam,

  validatePurchaseScripts,
  validatePurchaseSearch,
  validatePurchaseUpload,
  validatePurchaseView,
} = require("../middleware/validate");

router.get("/health", (req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() })
);

// ── Public routes (no JWT required) ──────────────────────────────────
router.post("/auth/login", loginLimiter, authCtrl.login);

// ── Protected routes (JWT required) ──────────────────────────────────
router.use(protect);
// SEC-6: general 300 req / 15 min ceiling, per account, on every route below.
router.use(apiLimiter);

router.get("/auth/me",             authCtrl.getMe);
router.post("/auth/logout",        authCtrl.logout);

router.get("/profile",             ctrl.getProfile);


router.get("/shares",              ctrl.getShares);
router.get("/shares/:script",      ctrl.getShareByScript);

router.get("/portfolio",           ctrl.getPortfolio);

// Portfolio refresh (browser reload — uses stored MeroShare token)
// If MeroShare session expired → returns 401 { sessionExpired: true }
// Frontend must redirect to login on receiving this.
router.post("/portfolio/refresh",  ctrl.refreshPortfolio);

router.get("/issues",              ctrl.getApplicableIssues);
router.get("/wacc",                ctrl.getWacc);

// ── Purchase Source (live MeroShare calls — see purchaseSourceService) ──
router.get("/purchase-source/disclaimer",     purchaseSourceCtrl.getDisclaimer);
router.post("/purchase-source/scripts",       validatePurchaseScripts, purchaseSourceCtrl.getScripts);
router.post("/purchase-source/search",        validatePurchaseSearch,  purchaseSourceCtrl.searchScript);
router.post("/purchase-source/upload",        validatePurchaseUpload,  purchaseSourceCtrl.uploadWacc);
router.post("/purchase-source/view",          validatePurchaseView,    purchaseSourceCtrl.viewSummary);
router.get("/purchase-source/holdings",       purchaseSourceCtrl.getHoldings);
router.get("/purchase-source/wacc-report",    purchaseSourceCtrl.getWaccReport);

router.get("/journal-trades",      journalCtrl.getJournalTrades);
router.post("/journal-trades",     validateJournalTrade, journalCtrl.createJournalTrade);
router.put("/journal-trades/:id",  validateObjectIdParam, validateTradeUpdate, journalCtrl.updateJournalTrade);
router.delete("/journal-trades/:id", validateObjectIdParam, journalCtrl.deleteJournalTrade);

router.get("/investment-trades",   journalCtrl.getInvestmentTrades);
router.post("/investment-trades",  validateInvestmentTrade, journalCtrl.createInvestmentTrade);
router.put("/investment-trades/:id", validateObjectIdParam, validateTradeUpdate, journalCtrl.updateInvestmentTrade);
router.delete("/investment-trades/:id", validateObjectIdParam, journalCtrl.deleteInvestmentTrade);

router.get("/sync/logs",           ctrl.getSyncLogs);

router.get("/watchlist-items",           watchlistCtrl.getWatchlistItems);
router.post("/watchlist-items",          validateWatchlistCreate, watchlistCtrl.createWatchlistItem);
router.put("/watchlist-items/:id",       validateObjectIdParam, validateWatchlistUpdate, watchlistCtrl.updateWatchlistItem);
router.delete("/watchlist-items/:id",    validateObjectIdParam, watchlistCtrl.deleteWatchlistItem);

module.exports = router;