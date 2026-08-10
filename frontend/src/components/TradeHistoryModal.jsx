import { useMemo, useState } from "react";
import { JournalTable } from "./JournalTable";
import { isAgedOutTrade } from "../utils/helpers";
import "../styles/modals.css";
import "../styles/journal.css";

// ── TRADE HISTORY MODAL ───────────────────────────────────
// Shows sold trades that have "aged out" of the Journal tab
// (sold 90 days ago). Nothing is deleted/archived in the DB —
// this is a pure client-side view over the same `trades` array
// already loaded for the Journal tab.
//
// Props:
//   trades       – full array of all trade objects (Journal source data)
//   onScripClick – open the shared TradeDetailModal for a TSN group
//   onClose      – dismiss this modal

export function TradeHistoryModal({ trades, onScripClick, onClose }) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [scripQuery, setScripQuery] = useState("");

  // All trades hidden from the Journal tab (sold >= 90days ago)
  const historyTrades = useMemo(
    () => trades.filter(t => isAgedOutTrade(t)),
    [trades]
  );

  // Apply the Script search + From/To Sold Date range filters together
  // (both narrow the same result set — e.g. "NABIL" + a date range shows
  // only NABIL trades sold within that range).
  const filteredTrades = useMemo(() => {
    const query = scripQuery.trim().toUpperCase();
    if (!query && !fromDate && !toDate) return historyTrades;
    return historyTrades.filter(t => {
      if (query && !(t.scrip || "").toUpperCase().includes(query)) return false;
      const sold = t.soldDate;
      if (fromDate || toDate) {
        if (!sold) return false;
        if (fromDate && sold < fromDate) return false;
        if (toDate && sold > toDate) return false;
      }
      return true;
    });
  }, [historyTrades, scripQuery, fromDate, toDate]);

  // Same ordering rule used by the Journal tab so TSN groups stay together
  const sortedTrades = useMemo(() => {
    return [...filteredTrades].sort((a, b) => {
      const dateCompare = (a.boughtDate || "").localeCompare(b.boughtDate || "");
      return dateCompare || (a.tsn || "").localeCompare(b.tsn || "");
    });
  }, [filteredTrades]);

  const hasFilter = Boolean(scripQuery || fromDate || toDate);
  const clearFilters = () => { setScripQuery(""); setFromDate(""); setToDate(""); };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal--history" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <div className="modal__scrip">Trade History</div>
            <div className="modal__tid">
              Sold trades 90+ days ago · click any SCRIPT to view details
            </div>
          </div>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__divider" />

        <div className="history-filters">
          <div className="f-group history-filters__field history-filters__search">
            <label className="f-label">Search Script</label>
            <input
              type="text"
              className="f-input"
              placeholder="e.g. NABIL"
              value={scripQuery}
              onChange={e => setScripQuery(e.target.value)}
            />
          </div>
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

        <div className="card--np history-table-card history-table-card--journal">
          <JournalTable trades={sortedTrades} onScripClick={onScripClick} />
        </div>
      </div>
    </div>
  );
}