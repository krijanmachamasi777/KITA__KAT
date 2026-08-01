// src/components/NotificationBell.jsx
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

// Only show "ordinary share" IPOs (shareTypeName contains "ordinary" or "ipo")
function isOrdinaryIPO(issue) {
  if (!issue) return false;
  const t = (issue.shareTypeName || "").toLowerCase();
  return t.includes("ordinary") || t.includes("ipo");
}

function formatDate(d) {
  if (!d) return "—";
  return d;
}

export function NotificationBell() {
  const { portfolioData } = useAuth();
  const { issues = [], loaded } = portfolioData;

  const ipoAlerts = issues.filter(isOrdinaryIPO);

  const [open,    setOpen]    = useState(false);
  const [readIds, setReadIds] = useState(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem("notif_read") || "[]")); }
    catch { return new Set(); }
  });

  const panelRef = useRef(null);
  const bellRef  = useRef(null);

  const unreadCount = ipoAlerts.filter(i => !readIds.has(String(i.companyShareId))).length;

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        bellRef.current  && !bellRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggleOpen = () => {
    setOpen(o => {
      if (!o) {
        // Mark all as read when opening
        const newRead = new Set([
          ...readIds,
          ...ipoAlerts.map(i => String(i.companyShareId)),
        ]);
        setReadIds(newRead);
        sessionStorage.setItem("notif_read", JSON.stringify([...newRead]));
      }
      return !o;
    });
  };

  return (
    <div style={{ position: "relative" }}>

      {/* ── Bell button ───────────────────────────────────── */}
      <button
        ref={bellRef}
        onClick={toggleOpen}
        title="IPO Notifications"
        style={{
          position:     "relative",
          background:   open ? "var(--acc-bg)" : "none",
          border:       `1px solid ${open ? "var(--bdr-acc)" : "var(--b)"}`,
          borderRadius: 8,
          padding:      "5px 9px",
          cursor:       "pointer",
          color:        open ? "var(--acc)" : "var(--muted)",
          fontSize:     18,
          lineHeight:   1,
          transition:   "background 0.15s, color 0.15s",
          display:      "flex",
          alignItems:   "center",
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position:       "absolute",
            top:            -4,
            right:          -4,
            background:     "var(--r)",
            color:          "#fff",
            borderRadius:   "50%",
            fontSize:       9,
            fontWeight:     700,
            minWidth:       16,
            height:         16,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            padding:        "0 3px",
            border:         "1.5px solid var(--bg)",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ────────────────────────────────── */}
      {open && (
        <div
          ref={panelRef}
          style={{
            position:     "absolute",
            top:          "calc(100% + 8px)",
            right:        0,
            width:        340,
            maxWidth:     "calc(100vw - 32px)",
            background:   "var(--glass-bg-2)",
            border:       "1px solid var(--b)",
            borderRadius: 14,
            backdropFilter: "blur(var(--blur)) saturate(160%)",
            WebkitBackdropFilter: "blur(var(--blur)) saturate(160%)",
            boxShadow:    "var(--sh-modal)",
            zIndex:       999,
            overflow:     "hidden",
          }}
        >

          {/* Header */}
          <div style={{
            padding:        "12px 16px",
            borderBottom:   "1px solid var(--b)",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>🔔 Upcoming IPOs</div>
            </div>
          </div>

          {/* Body */}
          <div style={{ maxHeight: 360, overflowY: "auto" }}>

            {/* Loading state */}
            {!loaded && (
              <div style={{
                padding:   "20px 16px",
                textAlign: "center",
                color:     "var(--muted)",
                fontSize:  13,
              }}>
                ⏳ Loading…
              </div>
            )}

            {/* Empty state */}
            {loaded && ipoAlerts.length === 0 && (
              <div style={{
                padding:   "24px 16px",
                textAlign: "center",
                color:     "var(--muted)",
                fontSize:  13,
              }}>
                No open ordinary share IPOs right now.
              </div>
            )}

            {/* IPO rows */}
            {loaded && ipoAlerts.map((issue, idx) => {
              const id = String(issue.companyShareId);

              return (
                <div
                  key={id || idx}
                  style={{
                    padding:      "12px 16px",
                    borderBottom: idx < ipoAlerts.length - 1
                      ? "1px solid var(--b)"
                      : "none",
                  }}
                >
                  <div style={{
                    display:        "flex",
                    alignItems:     "flex-start",
                    justifyContent: "space-between",
                    gap:            8,
                  }}>

                    {/* Left — IPO info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight:    600,
                        fontSize:      13,
                        color:         "var(--fg)",
                        whiteSpace:    "nowrap",
                        overflow:      "hidden",
                        textOverflow:  "ellipsis",
                      }}>
                        {issue.companyName || issue.name || "—"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--acc)", marginTop: 2 }}>
                        {issue.scrip || issue.script || "—"}
                        {" · "}
                        <span style={{ color: "var(--muted)" }}>
                          {issue.shareTypeName || "—"}
                        </span>
                      </div>
                      <div style={{
                        fontSize:  10,
                        color:     "var(--muted)",
                        marginTop: 4,
                        display:   "flex",
                        gap:       8,
                      }}>
                        <span>📅 Open: {formatDate(issue.issueOpenDate)}</span>
                        <span>⏰ Close: {formatDate(issue.issueCloseDate)}</span>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          {loaded && ipoAlerts.length > 0 && (
            <div style={{
              padding:   "8px 16px",
              borderTop: "1px solid var(--b)",
              fontSize:  10,
              color:     "var(--muted)",
              textAlign: "center",
            }}>
              Showing {ipoAlerts.length} open ordinary share IPO{ipoAlerts.length !== 1 ? "s" : ""}
            </div>
          )}

        </div>
      )}
    </div>
  );
}