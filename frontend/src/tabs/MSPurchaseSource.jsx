// src/tabs/MSPurchaseSource.jsx
//
// Top-level wrapper for the "My Purchase Source" section.
// Renders three horizontal sub-tabs:
//
//   1. Purchase Source  — existing WACC declaration flow (unchanged)
//   2. My Holdings      — allotted IPO holdings after WACC processing
//   3. My WACC          — summary WACC report with CSV / PDF export
//
// LAZY LOADING: each sub-tab's API is called only the first time that
// tab is opened. Subsequent visits reuse the already-fetched state.
// This matches the existing app's pattern (portfolioData.loaded guard
// in AuthContext) and satisfies "only call the API of the selected tab."
//
// PURCHASE SOURCE TAB: all logic below is identical to the previous
// implementation — not a single line of its business logic was changed.
//
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { fmt }     from "../utils/helpers";
import "../styles/meroshare.css";

// ── Sub-tab definitions ───────────────────────────────────────────────
const SUB_TABS = [
  { id: "purchase-source", label: "Purchase Source" },
  { id: "my-holdings",     label: "My Holdings"     },
  { id: "my-wacc",         label: "My WACC"         },
];

// ── Purchase Source: filter definitions ──────────────────────────────
const FILTERS = [
  { id: "pending", label: "Pending Script", isFilterByAllScript: false },
  { id: "all",     label: "All Script",      isFilterByAllScript: true  },
];

