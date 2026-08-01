import { useState } from "react";
import { fmt, pctRet, formatHoldingDuration, tradePL } from "../utils/helpers";
import "../styles/modals.css";

// -- TRADE DETAIL MODAL ------------------------------------------------
// Props:
//   trade    – trade object to display
//   onEdit   – called with the trade to open edit form
//   onDelete – called with trade.id
//   onClose  – dismiss the modal

export function TradeDetailModal({ trade, onEdit, onDelete, onClose }) {
  const isGroup = Array.isArray(trade?.trades);
  const trades = isGroup ? trade.trades : [trade];
  const [selectedId, setSelectedId] = useState(trades[0]?.id || null);
  const selectedTrade = trades.find(t => t.id === selectedId) || trades[0] || null;
  const totalPL = trades.reduce((sum, t) => sum + (tradePL(t) || 0), 0);
  const totalBuyAmt = trades.reduce((sum, t) => sum + (Number(t.buyAmt) || 0), 0);
  const totalPctRet = totalBuyAmt ? ((totalPL / totalBuyAmt) * 100).toFixed(2) : null;
  const pos = totalPL >= 0;
  const firstTrade = trades[0] || {};
  const hdLabel = !isGroup ? formatHoldingDuration(firstTrade.boughtDate, firstTrade.soldDate) : null;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <div className="modal__scrip">{firstTrade.scrip || trade.scrip}</div>
            <div className="modal__tid">{isGroup ? `Trade Group · ${trade.tsn}` : `Trade ID · ${trade.tsn}`}</div>
          </div>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__divider" />

                {isGroup ? (
          <>
            <div className={`pl-footer ${pos ? "pl-footer--profit" : "pl-footer--loss"}`}>
              <span className="pl-footer__emoji">📊</span>
              <div>
                <div className={`pl-footer__label pl-footer__label--${pos ? "profit" : "loss"}`}>
                  {trades.length} trades under the same TSN
                </div>
                <div className="pl-footer__sub" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Total P&L: {pos ? "+" : "-"}रु{fmt(Math.abs(totalPL))}</span>
                  {totalPctRet && (
                    <span style={{ marginLeft: 16, fontWeight: 600, color: "var(--acc)" }}>
                      {pos ? "+" : ""}{totalPctRet}%
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 16, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
              Select one trade row below, then use the buttons at the bottom to edit or delete that trade.
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {['Quantity','Bought Date','Sold Date','R-R','Remarks','Holding Days','LTP','Value as of LTP','P&L'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trades.map(t => {
                    const plRow = tradePL(t);
                    const posRow = plRow != null ? plRow >= 0 : null;
                    const hdLabel = formatHoldingDuration(t.boughtDate, t.soldDate);
                    const isSoldRow = Boolean(t.soldDate || Number(t.sellRate) > 0 || Number(t.soldAmt) > 0);
                    const ltpRow = Number(t.ltp || 0) || 0;
                    const valueRow = ltpRow * Number(t.qty || 0);
                    const ltpClass = !isSoldRow && ltpRow > Number(t.buyRate || 0) ? "td--profit" : !isSoldRow && ltpRow < Number(t.buyRate || 0) ? "td--loss" : "";
                    const valueClass = !isSoldRow && valueRow > Number(t.buyAmt || 0) ? "td--profit" : !isSoldRow && valueRow < Number(t.buyAmt || 0) ? "td--loss" : "";
                    const selected = selectedTrade?.id === t.id;
                    return (
                      <tr
                        key={t.id}
                        className={selected ? "selected-row" : ""}
                        onClick={() => setSelectedId(t.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <td>{t.qty}</td>
                        <td className="td--mono">{t.boughtDate || "—"}</td>
                        <td className="td--mono">{t.soldDate || "—"}</td>
                        <td><span className="rr-badge">{t.rr || "—"}</span></td>
                        <td className="td--subtle">{t.remarks || "—"}</td>
                        <td className="td--mono">{hdLabel}</td>
                        <td className={`td--mono ${ltpClass}`}>{!isSoldRow && ltpRow ? `रु${fmt(ltpRow)}` : "—"}</td>
                        <td className={`td--mono ${valueClass}`}>{!isSoldRow ? `रु${fmt(valueRow)}` : "—"}</td>
                        <td className={plRow != null ? (posRow ? "td--profit" : "td--loss") : "td--empty"}>
                          {plRow != null ? `${posRow ? "+" : "-"}रु${fmt(Math.abs(plRow))}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {['Quantity','Bought Date','Sold Date','R-R','Remarks','Holding Days','LTP','Value as of LTP','P&L'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{firstTrade.qty}</td>
                  <td className="td--mono">{firstTrade.boughtDate || "—"}</td>
                  <td className="td--mono">{firstTrade.soldDate || "—"}</td>
                  <td><span className="rr-badge">{firstTrade.rr || "—"}</span></td>
                  <td className="td--subtle">{firstTrade.remarks || "—"}</td>
                  <td className="td--mono">{hdLabel}</td>
                  <td className={`td--mono ${Number(firstTrade.ltp || 0) > Number(firstTrade.buyRate || 0) ? "td--profit" : Number(firstTrade.ltp || 0) < Number(firstTrade.buyRate || 0) ? "td--loss" : ""}`}>{Number(firstTrade.ltp || 0) ? `रु${fmt(firstTrade.ltp)}` : "—"}</td>
                  <td className={`td--mono ${(Number(firstTrade.ltp || 0) * Number(firstTrade.qty || 0)) > Number(firstTrade.buyAmt || 0) ? "td--profit" : (Number(firstTrade.ltp || 0) * Number(firstTrade.qty || 0)) < Number(firstTrade.buyAmt || 0) ? "td--loss" : ""}`}>{(firstTrade.soldDate || Number(firstTrade.sellRate) > 0) ? "—" : `रु${fmt(Number(firstTrade.ltp || 0) * Number(firstTrade.qty || 0))}`}</td>
                  <td className={totalPL != null ? (pos ? "td--profit" : "td--loss") : "td--empty"}>
                    {totalPL != null ? `${pos ? "+" : "-"}रु${fmt(Math.abs(totalPL))}` : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {!isGroup && totalPL != null && (
          <div className={`pl-footer ${pos ? "pl-footer--profit" : "pl-footer--loss"}`}>
            <span className="pl-footer__emoji">{pos ? "📈" : "📉"}</span>
            <div>
              <div className={`pl-footer__label pl-footer__label--${pos ? "profit" : "loss"}`}>
                {pos ? "Profitable Trade" : "Loss Trade"}
              </div>
              <div className="pl-footer__sub">
                Return: {pctRet(totalPL, firstTrade.buyAmt)} · Invested रु{fmt(firstTrade.buyAmt)}
              </div>
            </div>
          </div>
        )}

        <div className="modal__actions">
          <button
            className="btn btn--danger"
            disabled={!selectedTrade}
            onClick={() => {
              if (!selectedTrade) return;
              onDelete(selectedTrade.id);
              onClose();
            }}
          >
            🗑 Delete
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn--ghost" onClick={onClose}>Close</button>
          <button
            className="btn btn--edit"
            disabled={!selectedTrade}
            onClick={() => {
              if (!selectedTrade) return;
              onClose();
              onEdit(selectedTrade);
            }}
          >
            ✏ Edit
          </button>
        </div>
      </div>
    </div>
  );
}
