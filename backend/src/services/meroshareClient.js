// src/services/meroshareClient.js
const axios = require("axios");
const {
  AUTH_URL,
  VIEW_URL,
  PURCHASE_URL,
  EDIS_URL,
  HOLDINGS_URL,
  CREDENTIALS,
  DEFAULTS,
} = require("../config/meroshare");
const logger = require("../utils/logger");

// ── FIX [HIGH — SEC-6]: Add timeout to all external API calls ────────────
//
// BUG (original): Every axios call was made without a `timeout` option.
// If the MeroShare / CDSC API hangs (slow response, network issue, or
// deliberate slow-loris from the upstream), the Express worker will hold
// the open socket indefinitely. Under load this exhausts the Node.js
// event loop and starves all other in-flight requests. For a login endpoint
// this is especially bad because:
//   • The login handler awaits client.login() synchronously
//   • A hung login blocks JWT issuance
//   • Combined with the sync step, one hung login can hold a worker for minutes
//
// FIX: Use a shared axios instance with a 15-second request timeout.
// 15 s is generous for the CDSC API (p99 latency is well under 5 s in
// practice) but prevents indefinite hangs. The WACC per-script fallback
// loop uses the same instance, so a hung upstream won't stall the entire
// sync either.
//
const AXIOS_TIMEOUT_MS = 15_000; // 15 seconds

const http = axios.create({
  timeout: AXIOS_TIMEOUT_MS,
});

class MeroShareClient {
  constructor(credentials = {}) {
    this.credentials = {
      clientId: credentials.clientId || CREDENTIALS.clientId,
      username: credentials.username || CREDENTIALS.username,
      password: credentials.password || CREDENTIALS.password,
    };
    this.token = null;
    this.boid = null;
    this.clientCode = null;
  }

  // ── Private helpers ─────────────────────────────────────────────────

