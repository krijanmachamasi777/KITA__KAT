import { useState } from "react";
import { fmt, pctRet, holdDays, formatHoldingDuration, annG, monG, groupAnnG, groupMonG } from "../utils/helpers";
import "../styles/modals.css";

// ── INVEST DETAIL MODAL ───────────────────────────────────
// Props:
//   inv      – either a single investment object OR
//              { scrip, investments: [...] } for a group
//   onEdit   – called with a single investment to open edit form
//   onDelete – called with inv.id
//   onClose  – dismiss the modal

export function InvDetailModal({ inv, onEdit, onDelete, onClose }) {
  const isGroup = Array.isArray(inv?.investments);
  const entries = isGroup ? inv.investments : [inv];

  const [selectedId, setSelectedId] = useState(entries[0]?.id || null);
  const selected = entries.find(i => i.id === selectedId) || entries[0] || null;

  // For single entry, derive P&L directly
  const singleIsSold = !isGroup && !!inv.soldDate;
  const singleD      = !isGroup ? holdDays(inv.boughtDate, inv.soldDate) : null;
  const singleDuration = !isGroup ? formatHoldingDuration(inv.boughtDate, inv.soldDate) : null;
  const singlePL     = singleIsSold ? inv.soldAmt - inv.buyAmt : null;
  const singlePos    = singlePL != null ? singlePL >= 0 : null;

  // For group, compute total P&L across sold entries
  const groupTotalPL = isGroup
    ? entries.reduce((sum, i) => i.soldDate ? sum + (i.soldAmt - i.buyAmt) : sum, 0)
    : null;
  const groupTotalBuyAmt = isGroup
    ? entries.reduce((sum, i) => i.soldDate ? sum + (i.buyAmt || 0) : sum, 0)
    : null;
  const groupPctRet = isGroup && groupTotalBuyAmt
    ? ((groupTotalPL / groupTotalBuyAmt) * 100).toFixed(2)
    : null;
  const groupAnn = isGroup ? groupAnnG(entries) : null;
  const groupMon = isGroup ? groupMonG(entries) : null;
  const groupPos = groupTotalPL != null ? groupTotalPL >= 0 : null;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="modal__header">
          <div>
            <div className="modal__scrip">{isGroup ? inv.scrip : inv.scrip}</div>
            <div className="modal__tid">
              {isGroup ? `Investment Group · ${entries.length} entries` : "Investment Detail"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!isGroup && (
              <span className={singleIsSold ? "status-badge sb--sold" : "status-badge sb--holding"}>
                {singleIsSold ? "✓ SOLD" : "⬤ HOLDING"}
              </span>
            )}
            <button className="modal__close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal__divider" />

        {/* ══ GROUP VIEW ══ */}
        {isGroup && (
          <>
            {/* Group summary banner */}
            <div className={`pl-footer ${groupPos ? "pl-footer--profit" : "pl-footer--loss"}`}
              style={{ marginBottom: 14 }}>
              <span className="pl-footer__emoji">📊</span>
              <div>
                <div className={`pl-footer__label pl-footer__label--${groupPos ? "profit" : "loss"}`}>
                  {entries.length} entries under {inv.scrip}
                </div>
                <div className="pl-footer__sub pl-footer__sub--metrics">
                  <span className="pl-footer__metric">
                    Total Realised P&amp;L: <strong>{groupTotalPL !== 0 ? `${groupPos ? "+" : "-"}रु${fmt(Math.abs(groupTotalPL))}` : "—"}</strong>
                  </span>
                  {groupPctRet && (
                    <span className="pl-footer__metric pl-footer__metric--percent">
                      <strong>{groupPos ? "+" : ""}{groupPctRet}%</strong>
                    </span>
                  )}
                  {groupAnn && (
                    <span className={`pl-footer__metric ${groupPos ? "v--profit" : "v--loss"}`}>
                      <strong>Avg Annual: {groupPos ? "+" : ""}{groupAnn}%</strong>
                    </span>
                  )}
                  {groupMon && (
                    <span className={`pl-footer__metric ${groupPos ? "v--profit" : "v--loss"}`}>
                      <strong>Avg Monthly: {groupPos ? "+" : ""}{groupMon}%</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 12, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
              Select a row below, then use the buttons at the bottom to edit or delete that entry.
            </div>

            {/* Selectable rows table */}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {["Qty","Buy Rate","Bought Date","Bought Amt","Sold Rate","Sold Date","Sold Amt","Holding Days","LTP","Value as of LTP","Status"].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map(i => {
                    const isSold   = !!i.soldDate;
                    const dLabel   = formatHoldingDuration(i.boughtDate, i.soldDate);
                    const ltp      = Number(i.ltp || 0) || 0;
                    const valueAsOfLtp = ltp * Number(i.qty || 0);
                    const ltpClass = !isSold && ltp > Number(i.buyRate || 0) ? "td--profit" : !isSold && ltp < Number(i.buyRate || 0) ? "td--loss" : "";
                    const valueClass = !isSold && valueAsOfLtp > Number(i.buyAmt || 0) ? "td--profit" : !isSold && valueAsOfLtp < Number(i.buyAmt || 0) ? "td--loss" : "";
                    const isActive = selected?.id === i.id;
                    return (
                      <tr
                        key={i.id}
                        className={isActive ? "inv-selected-row" : ""}
                        onClick={() => setSelectedId(i.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <td>{i.qty}</td>
                        <td className="td--mono">रु{fmt(i.buyRate)}</td>
                        <td className="td--mono">{i.boughtDate}</td>
                        <td className="td--mono">रु{fmt(i.buyAmt)}</td>
                        <td className="td--mono">
                          {i.soldRate ? `रु${fmt(i.soldRate)}` : <span className="td--muted">—</span>}
                        </td>
                        <td className="td--mono">{i.soldDate || <span className="td--muted">—</span>}</td>
                        <td className={i.soldAmt
                          ? (i.soldAmt >= i.buyAmt ? "td--profit" : "td--loss")
                          : "td--muted"}>
                          {i.soldAmt ? `रु${fmt(i.soldAmt)}` : "—"}
                        </td>
                        <td className="td--mono inv-days">{dLabel}</td>
                        <td className={`td--mono ${ltpClass}`}>{!isSold && ltp ? `रु${fmt(ltp)}` : "—"}</td>
                        <td className={`td--mono ${valueClass}`}>{!isSold ? `रु${fmt(valueAsOfLtp)}` : "—"}</td>
                        <td>
                          {isSold
                            ? <span className="status-badge sb--sold">✓ Sold</span>
                            : <span className="status-badge sb--holding">⬤ Holding</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ══ SINGLE VIEW ══ */}
        {!isGroup && (
          <>
            {/* P&L block — only when sold */}
            {singleIsSold && singlePL != null && (
              <div className={`inv-pl-block ${singlePos ? "inv-pl-block--profit" : "inv-pl-block--loss"}`}>
                <div className="inv-pl-left">
                  <span style={{ fontSize: 28 }}>{singlePos ? "📈" : "📉"}</span>
                  <div>
                    <div className={`inv-pl__big ${singlePos ? "inv-pl__big--p" : "inv-pl__big--l"}`}>
                      {singlePos ? "+" : "-"}रु{fmt(Math.abs(singlePL))}
                    </div>
                    <div className="inv-pl__sub">
                      {singlePos ? "Profit" : "Loss"} · {pctRet(singlePL, inv.buyAmt)} return
                    </div>
                  </div>
                </div>
                <div className="gain-chips">
                  {annG(singlePL, inv.buyAmt, singleD) && (
                    <div className="gain-chip">
                      <span className="gain-chip__lbl">Avg Annual</span>
                      <span className={`gain-chip__val ${singlePos ? "v--profit" : "v--loss"}`}>
                        {singlePos ? "+" : ""}{annG(singlePL, inv.buyAmt, singleD)}%
                      </span>
                    </div>
                  )}
                  {monG(singlePL, inv.buyAmt, singleD) && (
                    <div className="gain-chip">
                      <span className="gain-chip__lbl">Avg Monthly</span>
                      <span className={`gain-chip__val ${singlePos ? "v--profit" : "v--loss"}`}>
                        {singlePos ? "+" : ""}{monG(singlePL, inv.buyAmt, singleD)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Still-holding banner */}
            {!singleIsSold && (
              <div className="inv-holding">
                <span style={{ fontSize: 18 }}>🕐</span>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--acc)", fontSize: 13 }}>Still Holding</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)", marginTop: 2 }}>
                    Position open · {singleDuration} held so far
                  </div>
                </div>
              </div>
            )}

            <div className="inv-section-label">Position Details</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {["Quantity","Buy Rate","Sold Rate","Bought Date","Sold Date","Bought Amt","Sold Amt","Holding Days","LTP","Value as of LTP"].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{inv.qty}</td>
                    <td className="td--mono">रु{fmt(inv.buyRate)}</td>
                    <td className="td--mono">
                      {inv.soldRate ? `रु${fmt(inv.soldRate)}` : <span className="td--muted">—</span>}
                    </td>
                    <td className="td--mono">{inv.boughtDate}</td>
                    <td className="td--mono">{inv.soldDate || <span className="td--muted">—</span>}</td>
                    <td className="td--mono">रु{fmt(inv.buyAmt)}</td>
                    <td className={inv.soldAmt
                      ? (inv.soldAmt >= inv.buyAmt ? "td--profit" : "td--loss")
                      : "td--muted"}>
                      {inv.soldAmt ? `रु${fmt(inv.soldAmt)}` : "—"}
                    </td>
                    <td className="td--mono">{singleDuration}</td>
                    <td className={`td--mono ${Number(inv.ltp || 0) > Number(inv.buyRate || 0) ? "td--profit" : Number(inv.ltp || 0) < Number(inv.buyRate || 0) ? "td--loss" : ""}`}>{Number(inv.ltp || 0) ? `रु${fmt(inv.ltp)}` : "—"}</td>
                    <td className={`td--mono ${(Number(inv.ltp || 0) * Number(inv.qty || 0)) > Number(inv.buyAmt || 0) ? "td--profit" : (Number(inv.ltp || 0) * Number(inv.qty || 0)) < Number(inv.buyAmt || 0) ? "td--loss" : ""}`}>{inv.soldDate ? "—" : `रु${fmt(Number(inv.ltp || 0) * Number(inv.qty || 0))}`}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {inv.remarks && (
              <div className="inv-remarks">
                <span style={{ fontSize: 14 }}>💬</span>
                <span className="inv-remarks__text">{inv.remarks}</span>
              </div>
            )}
          </>
        )}

        {/* ── Actions ── */}
        <div className="modal__actions">
          <button
            className="btn btn--danger"
            disabled={!selected}
            onClick={() => { if (selected) { onDelete(selected.id); onClose(); } }}
          >
            🗑 Delete
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn--ghost" onClick={onClose}>Close</button>
          <button
            className="btn btn--edit"
            disabled={!selected}
            onClick={() => { if (selected) { onClose(); onEdit(selected); } }}
          >
            ✏ Edit
          </button>
        </div>

      </div>
    </div>
  );
}
