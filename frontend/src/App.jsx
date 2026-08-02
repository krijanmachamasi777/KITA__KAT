// src/App.jsx — kitta kat V6
import { useState, useEffect, useRef, useCallback } from "react";
import "./styles/global.css";
import { useAuth }           from "./context/AuthContext";
import { SplashScreen }      from "./components/SplashScreen";
import { LoginPage }         from "./pages/LoginPage";
import { Dashboard }         from "./tabs/Dashboard";
import { Journal }           from "./tabs/Journal";
import { Investment }        from "./tabs/Investment";
import { Watchlist }         from "./tabs/Watchlist";
import { Losing }            from "./tabs/Losing";
import { MSPortfolio }       from "./tabs/MSPortfolio";
import { MSIpos }            from "./tabs/MSIpos";
import { MSWacc }            from "./tabs/MSWacc";
import { MSPurchaseSource }  from "./tabs/MSPurchaseSource";
import { TradeDetailModal }  from "./components/TradeDetailModal";
import { TradeFormModal }    from "./components/TradeFormModal";
import { InvDetailModal }    from "./components/InvDetailModal";
import { InvestFormModal }   from "./components/InvestFormModal";
import { WatchFormModal }    from "./components/WatchFormModal";
import { TradeHistoryModal } from "./components/TradeHistoryModal";
import { InvestmentHistoryModal } from "./components/InvestmentHistoryModal";
import { NotificationBell }  from "./components/NotificationBell";
import logoImg               from "./assets/logo.png";
import { THEMES, getStoredThemeKey, applyTheme } from "./utils/theme";

const NAV_MAIN = [
  { id: "dashboard",          icon: "🏠", label: "Dashboard"         },
  { id: "journal",            icon: "📝", label: "Journal"            },
  { id: "investment",         icon: "💼", label: "Investment"         },
  { id: "watchlist",          icon: "👁", label: "Watchlist"          },
  { id: "losing",             icon: "📉", label: "Losing"             },
];
const NAV_MS = [
  { id: "ms-portfolio",       icon: "🏦", label: "MS Portfolio"       },
  { id: "ms-ipos",            icon: "📋", label: "Open IPOs"          },
 // { id: "ms-wacc",            icon: "⚖️", label: "WACC"               },
  { id: "ms-purchase-source", icon: "🧾", label: "My Purchase Source" },
];

const FAB_LABELS = {
  journal:    "Log Trade",
  investment: "Add Investment",
  watchlist:  "Add to Watchlist",
};

function normalizeListResponse(value) {
  return Array.isArray(value) ? value : (value?.data || []);
}

function NavItem({ item, active, onClick }) {
  return (
    <button
      className={`kk-nav-item${active ? " kk-nav-item--active" : ""}`}
      onClick={onClick}
      title={item.label}
    >
      <span className="kk-nav-item__ico">{item.icon}</span>
      <span className="kk-nav-item__lbl">{item.label}</span>
      <span className="kk-nav-item__tip">{item.label}</span>
    </button>
  );
}