  _headers() {
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: this.token,
    };
  }

  _requireAuth() {
    if (!this.token) {
      throw new Error("Client is not authenticated. Call login() first.");
    }
  }

  _requireBoid() {
    if (!this.boid) {
      throw new Error("BOID not set. Call getOwnDetails() first.");
    }
  }

  // ── Auth ────────────────────────────────────────────────────────────

  async login() {
    logger.debug("Logging in to MeroShare...");
    const res = await http.post(
      `${AUTH_URL}/auth/`,
      {
        clientId: this.credentials.clientId,
        username: this.credentials.username,
        password: this.credentials.password,
      },
      { headers: { "Content-Type": "application/json" } },
    );

    const token = res.headers["authorization"];
    if (!token)
      throw new Error("Login failed: no authorization token returned.");

    this.token = token;
    logger.info("✅ MeroShare login successful.");
    return token;
  }

  // ── Own Details ─────────────────────────────────────────────────────

  async getOwnDetails() {
    this._requireAuth();
    const res = await http.get(`${AUTH_URL}/ownDetail/`, {
      headers: this._headers(),
    });
    const d = res.data;

    this.boid = d.demat;
    this.clientCode = d.clientCode;

    logger.debug(`Own details fetched. BOID: ${this.boid}`);
    return d;
  }

  // ── Shares ──────────────────────────────────────────────────────────

  async getMyShares(page = DEFAULTS.PAGE, size = DEFAULTS.SIZE) {
    this._requireAuth();
    const res = await http.post(
      `${VIEW_URL}/myShare/`,
      {
        sortBy: "CCY_SHORT_NAME",
        demat: [this.boid],
        clientCode: String(this.clientCode),
        page,
        size,
        sortAsc: true,
      },
      { headers: this._headers() },
    );

    const data = res.data;
    const shares = Array.isArray(data) ? data : data?.meroShareDematShare || [];

    logger.debug(`Fetched ${shares.length} shares.`);
    return { shares, total: data?.totalItems ?? shares.length };
  }

  // ── Portfolio ────────────────────────────────────────────────────────

  async getPortfolio(page = DEFAULTS.PAGE, size = DEFAULTS.SIZE) {
    this._requireAuth();
    const res = await http.post(
      `${VIEW_URL}/myPortfolio/`,
      {
        sortBy: "script",
        demat: [this.boid],
        clientCode: String(this.clientCode),
        page,
        size,
        sortAsc: true,
      },
      { headers: this._headers() },
    );

    const data = res.data;
    const items =
      data.meroShareMyPortfolio || data.myPortfolio || data.object || [];

    logger.debug(`Fetched portfolio with ${items.length} items.`);
    return {
      summary: {
        totalCostPrice: data.totalCostPrice ?? 0,
        totalValueOfLastTransPrice: data.totalValueOfLastTransPrice ?? 0,
      },
      items: Array.isArray(items) ? items : [],
    };
  }

  // ── Applicable Issues (IPO/FPO) ─────────────────────────────────────

  async getApplicableIssues(page = DEFAULTS.PAGE, size = DEFAULTS.SIZE) {
    this._requireAuth();
    const res = await http.post(
      `${AUTH_URL}/companyShare/applicableIssue/`,
      {
        filterDateParams: [
          { key: "minIssueOpenDate", condition: "", alias: "", value: "" },
          { key: "maxIssueCloseDate", condition: "", alias: "", value: "" },
        ],
        filterFieldParams: [
          { key: "companyIssue.companyISIN.script", alias: "Scrip" },
          {
            key: "companyIssue.companyISIN.company.name",
            alias: "Company Name",
          },
          {
            key: "companyIssue.assignedToClient.name",
            value: "",
            alias: "Issue Manager",
          },
        ],
        page,
        size,
        searchRoleViewConstants: "VIEW_APPLICABLE_SHARE",
      },
      { headers: this._headers() },
    );

    const data = res.data;
    const issues =
      data.object || data.applicableIssue || (Array.isArray(data) ? data : []);
    const total = data.totalCount || data.totalItems || issues.length;

    logger.debug(`Fetched ${issues.length} applicable issues.`);
    return { issues, total };
  }

  // ── WACC ────────────────────────────────────────────────────────────

  async getWaccForScript(script) {
    this._requireAuth();
    const res = await http.post(
      `${PURCHASE_URL}/search/wacc/`,
      { demat: this.boid, scrip: script },
      { headers: this._headers() },
    );

    const records = res.data?.waccUpdateResponse || [];
    logger.debug(`Fetched ${records.length} WACC records for ${script}.`);
    return records;
  }

  async getWaccForAll(scripts = []) {
    this._requireAuth();
    try {
      const res = await http.post(
        `${PURCHASE_URL}/search/wacc/`,
        { demat: this.boid, scrip: "", isFilterByAllScript: true },
        { headers: this._headers() },
      );
      const records = res.data?.waccUpdateResponse || [];
      logger.info(`Fetched ${records.length} WACC records (all scripts).`);
      return records;
    } catch (err) {
      logger.warn(`⚠️  Bulk WACC fetch failed: ${err.message}. Falling back to per-script.`);
      const all = [];
      for (const script of scripts) {
        try {
          const records = await this.getWaccForScript(script);
          all.push(...records);
        } catch (e) {
          logger.warn(`⚠️  WACC fetch failed for ${script}: ${e.message}`);
        }
      }
      return all;
    }
  }

  // ── Purchase Source / My Purchase ────────────────────────────────────
  //
  // New module: lets the user see, per scrip, whether their WACC purchase
  // price has already been declared to MeroShare or is still pending, and
  // search/view the declared rate or completed-summary for a given scrip.
  //
  // All three calls reuse the same authenticated session / PURCHASE_URL
  // base as getWaccForScript/getWaccForAll above — no new auth flow.
  //

  // GET /api/myPurchase/disclaimer/
  // Returns the legal disclaimer text shown above the WACC declaration UI.
  // Server-driven (isEnabled / fieldValue) — never hardcode the text.
  async getPurchaseDisclaimer() {
    this._requireAuth();
    const res = await http.get(`${PURCHASE_URL}/disclaimer/`, {
      headers: this._headers(),
    });

    const data = res.data || {};
    logger.debug(`Fetched purchase disclaimer (enabled=${data.isEnabled}).`);
    return data;
  }

  // POST /api/myPurchase/share/
  // isFilterByAllScript=false → only scripts with pending WACC declaration
  // isFilterByAllScript=true  → every allotted scrip (pending + completed)
  // Returns a plain array of scrip codes, e.g. ["SGHL"] or ["RSY","SGHL"].
  async getPurchaseShareList(isFilterByAllScript = false) {
    this._requireAuth();
    const res = await http.post(
      `${PURCHASE_URL}/share/`,
      { isFilterByAllScript: !!isFilterByAllScript },
      { headers: this._headers() },
    );

    const data = res.data;
    const scripts = Array.isArray(data) ? data : [];
    logger.debug(`Fetched ${scripts.length} purchase-source scrip(s) (all=${!!isFilterByAllScript}).`);
    return scripts;
  }

  // POST /api/myPurchase/search/wacc/
  // demat is always this.boid (set by getOwnDetails()) — caller never
  // supplies it, so it can never be spoofed from the request body.
  //
  // Response shape varies by scrip status:
  //   viewSummary=false → waccUpdateResponse: [...]   (pending — show update table)
  //   viewSummary=true  → waccSummaryResponse: {...}  (completed — show summary card)
  async searchPurchaseWacc(scrip) {
    this._requireAuth();
    this._requireBoid();

    const res = await http.post(
      `${PURCHASE_URL}/search/wacc/`,
      { demat: this.boid, scrip },
      { headers: this._headers() },
    );

    const data = res.data || {};
    logger.debug(
      `Searched purchase WACC for ${scrip} (viewSummary=${data.viewSummary}).`
    );
    return data;
  }

  // POST /api/myPurchase/upload/
  // Submits the edited WACC records (rate/userPrice changes) for the scrips
  // currently shown in the update table.
  //
  // CDSC's /upload/ endpoint validates the *whole posted array* atomically —
  // if even one record lacks a confirmed purchase price, it 404s the entire
  // batch and nothing gets confirmed, even records that were otherwise fine.
  // To avoid blocking good records on one bad one, each record is submitted
  // as its own single-element array so its outcome is tracked independently.
  //
  // Returns { confirmed: [...], unconfirmed: [...] } on partial/full success.
  // Throws only when EVERY record failed with a CDSC 404 (nothing to show),
  // or on any non-404 (network/5xx/timeout) failure, which still propagates
  // as-is so it's logged and surfaced normally.
  async uploadPurchaseSource(records = []) {
    this._requireAuth();
    this._requireBoid();

    const stamped = (Array.isArray(records) ? records : []).map((r) => ({
      ...r,
      demat: this.boid,
    }));

    const confirmed = [];
    const unconfirmed = [];

    for (const record of stamped) {
      try {
        const res = await http.post(
          `${PURCHASE_URL}/upload/`,
          [record], // single-record batch — isolates this record's outcome
          { headers: this._headers() },
        );

        const data = res.data || {};
        logger.debug(
          `Uploaded purchase-source record for ${record.scrip ?? "unknown scrip"} (status=${data.status || data.statusCode}).`
        );
        confirmed.push({ record, response: data });
      } catch (err) {
        // CDSC answers this endpoint with a plain 404 (no useful JSON body)
        // when a submitted record doesn't actually carry a confirmed
        // purchase price — the exact condition the live MeroShare UI
        // catches client-side with its own "Please confirm all purchase
        // price." toast before ever calling this endpoint. Since we don't
        // replicate that client-side check, CDSC's 404 is our first signal.
        // This is an EXPECTED validation outcome for this one record, not
        // a transport failure.
        if (err.response?.status === 404) {
          logger.debug(
            `uploadPurchaseSource: CDSC returned 404 for record (scrip=${record.scrip ?? "unknown"}) — treating as unconfirmed purchase price.`
          );
          unconfirmed.push({ record, reason: "CDSC 404 — purchase price not confirmed" });
          continue;
        }
        // Anything else (5xx, network error, timeout, etc.) is a genuine
        // unexpected failure — let it propagate as-is so it's logged and
        // surfaced normally, not silently reinterpreted.
        throw err;
      }
    }

    if (confirmed.length === 0 && unconfirmed.length > 0) {
      // Nothing succeeded — expected CDSC state (no confirmed prices yet),
      // not a server error. Resolve normally instead of throwing, so it
      // doesn't get logged as an uncaught error upstream. Callers should
      // check `unconfirmed.length` / `confirmed.length` to decide what to
      // show the user (e.g. "please confirm your purchase price on
      // MeroShare first") rather than relying on a caught exception.
      logger.debug(
        `uploadPurchaseSource: all ${unconfirmed.length} record(s) unconfirmed — no records to upload yet.`
      );
      return { confirmed, unconfirmed };
    }

    logger.debug(
      `uploadPurchaseSource complete: ${confirmed.length} confirmed, ${unconfirmed.length} unconfirmed.`
    );
    return { confirmed, unconfirmed };
  }

  // POST /api/myPurchase/view/
  // Returns the completed WACC summary for a scrip (averageBuyRate,
  // totalQuantity, totalCost, isin, scripName) — called right after a
  // successful upload to refresh the UI without another search.
  async viewWaccSummary(scrip) {
    this._requireAuth();
    this._requireBoid();

    const res = await http.post(
      `${PURCHASE_URL}/view/`,
      { demat: this.boid, scrip },
      { headers: this._headers() },
    );

    const data = res.data || {};
    logger.debug(`Fetched WACC summary view for ${scrip}.`);
    return data;
  }

  // GET /api/myHoldings/wacc/
  // No request payload. Returns the user's allotted IPO holdings *after*
  // WACC processing is complete. CDSC's own backend frequently answers
  // with a 500 + { success:false, message:"No EDIS obligation left." }
  // when there's nothing to show yet — this is a normal, expected response
  // for this endpoint, not a transport failure, so it's surfaced as-is
  // rather than thrown, letting the caller decide how to render it.
  async getMyHoldingsWacc() {
    this._requireAuth();

    try {
      const res = await http.get(`${HOLDINGS_URL}/wacc/`, {
        headers: this._headers(),
      });
      const data = res.data;
      logger.debug(`Fetched myHoldings/wacc (type=${Array.isArray(data) ? "array" : typeof data}).`);
      return data;
    } catch (err) {
      // CDSC returns this endpoint's "nothing yet" state as an HTTP error
      // status with a JSON body, not a 200. axios throws on non-2xx, so we
      // catch here and hand back whatever body CDSC sent (if any) instead
      // of letting the error propagate as a generic failure — the body
      // itself (e.g. "No EDIS obligation left.") is meaningful to display.
      if (err.response?.data) {
        logger.debug(`myHoldings/wacc returned ${err.response.status}: ${JSON.stringify(err.response.data)}`);
        return err.response.data;
      }
      throw err;
    }
  }

  // POST /api/myPurchase/waccReport/
  // demat is always this.boid — caller never supplies it, so it can never
  // be spoofed from the request body. Returns the completed WACC report
  // (per-scrip average buy rate / quantity / cost) across all scrips, plus
  // an isWaccPending flag for in-progress calculations.
  async getWaccReport() {
    this._requireAuth();
    this._requireBoid();

    const res = await http.post(
      `${PURCHASE_URL}/waccReport/`,
      { demat: this.boid },
      { headers: this._headers() },
    );

    const data = res.data || {};
    logger.debug(
      `Fetched WACC report (pending=${data.isWaccPending}, records=${data.waccReportResponse?.length ?? 0}).`
    );
    return data;
  }

  // ── EDIS: Check for active settlements (sold scripts) ───────────────
  //
  // Calls POST /api/EDIS/transfer/active/ with the user's BOID (demat).
  // Returns an array of settlement objects if any scripts were sold,
  // or an empty array if nothing was sold.
  //
  // Each settlement object contains: { settlementDate, settlementDateStr, settlementId }
  //
  async getActiveEdis(demat) {
    this._requireAuth();
    this._requireBoid();

    const boid = demat || this.boid;

    try {
      const res = await http.post(
        `${EDIS_URL}/transfer/active/`,
        { demat: boid },
        { headers: this._headers() },
      );

      const data = res.data;
      // MeroShare returns either an array directly or wraps it
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.object)) return data.object;
      return [];
    } catch (err) {
      // 409 = "No EDIS for today" — not an error, just means nothing sold
      if (err.response?.status === 409) {
        logger.debug("EDIS: No active settlements for today.");
        return [];
      }
      logger.warn(`⚠️  getActiveEdis failed: ${err.message}`);
      return [];
    }
  }

  // ── EDIS: Get sale details for a specific settlement ────────────────
  //
  // Calls GET /api/EDIS/transfer/detail/{settlementId}
  // Returns an array of sold script detail objects.
  //
  // Each detail object contains:
  //   obligation.scriptCode  → scrip name (e.g. "PURE")
  //   rate                   → sell rate
  //   quantity               → qty sold
  //   obligation.settleDate  → settlement date
  //   obligation.wacc        → buy rate (used for matching existing records)
  //   transferQuantity       → actual transferred qty
  //
  async getEdisDetail(settlementId) {
    this._requireAuth();

    try {
      const res = await http.get(
        `${EDIS_URL}/transfer/detail/${settlementId}`,
        { headers: this._headers() },
      );

      const data = res.data;
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.object)) return data.object;
      return [];
    } catch (err) {
      logger.warn(`⚠️  getEdisDetail(${settlementId}) failed: ${err.message}`);
      return [];
    }
  }
}

module.exports = MeroShareClient;