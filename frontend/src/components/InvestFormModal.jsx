import { useState } from "react";
import { FG } from "./FG";
import { SECTORS, todayStr } from "../utils/helpers";
import "../styles/modals.css";

// ── INVEST FORM MODAL ─────────────────────────────────────
// Props:
//   mode    – "add" | "edit"
//   init    – initial field values (for edit)
//   onSave  – called with the completed investment object
//   onClose – dismiss the modal

export function InvestFormModal({ mode, init = {}, onSave, onClose }) {
  const blank = {
    scrip: "", sector: "", qty: "", buyRate: "", soldRate: "",
    buyAmt: "", soldAmt: "", ltp: "", valueAsOfLtp: "",
    boughtDate: todayStr(), soldDate: "", remarks: "",
  };
  const [f, setF] = useState({ ...blank, ...init, soldRate: init.soldRate || "" });

  const upd = (k, v) =>
    setF(p => {
      const n = { ...p, [k]: v };
      const q = Number(k === "qty" ? v : p.qty) || 0;
      if (k === "qty" || k === "buyRate") {
        const br = Number(k === "buyRate" ? v : p.buyRate) || 0;
        if (q && br) n.buyAmt = q * br;
      }
      if (k === "qty" || k === "soldRate") {
        const sr = Number(k === "soldRate" ? v : p.soldRate) || 0;
        if (q && sr) n.soldAmt = q * sr;
      }
      if (k === "qty" || k === "ltp") {
        const ltp = Number(k === "ltp" ? v : p.ltp) || 0;
        n.valueAsOfLtp = q * ltp;
      }
      return n;
    });

  const save = () => {
    if (!f.scrip.trim()) return;
    onSave({
      ...f,
      qty:      Number(f.qty)     || 0,
      buyRate:  Number(f.buyRate) || 0,
      soldRate: f.soldRate ? Number(f.soldRate) : null,
      buyAmt:      Number(f.buyAmt)      || 0,
      soldAmt:     f.soldAmt ? Number(f.soldAmt) : null,
      ltp:         Number(f.ltp)         || 0,
      valueAsOfLtp: Number(f.valueAsOfLtp) || 0,
      soldDate:    f.soldDate || null,
    });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal--form" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <div className="modal__scrip">
              {mode === "add" ? "Add Investment" : "Edit Investment"}
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
          <FG label="Quantity">
            <input className="f-input" type="number" value={f.qty}
              onChange={e => upd("qty", e.target.value)} placeholder="e.g. 100" />
          </FG>
          <FG label="Buy Rate">
            <input className="f-input" type="number" value={f.buyRate}
              onChange={e => upd("buyRate", e.target.value)} placeholder="e.g. 2400" />
          </FG>
          <FG label="Sold Rate (if sold)">
            <input className="f-input" type="number" value={f.soldRate}
              onChange={e => upd("soldRate", e.target.value)}
              placeholder="Leave blank if holding" />
          </FG>
          <FG label="Bought Amount">
            <input className="f-input" type="number" value={f.buyAmt}
              onChange={e => upd("buyAmt", e.target.value)} placeholder="auto-calculated" />
          </FG>
          <FG label="LTP">
            <input className="f-input" type="number" value={f.ltp}
              onChange={e => upd("ltp", e.target.value)} placeholder="e.g. 2680" />
          </FG>
          <FG label="Value as of LTP">
            <input className="f-input" type="number" value={f.valueAsOfLtp}
              onChange={e => upd("valueAsOfLtp", e.target.value)} placeholder="auto-calculated" />
          </FG>
          <FG label="Sold Amount">
            <input className="f-input" type="number" value={f.soldAmt}
              onChange={e => upd("soldAmt", e.target.value)} placeholder="auto-calculated" />
          </FG>
          <FG label="Bought Date">
            <input className="f-input" type="date" value={f.boughtDate}
              onChange={e => upd("boughtDate", e.target.value)} />
          </FG>
          <FG label="Sold Date">
            <input className="f-input" type="date" value={f.soldDate}
              onChange={e => upd("soldDate", e.target.value)} />
          </FG>
          <FG label="Remarks" full>
            <textarea className="f-textarea" value={f.remarks}
              onChange={e => upd("remarks", e.target.value)}
              placeholder="Notes on this investment…" />
          </FG>
        </div>

        <div className="form-actions">
          <button className="btn btn--ghost"   onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save}>
            {mode === "add" ? "Save Investment" : "Update Investment"}
          </button>
        </div>
      </div>
    </div>
  );
}