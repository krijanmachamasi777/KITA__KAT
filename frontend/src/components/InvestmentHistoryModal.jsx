import { useMemo, useState } from "react";
import { InvestmentTable } from "./InvestmentTable";
import { isAgedOutTrade } from "../utils/helpers";
import "../styles/modals.css";
import "../styles/journal.css";

// ── INVESTMENT HISTORY MODAL ──────────────────────────────
// Shows sold investments that have "aged out" of the Investment tab
// (sold 90 days ago). Nothing is deleted/archived in the DB —
// this is a pure client-side view over the same `investments` array
// already loaded for the Investment tab.
//
// Mirrors TradeHistoryModal exactly (same CSS classes, same
// date-range filter behavior), just backed by investments instead
// of trades.
//
// Props:
//   investments  – full array of all investment objects (Investment source data)
//   onScripClick – open the shared InvDetailModal for a scrip group
//   onClose      – dismiss this modal

export function InvestmentHistoryModal({ investments, onScripClick, onClose }) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // All investments hidden from the Investment tab (sold >= 90 days ago)
  const historyInvestments = useMemo(
    () => investments.filter(i => isAgedOutTrade(i)),
    [investments]
  );

  // Apply the From/To Sold Date range filter (inclusive on both ends)
  const filteredInvestments = useMemo(() => {
    if (!fromDate && !toDate) return historyInvestments;
    return historyInvestments.filter(i => {
      const sold = i.soldDate;
      if (!sold) return false;
      if (fromDate && sold < fromDate) return false;
      if (toDate && sold > toDate) return false;
      return true;
    });
  }, [historyInvestments, fromDate, toDate]);

  const hasFilter = Boolean(fromDate || toDate);
  const clearFilters = () => { setFromDate(""); setToDate(""); };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal--history" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <div className="modal__scrip">Investment History</div>
            <div className="modal__tid">
              Sold investments 90+ days ago · click any SCRIPT to view details
            </div>
          </div>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__divider" />

        <div className="history-filters">
          <div className="f-group history-filters__field">
            <label className="f-label">From Date</label>
            <input
              type="date"
              className="f-input"
              value={fromDate}
              max={toDate || undefined}
              onChange={e => setFromDate(e.target.value)}
            />
          </div>
          <div className="f-group history-filters__field">
            <label className="f-label">To Date</label>
            <input
              type="date"
              className="f-input"
              value={toDate}
              min={fromDate || undefined}
              onChange={e => setToDate(e.target.value)}
            />
          </div>
          <button
            className="btn btn--ghost history-filters__clear"
            onClick={clearFilters}
            disabled={!hasFilter}
          >
            Clear Filters
          </button>
          <span className="card__count history-filters__count">
            {filteredInvestments.length} of {historyInvestments.length} investment{historyInvestments.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="card--np history-table-card">
          <InvestmentTable investments={filteredInvestments} onScripClick={onScripClick} />
        </div>
      </div>
    </div>
  );
}