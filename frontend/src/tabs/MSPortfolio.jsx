// src/tabs/MSPortfolio.jsx — uses portfolioData from AuthContext (DB-fetched on login)
import { useAuth } from "../context/AuthContext";
import { fmt }     from "../utils/helpers";
import "../styles/meroshare.css";

export function MSPortfolio() {
  const { portfolioData, fetchAllPortfolioData } = useAuth();
  const { portfolio, loaded } = portfolioData;

  if (!loaded) return <div className="ms-state">⏳ Loading portfolio…</div>;

  const summary = portfolio?.summary || {};
  const items   = portfolio?.items   || [];
  const cost    = Number(summary.totalCost  || summary.totalCostPrice  || 0);
  const value   = Number(summary.totalValue || summary.totalValueOfLastTransPrice || 0);
  const gain    = value - cost;

  return (
    <div className="ms-wrap">
      <div className="stat-grid ms-summary">
        <div className="stat-card">
          <div className="stat-card__label">Market Value</div>
          <div className="stat-card__value">NPR {fmt(value)}</div>
          <div className="stat-card__sub">Current valuation</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Cost Basis</div>
          <div className="stat-card__value">NPR {fmt(cost)}</div>
          <div className="stat-card__sub">Total invested</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Unrealized Gain / Loss</div>
          <div className={`stat-card__value ${gain >= 0 ? "v--profit" : "v--loss"}`}>
            {gain >= 0 ? "+" : "-"}NPR {fmt(Math.abs(gain))}
          </div>
          <div className="stat-card__sub">{items.length} scripts held</div>
        </div>
      </div>

      <div className="card--np ms-card">
        <div className="card__header">
          <div>
            <div className="card__title">MeroShare Portfolio</div>
            <div className="card__sub">Live data from your CDSC demat account</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="card__count">{items.length} scripts</span>
            <button
              className="btn-secondary"
              onClick={() => fetchAllPortfolioData()}
              title="Re-fetch from database"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Script</th>
                <th>Qty</th>
                <th>LTP (NPR)</th>
                <th>Total Value (NPR)</th>
                <th>Free Balance</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={6} className="td--empty">No holdings found.</td></tr>
              )}
              {items.map((h, i) => {
                const scrip = h.script || h.scrip || h.symbol || "—";
                const qty   = h.currentBalance ?? h.qty ?? "—";
                const ltp   = h.lastTransactionPrice ?? h.ltp ?? 0;
                // eslint-disable-next-line no-constant-binary-expression
                const val   = h.valueOfLastTransPrice ?? (Number(ltp) * Number(qty)) ?? 0;
                const free  = h.freeBalance ?? h.availableBalance ?? "—";
                return (
                  <tr key={i}>
                    <td className="td--muted">{i + 1}</td>
                    <td><span className="scrip-btn" style={{ cursor: "default" }}>{scrip}</span></td>
                    <td className="td--mono">{qty}</td>
                    <td className="td--mono">NPR {fmt(ltp)}</td>
                    <td className="td--mono td--bold">NPR {fmt(val)}</td>
                    <td className="td--mono td--muted">{free}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}