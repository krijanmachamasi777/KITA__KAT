import { fmt, isClosedTrade, tradePL, isAgedOutTrade } from "../utils/helpers";
import { JournalTable } from "../components/JournalTable";
import "../styles/losing.css";
import "../styles/journal.css"; // for .btn--history / .journal-header__right (shared history-feature styling)

// ── LOSING TAB ────────────────────────────────────────────
// Props:
//   trades       – full array of all trade objects (used for totals)
//   onScripClick – open detail modal for the clicked trade
//   onHistory    – open the Losing History modal (rendered at the
//                  App level — see App.jsx — same pattern as the
//                  Journal/Investment tabs' History modals)

export function Losing({ trades, onScripClick, onHistory }) {
  // ── Stats (Total Losses / Net Loss Amount / Loss Rate / Winning Trades) ──
  // These summary numbers cover the ENTIRE trade history — every trade
  // ever logged, aged-out or not. They should never shrink or change
  // just because older losses get tucked into History below.
  const allClosedTrades = trades.filter(isClosedTrade);
  const allLosingTrades = allClosedTrades.filter(t => tradePL(t) < 0);
  const netLoss  = allLosingTrades.reduce((s, t) => s + tradePL(t), 0);
  const winCount = allClosedTrades.filter(t => tradePL(t) > 0).length;
  const lossRate = allClosedTrades.length
    ? ((allLosingTrades.length / allClosedTrades.length) * 100).toFixed(2)
    : "0.00";

  // ── Table below ── only losses sold within the last 90 days are shown
  // here; older ones move to the History popup. Nothing is deleted or
  // changed in the database — this is purely a display filter, same
  // rule Journal/Investment use for their own tables.
  const visibleTrades = trades.filter(t => !isAgedOutTrade(t));
  const losingTrades = visibleTrades
    .filter(t => isClosedTrade(t) && tradePL(t) < 0)
    .sort((a, b) => (a.boughtDate || "").localeCompare(b.boughtDate || ""));

  return (
    <div className="losing">
      {/* ── Summary stats ── */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__label">Total Losses</div>
          <div className="stat-card__value v--loss">{allLosingTrades.length} Trades</div>
          <div className="stat-card__sub">Out of {trades.length} total</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Net Loss Amount</div>
          <div className="stat-card__value v--loss">-{fmt(Math.abs(netLoss))}</div>
          <div className="stat-card__sub">Realized losses</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Loss Rate</div>
          <div className="stat-card__value v--loss">{lossRate}%</div>
          <div className="stat-card__sub">Of closed trades</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Winning Trades</div>
          <div className="stat-card__value v--profit">{winCount}</div>
          <div className="stat-card__sub">Out of {allClosedTrades.length} closed</div>
        </div>
      </div>

      {/* ── Losing trades table ── */}
      <div className="card--np">
        <div className="card__header">
          <div>
            <div className="card__title">Losing Trades Journal</div>
            <div className="card__sub">Click any SCRIP to view · Edit · Delete</div>
          </div>
          <div className="journal-header__right">
            <button className="btn btn--history" onClick={onHistory}>
              🕘 History
            </button>
            <span className="loss-badge">📉 {losingTrades.length} Losses</span>
          </div>
        </div>
        <JournalTable trades={losingTrades} onScripClick={onScripClick} />
      </div>
    </div>
  );
}