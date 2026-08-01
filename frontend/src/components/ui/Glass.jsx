// src/components/ui/Glass.jsx
//
// Thin, presentational wrappers over the shared glassmorphism design
// system defined in src/styles/global.css and src/styles/modals.css.
// These don't introduce any new visual language — they just give the
// existing token-driven classes (.card--np, .btn, .f-input, .modal,
// table, .badge …) friendlier, reusable component names for new UI.
//
// Nothing here changes state, data flow, or API calls: every component
// is a plain className wrapper around markup that already renders
// correctly against the design tokens.

export function GlassCard({ title, subtitle, count, actions, className = "", children, noPadding }) {
  return (
    <div className={`card--np ${className}`}>
      {(title || subtitle || count || actions) && (
        <div className="card__header">
          <div>
            {title && <div className="card__title">{title}</div>}
            {subtitle && <div className="card__sub">{subtitle}</div>}
          </div>
          {actions || (count !== undefined && <div className="card__count">{count}</div>)}
        </div>
      )}
      <div style={noPadding ? undefined : { padding: 18 }}>{children}</div>
    </div>
  );
}

const BTN_VARIANTS = {
  primary: "btn--primary",
  ghost:   "btn--ghost",
  danger:  "btn--danger",
  edit:    "btn--edit",
};

export function GlassButton({ variant = "primary", size, className = "", children, ...rest }) {
  const variantClass = BTN_VARIANTS[variant] || BTN_VARIANTS.primary;
  const sizeClass = size === "xs" ? "btn--xs" : "";
  return (
    <button className={`btn ${variantClass} ${sizeClass} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function GlassInput({ label, className = "", ...rest }) {
  return (
    <div className="f-group">
      {label && <label className="f-label">{label}</label>}
      <input className={`f-input ${className}`} {...rest} />
    </div>
  );
}

export function GlassSelect({ label, className = "", children, ...rest }) {
  return (
    <div className="f-group">
      {label && <label className="f-label">{label}</label>}
      <select className={`f-select ${className}`} {...rest}>{children}</select>
    </div>
  );
}

export function GlassModal({ wide, history, onClose, className = "", children }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div
        className={`modal ${wide ? "modal--wide" : "modal--form"} ${history ? "modal--history" : ""} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function GlassBadge({ tone = "default", children, className = "" }) {
  return <span className={`badge badge--${tone} ${className}`}>{children}</span>;
}

export function GlassStatCard({ label, value, sub, className = "" }) {
  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
      {sub && <div className="stat-card__sub">{sub}</div>}
    </div>
  );
}

export function GlassTable({ head = [], children, className = "" }) {
  return (
    <div className="table-wrap">
      <table className={className}>
        {head.length > 0 && (
          <thead>
            <tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr>
          </thead>
        )}
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function GlassEmpty({ icon = "📭", title = "Nothing here yet", sub }) {
  return (
    <div className="kk-empty">
      <div className="kk-empty__icon">{icon}</div>
      <div className="kk-empty__title">{title}</div>
      {sub && <div className="kk-empty__sub">{sub}</div>}
    </div>
  );
}

export function GlassSkeleton({ height = 16, width = "100%", radius = 8, className = "" }) {
  return (
    <div
      className={`kk-skeleton ${className}`}
      style={{ height, width, borderRadius: radius }}
    />
  );
}
