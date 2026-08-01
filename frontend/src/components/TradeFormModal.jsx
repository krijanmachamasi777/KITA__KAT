import { useState } from "react";
import { FG } from "./FG";
import { RR_OPTS, todayStr } from "../utils/helpers";
import "../styles/modals.css";

// ── TRADE FORM MODAL ──────────────────────────────────────
// Props:
//   mode    – "add" | "edit"
//   init    – initial field values (for edit)
//   onSave  – called with the completed trade object
//   onClose – dismiss the modal

export function TradeFormModal({ mode, init = {}, onSave, onClose }) {
  const blank = {
    scrip: "", qty: "", buyRate: "", sellRate: "",
    buyAmt: "", soldAmt: "", ltp: "", valueAsOfLtp: "",
    boughtDate: todayStr(), soldDate: "", rr: "1:2", remarks: "",
  };
  const [f, setF] = useState({ ...blank, ...init });

  const upd = (k, v) =>
    setF(p => {
      const n = { ...p, [k]: v };
      const q = Number(k === "qty" ? v : p.qty) || 0;
      if (k === "qty" || k === "buyRate") {
        const br = Number(k === "buyRate" ? v : p.buyRate) || 0;
        if (q && br) n.buyAmt = q * br;
      }
      if (k === "qty" || k === "ltp") {
        const ltp = Number(k === "ltp" ? v : p.ltp) || 0;
        n.valueAsOfLtp = q * ltp;
      }
      if (k === "qty" || k === "sellRate") {
        const sr = Number(k === "sellRate" ? v : p.sellRate) || 0;
        if (q && sr) n.soldAmt = q * sr;
      }
      return n;
    });

  const save = () => {
    if (!f.scrip.trim()) return;
    onSave({
      ...f,
      qty:      Number(f.qty)      || 0,
      buyRate:       Number(f.buyRate)       || 0,
      sellRate:      Number(f.sellRate)      || 0,
      buyAmt:        Number(f.buyAmt)        || 0,
      soldAmt:       Number(f.soldAmt)       || 0,
      ltp:           Number(f.ltp)           || 0,
      valueAsOfLtp:  Number(f.valueAsOfLtp)  || 0,
    });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal--form" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <div className="modal__scrip">
              {mode === "add" ? "Log New Trade" : "Edit Trade"}
            </div>
          </div>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__divider" />

        <div className="form-grid">
          <FG label="SCRIP *">
            <input className="f-input" value={f.scrip}
              onChange={e => upd("scrip", e.target.value.toUpperCase())}
              placeholder="e.g. RELIANCE" />
          </FG>
          <FG label="Quantity">
            <input className="f-input" type="number" value={f.qty}
              onChange={e => upd("qty", e.target.value)} placeholder="e.g. 10" />
          </FG>
          <FG label="Buy Rate">
            <input className="f-input" type="number" value={f.buyRate}
              onChange={e => upd("buyRate", e.target.value)} placeholder="e.g. 2400" />
          </FG>
          <FG label="Sold Rate">
            <input className="f-input" type="number" value={f.sellRate}
              onChange={e => upd("sellRate", e.target.value)} placeholder="e.g. 2650" />
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
          <FG label="R:R Ratio">
            <select className="f-select" value={f.rr}
              onChange={e => upd("rr", e.target.value)}>
              {RR_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </FG>
          <FG label="Remarks" full>
            <textarea className="f-textarea" value={f.remarks}
              onChange={e => upd("remarks", e.target.value)}
              placeholder="Notes on this trade…" />
          </FG>
        </div>

        <div className="form-actions">
          <button className="btn btn--ghost"   onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save}>
            {mode === "add" ? "Save Trade" : "Update Trade"}
          </button>
        </div>
      </div>
    </div>
  );
}