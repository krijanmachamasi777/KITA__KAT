// src/pages/LoginPage.jsx — V6 redesign, white background
import { useState, useRef, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import "./LoginPage.css";
import logoImg from "../assets/logo.png";
import { THEMES, getStoredThemeKey, applyTheme } from "../utils/theme";

// Full official CDSC/MeroShare DP list (code -> broker/bank name), sorted A–Z.
const DP_LIST = [
  { code: "19000", name: "Aakash Capital Limited" },
  { code: "20600", name: "Aakashbhairab Securities Limited" },
  { code: "13200", name: "ABC Securities Private Limited" },
  { code: "12300", name: "Agrawal Securities Private Limited" },
  { code: "17200", name: "Agricultural Development Bank Limited" },
  { code: "22300", name: "Apple Securities Pvt. Ltd." },
  { code: "21800", name: "Arun Securities Pvt. Ltd." },
  { code: "11900", name: "Aryatara Investment And Securities Private Limited" },
  { code: "17500", name: "Asian Capital Limited" },
  { code: "14700", name: "Asian Securities Private Limited" },
  { code: "23200", name: "Beni Securities Pvt. Ltd." },
  { code: "19100", name: "Bhole Ganesh Securities Limited" },
  { code: "15000", name: "Bhrikuti Stock Broking Company Private Limited" },
  { code: "20700", name: "Blue Chip Securities Limited" },
  { code: "15600", name: "Brilliant Securities Pvt. Ltd." },
  { code: "20900", name: "Capital Hub Pvt. Ltd." },
  { code: "19500", name: "Capital Max Securities Limited" },
  { code: "11700", name: "Citizens Bank International Limited" },
  { code: "13300", name: "Creative Securities Private Limited" },
  { code: "13400", name: "Crystal Kanchanjungha Securities Pvt. Ltd" },
  { code: "12000", name: "Dakshinkali Investment And Securities Private Limited" },
  { code: "14500", name: "Deevyaa Securities & Stock House Private Limited" },
  { code: "11300", name: "Dipshikha Dhitopatra Karobar Company (P.) Ltd." },
  { code: "14900", name: "Dynamic Money Managers Securities Private Limited" },
  { code: "20300", name: "Elite Merchant Capital Limited" },
  { code: "19800", name: "Elite Stock House Limited" },
  { code: "10800", name: "Everest Bank Ltd." },
  { code: "17600", name: "Garima Capital Limited" },
  { code: "21900", name: "Garima Securities Limited" },
  { code: "11100", name: "Global IME Bank Limited" },
  { code: "12200", name: "Global IME Bank Limited" },
  { code: "11200", name: "Global IME Capital Limited" },
  { code: "16200", name: "Guheswori Merchant Banking & Finance Limited" },
  { code: "18000", name: "Gurkhas Finance Limited" },
  { code: "20500", name: "Hatemalo Financial Services Private Limited" },
  { code: "22900", name: "Himalaya Securities Banker Limited" },
  { code: "19600", name: "Himalayan Brokerage Company Limited" },
  { code: "10100", name: "Himalayan Capital Limited" },
  { code: "17700", name: "Himalayan Capital Limited" },
  { code: "22800", name: "Himalayan Investment Banker Limited" },
  { code: "17400", name: "ICFC Finance Limited" },
  { code: "13100", name: "Imperial Securities Company Limited" },
  { code: "20000", name: "Index Securities Limited" },
  { code: "20800", name: "Indira Securities Pvt. Ltd." },
  { code: "19900", name: "Infinity Securities Limited" },
  { code: "23100", name: "Investment Management Nepal Pvt. Ltd." },
  { code: "23300", name: "JF Securities Company Pvt. Ltd." },
  { code: "17900", name: "Jyoti Bikash Bank Limited" },
  { code: "22000", name: "K.B.L. Securities Limited" },
  { code: "20100", name: "Kalash Stock Market Pvt. Ltd." },
  { code: "18700", name: "Kalika Securities Pvt. Ltd." },
  { code: "18200", name: "Kamana Sewa Bikas Bank Limited" },
  { code: "14300", name: "Kohinoor Investment & Securities Private Limited" },
  { code: "15200", name: "Kumari Bank Limited" },
  { code: "16300", name: "Kumari Bank Limited" },
  { code: "12400", name: "Laxmi Sunrise Capital Limited" },
  { code: "10700", name: "Laxmi Sunrise Capital Limited" },
  { code: "13800", name: "Linch Stock Market Limited" },
  { code: "16100", name: "Machhapuchchhre Bank Limited" },
  { code: "14100", name: "Machhapuchchhre Capital Limited" },
  { code: "21400", name: "Machhapuchchhre Securities Ltd." },
  { code: "22200", name: "Magnet Securities And Investment Company Pvt. Ltd." },
  { code: "16700", name: "Mahalaxmi Bikas Bank Limited" },
  { code: "18900", name: "Manjushree Finance Limited" },
  { code: "13600", name: "Market Securities Exchange Company Pvt. Ltd" },
  { code: "21600", name: "Milky Way Share Broker Company Ltd." },
  { code: "19700", name: "Miyo Securities Private Limited" },
  { code: "21100", name: "Money World Share Exchange Pvt. Ltd." },
  { code: "12500", name: "Muktinath Capital Limited" },
  { code: "15900", name: "NAASA Securities Company Ltd" },
  { code: "16800", name: "Nabil Bank Limited" },
  { code: "15100", name: "Nabil Bank Limited" },
  { code: "10400", name: "Nabil Investment Banking Ltd." },
  { code: "20400", name: "Nagarik Stock Dealer Company Limited" },
  { code: "23400", name: "National Capital Limited" },
  { code: "15700", name: "Nepal Bank Limited" },
  { code: "15500", name: "Nepal DP Limited" },
  { code: "23500", name: "Nepal Investment And Securities Trading Pvt. Ltd." },
  { code: "16400", name: "Nepal Life Capital Limited" },
  { code: "15300", name: "Nepal SBI Bank Limited" },
  { code: "11500", name: "Nepal Stock House Private Limited" },
  { code: "13700", name: "NIC Asia Bank Limited" },
  { code: "10600", name: "NIMB Ace Capital Limited" },
  { code: "10200", name: "NIMB Ace Capital Limited" },
  { code: "17300", name: "NIMB Ace Capital Limited" },
  { code: "11000", name: "NMB Capital Limited" },
  { code: "11800", name: "Online Securities Limited" },
  { code: "21200", name: "Opal Securities Investment Pvt. Ltd." },
  { code: "17000", name: "Oxford Securities Pvt. Ltd." },
  { code: "21300", name: "Pahi Investment Pvt. Ltd." },
  { code: "13900", name: "Prabhu Bank Limited" },
  { code: "16000", name: "Prabhu Bank Limited" },
  { code: "12600", name: "Prabhu Capital Limited" },
  { code: "22600", name: "Pragyan Securities Pvt. Ltd." },
  { code: "14800", name: "Premier Securities Company Limited" },
  { code: "15400", name: "Prime Commercial Bank Limited" },
  { code: "16900", name: "Prime Commercial Bank Limited" },
  { code: "12800", name: "Primo Securities Private Limited" },
  { code: "18600", name: "Progressive Finance Limited" },
  { code: "19400", name: "Property Wizard Limited" },
  { code: "16600", name: "Provident Merchant Banking Limited" },
  { code: "23000", name: "R.B.B. Securities Company Ltd." },
  { code: "16500", name: "RBB Merchant Banking Limited" },
  { code: "23600", name: "Reliable Investment And Merchant Capital Limited" },
  { code: "22100", name: "Roadshow Securities Ltd." },
  { code: "21500", name: "S.P.S.A. Securities Ltd." },
  { code: "21700", name: "Sajilo Broker Limited" },
  { code: "18100", name: "Sampanna Capital And Advisory Nepal Limited" },
  { code: "14400", name: "Sani Securities Company Limited" },
  { code: "15800", name: "Sanima Bank Ltd" },
  { code: "22400", name: "Sanima Securities Limited" },
  { code: "11600", name: "Secured Securities Limited" },
  { code: "12700", name: "Sewa Securities Private Limited" },
  { code: "18400", name: "Shangri-La Development Bank Limited" },
  { code: "19200", name: "SharePro Securities Pvt. Ltd." },
  { code: "18500", name: "Shine Resunga Development Bank Limited" },
  { code: "18800", name: "Shree Investment And Finance Co. Ltd." },
  { code: "12900", name: "Shree Krishna Securities Limited" },
  { code: "20200", name: "Shubhakamana Securities Pvt. Ltd." },
  { code: "10900", name: "Siddhartha Capital Limited" },
  { code: "14600", name: "Sipla Securities Private Limited" },
  { code: "13000", name: "South Asian Bulls Private Limited" },
  { code: "14000", name: "Sri Hari Securities Pvt. Ltd." },
  { code: "21000", name: "Stoxkarts Securities Limited" },
  { code: "14200", name: "Sumeru Securities Private Limited" },
  { code: "19300", name: "Sun Securities Pvt. Ltd." },
  { code: "17800", name: "Sundhara Securities Limited" },
  { code: "22500", name: "Sunlife Capital Limited" },
  { code: "18300", name: "Swarnalaxmi Securities Pvt. Ltd." },
  { code: "22700", name: "Trademow Securities Pvt. Ltd." },
  { code: "11400", name: "Trishakti Securities Limited" },
  { code: "17100", name: "Trishul Securities & Investment Limited" },
  { code: "13500", name: "Vision Securities Pvt. Ltd." },
].sort((a, b) => a.name.localeCompare(b.name));

function formatDpLabel(d) {
  return `${d.name} (${d.code})`;
}

export function LoginPage() {
  const { login, loading, error } = useAuth();

  // What's visible in the input (free text — a name, a partial name, or a code).
  const [dpQuery, setDpQuery] = useState("");
  // The actual code that gets submitted. Set either by picking a suggestion,
  // or directly when the typed text is purely numeric (manual entry).
  const [dpCode, setDpCode] = useState("");
  const [dpOpen, setDpOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  // Theme — the login page can appear before any app state exists, so it
  // manages its own toggle: reads the last saved choice (or OS preference)
  // on mount, and persists any change so the rest of the app picks it up too.
  const [themeKey, setThemeKey] = useState(getStoredThemeKey);
  useEffect(() => { applyTheme(themeKey); }, [themeKey]);
  const activeTheme = THEMES.find(t => t.key === themeKey) || THEMES[0];
  const toggleTheme = () => setThemeKey(k => (k === "dark" ? "light" : "dark"));

  const dpWrapRef = useRef(null);

  // Close the suggestions panel on outside click, like MeroShare's own DP field.
  useEffect(() => {
    function onClickOutside(e) {
      if (dpWrapRef.current && !dpWrapRef.current.contains(e.target)) {
        setDpOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Filter by DP code OR bank/broker name, same as the real MeroShare dropdown.
  const filteredDp = useMemo(() => {
    const q = dpQuery.trim().toLowerCase();
    if (!q) return DP_LIST;
    return DP_LIST.filter(
      d => d.code.includes(q) || d.name.toLowerCase().includes(q)
    );
  }, [dpQuery]);

  const canSubmit = dpCode && username && password && !loading;

  const handleDpInputChange = (e) => {
    const val = e.target.value;
    setDpQuery(val);
    setDpOpen(true);
    setHighlight(0);

    const digitsOnly = val.replace(/\D/g, "");
    if (val.trim() === "") {
      setDpCode("");
    } else if (digitsOnly === val.trim()) {
      // Purely numeric — treat as a manually typed DP code directly.
      setDpCode(digitsOnly.slice(0, 6));
    } else {
      // They're typing a name — wait for a pick from the list before submitting.
      setDpCode("");
    }
  };

  const handleDpFocus = () => setDpOpen(true);

  const selectDp = (d) => {
    setDpQuery(formatDpLabel(d));
    setDpCode(d.code);
    setDpOpen(false);
  };

  const handleDpKeyDown = (e) => {
    if (!dpOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, filteredDp.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (filteredDp[highlight]) {
        e.preventDefault();
        selectDp(filteredDp[highlight]);
      }
    } else if (e.key === "Escape") {
      setDpOpen(false);
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!canSubmit) return;
    await login({ dpCode, username, password });
  };

  return (
    <div className="lp-root">
      <div className="lp-grid" />
      <div className="lp-top-rule" />

      <button
        className="lp-theme-btn"
        onClick={toggleTheme}
        title="Switch theme"
        aria-label="Switch light/dark theme"
        type="button"
      >
        <span className="lp-theme-btn__ico">{activeTheme.icon}</span>
        <span className="lp-theme-btn__lbl">{activeTheme.label}</span>
      </button>

      <div className="lp-wrap">
        <div className="lp-card">

          {/* Brand */}
          <div className="lp-card__brand">
            <img className="lp-card__logo" src={logoImg} alt="kitta kat" draggable={false} />
            <div>
              <div className="lp-card__brand-name">kitta kat</div>
              <div className="lp-card__brand-sub">your journal and finance tracker</div>
            </div>
          </div>

         

          {/* Heading */}
          <div className="lp-card__head">
            <h1 className="lp-card__title">Connect MeroShare</h1>
            <p className="lp-card__sub">
              Sync your live portfolio, WACC, and trade history from CDSC.
            </p>
          </div>

          {/* Security badge
          <div className="lp-info-badge">
            <span className="lp-info-badge__ico">🔒</span>
            <p className="lp-info-badge__txt">
              Your credentials are <strong>never stored</strong>. They are used
              only to fetch your holdings and WACC directly from MeroShare.
            </p>
          </div> */}

          {error && (
            <div className="lp-alert">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form className="lp-fields" onSubmit={handleSubmit} autoComplete="off">
            {/* DP — searchable by code or bank/broker name, MeroShare-style */}
            <div className="lp-field" ref={dpWrapRef}>
              <label className="lp-label" htmlFor="dp">Depository Participant (DP)</label>
              <div className="lp-input-wrap lp-dp-wrap">
                <input
                  id="dp" type="text" className="lp-input"
                  placeholder="Type DP code or bank"
                  value={dpQuery}
                  onChange={handleDpInputChange}
                  onFocus={handleDpFocus}
                  onKeyDown={handleDpKeyDown}
                  disabled={loading} autoComplete="off"
                  role="combobox" aria-expanded={dpOpen} aria-autocomplete="list"
                />

                {dpOpen && (
                  <div className="lp-dp-panel" role="listbox">
                    {filteredDp.length === 0 ? (
                      <div className="lp-dp-empty">
                        No match — press Enter to use “{dpQuery}” as the DP code
                      </div>
                    ) : (
                      filteredDp.slice(0, 50).map((d, i) => (
                        <div
                          key={d.code}
                          role="option"
                          aria-selected={i === highlight}
                          className={`lp-dp-opt${i === highlight ? " lp-dp-opt--active" : ""}`}
                          onMouseDown={(e) => { e.preventDefault(); selectDp(d); }}
                          onMouseEnter={() => setHighlight(i)}
                        >
                          <span className="lp-dp-opt__name">{d.name}</span>
                          <span className="lp-dp-opt__code">{d.code}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            
            </div>

            {/* Username */}
            <div className="lp-field">
              <label className="lp-label" htmlFor="username">MeroShare Username</label>
              <div className="lp-input-wrap">
                <input
                  id="username" type="text" className="lp-input"
                  placeholder=""
                  value={username} onChange={e => setUsername(e.target.value)}
                  disabled={loading} autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div className="lp-field">
              <label className="lp-label" htmlFor="password">Password</label>
              <div className="lp-input-wrap lp-input-wrap--pass">
                <input
                  id="password" type={showPass ? "text" : "password"} className="lp-input"
                  placeholder=""
                  value={password} onChange={e => setPassword(e.target.value)}
                  disabled={loading} autoComplete="current-password"
                />
                <button type="button" className="lp-eye"
                  onClick={() => setShowPass(p => !p)} tabIndex={-1}
                  aria-label={showPass ? "Hide password" : "Show password"}>
                  {showPass ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            <button className="lp-submit" type="submit" disabled={!canSubmit}>
              {loading ? (
                <><span className="lp-spinner" />Connecting…</>
              ) : (
                <><span>🔗</span>Connect &amp; Sync MeroShare</>
              )}
            </button>
          </form>

          <p className="lp-footer">
            Credentials are verified directly with <strong>cdsc.com.np</strong>.
            Your password is never stored.
          </p>
        </div>
      </div>
    </div>
  );
}