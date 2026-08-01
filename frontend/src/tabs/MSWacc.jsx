// src/tabs/MSWacc.jsx — uses portfolioData.wacc from AuthContext (DB-fetched on login)
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fmt }     from "../utils/helpers";
import "../styles/meroshare.css";

export function MSWacc() {
  const { portfolioData, fetchAllPortfolioData } = useAuth();
  const { wacc, loaded } = portfolioData;
  const [filter, setFilter] = useState("");

  if (!loaded) return <div className="ms-state">⏳ Loading WACC data…</div>;

  const records = Array.isArray(wacc) ? wacc : [];
  const filtered = records.filter(r =>
    !filter || (r.scrip || "").toLowerCase().includes(filter.toLowerCase())
  );
  const uniqueScrips = [...new Set(records.map(r => r.scrip))].filter(Boolean);

  return (
    <div className="ms-wrap">
      <div className="stat-grid ms-summary">
        <div className="stat-card">
          <div className="stat-card__label">Scripts</div>
          <div className="stat-card__value v--blue">{uniqueScrips.length}</div>
          <div className="stat-card__sub">Unique scripts with WACC</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Total Transactions</div>
          <div className="stat-card__value">{records.length}</div>
          <div className="stat-card__sub">Purchase records</div>
        </div>
      </div>

      <div className="card--np ms-card">
        <div className="card__header">
          <div>
            <div className="card__title">WACC Purchase History</div>
            <div className="card__sub">Weighted Average Cost of Capital per scrip</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              className="ms-search"
              placeholder="Filter by scrip…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
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
                <th>ISIN</th>
                <th>Qty</th>
                <th>Rate (NPR)</th>
                <th>Source</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="td--empty">No WACC records found.</td></tr>
              )}
              {filtered.map((r, i) => (
                <tr key={i}>
                  <td className="td--muted">{i + 1}</td>
                  <td><span className="scrip-btn" style={{ cursor: "default" }}>{r.scrip || "—"}</span></td>
                  <td className="td--muted td--mono" style={{ fontSize: 11 }}>{r.isin || "—"}</td>
                  <td className="td--mono">{r.transactionQuantity ?? "—"}</td>
                  <td className="td--mono td--bold">NPR {fmt(r.rate)}</td>
                  <td><span className="badge badge--default">{r.purchaseSource || "—"}</span></td>
                  <td className="td--mono">{r.transactionDate ? r.transactionDate.split("T")[0] : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}