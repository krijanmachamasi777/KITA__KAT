// src/components/ApplyIpoModal.jsx
//
// Replicates the real MeroShare "Apply for Company Share" flow, in the
// same two steps as the live site:
//
//   Step 1 ("form")  — issue header, Bank / Branch (auto-filled),
//                       Applied Kitta, Amount (auto-computed), CRN,
//                       disclaimer checkbox, Proceed / Reset.
//   Step 2 ("pin")   — "Please enter your 4 digits transaction PIN to
//                       proceed", Apply / Back.
//
// All MeroShare calls are proxied through the backend (see
// ipoApplyController.js / ipoApplyService.js) — this component never
// talks to CDSC directly and never sees a MeroShare session token.
//
// Props:
//   issue    – the row object from MSIpos.jsx's issues list. Needs at
//              least companyShareId (falls back to id), plus whatever
//              of companyName/scrip/shareTypeName/shareGroupName/
//              subGroup are available for the header (re-fetched from
//              /ipo-apply/issue/:id regardless, so a partial row is fine).
//   onClose  – dismiss the modal.
//   onApplied – called after a confirmed successful application, so the
//              parent can refresh the issues list.
//
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { FG } from "./FG";
import "../styles/modals.css";
import "../styles/ipo-apply.css";

const PIN_RE = /^[0-9]{4}$/;

