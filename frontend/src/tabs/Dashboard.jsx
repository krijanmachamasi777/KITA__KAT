import { useState, useMemo } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  fmt, isClosedTrade, tradePL, holdDays,
  formatPL, profitFactor, avgWinLoss, expectancy, tradeStreaks,
  hasLivePrice, unrealizedPL, pctChange,
} from "../utils/helpers";
import "../styles/dashboard.css";


// ── Sector pie colour palette ──────────────────────────────
const SECTOR_COLORS = [
  "#0a84ff", "#34c759", "#ff9f0a", "#bf5af2",
  "#ff453a", "#5ac8fa", "#ffd60a", "#30d158",
  "#ff6b6b", "#a78bfa", "#06b6d4",
];


// Custom label rendered inside each pie slice
const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
      fontSize={11} fontWeight={700}>
      {(percent * 100).toFixed(1)}%
    </text>
  );
};


const tooltipStyle = { background: "color-mix(in srgb, var(--bg) 88%, var(--s2))", border: "1px solid var(--glow)", borderRadius: 8, fontSize: 12 };


// ── Shared stat card ────────────────────────────────────────
function StatCard({ label, value, valueClass = "", sub }) {
  return (
    <div className="stat-card">
      <div className="stat-card__label">{label}</div>
      <div className={`stat-card__value ${valueClass}`}>{value}</div>
      {sub && <div className="stat-card__sub">{sub}</div>}
    </div>
  );
}


