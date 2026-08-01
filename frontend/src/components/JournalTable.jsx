import { fmt, isClosedTrade, tradePL } from "../utils/helpers";

// ── JOURNAL TABLE ─────────────────────────────────────────
// Shared between Journal tab and Losing tab.
// Props:
//   trades       – array of trade objects
//   onScripClick – called with the trade when scrip button is clicked

export function JournalTable({ trades, onScripClick }) {
  let lastGroupKey = null;
  let groupSN = 0; // increments once per unique (TSN + SCRIP) group

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>SN</th>
            <th>TSN</th>
            <th>SCRIPT</th>
            <th>Quantity</th>
            <th>Buy Rate</th>
            <th>Sell Rate</th>
            <th>Buy Amount</th>
            <th>Sold Amount</th>
            <th>LTP</th>
            <th>Value as of LTP</th>
            <th>P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {trades.length === 0 && (
            <tr>
              <td colSpan={11} className="td--empty">No trades found</td>
            </tr>
          )}
          {trades.map((t) => {
            const pl       = tradePL(t);
            const pos      = pl != null ? pl >= 0 : null;
            const isSold   = isClosedTrade(t);
            const ltp      = Number(t.ltp || 0) || 0;
            const valueAsOfLtp = ltp * Number(t.qty || 0);
            const ltpClass = !isSold && ltp > Number(t.buyRate || 0) ? "td--profit" : !isSold && ltp < Number(t.buyRate || 0) ? "td--loss" : "";
            const valueClass = !isSold && valueAsOfLtp > Number(t.buyAmt || 0) ? "td--profit" : !isSold && valueAsOfLtp < Number(t.buyAmt || 0) ? "td--loss" : "";
            const groupKey = `${(t.tsn || "").toUpperCase()}|${(t.scrip || "").toUpperCase()}`;
            const showGroup = groupKey !== lastGroupKey;
            const tsn      = t.tsn;

            if (showGroup) groupSN++;
            const currentSN = groupSN;

            let onClick = null;
            if (showGroup) {
              const groupTrades = trades.filter(item => `${(item.tsn || "").toUpperCase()}|${(item.scrip || "").toUpperCase()}` === groupKey);
              onClick = () => onScripClick({ tsn, scrip: t.scrip, trades: groupTrades });
            }
            lastGroupKey = groupKey;

            return (
              <tr key={t.id} className={isSold ? "tr--sold" : ""}>
                {/* SN — only on first row of each TSN group */}
                <td className="td--mono td--muted">{showGroup ? currentSN : ""}</td>

                {/* TSN */}
                <td className="td--mono">{showGroup ? tsn : ""}</td>

                {/* SCRIP — clickable button on first row of group */}
                <td>
                  {showGroup ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button className="scrip-btn" onClick={onClick}>
                        {t.scrip}
                      </button>
                      {t.imported && (
                        <span className="badge badge--small" title="Imported from MeroShare"> </span>
                      )}
                      {isSold && (
                        <span className="badge badge--sold" title="This trade has been sold">✓ SOLD</span>
                      )}
                    </div>
                  ) : null}
                </td>

                {/* Trade row data */}
                <td>{t.qty}</td>
                <td className="td--mono">रु{fmt(t.buyRate)}</td>
                <td className="td--mono">{isClosedTrade(t) ? `रु${fmt(t.sellRate)}` : "—"}</td>
                <td className="td--mono">रु{fmt(t.buyAmt)}</td>
                <td className="td--mono">{isClosedTrade(t) ? `रु${fmt(t.soldAmt)}` : "—"}</td>
                <td className={`td--mono ${ltpClass}`}>{!isSold && ltp ? `रु${fmt(ltp)}` : ""}</td>
                <td className={`td--mono ${valueClass}`}>{!isSold ? `रु${fmt(valueAsOfLtp)}` : ""}</td>
                <td className={pl != null ? (pos ? "td--profit" : "td--loss") : "td--empty"}>
                  {pl != null ? `${pos ? "+" : "-"}रु${fmt(Math.abs(pl))}` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}