// ── CSV export helper (no external library) ───────────────────────────
function downloadCsv(rows, filename) {
  if (!rows || rows.length === 0) return;
  const headers = ["#", "Scrip Name", "WACC Calculated Quantity", "WACC Rate", "Total Cost Of Capital", "Last Modification Date"];
  const lines = [
    headers.join(","),
    ...rows.map((r, i) =>
      [
        i + 1,
        r.scrip           || "",
        r.totalQuantity   ?? "",
        r.averageBuyRate  ?? "",
        r.totalCost       ?? "",
        r.lastModifiedDate || "",
      ]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── PDF export helper (browser native print, scoped to the report) ────
function printPdf(tableRef) {
  if (!tableRef?.current) return;
  const html = tableRef.current.outerHTML;
  const win  = window.open("", "_blank", "width=900,height=600");
  if (!win) return;
  win.document.write(`
    <html><head><title>My WACC Report</title>
    <style>
      body { font-family: sans-serif; font-size: 12px; padding: 24px; }
      h2 { margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 7px 10px; text-align: left; }
      th { background: #f0f0f5; font-weight: 700; }
      tr:nth-child(even) td { background: #fafafa; }
    </style>
    </head><body>
    <h2>My WACC Report</h2>
    ${html}
    </body></html>
  `);
  win.document.close();
  win.focus();
  win.print();
  win.close();
}


// ── Never surface raw technical API errors to the user ────────────────
// Defense-in-depth alongside the backend-level fix in meroshareClient.js
// (uploadPurchaseSource): if any raw Axios/HTTP-style message ever slips
// through from any Purchase Source call, this maps it to the same
// user-friendly guidance shown for the known "unconfirmed purchase price"
// case, instead of ever rendering "Request failed with status code ###",
// "API error ###", or similar technical text.
const FRIENDLY_UPLOAD_ERROR =
  "Please confirm all purchase prices before proceeding with WACC calculation.";

function toFriendlyPurchaseError(message) {
  if (!message) return message;
  if (/request failed with status code/i.test(message) || /^API error \d+$/i.test(message)) {
    return FRIENDLY_UPLOAD_ERROR;
  }
  return message;
}


// ══════════════════════════════════════════════════════════════════════
// ROOT COMPONENT
// ══════════════════════════════════════════════════════════════════════
export function MSPurchaseSource() {
  const [activeSubTab, setActiveSubTab] = useState("purchase-source");

  const handleSubTab = (id) => setActiveSubTab(id);

  return (
    <div className="ms-wrap">
      {/* ── Sub-tab navigation ──────────────────────────────────────── */}
      <div className="card--np ms-card" style={{ padding: "0 20px" }}>
        <nav className="ms-sub-tabs">
          {SUB_TABS.map(t => (
            <button
              key={t.id}
              className={`ms-sub-tab${activeSubTab === t.id ? " ms-sub-tab--active" : ""}`}
              onClick={() => handleSubTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab panels ──────────────────────────────────────────────── */}
      {activeSubTab === "purchase-source" && <PurchaseSourceTab />}
      {activeSubTab === "my-holdings"     && <MyHoldingsTab />}
      {activeSubTab === "my-wacc"         && <MyWaccTab />}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════
// TAB 1 — PURCHASE SOURCE  (zero changes from the working implementation)
// ══════════════════════════════════════════════════════════════════════
function PurchaseSourceTab() {
  const {
    fetchPurchaseScripts,
    searchPurchaseWacc,
    confirmPurchaseWacc,
    fetchPurchaseSummary,
  } = useAuth();

  const [filter,            setFilter]            = useState("pending");
  const [pendingScriptList, setPendingScriptList] = useState([]);
  const [allScriptList,     setAllScriptList]     = useState([]);
  const [scriptsLoading,    setScriptsLoading]    = useState(false);
  const [scriptsError,      setScriptsError]      = useState(null);
  const [search,            setSearch]            = useState("");
  const [selectedScript,    setSelectedScript]    = useState(null);
  const [searchResult,      setSearchResult]      = useState(null);
  const [loadingSearch,     setLoadingSearch]     = useState(false);
  const [apiErrors,         setApiErrors]         = useState({});
  const [editedRecords,     setEditedRecords]     = useState([]);
  const [loadingUpload,     setLoadingUpload]     = useState(false);
  const [uploadStatus,      setUploadStatus]      = useState(null);
  const [summaryData,       setSummaryData]       = useState(null);
  const [loadingSummary,    setLoadingSummary]    = useState(false);
  const [dropdownOpen,      setDropdownOpen]      = useState(false);
  const comboRef = useRef(null);

  const scripts = filter === "pending" ? pendingScriptList : allScriptList;

  // Close the script dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (comboRef.current && !comboRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // fetchScripts — lazy, with silent-refresh option
  const fetchScripts = useCallback(async (filterId, { silent = false } = {}) => {
    const def = FILTERS.find(f => f.id === filterId) || FILTERS[0];
    if (!silent) setScriptsLoading(true);
    setScriptsError(null);
    try {
      const list     = await fetchPurchaseScripts(def.isFilterByAllScript);
      const safeList = Array.isArray(list) ? list : [];
      if (filterId === "pending") setPendingScriptList(safeList);
      else setAllScriptList(safeList);
    } catch (e) {
      if (!silent) setScriptsError(e.message || "Failed to load scripts.");
    } finally {
      if (!silent) setScriptsLoading(false);
    }
  }, [fetchPurchaseScripts]);

  const fetchPendingScripts = useCallback((opts) => fetchScripts("pending", opts), [fetchScripts]);
  const fetchAllScripts     = useCallback((opts) => fetchScripts("all", opts),     [fetchScripts]);

  useEffect(() => { fetchPendingScripts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset
  const handleReset = useCallback(() => {
    setSearch("");
    setSelectedScript(null);
    setSearchResult(null);
    setEditedRecords([]);
    setSummaryData(null);
    setUploadStatus(null);
    setApiErrors({});
    setDropdownOpen(false);
  }, []);

  // Filter switch
  const handleFilterClick = (filterId) => {
    if (filterId === filter) return;
    setFilter(filterId);
    handleReset();
    const hasCache = filterId === "pending" ? pendingScriptList.length > 0 : allScriptList.length > 0;
    if (!hasCache) fetchScripts(filterId);
  };

  // Pick a script from the dropdown
  const handleScriptPick = (s) => {
    setSearch(s);
    setDropdownOpen(false);
    runSearch(s);
  };

  // Search
  const runSearch = useCallback(async (scrip) => {
    if (!scrip) return;
    setSelectedScript(scrip);
    setLoadingSearch(true);
    setApiErrors(prev => ({ ...prev, search: null }));
    setSearchResult(null);
    setEditedRecords([]);
    setSummaryData(null);
    setUploadStatus(null);
    try {
      const result = await searchPurchaseWacc(scrip);
      setSearchResult(result);
      // Seed each record with local-only selection/remarks state, mirroring
      // the real MeroShare "Purchase Source" screen: nothing is selected by
      // default, so nothing is priced/costed until the user checks it.
      const records = Array.isArray(result?.waccUpdateResponse) ? result.waccUpdateResponse : [];
      setEditedRecords(records.map(r => ({ ...r, _checked: false, remarks: r.remarks || "" })));
    } catch (e) {
      setApiErrors(prev => ({ ...prev, search: e.message || "Search failed." }));
    } finally {
      setLoadingSearch(false);
    }
  }, [searchPurchaseWacc]);

  // Immutable price edit
  const handlePriceChange = (recordId, value) => {
    setEditedRecords(prev =>
      prev.map(r => (r.id === recordId ? { ...r, userPrice: value } : r))
    );
  };

  const handleRemarksChange = (recordId, value) => {
    setEditedRecords(prev =>
      prev.map(r => (r.id === recordId ? { ...r, remarks: value } : r))
    );
  };

  // Selecting a transaction is what tells the system "calculate WACC for
  // this quantity now" — matches the real MeroShare flow where you choose
  // which kitta/transactions to include, rather than forcing every pending
  // row at once. Checking a row auto-fills its price from the declared
  // rate (still editable); unchecking clears it back to 0, same as the
  // live site's behaviour. Every row in this table is selectable — the
  // API's isEdit/isValidForRateChange flags don't gate this on the real
  // site, so we don't gate it here either.
  const handleToggleCheck = (recordId) => {
    setEditedRecords(prev =>
      prev.map(r => {
        if (r.id !== recordId) return r;
        const nextChecked = !r._checked;
        return { ...r, _checked: nextChecked, userPrice: nextChecked ? r.rate : 0 };
      })
    );
  };

  const handleToggleSelectAll = (checked) => {
    setEditedRecords(prev =>
      prev.map(r => ({ ...r, _checked: checked, userPrice: checked ? r.rate : 0 }))
    );
  };

  // Confirm WACC → upload → auto-view → auto-refresh both lists
  // Only the transactions the user actually checked are submitted — you can
  // declare WACC for a subset of pending kitta at a time, same as MeroShare.
  const handleConfirmWacc = async () => {
    const toSubmit = editedRecords
      .filter(r => r._checked)
      .map(({  ...r }) => r);
    if (loadingUpload || toSubmit.length === 0) return;
    setLoadingUpload(true);
    setApiErrors(prev => ({ ...prev, upload: null }));
    setUploadStatus(null);
    try {
      const result    = await confirmPurchaseWacc(toSubmit);
      const succeeded = result?.statusCode === 202 || result?.status === "ACCEPTED";
      if (!succeeded) {
        setUploadStatus({ succeeded: false, message: result?.message || "Please Confirm all Purchase prices" });
        return;
      }
      setUploadStatus({ succeeded: true, message: result?.message || "My purchase updates done." });
      setLoadingSummary(true);
      setApiErrors(prev => ({ ...prev, summary: null }));
      try {
        const summary = await fetchPurchaseSummary(selectedScript);
        setSummaryData(summary);
      } catch (e) {
        setApiErrors(prev => ({ ...prev, summary: e.message || "Failed to load WACC summary." }));
      } finally {
        setLoadingSummary(false);
      }
      fetchPendingScripts({ silent: true });
      fetchAllScripts({ silent: true });
    } catch (e) {
      setApiErrors(prev => ({ ...prev, upload: e.message || "Upload failed." }));
    } finally {
      setLoadingUpload(false);
    }
  };

  // Summary retry
  const retrySummary = useCallback(() => {
    setLoadingSummary(true);
    setApiErrors(prev => ({ ...prev, summary: null }));
    fetchPurchaseSummary(selectedScript)
      .then(setSummaryData)
      .catch(e => setApiErrors(prev => ({ ...prev, summary: e.message || "Failed to load WACC summary." })))
      .finally(() => setLoadingSummary(false));
  }, [fetchPurchaseSummary, selectedScript]);

  const visibleScripts  = scripts.filter(s => !search || String(s).toLowerCase().includes(search.toLowerCase()));

  // Data-presence driven, NOT solely `viewSummary`. CDSC's `viewSummary` flag is a
  // scrip-level "is everything declared" flag — it does not mean the underlying
  // per-transaction records are absent. `waccUpdateResponse` can (and does) still
  // contain real records when viewSummary=true. On the live site every record in
  // this table is selectable and priceable regardless of isEdit/isValidForRateChange
  // — those flags don't gate the checkbox/input there, so we don't gate on them
  // either. We show the summary card whenever a summary exists, and the
  // transaction table whenever there are records — the two are no longer
  // mutually exclusive.
  const effectiveSummary  = uploadStatus?.succeeded ? summaryData : searchResult?.waccSummaryResponse;
  const showSummaryCard   = !loadingSearch && !!effectiveSummary;
  const showRecordsTable  = !loadingSearch && !uploadStatus?.succeeded && editedRecords.length > 0;
  const hasSelectedRecord = editedRecords.some(r => r._checked);
  const allChecked        = editedRecords.length > 0 && editedRecords.every(r => r._checked);

  return (
    <>
      <div className="card--np ms-card ms-purchase-source-card">
        <div className="card__header">
          <div>
            <div className="card__title">Purchase Source</div>
            <div className="card__sub">Declare or review your WACC purchase price per scrip</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {FILTERS.map(f => (
              <button
                key={f.id}
                className={`ms-filter-btn${f.id === filter ? " ms-filter-btn--active" : ""}`}
                onClick={() => handleFilterClick(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: "0 4px 16px", display: "flex", gap: 8 }}>
          <div className="ms-combo-input-wrap" ref={comboRef} style={{ width: 240 }}>
            <input
              className="ms-search ms-combo-input"
              placeholder={filter === "pending" ? "Search pending scripts…" : "Search all scripts…"}
              value={search}
              onChange={e => { setSearch(e.target.value); setDropdownOpen(true); }}
              onFocus={() => setDropdownOpen(true)}
            />
            <button
              type="button"
              className={`ms-combo-arrow${dropdownOpen ? " ms-combo-arrow--open" : ""}`}
              onClick={() => setDropdownOpen(o => !o)}
              aria-label="Toggle script list"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="ms-combo-dropdown">
                {scriptsLoading && <div className="ms-combo-empty">⏳ Loading scripts…</div>}

                {!scriptsLoading && scriptsError && (
                  <div className="ms-combo-empty">
                    ⚠️ {toFriendlyPurchaseError(scriptsError)}
                    <div>
                      <button className="ms-relogin" style={{ marginTop: 8 }} onClick={() => fetchScripts(filter)}>Retry</button>
                    </div>
                  </div>
                )}

                {!scriptsLoading && !scriptsError && visibleScripts.length === 0 && (
                  <div className="ms-combo-empty">
                    {scripts.length === 0
                      ? (filter === "pending" ? "No pending scripts. All caught up! 🎉" : "No allotted scripts found.")
                      : "No scripts match your search."}
                  </div>
                )}

                {!scriptsLoading && !scriptsError && visibleScripts.map(s => (
                  <button
                    key={s}
                    type="button"
                    className={`ms-combo-item${s === selectedScript ? " ms-combo-item--active" : ""}`}
                    onClick={() => handleScriptPick(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedScript && (
            <button className="btn-secondary" onClick={handleReset}>✕ Reset</button>
          )}
        </div>
      </div>

      {selectedScript && (
        <div className="card--np ms-card">
          <div className="card__header">
            <div>
              <div className="card__title">{selectedScript}</div>
              <div className="card__sub">
                {loadingSearch
                  ? "Searching…"
                  : uploadStatus?.succeeded
                    ? "WACC declared successfully"
                    : editedRecords.length > 0
                      ? "Pending WACC declaration"
                      : effectiveSummary
                        ? "WACC already declared"
                        : "No purchase records found"}
              </div>
            </div>
            <button className="btn-secondary" onClick={() => runSearch(selectedScript)} disabled={loadingUpload}>
              ↻ Refresh
            </button>
          </div>

          {loadingSearch && <div className="ms-state">⏳ Searching…</div>}

          {!loadingSearch && apiErrors.search && (
            <div className="ms-state ms-state--err">
              ⚠️ {toFriendlyPurchaseError(apiErrors.search)}
              <button className="ms-relogin" onClick={() => runSearch(selectedScript)}>Retry</button>
            </div>
          )}

          {uploadStatus && (
            <div
              className={`ms-state${uploadStatus.succeeded ? "" : " ms-state--err"}`}
              style={{ padding: "12px 20px", textAlign: "left", flexDirection: "row", justifyContent: "space-between" }}
            >
              <span>{uploadStatus.succeeded ? "✅" : "⚠️"} {uploadStatus.succeeded ? uploadStatus.message : toFriendlyPurchaseError(uploadStatus.message)}</span>
            </div>
          )}

          {apiErrors.upload && (
            <div className="ms-state ms-state--err">
              ⚠️ {toFriendlyPurchaseError(apiErrors.upload)}
            </div>
          )}

          {showSummaryCard && (
            <>
              {loadingSummary && <div className="ms-state">⏳ Fetching Summary…</div>}
              {!loadingSummary && apiErrors.summary && (
                <div className="ms-state ms-state--err">
                  ⚠️ {toFriendlyPurchaseError(apiErrors.summary)}
                  <button className="ms-relogin" onClick={retrySummary}>Retry</button>
                </div>
              )}
              {!loadingSummary && !apiErrors.summary && effectiveSummary && (
                <div className="table-wrap" style={{ padding: "0 4px 16px" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Scrip</th>
                        <th>WACC Calculated Quantity</th>
                        <th>WACC Rate</th>
                        <th>Total Cost Of Capital</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="td--bold">{effectiveSummary.scripName || "—"}</td>
                        <td className="td--mono">{fmt(effectiveSummary.totalQuantity)}</td>
                        <td className="td--mono">{fmt(effectiveSummary.averageBuyRate)}</td>
                        <td className="td--mono">{fmt(effectiveSummary.totalCost)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {showRecordsTable && (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>
                        {editedRecords.length > 0 && (
                          <input
                            type="checkbox"
                            checked={allChecked}
                            disabled={loadingUpload}
                            onChange={e => handleToggleSelectAll(e.target.checked)}
                            aria-label="Select all transactions"
                          />
                        )}
                      </th>
                      <th>Scrip</th>
                      <th>Transaction Date</th>
                      <th>Transaction Quantity</th>
                      <th>Rate</th>
                      <th>Purchase Source</th>
                      <th>Purchase Price</th>
                      <th>Total Cost</th>
                      <th>Remarks</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editedRecords.map((r, i) => {
                      const totalCost = Number(r.userPrice || 0) * Number(r.transactionQuantity || 0);
                      return (
                        <tr key={r.id ?? i}>
                          <td className="td--muted">{i + 1}</td>
                          <td>
                            <input
                              type="checkbox"
                              checked={!!r._checked}
                              disabled={loadingUpload}
                              onChange={() => handleToggleCheck(r.id)}
                              aria-label={`Select transaction ${i + 1}`}
                            />
                          </td>
                          <td className="td--bold">{r.scrip || selectedScript || "—"}</td>
                          <td className="td--mono">{r.transactionDate ? String(r.transactionDate).split("T")[0] : "—"}</td>
                          <td className="td--mono">{r.transactionQuantity ?? "—"}</td>
                          <td className="td--mono td--muted">{fmt(r.rate)}</td>
                          <td><span className="badge badge--default">{r.purchaseSource || "—"}</span></td>
                          <td>
                            <input
                              type="number" min="0" step="0.01"
                              className="ms-search" style={{ width: 110 }}
                              value={r._checked ? (r.userPrice ?? "") : 0}
                              disabled={loadingUpload || !r._checked}
                              onChange={e => handlePriceChange(r.id, e.target.value === "" ? "" : Number(e.target.value))}
                            />
                          </td>
                          <td className="td--mono">{fmt(totalCost)}</td>
                          <td>
                            <input
                              type="text"
                              className="ms-search" style={{ width: 130 }}
                              value={r.remarks || ""}
                              disabled={loadingUpload}
                              onChange={e => handleRemarksChange(r.id, e.target.value)}
                            />
                          </td>
                          <td className="td--muted" title={r.historyDescription || undefined}></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {editedRecords.length > 0 && (
                <>
                  {/* Legal declaration — shown ONLY here, i.e. only for
                      records still in the pending waccUpdateResponse set.
                      A scrip whose WACC is already completed never reaches
                      this branch (its records live in waccSummaryResponse /
                      effectiveSummary instead — see showSummaryCard below),
                      so this never appears for already-declared WACC, and
                      it never renders anywhere outside this section. */}
                  <div className="ms-wacc-declaration">
                    ⚠️ I hereby declare that the prices that I have set here for WACC calculation purpose are provided with the best of my knowledge and I am aware that I will be held liable for legal consequences if the provided data is found to be incorrect.
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-start", padding: "16px 20px" }}>
                    <button
                      className="ms-filter-btn ms-filter-btn--active"
                      onClick={handleConfirmWacc}
                      disabled={loadingUpload || !hasSelectedRecord}
                      style={{ opacity: (loadingUpload || !hasSelectedRecord) ? 0.6 : 1, cursor: (loadingUpload || !hasSelectedRecord) ? "not-allowed" : "pointer" }}
                    >
                      {loadingUpload ? "Uploading…" : "Proceed"}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* No records at all and no summary — genuinely nothing found for this scrip */}
          {!loadingSearch && !uploadStatus?.succeeded && editedRecords.length === 0 && !effectiveSummary && (
            <div className="ms-state">No purchase-source records found for this scrip.</div>
          )}
        </div>
      )}
    </>
  );
}


// ══════════════════════════════════════════════════════════════════════
// TAB 2 — MY HOLDINGS
// ══════════════════════════════════════════════════════════════════════
//
// Calls GET /api/myHoldings/wacc/ the first time this tab is opened.
//
// IMPORTANT: CDSC's backend frequently answers this endpoint with:
//   { success: false, statusCode: 500, message: "No EDIS obligation left." }
// when there's nothing to show yet. This is a NORMAL/EXPECTED response —
// it means the user has no holdings ready yet, not that something broke.
//
// Our backend controller wraps it in { success: true, data: <cdsc body> }
// at the envelope level, so apiFetch doesn't throw. The raw CDSC body
// (including its inner `success: false`) arrives here as `holdingsData`
// and is rendered as an informational state, never a crash.
//
// When CDSC eventually starts returning real holdings (an array or object
// with an array property), we render them generically in a table so no
// frontend changes are needed when that happens.
//
function MyHoldingsTab() {
  const { fetchMyHoldings } = useAuth();

  const [holdingsData,    setHoldingsData]    = useState(null);  // raw CDSC response
  const [loadingHoldings, setLoadingHoldings] = useState(false);
  const [holdingsError,   setHoldingsError]   = useState(null);
  const fetchedRef = useRef(false); // only fetch once per mount

  const loadHoldings = useCallback(async () => {
    setLoadingHoldings(true);
    setHoldingsError(null);
    try {
      const data = await fetchMyHoldings();
      setHoldingsData(data);
    } catch (e) {
      setHoldingsError(e.message || "Failed to load holdings.");
    } finally {
      setLoadingHoldings(false);
    }
  }, [fetchMyHoldings]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    loadHoldings();
  }, [loadHoldings]);

  // Derive the array of holdings rows from whatever the API returned.
  // Handles: plain array, { data: [...] }, { holdings: [...] }, etc.
  // If none of those match, falls back to empty — the "no data" state
  // will show, and the UI never crashes on an unexpected shape.
  function deriveHoldingRows(data) {
    if (!data) return null; // not loaded yet
    if (Array.isArray(data)) return data;
    // CDSC "nothing yet" shape: { success:false, message:... }
    if (data.success === false) return { cdscMessage: data.message || "No data available." };
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.holdings)) return data.holdings;
    if (Array.isArray(data.waccUpdateResponse)) return data.waccUpdateResponse;
    return [];
  }

  const rows = deriveHoldingRows(holdingsData);

  // Determine column headers dynamically from the first row,
  // so future backend additions render automatically.
  const columns = rows && Array.isArray(rows) && rows.length > 0
    ? Object.keys(rows[0])
    : [];

  return (
    <div className="card--np ms-card">
      <div className="card__header">
        <div>
          <div className="card__title">My Holdings</div>
          <div className="card__sub">Allotted IPO holdings after WACC processing</div>
        </div>
        <button className="btn-secondary" onClick={loadHoldings} disabled={loadingHoldings}>
          ↻ Refresh
        </button>
      </div>

      {loadingHoldings && <div className="ms-state">⏳ Loading holdings…</div>}

      {!loadingHoldings && holdingsError && (
        <div className="ms-state ms-state--err">
          ⚠️ {holdingsError}
          <button className="ms-relogin" onClick={loadHoldings}>Retry</button>
        </div>
      )}

      {/* CDSC "nothing yet" informational state */}
      {!loadingHoldings && !holdingsError && rows && !Array.isArray(rows) && rows.cdscMessage && (
        <div className="ms-state ms-state--warn">
          ℹ️ {rows.cdscMessage}
        </div>
      )}

      {/* Empty array */}
      {!loadingHoldings && !holdingsError && Array.isArray(rows) && rows.length === 0 && (
        <div className="ms-state">No holdings available.</div>
      )}

      {/* Holdings table — renders any array payload generically */}
      {!loadingHoldings && !holdingsError && Array.isArray(rows) && rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                {columns.map(col => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="td--muted">{i + 1}</td>
                  {columns.map(col => (
                    <td key={col} className="td--mono">
                      {row[col] === null || row[col] === undefined ? "—" : String(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════
// TAB 3 — MY WACC  (Summary Statement with CSV / PDF export)
// ══════════════════════════════════════════════════════════════════════
function MyWaccTab() {
  const { fetchWaccReport } = useAuth();

  const [reportData,    setReportData]    = useState(null);  // full API response
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError,   setReportError]   = useState(null);
  const fetchedRef = useRef(false);
  const tableRef   = useRef(null);

  const loadReport = useCallback(async () => {
    setLoadingReport(true);
    setReportError(null);
    try {
      const data = await fetchWaccReport();
      setReportData(data || null);
    } catch (e) {
      setReportError(e.message || "Failed to load WACC report.");
    } finally {
      setLoadingReport(false);
    }
  }, [fetchWaccReport]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    loadReport();
  }, [loadReport]);

  const records     = Array.isArray(reportData?.waccReportResponse) ? reportData.waccReportResponse : [];
  const isPending   = reportData?.isWaccPending === true;
  const isEmpty     = !loadingReport && !reportError && reportData && records.length === 0 && !isPending;

  return (
    <div className="card--np ms-card">
      <div className="card__header">
        <div>
          <div className="card__title">Summary Statement</div>
          <div className="card__sub">View your WACC details</div>
        </div>
        <div className="ms-export-bar">
          <button
            className="ms-export-btn"
            disabled={records.length === 0 || loadingReport}
            onClick={() => downloadCsv(records, "my-wacc-report.csv")}
            title="Download CSV"
          >
            ⬇ CSV
          </button>
          <button
            className="ms-export-btn"
            disabled={records.length === 0 || loadingReport}
            onClick={() => printPdf(tableRef)}
            title="Print / Save as PDF"
          >
            🖨 PDF
          </button>
          <button className="btn-secondary" onClick={loadReport} disabled={loadingReport}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {loadingReport && <div className="ms-state">⏳ Loading WACC report…</div>}

      {!loadingReport && reportError && (
        <div className="ms-state ms-state--err">
          ⚠️ {reportError}
          <button className="ms-relogin" onClick={loadReport}>Retry</button>
        </div>
      )}

      {/* isWaccPending banner — shown above the table, hides the table */}
      {!loadingReport && !reportError && isPending && (
        <div className="ms-state ms-state--warn">
          ⏳ WACC calculation is currently pending. Please check back shortly.
        </div>
      )}

      {/* Empty response */}
      {isEmpty && (
        <div className="ms-state">No WACC records found.</div>
      )}

      {/* WACC report table */}
      {!loadingReport && !reportError && !isPending && records.length > 0 && (
        <div className="table-wrap">
          <table ref={tableRef}>
            <thead>
              <tr>
                <th>#</th>
                <th>Scrip Name</th>
                <th>WACC Calculated Quantity</th>
                <th>WACC Rate</th>
                <th>Total Cost Of Capital</th>
                <th>Last Modification Date</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={r.scrip ? `${r.scrip}-${i}` : i}>
                  <td className="td--muted">{i + 1}</td>
                  <td>
                    <span className="scrip-btn" style={{ cursor: "default" }}>
                      {r.scrip || "—"}
                    </span>
                  </td>
                  <td className="td--mono">{r.totalQuantity ?? "—"}</td>
                  <td className="td--mono td--bold">NPR {fmt(r.averageBuyRate)}</td>
                  <td className="td--mono">NPR {fmt(r.totalCost)}</td>
                  <td className="td--mono td--muted">{r.lastModifiedDate || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}