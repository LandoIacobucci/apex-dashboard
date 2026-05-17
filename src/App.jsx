import { useState, useEffect, useRef, useCallback } from "react";

// ─── Backend URL — points at your Mythic Beasts server ───────────────────────
const API_BASE = "https://apextrading.chickenkiller.com";

// ─── Mobile detection ─────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

// ─── Universe (display only — agent manages the actual trading) ───────────────
const UNIVERSE = [
  {sym:"AAPL",name:"Apple",exch:"NASDAQ",sector:"Technology"},
  {sym:"MSFT",name:"Microsoft",exch:"NASDAQ",sector:"Technology"},
  {sym:"NVDA",name:"NVIDIA",exch:"NASDAQ",sector:"Semiconductors"},
  {sym:"AMZN",name:"Amazon",exch:"NASDAQ",sector:"E-Commerce/Cloud"},
  {sym:"GOOGL",name:"Alphabet",exch:"NASDAQ",sector:"Advertising/AI"},
  {sym:"META",name:"Meta",exch:"NASDAQ",sector:"Social/AR"},
  {sym:"TSLA",name:"Tesla",exch:"NASDAQ",sector:"EV/Energy"},
  {sym:"AMD",name:"AMD",exch:"NASDAQ",sector:"Semiconductors"},
  {sym:"AVGO",name:"Broadcom",exch:"NASDAQ",sector:"Semiconductors"},
  {sym:"ORCL",name:"Oracle",exch:"NYSE",sector:"Enterprise Software"},
  {sym:"CRM",name:"Salesforce",exch:"NYSE",sector:"Enterprise Software"},
  {sym:"ADBE",name:"Adobe",exch:"NASDAQ",sector:"Software"},
  {sym:"NFLX",name:"Netflix",exch:"NASDAQ",sector:"Streaming"},
  {sym:"PYPL",name:"PayPal",exch:"NASDAQ",sector:"Fintech"},
  {sym:"INTC",name:"Intel",exch:"NASDAQ",sector:"Semiconductors"},
  {sym:"QCOM",name:"Qualcomm",exch:"NASDAQ",sector:"Semiconductors"},
  {sym:"JPM",name:"JPMorgan",exch:"NYSE",sector:"Banking"},
  {sym:"GS",name:"Goldman Sachs",exch:"NYSE",sector:"Banking"},
  {sym:"V",name:"Visa",exch:"NYSE",sector:"Payments"},
  {sym:"MA",name:"Mastercard",exch:"NYSE",sector:"Payments"},
  {sym:"UNH",name:"UnitedHealth",exch:"NYSE",sector:"Healthcare"},
  {sym:"LLY",name:"Eli Lilly",exch:"NYSE",sector:"Pharma"},
  {sym:"XOM",name:"ExxonMobil",exch:"NYSE",sector:"Energy"},
  {sym:"COST",name:"Costco",exch:"NASDAQ",sector:"Retail"},
  {sym:"HD",name:"Home Depot",exch:"NYSE",sector:"Retail"},
  {sym:"DIS",name:"Disney",exch:"NYSE",sector:"Media/Entertainment"},
  {sym:"PLTR",name:"Palantir",exch:"NYSE",sector:"AI/Defence"},
  {sym:"ARM",name:"Arm Holdings",exch:"NASDAQ",sector:"Semiconductors"},
  {sym:"SNOW",name:"Snowflake",exch:"NYSE",sector:"Cloud Data"},
  {sym:"UBER",name:"Uber",exch:"NYSE",sector:"Mobility"},
  {sym:"ABNB",name:"Airbnb",exch:"NASDAQ",sector:"Travel/Tech"},
  {sym:"SPOT",name:"Spotify",exch:"NYSE",sector:"Streaming"},
  {sym:"COIN",name:"Coinbase",exch:"NASDAQ",sector:"Crypto/Fintech"},
  {sym:"SHOP",name:"Shopify",exch:"NYSE",sector:"E-Commerce"},
];

// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiFetch(path) {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function apiPost(path) {
  try {
    const res = await fetch(`${API_BASE}${path}`, { method: "POST" });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ─── Spark line ───────────────────────────────────────────────────────────────
function Spark({ data, w=70, h=24, color="#22d3a0" }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v,i) => `${(i/(data.length-1))*w},${h-((v-min)/range)*h}`).join(" ");
  return <svg width={w} height={h} style={{display:"block"}}><polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}/></svg>;
}

