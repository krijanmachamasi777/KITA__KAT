import { useMemo, useState } from "react";
import { JournalTable } from "./JournalTable";
import { isAgedOutTrade, isClosedTrade, tradePL } from "../utils/helpers";
import "../styles/modals.css";
import "../styles/journal.css";

// ── LOSING HISTORY MODAL ──────────────────────────────────
// Shows losing trades that have "aged out" of the Losing tab
// (sold 90+ days ago). Nothing is deleted/archived in the DB —
// this is a pure client-side view over the same `trades` array
// already loaded for the Journal/Losing tabs.
//
// Mirrors TradeHistoryModal exactly (same CSS classes, same
// date-range filter behavior), just additionally scoped to
// trades that are losses (tradePL < 0) — same rule the Losing
// tab itself uses.
//
// Props:
//   trades       – full array of all trade objects (Journal source data)
//   onScripClick – open the shared TradeDetailModal for a TSN group
//   onClose      – dismiss this modal

export function LosingHistoryModal({ trades, onScripClick, onClose }) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // All losing trades hidden from the Losing tab (sold >= 90 days ago)
  const historyTrades = useMemo(
    () => trades.filter(t => isAgedOutTrade(t) && isClosedTrade(t) && tradePL(t) < 0),
    [trades]
  );

  // Apply the From/To Sold Date range filter (inclusive on both ends)
  const filteredTrades = useMemo(() => {
    if (!fromDate && !toDate) return historyTrades;
    return historyTrades.filter(t => {
      const sold = t.soldDate;
      if (!sold) return false;
      if (fromDate && sold < fromDate) return false;
      if (toDate && sold > toDate) return false;
      return true;
    });
  }, [historyTrades, fromDate, toDate]);

  // Same ordering rule used by the Journal/Losing tabs so TSN groups stay together
  const sortedTrades = useMemo(() => {
    return [...filteredTrades].sort((a, b) => (a.boughtDate || "").localeCompare(b.boughtDate || ""));
  }, [filteredTrades]);

  const hasFilter = Boolean(fromDate || toDate);
  const clearFilters = () => { setFromDate(""); setToDate(""); };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal--history" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <div className="modal__scrip">Losing History</div>
            <div className="modal__tid">
              Losing trades sold 90+ days ago · click any SCRIPT to view details
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
            {sortedTrades.length} of {historyTrades.length} trade{historyTrades.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="card--np history-table-card">
          <JournalTable trades={sortedTrades} onScripClick={onScripClick} />
        </div>
      </div>
    </div>
  );
}