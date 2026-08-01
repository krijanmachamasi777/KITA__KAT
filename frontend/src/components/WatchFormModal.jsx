import { useState } from "react";
import { FG } from "./FG";
import { SECTORS } from "../utils/helpers";
import "../styles/modals.css";

// ── WATCHLIST FORM MODAL ──────────────────────────────────
// Props:
//   mode    – "add" | "edit"
//   init    – initial field values (for edit)
//   onSave  – called with the completed watchlist item
//   onClose – dismiss the modal

export function WatchFormModal({ mode, init = {}, onSave, onClose }) {
  const blank = { scrip: "", sector: "", breakout: "", support: "", resistance: "", notes: "" };
  const [f, setF] = useState({ ...blank, ...init });

  const upd  = (k, v) => setF(p => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.scrip.trim()) return;
    onSave({
      ...f,
      breakout:   Number(f.breakout)   || 0,
      support:    Number(f.support)    || 0,
      resistance: Number(f.resistance) || 0,
    });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal--form" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <div className="modal__scrip">
              {mode === "add" ? "Add to Watchlist" : "Edit Watchlist"}
            </div>
          </div>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__divider" />

        <div className="form-grid">
          <FG label="SCRIP *">
            <input className="f-input" value={f.scrip}
              onChange={e => upd("scrip", e.target.value.toUpperCase())}
              placeholder="e.g. NABIL" />
          </FG>
          <FG label="Sector">
            <input className="f-input" list="sec-list" value={f.sector}
              onChange={e => upd("sector", e.target.value)}
              placeholder="Select or type…" />
            <datalist id="sec-list">
              {SECTORS.map(s => <option key={s} value={s} />)}
            </datalist>
          </FG>
          <FG label="Breakout Level">
            <input className="f-input" type="number" value={f.breakout}
              onChange={e => upd("breakout", e.target.value)} placeholder="e.g. 6500" />
          </FG>
          <FG label="Support">
            <input className="f-input" type="number" value={f.support}
              onChange={e => upd("support", e.target.value)} placeholder="e.g. 6200" />
          </FG>
          <FG label="Resistance">
            <input className="f-input" type="number" value={f.resistance}
              onChange={e => upd("resistance", e.target.value)} placeholder="e.g. 7000" />
          </FG>
          <div />
          <FG label="Notes" full>
            <textarea className="f-textarea" value={f.notes}
              onChange={e => upd("notes", e.target.value)}
              placeholder="Add notes about this stock…" />
          </FG>
        </div>

        <div className="form-actions">
          <button className="btn btn--ghost"   onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save}>
            {mode === "add" ? "Add to Watchlist" : "Update"}
          </button>
        </div>
      </div>
    </div>
  );
}