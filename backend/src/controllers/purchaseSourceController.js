// src/controllers/purchaseSourceController.js
//
// HTTP layer for the "Purchase Source" module. Pure request/response
// glue — all MeroShare logic lives in services/purchaseSourceService.js
// (per "Keep API logic inside service layer / Keep UI free from business
// logic" — this rule applies to the backend layering too: controllers
// stay thin, services own behaviour).
//
// Routes (mounted in routes/index.js, all behind the existing `protect`
// JWT middleware — same as every other endpoint in this file's siblings):
//   GET  /api/purchase-source/disclaimer
//   POST /api/purchase-source/scripts        { isFilterByAllScript }
//   POST /api/purchase-source/search         { scrip }
//   POST /api/purchase-source/upload         { records }
//   POST /api/purchase-source/view           { scrip }
//   GET  /api/purchase-source/holdings
//   GET  /api/purchase-source/wacc-report
//
// NOTE: the frontend never calls MeroShare's
// /api/myPurchase/... paths directly — exactly like the rest of this app,
// every external call is proxied through this backend so the MeroShare
// session token never reaches the browser.
//
const purchaseSourceService = require("../services/purchaseSourceService");
const logger                = require("../utils/logger");

const ok  = (res, data, meta = {}) => res.json({ success: true, ...meta, data });
const err = (res, message, status = 500) =>
  res.status(status).json({ success: false, message });

// Shared session-expiry → 401 handling, identical contract to
// controllers/index.js#refreshPortfolio so the frontend's existing
// "meroshare:sessionExpired" handling (in api/client.js) keeps working
// unmodified for this module too.
function handleServiceError(res, e, label) {
  if (e.sessionExpired) {
    logger.warn(`⚠️  MeroShare session expired during ${label}.`);
    return res.status(401).json({
      success:        false,
      sessionExpired: true,
      message:        "MeroShare session expired. Please login again.",
    });
  }
  logger.error(e);
  return err(res, e.message, e.status || 500);
}

// GET /api/purchase-source/disclaimer
exports.getDisclaimer = async (req, res) => {
  try {
    const data = await purchaseSourceService.fetchDisclaimer(req.user.id);
    ok(res, data);
  } catch (e) {
    handleServiceError(res, e, "fetchDisclaimer");
  }
};

// POST /api/purchase-source/scripts
// Body: { isFilterByAllScript: boolean }
exports.getScripts = async (req, res) => {
  try {
    const { isFilterByAllScript } = req.body;
    const scripts = await purchaseSourceService.fetchScripts(
      req.user.id,
      !!isFilterByAllScript
    );
    ok(res, scripts, { total: scripts.length });
  } catch (e) {
    handleServiceError(res, e, "fetchScripts");
  }
};

// POST /api/purchase-source/search
// Body: { scrip: string } — demat is resolved server-side, never from body.
exports.searchScript = async (req, res) => {
  try {
    const { scrip } = req.body;
    const result = await purchaseSourceService.searchScript(req.user.id, scrip);
    ok(res, result);
  } catch (e) {
    handleServiceError(res, e, "searchScript");
  }
};

// POST /api/purchase-source/upload
// Body: { records: [...] } — the edited waccUpdateResponse array exactly
// as maintained in the UI. validatePurchaseUpload (middleware) whitelists
// each record's fields before this runs; the service re-stamps demat.
exports.uploadWacc = async (req, res) => {
  try {
    const { records } = req.body;
    const result = await purchaseSourceService.uploadWacc(req.user.id, records);
    // CDSC's contract: statusCode 202 ("ACCEPTED") means the upload
    // succeeded. Anything else is surfaced to the frontend as-is so the UI
    // can show the backend's own message rather than guessing.
    const succeeded = result?.statusCode === 202 || result?.status === "ACCEPTED";
    ok(res, result, { succeeded });
  } catch (e) {
    handleServiceError(res, e, "uploadWacc");
  }
};

// POST /api/purchase-source/view
// Body: { scrip: string } — automatic refresh call made right after a
// successful upload (see Step 3 of the spec). demat resolved server-side.
exports.viewSummary = async (req, res) => {
  try {
    const { scrip } = req.body;
    const result = await purchaseSourceService.viewSummary(req.user.id, scrip);
    ok(res, result);
  } catch (e) {
    handleServiceError(res, e, "viewSummary");
  }
};

// GET /api/purchase-source/holdings
// No payload. CDSC's own /myHoldings/wacc/ frequently answers with a
// "success:false" + message body (e.g. "No EDIS obligation left.") rather
// than a transport error — that's a normal state for this endpoint, not a
// failure of this app, so it's returned with `success:true` at THIS layer
// (the request itself succeeded) and the upstream success flag passed
// through inside `data` for the frontend to render as its empty/info state.
exports.getHoldings = async (req, res) => {
  try {
    const data = await purchaseSourceService.fetchHoldings(req.user.id);
    ok(res, data);
  } catch (e) {
    handleServiceError(res, e, "fetchHoldings");
  }
};

// GET /api/purchase-source/wacc-report
// demat is resolved server-side, never accepted from the client.
exports.getWaccReport = async (req, res) => {
  try {
    const data = await purchaseSourceService.fetchWaccReport(req.user.id);
    ok(res, data);
  } catch (e) {
    handleServiceError(res, e, "fetchWaccReport");
  }
};
