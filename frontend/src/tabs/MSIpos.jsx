// src/tabs/MSIpos.jsx — uses portfolioData.issues from AuthContext (DB-fetched on login)
import { useAuth } from "../context/AuthContext";
import "../styles/meroshare.css";

export function MSIpos() {
  const { portfolioData, fetchAllPortfolioData } = useAuth();
  const { issues = [], loaded } = portfolioData;

  if (!loaded) return <div className="ms-state">⏳ Loading open issues…</div>;

  const typeColor = t => {
    if (!t) return "badge--default";
    const l = t.toLowerCase();
    if (l.includes("ipo"))    return "badge--banking";
    if (l.includes("fpo"))    return "badge--finance";
    if (l.includes("rights")) return "badge--it";
    if (l.includes("mutual")) return "badge--gold";
    return "badge--default";
  };

  return (
    <div className="ms-wrap">
      <div className="stat-grid ms-summary">
        <div className="stat-card">
          <div className="stat-card__label">Open Issues</div>
          <div className="stat-card__value v--blue">{issues.length}</div>
          <div className="stat-card__sub">Currently applicable</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">IPO</div>
          <div className="stat-card__value">
            {issues.filter(i => (i.shareTypeName || "").toLowerCase().includes("ipo")).length}
          </div>
          <div className="stat-card__sub">Initial Public Offers</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">FPO / Rights</div>
          <div className="stat-card__value v--purple">
            {issues.filter(i => {
              const t = (i.shareTypeName || "").toLowerCase();
              return t.includes("fpo") || t.includes("rights");
            }).length}
          </div>
          <div className="stat-card__sub">Further offerings</div>
        </div>
      </div>

      <div className="card--np ms-card">
        <div className="card__header">
          <div>
            <div className="card__title">Open IPO / FPO Issues</div>
            <div className="card__sub">Currently applicable issues on MeroShare</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="card__count">{issues.length} total</span>
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
                <th>#</th><th>Script</th><th>Company</th><th>Type</th>
                <th>Group</th><th>Open Date</th><th>Close Date</th>
              </tr>
            </thead>
            <tbody>
              {issues.length === 0 && (
                <tr><td colSpan={7} className="td--empty">No open issues right now.</td></tr>
              )}
              {issues.map((iss, i) => (
                <tr key={iss.companyShareId || i}>
                  <td className="td--muted">{i + 1}</td>
                  <td><span className="scrip-btn" style={{ cursor: "default" }}>{iss.scrip || iss.script || "—"}</span></td>
                  <td className="td--bold">{iss.companyName || iss.name || "—"}</td>
                  <td><span className={`badge ${typeColor(iss.shareTypeName)}`}>{iss.shareTypeName || "—"}</span></td>
                  <td className="td--muted">{iss.shareGroupName || "—"}</td>
                  <td className="td--mono">{iss.issueOpenDate  || "—"}</td>
                  <td className="td--mono">{iss.issueCloseDate || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}