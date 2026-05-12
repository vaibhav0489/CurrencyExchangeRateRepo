import { useState, useEffect, useCallback, useRef } from "react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const HISTORY_KEY   = "inr_hist_v3";
const WATCH_KEY     = "inr_watch_v3";
const HISTORY_DAYS  = 20;
const REFRESH_MS    = 6 * 60 * 60 * 1000;

// ─── SECTOR DATA ─────────────────────────────────────────────────────────────
const SECTORS = [
  { name:"Information Technology", short:"IT",        icon:"💻", examples:"TCS · Infosys · Wipro · HCL Tech · Tech Mahindra", type:"EXPORTER",  bias:{WEAK:"LONG",  STRONG:"SHORT",   VOLATILE:"NEUTRAL", STABLE:"LONG"},    exitWeak:"Exit when USD/INR drops below 20-DMA or Nifty IT RSI > 75",            exitStrong:"Exit when USD/INR rises above resistance; IT revenue in INR shrinks" },
  { name:"Pharmaceuticals",        short:"PHARMA",    icon:"💊", examples:"Sun Pharma · Dr. Reddy's · Cipla · Divi's · Aurobindo", type:"EXPORTER",  bias:{WEAK:"LONG",  STRONG:"SHORT",   VOLATILE:"NEUTRAL", STABLE:"LONG"},    exitWeak:"Exit on INR reversal signal + pharma index RSI > 72",                   exitStrong:"Exit when rupee gains >2% in a month; export revenue compresses" },
  { name:"Specialty Chemicals",    short:"CHEM",      icon:"🧪", examples:"SRF · Aarti Ind · Navin Fluorine · GNFC · Deepak Nitrite", type:"EXPORTER",  bias:{WEAK:"LONG",  STRONG:"SHORT",   VOLATILE:"CAUTION", STABLE:"LONG"},    exitWeak:"Exit when crude reversal hits input costs + INR stabilizes",            exitStrong:"Exit on rupee appreciation >1.5%; export margins squeezed" },
  { name:"Metals & Mining",        short:"METALS",    icon:"⛏️", examples:"Tata Steel · JSW Steel · Hindalco · NMDC · Coal India",  type:"GLOBAL",    bias:{WEAK:"LONG",  STRONG:"NEUTRAL", VOLATILE:"CAUTION", STABLE:"LONG"},    exitWeak:"Exit when global commodity cycle turns; China demand slows",            exitStrong:"Exit on USD global strength; commodity prices fall in USD terms" },
  { name:"Aviation",               short:"AVIATION",  icon:"✈️", examples:"IndiGo (InterGlobe) · SpiceJet",                          type:"IMPORTER",  bias:{WEAK:"SHORT", STRONG:"LONG",    VOLATILE:"SHORT",   STABLE:"LONG"},    exitWeak:"Exit Short when USD/INR peaks; aviation RSI < 30 (oversold)",          exitStrong:"Exit Long when crude spikes or INR trend reverses again" },
  { name:"Oil & Gas (OMCs)",       short:"OMC",       icon:"🛢️", examples:"HPCL · BPCL · IOC · Reliance Industries",                type:"IMPORTER",  bias:{WEAK:"SHORT", STRONG:"LONG",    VOLATILE:"SHORT",   STABLE:"NEUTRAL"}, exitWeak:"Exit Short when govt announces price hike cushion or INR recovers",     exitStrong:"Exit Long if crude prices spike; double pressure on OMCs" },
  { name:"Consumer Durables",      short:"DURABLES",  icon:"📺", examples:"Voltas · Dixon Tech · Havells · Blue Star · Crompton",   type:"IMPORTER",  bias:{WEAK:"SHORT", STRONG:"LONG",    VOLATILE:"CAUTION", STABLE:"LONG"},    exitWeak:"Exit Short at INR stabilization or import duty hike buffers cost",     exitStrong:"Exit Long on demand slowdown or INR trend reversal" },
  { name:"Banking & NBFCs",        short:"BANKING",   icon:"🏦", examples:"HDFC Bank · ICICI · SBI · Kotak · Bajaj Finance",        type:"RATE",      bias:{WEAK:"CAUTION",STRONG:"LONG",   VOLATILE:"SHORT",   STABLE:"LONG"},    exitWeak:"Exit when RBI hikes aggressively to defend INR; NIM squeeze",          exitStrong:"Exit if FII flows reverse; banking index breaks key support" },
  { name:"Real Estate",            short:"REALTY",    icon:"🏗️", examples:"DLF · Macrotech (Lodha) · Godrej Props · Prestige",     type:"RATE",      bias:{WEAK:"CAUTION",STRONG:"LONG",   VOLATILE:"SHORT",   STABLE:"LONG"},    exitWeak:"Exit on rate hike cycle; INR weakness → RBI tightens → EMIs rise",    exitStrong:"Exit if FII debt outflows spike or liquidity tightens" },
  { name:"Capital Goods & Infra",  short:"CAPGOODS",  icon:"⚙️", examples:"L&T · ABB India · Siemens · BHEL · Thermax",            type:"MIXED",     bias:{WEAK:"NEUTRAL",STRONG:"LONG",   VOLATILE:"CAUTION", STABLE:"LONG"},    exitWeak:"Exit if order inflows slow; input cost pressure from weak INR",        exitStrong:"Exit when capex cycle peaks or govt spending decelerates" },
  { name:"FMCG & Staples",         short:"FMCG",      icon:"🛒", examples:"HUL · Nestlé India · ITC · Britannia · Dabur",          type:"DEFENSIVE", bias:{WEAK:"NEUTRAL",STRONG:"NEUTRAL",VOLATILE:"LONG",    STABLE:"NEUTRAL"}, exitWeak:"Exit defensive when volatility subsides; rotate to cyclicals",         exitStrong:"FMCG underperforms bull runs; switch to cyclicals" },
  { name:"Auto & Ancillaries",     short:"AUTO",      icon:"🚗", examples:"Maruti · M&M · Bajaj Auto · Hero MotoCorp · Minda",     type:"MIXED",     bias:{WEAK:"CAUTION",STRONG:"LONG",   VOLATILE:"CAUTION", STABLE:"LONG"},    exitWeak:"Exit on input cost spike (steel/rubber imports) + weak rural demand",  exitStrong:"Exit if credit growth slows or EV disruption accelerates" },
];