export function ApplyIpoModal({ issue, onClose, onApplied }) {
  const {
    fetchIpoEligibility,
    fetchIpoIssueDetail,
    fetchIpoBanks,
    fetchIpoBankAccount,
    fetchIpoDisclaimer,
    applyForIpo,
  } = useAuth();

  const companyShareId = issue?.companyShareId ?? issue?.id;

  // ── Bootstrap state ───────────────────────────────────────────────
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState(null);
  const [notEligible, setNotEligible] = useState(null); // CDSC message when status !== ACCEPTED

  const [issueDetail, setIssueDetail] = useState(null);
  const [banks,       setBanks]       = useState([]);
  const [disclaimer,  setDisclaimer]  = useState(null);

  // ── Step ─────────────────────────────────────────────────────────
  const [step, setStep] = useState("form"); // "form" | "pin"

  // ── Form fields ──────────────────────────────────────────────────
  const [bankId,          setBankId]          = useState("");
  const [bankAccount,     setBankAccount]     = useState(null); // {accountBranchId, accountNumber, accountTypeId, branchName, id}
  const [bankAccountLoading, setBankAccountLoading] = useState(false);
  const [bankAccountError,   setBankAccountError]   = useState(null);

  const [appliedKitta, setAppliedKitta] = useState("");
  const [crnNumber,    setCrnNumber]    = useState("");
  const [agreed,       setAgreed]       = useState(false);

  // ── PIN step ─────────────────────────────────────────────────────
  const [pin,        setPin]        = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitted,   setSubmitted]   = useState(null); // success payload

  const fetchedRef = useRef(false);

  // ── Bootstrap: eligibility + issue detail + banks + disclaimer ────
  const bootstrap = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setNotEligible(null);
    try {
      const [eligibility, detail, bankList, disclaimerData] = await Promise.all([
        fetchIpoEligibility(companyShareId),
        fetchIpoIssueDetail(companyShareId),
        fetchIpoBanks(),
        fetchIpoDisclaimer(),
      ]);

      const status = eligibility?.status || (eligibility?.statusCode === 202 ? "ACCEPTED" : null);
      if (status !== "ACCEPTED") {
        setNotEligible(eligibility?.message || "You are not eligible to apply for this issue.");
      }

      setIssueDetail(detail || null);
      setBanks(Array.isArray(bankList) ? bankList : []);
      setDisclaimer(disclaimerData || null);
    } catch (e) {
      setLoadError(e.message || "Failed to load application details.");
    } finally {
      setLoading(false);
    }
  }, [companyShareId, fetchIpoEligibility, fetchIpoIssueDetail, fetchIpoBanks, fetchIpoDisclaimer]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    bootstrap();
  }, [bootstrap]);

  // ── Bank selection → auto-fill branch / account ────────────────────
  const handleBankChange = useCallback(async (e) => {
    const id = e.target.value;
    setBankId(id);
    setBankAccount(null);
    setBankAccountError(null);
    if (!id) return;

    setBankAccountLoading(true);
    try {
      const accounts = await fetchIpoBankAccount(id);
      const first = Array.isArray(accounts) ? accounts[0] : null;
      if (!first) {
        setBankAccountError("No account found for the selected bank.");
      } else {
        setBankAccount(first);
      }
    } catch (e) {
      setBankAccountError(e.message || "Failed to load account details for this bank.");
    } finally {
      setBankAccountLoading(false);
    }
  }, [fetchIpoBankAccount]);

  const handleReset = useCallback(() => {
    setBankId("");
    setBankAccount(null);
    setBankAccountError(null);
    setAppliedKitta("");
    setCrnNumber("");
    setAgreed(false);
  }, []);

  // ── Derived issue constraints ───────────────────────────────────────
  const minUnit     = Number(issueDetail?.minUnit ?? 0);
  const maxUnit     = Number(issueDetail?.maxUnit ?? 0);
  const multipleOf  = Number(issueDetail?.multipleOf ?? 1) || 1;
  const sharePerUnit = Number(issueDetail?.sharePerUnit ?? 0);

  const kittaNum = Number(appliedKitta) || 0;
  const amount   = kittaNum && sharePerUnit ? kittaNum * sharePerUnit : 0;

  const kittaError = (() => {
    if (!appliedKitta) return null;
    if (!Number.isInteger(kittaNum) || kittaNum <= 0) return "Applied Kitta must be a whole number.";
    if (minUnit && kittaNum < minUnit) return `Minimum quantity is ${minUnit}.`;
    if (maxUnit && kittaNum > maxUnit) return `Maximum quantity is ${maxUnit}.`;
    if (multipleOf && kittaNum % multipleOf !== 0) return `Quantity must be a multiple of ${multipleOf}.`;
    return null;
  })();

  const canProceed =
    !!bankId &&
    !!bankAccount &&
    !kittaError &&
    kittaNum > 0 &&
    !!crnNumber.trim() &&
    agreed &&
    !bankAccountLoading;

  const handleProceed = () => {
    if (!canProceed) return;
    setSubmitError(null);
    setStep("pin");
  };

  const handleBackToForm = () => {
    setSubmitError(null);
    setStep("form");
  };

  const handleApply = async () => {
    if (!PIN_RE.test(pin)) {
      setSubmitError("Please enter a valid 4 digit transaction PIN.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await applyForIpo({
        companyShareId: String(companyShareId),
        bankId: String(bankId),
        accountNumber: bankAccount.accountNumber,
        accountBranchId: bankAccount.accountBranchId,
        accountTypeId: bankAccount.accountTypeId,
        customerId: bankAccount.id,
        appliedKitta: String(kittaNum),
        crnNumber: crnNumber.trim(),
        transactionPIN: pin,
      });

      const ok = result?.statusCode === 201 || result?.status === "CREATED";
      if (!ok) {
        setSubmitError(result?.message || "Application could not be submitted. Please try again.");
        return;
      }
      setSubmitted(result);
      onApplied?.(result);
    } catch (e) {
      setSubmitError(e.message || "Application could not be submitted. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const companyName = issueDetail?.companyName || issue?.companyName || issue?.name || "—";
  const shareType    = issueDetail?.shareTypeName || issue?.shareTypeName || "—";
  const shareGroup   = issueDetail?.shareGroupName || issue?.shareGroupName || "";
  const subGroup     = issueDetail?.subGroup || "";
  const scrip        = issueDetail?.scrip || issue?.scrip || issue?.script || "";

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal--wide ipo-apply-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <div className="modal__scrip">
              {step === "pin" ? "Application Details" : "Apply for Company Share"}
            </div>
            <div className="modal__tid">{companyName}</div>
          </div>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__divider" />

        {/* ── Loading / hard error / ineligible states ────────────────── */}
        {loading && <div className="ms-state">⏳ Loading application details…</div>}

        {!loading && loadError && (
          <div className="ms-state ms-state--err">
            ⚠️ {loadError}
            <button className="ms-relogin" onClick={bootstrap}>Retry</button>
          </div>
        )}

        {!loading && !loadError && notEligible && (
          <div className="ms-state ms-state--warn">ℹ️ {notEligible}</div>
        )}

        {/* ── Success state ───────────────────────────────────────────── */}
        {submitted && (
          <div className="ipo-success">
            <div className="ipo-success__icon">✅</div>
            <div className="ipo-success__title">
              {submitted.message || "Share has been applied successfully."}
            </div>
            <div className="form-actions">
              <button className="btn btn--primary" onClick={onClose}>Done</button>
            </div>
          </div>
        )}

        {/* ── Step 1: Application form ────────────────────────────────── */}
        {!loading && !loadError && !notEligible && !submitted && step === "form" && (
          <>
            <div className="ipo-header-card">
              <div className="ipo-header-card__title">
                {companyName}
                {shareType && <span className="badge badge--banking">{shareType}</span>}
              </div>
              <div className="ipo-header-card__sub">
                {shareGroup}{subGroup ? ` · ${subGroup}` : ""}{scrip ? ` · ${scrip}` : ""}
              </div>

              <div className="ipo-info-grid">
                <div className="ipo-info-item">
                  <div className="ipo-info-item__label">Issue Manager</div>
                  <div className="ipo-info-item__value">{issueDetail?.clientName || "—"}</div>
                </div>
                <div className="ipo-info-item">
                  <div className="ipo-info-item__label">Issue Open Date</div>
                  <div className="ipo-info-item__value">{issueDetail?.minIssueOpenDateStr || "—"}</div>
                </div>
                <div className="ipo-info-item">
                  <div className="ipo-info-item__label">Issue Close Date</div>
                  <div className="ipo-info-item__value">{issueDetail?.maxIssueCloseDateStr || "—"}</div>
                </div>
                <div className="ipo-info-item">
                  <div className="ipo-info-item__label">No. Of Share Issued</div>
                  <div className="ipo-info-item__value">{issueDetail?.shareValue ?? "—"}</div>
                </div>
                <div className="ipo-info-item">
                  <div className="ipo-info-item__label">Price per Share</div>
                  <div className="ipo-info-item__value">{issueDetail?.sharePerUnit ?? "—"}</div>
                </div>
                <div className="ipo-info-item">
                  <div className="ipo-info-item__label">Minimum Quantity</div>
                  <div className="ipo-info-item__value">{issueDetail?.minUnit ?? "—"}</div>
                </div>
                <div className="ipo-info-item">
                  <div className="ipo-info-item__label">Maximum Quantity</div>
                  <div className="ipo-info-item__value">{issueDetail?.maxUnit ?? "—"}</div>
                </div>
                <div className="ipo-info-item">
                  <div className="ipo-info-item__label">Divisible Quantity</div>
                  <div className="ipo-info-item__value">{issueDetail?.multipleOf ?? "—"}</div>
                </div>
              </div>

              {issueDetail?.prospectusPath && (
                <a
                  className="btn btn--ghost ipo-prospectus-btn"
                  href={issueDetail.prospectusPath}
                  target="_blank"
                  rel="noreferrer"
                >
                  ⬇ Download Prospectus
                </a>
              )}
            </div>

            <div className="form-grid" style={{ marginTop: 18 }}>
              <FG label="Bank *">
                <select className="f-select" value={bankId} onChange={handleBankChange}>
                  <option value="">Please choose one</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </FG>

              <FG label="Branch">
                <input
                  className="f-input"
                  value={bankAccountLoading ? "Loading…" : (bankAccount?.branchName || "")}
                  readOnly
                  placeholder="Select a bank first"
                />
              </FG>

              <FG label="Applied Kitta *">
                <input
                  className="f-input"
                  type="number"
                  min={minUnit || 0}
                  max={maxUnit || undefined}
                  step={multipleOf || 1}
                  value={appliedKitta}
                  onChange={(e) => setAppliedKitta(e.target.value)}
                  placeholder="Enter Applied Kitta Number"
                />
                {kittaError && <div className="ipo-field-error">{kittaError}</div>}
              </FG>

              <FG label="Amount">
                <input className="f-input" value={amount ? amount.toLocaleString() : ""} readOnly placeholder="Amount" />
              </FG>

              <FG label="CRN *" full>
                <input
                  className="f-input"
                  value={crnNumber}
                  onChange={(e) => setCrnNumber(e.target.value)}
                  placeholder="Enter CRN"
                />
              </FG>
            </div>

            {bankAccountError && (
              <div className="ms-state ms-state--err" style={{ marginTop: 10 }}>⚠️ {bankAccountError}</div>
            )}

            {disclaimer?.fieldValue && (
              <label className="ipo-disclaimer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <span>{disclaimer.fieldValue}</span>
              </label>
            )}

            <div className="form-actions">
              <button className="btn btn--ghost" onClick={handleReset}>Reset</button>
              <button className="btn btn--primary" disabled={!canProceed} onClick={handleProceed}>
                Proceed
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Transaction PIN ─────────────────────────────────── */}
        {!loading && !loadError && !notEligible && !submitted && step === "pin" && (
          <div className="ipo-pin-step">
            <div className="ipo-header-card__title">
              {companyName}
              {shareType && <span className="badge badge--banking">{shareType}</span>}
            </div>
            <div className="ipo-header-card__sub">
              {shareGroup}{subGroup ? ` · ${subGroup}` : ""}{scrip ? ` · ${scrip}` : ""}
            </div>

            <div className="ipo-pin-icon">🔒</div>
            <div className="ipo-pin-label">Please enter your 4 digits transaction PIN to proceed</div>
            <input
              className="f-input ipo-pin-input"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
              autoFocus
            />

            {submitError && (
              <div className="ms-state ms-state--err" style={{ marginTop: 10 }}>⚠️ {submitError}</div>
            )}

            <div className="form-actions">
              <button className="btn btn--ghost" onClick={handleBackToForm} disabled={submitting}>Back</button>
              <button
                className="btn btn--primary"
                onClick={handleApply}
                disabled={submitting || !PIN_RE.test(pin)}
              >
                {submitting ? "Applying…" : "Apply"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}