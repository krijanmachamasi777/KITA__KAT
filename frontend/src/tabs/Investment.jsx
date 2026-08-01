import { isAgedOutTrade } from "../utils/helpers";
import { InvestmentTable } from "../components/InvestmentTable";
import "../styles/investment.css";
import "../styles/journal.css"; // for .btn--history (shared history-feature styling)

// ── INVESTMENT TAB ────────────────────────────────────────
// Props:
//   investments  – full array of all investment objects
//   onScripClick – open detail modal for the clicked scrip/group
//   onHistory    – open the Investment History modal (rendered at the
//                  App level — see App.jsx — same pattern as the
//                  Journal tab's History modal)

export function Investment({ investments, onScripClick, onHistory }) {
  // Sold investments that are 90+ days old move to the History view.
  // Nothing is deleted/modified in the DB — purely a display filter.
  const visibleInvestments = investments.filter(i => !isAgedOutTrade(i));

  const holdingCount = visibleInvestments.filter(i => !i.soldDate).length;
  const soldCount    = visibleInvestments.filter(i => !!i.soldDate).length;

  return (
    <div className="card--np">
      <div className="card__header">
        <div>
          <div className="card__title">Investment Portfolio</div>
          <div className="card__sub">Click any SCRIPT to view all entries · Edit · Delete</div>
        </div>
        <div className="inv-badges">
          <button className="btn btn--history" onClick={onHistory}>
            🕘 History
          </button>
          <span className="status-badge sb--holding">⬤ {holdingCount} Holding</span>
          <span className="status-badge sb--sold">✓ {soldCount} Sold</span>
        </div>
      </div>

      <InvestmentTable investments={visibleInvestments} onScripClick={onScripClick} />
    </div>
  );
}