// ─── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({ score, max=100 }) {
  const pct = Math.min(100, (score/max)*100);
  const color = pct>70?"#22d3a0":pct>45?"#f59e0b":"#f43f6a";
  return (
    <div style={{display:"flex",alignItems:"center",gap:5}}>
      <div style={{flex:1,height:3,background:"#0d1828",borderRadius:2}}>
        <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:2,transition:"width .4s"}}/>
      </div>
      <span style={{fontSize:9,color,fontWeight:500,minWidth:22,textAlign:"right"}}>{Math.round(score)}</span>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toasts, dismiss }) {
  return (
    <div style={{position:"fixed",bottom:20,right:20,zIndex:1000,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
      {toasts.map(t => (
        <div key={t.id} onClick={() => dismiss(t.id)}
          style={{background:"#0a1520",border:`1px solid ${t.type==="BUY"?"#22d3a0":t.type==="SELL"||t.type==="PROFIT"?"#86efac":t.type==="STOP"?"#f43f6a":"#1e3a5a"}`,borderRadius:4,padding:"12px 16px",minWidth:260,maxWidth:320,pointerEvents:"all",cursor:"pointer",animation:"slideIn .25s ease"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontFamily:"'Syne Mono'",fontSize:11,color:t.type==="BUY"?"#22d3a0":t.type==="SELL"||t.type==="PROFIT"?"#86efac":t.type==="STOP"?"#f43f6a":"#6b7280",letterSpacing:1}}>{t.type}</span>
              <span style={{fontSize:12,color:"#c8d6e5",fontWeight:500}}>{t.sym}</span>
            </div>
            <span style={{fontSize:9,color:"#2a4a6a"}}>tap to dismiss</span>
          </div>
          <div style={{fontSize:10,color:"#6b7a8a",lineHeight:1.6}}>{t.message}</div>
          {t.pnl !== undefined && (
            <div style={{marginTop:4,fontSize:11,fontWeight:600,color:parseFloat(t.pnl)>=0?"#22d3a0":"#f43f6a"}}>
              {parseFloat(t.pnl)>=0?"+":""}£{t.pnl} P&L
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Connection banner ────────────────────────────────────────────────────────
function ConnBanner({ connected }) {
  if (connected) return null;
  return (
    <div style={{background:"rgba(244,63,106,.15)",borderBottom:"1px solid rgba(244,63,106,.3)",padding:"6px 18px",fontSize:9,color:"#f43f6a",letterSpacing:1,textAlign:"center"}} className="pulse">
      ⚠ DISCONNECTED FROM SERVER — reconnecting...
    </div>
  );
}

// ─── Mobile View ──────────────────────────────────────────────────────────────
function MobileView({ serverState, connected, agentRunning, startAgent, stopAgent }) {
  const [mobileTab, setMobileTab] = useState("stocks");
  const [selectedSym, setSelectedSym] = useState(null);

  const phase          = serverState?.phase || "idle";
  const account        = serverState?.account || {};
  const positions      = serverState?.positions || {};
  const prices         = serverState?.prices || {};
  const shortlist      = serverState?.shortlist || [];
  const research       = serverState?.research || {};
  const audit          = serverState?.audit || [];
  const apiCost        = serverState?.apiCost || 0;
  const vpsCost        = serverState?.vpsCost || 0;
  const activeResearch = serverState?.activeResearch;
  const baseline       = serverState?.baseline || 1000;
  const baselineStarted = serverState?.baselineStarted || "";
  const drawdownMode   = serverState?.drawdownMode || "ok";
  const cycleCount     = serverState?.cycleCount || 0;

  const portfolioVal    = parseFloat(account.portfolio_value || 1000);
  const cash            = parseFloat(account.cash || 0);
  const grossTradingPnL = portfolioVal - baseline;
  const trueNetPnL      = grossTradingPnL - apiCost - vpsCost;
  const trueNetPct      = (trueNetPnL / baseline) * 100;

  const shortlistRows = shortlist.map(sym => ({
    sym, ...UNIVERSE.find(u => u.sym === sym), ...research[sym]
  })).filter(Boolean);

  const closedTrades = audit.filter(l => ["SELL","STOP","PROFIT","TRAIL","DRAWDOWN"].includes(l.type));
  const winTrades    = closedTrades.filter(l => l.gross_pnl > 0).length;

  const PHASE_COLOR = { idle:"#2a3a4a", screening:"#a78bfa", researching:"#f59e0b", deciding:"#3b82f6", watching:"#22d3a0" };
  const phaseColor  = PHASE_COLOR[phase] || "#2a3a4a";

  const selR   = selectedSym ? research[selectedSym] : null;
  const selPos = selectedSym ? positions[selectedSym] : null;
  const selP   = selectedSym ? prices[selectedSym] : null;

  const MOBILE_STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne+Mono&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { height: -webkit-fill-available; }
    body { min-height: -webkit-fill-available; }
    ::-webkit-scrollbar { width: 3px; }
    ::-webkit-scrollbar-thumb { background: #1a2535; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
    .pulse { animation: pulse 1.6s ease-in-out infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spin { animation: spin 1s linear infinite; display: inline-block; }
    .mob-wrap {
      font-family: 'DM Mono', monospace;
      background: #060810;
      color: #8a9bb0;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: -webkit-fill-available;
    }
    .mob-topbar {
      background: #040609;
      border-bottom: 1px solid #0d1828;
      padding: 12px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .mob-strip {
      background: #080f18;
      border-bottom: 1px solid #0d1828;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    .mob-phase {
      background: #0a1218;
      border-bottom: 1px solid #0d1828;
      padding: 6px 14px;
      flex-shrink: 0;
      font-size: 11px;
      color: #3a5a6a;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .mob-scroll {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    .mob-srow {
      padding: 12px 14px;
      border-bottom: 1px solid #080e18;
    }
    .mob-nav {
      background: #0a1520;
      border-top: 1px solid #0d1828;
      display: flex;
      flex-shrink: 0;
      padding-bottom: max(env(safe-area-inset-bottom), 8px);
    }
    .mob-nbtn {
      flex: 1;
      padding: 12px 0 6px;
      text-align: center;
      font-size: 11px;
      color: #1e3a5a;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      font-family: 'DM Mono', monospace;
      background: none;
      border: none;
      border-top: 2px solid transparent;
    }
    .mob-nbtn.active {
      color: #22d3a0;
      border-top: 2px solid #22d3a0;
      background: rgba(34,211,160,.04);
    }
    .mob-stock-row {
      padding: 14px 14px;
      border-bottom: 1px solid #080e18;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      cursor: pointer;
      active-background: rgba(255,255,255,.03);
    }
    .mob-btn {
      padding: 8px 14px;
      border-radius: 2px;
      font-size: 11px;
      cursor: pointer;
      font-family: 'DM Mono', monospace;
      letter-spacing: 1px;
    }
  `;

  // Load Tabler icons font into document head once
  useEffect(() => {
    if (!document.getElementById("tabler-icons")) {
      const link = document.createElement("link");
      link.id = "tabler-icons";
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css";
      document.head.appendChild(link);
    }
  }, []);

  // Stock detail view
  if (selectedSym) {
    const info = UNIVERSE.find(u => u.sym === selectedSym);
    return (
      <div className="mob-wrap">
        <style>{MOBILE_STYLE}</style>
        <div className="mob-topbar">
          <button onClick={()=>setSelectedSym(null)}
            style={{background:"none",border:"none",color:"#22d3a0",fontSize:14,cursor:"pointer",padding:"4px 0",fontFamily:"'DM Mono',monospace"}}>
            ← Back
          </button>
          <span style={{fontFamily:"'Syne Mono'",fontSize:18,color:"#e2e8f0"}}>{selectedSym}</span>
          <span style={{fontSize:10,color:"#1e3a5a"}}>{info?.sector}</span>
        </div>
        <div className="mob-scroll">
          {selP && (
            <div className="mob-srow">
              <div style={{fontSize:26,color:"#c8d6e5",fontFamily:"'Syne Mono'"}}>£{selP.cur?.toFixed(2)}</div>
              <div style={{fontSize:12,color:selP.cur>=selP.prev?"#22d3a0":"#f43f6a",marginTop:3}}>
                {selP.cur>=selP.prev?"▲":"▼"}{Math.abs((selP.cur-selP.prev)/(selP.prev||1)*100).toFixed(3)}%
              </div>
            </div>
          )}
          {selPos && (
            <div className="mob-srow" style={{background:"rgba(59,130,246,.05)"}}>
              <div style={{fontSize:10,color:"#3b82f6",marginBottom:5,letterSpacing:1}}>OPEN POSITION</div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:14}}>{selPos.qty}sh · avg £{selPos.avg_price?.toFixed(2)}</span>
                <span style={{fontSize:16,color:((selP?.cur-selPos.avg_price)/selPos.avg_price)>=0?"#22d3a0":"#f43f6a",fontWeight:500}}>
                  {(((selP?.cur-selPos.avg_price)/selPos.avg_price)*100)?.toFixed(2)}%
                </span>
              </div>
            </div>
          )}
          {selR ? (
            <div className="mob-srow">
              <div style={{fontSize:10,color:"#1e3a5a",letterSpacing:1,marginBottom:8}}>RESEARCH</div>
              <div style={{fontSize:13,color:"#3a5a60",lineHeight:1.6,marginBottom:12,fontStyle:"italic"}}>{selR.headline}</div>
              {[
                ["Sentiment", selR.sentiment, selR.sentiment==="bullish"?"#22d3a0":selR.sentiment==="bearish"?"#f43f6a":"#6b7280"],
                ["Rating", selR.analystRating, "#8a9bb0"],
                ["Price target", `$${Number(selR.priceTarget).toFixed(0)}`, selR.priceTarget>(selP?.cur||0)?"#22d3a0":"#f43f6a"],
                ["Return score", `${selR.returnScore}/100`, selR.returnScore>65?"#22d3a0":selR.returnScore<40?"#f43f6a":"#f59e0b"],
                ["News score", selR.newsScore?.toFixed(2), selR.newsScore>0?"#22d3a0":selR.newsScore<0?"#f43f6a":"#6b7280"],
              ].map(([k,v,c]) => (
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #080e18"}}>
                  <span style={{fontSize:12,color:"#1e3a5a"}}>{k}</span>
                  <span style={{fontSize:13,color:c,fontWeight:500}}>{String(v||"—").toUpperCase()}</span>
                </div>
              ))}
              {selR.keyCatalysts?.length>0 && (
                <div style={{marginTop:12}}>
                  <div style={{fontSize:10,color:"#22d3a0",marginBottom:5,letterSpacing:1}}>CATALYSTS</div>
                  {selR.keyCatalysts.slice(0,2).map((c,i) => <div key={i} style={{fontSize:12,color:"#3a5a40",lineHeight:1.6,marginBottom:3}}>· {c}</div>)}
                </div>
              )}
              {selR.keyRisks?.length>0 && (
                <div style={{marginTop:10,marginBottom:12}}>
                  <div style={{fontSize:10,color:"#f43f6a",marginBottom:5,letterSpacing:1}}>RISKS</div>
                  {selR.keyRisks.slice(0,2).map((r,i) => <div key={i} style={{fontSize:12,color:"#5a3a40",lineHeight:1.6,marginBottom:3}}>· {r}</div>)}
                </div>
              )}
            </div>
          ) : (
            <div className="mob-srow" style={{fontSize:13,color:"#1e3a5a"}} className={activeResearch===selectedSym?"pulse":""}>
              {activeResearch===selectedSym?"🔍 Researching now...":"Awaiting research..."}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mob-wrap">
      <style>{MOBILE_STYLE}</style>

      {/* Top bar — fixed at top */}
      <div className="mob-topbar">
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontFamily:"'Syne Mono'",fontSize:18,color:"#22d3a0",letterSpacing:2}}>APEX</span>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:connected?phaseColor:"#f43f6a"}} className={connected&&agentRunning?"pulse":""}/>
            <span style={{fontSize:10,color:connected?phaseColor:"#f43f6a"}}>
              {connected?(phase==="watching"?"LIVE":phase.toUpperCase()):"OFFLINE"}
            </span>
          </div>
          {drawdownMode!=="ok" && <span style={{fontSize:9,color:"#f43f6a"}}>⚠ {drawdownMode.replace("_"," ").toUpperCase()}</span>}
        </div>
        <button onClick={agentRunning?stopAgent:startAgent} className="mob-btn"
          style={{background:agentRunning?"rgba(244,63,106,.08)":"rgba(34,211,160,.08)",color:agentRunning?"#f43f6a":"#22d3a0",border:`1px solid ${agentRunning?"#f43f6a":"#22d3a0"}`}}>
          {agentRunning?"⬛ STOP":"▶ START"}
        </button>
      </div>

      {/* Portfolio strip */}
      <div className="mob-strip">
        <div>
          <div style={{fontSize:9,color:"#1e3a5a",letterSpacing:1}}>PORTFOLIO</div>
          <div style={{fontFamily:"'Syne Mono'",fontSize:22,color:"#c8d6e5"}}>£{portfolioVal.toFixed(2)}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:9,color:"#1e3a5a",letterSpacing:1}}>TRUE NET P&L</div>
          <div style={{fontSize:18,color:trueNetPnL>=0?"#22d3a0":"#f43f6a",fontWeight:500}}>
            {trueNetPnL>=0?"+":""}£{trueNetPnL.toFixed(2)}
          </div>
          <div style={{fontSize:9,color:"#1e3a5a"}}>
            {trueNetPct>=0?"+":""}{trueNetPct.toFixed(2)}% · API £{apiCost.toFixed(2)} · VPS £{vpsCost.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Phase strip */}
      {agentRunning && (
        <div className="mob-phase">
          {(phase==="researching"||phase==="screening"||phase==="deciding") && <span className="spin" style={{fontSize:10,color:phaseColor}}>◎</span>}
          <span>
            {phase==="screening" && "Screening stocks..."}
            {phase==="researching" && `Researching ${activeResearch||""}...`}
            {phase==="deciding" && "Making trade decision..."}
            {phase==="watching" && `Live · cycle #${cycleCount} · ${Object.keys(research).length}/${shortlist.length} researched`}
          </span>
        </div>
      )}

      {/* Scrollable content */}
      <div className="mob-scroll">

        {/* STOCKS tab */}
        {mobileTab==="stocks" && (
          <>
            <div style={{padding:"7px 14px",background:"#0a1218",borderBottom:"1px solid #0d1828",fontSize:10,color:"#1e3a5a"}}>
              SHORTLIST ({shortlist.length}) · tap to view research
            </div>
            {shortlist.length===0 && (
              <div style={{padding:"32px 14px",fontSize:13,color:"#1e3a5a",textAlign:"center"}} className={agentRunning?"pulse":""}>
                {agentRunning?"Running screener...":"Start agent to begin"}
              </div>
            )}
            {shortlistRows.map(row => {
              const isA = activeResearch === row.sym;
              const r = research[row.sym];
              const scoreColor = !r?"#1e3a5a":r.returnScore>65?"#22d3a0":r.returnScore>45?"#f59e0b":"#f43f6a";
              return (
                <div key={row.sym} className="mob-stock-row" onClick={()=>setSelectedSym(row.sym)}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
                      <span style={{fontSize:15,fontWeight:500,color:"#c8d6e5"}}>{row.sym}</span>
                      {r && <span style={{fontSize:10,padding:"2px 6px",borderRadius:2,background:`rgba(${r.sentiment==="bullish"?"34,211,160":r.sentiment==="bearish"?"244,63,106":"100,120,140"},.12)`,color:r.sentiment==="bullish"?"#22d3a0":r.sentiment==="bearish"?"#f43f6a":"#6b7280"}}>{r.sentiment?.toUpperCase()}</span>}
                      {isA && <span style={{fontSize:10,color:"#f59e0b"}} className="pulse">● LIVE</span>}
                    </div>
                    <div style={{fontSize:11,color:"#3a5a60",fontStyle:"italic",lineHeight:1.5}}>
                      {isA?"Researching...":r?.headline||"Awaiting research..."}
                    </div>
                    <div style={{fontSize:10,color:"#1e3a5a",marginTop:3}}>{row.sector}</div>
                  </div>
                  {r && (
                    <div style={{textAlign:"right",marginLeft:12,flexShrink:0}}>
                      <div style={{fontSize:20,color:scoreColor,fontFamily:"'Syne Mono'",fontWeight:500}}>{r.returnScore}</div>
                      <div style={{fontSize:9,color:"#1e3a5a"}}>score</div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* PORTFOLIO tab */}
        {mobileTab==="portfolio" && (
          <>
            <div style={{margin:"12px 14px",background:"#0a1220",borderRadius:3,padding:"14px",border:"1px solid #0d1828"}}>
              <div style={{fontSize:10,color:"#1e3a5a",letterSpacing:1,marginBottom:10}}>
                TRUE P&L SINCE {baselineStarted?new Date(baselineStarted).toLocaleDateString("en-GB",{day:"numeric",month:"short"}):"start"}
              </div>
              {[
                ["Gross trading P&L", `${grossTradingPnL>=0?"+":""}£${grossTradingPnL.toFixed(2)}`, grossTradingPnL>=0?"#22d3a0":"#f43f6a"],
                ["Anthropic API", `-£${apiCost.toFixed(2)}`, "#f43f6a"],
                ["VPS (Mythic Beasts)", `-£${vpsCost.toFixed(2)}`, "#f43f6a"],
              ].map(([k,v,c]) => (
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #080e18"}}>
                  <span style={{fontSize:12,color:"#3a5a6a"}}>{k}</span>
                  <span style={{fontSize:13,color:c}}>{v}</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",paddingTop:10,marginTop:2}}>
                <span style={{fontSize:13,color:"#8a9bb0",fontWeight:500}}>True net P&L</span>
                <span style={{fontSize:22,color:trueNetPnL>=0?"#22d3a0":"#f43f6a",fontFamily:"'Syne Mono'"}}>
                  {trueNetPnL>=0?"+":""}£{trueNetPnL.toFixed(2)}
                </span>
              </div>
              <div style={{fontSize:11,color:trueNetPct>=0?"#22d3a0":"#f43f6a",textAlign:"right",marginTop:3}}>
                {trueNetPct>=0?"+":""}{trueNetPct.toFixed(3)}% vs baseline £{baseline.toFixed(0)}
              </div>
            </div>
            <div style={{padding:"0 14px"}}>
              {[
                ["Cash", `£${cash.toFixed(2)}`, "#8a9bb0"],
                ["Invested", `£${(portfolioVal-cash).toFixed(2)}`, "#8a9bb0"],
                ["Positions", `${Object.keys(positions).length}/2`, "#8a9bb0"],
                ["Win rate", closedTrades.length?`${Math.round(winTrades/closedTrades.length*100)}%`:"—", "#3b82f6"],
                ["Shortlisted", `${shortlist.length}`, "#3b82f6"],
                ["Researched", `${Object.keys(research).length}`, "#22d3a0"],
              ].map(([k,v,c]) => (
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #080e18"}}>
                  <span style={{fontSize:13,color:"#1e3a5a"}}>{k}</span>
                  <span style={{fontSize:14,color:c,fontWeight:500}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{padding:"14px 14px 4px",fontSize:10,color:"#1e3a5a",letterSpacing:1}}>POSITIONS</div>
            {Object.keys(positions).length===0 && <div style={{padding:"8px 14px 16px",fontSize:13,color:"#1a2a3a"}}>No open positions</div>}
            {Object.entries(positions).map(([sym,pos]) => {
              const cur = prices[sym]?.cur || pos.avg_price;
              const pct = (cur - pos.avg_price) / pos.avg_price * 100;
              return (
                <div key={sym} onClick={()=>setSelectedSym(sym)} style={{padding:"12px 14px",borderBottom:"1px solid #080e18",cursor:"pointer"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:16,fontWeight:500,color:"#c8d6e5"}}>{sym}</span>
                    <span style={{fontSize:16,color:pct>=0?"#22d3a0":"#f43f6a",fontWeight:500}}>{pct>=0?"+":""}{pct.toFixed(2)}%</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:11,color:"#1e3a5a"}}>{pos.qty}sh · avg £{pos.avg_price?.toFixed(2)}</span>
                    <span style={{fontSize:11,color:"#2a4a6a"}}>£{(cur*pos.qty).toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* TRADES tab */}
        {mobileTab==="audit" && (
          <>
            <div style={{padding:"7px 14px",background:"#0a1218",borderBottom:"1px solid #0d1828",fontSize:10,color:"#1e3a5a"}}>
              {closedTrades.length} TRADES · WIN RATE {closedTrades.length?`${Math.round(winTrades/closedTrades.length*100)}%`:"—"}
            </div>
            {audit.length===0 && <div style={{padding:"32px 14px",fontSize:13,color:"#1e3a5a",textAlign:"center"}}>No trades yet — check back Monday</div>}
            {[...audit].sort((a,b)=>b.id-a.id).map(t => {
              const isBuy = t.type==="BUY";
              const pnl = t.gross_pnl;
              return (
                <div key={t.id} style={{padding:"12px 14px",borderBottom:"1px solid #080e18"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <span style={{fontSize:10,padding:"2px 6px",borderRadius:2,background:isBuy?"rgba(34,211,160,.1)":pnl>0?"rgba(34,211,160,.1)":"rgba(244,63,106,.1)",color:isBuy?"#22d3a0":pnl>0?"#22d3a0":"#f43f6a"}}>{t.type}</span>
                      <span style={{fontSize:15,color:"#c8d6e5",fontWeight:500}}>{t.sym}</span>
                    </div>
                    {pnl!=null && <span style={{fontSize:15,color:pnl>=0?"#22d3a0":"#f43f6a",fontWeight:500}}>{pnl>=0?"+":""}£{pnl.toFixed(2)}</span>}
                  </div>
                  <div style={{fontSize:11,color:"#3a5a6a",lineHeight:1.4}}>{t.rationale}</div>
                  <div style={{fontSize:10,color:"#1e3a5a",marginTop:3}}>{t.ts} · {t.shares}sh @ £{t.entry_price?.toFixed(2)}</div>
                </div>
              );
            })}
          </>
        )}

        {/* PIPELINE tab */}
        {mobileTab==="watch" && (
          <>
            <div style={{padding:"7px 14px",background:"#0a1218",borderBottom:"1px solid #0d1828",fontSize:10,color:"#1e3a5a"}}>
              RESEARCH PIPELINE · {Object.keys(research).length}/{shortlist.length} DONE
            </div>
            {shortlist.map(sym => {
              const r = research[sym];
              const isA = activeResearch === sym;
              return (
                <div key={sym} onClick={()=>setSelectedSym(sym)}
                  style={{padding:"12px 14px",borderBottom:"1px solid #080e18",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:isA?"#f59e0b":r?"#22d3a0":"#1a3050",flexShrink:0}} className={isA?"pulse":""}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,color:isA?"#f59e0b":r?"#22d3a0":"#3a5a6a",fontWeight:500,marginBottom:2}}>{sym}</div>
                    {r && <div style={{fontSize:11,color:"#3a5a60",fontStyle:"italic"}}>{r.headline?.slice(0,55)}...</div>}
                    {!r && <div style={{fontSize:11,color:"#1e3a5a"}}>{isA?"Researching...":"Queued"}</div>}
                  </div>
                  {r && <div style={{fontSize:16,color:r.returnScore>65?"#22d3a0":r.returnScore>45?"#f59e0b":"#f43f6a",fontFamily:"'Syne Mono'",flexShrink:0}}>{r.returnScore}</div>}
                </div>
              );
            })}
          </>
        )}

      </div>

      {/* Bottom nav — stays fixed */}
      <div className="mob-nav">
        {[
          ["portfolio","Portfolio","ti-chart-bar"],
          ["stocks","Stocks","ti-list"],
          ["audit","Trades","ti-receipt"],
          ["watch","Pipeline","ti-eye"],
        ].map(([tab,label,icon]) => (
          <button key={tab} onClick={()=>setMobileTab(tab)} className={`mob-nbtn${mobileTab===tab?" active":""}`}>
            <i className={`ti ${icon}`} style={{fontSize:20}} aria-hidden="true"/>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

  const phase          = serverState?.phase || "idle";
  const account        = serverState?.account || {};
  const positions      = serverState?.positions || {};
  const prices         = serverState?.prices || {};
  const shortlist      = serverState?.shortlist || [];
  const research       = serverState?.research || {};
  const audit          = serverState?.audit || [];
  const apiCost        = serverState?.apiCost || 0;
  const vpsCost        = serverState?.vpsCost || 0;
  const activeResearch = serverState?.activeResearch;
  const baseline       = serverState?.baseline || 1000;
  const baselineStarted = serverState?.baselineStarted || "";
  const drawdownMode   = serverState?.drawdownMode || "ok";
  const cycleCount     = serverState?.cycleCount || 0;

  const portfolioVal    = parseFloat(account.portfolio_value || 1000);
  const cash            = parseFloat(account.cash || 0);
  const grossTradingPnL = portfolioVal - baseline;
  const trueNetPnL      = grossTradingPnL - apiCost - vpsCost;
  const trueNetPct      = (trueNetPnL / baseline) * 100;

  const shortlistRows = shortlist.map(sym => ({
    sym, ...UNIVERSE.find(u => u.sym === sym), ...research[sym]
  })).filter(Boolean);

  const closedTrades = audit.filter(l => ["SELL","STOP","PROFIT","TRAIL","DRAWDOWN"].includes(l.type));
  const winTrades    = closedTrades.filter(l => l.gross_pnl > 0).length;

  const PHASE_COLOR = { idle:"#2a3a4a", screening:"#a78bfa", researching:"#f59e0b", deciding:"#3b82f6", watching:"#22d3a0" };
  const phaseColor  = PHASE_COLOR[phase] || "#2a3a4a";

  const selR   = selectedSym ? research[selectedSym] : null;
  const selPos = selectedSym ? positions[selectedSym] : null;
  const selP   = selectedSym ? prices[selectedSym] : null;

  const S = {
    wrap:  { fontFamily:"'DM Mono',monospace", background:"#060810", color:"#8a9bb0", height:"100vh", display:"flex", flexDirection:"column", overflow:"hidden" },
    topbar:{ background:"#040609", borderBottom:"1px solid #0d1828", padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 },
    strip: { background:"#080f18", borderBottom:"1px solid #0d1828", padding:"8px 14px", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 },
    scroll:{ flex:1, overflowY:"auto" },
    srow:  { padding:"10px 14px", borderBottom:"1px solid #080e18" },
    label: { fontSize:9, color:"#1e3a5a", letterSpacing:1, marginBottom:2 },
    nav:   { background:"#0a1520", borderTop:"1px solid #0d1828", display:"flex", flexShrink:0 },
    nbtn:  (active) => ({ flex:1, padding:"10px 0", textAlign:"center", fontSize:9, color:active?"#22d3a0":"#1e3a5a", borderTop:active?"1px solid #22d3a0":"1px solid transparent", display:"flex", flexDirection:"column", alignItems:"center", gap:2, cursor:"pointer" }),
  };

  // Stock detail overlay
  if (selectedSym) {
    const info = UNIVERSE.find(u => u.sym === selectedSym);
    return (
      <div style={S.wrap}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne+Mono&display=swap');*{box-sizing:border-box;margin:0;padding:0;}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#1a2535}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}.pulse{animation:pulse 1.6s ease-in-out infinite}`}</style>
        {/* Back header */}
        <div style={{...S.topbar}}>
          <button onClick={()=>setSelectedSym(null)} style={{background:"none",border:"none",color:"#22d3a0",fontSize:12,cursor:"pointer",padding:0}}>← Back</button>
          <span style={{fontFamily:"'Syne Mono'",fontSize:16,color:"#e2e8f0"}}>{selectedSym}</span>
          <span style={{fontSize:9,color:"#1e3a5a"}}>{info?.sector}</span>
        </div>
        <div style={S.scroll}>
          {/* Price */}
          {selP && (
            <div style={{...S.srow}}>
              <div style={{fontSize:22,color:"#c8d6e5",fontFamily:"'Syne Mono'"}}>${selP.cur?.toFixed(2)}</div>
              <div style={{fontSize:11,color:selP.cur>=selP.prev?"#22d3a0":"#f43f6a",marginTop:2}}>
                {selP.cur>=selP.prev?"▲":"▼"}{Math.abs((selP.cur-selP.prev)/(selP.prev||1)*100).toFixed(3)}%
              </div>
            </div>
          )}
          {/* Position */}
          {selPos && (
            <div style={{...S.srow, background:"rgba(59,130,246,.05)"}}>
              <div style={{fontSize:9,color:"#3b82f6",marginBottom:4}}>OPEN POSITION</div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:12}}>{selPos.qty}sh · avg ${selPos.avg_price?.toFixed(2)}</span>
                <span style={{fontSize:14,color:((selP?.cur-selPos.avg_price)/selPos.avg_price)>=0?"#22d3a0":"#f43f6a",fontWeight:500}}>
                  {(((selP?.cur-selPos.avg_price)/selPos.avg_price)*100)?.toFixed(2)}%
                </span>
              </div>
            </div>
          )}
          {/* Research */}
          {selR ? (
            <div style={S.srow}>
              <div style={S.label}>RESEARCH</div>
              <div style={{fontSize:12,color:"#3a5a60",lineHeight:1.6,marginBottom:10,fontStyle:"italic"}}>{selR.headline}</div>
              {[
                ["Sentiment", selR.sentiment, selR.sentiment==="bullish"?"#22d3a0":selR.sentiment==="bearish"?"#f43f6a":"#6b7280"],
                ["Rating", selR.analystRating, "#8a9bb0"],
                ["Price target", `$${Number(selR.priceTarget).toFixed(0)}`, selR.priceTarget>(selP?.cur||0)?"#22d3a0":"#f43f6a"],
                ["Return score", `${selR.returnScore}/100`, selR.returnScore>65?"#22d3a0":selR.returnScore<40?"#f43f6a":"#f59e0b"],
                ["News score", selR.newsScore?.toFixed(2), selR.newsScore>0?"#22d3a0":selR.newsScore<0?"#f43f6a":"#6b7280"],
              ].map(([k,v,c]) => (
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #080e18"}}>
                  <span style={{fontSize:11,color:"#1e3a5a"}}>{k}</span>
                  <span style={{fontSize:12,color:c,fontWeight:500}}>{String(v||"—").toUpperCase()}</span>
                </div>
              ))}
              {selR.keyCatalysts?.length>0 && (
                <div style={{marginTop:10}}>
                  <div style={{fontSize:9,color:"#22d3a0",marginBottom:4}}>CATALYSTS</div>
                  {selR.keyCatalysts.slice(0,2).map((c,i) => <div key={i} style={{fontSize:11,color:"#3a5a40",lineHeight:1.6}}>· {c}</div>)}
                </div>
              )}
              {selR.keyRisks?.length>0 && (
                <div style={{marginTop:8}}>
                  <div style={{fontSize:9,color:"#f43f6a",marginBottom:4}}>RISKS</div>
                  {selR.keyRisks.slice(0,2).map((r,i) => <div key={i} style={{fontSize:11,color:"#5a3a40",lineHeight:1.6}}>· {r}</div>)}
                </div>
              )}
            </div>
          ) : (
            <div style={{...S.srow, fontSize:11, color:"#1e3a5a"}} className={activeResearch===selectedSym?"pulse":""}>
              {activeResearch===selectedSym?"🔍 Researching now...":"Awaiting research..."}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne+Mono&display=swap');*{box-sizing:border-box;margin:0;padding:0;}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#1a2535}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}.pulse{animation:pulse 1.6s ease-in-out infinite}@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite;display:inline-block}`}</style>

      {/* Top bar */}
      <div style={S.topbar}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontFamily:"'Syne Mono'",fontSize:16,color:"#22d3a0",letterSpacing:2}}>APEX</span>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:connected?phaseColor:"#f43f6a"}} className={connected&&agentRunning?"pulse":""}/>
            <span style={{fontSize:9,color:connected?phaseColor:"#f43f6a"}}>{connected?(phase==="watching"?"LIVE":phase.toUpperCase()):"OFFLINE"}</span>
          </div>
          {drawdownMode!=="ok"&&<span style={{fontSize:8,color:"#f43f6a"}}>⚠ {drawdownMode.replace("_"," ").toUpperCase()}</span>}
        </div>
        <button onClick={agentRunning?stopAgent:startAgent}
          style={{padding:"6px 12px",borderRadius:2,fontSize:9,background:agentRunning?"rgba(244,63,106,.08)":"rgba(34,211,160,.08)",color:agentRunning?"#f43f6a":"#22d3a0",border:`1px solid ${agentRunning?"#f43f6a":"#22d3a0"}`,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>
          {agentRunning?"⬛ STOP":"▶ START"}
        </button>
      </div>

      {/* Portfolio strip — always visible */}
      <div style={S.strip}>
        <div>
          <div style={{fontSize:8,color:"#1e3a5a"}}>PORTFOLIO</div>
          <div style={{fontFamily:"'Syne Mono'",fontSize:18,color:"#c8d6e5"}}>£{portfolioVal.toFixed(2)}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:8,color:"#1e3a5a"}}>TRUE NET P&L</div>
          <div style={{fontSize:14,color:trueNetPnL>=0?"#22d3a0":"#f43f6a",fontWeight:500}}>
            {trueNetPnL>=0?"+":""}£{trueNetPnL.toFixed(2)}
          </div>
          <div style={{fontSize:7,color:"#1e3a5a"}}>
            {trueNetPct>=0?"+":""}{trueNetPct.toFixed(2)}% · API £{apiCost.toFixed(2)} · VPS £{vpsCost.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Phase strip */}
      {agentRunning && phase !== "idle" && (
        <div style={{background:"#0a1218",borderBottom:"1px solid #0d1828",padding:"5px 14px",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
          {phase==="researching"&&<span className="spin" style={{fontSize:8,color:"#f59e0b"}}>◎</span>}
          {phase==="screening"&&<span className="spin" style={{fontSize:8,color:"#a78bfa"}}>◎</span>}
          <span style={{fontSize:9,color:"#3a5a6a"}}>
            {phase==="screening"&&"Screening stocks..."}
            {phase==="researching"&&`Researching ${activeResearch||""}...`}
            {phase==="deciding"&&"Making trade decision..."}
            {phase==="watching"&&`Live · cycle #${cycleCount} · ${Object.keys(research).length}/${shortlist.length} researched`}
          </span>
        </div>
      )}

      {/* Tab content */}
      <div style={S.scroll}>

        {/* ── STOCKS tab ── */}
        {mobileTab==="stocks" && (
          <div>
            <div style={{padding:"6px 14px",background:"#0a1218",borderBottom:"1px solid #0d1828",fontSize:9,color:"#1e3a5a"}}>
              SHORTLIST ({shortlist.length}) · tap to view research
            </div>
            {shortlist.length===0 && (
              <div style={{padding:"24px 14px",fontSize:11,color:"#1e3a5a",textAlign:"center"}} className={agentRunning?"pulse":""}>
                {agentRunning?"Running screener...":"Start agent to begin"}
              </div>
            )}
            {shortlistRows.map(row => {
              const isA = activeResearch === row.sym;
              const r = research[row.sym];
              const scoreColor = !r ? "#1e3a5a" : r.returnScore>65?"#22d3a0":r.returnScore>45?"#f59e0b":"#f43f6a";
              return (
                <div key={row.sym} onClick={()=>setSelectedSym(row.sym)}
                  style={{padding:"12px 14px",borderBottom:"1px solid #080e18",display:"flex",justifyContent:"space-between",alignItems:"flex-start",cursor:"pointer"}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                      <span style={{fontSize:13,fontWeight:500,color:"#c8d6e5"}}>{row.sym}</span>
                      {r && <span style={{fontSize:9,padding:"1px 5px",borderRadius:2,background:`rgba(${r.sentiment==="bullish"?"34,211,160":r.sentiment==="bearish"?"244,63,106":"100,120,140"},.12)`,color:r.sentiment==="bullish"?"#22d3a0":r.sentiment==="bearish"?"#f43f6a":"#6b7280"}}>{r.sentiment?.toUpperCase()}</span>}
                      {isA && <span style={{fontSize:8,color:"#f59e0b"}} className="pulse">● LIVE</span>}
                    </div>
                    <div style={{fontSize:10,color:"#3a5a60",fontStyle:"italic",lineHeight:1.4}}>
                      {isA?"Researching...":r?.headline||"Awaiting research..."}
                    </div>
                    <div style={{fontSize:9,color:"#1e3a5a",marginTop:2}}>{row.sector}</div>
                  </div>
                  {r && (
                    <div style={{textAlign:"right",marginLeft:10,flexShrink:0}}>
                      <div style={{fontSize:16,color:scoreColor,fontFamily:"'Syne Mono'",fontWeight:500}}>{r.returnScore}</div>
                      <div style={{fontSize:8,color:"#1e3a5a"}}>score</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── PORTFOLIO tab ── */}
        {mobileTab==="portfolio" && (
          <div>
            {/* True P&L breakdown */}
            <div style={{margin:"12px 14px",background:"#0a1220",borderRadius:3,padding:"12px",border:"1px solid #0d1828"}}>
              <div style={{fontSize:9,color:"#1e3a5a",letterSpacing:1,marginBottom:8}}>
                TRUE P&L SINCE {baselineStarted?new Date(baselineStarted).toLocaleDateString("en-GB",{day:"numeric",month:"short"}):"start"}
              </div>
              {[
                ["Gross trading P&L", `${grossTradingPnL>=0?"+":""}£${grossTradingPnL.toFixed(2)}`, grossTradingPnL>=0?"#22d3a0":"#f43f6a"],
                ["Anthropic API", `-£${apiCost.toFixed(2)}`, "#f43f6a"],
                ["VPS (Mythic Beasts)", `-£${vpsCost.toFixed(2)}`, "#f43f6a"],
              ].map(([k,v,c]) => (
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #080e18"}}>
                  <span style={{fontSize:11,color:"#3a5a6a"}}>{k}</span>
                  <span style={{fontSize:12,color:c}}>{v}</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",paddingTop:8,marginTop:2}}>
                <span style={{fontSize:12,color:"#8a9bb0",fontWeight:500}}>True net P&L</span>
                <span style={{fontSize:18,color:trueNetPnL>=0?"#22d3a0":"#f43f6a",fontFamily:"'Syne Mono'",fontWeight:500}}>
                  {trueNetPnL>=0?"+":""}£{trueNetPnL.toFixed(2)}
                </span>
              </div>
              <div style={{fontSize:10,color:trueNetPct>=0?"#22d3a0":"#f43f6a",textAlign:"right",marginTop:2}}>
                {trueNetPct>=0?"+":""}{trueNetPct.toFixed(3)}% vs baseline £{baseline.toFixed(0)}
              </div>
            </div>

            {/* Stats */}
            <div style={{padding:"0 14px"}}>
              {[
                ["Cash", `£${cash.toFixed(2)}`, "#8a9bb0"],
                ["Invested", `£${(portfolioVal-cash).toFixed(2)}`, "#8a9bb0"],
                ["Positions", `${Object.keys(positions).length}/2`, "#8a9bb0"],
                ["Win rate", closedTrades.length?`${Math.round(winTrades/closedTrades.length*100)}%`:"—", "#3b82f6"],
                ["Shortlisted", `${shortlist.length}`, "#3b82f6"],
                ["Researched", `${Object.keys(research).length}`, "#22d3a0"],
              ].map(([k,v,c]) => (
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #080e18"}}>
                  <span style={{fontSize:12,color:"#1e3a5a"}}>{k}</span>
                  <span style={{fontSize:13,color:c,fontWeight:500}}>{v}</span>
                </div>
              ))}
            </div>

            {/* Open positions */}
            <div style={{padding:"12px 14px 4px",fontSize:9,color:"#1e3a5a",letterSpacing:1}}>POSITIONS</div>
            {Object.keys(positions).length===0 && <div style={{padding:"8px 14px",fontSize:12,color:"#1a2a3a"}}>No open positions</div>}
            {Object.entries(positions).map(([sym,pos]) => {
              const cur = prices[sym]?.cur || pos.avg_price;
              const pct = (cur - pos.avg_price) / pos.avg_price * 100;
              return (
                <div key={sym} onClick={()=>{setSelectedSym(sym);setMobileTab("stocks");}}
                  style={{padding:"10px 14px",borderBottom:"1px solid #080e18",cursor:"pointer"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:14,fontWeight:500,color:"#c8d6e5"}}>{sym}</span>
                    <span style={{fontSize:14,color:pct>=0?"#22d3a0":"#f43f6a",fontWeight:500}}>{pct>=0?"+":""}{pct.toFixed(2)}%</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:10,color:"#1e3a5a"}}>{pos.qty}sh · avg £{pos.avg_price?.toFixed(2)}</span>
                    <span style={{fontSize:10,color:"#2a4a6a"}}>£{(cur*pos.qty).toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── AUDIT tab ── */}
        {mobileTab==="audit" && (
          <div>
            <div style={{padding:"6px 14px",background:"#0a1218",borderBottom:"1px solid #0d1828",fontSize:9,color:"#1e3a5a"}}>
              {closedTrades.length} TRADES · WIN RATE {closedTrades.length?`${Math.round(winTrades/closedTrades.length*100)}%`:"—"}
            </div>
            {audit.length===0 && <div style={{padding:"24px 14px",fontSize:12,color:"#1e3a5a",textAlign:"center"}}>No trades yet</div>}
            {[...audit].sort((a,b)=>b.id-a.id).map(t => {
              const isBuy = t.type==="BUY";
              const pnl = t.gross_pnl;
              return (
                <div key={t.id} style={{padding:"10px 14px",borderBottom:"1px solid #080e18"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:9,padding:"1px 5px",borderRadius:2,background:isBuy?"rgba(34,211,160,.1)":pnl>0?"rgba(34,211,160,.1)":"rgba(244,63,106,.1)",color:isBuy?"#22d3a0":pnl>0?"#22d3a0":"#f43f6a"}}>{t.type}</span>
                      <span style={{fontSize:13,color:"#c8d6e5",fontWeight:500}}>{t.sym}</span>
                    </div>
                    {pnl!=null && <span style={{fontSize:13,color:pnl>=0?"#22d3a0":"#f43f6a",fontWeight:500}}>{pnl>=0?"+":""}£{pnl.toFixed(2)}</span>}
                  </div>
                  <div style={{fontSize:10,color:"#3a5a6a",lineHeight:1.4}}>{t.rationale}</div>
                  <div style={{fontSize:9,color:"#1e3a5a",marginTop:2}}>{t.ts} · {t.shares}sh @ £{t.entry_price?.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── WATCH tab ── */}
        {mobileTab==="watch" && (
          <div>
            <div style={{padding:"6px 14px",background:"#0a1218",borderBottom:"1px solid #0d1828",fontSize:9,color:"#1e3a5a"}}>
              RESEARCH PIPELINE
            </div>
            {shortlist.map(sym => {
              const r = research[sym];
              const isA = activeResearch === sym;
              return (
                <div key={sym} onClick={()=>{setSelectedSym(sym);setMobileTab("stocks");}}
                  style={{padding:"10px 14px",borderBottom:"1px solid #080e18",display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:isA?"#f59e0b":r?"#22d3a0":"#1a3050",flexShrink:0}} className={isA?"pulse":""}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:isA?"#f59e0b":r?"#22d3a0":"#3a5a6a",fontWeight:500}}>{sym}</div>
                    {r && <div style={{fontSize:9,color:"#3a5a60",fontStyle:"italic",marginTop:1}}>{r.headline?.slice(0,50)}...</div>}
                    {!r && <div style={{fontSize:9,color:"#1e3a5a"}}>{isA?"Researching...":"Queued"}</div>}
                  </div>
                  {r && <div style={{fontSize:13,color:r.returnScore>65?"#22d3a0":r.returnScore>45?"#f59e0b":"#f43f6a",fontFamily:"'Syne Mono'"}}>{r.returnScore}</div>}
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Bottom nav */}
      <div style={S.nav}>
        {[
          ["portfolio","Portfolio","ti-chart-bar"],
          ["stocks","Stocks","ti-list"],
          ["audit","Trades","ti-receipt"],
          ["watch","Pipeline","ti-eye"],
        ].map(([tab,label,icon]) => (
          <div key={tab} onClick={()=>setMobileTab(tab)} style={S.nbtn(mobileTab===tab)}>
            <i className={`ti ${icon}`} style={{fontSize:18}} aria-hidden="true"/>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ApexLive() {
  const isMobile = useIsMobile();
  // Server state
  const [serverState, setServerState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [agentRunning, setAgentRunning] = useState(false);

  // UI state
  const [selected, setSelected] = useState("NVDA");
  const [viewTab, setViewTab] = useState("shortlist");
  const [auditSort, setAuditSort] = useState("newest");
  const [sectorFilter, setSectorFilter] = useState("ALL");
  const [pnlHistory, setPnlHistory] = useState([1000]);
  const [toasts, setToasts] = useState([]);
  const prevAuditLen = useRef(0);

  // ── Poll server every 2 seconds ──
  useEffect(() => {
    const poll = async () => {
      const data = await apiFetch("/api/state");
      if (data) {
        setConnected(true);
        setServerState(data);
        setAgentRunning(data.phase !== "idle");
        const pv = parseFloat(data.account?.portfolio_value || 1000);
        setPnlHistory(h => [...h.slice(-99), pv]);

        // Toast on new trades
        const audit = data.audit || [];
        if (audit.length > prevAuditLen.current && prevAuditLen.current > 0) {
          const newest = audit[0];
          if (newest) {
            const id = Date.now();
            const msg = newest.type === "BUY"
              ? `${newest.shares} shares @ £${newest.entry_price?.toFixed(2)} · ${newest.rationale || ""}`
              : `${newest.shares} shares @ £${newest.exit_price?.toFixed(2)} · ${newest.rationale || ""}`;
            setToasts(t => [...t, { id, type: newest.type, sym: newest.sym, message: msg, pnl: newest.gross_pnl?.toFixed(2) }]);
            setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 8000);
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification(`APEX · ${newest.type} ${newest.sym}`, { body: msg });
            }
          }
        }
        prevAuditLen.current = audit.length;
      } else {
        setConnected(false);
      }
    };

    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

  const startAgent = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    await apiPost("/api/agent/start");
  };

  const stopAgent = async () => {
    await apiPost("/api/agent/stop");
  };

  const dismissToast = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), []);

  const exportCSV = async () => {
    window.open(`${API_BASE}/api/audit/export`, "_blank");
  };

  // ── Derived from server state ──
  const phase        = serverState?.phase || "idle";
  const account      = serverState?.account || {};
  const positions    = serverState?.positions || {};
  const prices       = serverState?.prices || {};
  const screenScores = serverState?.screenScores || {};
  const shortlist    = serverState?.shortlist || [];
  const research     = serverState?.research || {};
  const decisions    = serverState?.decisions || {};
  const audit        = serverState?.audit || [];
  const apiCost      = serverState?.apiCost || 0;
  const vpsCost      = serverState?.vpsCost || 0;
  const cycleCount   = serverState?.cycleCount || 0;
  const activeResearch = serverState?.activeResearch;
  const baseline     = serverState?.baseline || 0;
  const baselineStarted = serverState?.baselineStarted || "";
  const drawdownMode = serverState?.drawdownMode || "ok";

  const cash         = parseFloat(account.cash || 0);
  const portfolioVal = parseFloat(account.portfolio_value || 1000);
  const invested     = Object.entries(positions).reduce((s, [sym, pos]) => {
    const cur = prices[sym]?.cur || pos.avg_price;
    return s + (pos.qty || 0) * cur;
  }, 0);

  // True P&L — always vs baseline (survives restarts)
  const baselineVal   = baseline || 1000;
  const grossTradingPnL = portfolioVal - baselineVal;
  const totalCosts    = apiCost + vpsCost;
  const trueNetPnL    = grossTradingPnL - totalCosts;
  const trueNetPct    = (trueNetPnL / baselineVal) * 100;
  // Keep totalPnL/pnlPct for top bar display
  const totalPnL      = trueNetPnL;
  const pnlPct        = trueNetPct;

  const closedTrades  = audit.filter(l => l.type === "SELL" || l.type === "STOP" || l.type === "PROFIT" || l.type === "TRAIL" || l.type === "DRAWDOWN");
  const winTrades     = closedTrades.filter(l => l.gross_pnl > 0).length;
  const totalGrossPnl = closedTrades.reduce((s, l) => s + (l.gross_pnl || 0), 0);
  const netPnl        = totalGrossPnl - totalCosts;
  const avgHold       = closedTrades.length ? closedTrades.reduce((s, l) => s + (l.hold_mins || 0), 0) / closedTrades.length : 0;
  const bestTrade     = closedTrades.reduce((b, l) => (!b || l.gross_pnl > b.gross_pnl) ? l : b, null);
  const worstTrade    = closedTrades.reduce((b, l) => (!b || l.gross_pnl < b.gross_pnl) ? l : b, null);

  const PHASE_COLOR = { idle:"#2a3a4a", screening:"#a78bfa", researching:"#f59e0b", deciding:"#3b82f6", watching:"#22d3a0" };
  const PHASE_LABEL = { idle:"OFFLINE", screening:"SCREENING", researching:`RESEARCHING ${activeResearch||""}`, deciding:"DECIDING", watching:"LIVE" };

  const selInfo    = UNIVERSE.find(u => u.sym === selected);
  const selPrice   = prices[selected];
  const selR       = research[selected];
  const selD       = decisions[selected];
  const selPos     = positions[selected];
  const selScore   = screenScores[selected];
  const selInSl    = shortlist.includes(selected);
  const sectors    = [...new Set(UNIVERSE.map(u => u.sector))];
  const sortedAudit = [...audit].sort((a, b) => auditSort === "newest" ? b.id - a.id : a.id - b.id);
  const shortlistRows = shortlist.map(sym => ({ sym, ...UNIVERSE.find(u => u.sym === sym), ...research[sym] })).filter(Boolean);
  const universeRows = UNIVERSE.filter(u => sectorFilter === "ALL" || u.sector === sectorFilter).sort((a, b) => (screenScores[b.sym] || 0) - (screenScores[a.sym] || 0));

  // P&L sparkline
  function PnLLine() {
    if (pnlHistory.length < 2) return null;
    const min = Math.min(...pnlHistory), max = Math.max(...pnlHistory), range = max - min || 1;
    const W = 130, H = 34;
    const pts = pnlHistory.map((v,i) => `${(i/(pnlHistory.length-1))*W},${H-((v-min)/range)*H}`).join(" ");
    const up = pnlHistory[pnlHistory.length-1] >= pnlHistory[0];
    return <svg width={W} height={H}><polyline points={pts} fill="none" stroke={up?"#22d3a0":"#f43f6a"} strokeWidth={1.5}/></svg>;
  }

  // Progress bar
  function ProgressBar() {
    const total = shortlist.length;
    const done  = shortlist.filter(s => research[s]).length;
    if (!agentRunning || phase === "idle" || total === 0) return null;
    const pct = total > 0 ? Math.round((done/total)*100) : 0;
    const isDone = done >= total && phase === "watching";
    return (
      <div style={{background:"#04080f",borderBottom:"1px solid #0d1828",padding:"9px 18px",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {phase==="researching"&&<span className="spin" style={{fontSize:8,color:"#f59e0b"}}>◎</span>}
            {phase==="screening"&&<span className="spin" style={{fontSize:8,color:"#a78bfa"}}>◎</span>}
            {phase==="deciding"&&<span className="spin" style={{fontSize:8,color:"#3b82f6"}}>◎</span>}
            <span style={{fontSize:8,color:"#4a6a7a",letterSpacing:1.5}}>
              {phase==="screening"&&"SCREENING UNIVERSE"}
              {phase==="researching"&&`RESEARCHING ${activeResearch||""}`}
              {phase==="deciding"&&"AI MAKING TRADE DECISION"}
              {isDone&&"RESEARCH COMPLETE · LIVE TRADING"}
              {phase==="watching"&&!isDone&&"MONITORING · EVENT SCANNER ACTIVE"}
            </span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <span style={{fontSize:7,color:"#1e3a5a"}}>{done}/{total} researched</span>
            {isDone&&<span style={{fontSize:8,color:"#22d3a0",fontFamily:"'Syne Mono'"}}>✓ cycle #{cycleCount}</span>}
            <span style={{fontSize:7,color:apiCost>=40?"#f43f6a":apiCost>=25?"#f59e0b":"#1e3a5a"}}>API £{apiCost.toFixed(2)}/mo</span>
          </div>
        </div>
        <div style={{height:3,background:"#0a1220",borderRadius:2,overflow:"hidden",marginBottom:5,position:"relative"}}>
          <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${isDone?100:pct}%`,background:isDone?"#22d3a0":"linear-gradient(90deg,#22d3a0,#3b82f6,#a78bfa)",borderRadius:2,transition:"width .5s"}}/>
          {phase==="researching"&&<div style={{position:"absolute",top:0,height:"100%",width:"5%",left:`${Math.min(pct,95)}%`,background:"linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent)",animation:"shimmer 1s ease-in-out infinite"}}/>}
        </div>
        <div style={{display:"flex",gap:2,flexWrap:"wrap"}}>
          {shortlist.map(sym => {
            const isD = !!research[sym];
            const isA = activeResearch === sym;
            return (
              <div key={sym} title={sym}
                style={{display:"flex",alignItems:"center",gap:2,padding:"1px 5px",borderRadius:2,background:isA?"rgba(245,158,11,.1)":isD?"rgba(34,211,160,.07)":"rgba(255,255,255,.02)",border:`1px solid ${isA?"rgba(245,158,11,.4)":isD?"rgba(34,211,160,.2)":"#0d1828"}`,transition:"all .3s"}}>
                <div style={{width:4,height:4,borderRadius:"50%",background:isA?"#f59e0b":isD?"#22d3a0":"#1a3050",transition:"background .3s"}} className={isA?"pulse":""}/>
                <span style={{fontSize:6,color:isA?"#f59e0b":isD?"#22d3a0":"#2a4a6a"}}>{sym}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Mobile render ──
  if (isMobile) {
    return <MobileView
      serverState={serverState}
      connected={connected}
      agentRunning={agentRunning}
      startAgent={startAgent}
      stopAgent={stopAgent}
    />;
  }

  return (
    <div style={{fontFamily:"'DM Mono',monospace",background:"#060810",color:"#8a9bb0",minHeight:"100vh",display:"flex",flexDirection:"column",overflow:"hidden",height:"100vh"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne+Mono&display=swap');
        @import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#1a2535}
        .hov{transition:background .12s,border-color .12s}.hov:hover{background:rgba(255,255,255,.03)!important;cursor:pointer}
        .btn{cursor:pointer;border:none;font-family:'DM Mono',monospace;letter-spacing:1px;transition:all .15s}.btn:hover{filter:brightness(1.2);transform:translateY(-1px)}
        @keyframes fadeUp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}.fu{animation:fadeUp .2s ease}
        @keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite;display:inline-block}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}.pulse{animation:pulse 1.6s ease-in-out infinite}
        @keyframes shimmer{0%{opacity:0}50%{opacity:1}100%{opacity:0}}
        @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
      `}</style>

      <Toast toasts={toasts} dismiss={dismissToast}/>

      {/* ── TOP BAR ── */}
      <div style={{background:"#040609",borderBottom:"1px solid #0d1828",padding:"9px 18px",display:"flex",alignItems:"center",gap:14,flexShrink:0}}>
        <span style={{fontFamily:"'Syne Mono'",fontSize:17,color:"#22d3a0",letterSpacing:3}}>APEX</span>
        <div style={{fontSize:7,color:"#1e3a5a",letterSpacing:3}}>LIVE</div>
        <div style={{width:1,height:14,background:"#0d1828"}}/>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:connected?PHASE_COLOR[phase]:"#f43f6a",boxShadow:connected?`0 0 6px ${PHASE_COLOR[phase]}`:"0 0 6px #f43f6a"}} className={connected&&agentRunning?"pulse":""}/>
          <span style={{fontSize:8,color:connected?PHASE_COLOR[phase]:"#f43f6a",letterSpacing:2}}>{connected?PHASE_LABEL[phase]:"DISCONNECTED"}</span>
        </div>
        {agentRunning&&<div style={{fontSize:7,color:"#1e3a5a"}}>cycle #{cycleCount} · {shortlist.length} shortlisted · {Object.keys(research).length} researched</div>}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:14}}>
          <PnLLine/>
          <div style={{borderLeft:"1px solid #0d1828",paddingLeft:14}}>
            <div style={{fontSize:6,color:"#1e3a5a",letterSpacing:1}}>PORTFOLIO</div>
            <div style={{fontFamily:"'Syne Mono'",fontSize:15,color:totalPnL>=0?"#22d3a0":"#f43f6a"}}>£{portfolioVal.toFixed(2)}</div>
          </div>
          <div>
            <div style={{fontSize:6,color:"#1e3a5a",letterSpacing:1}}>P&L</div>
            <div style={{fontSize:10,color:totalPnL>=0?"#22d3a0":"#f43f6a",fontWeight:500}}>{totalPnL>=0?"+":""}£{totalPnL.toFixed(2)} <span style={{fontSize:8}}>({pnlPct>=0?"+":""}{pnlPct.toFixed(2)}%)</span></div>
          </div>
          <button className="btn" onClick={agentRunning?stopAgent:startAgent}
            style={{padding:"7px 16px",borderRadius:2,fontSize:9,background:agentRunning?"rgba(244,63,106,.08)":"rgba(34,211,160,.08)",color:agentRunning?"#f43f6a":"#22d3a0",border:`1px solid ${agentRunning?"#f43f6a":"#22d3a0"}`}}>
            {agentRunning?"⬛ STOP":"▶ START"}
          </button>
        </div>
      </div>

      <ConnBanner connected={connected}/>
      <ProgressBar/>

      {/* ── BODY ── */}
      <div style={{display:"grid",gridTemplateColumns:"210px 1fr 270px",flex:1,overflow:"hidden",minHeight:0}}>

        {/* ── LEFT: selected stock ── */}
        <div style={{borderRight:"1px solid #0d1828",display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{padding:"12px 13px",borderBottom:"1px solid #0d1828",flexShrink:0}}>
            <div style={{fontFamily:"'Syne Mono'",fontSize:19,color:"#e2e8f0"}}>{selected}</div>
            <div style={{fontSize:8,color:"#1e3a5a",marginTop:1}}>{selInfo?.name} · {selInfo?.sector}</div>
            {selPrice&&(
              <div style={{display:"flex",alignItems:"baseline",gap:8,marginTop:5}}>
                <span style={{fontSize:15,color:"#c8d6e5"}}>£{selPrice.cur?.toFixed(2)}</span>
                <span style={{fontSize:8,color:selPrice.cur>=selPrice.prev?"#22d3a0":"#f43f6a"}}>{selPrice.cur>=selPrice.prev?"▲":"▼"}{Math.abs((selPrice.cur-selPrice.prev)/(selPrice.prev||1)*100).toFixed(3)}%</span>
              </div>
            )}
            {!selPrice&&<div style={{fontSize:9,color:"#1e3a5a",marginTop:6}} className="pulse">Awaiting price data...</div>}
          </div>

          {/* Quant score */}
          {selScore!==undefined&&(
            <div style={{padding:"10px 13px",borderBottom:"1px solid #0d1828",flexShrink:0}}>
              <div style={{fontSize:7,color:"#1e3a5a",letterSpacing:2,marginBottom:5}}>QUANT SCREEN SCORE</div>
              <ScoreBar score={selScore}/>
              <div style={{fontSize:8,color:selInSl?"#22d3a0":"#2a4a6a",marginTop:4}}>{selInSl?"✓ ON SHORTLIST":"○ BELOW THRESHOLD"}</div>
            </div>
          )}

          {/* Decision */}
          {selD&&(
            <div style={{padding:"10px 13px",borderBottom:"1px solid #0d1828",flexShrink:0}} className="fu">
              <div style={{fontSize:7,color:"#1e3a5a",letterSpacing:2,marginBottom:4}}>DECISION</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontFamily:"'Syne Mono'",fontSize:16,color:selD.action==="BUY"?"#22d3a0":selD.action==="SELL"?"#f43f6a":"#2a4a5a"}}>{selD.action}</span>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:10,color:selD.confidence>70?"#22d3a0":selD.confidence>40?"#f59e0b":"#f43f6a",fontFamily:"'Syne Mono'",fontWeight:700}}>{selD.confidence}%</div>
                  {selD.expectedReturn>0&&<div style={{fontSize:7,color:"#1e3a5a"}}>exp +{selD.expectedReturn}%</div>}
                </div>
              </div>
              <div style={{fontSize:8,color:"#4a6070",marginTop:3,lineHeight:1.5}}>{selD.rationale}</div>
              {selD.keySignal&&<div style={{fontSize:7,color:"#2a4a6a",marginTop:3}}>signal: {selD.keySignal}</div>}
            </div>
          )}

          {/* Research */}
          {selR?(
            <div style={{flex:1,overflowY:"auto",padding:"10px 13px"}} className="fu">
              <div style={{fontSize:7,color:"#1e3a5a",letterSpacing:2,marginBottom:4}}>RESEARCH <span style={{color:"#1a3050",marginLeft:4}}>{selR.depth?.toUpperCase()||""}</span></div>
              <div style={{fontSize:8,color:"#3a5a60",lineHeight:1.6,marginBottom:7,fontStyle:"italic"}}>{selR.headline}</div>
              {[
                ["Sentiment",selR.sentiment,selR.sentiment==="bullish"?"#22d3a0":selR.sentiment==="bearish"?"#f43f6a":"#6b7280"],
                ["Rating",selR.analystRating,"#8a9bb0"],
                ["Target",`£${Number(selR.priceTarget).toFixed(2)}`,selR.priceTarget>selPrice?.cur?"#22d3a0":"#f43f6a"],
                ["Return score",`${selR.returnScore}/100`,selR.returnScore>65?"#22d3a0":selR.returnScore<40?"#f43f6a":"#f59e0b"],
                ["News score",selR.newsScore?.toFixed(2),selR.newsScore>0?"#22d3a0":selR.newsScore<0?"#f43f6a":"#6b7280"],
              ].map(([k,v,c])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:"1px solid #080e18"}}>
                  <span style={{fontSize:8,color:"#1e3a5a"}}>{k}</span>
                  <span style={{fontSize:8,color:c,fontWeight:500}}>{String(v||"—").toUpperCase()}</span>
                </div>
              ))}
              {selR.keyCatalysts?.length>0&&<div style={{marginTop:7}}><div style={{fontSize:6,color:"#22d3a0",marginBottom:3}}>CATALYSTS</div>{selR.keyCatalysts.slice(0,2).map((c,i)=><div key={i} style={{fontSize:7,color:"#3a5a40",lineHeight:1.5}}>· {c}</div>)}</div>}
              {selR.keyRisks?.length>0&&<div style={{marginTop:5}}><div style={{fontSize:6,color:"#f43f6a",marginBottom:3}}>RISKS</div>{selR.keyRisks.slice(0,2).map((r,i)=><div key={i} style={{fontSize:7,color:"#5a3a40",lineHeight:1.5}}>· {r}</div>)}</div>}
              <div style={{fontSize:6,color:"#1a2a3a",marginTop:6}}>{selR.lastResearched&&new Date(selR.lastResearched).toLocaleTimeString()}</div>
            </div>
          ):(
            <div style={{padding:"12px 13px",fontSize:8,color:"#1e3a5a"}} className={agentRunning&&selInSl?"pulse":""}>
              {agentRunning&&selInSl?`${activeResearch===selected?"🔍 Researching now...":"Queued for research..."}`:"Start agent to research"}
            </div>
          )}

          {selPos&&(
            <div style={{padding:"9px 13px",borderTop:"1px solid #0d1828",background:"rgba(59,130,246,.05)",flexShrink:0}}>
              <div style={{fontSize:6,color:"#3b82f6",marginBottom:3}}>OPEN POSITION</div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:9}}>{selPos.qty}sh · avg £{selPos.avg_price?.toFixed(2)}</span>
                <span style={{fontSize:10,color:((selPrice?.cur-selPos.avg_price)/selPos.avg_price)>=0?"#22d3a0":"#f43f6a",fontWeight:500}}>
                  {(((selPrice?.cur-selPos.avg_price)/selPos.avg_price)*100)>=0?"+":""}{(((selPrice?.cur-selPos.avg_price)/selPos.avg_price)*100).toFixed(2)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── CENTRE: tabs ── */}
        <div style={{display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",borderBottom:"1px solid #0d1828",padding:"0 16px",flexShrink:0}}>
            {["universe","shortlist","audit"].map(t=>(
              <div key={t} onClick={()=>setViewTab(t)} style={{padding:"8px 14px",fontSize:7,letterSpacing:2,cursor:"pointer",borderBottom:`2px solid ${viewTab===t?"#22d3a0":"transparent"}`,color:viewTab===t?"#22d3a0":"#1e3a5a",transition:"all .15s"}}>
                {t.toUpperCase()}{t==="universe"?` (${UNIVERSE.length})`:t==="shortlist"?` (${shortlist.length})`:` (${audit.length})`}
              </div>
            ))}
            {viewTab==="universe"&&(
              <div style={{marginLeft:"auto",display:"flex",gap:3,flexWrap:"wrap",justifyContent:"flex-end",maxWidth:300}}>
                {["ALL",...sectors.slice(0,5)].map(s=>(
                  <div key={s} onClick={()=>setSectorFilter(s)} style={{padding:"2px 6px",borderRadius:2,fontSize:6,cursor:"pointer",background:sectorFilter===s?"rgba(34,211,160,.1)":"transparent",color:sectorFilter===s?"#22d3a0":"#1e3a5a",border:`1px solid ${sectorFilter===s?"#22d3a0":"#0d1828"}`}}>{s}</div>
                ))}
              </div>
            )}
            {viewTab==="audit"&&audit.length>0&&(
              <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
                <select onChange={e=>setAuditSort(e.target.value)} style={{background:"#0a1220",border:"1px solid #0d1828",color:"#3a5a6a",fontSize:7,padding:"2px 6px",borderRadius:2,cursor:"pointer"}}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
                <button className="btn" onClick={exportCSV} style={{padding:"3px 10px",fontSize:7,background:"rgba(34,211,160,.08)",color:"#22d3a0",border:"1px solid rgba(34,211,160,.3)",borderRadius:2}}>⬇ CSV</button>
              </div>
            )}
          </div>

          {/* Universe */}
          {viewTab==="universe"&&(
            <div style={{flex:1,overflowY:"auto"}}>
              <div style={{display:"grid",gridTemplateColumns:"75px 1fr 70px 55px 55px 70px",padding:"5px 14px",borderBottom:"1px solid #0d1828"}}>
                {["SYM","NAME","PRICE","SCORE","EXCH","STATUS"].map(h=><div key={h} style={{fontSize:6,color:"#1e3a5a",letterSpacing:1}}>{h}</div>)}
              </div>
              {universeRows.map(({sym,name,sector,exch})=>{
                const p=prices[sym];
                const sc=screenScores[sym];
                const inSl=shortlist.includes(sym);
                const r=research[sym];
                const isA=activeResearch===sym;
                return(
                  <div key={sym} onClick={()=>setSelected(sym)} className="hov fu"
                    style={{display:"grid",gridTemplateColumns:"75px 1fr 70px 55px 55px 70px",padding:"6px 14px",borderBottom:"1px solid #080e18",borderLeft:`2px solid ${selected===sym?"#22d3a0":inSl?"rgba(34,211,160,.15)":"transparent"}`,background:selected===sym?"#0a1520":"transparent",alignItems:"center"}}>
                    <div style={{fontSize:10,fontWeight:500,color:selected===sym?"#22d3a0":"#c8d6e5"}}>{sym}</div>
                    <div><div style={{fontSize:8,color:"#5a7a8a"}}>{name}</div><div style={{fontSize:6,color:"#1e3a5a"}}>{sector}</div></div>
                    <div>
                      <div style={{fontSize:9}}>{p?`£${p.cur?.toFixed(2)}`:"—"}</div>
                      {p&&<div style={{fontSize:6,color:p.cur>=p.prev?"#22d3a0":"#f43f6a"}}>{p.cur>=p.prev?"▲":"▼"}{Math.abs((p.cur-p.prev)/(p.prev||1)*100).toFixed(2)}%</div>}
                    </div>
                    <div>{sc!==undefined?<ScoreBar score={sc}/>:<span style={{fontSize:6,color:"#1e3a5a"}}>—</span>}</div>
                    <div style={{fontSize:7,color:"#2a4a6a"}}>{exch}</div>
                    <div style={{fontSize:6}}>{isA?<span style={{color:"#f59e0b"}} className="pulse">LIVE</span>:r?<span style={{color:"#22d3a0"}}>✓</span>:inSl?<span style={{color:"#3b82f6"}}>QUEUED</span>:sc!==undefined?<span style={{color:"#1e3a5a"}}>SCREENED</span>:<span style={{color:"#0d1828"}}>—</span>}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Shortlist */}
          {viewTab==="shortlist"&&(
            <div style={{flex:1,overflowY:"auto"}}>
              {shortlist.length===0&&<div style={{padding:"28px",fontSize:9,color:"#1e3a5a",textAlign:"center"}}>{agentRunning?<span className="pulse">Running screener...</span>:"Start agent to begin"}</div>}
              {shortlistRows.map(row=>{
                const p=prices[row.sym];
                const isA=activeResearch===row.sym;
                const d=decisions[row.sym];
                return(
                  <div key={row.sym} onClick={()=>setSelected(row.sym)} className="hov fu"
                    style={{padding:"10px 16px",borderBottom:"1px solid #080e18",borderLeft:`2px solid ${selected===row.sym?"#22d3a0":"transparent"}`,background:selected===row.sym?"#0a1520":"transparent",display:"grid",gridTemplateColumns:"80px 1fr 85px 85px",gap:8,alignItems:"start"}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:500,color:selected===row.sym?"#22d3a0":"#c8d6e5"}}>{row.sym}</div>
                      <div style={{fontSize:6,color:"#1e3a5a"}}>{row.sector}</div>
                    </div>
                    <div>
                      {isA&&<div style={{fontSize:7,color:"#f59e0b"}} className="pulse">🔍 Researching...</div>}
                      {row.headline&&<div style={{fontSize:8,color:"#3a5a60",lineHeight:1.5,fontStyle:"italic"}}>{row.headline}</div>}
                      {!isA&&!row.headline&&<div style={{fontSize:7,color:"#1e3a5a"}}>Awaiting research...</div>}
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:10}}>{p?`£${p.cur?.toFixed(2)}`:"—"}</div>
                      {row.returnScore!==undefined&&<div style={{marginTop:3}}><ScoreBar score={row.returnScore}/></div>}
                    </div>
                    <div style={{textAlign:"right"}}>
                      {row.sentiment&&<div style={{fontSize:7,padding:"2px 5px",borderRadius:2,display:"inline-block",marginBottom:3,background:row.sentiment==="bullish"?"rgba(34,211,160,.1)":row.sentiment==="bearish"?"rgba(244,63,106,.1)":"rgba(100,100,100,.08)",color:row.sentiment==="bullish"?"#22d3a0":row.sentiment==="bearish"?"#f43f6a":"#6b7280"}}>{row.sentiment?.toUpperCase()}</div>}
                      {d&&<div style={{fontSize:8,color:d.action==="BUY"?"#22d3a0":d.action==="SELL"?"#f43f6a":"#2a4a5a",fontFamily:"'Syne Mono'"}}>{d.action} {d.confidence}%</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Audit */}
          {viewTab==="audit"&&(
            <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
              {audit.length>0&&(
                <div style={{padding:"12px 16px",borderBottom:"1px solid #0d1828",display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,flexShrink:0}}>
                  {[
                    ["GROSS P&L",`${totalGrossPnl>=0?"+":""}£${totalGrossPnl.toFixed(2)}`,totalGrossPnl>=0?"#22d3a0":"#f43f6a"],
                    ["API COSTS",`£${apiCost.toFixed(2)}`,"#f59e0b"],
                    ["VPS COSTS",`£${vpsCost.toFixed(2)}`,"#f59e0b"],
                    ["TRUE NET",`${trueNetPnL>=0?"+":""}£${trueNetPnL.toFixed(2)}`,trueNetPnL>=0?"#22d3a0":"#f43f6a"],
                    ["WIN RATE",closedTrades.length?`${Math.round(winTrades/closedTrades.length*100)}%`:"—","#3b82f6"],
                  ].map(([k,v,c])=>(
                    <div key={k} style={{padding:"6px 8px",background:"#0a1220",borderRadius:2,border:"1px solid #0d1828"}}>
                      <div style={{fontSize:6,color:"#1e3a5a",letterSpacing:1,marginBottom:3}}>{k}</div>
                      <div style={{fontSize:12,fontFamily:"'Syne Mono'",color:c,fontWeight:700}}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
              {bestTrade&&(
                <div style={{padding:"6px 16px",borderBottom:"1px solid #0d1828",display:"flex",gap:16,flexShrink:0}}>
                  <span style={{fontSize:7,color:"#22d3a0"}}>BEST: {bestTrade.sym} +£{bestTrade.gross_pnl?.toFixed(2)}</span>
                  <span style={{fontSize:7,color:"#f43f6a"}}>WORST: {worstTrade?.sym} £{worstTrade?.gross_pnl?.toFixed(2)}</span>
                  <span style={{fontSize:7,color:"#1e3a5a"}}>{closedTrades.length} closed trades</span>
                </div>
              )}
              <div style={{flex:1,overflowY:"auto"}}>
                {audit.length===0&&<div style={{padding:"28px",fontSize:9,color:"#1e3a5a",textAlign:"center"}}>{agentRunning?<span className="pulse">Waiting for first trade...</span>:"No trades yet"}</div>}
                {sortedAudit.map((log,i)=>(
                  <div key={log.id||i} style={{padding:"9px 16px",borderBottom:"1px solid #080e18",fontSize:8}} className="fu">
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
                      <span style={{fontSize:6,color:"#1e3a5a",flexShrink:0}}>{log.ts}</span>
                      <span style={{fontSize:6,padding:"1px 5px",borderRadius:2,letterSpacing:1,background:log.type==="BUY"?"rgba(34,211,160,.1)":log.type==="PROFIT"?"rgba(134,239,172,.08)":log.type==="STOP"?"rgba(244,63,106,.1)":"rgba(255,255,255,.04)",color:log.type==="BUY"?"#22d3a0":log.type==="PROFIT"?"#86efac":log.type==="STOP"?"#f43f6a":"#6b7280"}}>{log.type}</span>
                      <span style={{color:"#a8b8c8",fontWeight:500}}>{log.sym}</span>
                      <span style={{color:"#3a5a6a"}}>{log.shares}sh</span>
                      {log.entry_price&&<span style={{color:"#2a4a5a"}}>@ £{log.entry_price?.toFixed(2)}</span>}
                      {log.exit_price&&<span style={{color:"#3a5a6a"}}>→ £{log.exit_price?.toFixed(2)}</span>}
                      {log.gross_pnl!=null&&(
                        <span style={{color:log.gross_pnl>=0?"#22d3a0":"#f43f6a",fontWeight:600,marginLeft:"auto"}}>
                          {log.gross_pnl>=0?"+":""}£{log.gross_pnl?.toFixed(2)}
                          {log.gross_pnl_pct!=null&&<span style={{fontSize:7,marginLeft:3}}>({log.gross_pnl_pct>=0?"+":""}{log.gross_pnl_pct?.toFixed(1)}%)</span>}
                        </span>
                      )}
                    </div>
                    <div style={{display:"flex",gap:10,fontSize:7,color:"#2a4a5a"}}>
                      {log.hold_mins&&<span>held {log.hold_mins>60?`${(log.hold_mins/60).toFixed(1)}h`:`${log.hold_mins}m`}</span>}
                      {log.trigger&&<span>trigger: {log.trigger}</span>}
                      {log.confidence&&<span>conf: {log.confidence}%</span>}
                      {log.rationale&&<span style={{color:"#1e3a5a",flex:1}}>{log.rationale}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: portfolio ── */}
        <div style={{borderLeft:"1px solid #0d1828",display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{padding:"7px 13px",borderBottom:"1px solid #0d1828",fontSize:6,color:"#1e3a5a",letterSpacing:2,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>PORTFOLIO · ALPACA {serverState?.paper!==false?"PAPER":"LIVE"}</span>
            {drawdownMode!=="ok"&&(
              <span style={{fontSize:6,padding:"1px 5px",borderRadius:2,background:"rgba(244,63,106,.15)",color:"#f43f6a",letterSpacing:1}}>
                {drawdownMode==="daily_pause"?"⚠ DAILY PAUSE":drawdownMode==="weekly_close"?"⛔ WEEKLY CLOSE":"🛑 STOPPED"}
              </span>
            )}
          </div>
          <div style={{padding:"9px 13px",borderBottom:"1px solid #0d1828"}}>
            {/* True P&L breakdown */}
            <div style={{marginBottom:6,padding:"6px 8px",background:"#0a1220",borderRadius:2,border:"1px solid #0d1828"}}>
              <div style={{fontSize:6,color:"#1e3a5a",letterSpacing:1,marginBottom:4}}>TRUE P&L SINCE {baselineStarted?new Date(baselineStarted).toLocaleDateString("en-GB",{day:"numeric",month:"short"}):"start"}</div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}>
                <span style={{fontSize:7,color:"#3a5a6a"}}>Gross trading</span>
                <span style={{fontSize:7,color:grossTradingPnL>=0?"#22d3a0":"#f43f6a"}}>{grossTradingPnL>=0?"+":""}£{grossTradingPnL.toFixed(2)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}>
                <span style={{fontSize:7,color:"#3a5a6a"}}>Anthropic API</span>
                <span style={{fontSize:7,color:"#f43f6a"}}>-£{apiCost.toFixed(2)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}>
                <span style={{fontSize:7,color:"#3a5a6a"}}>VPS (Mythic Beasts)</span>
                <span style={{fontSize:7,color:"#f43f6a"}}>-£{vpsCost.toFixed(2)}</span>
              </div>
              <div style={{borderTop:"1px solid #1a2a3a",marginTop:3,paddingTop:3,display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:7,color:"#8a9bb0",fontWeight:600}}>True net P&L</span>
                <span style={{fontSize:10,color:trueNetPnL>=0?"#22d3a0":"#f43f6a",fontWeight:700}}>{trueNetPnL>=0?"+":""}£{trueNetPnL.toFixed(2)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:1}}>
                <span style={{fontSize:6,color:"#1e3a5a"}}>vs baseline £{baselineVal.toFixed(0)}</span>
                <span style={{fontSize:7,color:trueNetPct>=0?"#22d3a0":"#f43f6a"}}>{trueNetPct>=0?"+":""}{ trueNetPct.toFixed(3)}%</span>
              </div>
            </div>
            {[
              ["Cash",`£${cash.toFixed(2)}`,"#8a9bb0"],
              ["Invested",`£${invested.toFixed(2)}`,"#8a9bb0"],
              ["Portfolio",`£${portfolioVal.toFixed(2)}`,grossTradingPnL>=0?"#22d3a0":"#f43f6a"],
              ["Win rate",closedTrades.length?`${Math.round(winTrades/closedTrades.length*100)}%`:"—","#3b82f6"],
              ["Positions",`${Object.keys(positions).length}/2`,"#8a9bb0"],
              ["Shortlisted",`${shortlist.length}`,"#3b82f6"],
              ["Researched",`${Object.keys(research).length}`,"#22d3a0"],
            ].map(([k,v,c])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:"1px solid #080e18"}}>
                <span style={{fontSize:7,color:"#1e3a5a"}}>{k}</span>
                <span style={{fontSize:8,color:c,fontWeight:500}}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{padding:"7px 13px",borderBottom:"1px solid #0d1828",fontSize:6,color:"#1e3a5a",letterSpacing:2}}>POSITIONS</div>
          <div style={{borderBottom:"1px solid #0d1828"}}>
            {Object.keys(positions).length===0&&<div style={{padding:"9px 13px",fontSize:7,color:"#1a2a3a"}}>No open positions</div>}
            {Object.entries(positions).map(([sym,pos])=>{
              const cur=prices[sym]?.cur||pos.avg_price;
              const pct=(cur-pos.avg_price)/pos.avg_price*100;
              const val=cur*pos.qty;
              return(
                <div key={sym} onClick={()=>setSelected(sym)} className="hov" style={{padding:"8px 13px",borderBottom:"1px solid #080e18",cursor:"pointer"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                    <span style={{fontSize:10,fontWeight:500,color:"#c8d6e5"}}>{sym}</span>
                    <span style={{fontSize:10,color:pct>=0?"#22d3a0":"#f43f6a",fontWeight:500}}>{pct>=0?"+":""}{pct.toFixed(2)}%</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:6,color:"#1e3a5a"}}>{pos.qty}sh · avg £{pos.avg_price?.toFixed(2)}</span>
                    <span style={{fontSize:6,color:"#2a4a6a"}}>£{val.toFixed(2)}</span>
                  </div>
                  <div style={{height:2,background:"#080e18",borderRadius:1}}>
                    <div style={{height:"100%",width:`${Math.min((val/portfolioVal)*100,100)}%`,background:pct>=0?"#22d3a0":"#f43f6a",borderRadius:1,transition:"width .5s"}}/>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{padding:"7px 13px",borderBottom:"1px solid #0d1828",fontSize:6,color:"#1e3a5a",letterSpacing:2}}>RESEARCH PIPELINE</div>
          <div style={{flex:1,overflowY:"auto",padding:"6px 13px"}}>
            {shortlist.map(sym=>{
              const r=research[sym];
              const isA=activeResearch===sym;
              return(
                <div key={sym} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:"1px solid #080e18",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <span style={{fontSize:7,color:isA?"#f59e0b":r?"#22d3a0":"#1e3a5a"}}>{isA?"◎":r?"✓":"○"}</span>
                    <span style={{fontSize:7,color:isA?"#f59e0b":r?"#8a9bb0":"#2a4a6a"}}>{sym}</span>
                    {r?.depth&&<span style={{fontSize:5,color:"#1a3050",padding:"1px 3px",border:"1px solid #1a3050",borderRadius:1}}>{r.depth}</span>}
                  </div>
                  <span style={{fontSize:6,color:"#1a2a3a"}}>{isA?<span className="pulse" style={{color:"#f59e0b"}}>live</span>:r?new Date(r.lastResearched).toLocaleTimeString():"queued"}</span>
                </div>
              );
            })}
            {shortlist.length===0&&<div style={{fontSize:7,color:"#1a2a3a"}}>No shortlist yet</div>}
          </div>

          <div style={{padding:"7px 13px",borderTop:"1px solid #0d1828",background:"#040609"}}>
            <div style={{fontSize:6,color:"#1a2a3a",lineHeight:1.8}}>
              Connected to {API_BASE}<br/>
              Polling every 2s · Real Alpaca data<br/>
              {connected?`Last update: ${new Date(serverState?.lastUpdated*1000).toLocaleTimeString()}`:"Reconnecting..."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