const TYPE_META = {
  EXPORTER:  { label:"EXPORTER",   color:"#22d3ee", bg:"rgba(34,211,238,0.1)"  },
  IMPORTER:  { label:"IMPORTER",   color:"#f87171", bg:"rgba(248,113,113,0.1)" },
  RATE:      { label:"RATE SENS.", color:"#fbbf24", bg:"rgba(251,191,36,0.1)"  },
  MIXED:     { label:"MIXED",      color:"#c084fc", bg:"rgba(192,132,252,0.1)" },
  DEFENSIVE: { label:"DEFENSIVE",  color:"#34d399", bg:"rgba(52,211,153,0.1)"  },
  GLOBAL:    { label:"GLOBAL",     color:"#a78bfa", bg:"rgba(167,139,250,0.1)" },
};

const SIG = {
  LONG:    { label:"▲ LONG",    color:"#4ade80", bg:"rgba(74,222,128,0.12)",  border:"#4ade8060" },
  SHORT:   { label:"▼ SHORT",   color:"#f87171", bg:"rgba(248,113,113,0.12)", border:"#f8717160" },
  NEUTRAL: { label:"— NEUTRAL", color:"#94a3b8", bg:"rgba(148,163,184,0.08)", border:"#47556960" },
  CAUTION: { label:"⚠ CAUTION", color:"#fbbf24", bg:"rgba(251,191,36,0.12)",  border:"#fbbf2460" },
};

const REGIME_UI = {
  WEAK:     { label:"INR WEAKENING",     icon:"📉", color:"#f87171", glow:"rgba(248,113,113,0.12)" },
  STRONG:   { label:"INR STRENGTHENING", icon:"📈", color:"#4ade80", glow:"rgba(74,222,128,0.12)"  },
  VOLATILE: { label:"HIGH VOLATILITY",   icon:"⚡", color:"#fbbf24", glow:"rgba(251,191,36,0.12)"  },
  STABLE:   { label:"STABLE / SIDEWAYS", icon:"➡️", color:"#818cf8", glow:"rgba(129,140,248,0.12)" },
};