export default function App() {
  const {
    isLoggedIn, user, logout, hydrateUser, syncLoading,
    fetchJournalTrades, fetchInvestmentTrades,
    createTrade, updateTrade: updateJournal, deleteTrade: deleteJournal,
    createInvestment, updateInvestment: updateInvDB, deleteInvestment: deleteInvDB,
    fetchWatchlistItems, createWatchItem, updateWatchItem, deleteWatchItem,
  } = useAuth();

  // ── Splash ──────────────────────────────────────────────
  const [splashDone, setSplashDone] = useState(false);
  const [appVisible,  setAppVisible]  = useState(false);
  const handleSplashFinish = useCallback(() => {
    setSplashDone(true);
    setTimeout(() => setAppVisible(true), 80);
  }, []);

  // ── Theme ────────────────────────────────────────────────
  const [themeIdx, setThemeIdx] = useState(function() {
    var storedKey = getStoredThemeKey();
    var idx = THEMES.findIndex(function(t) { return t.key === storedKey; });
    return idx === -1 ? 0 : idx;
  });
  const theme = THEMES[themeIdx];
  useEffect(() => {
    applyTheme(theme.key);
  }, [theme.key]);
  const cycleTheme = () => setThemeIdx(function(i) { return (i + 1) % THEMES.length; });

  // ── Sidebar ──────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const collapseTimer = useRef(null);
  useEffect(() => {
    if (appVisible && isLoggedIn) {
      collapseTimer.current = setTimeout(function() { setSidebarOpen(false); }, 3000);
    }
    return function() { clearTimeout(collapseTimer.current); };
  }, [appVisible, isLoggedIn]);

  // ── Clock ────────────────────────────────────────────────
  const [now, setNow] = useState(new Date());
  useEffect(function() {
    var t = setInterval(function() { setNow(new Date()); }, 1000);
    return function() { clearInterval(t); };
  }, []);

  // ── Hydrate ──────────────────────────────────────────────
  useEffect(function() { hydrateUser(); }, [hydrateUser]);

  // ── Data state ───────────────────────────────────────────
  const [tab,          setTab]         = useState("dashboard");
  const [trades,       setTrades]      = useState([]);
  const [investments,  setInvestments] = useState([]);
  const [watchlist,    setWatchlist]   = useState([]);
  const [dataLoaded,   setDataLoaded]  = useState(false);
  const [tradeDetail,  setTradeDetail] = useState(null);
  const [tradeForm,    setTradeForm]   = useState(null);
  const [invDetail,    setInvDetail]   = useState(null);
  const [invForm,      setInvForm]     = useState(null);
  const [watchForm,    setWatchForm]   = useState(null);
  const [showHistory,  setShowHistory] = useState(false);
  const [showInvestmentHistory, setShowInvestmentHistory] = useState(false);

  // ── Load data on login ───────────────────────────────────
  useEffect(function() {
    if (!isLoggedIn) {
      setTrades([]);
      setInvestments([]);
      setWatchlist([]);
      setDataLoaded(false);
      return;
    }

    let cancelled = false;
    Promise.all([
      fetchJournalTrades().catch(function() { return []; }),
      fetchInvestmentTrades().catch(function() { return []; }),
      fetchWatchlistItems().catch(function() { return []; }),
    ]).then(function(results) {
      if (cancelled) return;
      const [journal, investmentsData, watchItems] = results;
      setTrades(normalizeListResponse(journal));
      setInvestments(normalizeListResponse(investmentsData));
      setWatchlist(normalizeListResponse(watchItems));
      setDataLoaded(true);
    });

    return function() { cancelled = true; };
  }, [isLoggedIn, fetchJournalTrades, fetchInvestmentTrades, fetchWatchlistItems]);

  // ── Journal CRUD ─────────────────────────────────────────
  async function addTrade(data) {
    try {
      const result = await createTrade(data);
      setTrades((prev) => [...prev, result]);
    } catch (error) {
      console.warn(error);
    }
  }

  async function updTrade(id, data) {
    try {
      const updated = await updateJournal(id, data);
      setTrades((prev) => prev.map((trade) => (trade.id === id ? { ...trade, ...updated } : trade)));
    } catch (error) {
      console.warn(error);
    }
  }

  async function delTrade(id) {
    try {
      const item = trades.find((trade) => trade.id === id);
      if (!item || !item.imported) await deleteJournal(id);
      setTrades((prev) => prev.filter((trade) => trade.id !== id));
    } catch (error) {
      console.warn(error);
    }
  }

  // ── Investment CRUD ──────────────────────────────────────
  async function addInv(data) {
    try {
      const result = await createInvestment(data);
      setInvestments((prev) => [...prev, result]);
    } catch (error) {
      console.warn(error);
    }
  }

  async function updInv(id, data) {
    try {
      const updated = await updateInvDB(id, data);
      setInvestments((prev) => prev.map((investment) => (investment.id === id ? { ...investment, ...updated } : investment)));
    } catch (error) {
      console.warn(error);
    }
  }

  async function delInv(id) {
    try {
      const item = investments.find((investment) => investment.id === id);
      if (!item || !item.imported) await deleteInvDB(id);
      setInvestments((prev) => prev.filter((investment) => investment.id !== id));
    } catch (error) {
      console.warn(error);
    }
  }

  // ── Watchlist CRUD ───────────────────────────────────────
  async function addWatch(data) {
    try {
      const result = await createWatchItem(data);
      setWatchlist((prev) => [...prev, result]);
    } catch (error) {
      console.warn(error);
    }
  }

  async function updWatch(id, data) {
    try {
      const updated = await updateWatchItem(id, data);
      setWatchlist((prev) => prev.map((watchItem) => (watchItem.id === id ? { ...watchItem, ...updated } : watchItem)));
    } catch (error) {
      console.warn(error);
    }
  }

  async function delWatch(id) {
    try {
      await deleteWatchItem(id);
      setWatchlist((prev) => prev.filter((watchItem) => watchItem.id !== id));
    } catch (error) {
      console.warn(error);
    }
  }

  function handleFAB() {
    const handlers = {
      journal: () => setTradeForm({ mode: "add", data: {} }),
      losing: () => setTradeForm({ mode: "add", data: {} }),
      investment: () => setInvForm({ mode: "add", data: {} }),
      watchlist: () => setWatchForm({ mode: "add", data: {} }),
    };
    handlers[tab]?.();
  }

  const isMsTab = tab.startsWith("ms-");
  const showFAB = !isMsTab && tab !== "dashboard" && tab !== "losing" && FAB_LABELS[tab];

  return (
    <>
      {!splashDone && <SplashScreen onFinish={handleSplashFinish} />}

      <div
        className="kk-shell"
        style={{
          opacity:       appVisible ? 1 : 0,
          transform:     appVisible ? "none" : "translateY(8px)",
          transition:    "opacity 0.55s ease, transform 0.55s ease",
          pointerEvents: appVisible ? "all" : "none",
        }}
      >
        {/* Sync loading */}
        {syncLoading && (
          <div className="kk-sync-screen">
            <div className="kk-sync-screen__icon">📊</div>
            <h2 className="kk-sync-screen__title">Syncing your portfolio…</h2>
            <p className="kk-sync-screen__sub">
              Fetching fresh data from MeroShare.
            </p>
            <div className="kk-spinner" />
          </div>
        )}

        {/* Login */}
        {!syncLoading && !isLoggedIn && <LoginPage />}

        {/* Data loading */}
        {!syncLoading && isLoggedIn && !dataLoaded && (
          <div className="kk-sync-screen">
            <div className="kk-spinner" />
            <p className="kk-sync-screen__sub">Loading your data…</p>
          </div>
        )}

        {/* Main app */}
        {!syncLoading && isLoggedIn && dataLoaded && (
          <>
            {/* Topbar */}
            <header className="kk-topbar">
              <div className="kk-topbar__left">
                <button
                  className="kk-ham"
                  onClick={function() {
                    clearTimeout(collapseTimer.current);
                    setSidebarOpen(function(o) { return !o; });
                  }}
                  aria-label="Toggle sidebar"
                >
                  <svg viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <line x1="2" y1="4"   x2="15" y2="4"   />
                    <line x1="2" y1="8.5" x2="15" y2="8.5" />
                    <line x1="2" y1="13"  x2="15" y2="13"  />
                  </svg>
                </button>
                <div className="kk-logo">
                  <img className="kk-logo__img" src={logoImg} alt="kitta kat" draggable={false} />
                  <div>
                    <div className="kk-logo__brand">kitta kat</div>
                    <div className="kk-logo__sub">your journal and finance tracker</div>
                  </div>
                </div>
              </div>

              <div className="kk-topbar__right">
                <button className="kk-theme-btn" onClick={cycleTheme} title="Switch theme">
                  <span className="kk-theme-btn__ico">{theme.icon}</span>
                  <span className="kk-theme-btn__lbl">{theme.label}</span>
                </button>

                <div className="kk-clock">
                  <div className="kk-clock__date">
                    {now.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                  </div>
                  <div className="kk-clock__time">
                    {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </div>
                </div>

                <div className="kk-user">
                  <div className="kk-user__name">{user?.name || user?.username || "User"}</div>
                  {user?.email && <div className="kk-user__email">{user.email}</div>}
                </div>

                <NotificationBell />

                <button className="kk-logout" onClick={logout}>LOGOUT</button>
              </div>
            </header>

            {/* Body */}
            <div className="kk-body">
              <nav
                className={`kk-sidebar${sidebarOpen ? " kk-sidebar--open" : ""}`}
                onMouseEnter={function() { clearTimeout(collapseTimer.current); setSidebarOpen(true); }}
                onMouseLeave={function() { setSidebarOpen(false); }}
              >
                <div className="kk-sidebar__section-lbl">Main</div>
                {NAV_MAIN.map(function(n) {
                  return <NavItem key={n.id} item={n} active={tab === n.id} onClick={function() { setTab(n.id); }} />;
                })}
                <div className="kk-sidebar__sep" />
                <div className="kk-sidebar__section-lbl">MeroShare</div>
                {NAV_MS.map(function(n) {
                  return <NavItem key={n.id} item={n} active={tab === n.id} onClick={function() { setTab(n.id); }} />;
                })}
              </nav>

              <main className="kk-main" key={tab}>
                <div className="kk-page-enter">
                  {tab === "dashboard"           && <Dashboard   trades={trades}       investments={investments} />}
                  {tab === "journal"             && <Journal     trades={trades}       onScripClick={setTradeDetail} onHistory={() => setShowHistory(true)} />}
                  {tab === "investment"          && <Investment  investments={investments} onScripClick={setInvDetail} onHistory={() => setShowInvestmentHistory(true)} />}
                  {tab === "watchlist"           && <Watchlist   watchlist={watchlist} onEdit={function(w) { setWatchForm({ mode: "edit", data: w }); }} onDelete={delWatch} />}
                  {tab === "losing"              && <Losing      trades={trades}       onScripClick={setTradeDetail} />}
                  {tab === "ms-portfolio"        && <MSPortfolio />}
                  {tab === "ms-ipos"             && <MSIpos />}
                  {tab === "ms-wacc"             && <MSWacc />}
                  {tab === "ms-purchase-source"  && <MSPurchaseSource />}
                </div>
              </main>
            </div>

            {/* FAB */}
            {showFAB && (
              <button className="kk-fab" onClick={handleFAB}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                {FAB_LABELS[tab]}
              </button>
            )}

            {/* Modals */}
            {showHistory && (
              <TradeHistoryModal
                trades={trades}
                onScripClick={setTradeDetail}
                onClose={function() { setShowHistory(false); }}
              />
            )}
            {tradeDetail && (
              <TradeDetailModal
                trade={tradeDetail}
                onEdit={function(t) { setTradeDetail(null); setTradeForm({ mode: "edit", data: t }); }}
                onDelete={function(id) { delTrade(id); setTradeDetail(null); }}
                onClose={function() { setTradeDetail(null); }}
              />
            )}
            {tradeForm && (
              <TradeFormModal
                mode={tradeForm.mode}
                init={tradeForm.data}
                onSave={function(d) {
                  if (tradeForm.mode === "add") addTrade(d);
                  else updTrade(tradeForm.data.id, d);
                  setTradeForm(null);
                }}
                onClose={function() { setTradeForm(null); }}
              />
            )}
            {showInvestmentHistory && (
              <InvestmentHistoryModal
                investments={investments}
                onScripClick={setInvDetail}
                onClose={function() { setShowInvestmentHistory(false); }}
              />
            )}
            {invDetail && (
              <InvDetailModal
                inv={invDetail}
                onEdit={function(i) { setInvDetail(null); setInvForm({ mode: "edit", data: i }); }}
                onDelete={function(id) { delInv(id); setInvDetail(null); }}
                onClose={function() { setInvDetail(null); }}
              />
            )}
            {invForm && (
              <InvestFormModal
                mode={invForm.mode}
                init={invForm.data}
                onSave={function(d) {
                  if (invForm.mode === "add") addInv(d);
                  else updInv(invForm.data.id, d);
                  setInvForm(null);
                }}
                onClose={function() { setInvForm(null); }}
              />
            )}
            {watchForm && (
              <WatchFormModal
                mode={watchForm.mode}
                init={watchForm.data}
                onSave={function(d) {
                  if (watchForm.mode === "add") addWatch(d);
                  else updWatch(watchForm.data.id, d);
                  setWatchForm(null);
                }}
                onClose={function() { setWatchForm(null); }}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}