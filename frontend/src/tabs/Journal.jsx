import { JournalTable } from "../components/JournalTable";
import { isAgedOutTrade } from "../utils/helpers";
import "../styles/journal.css";

// ── JOURNAL TAB ───────────────────────────────────────────
// Props:
//   trades       – array of all trade objects
//   onScripClick – open detail modal for the clicked trade
//   onHistory    – open the Trade History modal (rendered at the
//                  App level — see App.jsx — so its fixed overlay
//                  isn't trapped inside the animated .kk-page-enter
//                  wrapper that every tab renders inside of)

export function Journal({ trades, onScripClick, onHistory }) {
  // Sold trades that are 90+ days old move to the History view.
  // Nothing is deleted/modified in the DB — purely a display filter.
  const visibleTrades = trades.filter(t => !isAgedOutTrade(t));

  const sortedTrades = [...visibleTrades].sort((a, b) => {
    const dateCompare = (a.boughtDate || "").localeCompare(b.boughtDate || "");
    return dateCompare || (a.tsn || "").localeCompare(b.tsn || "");
  });

  return (
    <div className="card--np">
      <div className="card__header">
        <div>
          <div className="card__title">Trade Journal</div>
          <div className="card__sub">Click any SCRIPT to view · Edit · Delete</div>
        </div>
        <div className="journal-header__right">
          <button className="btn btn--history" onClick={onHistory}>
            🕘 History
          </button>
          <span className="card__count">{visibleTrades.length} trades</span>
        </div>
      </div>
      <JournalTable trades={sortedTrades} onScripClick={onScripClick} />
    </div>
  );
}