// ─── REGIME DETECTION ────────────────────────────────────────────────────────
function detectRegime(history) {
  if (!history || history.length < 2) return { regime:"STABLE", reason:"Loading data…", dailyChange:0, vsAvg:0, volatilityPct:0, latest:0, avg20:0 };
  const rates    = history.map(h => h.rate);
  const latest   = rates[rates.length - 1];
  const prev     = rates[rates.length - 2];
  const avg20    = rates.reduce((a,b) => a+b, 0) / rates.length;
  const dailyChange   = ((latest - prev) / prev) * 100;
  const vsAvg         = ((latest - avg20) / avg20) * 100;
  const last5         = rates.slice(-5);
  const mean5         = last5.reduce((a,b) => a+b, 0) / last5.length;
  const volatilityPct = Math.sqrt(last5.reduce((a,b) => a + Math.pow(b-mean5,2), 0) / last5.length) / mean5 * 100;

  if (volatilityPct > 0.4 || Math.abs(dailyChange) > 0.6)
    return { regime:"VOLATILE", reason:`Daily Δ ${dailyChange.toFixed(3)}% | 5-day StdDev ${volatilityPct.toFixed(3)}%`, dailyChange, vsAvg, volatilityPct, latest, avg20 };
  if (vsAvg > 0.5 || dailyChange > 0.25)
    return { regime:"WEAK",     reason:`INR ${vsAvg.toFixed(3)}% above 20-DMA | Daily +${dailyChange.toFixed(3)}%`,        dailyChange, vsAvg, volatilityPct, latest, avg20 };
  if (vsAvg < -0.5 || dailyChange < -0.25)
    return { regime:"STRONG",   reason:`INR ${Math.abs(vsAvg).toFixed(3)}% below 20-DMA | Daily ${dailyChange.toFixed(3)}%`, dailyChange, vsAvg, volatilityPct, latest, avg20 };
  return   { regime:"STABLE",   reason:`INR sideways | vs 20-DMA: ${vsAvg.toFixed(3)}%`,                                   dailyChange, vsAvg, volatilityPct, latest, avg20 };
}

// ─── STORAGE HELPERS ─────────────────────────────────────────────────────────
const loadJSON = (key, def) => { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } };
const saveJSON = (key, val)  => { try { localStorage.setItem(key, JSON.stringify(val)); }   catch {} };

// ─── FETCH VIA ANTHROPIC API (web_search tool — no CORS issues) ──────────────
async function fetchLiveRate() {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{
        role: "user",
        content: `Search for the current USD to INR exchange rate right now.
Return ONLY a valid JSON object, nothing else, no markdown:
{"rate": <number>, "date": "<YYYY-MM-DD>", "source": "<source name>"}`
      }]
    })
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const data = await res.json();

  // extract text from all content blocks
  const text = data.content
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("");

  // parse JSON from response
  const match = text.match(/\{[\s\S]*?"rate"[\s\S]*?\}/);
  if (!match) throw new Error("Could not parse rate from response");
  const parsed = JSON.parse(match[0]);
  if (!parsed.rate || isNaN(parsed.rate)) throw new Error("Invalid rate value");
  return { rate: parseFloat(parsed.rate), date: parsed.date || new Date().toISOString().split("T")[0], source: parsed.source || "web search" };
}

// Also fetch 20-day history via Anthropic API
async function fetchHistory20() {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{
        role: "user",
        content: `Search for USD to INR exchange rate history for the past 20 trading days.
Return ONLY a valid JSON array, no markdown, no explanation:
[{"date":"YYYY-MM-DD","rate":85.00}, ...]
Include exactly 20 entries sorted oldest to newest.`
      }]
    })
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const data = await res.json();
  const text = data.content.filter(b => b.type === "text").map(b => b.text).join("");
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) throw new Error("Could not parse history");
  const arr = JSON.parse(match[0]);
  return arr.filter(e => e.date && e.rate).map(e => ({ date: e.date, rate: parseFloat(e.rate), ts: Date.now() }));
}

