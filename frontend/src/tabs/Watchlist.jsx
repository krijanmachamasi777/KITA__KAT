import { fmt, secBadge } from "../utils/helpers";
import "../styles/watchlist.css";

// ── WATCHLIST TAB ─────────────────────────────────────────
// Props:
//   watchlist  – array of watchlist item objects
//   onEdit     – called with item to open edit form
//   onDelete   – called with item id

export function Watchlist({ watchlist, onEdit, onDelete }) {
  return (
    <div className="card--np">
      <div className="card__header">
        <div>
          <div className="card__title">Watchlist</div>
          <div className="card__sub">Click ✏ to edit · 🗑 to remove · or use button below to add</div>
        </div>
        <span className="card__count">{watchlist.length} stocks</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>SN</th>
              <th>SCRIP</th>
              <th>Sector</th>
              <th>Breakout</th>
              <th>Support</th>
              <th>Resistance</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {watchlist.length === 0 && (
              <tr>
                <td colSpan={8} className="td--empty">No stocks on watchlist yet</td>
              </tr>
            )}
            {watchlist.map((w, i) => (
              <tr key={w.id}>
                <td className="td--muted">{i + 1}</td>
                <td className="td--bold">{w.scrip}</td>
                <td>
                  <span className={secBadge(w.sector)}>{w.sector || "—"}</span>
                </td>
                <td className="watch-level">
                  {w.breakout ? `रु${fmt(w.breakout)}` : "—"}
                </td>
                <td className="watch-support">
                  {w.support ? `रु${fmt(w.support)}` : "—"}
                </td>
                <td className="watch-resistance">
                  {w.resistance ? `रु${fmt(w.resistance)}` : "—"}
                </td>
                <td className="watch-notes td--subtle">
                  {w.notes}
                </td>
                <td className="watch-actions">
                  <button
                    className="icon-btn"
                    title="Edit"
                    onClick={() => onEdit(w)}
                  >✏</button>
                  <button
                    className="icon-btn icon-btn--del"
                    title="Delete"
                    onClick={() => onDelete(w.id)}
                  >🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}