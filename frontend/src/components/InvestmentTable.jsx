import { fmt, formatHoldingDuration } from "../utils/helpers";

// ── INVESTMENT TABLE ──────────────────────────────────────
// Shared between the Investment tab and the Investment History modal.
// Props:
//   investments  – array of investment objects to render
//   onScripClick – called with the investment (or group) when the
//                  scrip button is clicked
//
// Grouping rules (unchanged from the original Investment tab):
//   • Sort all entries by boughtDate asc (primary), scrip asc (tie-break)
//   • Group entries of the same scrip where boughtDate falls within
//     365 days of the group's FIRST entry date → share the same SN
//   • If the same scrip is bought again more than 365 days after the
//     group's first entry, it opens a NEW group with a new SN
//   • SN is sequential across all groups in display order
//   • Only the first row of a group shows: SN, SCRIP button, Sector

export function InvestmentTable({ investments, onScripClick }) {
  // ── Step 1: sort by boughtDate asc, then scrip asc ──────
  const sorted = [...investments].sort((a, b) => {
    const dc = (a.boughtDate || "").localeCompare(b.boughtDate || "");
    return dc || (a.scrip || "").localeCompare(b.scrip || "");
  });

  // ── Step 2: assign a groupId to each entry ──────────────
  const anchorMap = {};   // scrip → current anchor date string
  let snCounter   = 0;
  const snMap     = {};   // groupKey → SN number
  const groupKeys = [];   // parallel to sorted

  sorted.forEach(inv => {
    const scrip   = (inv.scrip || "").trim().toUpperCase();
    const dateStr = inv.boughtDate || "";
    const anchor  = anchorMap[scrip];

    let groupKey;
    if (!anchor) {
      anchorMap[scrip] = dateStr;
      groupKey = `${scrip}__${dateStr}`;
    } else {
      const daysDiff = Math.round(
        (new Date(dateStr) - new Date(anchor)) / 86400000
      );
      if (daysDiff <= 365) {
        groupKey = `${scrip}__${anchor}`;
      } else {
        anchorMap[scrip] = dateStr;
        groupKey = `${scrip}__${dateStr}`;
      }
    }

    if (!(groupKey in snMap)) snMap[groupKey] = ++snCounter;
    groupKeys.push(groupKey);
  });

  // ── Step 3: render ──────────────────────────────────────
  let prevGroupKey = null;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>SN</th>
            <th>SCRIPT</th>
            <th>Sector</th>
            <th>Quantity</th>
            <th>Buy Rate</th>
            <th>Bought Date</th>
            <th>Bought Amount</th>
            <th>Holding Days</th>
            <th>LTP</th>
            <th>Value as of LTP</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={9} className="td--empty">No investments found</td>
            </tr>
          )}
          {sorted.map((inv, idx) => {
            const groupKey   = groupKeys[idx];
            const isNewGroup = groupKey !== prevGroupKey;
            prevGroupKey     = groupKey;

            const isSold = !!inv.soldDate;
            const durationText = formatHoldingDuration(inv.boughtDate, inv.soldDate);
            const ltp = Number(inv.ltp || 0) || 0;
            const valueAsOfLtp = Number((ltp * Number(inv.qty || 0))) || 0;
            const ltpClass = !isSold && ltp > Number(inv.buyRate || 0) ? "td--profit" : !isSold && ltp < Number(inv.buyRate || 0) ? "td--loss" : "";
            const valueClass = !isSold && valueAsOfLtp > Number(inv.buyAmt || 0) ? "td--profit" : !isSold && valueAsOfLtp < Number(inv.buyAmt || 0) ? "td--loss" : "";
            const sn = snMap[groupKey];

            const handleScripClick = isNewGroup
              ? () => {
                  const groupInvs = sorted.filter(
                    (_, i) => groupKeys[i] === groupKey
                  );
                  if (groupInvs.length === 1) {
                    onScripClick(groupInvs[0]);
                  } else {
                    onScripClick({ scrip: inv.scrip, investments: groupInvs });
                  }
                }
              : undefined;

            return (
              <tr
                key={inv.id}
                className={[
                  isNewGroup ? "inv-row--group-start" : "inv-row--group-cont",
                  isSold ? "tr--sold" : "",
                ].filter(Boolean).join(" ")}
              >
                <td className="td--muted">{isNewGroup ? sn : ""}</td>
                <td>
                  {isNewGroup ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button className="scrip-btn" onClick={handleScripClick}>
                        {inv.scrip}
                      </button>
                      {inv.imported && (
                        <span className="badge badge--small" title="Imported from MeroShare"></span>
                      )}
                      {isSold && (
                        <span className="badge badge--sold" title="This investment has been sold">✓ SOLD</span>
                      )}
                    </div>
                  ) : null}
                </td>
                <td>{isNewGroup ? (inv.sector || "—") : ""}</td>
                <td>{inv.qty}</td>
                <td className="td--mono">रु{fmt(inv.buyRate)}</td>
                <td className="td--mono">{inv.boughtDate}</td>
                <td className="td--mono">रु{fmt(inv.buyAmt)}</td>
                <td className="td--mono inv-days">{durationText}</td>
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
  );
}