// ─── CHART ───────────────────────────────────────────────────────────────────
function AreaChart({ data, color }) {
  if (!data || data.length < 2) return null;
  const W = 600, H = 80, px = 6, py = 8;
  const vals = data.map(d => d.rate);
  const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 0.01;
  const toX = i => px + (i / (vals.length-1)) * (W - px*2);
  const toY = v => H - py - ((v-mn)/rng) * (H - py*2);
  const pts = vals.map((v,i) => `${toX(i)},${toY(v)}`).join(" ");
  const area = `M ${toX(0)},${toY(vals[0])} ${vals.map((v,i)=>`L ${toX(i)},${toY(v)}`).join(" ")} L ${toX(vals.length-1)},${H} L ${toX(0)},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:H, display:"block" }}>
      <defs>
        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      <path d={area} fill="url(#ag)"/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
      {/* High / Low markers */}
      {[{v:mx,label:`H:${mx.toFixed(2)}`},{v:mn,label:`L:${mn.toFixed(2)}`}].map(({v,label})=>{
        const xi = vals.indexOf(v); const x=toX(xi); const y=toY(v);
        return <g key={label}><circle cx={x} cy={y} r="3" fill={color}/><text x={x+5} y={y+4} fill={color} fontSize="9" fontFamily="JetBrains Mono,monospace">{label}</text></g>;
      })}
    </svg>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [history,   setHistory]   = useState(() => loadJSON(HISTORY_KEY, []));
  const [watchlist, setWatchlist] = useState(() => loadJSON(WATCH_KEY, []));
  const [status,    setStatus]    = useState("idle");   // idle | loading | error | ok
  const [errMsg,    setErrMsg]    = useState("");
  const [lastFetch, setLastFetch] = useState(null);
  const [openExit,  setOpenExit]  = useState(null);
  const [filter,    setFilter]    = useState("ALL");
  const [tab,       setTab]       = useState("SIGNALS");
  const [pulse,     setPulse]     = useState(false);
  const [fetchStep, setFetchStep] = useState("");
  const timer = useRef(null);

  // ── helpers ──
  const pushHistory = useCallback((entries) => {
    setHistory(prev => {
      const map = new Map(prev.map(h => [h.date, h]));
      entries.forEach(e => map.set(e.date, e));
      const sorted = [...map.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-HISTORY_DAYS);
      saveJSON(HISTORY_KEY, sorted);
      return sorted;
    });
  }, []);

  // ── fetch latest rate only ──
  const doFetchRate = useCallback(async () => {
    setStatus("loading"); setErrMsg(""); setFetchStep("Searching live USD/INR rate…");
    try {
      const entry = await fetchLiveRate();
      pushHistory([{ ...entry, ts: Date.now() }]);
      setLastFetch(new Date());
      setStatus("ok");
      setPulse(true); setTimeout(() => setPulse(false), 1400);
      setFetchStep("");
    } catch(e) {
      setStatus("error"); setErrMsg(e.message); setFetchStep("");
    }
  }, [pushHistory]);

  // ── fetch full 20-day history ──
  const doFetchHistory = useCallback(async () => {
    setStatus("loading"); setErrMsg(""); setFetchStep("Fetching 20-day USD/INR history…");
    try {
      const entries = await fetchHistory20();
      pushHistory(entries);
      setLastFetch(new Date());
      setStatus("ok"); setFetchStep("");
      setPulse(true); setTimeout(() => setPulse(false), 1400);
    } catch(e) {
      // fall back to just latest rate
      setFetchStep("History fetch failed, getting latest rate…");
      try {
        const entry = await fetchLiveRate();
        pushHistory([{ ...entry, ts: Date.now() }]);
        setLastFetch(new Date());
        setStatus("ok"); setFetchStep("");
      } catch(e2) {
        setStatus("error"); setErrMsg(e2.message); setFetchStep("");
      }
    }
  }, [pushHistory]);

  // ── on mount ──
  useEffect(() => {
    if (history.length < 5) doFetchHistory();
    else doFetchRate();
    timer.current = setInterval(doFetchRate, REFRESH_MS);
    return () => clearInterval(timer.current);
  }, []);

  const { regime, reason, dailyChange, vsAvg, volatilityPct, latest, avg20 } = detectRegime(history);
  const ru = REGIME_UI[regime];
  const prevRate   = history.length > 1 ? history[history.length-2].rate : null;
  const rateChange = latest && prevRate ? ((latest-prevRate)/prevRate*100) : null;
  const counts     = { LONG:0, SHORT:0, NEUTRAL:0, CAUTION:0 };
  SECTORS.forEach(s => counts[s.bias[regime]]++);

  const toggleWatch = name => {
    setWatchlist(prev => {
      const n = prev.includes(name) ? prev.filter(x=>x!==name) : [...prev,name];
      saveJSON(WATCH_KEY, n); return n;
    });
  };

  const visible = SECTORS.filter(s => {
    if (tab==="WATCHLIST") return watchlist.includes(s.name);
    if (filter==="ALL") return true;
    return s.bias[regime] === filter;
  });

  const mono = { fontFamily:"'JetBrains Mono',monospace" };

  return (
    <div style={{ minHeight:"100vh", background:"#03060e", color:"#e2e8f0", fontFamily:"'Syne',sans-serif", padding:0 }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet"/>

      {/* ── STATUS BAR ── */}
      <div style={{ background:"#060c18", borderBottom:"1px solid #0e1e32", padding:"8px 24px", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:7, height:7, borderRadius:"50%",
            background: status==="loading"?"#fbbf24": status==="error"?"#f87171":"#4ade80",
            boxShadow:`0 0 6px ${status==="loading"?"#fbbf24":status==="error"?"#f87171":"#4ade80"}`,
            animation: status==="ok"?"blink 2.5s infinite":"none"
          }}/>
          <span style={{ ...mono, fontSize:10, color:"#334155", letterSpacing:"1.5px" }}>
            {status==="loading"? fetchStep || "FETCHING…" : status==="error"?"API ERROR":"LIVE · AUTO-REFRESH 6H"}
          </span>
        </div>
        <span style={{ ...mono, fontSize:10, color:"#1a2e4a" }}>SOURCE: ANTHROPIC WEB SEARCH · USD/INR</span>
        <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
          {lastFetch && <span style={{ ...mono, fontSize:10, color:"#1e3a5f" }}>Updated {lastFetch.toLocaleTimeString("en-IN")}</span>}
          <button onClick={doFetchRate} disabled={status==="loading"} style={{ ...mono, background:"rgba(99,102,241,0.12)", border:"1px solid #312e81", borderRadius:5, padding:"3px 10px", color:"#818cf8", fontSize:10, cursor:status==="loading"?"not-allowed":"pointer", outline:"none" }}>
            {status==="loading"?"…":"↺ REFRESH"}
          </button>
          <button onClick={doFetchHistory} disabled={status==="loading"} style={{ ...mono, background:"rgba(16,185,129,0.08)", border:"1px solid #064e3b", borderRadius:5, padding:"3px 10px", color:"#34d399", fontSize:10, cursor:status==="loading"?"not-allowed":"pointer", outline:"none" }}>
            ↓ 20D HISTORY
          </button>
        </div>
      </div>

      <div style={{ maxWidth:1080, margin:"0 auto", padding:"28px 18px" }}>

        {/* ── HEADER ── */}
        <div style={{ marginBottom:24 }}>
          <div style={{ ...mono, fontSize:9, letterSpacing:"3px", color:"#1a2e4a", marginBottom:6 }}>NSE INDIA · LIVE MACRO ENGINE</div>
          <h1 style={{ margin:0, fontSize:"clamp(20px,3.5vw,34px)", fontWeight:800, letterSpacing:"-0.8px",
            background:"linear-gradient(130deg,#f1f5f9 0%,#64748b 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            INR Currency Signal Dashboard
          </h1>
          <p style={{ margin:"5px 0 0", color:"#334155", fontSize:12 }}>
            Live rate via AI web search → 20-day regime model → automated sector bias
          </p>
        </div>

        {/* ── ERROR BANNER ── */}
        {status==="error" && (
          <div style={{ background:"rgba(248,113,113,0.07)", border:"1px solid #f8717125", borderRadius:8, padding:"10px 16px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ ...mono, color:"#f87171", fontSize:12 }}>⚠ {errMsg}</span>
            <button onClick={doFetchRate} style={{ ...mono, background:"rgba(248,113,113,0.15)", border:"1px solid #f8717140", borderRadius:5, padding:"4px 10px", color:"#f87171", fontSize:11, cursor:"pointer", outline:"none" }}>Retry</button>
          </div>
        )}

        {/* ── METRIC CARDS ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
          {[
            { label:"USD / INR",   value: latest ? latest.toFixed(4) : "—",           sub: rateChange!=null?`${rateChange>=0?"+":""}${rateChange.toFixed(3)}% today`:"fetching…", subColor: rateChange==null?"#334155":rateChange>0?"#f87171":"#4ade80", glow: pulse },
            { label:"20-DAY AVG",  value: avg20   ? avg20.toFixed(4)  : "—",           sub: vsAvg!=0?`${vsAvg>0?"WEAK":"STRONG"} ${Math.abs(vsAvg).toFixed(2)}% vs avg`:"—",      subColor: vsAvg>0?"#f87171":"#4ade80" },
            { label:"VOLATILITY",  value: volatilityPct?`${volatilityPct.toFixed(3)}%`:"—", sub: volatilityPct>0.4?"HIGH — caution":"Normal range",                               subColor: volatilityPct>0.4?"#fbbf24":"#4ade80" },
            { label:"HISTORY PTS", value: history.length, sub:`of ${HISTORY_DAYS} days`,                                                                                          subColor:"#475569" },
          ].map((c,i)=>(
            <div key={i} style={{ background:"rgba(255,255,255,0.02)", border:`1px solid ${c.glow?"#6366f1":"#0e1e32"}`, borderRadius:10, padding:"13px 15px", boxShadow:c.glow?"0 0 18px rgba(99,102,241,0.18)":"none", transition:"all 0.4s" }}>
              <div style={{ ...mono, fontSize:8, letterSpacing:"2px", color:"#2a3f5f", marginBottom:5 }}>{c.label}</div>
              <div style={{ ...mono, fontSize:20, fontWeight:700, color:"#f1f5f9" }}>{c.value}</div>
              <div style={{ fontSize:11, color:c.subColor, marginTop:3 }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* ── SPARKLINE CHART ── */}
        {history.length > 3 && (
          <div style={{ background:"rgba(255,255,255,0.018)", border:"1px solid #0e1e32", borderRadius:10, padding:"14px 18px", marginBottom:16 }}>
            <div style={{ ...mono, fontSize:8, letterSpacing:"2px", color:"#2a3f5f", marginBottom:8 }}>
              USD/INR — {history.length}-DAY TREND &nbsp;·&nbsp; {history[0]?.date} → {history[history.length-1]?.date}
            </div>
            <AreaChart data={history} color={ru.color}/>
          </div>
        )}

        {/* ── REGIME BANNER ── */}
        <div style={{ background:ru.glow, border:`1px solid ${ru.color}25`, borderLeft:`4px solid ${ru.color}`, borderRadius:10, padding:"15px 18px", marginBottom:18, display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
          <span style={{ fontSize:26 }}>{ru.icon}</span>
          <div style={{ flex:1 }}>
            <div style={{ ...mono, fontSize:8, letterSpacing:"3px", color:ru.color, marginBottom:2 }}>AUTO-DETECTED REGIME</div>
            <div style={{ fontSize:18, fontWeight:800, color:"#f1f5f9" }}>{ru.label}</div>
            <div style={{ fontSize:12, color:"#475569", marginTop:2 }}>{reason}</div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 14px" }}>
            {["LONG","SHORT","CAUTION","NEUTRAL"].map(k=>(
              <div key={k} style={{ ...mono, fontSize:11 }}>
                <span style={{ color:SIG[k].color }}>{counts[k]}</span>
                <span style={{ color:"#334155", marginLeft:5 }}>{k}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{ display:"flex", gap:5, marginBottom:14, borderBottom:"1px solid #0e1e32", paddingBottom:10, flexWrap:"wrap" }}>
          {[["SIGNALS","Sector Signals"],["LIVE","Rate Log"],["WATCHLIST",`Watchlist (${watchlist.length})`]].map(([t,lbl])=>(
            <button key={t} onClick={()=>setTab(t)} style={{ ...mono, background:tab===t?"rgba(99,102,241,0.14)":"transparent", border:`1px solid ${tab===t?"#6366f1":"transparent"}`, borderRadius:6, padding:"5px 13px", cursor:"pointer", color:tab===t?"#818cf8":"#3a5070", fontSize:11, fontWeight:600, outline:"none" }}>
              {lbl}
            </button>
          ))}
          {tab==="SIGNALS" && (
            <div style={{ marginLeft:"auto", display:"flex", gap:5, flexWrap:"wrap" }}>
              {["ALL","LONG","SHORT","CAUTION","NEUTRAL"].map(f=>(
                <button key={f} onClick={()=>setFilter(f)} style={{ ...mono, background:filter===f?(SIG[f]?.bg||"rgba(99,102,241,0.12)"):"transparent", border:`1px solid ${filter===f?(SIG[f]?.border||"#6366f1"):"#0e1e32"}`, borderRadius:5, padding:"3px 9px", cursor:"pointer", color:filter===f?(SIG[f]?.color||"#818cf8"):"#2a3f5f", fontSize:9, fontWeight:700, letterSpacing:"1px", outline:"none" }}>
                  {f}{f!=="ALL"?` (${counts[f]||0})`:""}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── SIGNALS / WATCHLIST ── */}
        {(tab==="SIGNALS"||tab==="WATCHLIST") && (
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <div style={{ display:"grid", gridTemplateColumns:"34px 1fr 98px 98px 62px 40px", gap:8, padding:"3px 12px", ...mono, fontSize:8, letterSpacing:"2px", color:"#1a2e4a" }}>
              <span/><span>SECTOR</span><span>TYPE</span><span>SIGNAL</span><span>EXIT</span><span style={{textAlign:"center"}}>★</span>
            </div>

            {visible.length===0 && (
              <div style={{ textAlign:"center", padding:40, ...mono, fontSize:12, color:"#334155" }}>
                {tab==="WATCHLIST"?"No starred sectors — click ☆ to add.":"No sectors match filter."}
              </div>
            )}

            {visible.map((s,i)=>{
              const sig = s.bias[regime];
              const sm  = SIG[sig], tm = TYPE_META[s.type];
              const inW = watchlist.includes(s.name);
              const isO = openExit===s.name;
              const exitText = (regime==="WEAK"||regime==="VOLATILE") ? s.exitWeak : s.exitStrong;
              return (
                <div key={s.name} style={{ background:inW?"rgba(99,102,241,0.04)":"rgba(255,255,255,0.018)", border:`1px solid ${inW?"#25245a":"#0e1e32"}`, borderRadius:10, overflow:"hidden", animation:`fadeUp 0.28s ease ${i*28}ms both` }}>
                  <div style={{ display:"grid", gridTemplateColumns:"34px 1fr 98px 98px 62px 40px", gap:8, padding:"12px 12px", alignItems:"center" }}>
                    <span style={{ fontSize:18 }}>{s.icon}</span>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13, color:"#f1f5f9" }}>{s.name}</div>
                      <div style={{ color:"#2a3f5f", fontSize:11, marginTop:1 }}>{s.examples}</div>
                    </div>
                    <span style={{ ...mono, background:tm.bg, color:tm.color, fontSize:8, letterSpacing:"0.5px", fontWeight:700, padding:"3px 6px", borderRadius:3, display:"inline-block" }}>{tm.label}</span>
                    <span style={{ ...mono, background:sm.bg, border:`1px solid ${sm.border}`, color:sm.color, fontSize:11, fontWeight:700, padding:"4px 8px", borderRadius:5, display:"inline-block" }}>{sm.label}</span>
                    <button onClick={()=>setOpenExit(isO?null:s.name)} style={{ ...mono, background:isO?"rgba(239,68,68,0.1)":"rgba(255,255,255,0.04)", border:`1px solid ${isO?"#f8717140":"#0e1e32"}`, borderRadius:6, padding:"4px 0", cursor:"pointer", color:isO?"#f87171":"#334155", fontSize:10, fontWeight:700, outline:"none", width:"100%" }}>
                      {isO?"HIDE":"EXIT"}
                    </button>
                    <button onClick={()=>toggleWatch(s.name)} style={{ background:inW?"rgba(99,102,241,0.18)":"transparent", border:`1px solid ${inW?"#6366f1":"#0e1e32"}`, borderRadius:6, padding:4, cursor:"pointer", color:inW?"#818cf8":"#2a3f5f", fontSize:15, outline:"none", width:"100%", textAlign:"center" }}>
                      {inW?"★":"☆"}
                    </button>
                  </div>
                  {isO && (
                    <div style={{ background:"rgba(239,68,68,0.04)", borderTop:"1px solid #0e1e32", padding:"10px 12px 10px 54px", display:"flex", gap:10, alignItems:"flex-start" }}>
                      <span style={{ fontSize:14, marginTop:2 }}>🚨</span>
                      <div>
                        <div style={{ ...mono, fontSize:8, letterSpacing:"2px", color:"#fbbf24", marginBottom:3 }}>EXIT TRIGGER — {regime} REGIME</div>
                        <div style={{ color:"#cbd5e1", fontSize:13, lineHeight:1.6 }}>{exitText}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── LIVE LOG ── */}
        {tab==="LIVE" && (
          <div style={{ background:"rgba(255,255,255,0.018)", border:"1px solid #0e1e32", borderRadius:10, overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", padding:"9px 16px", background:"rgba(255,255,255,0.025)", borderBottom:"1px solid #0a1525", ...mono, fontSize:8, letterSpacing:"2px", color:"#2a3f5f" }}>
              <span>DATE</span><span>USD/INR</span><span>DAILY Δ</span><span>REGIME</span>
            </div>
            {history.length===0 && (
              <div style={{ padding:40, textAlign:"center", ...mono, fontSize:12, color:"#334155" }}>No data yet — click ↺ REFRESH</div>
            )}
            {[...history].reverse().map((h,i)=>{
              const pv  = history[history.length-2-i];
              const chg = pv ? ((h.rate-pv.rate)/pv.rate*100) : null;
              const sub = history.slice(0, history.length-i);
              const r   = detectRegime(sub).regime;
              const ru2 = REGIME_UI[r];
              return (
                <div key={h.date} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", padding:"9px 16px", borderBottom:"1px solid #080f1e", background:i===0?"rgba(99,102,241,0.05)":"transparent", alignItems:"center" }}>
                  <span style={{ ...mono, fontSize:12, color:i===0?"#818cf8":"#334155" }}>{h.date}{i===0?" ◀":""}</span>
                  <span style={{ ...mono, fontSize:14, fontWeight:700, color:"#f1f5f9" }}>{h.rate.toFixed(4)}</span>
                  <span style={{ ...mono, fontSize:12, color:chg==null?"#334155":chg>0?"#f87171":"#4ade80" }}>{chg!=null?`${chg>=0?"+":""}${chg.toFixed(3)}%`:"—"}</span>
                  <span style={{ ...mono, fontSize:9, color:ru2.color, background:`${ru2.color}15`, padding:"3px 7px", borderRadius:4, display:"inline-block" }}>{ru2.icon} {ru2.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── FOOTER ── */}
        <div style={{ marginTop:24, paddingTop:14, borderTop:"1px solid #0e1e32", display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:6 }}>
          <span style={{ ...mono, fontSize:9, color:"#1a2e4a" }}>DATA · ANTHROPIC WEB SEARCH · USD/INR · FREE</span>
          <span style={{ ...mono, fontSize:9, color:"#1a2e4a" }}>ALGO · 20-DMA + STDDEV VOLATILITY · NOT FINANCIAL ADVICE</span>
        </div>
      </div>

      <style>{`
        @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(7px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}