// ── JOURNAL DASHBOARD ──────────────────────────────────────
function JournalDashboard({ trades }) {
  const total = trades.reduce((s, t) => s + t.buyAmt, 0);
  const closedTrades = trades.filter(isClosedTrade);
  const netPL = closedTrades.reduce((s, t) => s + tradePL(t), 0);
  const totalQty = trades.reduce((s, t) => s + t.qty, 0);
  const wins = closedTrades.filter(t => tradePL(t) > 0).length;
  const winRate = closedTrades.length
    ? ((wins / closedTrades.length) * 100).toFixed(2) : "0.00";
  const winRateCls = Number(winRate) < 50 ? "v--loss" : "v--profit";


  const plS =
    netPL > 500 ? { e: "🚀", l: "Crushing It!", c: "v--profit" } :
      netPL > 0 ? { e: "😊", l: "In Profit", c: "v--profit" } :
        netPL === 0 ? { e: "😐", l: "Break Even", c: "" } :
          netPL > -400 ? { e: "😟", l: "Minor Loss", c: "v--loss" } :
            { e: "😰", l: "Heavy Loss", c: "v--loss" };


  const netPLDisplay = formatPL(netPL);


  // ── Performance metrics ──────────────────────────────────
  const pf = profitFactor(closedTrades);
  const pfDisplay =
    pf == null ? { text: "—", cls: "" } :
      pf === 0 ? { text: "0.00", cls: "v--loss" } :
        { text: pf.toFixed(2), cls: pf >= 1 ? "v--profit" : "v--loss" };


  const { avgWin, avgLoss } = avgWinLoss(closedTrades);
  const expDisplay = formatPL(expectancy(closedTrades));
  const streaks = tradeStreaks(closedTrades);


  // ── Equity curve + drawdown ──────────────────────────────
  const equityData = useMemo(() => {
    const sorted = closedTrades
      .filter(t => t.soldDate)
      .sort((a, b) => (a.soldDate < b.soldDate ? -1 : 1));
    let cum = 0, peak = 0;
    return sorted.map((t, i) => {
      cum = cum + tradePL(t);
      peak = Math.max(peak, cum);
      return {
        name: `#${i + 1}`,
        date: new Date(t.soldDate + "T12:00:00").toLocaleDateString("en", { day: "2-digit", month: "short" }),
        Equity: Number(cum.toFixed(2)),
        Drawdown: Number((cum - peak).toFixed(2)),
      };
    });
  }, [closedTrades]);


  // ── Open positions ────────────────────────────────────────
  const openTrades = useMemo(() => trades.filter(t => !isClosedTrade(t)), [trades]);


  const openWithLive = useMemo(() => openTrades.filter(hasLivePrice), [openTrades]);


  const openCapital = useMemo(
    () => openTrades.reduce((s, t) => s + Number(t.buyAmt || 0), 0),
    [openTrades]
  );


  const openCurrentValue = useMemo(
    () => openTrades.reduce(
      (s, t) => s + (hasLivePrice(t) ? Number(t.ltp || 0) * Number(t.qty || 0) : Number(t.buyAmt || 0)), 0
    ),
    [openTrades]
  );


  const openUnrealizedPL = useMemo(
    () => openWithLive.reduce((s, t) => s + unrealizedPL(t), 0),
    [openWithLive]
  );
  const openUnrealizedDisplay = formatPL(openUnrealizedPL);


  // ── Holding period: winners vs losers ────────────────────
  const holdStats = useMemo(() => {
    const winners = closedTrades.filter(t => tradePL(t) > 0);
    const losers = closedTrades.filter(t => tradePL(t) < 0);
    const avgDays = list => {
      const days = list
        .map(t => holdDays(t.boughtDate, t.soldDate))
        .filter(d => d !== "—" && Number.isFinite(d) && d >= 0);
      return days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0;
    };
    return {
      avgWinDays: avgDays(winners),
      avgLossDays: avgDays(losers),
      hasWinners: winners.length > 0,
      hasLosers: losers.length > 0,
    };
  }, [closedTrades]);


  // Monthly P&L — line chart data
  const lineData = useMemo(() => {
    const m = {};
    trades.forEach(t => {
      if (!isClosedTrade(t) || !t.soldDate) return;
      const k = t.soldDate.slice(0, 7);
      const lbl = new Date(t.soldDate + "T12:00:00")
        .toLocaleDateString("en", { month: "short", year: "2-digit" });
      if (!m[k]) m[k] = { name: lbl, Profit: 0, Loss: 0 };
      const pl = tradePL(t);
      if (pl > 0) m[k].Profit += pl; else m[k].Loss += Math.abs(pl);
    });
    return Object.entries(m)
      .sort((a, b) => a[0] < b[0] ? -1 : 1)
      .map(([, v]) => ({
        name: v.name,
        Profit: Number(v.Profit.toFixed(2)),
        Loss: Number(v.Loss.toFixed(2)),
      }));
  }, [trades]);


  // Monthly capital vs profit — bar chart data
  const capitalBarData = useMemo(() => {
    const m = {};
    trades.forEach(t => {
      if (!isClosedTrade(t) || !t.soldDate) return;
      const k = t.soldDate.slice(0, 7);
      const lbl = new Date(t.soldDate + "T12:00:00")
        .toLocaleDateString("en", { month: "short", year: "2-digit" });
      if (!m[k]) m[k] = { name: lbl, Invested: 0, NetProfit: 0 };
      m[k].Invested += t.buyAmt;
      m[k].NetProfit += tradePL(t);
    });
    return Object.entries(m)
      .sort((a, b) => a[0] < b[0] ? -1 : 1)
      .map(([, v]) => ({
        name: v.name,
        Invested: Number(v.Invested.toFixed(2)),
        NetProfit: Number(v.NetProfit.toFixed(2)),
      }));
  }, [trades]);


  // Group closed trades by TSN → sum net P&L per TSN, then rank
  const tsnNetPL = useMemo(() => {
    const m = {};
    closedTrades.forEach(t => {
      const key = t.tsn || t.scrip; // fall back to scrip if no TSN
      if (!m[key]) m[key] = { name: t.scrip, tsn: key, NetPL: 0 };
      m[key].NetPL += tradePL(t);
    });
    return Object.values(m).map(d => ({ ...d, NetPL: Number(d.NetPL.toFixed(2)) }));
  }, [closedTrades]);


  // Top 3 winning TSNs
  const top3Wins = useMemo(() => (
    tsnNetPL
      .filter(d => d.NetPL > 0)
      .sort((a, b) => b.NetPL - a.NetPL)
      .slice(0, 3)
  ), [tsnNetPL]);


  // Top 3 losing TSNs
  const top3Losses = useMemo(() => (
    tsnNetPL
      .filter(d => d.NetPL < 0)
      .sort((a, b) => a.NetPL - b.NetPL)
      .slice(0, 3)
  ), [tsnNetPL]);


  const holdingGapDays = holdStats.avgLossDays - holdStats.avgWinDays;
  const holdingScaleMax = Math.max(holdStats.avgWinDays, holdStats.avgLossDays, 1);


  return (
    <div className="dashboard">
      {/* ── Stat cards ── */}
      <div className="stat-grid">
        <StatCard label="Total Traded Capital" value={`रु${fmt(total)}`} valueClass="v--blue" sub="Across all trades" />
        <StatCard label="Net P&L" value={netPLDisplay.text} valueClass={netPLDisplay.cls} sub="Realized gains/losses" />
        <StatCard label="Win Rate" value={`${winRate}%`} valueClass={winRateCls} sub={`${wins} of ${trades.length} trades`} />
        <StatCard label="Total Qty Traded" value={totalQty.toLocaleString()} valueClass="v--blue" sub="Shares / units" />
        <div className="emoji-card">
          <div className="emoji-card__icon">{plS.e}</div>
          <div className={`emoji-card__label ${plS.c}`}>{plS.l}</div>
          <div className="emoji-card__sub">Current P&amp;L Scenario</div>
        </div>
      </div>


      {/* ── Performance metrics ── */}
      <div className="stat-grid">
        <StatCard label="Profit Factor" value={pfDisplay.text} valueClass={pfDisplay.cls} sub="Gross profit ÷ gross loss" />
        <StatCard label="Avg Win" value={`रु${fmt(avgWin)}`} valueClass="v--profit" sub="Per winning trade" />
        <StatCard label="Avg Loss" value={`रु${fmt(avgLoss)}`} valueClass="v--loss" sub="Per losing trade" />
        <StatCard label="Expectancy" value={expDisplay.text} valueClass={expDisplay.cls} sub="Avg P&L per trade" />
        <div className="stat-card">
          <div className="stat-card__label">Current Streak</div>
          <div className="stat-card__value">
            {streaks.current === 0 ? (
              <span className="streak-badge streak-badge--none">—</span>
            ) : (
              <span className={`streak-badge streak-badge--${streaks.currentType}`}>
                {streaks.currentType === "win" ? "🔥" : "❄️"} {streaks.current}{streaks.currentType === "win" ? "W" : "L"}
              </span>
            )}
          </div>
          <div className="stat-card__sub">Best win streak {streaks.bestWin} · Worst loss streak {streaks.worstLoss}</div>
        </div>
      </div>


      {/* ── Equity curve + drawdown ── */}
      <div className="chart-row">
        <div className="chart-box">
          <div className="chart-box__title">Equity Curve</div>
          <div className="chart-box__sub">Cumulative realized P&amp;L, trade by trade</div>
          {equityData.length === 0 ? (
            <div className="chart-empty">No closed trades yet — your equity curve will appear here.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={equityData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--acc)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--acc)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--b)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                <Tooltip formatter={v => `रु${fmt(v)}`} contentStyle={tooltipStyle} />
                <ReferenceLine y={0} stroke="var(--b)" />
                <Area type="monotone" dataKey="Equity" stroke="var(--acc)" strokeWidth={2.5} fill="url(#equityFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="chart-box">
          <div className="chart-box__title">Drawdown</div>
          <div className="chart-box__sub">How far below your peak equity you've fallen</div>
          {equityData.length === 0 ? (
            <div className="chart-empty">No closed trades yet — drawdown will appear here.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={equityData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="drawdownFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--r)" stopOpacity={0} />
                    <stop offset="100%" stopColor="var(--r)" stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--b)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                <Tooltip formatter={v => `रु${fmt(v)}`} contentStyle={tooltipStyle} />
                <ReferenceLine y={0} stroke="var(--b)" />
                <Area type="monotone" dataKey="Drawdown" stroke="var(--r)" strokeWidth={2} fill="url(#drawdownFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>


      {/* ── Open positions ── */}
      <div className="chart-box">
        <div className="chart-box__title">Open Positions</div>
        <div className="chart-box__sub">Capital currently deployed and its unrealized P&amp;L</div>
        {openTrades.length === 0 ? (
          <div className="chart-empty">No open positions — every trade has been closed.</div>
        ) : (
          <>
            <div className="mini-stat-row">
              <div className="mini-stat">
                <div className="mini-stat__label">Open Positions</div>
                <div className="mini-stat__value">{openTrades.length}</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat__label">Capital Deployed</div>
                <div className="mini-stat__value">रु{fmt(openCapital)}</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat__label">Current Value</div>
                <div className="mini-stat__value">रु{fmt(openCurrentValue)}</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat__label">Unrealized P&amp;L</div>
                <div className={`mini-stat__value ${openWithLive.length ? openUnrealizedDisplay.cls : ""}`}>
                  {openWithLive.length ? openUnrealizedDisplay.text : "—"}
                </div>
              </div>
            </div>


            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Script</th>
                    <th>Qty</th>
                    <th>Buy Rate</th>
                    <th>LTP</th>
                    <th>Invested</th>
                    <th>Current Value</th>
                    <th>Unrealized P&amp;L</th>
                    <th>% Chg</th>
                  </tr>
                </thead>
                <tbody>
                  {openTrades.map(t => {
                    const upl = unrealizedPL(t);
                    const pct = hasLivePrice(t) ? pctChange(t.ltp, t.buyRate) : null;
                    return (
                      <tr key={t.id}>
                        <td className="td--bold">{t.scrip}</td>
                        <td className="td--mono">{t.qty}</td>
                        <td className="td--mono">रु{fmt(t.buyRate)}</td>
                        <td className="td--mono">{hasLivePrice(t) ? `रु${fmt(t.ltp)}` : "—"}</td>
                        <td className="td--mono">रु{fmt(t.buyAmt)}</td>
                        <td className="td--mono">{hasLivePrice(t) ? `रु${fmt(Number(t.ltp || 0) * Number(t.qty || 0))}` : "—"}</td>
                        <td className={upl == null ? "td--muted" : upl >= 0 ? "td--profit" : "td--loss"}>
                          {upl == null ? "—" : `${upl >= 0 ? "+" : "-"}रु${fmt(Math.abs(upl))}`}
                        </td>
                        <td className={pct == null ? "td--muted" : pct >= 0 ? "td--profit" : "td--loss"}>
                          {pct == null ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>


            {openTrades.length > openWithLive.length && (
              <div className="insight-banner" style={{ marginTop: 12 }}>
                <span className="insight-banner__icon">ℹ️</span>
                <span>
                  {openTrades.length - openWithLive.length} open position(s) don't have live price data yet —
                  sync your portfolio to see their unrealized P&amp;L.
                </span>
              </div>
            )}
          </>
        )}
      </div>


      {/* ── Holding period: winners vs losers ── */}
      <div className="chart-box">
        <div className="chart-box__title">Holding Period — Winners vs Losers</div>
        <div className="chart-box__sub">Average days held before exit, on closed trades</div>
        {!holdStats.hasWinners && !holdStats.hasLosers ? (
          <div className="chart-empty">No closed trades yet.</div>
        ) : (
          <div className="holding-compare">
            <div className="holding-compare__row">
              <div className="holding-compare__label">🏆 Winners</div>
              <div className="holding-compare__track">
                <div className="holding-compare__fill holding-compare__fill--win"
                  style={{ width: `${(holdStats.avgWinDays / holdingScaleMax) * 100}%` }} />
              </div>
              <div className="holding-compare__value">{holdStats.avgWinDays.toFixed(1)}d</div>
            </div>
            <div className="holding-compare__row">
              <div className="holding-compare__label">📉 Losers</div>
              <div className="holding-compare__track">
                <div className="holding-compare__fill holding-compare__fill--loss"
                  style={{ width: `${(holdStats.avgLossDays / holdingScaleMax) * 100}%` }} />
              </div>
              <div className="holding-compare__value">{holdStats.avgLossDays.toFixed(1)}d</div>
            </div>


            {holdStats.hasWinners && holdStats.hasLosers && holdingGapDays > 0 && (
              <div className="insight-banner insight-banner--warn">
                <span className="insight-banner__icon">⚠️</span>
                <span>
                  You're holding losing trades {holdingGapDays.toFixed(1)} days longer on average than winners —
                  consider tightening exits on losers.
                </span>
              </div>
            )}
          </div>
        )}
      </div>


      {/* ── Line chart: P&L monthly ── */}
      <div className="chart-box">
        <div className="chart-box__title">Profit vs Loss — Monthly</div>
        <div className="chart-box__sub">Green line = gains · Red line = losses per month</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={lineData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--b)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
            <Tooltip formatter={v => fmt(v)} contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Line type="monotone" dataKey="Profit" stroke="var(--g)" strokeWidth={2.5} dot={{ r: 5, fill: "var(--g)" }} activeDot={{ r: 7 }} />
            <Line type="monotone" dataKey="Loss" stroke="var(--r)" strokeWidth={2.5} dot={{ r: 5, fill: "var(--r)" }} activeDot={{ r: 7 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>


      {/* ── Bar chart: capital vs profit ── */}
      <div className="chart-box">
        <div className="chart-box__title">Total Invested Capital vs Net P&L</div>
        <div className="chart-box__sub">Capital deployed each month vs returns generated</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={capitalBarData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--b)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
            <Tooltip formatter={v => fmt(v)} contentStyle={tooltipStyle} cursor={false} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="Invested" fill="var(--acc)" fillOpacity={0.95} radius={[5, 5, 0, 0]} name="Total Invested" />
            <Bar dataKey="NetProfit" fill="var(--t1)" fillOpacity={0.95} stroke="var(--bg)" strokeWidth={1} radius={[5, 5, 0, 0]} name="Net P&L" />
          </BarChart>
        </ResponsiveContainer>
      </div>


      {/* ── Top 3 wins and losses side by side ── */}
      <div className="chart-row">
        <div className="chart-box">
          <div className="chart-box__title">🏆 Top 3 Winning Scripts</div>
          <div className="chart-box__sub">Highest net P&amp;L grouped by TSN across all closed trades</div>
          {top3Wins.length === 0 ? (
            <div className="chart-empty">No winning trades recorded yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={top3Wins} layout="vertical" margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--b)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 12, fill: "var(--fg)", fontWeight: 700 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => [`रु${fmt(v)}`, "Net P&L"]} contentStyle={tooltipStyle} cursor={false} />
                <Bar dataKey="NetPL" fill="var(--g)" radius={[0, 5, 5, 0]} name="Net P&L" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="chart-box">
          <div className="chart-box__title">📉 Top 3 Losing Scripts</div>
          <div className="chart-box__sub">Largest net losses grouped by TSN across all closed trades</div>
          {top3Losses.length === 0 ? (
            <div className="chart-empty">No losing trades recorded yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={top3Losses} layout="vertical" margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--b)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 12, fill: "var(--fg)", fontWeight: 700 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => [`रु${fmt(v)}`, "Net P&L"]} contentStyle={tooltipStyle} cursor={false} />
                <Bar dataKey="NetPL" fill="var(--r)" radius={[0, 5, 5, 0]} name="Net P&L" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}


// ── INVESTMENT DASHBOARD ────────────────────────────────────
function InvestmentDashboard({ investments }) {
  const [sectorMetric, setSectorMetric] = useState("qty"); // "qty" | "value"
  const [showAllGainers, setShowAllGainers] = useState(false);
  const [showAllLosers, setShowAllLosers] = useState(false);


  const totalScrips = useMemo(() => {
    const s = new Set(investments.map(i => (i.scrip || "").trim().toUpperCase()));
    return s.size;
  }, [investments]);


  const totalInvestment = investments.reduce((s, i) => s + Number(i.buyAmt || 0), 0);


  const totalNetPL = useMemo(() => (
    investments
      .filter(i => !!i.soldDate && Number(i.soldAmt) > 0)
      .reduce((s, i) => s + (Number(i.soldAmt) - Number(i.buyAmt)), 0)
  ), [investments]);
  const realizedDisplay = formatPL(totalNetPL);


  const holdingCount = investments.filter(i => !i.soldDate).length;
  const soldCount = investments.filter(i => !!i.soldDate).length;


  // ── Current holdings (open positions) ────────────────────
  const holdings = useMemo(() => investments.filter(i => !i.soldDate), [investments]);
  const holdingsWithLive = useMemo(() => holdings.filter(hasLivePrice), [holdings]);


  const currentPortfolioValue = useMemo(() => holdings.reduce(
    (s, i) => s + Number(i.ltp || 0) * Number(i.qty || 0), 0
  ), [holdings]);


  const holdingsInvestment = useMemo(() => holdings.reduce(
    (s, i) => s + Number(i.buyAmt || 0), 0
  ), [holdings]);


  const unrealizedPLTotal = currentPortfolioValue - holdingsInvestment;
  const unrealizedDisplay = formatPL(unrealizedPLTotal);


  const totalReturnPct = totalInvestment
    ? ((totalNetPL + unrealizedPLTotal) / totalInvestment) * 100
    : 0;


  // ── Concentration risk (top holding by current value) ────
  const concentration = useMemo(() => {
    if (!holdings.length) return null;
    const byScrip = {};
    holdings.forEach(inv => {
      const key = (inv.scrip || "").trim().toUpperCase();
      const val = Number(inv.ltp || 0) * Number(inv.qty || 0);
      byScrip[key] = (byScrip[key] || 0) + val;
    });
    const entries = Object.entries(byScrip).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    if (!total || !entries.length) return null;
    const [name, value] = entries[0];
    return { name, pct: (value / total) * 100 };
  }, [holdings]);


  // ── Sector pie data (qty-based, all investments) ─────────
  const sectorQtyData = useMemo(() => {
    const m = {};
    investments.forEach(inv => {
      const sec = inv.sector?.trim() || "Other";
      m[sec] = (m[sec] || 0) + (Number(inv.qty) || 0);
    });
    return Object.entries(m)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [investments]);


  // ── Sector pie data (current value, holdings only) ───────
  const sectorValueData = useMemo(() => {
    const m = {};
    holdings.forEach(inv => {
      const sec = inv.sector?.trim() || "Other";
      const val = Number(inv.ltp || 0) * Number(inv.qty || 0);
      m[sec] = (m[sec] || 0) + val;
    });
    return Object.entries(m)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  }, [holdings]);


  const sectorPieData = sectorMetric === "qty" ? sectorQtyData : sectorValueData;


  // Sector-wise net P&L (sold only)
  const sectorPLData = useMemo(() => {
    const m = {};
    investments.forEach(inv => {
      if (!inv.soldDate || !Number(inv.soldAmt)) return;
      const sec = inv.sector?.trim() || "Other";
      m[sec] = (m[sec] || 0) + (Number(inv.soldAmt) - Number(inv.buyAmt));
    });
    return Object.entries(m)
      .map(([name, NetPL]) => ({ name, NetPL: Number(NetPL.toFixed(2)) }))
      .sort((a, b) => b.NetPL - a.NetPL);
  }, [investments]);


  // Sold scrip net P&L
  const soldScripPLData = useMemo(() => {
    const m = {};
    investments.forEach(inv => {
      if (!inv.soldDate || !Number(inv.soldAmt)) return;
      const key = (inv.scrip || "").trim().toUpperCase();
      if (!m[key]) m[key] = { name: inv.scrip, NetPL: 0 };
      m[key].NetPL += Number(inv.soldAmt) - Number(inv.buyAmt);
    });
    return Object.values(m)
      .map(d => ({ ...d, NetPL: Number(d.NetPL.toFixed(2)) }))
      .sort((a, b) => b.NetPL - a.NetPL);
  }, [investments]);


  // ── Top movers among current holdings (unrealized) ───────
  const unrealizedMovers = useMemo(() => holdingsWithLive
    .filter(inv => Number(inv.buyRate) > 0)
    .map(inv => ({
      name: inv.scrip,
      pct: Number((pctChange(inv.ltp, inv.buyRate) ?? 0).toFixed(2)),
      pl: Number((unrealizedPL(inv) ?? 0).toFixed(2)),
    })), [holdingsWithLive]);


  const DEFAULT_MOVERS_SHOWN = 5;


  // Ranked by actual unrealized रु P&L (biggest money impact first),
  // not by % move — a large position up 5% now correctly outranks a
  // tiny position up 40%. % change is still shown on hover.
  const allGainersUnrealized = useMemo(() => (
    unrealizedMovers.filter(m => m.pl > 0).sort((a, b) => b.pl - a.pl)
  ), [unrealizedMovers]);


  const allLosersUnrealized = useMemo(() => (
    unrealizedMovers.filter(m => m.pl < 0).sort((a, b) => a.pl - b.pl)
  ), [unrealizedMovers]);


  const topGainersUnrealized = useMemo(
    () => allGainersUnrealized.slice(0, DEFAULT_MOVERS_SHOWN),
    [allGainersUnrealized]
  );
  const topLosersUnrealized = useMemo(
    () => allLosersUnrealized.slice(0, DEFAULT_MOVERS_SHOWN),
    [allLosersUnrealized]
  );


  const displayedGainers = showAllGainers ? allGainersUnrealized : topGainersUnrealized;
  const displayedLosers = showAllLosers ? allLosersUnrealized : topLosersUnrealized;


  const gainersChartH = Math.max(200, displayedGainers.length * 42);
  const losersChartH = Math.max(200, displayedLosers.length * 42);


  const sectorChartH = Math.max(180, sectorPLData.length * 52);
  const soldChartH = Math.max(180, soldScripPLData.length * 52);


  const moversTooltip = (v, _name, props) => {
    const pct = props.payload.pct;
    return [`${v >= 0 ? "+" : ""}रु${fmt(v)} (${pct >= 0 ? "+" : ""}${pct}%)`, "Unrealized"];
  };


  return (
    <div className="dashboard">
      {/* ── Info stat cards ── */}
      <div className="stat-grid">
        <StatCard label="Total Scrips" value={totalScrips} valueClass="v--blue" sub="Unique scrips invested" />
        <StatCard label="Total Investment" value={`रु${fmt(totalInvestment)}`} valueClass="v--blue" sub="Total capital deployed" />
        <StatCard label="Net P&L" value={realizedDisplay.text} valueClass={realizedDisplay.cls} sub="From sold investments" />
        <StatCard label="Holding" value={holdingCount} valueClass="v--blue" sub="Active positions" />
        <StatCard label="Sold" value={soldCount} valueClass="v--blue" sub="Exited positions" />
      </div>


      {/* ── Live portfolio metrics ── */}
      <div className="stat-grid">
        <StatCard label="Current Portfolio Value" value={`रु${fmt(currentPortfolioValue)}`} valueClass="v--blue" sub="Holdings at latest LTP" />
        <StatCard
          label="Unrealized P&L"
          value={holdings.length ? unrealizedDisplay.text : "—"}
          valueClass={holdings.length ? unrealizedDisplay.cls : ""}
          sub="Open positions, mark-to-market"
        />
        <StatCard
          label="Total Return"
          value={`${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(2)}%`}
          valueClass={totalReturnPct >= 0 ? "v--profit" : "v--loss"}
          sub="Realized + unrealized vs invested"
        />
        <StatCard
          label="Top Holding"
          value={concentration ? `${concentration.pct.toFixed(1)}%` : "—"}
          valueClass="v--purple"
          sub={concentration ? concentration.name : "No active holdings"}
        />
      </div>


      {concentration && concentration.pct >= 30 && (
        <div className="insight-banner insight-banner--warn">
          <span className="insight-banner__icon">⚠️</span>
          <span>
            {concentration.name} makes up {concentration.pct.toFixed(1)}% of your current holdings —
            consider diversifying to reduce concentration risk.
          </span>
        </div>
      )}


      {/* ── Realized vs Unrealized P&L ── */}
      <div className="chart-box">
        <div className="chart-box__title">Realized vs Unrealized P&amp;L</div>
        <div className="chart-box__sub">Locked-in gains/losses vs paper gains/losses on current holdings</div>
        {soldCount === 0 && holdings.length === 0 ? (
          <div className="chart-empty">No P&amp;L data yet — sell an investment or sync live prices to see this chart.</div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={[
                { name: "Realized", value: Number(totalNetPL.toFixed(2)) },
                { name: "Unrealized", value: Number(unrealizedPLTotal.toFixed(2)) },
              ]}
              layout="vertical"
              margin={{ top: 5, right: 20, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--b)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12, fill: "var(--fg)", fontWeight: 700 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={v => [`रु${fmt(v)}`, "P&L"]} contentStyle={tooltipStyle} cursor={false} />
              <Bar dataKey="value" radius={[0, 5, 5, 0]} name="P&L">
                <Cell fill={totalNetPL >= 0 ? "var(--g)" : "var(--r)"} />
                <Cell fill={unrealizedPLTotal >= 0 ? "var(--g)" : "var(--r)"} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>


      {/* ── Sector pie chart ── */}
      <div className="chart-box">
        <div className="chart-box__head">
          <div>
            <div className="chart-box__title">Portfolio by Sector</div>
            <div className="chart-box__sub">
              {sectorMetric === "qty"
                ? "Sector allocation by total quantity held across all investments"
                : "Sector allocation by current market value of active holdings"}
            </div>
          </div>
          <div className="toggle-group">
            <button
              className={`toggle-btn${sectorMetric === "qty" ? " toggle-btn--active" : ""}`}
              onClick={() => setSectorMetric("qty")}
            >
              By Qty
            </button>
            <button
              className={`toggle-btn${sectorMetric === "value" ? " toggle-btn--active" : ""}`}
              onClick={() => setSectorMetric("value")}
            >
              By Value
            </button>
          </div>
        </div>
        {sectorPieData.length === 0 ? (
          <div className="chart-empty">
            {sectorMetric === "qty"
              ? "No investment data yet — add investments to see sector breakdown."
              : "No active holdings yet — buy something to see value-based sector breakdown."}
          </div>
        ) : (
          <div className="pie-row">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={sectorPieData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={110} innerRadius={0}
                  paddingAngle={0} labelLine={false} label={renderPieLabel}
                  isAnimationActive={true} animationDuration={500}
                  animationEasing="linear" animationBegin={0}>
                  {sectorPieData.map((_, i) => (
                    <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]}
                      stroke="var(--bg)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, name) => [
                    sectorMetric === "qty" ? `${v.toLocaleString()} units` : `रु${fmt(v)}`,
                    name,
                  ]}
                  contentStyle={tooltipStyle}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-legend">
              {sectorPieData.map((d, i) => {
                const tot = sectorPieData.reduce((s, x) => s + x.value, 0);
                const pct = tot ? ((d.value / tot) * 100).toFixed(1) : 0;
                return (
                  <div key={d.name} className="pie-legend__item">
                    <span className="pie-legend__dot"
                      style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                    <span className="pie-legend__name">{d.name}</span>
                    <span className="pie-legend__val">
                      {sectorMetric === "qty" ? d.value.toLocaleString() : `रु${fmt(d.value)}`}
                      <span className="pie-legend__pct"> ({pct}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>


      {/* ── Sector-wise Net P&L ── */}
      <div className="chart-box">
        <div className="chart-box__title">Sector-wise Net P&amp;L</div>
        <div className="chart-box__sub">Net profit / loss realized per sector from sold investments</div>
        {sectorPLData.length === 0 ? (
          <div className="chart-empty">No sold investments to display sector P&amp;L.</div>
        ) : (
          <ResponsiveContainer width="100%" height={sectorChartH}>
            <BarChart data={sectorPLData} layout="vertical"
              margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--b)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted)" }}
                axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
              <YAxis type="category" dataKey="name" width={110}
                tick={{ fontSize: 12, fill: "var(--fg)", fontWeight: 700 }}
                axisLine={false} tickLine={false} />
              <Tooltip formatter={v => [`रु${fmt(v)}`, "Net P&L"]} contentStyle={tooltipStyle} cursor={false} />
              <Bar dataKey="NetPL" radius={[0, 5, 5, 0]} name="Net P&L">
                {sectorPLData.map((d, i) => (
                  <Cell key={i} fill={d.NetPL >= 0 ? "var(--g)" : "var(--r)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>


      {/* ── Sold script Net P&L ── */}
      <div className="chart-box">
        <div className="chart-box__title">Sold Script Net P&amp;L</div>
        <div className="chart-box__sub">Net profit / loss per script from all exited investment positions</div>
        {soldScripPLData.length === 0 ? (
          <div className="chart-empty">No sold investments yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={soldChartH}>
            <BarChart data={soldScripPLData} layout="vertical"
              margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--b)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted)" }}
                axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
              <YAxis type="category" dataKey="name" width={90}
                tick={{ fontSize: 12, fill: "var(--fg)", fontWeight: 700 }}
                axisLine={false} tickLine={false} />
              <Tooltip formatter={v => [`रु${fmt(v)}`, "Net P&L"]} contentStyle={tooltipStyle} cursor={false} />
              <Bar dataKey="NetPL" radius={[0, 5, 5, 0]} name="Net P&L">
                {soldScripPLData.map((d, i) => (
                  <Cell key={i} fill={d.NetPL >= 0 ? "var(--g)" : "var(--r)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>


      {/* ── Top movers among current holdings (unrealized) ── */}
      <div className="chart-row">
        <div className="chart-box">
          <div className="chart-box__head">
            <div>
              <div className="chart-box__title">📈 Top Gainers (Unrealized)</div>
              <div className="chart-box__sub">Best open positions by रु P&amp;L · hover for % change</div>
            </div>
            {allGainersUnrealized.length > DEFAULT_MOVERS_SHOWN && (
              <button
                className="toggle-btn"
                onClick={() => setShowAllGainers(v => !v)}
              >
                {showAllGainers ? "Show Top 5" : `View All (${allGainersUnrealized.length})`}
              </button>
            )}
          </div>
          {displayedGainers.length === 0 ? (
            <div className="chart-empty">No gaining open positions with live price data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={gainersChartH}>
              <BarChart data={displayedGainers} layout="vertical" margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--b)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 12, fill: "var(--fg)", fontWeight: 700 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={moversTooltip} contentStyle={tooltipStyle} cursor={false} />
                <Bar dataKey="pl" fill="var(--g)" radius={[0, 5, 5, 0]} name="Unrealized P&L" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="chart-box">
          <div className="chart-box__head">
            <div>
              <div className="chart-box__title">📉 Top Losers (Unrealized)</div>
              <div className="chart-box__sub">Worst open positions by रु P&amp;L · hover for % change</div>
            </div>
            {allLosersUnrealized.length > DEFAULT_MOVERS_SHOWN && (
              <button
                className="toggle-btn"
                onClick={() => setShowAllLosers(v => !v)}
              >
                {showAllLosers ? "Show Top 5" : `View All (${allLosersUnrealized.length})`}
              </button>
            )}
          </div>
          {displayedLosers.length === 0 ? (
            <div className="chart-empty">No losing open positions with live price data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={losersChartH}>
              <BarChart data={displayedLosers} layout="vertical" margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--b)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 12, fill: "var(--fg)", fontWeight: 700 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={moversTooltip} contentStyle={tooltipStyle} cursor={false} />
                <Bar dataKey="pl" fill="var(--r)" radius={[0, 5, 5, 0]} name="Unrealized P&L" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}


// ── MAIN DASHBOARD with switcher ───────────────────────────
export function Dashboard({ trades, investments = [] }) {
  const [mode, setMode] = useState("journal");


  return (
    <>
      <div className="dash-switcher">
        <button
          className={`dash-switch-btn${mode === "journal" ? " dash-switch-btn--active" : ""}`}
          onClick={() => setMode("journal")}
        >
          📝 Journal Dashboard
        </button>
        <button
          className={`dash-switch-btn${mode === "investment" ? " dash-switch-btn--active" : ""}`}
          onClick={() => setMode("investment")}
        >
          💼 Investment Dashboard
        </button>
      </div>


      {mode === "journal" && <JournalDashboard trades={trades} />}
      {mode === "investment" && <InvestmentDashboard investments={investments} />}
    </>
  );
}

