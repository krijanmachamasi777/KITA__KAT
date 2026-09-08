// src/controllers/ipoApplyController.js
//
// HTTP layer for the "Apply for Company Share" (IPO/FPO) module —
// replicates the real MeroShare Apply flow end to end. Pure
// request/response glue; all MeroShare logic lives in
// services/ipoApplyService.js.
//
// Routes (mounted in routes/index.js, behind the existing `protect` JWT
// middleware, same as every sibling module):
//   GET  /api/ipo-apply/eligibility/:companyShareId
//   GET  /api/ipo-apply/issue/:companyShareId
//   GET  /api/ipo-apply/banks
//   GET  /api/ipo-apply/banks/:bankId
//   GET  /api/ipo-apply/disclaimer
//   POST /api/ipo-apply/submit
//
// Exactly like purchase-source, the frontend never calls MeroShare's
// /api/meroShare/... paths directly — every external call (including the
// final apply submission, transaction PIN included) is proxied through
// this backend so the MeroShare session token never reaches the browser.
//
const ipoApplyService = require("../services/ipoApplyService");
const logger            = require("../utils/logger");

const ok  = (res, data, meta = {}) => res.json({ success: true, ...meta, data });
const err = (res, message, status = 500) =>
  res.status(status).json({ success: false, message });

// Shared session-expiry → 401 handling, identical contract to
// purchaseSourceController.js#handleServiceError so the frontend's
// existing "meroshare:sessionExpired" handling keeps working unmodified
// for this module too.
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

// GET /api/ipo-apply/eligibility/:companyShareId
exports.getEligibility = async (req, res) => {
  try {
    const data = await ipoApplyService.checkEligibility(
      req.user.id,
      req.params.companyShareId
    );
    ok(res, data);
  } catch (e) {
    handleServiceError(res, e, "checkEligibility");
  }
};

// GET /api/ipo-apply/issue/:companyShareId
exports.getIssueDetail = async (req, res) => {
  try {
    const data = await ipoApplyService.fetchIssueDetail(
      req.user.id,
      req.params.companyShareId
    );
    ok(res, data);
  } catch (e) {
    handleServiceError(res, e, "fetchIssueDetail");
  }
};

// GET /api/ipo-apply/banks
exports.getBanks = async (req, res) => {
  try {
    const data = await ipoApplyService.fetchBanks(req.user.id);
    ok(res, data);
  } catch (e) {
    handleServiceError(res, e, "fetchBanks");
  }
};

// GET /api/ipo-apply/banks/:bankId
exports.getBankAccount = async (req, res) => {
  try {
    const data = await ipoApplyService.fetchBankAccount(req.user.id, req.params.bankId);
    ok(res, data);
  } catch (e) {
    handleServiceError(res, e, "fetchBankAccount");
  }
};

// GET /api/ipo-apply/disclaimer
exports.getDisclaimer = async (req, res) => {
  try {
    const data = await ipoApplyService.fetchDisclaimer(req.user.id);
    ok(res, data);
  } catch (e) {
    handleServiceError(res, e, "fetchDisclaimer");
  }
};

// POST /api/ipo-apply/submit
// Body already whitelisted by validateIpoApplySubmit middleware — never
// contains a demat/boid (the service/client always re-derive those from
// the authenticated session).
exports.submit = async (req, res) => {
  try {
    const result = await ipoApplyService.submitApply(req.user.id, req.body);
    // CDSC's contract: statusCode 201 ("CREATED") means the application
    // succeeded. Anything else is surfaced to the frontend as-is so the
    // UI can show the backend's own message rather than guessing.
    const succeeded = result?.statusCode === 201 || result?.status === "CREATED";
    ok(res, result, { succeeded });
  } catch (e) {
    handleServiceError(res, e, "submitApply");
  }
};