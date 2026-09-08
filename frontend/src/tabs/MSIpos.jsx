// src/tabs/MSIpos.jsx — uses portfolioData.issues from AuthContext (DB-fetched on login)
//
// The "Open IPO / FPO Issues" list mirrors the real MeroShare
// "My ASBA → Apply for Issue" screen: each issue is a single row
// ("<Company> - <SubGroup> (<Scrip>) [Type badge] • <ShareGroup>")
// with an action button on the right.
//
// Button state:
//   - Not yet applied → "Apply" button, opens ApplyIpoModal.
//   - Already applied  → no button at all (this app does not implement
//     an edit-application flow, so nothing is shown in its place —
//     matching the real site's "Edit" affordance being intentionally
//     dropped here).
//
// "Already applied" is derived from a local, in-memory "just applied
// this session" set, so the row updates the instant a submission
// succeeds — without waiting for the next full portfolio sync.
//
// NOTE: we deliberately do NOT gate the button on the applicableIssue
// list's synced `statusName` field (see
// backend/src/schemas/applicableIssueSchema.js). That field comes from
// CDSC's bulk "open issues" list, not from a real per-user "has this
// user applied to this issue" check, and its value isn't reliably
// user-specific — it was found to sometimes equal "EDIT_APPROVE" for
// issues a given user had never actually applied to, which hid the
// Apply button entirely and silently for those users. The real,
// authoritative per-user check already exists and is already called
// correctly — GET /api/ipo-apply/eligibility/:companyShareId, wired up
// in ApplyIpoModal's bootstrap() — so we always render the button and
// let the modal's eligibility check (which shows a proper "not
// eligible" message when CDSC confirms the user already applied) be
// the single source of truth instead of pre-guessing here.
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ApplyIpoModal } from "../components/ApplyIpoModal";
import "../styles/meroshare.css";
import "../styles/ipo-apply.css";

export function MSIpos() {
  const { portfolioData, fetchAllPortfolioData } = useAuth();
  const { issues = [], loaded } = portfolioData;

  // ── Apply modal state ────────────────────────────────────────────
  const [applyIssue, setApplyIssue] = useState(null); // the row currently being applied for, or null
  // Issues successfully applied to in this session — instant UI feedback
  // ahead of the next full sync refreshing statusName from CDSC.
  const [appliedLocally, setAppliedLocally] = useState(() => new Set());

  if (!loaded) return <div className="ms-state">⏳ Loading open issues…</div>;

  const typeColor = t => {
    if (!t) return "badge--default";
    const l = t.toLowerCase();
    if (l.includes("ipo"))    return "badge--banking";
    if (l.includes("fpo"))    return "badge--finance";
    if (l.includes("rights")) return "badge--it";
    if (l.includes("mutual")) return "badge--gold";
    return "badge--default";
  };

  const isApplied = (iss) =>
    appliedLocally.has(String(iss.companyShareId ?? iss.id));

  const handleApplied = (iss) => {
    setAppliedLocally(prev => new Set(prev).add(String(iss.companyShareId ?? iss.id)));
    fetchAllPortfolioData();
  };

  return (
    <div className="ms-wrap">
      <div className="stat-grid ms-summary">
        <div className="stat-card">
          <div className="stat-card__label">Open Issues</div>
          <div className="stat-card__value v--blue">{issues.length}</div>
          <div className="stat-card__sub">Currently applicable</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">IPO</div>
          <div className="stat-card__value">
            {issues.filter(i => (i.shareTypeName || "").toLowerCase().includes("ipo")).length}
          </div>
          <div className="stat-card__sub">Initial Public Offers</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">FPO / Rights</div>
          <div className="stat-card__value v--purple">
            {issues.filter(i => {
              const t = (i.shareTypeName || "").toLowerCase();
              return t.includes("fpo") || t.includes("rights");
            }).length}
          </div>
          <div className="stat-card__sub">Further offerings</div>
        </div>
      </div>

      <div className="card--np ms-card">
        <div className="card__header">
          <div>
            <div className="card__title">Open IPO / FPO Issues</div>
            <div className="card__sub">Currently applicable issues on MeroShare</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="card__count">{issues.length} total</span>
            <button
              className="btn-secondary"
              onClick={() => fetchAllPortfolioData()}
              title="Re-fetch from database"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        <div className="ipo-issue-list">
          {issues.length === 0 && (
            <div className="ms-state">No open issues right now.</div>
          )}
          {issues.map((iss, i) => {
            const applied = isApplied(iss);
            const canApply = !applied && !!(iss.companyShareId || iss.id);
            return (
              <div className="ipo-issue-row" key={iss.companyShareId || i}>
                <div className="ipo-issue-row__info">
                  <span className="ipo-issue-row__company">{iss.companyName || iss.name || "—"}</span>
                  {(iss.subGroup || iss.scrip || iss.script) && (
                    <>
                      <span className="ipo-issue-row__sep">-</span>
                      <span className="ipo-issue-row__subgroup">
                        {iss.subGroup || "—"}
                        {(iss.scrip || iss.script) ? ` (${iss.scrip || iss.script})` : ""}
                      </span>
                    </>
                  )}
                  <span className={`badge ${typeColor(iss.shareTypeName)}`}>{iss.shareTypeName || "—"}</span>
                  {iss.shareGroupName && (
                    <>
                      <span className="ipo-issue-row__dot">•</span>
                      <span className="ipo-issue-row__group">{iss.shareGroupName}</span>
                    </>
                  )}
                </div>
                <div className="ipo-issue-row__action">
                  {canApply && (
                    <button
                      className="btn btn--edit"
                      onClick={() => setApplyIssue(iss)}
                      title="Apply for this issue"
                    >
                      Apply
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {applyIssue && (
        <ApplyIpoModal
          issue={applyIssue}
          onClose={() => setApplyIssue(null)}
          onApplied={() => handleApplied(applyIssue)}
        />
      )}
    </div>
  );
}