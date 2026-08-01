import { fmt, isClosedTrade, tradePL } from "../utils/helpers";
import { JournalTable } from "../components/JournalTable";
import "../styles/losing.css";

// ── LOSING TAB ────────────────────────────────────────────
// Props:
//   trades       – full array of all trade objects (used for totals)
//   onScripClick – open detail modal for the clicked trade

export function Losing({ trades, onScripClick }) {
  const losingTrades = trades
    .filter(t => isClosedTrade(t) && tradePL(t) < 0)
    .sort((a, b) => (a.boughtDate || "").localeCompare(b.boughtDate || ""));
  const closedTrades = trades.filter(isClosedTrade);
  const netLoss      = losingTrades.reduce((s, t) => s + tradePL(t), 0);
  const winCount     = closedTrades.filter(t => tradePL(t) > 0).length;
  const lossRate     = closedTrades.length
    ? ((losingTrades.length / closedTrades.length) * 100).toFixed(2)
    : "0.00";

  return (
    <div className="losing">
      {/* ── Summary stats ── */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__label">Total Losses</div>
          <div className="stat-card__value v--loss">{losingTrades.length} Trades</div>
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
          <div className="stat-card__sub">Out of {closedTrades.length} closed</div>
        </div>
      </div>

      {/* ── Losing trades table ── */}
      <div className="card--np">
        <div className="card__header">
          <div>
            <div className="card__title">Losing Trades Journal</div>
            <div className="card__sub">Click any SCRIP to view · Edit · Delete</div>
          </div>
          <span className="loss-badge">📉 {losingTrades.length} Losses</span>
        </div>
        <JournalTable trades={losingTrades} onScripClick={onScripClick} />
      </div>
    </div>
  );
}