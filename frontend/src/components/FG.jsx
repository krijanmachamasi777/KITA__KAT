// ── FORM GROUP ATOM ───────────────────────────────────────
// Wraps a label + input/select/textarea in a consistent layout block.

export function FG({ label, full, children }) {
  return (
    <div className={`f-group${full ? " form-full" : ""}`}>
      <label className="f-label">{label}</label>
      {children}
    </div>
  );
}