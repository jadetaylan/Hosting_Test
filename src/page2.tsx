import { useState, useRef, useMemo, useEffect, memo, useCallback } from "react";

const LABS = ["Porto","Tondela","Coimbra","Braga","Évora"];
const NAV = "#1e3a5f";
const ROW_H = 48;
const OVERSCAN = 5;
const CURRENT_USER = { name:"Maria Alves", initials:"MA" };
const TRAY_PREFIX = "TRY-";
const AQC_BATCH_SIZE = 5;

const CHEM_MATRICES = ["Groundwater","Sludge","Final Effluent","Trade Effluent","Trade Water","Surface Water","Crude Sewage","Leachate Sample"];
const ANALYTE_COL_W = 130;
const METHOD_FULL = { "ICP-OES":"Inductively Coupled Plasma – Optical Emission Spectrometry", "IC":"Ion Chromatography" };
const METHOD_ANALYTES = { "ICP-OES":["Lead (Pb)","Cadmium (Cd)","Zinc (Zn)","Copper (Cu)"], "IC":["Nitrate","Sulphate","Chloride"] };
const QC_TYPES = {
  MB: { label:"Method Blank", short:"MB", color:"#7c3aed", bg:"#ede9fe", icon:"⬜" },
  LCS:{ label:"Lab Control Sample", short:"LCS", color:"#0891b2", bg:"#e0f2fe", icon:"📊" },
  MS: { label:"Matrix Spike", short:"MS", color:"#b45309", bg:"#fef3c7", icon:"💉" },
  DUP:{ label:"Duplicate", short:"DUP", color:"#059669", bg:"#d1fae5", icon:"🔁" },
};
const DUE_META = { "On Time":{ color:"#059669" }, "Due Soon":{ color:"#d97706" }, "Overdue":{ color:"#dc2626" } };
const STATUS_META = {
  Pending:  { color:"#f59e0b", bg:"#fef3c7", icon:"⏳" },
  Confirmed:{ color:"#10b981", bg:"#d1fae5", icon:"✔" },
  Skipped:  { color:"#94a3b8", bg:"#f1f5f9", icon:"⏭" },
  Reopened: { color:"#ef4444", bg:"#fee2e2", icon:"↺" },
};
const AUDIT_META = {
  confirmed: { icon:"✔", color:"#10b981", bg:"#d1fae5", label:"Confirmed" },
  skipped:   { icon:"⏭", color:"#94a3b8", bg:"#f1f5f9", label:"Skipped" },
  reopened:  { icon:"↺", color:"#ef4444", bg:"#fee2e2", label:"Reopened" },
  qc_deleted:{ icon:"🗑", color:"#ef4444", bg:"#fee2e2", label:"QC Deleted" },
  qc_toggled:{ icon:"🔀", color:"#7c3aed", bg:"#ede9fe", label:"QC Toggled" },
  tray_scan: { icon:"🗂", color:"#0d9488", bg:"#ccfbf1", label:"Tray Scan" },
  reordered: { icon:"↕", color:"#6366f1", bg:"#eef2ff", label:"Reordered" },
  grouped:   { icon:"🗂", color:"#0891b2", bg:"#e0f2fe", label:"Grouped" },
};
const CHEM_GRID_TPL = "20px 36px 0.4fr 1.1fr 0.9fr 0.55fr 0.7fr 0.55fr 0.55fr auto auto";
const CS = { padding:"0 10px", height:ROW_H, fontSize:13, color:"#334155", display:"flex", alignItems:"center", overflow:"hidden" };
const RUN_COLORS = ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#ec4899","#0891b2","#059669","#dc2626"];
const MAX_RUN_SIZE = 8;

// ── helpers ───────────────────────────────────────────────────────────────────
function uid()  { return Math.random().toString(36).slice(2,9); }
function rnd(a) { return a[Math.floor(Math.random()*a.length)]; }
function fmt(d) { return d.toISOString().split("T")[0]; }
function addDays(d,n) { const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function nowStr() {
  const d=new Date();
  return d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})+" · "+d.toLocaleDateString("en-GB",{day:"2-digit",month:"short"});
}
function getDueFlag(dd) { const diff=Math.ceil((new Date(dd)-new Date("2026-03-12"))/86400000); return diff<0?"Overdue":diff<=2?"Due Soon":"On Time"; }
function fmtDue(dd) { return new Date(dd).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}); }
function isTrayCode(v) { return v.toUpperCase().startsWith(TRAY_PREFIX.toUpperCase()); }

let _runCounter=0;
function genRunId() { _runCounter++; return "RUN-"+String(_runCounter).padStart(4,"0"); }
let MOCK_TRAY_DB={};

const SIM_TODAY = new Date("2026-03-18");
const BALANCES = [
  { id:"BAL-001", name:"Mettler Toledo XS205",  calExpiry:"2026-04-15" },
  { id:"BAL-002", name:"Sartorius Practum224",   calExpiry:"2026-02-28" },
  { id:"BAL-003", name:"Mettler Toledo MS304S",  calExpiry:"2026-05-01" },
  { id:"BAL-004", name:"Ohaus Pioneer PA224",    calExpiry:"2026-03-10" },
];
const EDPS = [
  { id:"EDP-001", name:"Eppendorf Multipette E3", calExpiry:"2026-06-01" },
  { id:"EDP-002", name:"Socorex Acura 825",       calExpiry:"2026-05-10" },
  { id:"EDP-003", name:"Brand Transferpette-8",   calExpiry:"2026-03-05" },
];
const FILTER_PAPERS = [
  { id:"FP-LOT-2024A", name:"Whatman 42 — Lot 2024A", expiry:"2027-01-01" },
  { id:"FP-LOT-2025B", name:"Whatman 42 — Lot 2025B", expiry:"2027-06-01" },
  { id:"FP-LOT-2025C", name:"Whatman 540 — Lot 2025C", expiry:"2026-03-15" },
];
const HEATING_BLOCKS = [
  { id:"HB-001", name:"Dry Block DB-3A",             calExpiry:"2026-07-01" },
  { id:"HB-002", name:"Stuart SBH130D",               calExpiry:"2026-05-20" },
  { id:"HB-003", name:"Thermo Scientific 88870001",   calExpiry:"2026-02-14" },
];
const EMPTY_SESSION_EQ = { balanceId:"", edpId:"", filterPaperId:"", heatingBlockId:"" };
const TARGET_WEIGHT=5.0, TOLERANCE_PCT=1;
const W_MIN=TARGET_WEIGHT*(1-TOLERANCE_PCT/100), W_MAX=TARGET_WEIGHT*(1+TOLERANCE_PCT/100);
const AQC_LOT_DB = {
  "AQC-2025-001":{ name:"ICP Multi-element Std Mix A", expiry:"2026-06-01", type:"ICP-OES" },
  "AQC-2025-002":{ name:"ICP Multi-element Std Mix B", expiry:"2026-04-10", type:"ICP-OES" },
  "AQC-2025-003":{ name:"ICP Calibration Std C",       expiry:"2026-03-10", type:"ICP-OES" },
  "AQC-2026-001":{ name:"ICP Trace Metals Std",        expiry:"2027-01-15", type:"ICP-OES" },
  "AQC-2026-002":{ name:"Anion Mixed Standard I",      expiry:"2026-09-01", type:"IC" },
};
const DILUTION_PRESETS = ["1:2","1:5","1:10","1:20","1:50","1:100","1:200","1:500","1:1000"];

function equipCalStatus(expiry) {
  if(!expiry) return "ok";
  const diff=Math.ceil((new Date(expiry)-SIM_TODAY)/86400000);
  return diff<0?"expired":diff<=14?"soon":"ok";
}
function weightStatus(val) {
  if(val===""||val===null||val===undefined) return null;
  const n=parseFloat(val); if(isNaN(n)) return "invalid";
  return (n>=W_MIN&&n<=W_MAX)?"ok":"out";
}

// ── data builders ─────────────────────────────────────────────────────────────
function genChemAnalytes(methodId) {
  const pool=METHOD_ANALYTES[methodId]||["Analyte A"];
  const today=new Date("2026-03-12");
  return pool.slice(0,1+Math.floor(Math.random()*2)).map(name=>({
    name, methodId, status:"Pending",
    dueDate:fmt(addDays(today,Math.floor(Math.random()*8)-2))
  }));
}
function genChemSamples(prefix,methodId,n) {
  return Array.from({length:n},(_,i)=>({
    _id:uid(), isQC:false, id:`${prefix}-${String(i+1).padStart(3,"0")}`,
    matrix:rnd(CHEM_MATRICES), analytes:genChemAnalytes(methodId),
    primaryMethodId:methodId, trayCode:null, coveredByQC:[], runId:null,
    dilution:null, replications:1,
  }));
}
function buildChemSections() {
  const icpSamples=genChemSamples("ICP","ICP-OES",30);
  const icSamples=genChemSamples("IC","IC",8);
  const bodSamples=genChemSamples("BOD","IC",10);
  return [
    { id:"chem-inorg", name:"Inorganics", discipline:"chem", categories:[
      { id:"icp-oes", name:"ICP-OES (Metals)", methodId:"ICP-OES", steps:[
        { id:"WEI", name:"Weighing",      qcEligible:false, samples:icpSamples },
        { id:"ACS", name:"Acidification", qcEligible:true,  samples:[] },
        { id:"FIL", name:"Filtration",    qcEligible:false, samples:[] },
        { id:"HB",  name:"Heating Block", qcEligible:false, samples:[] },
        { id:"ANA", name:"Analysis",      qcEligible:false, samples:[] },
      ]},
      { id:"ic", name:"IC (Anions)", methodId:"IC", steps:[
        { id:"FIL", name:"Filtration",     qcEligible:false, samples:icSamples },
        { id:"DIL", name:"Dilution",       qcEligible:false, samples:[] },
        { id:"ANA", name:"Analysis",       qcEligible:false, samples:[] },
      ]},
    ]},
    { id:"chem-bod", name:"BOD", discipline:"chem", categories:[
      { id:"bod", name:"BOD", methodId:"IC", steps:[
        { id:"DIL",  name:"Dilution",         qcEligible:false, samples:bodSamples },
        { id:"INC",  name:"Incubation Setup",  qcEligible:false, samples:[] },
        { id:"READ", name:"Final Reading",     qcEligible:false, samples:[] },
      ]},
    ]},
  ];
}
function buildAllSections() {
  MOCK_TRAY_DB={}; _runCounter=0;
  const secs=buildChemSections(); let tc=1;
  secs.forEach(sec=>sec.categories.forEach(cat=>cat.steps.forEach(st=>{
    const ids=st.samples.filter(s=>!s.isQC&&!s.trayCode).map(s=>s.id);
    if(!ids.length) return;
    for(let i=0;i<ids.length;i+=4){
      let code; do { code=TRAY_PREFIX+String(tc++).padStart(4,"0"); } while(MOCK_TRAY_DB[code]);
      const chunk=ids.slice(i,i+4);
      MOCK_TRAY_DB[code]={samples:chunk};
      chunk.forEach(sid=>{ const s=st.samples.find(x=>x.id===sid); if(s) s.trayCode=code; });
    }
  })));
  return secs;
}
function mockTrayLookup(trayCode) {
  return new Promise((resolve,reject)=>{
    setTimeout(()=>{
      if(Math.random()<0.07){ reject(new Error("Tray service unavailable.")); return; }
      const entry=MOCK_TRAY_DB[trayCode];
      if(!entry){ reject(new Error(`Tray "${trayCode}" not found.`)); return; }
      resolve({trayCode,samples:entry.samples,totalInTray:entry.samples.length});
    },350+Math.random()*300);
  });
}

// ── AQC sandwich ──────────────────────────────────────────────────────────────
function buildAqcSandwich(realSamples,runId) {
  const result=[];
  for(let i=0;i<realSamples.length;i+=AQC_BATCH_SIZE){
    const batch=realSamples.slice(i,i+AQC_BATCH_SIZE);
    batch.forEach(s=>result.push(s));
    const label=`S${String(Math.floor(i/AQC_BATCH_SIZE)+1).padStart(2,"0")}`;
    const eff=runId||(batch[0]?.runId??null);
    result.push({_id:uid(),isQC:true,autoQC:true,qcType:"LCS",id:`LCS-${eff||"NRUN"}-${label}`,runId:eff,matrix:"",primaryMethodId:"ICP-OES",coveredByQC:[],qcReason:`AQC Set ${label}${eff?" — "+eff:""}`,analytes:[{name:"Lab Control Sample",methodId:"ICP-OES",status:"Pending",dueDate:""}]});
    result.push({_id:uid(),isQC:true,autoQC:true,qcType:"MB", id:`MB-${eff||"NRUN"}-${label}`, runId:eff,matrix:"",primaryMethodId:"ICP-OES",coveredByQC:[],qcReason:`AQC Set ${label}${eff?" — "+eff:""}`,analytes:[{name:"Method Blank",methodId:"ICP-OES",status:"Pending",dueDate:""}]});
  }
  return result;
}

function makeMutate(setSections,activeKey) {
  return fn=>setSections(prev=>prev.map(sec=>{
    if(sec.id!==activeKey.secId) return sec;
    return {...sec,categories:sec.categories.map(cat=>{
      if(cat.id!==activeKey.catId) return cat;
      return {...cat,steps:cat.steps.map(st=>{
        if(st.id!==activeKey.stepId) return st;
        return {...st,samples:fn(st.samples)};
      })};
    })};
  }));
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARED UI
// ══════════════════════════════════════════════════════════════════════════════
function FixedTooltip({children,tip,tipContent,disabled}) {
  const ref=useRef(); const [pos,setPos]=useState(null); const content=tipContent||tip;
  return (
    <div ref={ref} style={{display:"inline-block"}}
      onMouseEnter={()=>{ if(ref.current){const r=ref.current.getBoundingClientRect();setPos({top:r.top,left:r.left+r.width/2});} }}
      onMouseLeave={()=>setPos(null)}>
      {children}
      {pos&&!disabled&&content&&(
        <div style={{position:"fixed",zIndex:9999,pointerEvents:"none",top:pos.top-8,left:pos.left,transform:"translate(-50%,-100%)",background:"#1e293b",color:"#fff",borderRadius:7,padding:"6px 10px",fontSize:11,whiteSpace:"pre-line",maxWidth:260,boxShadow:"0 4px 16px #0004"}}>
          {content}<div style={{position:"absolute",bottom:-4,left:"50%",transform:"translateX(-50%)",width:8,height:8,background:"#1e293b",rotate:"45deg"}}/>
        </div>
      )}
    </div>
  );
}
function StatusBadge({status}) {
  const m=STATUS_META[status]||STATUS_META.Pending;
  return <span style={{background:m.bg,color:m.color,border:"1px solid "+m.color+"44",borderRadius:4,padding:"2px 7px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{m.icon} {status}</span>;
}
function TrayBadge({trayCode}) {
  return <span style={{fontSize:9,background:"#ccfbf1",color:"#0d9488",borderRadius:3,padding:"1px 5px",fontWeight:700,border:"1px solid #99f6e4"}}>{trayCode}</span>;
}
function RunBadge({runId}) {
  if(!runId) return null;
  return <span style={{fontSize:9,background:"#eef2ff",color:"#4f46e5",borderRadius:3,padding:"1px 6px",fontWeight:800,border:"1px solid #c7d2fe",letterSpacing:".03em",fontFamily:"monospace"}}>{runId}</span>;
}
function QCBadge({qcType,reason}) {
  const q=QC_TYPES[qcType]; if(!q) return null;
  return (
    <FixedTooltip tipContent={<><div style={{fontWeight:700,marginBottom:2}}>{q.label}</div><div style={{opacity:.8}}>{reason}</div></>}>
      <span style={{background:q.bg,color:q.color,border:"1px solid "+q.color+"55",borderRadius:4,padding:"2px 7px",fontSize:11,fontWeight:800,whiteSpace:"nowrap",cursor:"default"}}>{q.icon} {q.short}</span>
    </FixedTooltip>
  );
}
function DueBadge({dueDate}) {
  const flag=getDueFlag(dueDate); const m=DUE_META[flag];
  return (
    <FixedTooltip tipContent={<><div style={{fontWeight:700,color:m.color,marginBottom:2}}>⬤ {flag}</div><div style={{opacity:.8}}>Due: {fmtDue(dueDate)}</div></>}>
      <span style={{width:10,height:10,borderRadius:"50%",background:m.color,display:"inline-block",cursor:"default"}}/>
    </FixedTooltip>
  );
}
function AnalyteCell({analyte}) {
  return (
    <FixedTooltip tipContent={<><div style={{fontWeight:700,marginBottom:2}}>{analyte.name}</div><div style={{fontSize:10,opacity:.75}}>{METHOD_FULL[analyte.methodId]||analyte.methodId}</div></>}>
      <div style={{display:"flex",flexDirection:"column",gap:2}}>
        <span style={{fontSize:11,fontWeight:600,color:NAV,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:ANALYTE_COL_W-16}}>{analyte.name}</span>
        <span style={{fontSize:9,fontWeight:700,color:"#64748b",background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:3,padding:"0 4px"}}>{analyte.methodId}</span>
      </div>
    </FixedTooltip>
  );
}
function AQCToggleSwitch({enabled,onToggle,isActive,stepName}) {
  const tip=enabled?`AQC enabled on "${stepName}"\nSamples here get LCS+MB sets.\nClick to disable.`:`AQC disabled on "${stepName}"\nClick to enable — 1 LCS+MB set per ${AQC_BATCH_SIZE} samples.`;
  return (
    <FixedTooltip tipContent={tip}>
      <div onClick={e=>{e.stopPropagation();onToggle();}}
        style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",background:enabled?(isActive?"#ffffff20":"#dcfce7"):(isActive?"#ffffff10":"#f1f5f9"),border:"1px solid "+(enabled?(isActive?"#ffffff40":"#86efac"):(isActive?"#ffffff20":"#e2e8f0")),borderRadius:20,padding:"2px 6px 2px 4px",userSelect:"none"}}>
        <div style={{width:26,height:14,borderRadius:7,position:"relative",background:enabled?"#10b981":(isActive?"#ffffff30":"#cbd5e1"),transition:"background 0.2s",flexShrink:0}}>
          <div style={{position:"absolute",top:2,left:enabled?14:2,width:10,height:10,borderRadius:"50%",background:"#fff",transition:"left 0.18s",boxShadow:"0 1px 3px #0003"}}/>
        </div>
        <span style={{fontSize:9,fontWeight:800,color:enabled?(isActive?"#fff":"#15803d"):(isActive?"#ffffff60":"#94a3b8")}}>AQC</span>
      </div>
    </FixedTooltip>
  );
}
function AuditLogFloat({entries,onClose}) {
  return (
    <div style={{position:"fixed",inset:0,background:"#00000033",zIndex:800,display:"flex",alignItems:"flex-end",justifyContent:"flex-end",padding:20}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:14,width:360,maxHeight:"70vh",boxShadow:"0 16px 48px #0004",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 16px",background:NAV,color:"#fff"}}>
          <span>🗒</span><span style={{fontWeight:700,fontSize:14}}>Audit Log</span>
          {entries.length>0&&<span style={{fontSize:10,background:"#ffffff30",borderRadius:10,padding:"1px 7px"}}>{entries.length}</span>}
          <button onClick={onClose} style={{marginLeft:"auto",background:"none",border:"none",color:"#fff",fontSize:16,cursor:"pointer",opacity:.7}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"10px 14px"}}>
          {entries.length===0&&<div style={{padding:"24px 0",textAlign:"center",fontSize:12,color:"#cbd5e1"}}>No activity yet.</div>}
          {[...entries].reverse().map((e,i)=>{
            const m=AUDIT_META[e.type]||AUDIT_META.confirmed;
            return (
              <div key={i} style={{display:"flex",gap:10,padding:"7px 8px",borderRadius:7,background:i%2===0?"#f8fafc":"#fff",borderLeft:"3px solid "+m.color,marginBottom:2}}>
                <div style={{width:24,height:24,borderRadius:"50%",background:m.bg,color:m.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,flexShrink:0}}>{m.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,fontWeight:800,color:m.color,textTransform:"uppercase"}}>{m.label}</div>
                  {e.target&&<div style={{fontSize:11,color:NAV,fontWeight:600}}>{e.target}</div>}
                  {e.detail&&<div style={{fontSize:11,color:"#475569"}}>{e.detail}</div>}
                  <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{e.user} · {e.time}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
function ScanBar({scanInput,setScanInput,scanState,onCommit,onClear,scannedTrays,selCount}) {
  const {status,message}=scanState;
  const hasErr=status==="error",hasOk=status==="ok",hasWarn=status==="warn",loading=status==="loading";
  const border=hasErr?"#ef4444":hasWarn?"#f59e0b":hasOk?"#0d9488":"#93c5fd";
  return (
    <div style={{background:"#1e293b",borderBottom:"1px solid #334155",padding:"8px 20px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
      <span>📷</span>
      <span style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".06em",flexShrink:0}}>Scan</span>
      <div style={{position:"relative",flex:1,maxWidth:360}}>
        <input value={scanInput} onChange={e=>setScanInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")onCommit(scanInput);}}
          placeholder={`Sample ID or ${TRAY_PREFIX}XXXX…`}
          style={{width:"100%",boxSizing:"border-box",border:"2px solid "+border,borderRadius:8,padding:"6px 12px",fontSize:13,outline:"none",background:hasErr?"#fff5f5":hasOk?"#f0fdfa":"#fff",color:"#1e293b"}}/>
        {loading&&<div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",width:14,height:14,borderRadius:"50%",border:"2px solid #0d9488",borderTopColor:"transparent",animation:"spin 0.7s linear infinite"}}/>}
      </div>
      <div style={{flex:1,fontSize:12,color:"#475569"}}>
        {loading&&<span style={{color:"#5eead4"}}>🔍 Looking up tray…</span>}
        {hasErr&&<span style={{color:"#fca5a5",fontWeight:600}}>⚠ {message}</span>}
        {hasWarn&&<span style={{color:"#fde68a",fontWeight:600}}>⚠ {message}</span>}
        {hasOk&&<span style={{color:"#6ee7b7",fontWeight:600}}>✔ {message}</span>}
        {!loading&&!hasErr&&!hasOk&&!hasWarn&&(scannedTrays.length>0
          ?<span style={{color:"#5eead4",fontWeight:700}}>🗂 {scannedTrays.length} tray{scannedTrays.length!==1?"s":""} · <strong style={{color:"#fff"}}>{selCount}</strong> selected</span>
          :<span style={{opacity:.5}}>Scan a sample ID or tray barcode</span>)}
      </div>
      {scannedTrays.map(t=>(
        <div key={t.code} style={{display:"flex",alignItems:"center",gap:4,background:"#134e4a",border:"1px solid #0d9488",borderRadius:6,padding:"3px 8px"}}>
          <span style={{fontSize:10,fontWeight:700,color:"#5eead4"}}>🗂 {t.code}</span>
          <span style={{fontSize:9,color:"#99f6e4"}}>{t.matched}/{t.total}</span>
        </div>
      ))}
      <button onClick={onClear} style={{fontSize:11,color:"#94a3b8",background:"#ffffff10",border:"1px solid #ffffff20",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontWeight:600}}>✕ Clear</button>
    </div>
  );
}

function useScan(rawSamples,stepKey,pushAudit) {
  const [scanInput,setScanInput]=useState("");
  const [scanState,setScanState]=useState({status:"idle",message:""});
  const [scannedTrays,setScanned]=useState([]);
  const [selected,setSelected]=useState(new Set());
  const rawRef=useRef(rawSamples);
  useEffect(()=>{ rawRef.current=rawSamples; },[rawSamples]);

  function doScan(raw) {
    const v=raw.trim().toUpperCase(); if(!v) return;
    setScanInput("");
    if(isTrayCode(v)) {
      if(scannedTrays.find(t=>t.code===v)){ setScanState({status:"warn",message:`Tray ${v} already scanned.`}); setTimeout(()=>setScanState({status:"idle",message:""}),3000); return; }
      setScanState({status:"loading",message:""});
      mockTrayLookup(v).then(res=>{
        const stepIds=new Set(rawRef.current.filter(s=>!s.isQC).map(s=>s.id));
        const matched=res.samples.filter(sid=>stepIds.has(sid));
        setSelected(p=>{ const n=new Set(p); matched.forEach(sid=>n.add(sid)); return n; });
        setScanned(p=>p.concat([{code:v,matched:matched.length,total:res.totalInTray}]));
        setScanState({status:"ok",message:`Tray ${v}: ${matched.length} matched.`});
        if(pushAudit) pushAudit(stepKey,{type:"tray_scan",target:v,detail:`${matched.length}/${res.totalInTray} matched`});
        setTimeout(()=>setScanState({status:"idle",message:""}),3500);
      }).catch(err=>{ setScanState({status:"error",message:err.message}); setTimeout(()=>setScanState({status:"idle",message:""}),5000); });
    } else {
      const m=rawRef.current.find(s=>!s.isQC&&s.id.toUpperCase().includes(v));
      if(m){ setSelected(p=>{ const n=new Set(p); n.add(m.id); return n; }); setScanState({status:"ok",message:`Sample ${m.id} selected.`}); setTimeout(()=>setScanState({status:"idle",message:""}),2500); }
      else { setScanState({status:"error",message:`${v} not found.`}); setTimeout(()=>setScanState({status:"idle",message:""}),3000); }
    }
  }
  function clearScan(){ setScanInput(""); setSelected(new Set()); setScanned([]); setScanState({status:"idle",message:""}); }
  return {scanInput,setScanInput,scanState,scannedTrays,selected,setSelected,doScan,clearScan};
}

// ══════════════════════════════════════════════════════════════════════════════
// GROUPING MODAL
// ══════════════════════════════════════════════════════════════════════════════
function aqcIssuesForRuns(runs) {
  return runs.map(r=>{ const count=r.sampleIds.length; const required=count>0?Math.ceil(count/AQC_BATCH_SIZE):0; return {laneId:r.laneId,runId:r.runId,count,required,ok:count>0}; });
}

function GroupingModal({samples,aqcEnabled,onConfirm,onCancel}) {
  const realSamples=samples.filter(s=>!s.isQC);
  const [runs,setRuns]=useState(()=>{
    const map={},order=[];
    realSamples.forEach(s=>{ const key=s.runId||"__new__"; if(!map[key]){map[key]=[];order.push(key);} map[key].push(s.id); });
    if(!order.length) return [{runId:genRunId(),laneId:uid(),sampleIds:[]}];
    return order.map(key=>({runId:key==="__new__"?genRunId():key,laneId:uid(),sampleIds:map[key]}));
  });
  const [dragSample,setDragSample]=useState(null);
  const [dragOverLane,setDragOverLane]=useState(null);
  const [tab,setTab]=useState("assign");
  const [splitTarget,setSplitTarget]=useState(null);
  const [splitAt,setSplitAt]=useState(null);
  const [mergeTargets,setMergeTargets]=useState(new Set());

  const assignedIds=new Set(runs.flatMap(r=>r.sampleIds));
  const unassigned=realSamples.filter(s=>!assignedIds.has(s.id));
  const canConfirm=runs.every(r=>r.sampleIds.length>0)&&unassigned.length===0;

  function moveSample(sampleId,fromLaneId,toLaneId) {
    if(fromLaneId===toLaneId) return;
    setRuns(p=>p.map(r=>{ if(r.laneId===fromLaneId) return {...r,sampleIds:r.sampleIds.filter(id=>id!==sampleId)}; if(r.laneId===toLaneId) return {...r,sampleIds:[...r.sampleIds,sampleId]}; return r; }));
  }
  function addRun(){ setRuns(p=>[...p,{runId:genRunId(),laneId:uid(),sampleIds:[]}]); }
  function removeLane(laneId){
    setRuns(p=>{ const lane=p.find(r=>r.laneId===laneId); const rest=p.filter(r=>r.laneId!==laneId); if(!rest.length) return p; return rest.map((r,i)=>i===0?{...r,sampleIds:[...r.sampleIds,...(lane?lane.sampleIds:[])]}:r); });
  }
  function doSplit(){
    if(!splitTarget||!splitAt) return;
    setRuns(p=>{ const idx=p.findIndex(r=>r.laneId===splitTarget); if(idx<0) return p; const lane=p[idx]; const bi=lane.sampleIds.indexOf(splitAt); if(bi<=0) return p; const p1=lane.sampleIds.slice(0,bi),p2=lane.sampleIds.slice(bi); const newRuns=[...p]; newRuns.splice(idx,1,{...lane,sampleIds:p1},{runId:genRunId(),laneId:uid(),sampleIds:p2}); return newRuns; });
    setSplitTarget(null); setSplitAt(null); setTab("assign");
  }
  function doMerge(){
    if(mergeTargets.size<2) return;
    const ordered=runs.filter(r=>mergeTargets.has(r.laneId));
    const mergedIds=ordered.flatMap(r=>r.sampleIds);
    const keepLaneId=ordered[0].laneId;
    setRuns(p=>{ const filtered=p.filter(r=>!mergeTargets.has(r.laneId)||r.laneId===keepLaneId); return filtered.map(r=>r.laneId===keepLaneId?{...r,sampleIds:mergedIds}:r); });
    setMergeTargets(new Set()); setTab("assign");
  }
  function buildAssignments(){
    const map={};
    runs.forEach(run=>run.sampleIds.forEach(sid=>{ const s=realSamples.find(r=>r.id===sid); if(s) map[s._id]=run.runId; }));
    return map;
  }

  function AqcRunBadge({count}){
    if(!aqcEnabled||count===0) return null;
    const sets=Math.ceil(count/AQC_BATCH_SIZE);
    return <span style={{fontSize:9,background:"#ede9fe",color:"#7c3aed",border:"1px solid #c4b5fd",borderRadius:4,padding:"1px 6px",fontWeight:800,whiteSpace:"nowrap"}}>🧪 {sets} set{sets!==1?"s":""}</span>;
  }

  const tabBtn=(id,label,desc)=>(
    <button key={id} onClick={()=>setTab(id)} style={{padding:"10px 20px",border:"none",borderBottom:tab===id?"3px solid "+NAV:"3px solid transparent",background:"transparent",cursor:"pointer",fontWeight:tab===id?800:500,fontSize:12,color:tab===id?NAV:"#64748b",display:"flex",flexDirection:"column",alignItems:"flex-start",gap:1}}>
      {label}<span style={{fontSize:10,color:"#94a3b8",fontWeight:400}}>{desc}</span>
    </button>
  );
  const splitLane=splitTarget?runs.find(r=>r.laneId===splitTarget):null;
  const splitColor=splitLane?RUN_COLORS[runs.indexOf(splitLane)%RUN_COLORS.length]:"#3b82f6";
  const mergedPreviewIds=runs.filter(r=>mergeTargets.has(r.laneId)).flatMap(r=>r.sampleIds);

  return (
    <div style={{position:"fixed",inset:0,background:"#00000077",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onCancel}>
      <div style={{background:"#fff",borderRadius:14,maxWidth:780,width:"100%",maxHeight:"94vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px #0006",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        <div style={{background:`linear-gradient(90deg,${NAV},#1e5fa0)`,padding:"14px 22px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <span style={{fontSize:22}}>🗂</span>
          <div>
            <div style={{fontWeight:800,fontSize:15,color:"#fff"}}>Run Grouping</div>
            <div style={{fontSize:12,color:"#93c5fd"}}>{realSamples.length} samples · {runs.length} run{runs.length!==1?"s":""}{aqcEnabled?` · AQC ON (1 set per ${AQC_BATCH_SIZE})`:""}</div>
          </div>
          <button onClick={onCancel} style={{marginLeft:"auto",background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer",opacity:.7}}>✕</button>
        </div>
        <div style={{display:"flex",background:"#f8fafc",borderBottom:"2px solid #e2e8f0",flexShrink:0}}>
          {tabBtn("assign","🗂 Assign","Drag samples between runs")}
          {tabBtn("split","✂ Split Run","Divide a run into two")}
          {tabBtn("merge","⊕ Merge Runs","Combine multiple runs")}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"16px 22px",display:"flex",flexDirection:"column",gap:12}}>
          {unassigned.length>0&&<div style={{background:"#fef3c7",border:"1.5px solid #fde68a",borderRadius:9,padding:"8px 14px",fontSize:12,color:"#92400e",fontWeight:600}}>⚠ {unassigned.length} unassigned: {unassigned.map(s=>s.id).join(", ")}</div>}
          {aqcEnabled&&(
            <div style={{background:"#ede9fe",border:"1px solid #c4b5fd",borderRadius:9,padding:"10px 14px",fontSize:12,color:"#4c1d95"}}>
              <div style={{fontWeight:800,marginBottom:4,color:"#7c3aed"}}>🧪 AQC Impact Preview</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {runs.map((r,ri)=>{ const sets=r.sampleIds.length>0?Math.ceil(r.sampleIds.length/AQC_BATCH_SIZE):0; const color=RUN_COLORS[ri%RUN_COLORS.length]; return (
                  <div key={r.laneId} style={{background:"#fff",border:"1.5px solid "+color+"55",borderRadius:7,padding:"4px 10px",fontSize:11,display:"flex",alignItems:"center",gap:6}}>
                    <span style={{width:7,height:7,borderRadius:"50%",background:color,flexShrink:0,display:"inline-block"}}/>
                    <span style={{fontFamily:"monospace",fontWeight:800,color:NAV}}>{r.runId}</span>
                    <span style={{color:"#64748b"}}>{r.sampleIds.length} samples</span>
                    <span style={{background:"#ede9fe",color:"#7c3aed",borderRadius:4,padding:"1px 6px",fontWeight:700}}>→ {sets} AQC set{sets!==1?"s":""}</span>
                  </div>
                ); })}
              </div>
            </div>
          )}

          {tab==="assign"&&(<>
            {runs.map((run,ri)=>{
              const color=RUN_COLORS[ri%RUN_COLORS.length]; const isOver=dragOverLane===run.laneId;
              return (
                <div key={run.laneId} onDragOver={e=>{e.preventDefault();setDragOverLane(run.laneId);}} onDragLeave={()=>setDragOverLane(null)}
                  onDrop={e=>{e.preventDefault();if(dragSample)moveSample(dragSample.sampleId,dragSample.fromLaneId,run.laneId);setDragSample(null);setDragOverLane(null);}}
                  style={{border:"2px solid "+(isOver?color+"cc":"#e2e8f0"),borderRadius:10,overflow:"hidden",background:isOver?color+"08":"#fff"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:color+"14",borderBottom:"1px solid "+color+"33"}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0}}/>
                    <span style={{fontWeight:800,fontSize:13,color:NAV}}>Run {ri+1}</span>
                    <span style={{fontFamily:"monospace",fontSize:11,fontWeight:800,background:"#1e293b",color:"#e2e8f0",borderRadius:5,padding:"2px 8px"}}>{run.runId}</span>
                    <span style={{fontSize:11,background:color+"22",color,borderRadius:4,padding:"1px 7px",fontWeight:700,border:"1px solid "+color+"44"}}>{run.sampleIds.length}/{MAX_RUN_SIZE}</span>
                    <AqcRunBadge count={run.sampleIds.length}/>
                    {run.sampleIds.length===0&&runs.length>1&&<button onClick={()=>removeLane(run.laneId)} style={{marginLeft:"auto",background:"#fee2e2",color:"#991b1b",border:"none",borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700,cursor:"pointer"}}>Remove</button>}
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,padding:run.sampleIds.length>0?"10px 12px":"6px 12px",minHeight:44}}>
                    {run.sampleIds.length===0&&<span style={{fontSize:12,color:"#cbd5e1",fontStyle:"italic"}}>Drop samples here…</span>}
                    {run.sampleIds.map(sid=>{ const s=realSamples.find(r=>r.id===sid); if(!s) return null; return (
                      <div key={sid} draggable onDragStart={()=>setDragSample({sampleId:sid,fromLaneId:run.laneId})} onDragEnd={()=>{setDragSample(null);setDragOverLane(null);}}
                        style={{display:"flex",alignItems:"center",gap:5,background:"#f8fafc",border:"1.5px solid "+color+"55",borderRadius:7,padding:"4px 9px",cursor:"grab",userSelect:"none"}}>
                        <span style={{fontSize:10,color:"#cbd5e1"}}>⠿</span>
                        <span style={{fontWeight:700,fontSize:12,color:NAV}}>{sid}</span>
                        {s.trayCode&&<TrayBadge trayCode={s.trayCode}/>}
                        <span style={{fontSize:10,color:"#64748b"}}>{s.matrix}</span>
                      </div>
                    ); })}
                  </div>
                </div>
              );
            })}
            <button onClick={addRun} style={{alignSelf:"flex-start",display:"flex",alignItems:"center",gap:7,background:"#f0f9ff",color:"#0891b2",border:"1.5px dashed #7dd3fc",borderRadius:8,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add Run</button>
          </>)}

          {tab==="split"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:9,padding:"10px 14px",fontSize:12,color:"#0369a1"}}><strong>How to split:</strong> Select a run, then click the sample where the split should begin.</div>
              {runs.map((run,ri)=>{ const color=RUN_COLORS[ri%RUN_COLORS.length]; const sel=splitTarget===run.laneId; return (
                <div key={run.laneId} onClick={()=>{setSplitTarget(sel?null:run.laneId);setSplitAt(null);}}
                  style={{border:"2px solid "+(sel?color:"#e2e8f0"),borderRadius:10,overflow:"hidden",cursor:"pointer",background:sel?color+"08":"#fff"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:sel?color+"18":color+"08"}}>
                    <input type="radio" readOnly checked={sel} style={{accentColor:color}}/>
                    <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0}}/>
                    <span style={{fontFamily:"monospace",fontSize:11,fontWeight:800,background:"#1e293b",color:"#e2e8f0",borderRadius:5,padding:"2px 8px"}}>{run.runId}</span>
                    <span style={{fontSize:11,color,fontWeight:700}}>{run.sampleIds.length} samples</span>
                    <AqcRunBadge count={run.sampleIds.length}/>
                    {run.sampleIds.length<2&&<span style={{fontSize:10,color:"#94a3b8",fontStyle:"italic",marginLeft:4}}>Need ≥2 samples to split</span>}
                  </div>
                  {sel&&run.sampleIds.length>=2&&(
                    <div style={{padding:"10px 12px"}}>
                      <div style={{fontSize:11,color:"#64748b",fontWeight:700,marginBottom:8}}>Click a sample to mark it as the start of the new run:</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                        {run.sampleIds.map((sid,si)=>{ const isBoundary=splitAt===sid; const isAfter=splitAt&&run.sampleIds.indexOf(splitAt)<=si; const s=realSamples.find(r=>r.id===sid); return (
                          <div key={sid} onClick={e=>{e.stopPropagation();if(si===0)return;setSplitAt(isBoundary?null:sid);}}
                            style={{display:"flex",alignItems:"center",gap:4,padding:"4px 9px",borderRadius:7,cursor:si===0?"not-allowed":"pointer",userSelect:"none",
                              background:isAfter?"#dbeafe":isBoundary?"#1e3a5f":"#f8fafc",
                              border:"1.5px solid "+(isAfter?color:isBoundary?NAV:"#e2e8f0"),
                              color:isAfter?NAV:isBoundary?"#fff":"#334155",opacity:si===0?.4:1,fontWeight:isBoundary?800:600,fontSize:12}}>
                            {si===0&&<span style={{fontSize:9,color:"#94a3b8"}}>start</span>}
                            {isBoundary&&<span style={{fontSize:10}}>✂</span>}
                            {sid}{s&&s.trayCode&&<TrayBadge trayCode={s.trayCode}/>}
                          </div>
                        ); })}
                      </div>
                      {splitAt&&(()=>{
                        const bi=run.sampleIds.indexOf(splitAt);
                        const p1=run.sampleIds.slice(0,bi),p2=run.sampleIds.slice(bi);
                        const s1=Math.ceil(p1.length/AQC_BATCH_SIZE),s2=Math.ceil(p2.length/AQC_BATCH_SIZE);
                        return (
                          <div style={{marginTop:10,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                            <div style={{flex:1,background:"#f8fafc",borderRadius:8,padding:"8px 12px",fontSize:11,color:"#475569",border:"1px solid #e2e8f0"}}>
                              <div style={{fontWeight:700,color:NAV,marginBottom:4}}>Split preview:</div>
                              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                                <span style={{background:color+"22",color,borderRadius:5,padding:"2px 8px",fontWeight:700}}>Run A: {p1.length} samples{aqcEnabled?` → ${s1} AQC set${s1!==1?"s":""}`:""}</span>
                                <span style={{background:"#dbeafe",color:"#1d4ed8",borderRadius:5,padding:"2px 8px",fontWeight:700}}>Run B (new): {p2.length} samples{aqcEnabled?` → ${s2} AQC set${s2!==1?"s":""}`:""}</span>
                              </div>
                            </div>
                            <button onClick={doSplit} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#3b82f6",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}>✂ Confirm Split</button>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ); })}
            </div>
          )}

          {tab==="merge"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{background:"#f0fdf4",border:"1px solid #86efac",borderRadius:9,padding:"10px 14px",fontSize:12,color:"#166534"}}><strong>How to merge:</strong> Select 2 or more runs to combine into the first selected run's ID.</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {runs.map((run,ri)=>{ const color=RUN_COLORS[ri%RUN_COLORS.length]; const sel=mergeTargets.has(run.laneId); return (
                  <div key={run.laneId} onClick={()=>setMergeTargets(p=>{const n=new Set(p);sel?n.delete(run.laneId):n.add(run.laneId);return n;})}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",border:"2px solid "+(sel?color:"#e2e8f0"),borderRadius:10,cursor:"pointer",background:sel?color+"08":"#fff"}}>
                    <input type="checkbox" readOnly checked={sel} style={{accentColor:color,cursor:"pointer"}}/>
                    <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0}}/>
                    <span style={{fontFamily:"monospace",fontSize:12,fontWeight:800,background:"#1e293b",color:"#e2e8f0",borderRadius:5,padding:"2px 8px"}}>{run.runId}</span>
                    <span style={{fontSize:12,color:"#64748b"}}>{run.sampleIds.length} samples</span>
                    <AqcRunBadge count={run.sampleIds.length}/>
                    {sel&&<span style={{marginLeft:"auto",fontSize:10,background:color,color:"#fff",borderRadius:4,padding:"1px 7px",fontWeight:700}}>Selected</span>}
                  </div>
                ); })}
              </div>
              {mergeTargets.size>=2&&(
                <div style={{background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:10,padding:"12px 16px"}}>
                  <div style={{fontWeight:700,fontSize:12,color:NAV,marginBottom:8}}>Merge preview — {mergedPreviewIds.length} samples into <span style={{fontFamily:"monospace"}}>{runs.find(r=>mergeTargets.has(r.laneId))?.runId}</span>:</div>
                  {aqcEnabled&&<div style={{fontSize:11,background:"#ede9fe",color:"#7c3aed",borderRadius:6,padding:"4px 10px",fontWeight:700,marginBottom:8,display:"inline-block"}}>🧪 Merged run → {Math.ceil(mergedPreviewIds.length/AQC_BATCH_SIZE)} AQC set{Math.ceil(mergedPreviewIds.length/AQC_BATCH_SIZE)!==1?"s":""}</div>}
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>
                    {mergedPreviewIds.map(sid=>{ const s=realSamples.find(r=>r.id===sid); return <span key={sid} style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:5,padding:"2px 8px",fontSize:11,color:NAV,fontWeight:600}}>{sid}{s?.matrix?` · ${s.matrix}`:""}</span>; })}
                  </div>
                  <button onClick={doMerge} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#10b981",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>⊕ Confirm Merge</button>
                </div>
              )}
              {mergeTargets.size===1&&<div style={{fontSize:12,color:"#94a3b8",fontStyle:"italic"}}>Select at least one more run to merge.</div>}
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center",padding:"12px 22px",borderTop:"1px solid #f1f5f9",background:"#fafafa",flexShrink:0}}>
          <div style={{fontSize:11,color:"#94a3b8"}}>
            {runs.length} run{runs.length!==1?"s":""} · {realSamples.length} samples
            {aqcEnabled&&<span style={{color:"#7c3aed",fontWeight:700,marginLeft:6}}>· {runs.reduce((acc,r)=>acc+Math.ceil(r.sampleIds.length/AQC_BATCH_SIZE),0)} total AQC sets required</span>}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onCancel} style={{padding:"9px 20px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
            <button onClick={()=>canConfirm&&onConfirm(buildAssignments())} disabled={!canConfirm}
              style={{padding:"9px 22px",borderRadius:8,border:"none",background:canConfirm?"#10b981":"#94a3b8",color:"#fff",fontSize:13,fontWeight:700,cursor:canConfirm?"pointer":"not-allowed"}}>✔ Save Grouping</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EQUIPMENT MODAL
// ══════════════════════════════════════════════════════════════════════════════
function EquipRow({label,icon,items,selectedId,onChange,idKey="id",nameKey="name",expiryKey="calExpiry"}) {
  return (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:6,textTransform:"uppercase",letterSpacing:".05em"}}>{icon} {label}</div>
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {items.map(item=>{ const status=equipCalStatus(item[expiryKey]); const expired=status==="expired",soon=status==="soon",sel=selectedId===item[idKey]; const dotCol=expired?"#ef4444":soon?"#f59e0b":"#10b981"; const exp=item[expiryKey]?new Date(item[expiryKey]).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):null; return (
          <label key={item[idKey]} onClick={e=>{if(expired)e.preventDefault();}}
            style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",border:"2px solid "+(sel?"#3b82f6":expired?"#fca5a5":"#e2e8f0"),borderRadius:8,cursor:expired?"not-allowed":"pointer",background:sel?"#eff6ff":expired?"#fff5f5":"#fff",opacity:expired?.65:1}}>
            <input type="radio" name={label} value={item[idKey]} checked={sel} disabled={expired} onChange={()=>onChange(item[idKey])} style={{accentColor:"#3b82f6",cursor:"pointer"}}/>
            <div style={{width:8,height:8,borderRadius:"50%",background:dotCol,flexShrink:0}}/>
            <div style={{flex:1}}><span style={{fontWeight:600,fontSize:12,color:NAV}}>{item[idKey]}</span><span style={{fontSize:12,color:"#64748b",marginLeft:8}}>{item[nameKey]}</span></div>
            {exp&&<span style={{fontSize:10,fontWeight:700,color:expired?"#ef4444":soon?"#f59e0b":"#94a3b8",whiteSpace:"nowrap"}}>{expired?"⚠ EXPIRED":soon?"⚠ Exp soon":""} {exp}</span>}
            {sel&&<span style={{fontSize:10,background:"#3b82f6",color:"#fff",borderRadius:4,padding:"1px 7px",fontWeight:700,whiteSpace:"nowrap"}}>In use</span>}
          </label>
        ); })}
      </div>
    </div>
  );
}
function EquipmentModal({initial,onSave,onCancel}) {
  const [eq,setEq]=useState({...EMPTY_SESSION_EQ,...initial});
  const set=key=>val=>setEq(p=>({...p,[key]:val}));
  const statuses=[eq.balanceId?equipCalStatus(BALANCES.find(b=>b.id===eq.balanceId)?.calExpiry):null,eq.edpId?equipCalStatus(EDPS.find(e=>e.id===eq.edpId)?.calExpiry):null,eq.filterPaperId?equipCalStatus(FILTER_PAPERS.find(f=>f.id===eq.filterPaperId)?.expiry):null,eq.heatingBlockId?equipCalStatus(HEATING_BLOCKS.find(h=>h.id===eq.heatingBlockId)?.calExpiry):null];
  const hasExpired=statuses.includes("expired"),hasSoon=statuses.includes("soon");
  const hasAny=eq.balanceId||eq.edpId||eq.filterPaperId||eq.heatingBlockId;
  return (
    <div style={{position:"fixed",inset:0,background:"#00000077",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onCancel}>
      <div style={{background:"#fff",borderRadius:14,maxWidth:580,width:"100%",maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px #0006",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        <div style={{background:`linear-gradient(90deg,${NAV},#1e5fa0)`,padding:"16px 22px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <span style={{fontSize:22}}>🔧</span>
          <div><div style={{fontWeight:800,fontSize:15,color:"#fff"}}>Session Equipment</div><div style={{fontSize:12,color:"#93c5fd"}}>Equipment carries across all steps</div></div>
          <button onClick={onCancel} style={{marginLeft:"auto",background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer",opacity:.7}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"18px 22px"}}>
          {hasExpired&&<div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:8,padding:"9px 14px",fontSize:12,color:"#991b1b",fontWeight:700,marginBottom:14}}>⛔ One or more items have expired calibration.</div>}
          {hasSoon&&!hasExpired&&<div style={{background:"#fef3c7",border:"1px solid #fde68a",borderRadius:8,padding:"9px 14px",fontSize:12,color:"#92400e",fontWeight:600,marginBottom:14}}>⚠ Some items expire within 14 days.</div>}
          <EquipRow label="Balance" icon="⚖️" items={BALANCES} selectedId={eq.balanceId} onChange={set("balanceId")}/>
          <EquipRow label="Electronic Dispenser (EDP)" icon="💧" items={EDPS} selectedId={eq.edpId} onChange={set("edpId")}/>
          <EquipRow label="Filter Paper Lot" icon="🗂" items={FILTER_PAPERS} selectedId={eq.filterPaperId} onChange={set("filterPaperId")} expiryKey="expiry"/>
          <EquipRow label="Heating Block" icon="🔥" items={HEATING_BLOCKS} selectedId={eq.heatingBlockId} onChange={set("heatingBlockId")}/>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",padding:"14px 22px",borderTop:"1px solid #f1f5f9",background:"#fafafa",flexShrink:0,alignItems:"center"}}>
          {!hasAny&&<span style={{fontSize:11,color:"#94a3b8",marginRight:"auto"}}>No equipment selected yet.</span>}
          <button onClick={onCancel} style={{padding:"9px 20px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>!hasExpired&&onSave(eq)} disabled={hasExpired} style={{padding:"9px 22px",borderRadius:8,border:"none",background:hasExpired?"#94a3b8":"#3b82f6",color:"#fff",fontSize:13,fontWeight:700,cursor:hasExpired?"not-allowed":"pointer"}}>💾 Save Equipment</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// WEIGHING MODAL
// ══════════════════════════════════════════════════════════════════════════════
function WeighingModal({samples,sessionEq,onConfirm,onCancel}) {
  const realSamples=samples.filter(s=>!s.isQC);
  const [balanceId,setBalanceId]=useState(sessionEq?.balanceId||"");
  const [weights,setWeights]=useState(()=>Object.fromEntries(realSamples.map(s=>[s.id,""])));
  const [reasons,setReasons]=useState({});
  const [activeRow,setActiveRow]=useState(null);
  const [submitted,setSubmitted]=useState(false);
  const balance=BALANCES.find(b=>b.id===balanceId)||null;
  const calExpired=balance?new Date(balance.calExpiry)<SIM_TODAY:false;
  const calSoon=balance&&!calExpired?Math.ceil((new Date(balance.calExpiry)-SIM_TODAY)/86400000)<=14:false;
  const outOfRange=realSamples.filter(s=>weightStatus(weights[s.id])==="out");
  const needsReason=outOfRange.filter(s=>!(reasons[s.id]||"").trim());
  const allWeighed=realSamples.every(s=>{ const ws=weightStatus(weights[s.id]); return ws==="ok"||ws==="out"; });
  const canConfirm=balanceId&&!calExpired&&allWeighed&&needsReason.length===0;
  function handleConfirm(){ if(!canConfirm){setSubmitted(true);return;} const result=realSamples.map(s=>({_id:s._id,id:s.id,weight:parseFloat(weights[s.id]),weightOk:weightStatus(weights[s.id])==="ok",weightReason:reasons[s.id]||null,balanceId,balanceName:balance?balance.name:""})); onConfirm(result); }
  return (
    <div style={{position:"fixed",inset:0,background:"#00000077",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onCancel}>
      <div style={{background:"#fff",borderRadius:14,maxWidth:640,width:"100%",maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px #0006",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        <div style={{background:`linear-gradient(90deg,${NAV},#1e5fa0)`,padding:"16px 22px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <span style={{fontSize:22}}>⚖️</span>
          <div><div style={{fontWeight:800,fontSize:15,color:"#fff"}}>Weighing — Complete Step</div><div style={{fontSize:12,color:"#93c5fd"}}>{realSamples.length} sample{realSamples.length!==1?"s":""} · Target {TARGET_WEIGHT}g ±{TOLERANCE_PCT}%</div></div>
          <button onClick={onCancel} style={{marginLeft:"auto",background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer",opacity:.7}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"18px 22px",display:"flex",flexDirection:"column",gap:16}}>
          <div style={{background:"#f8fafc",borderRadius:10,border:"1.5px solid #e2e8f0",padding:"14px 16px"}}>
            <div style={{fontWeight:800,fontSize:13,color:NAV,marginBottom:10}}>⚖️ Balance Selection <span style={{color:"#ef4444"}}>*</span></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {BALANCES.map(b=>{ const exp=new Date(b.calExpiry)<SIM_TODAY; const soon=!exp&&Math.ceil((new Date(b.calExpiry)-SIM_TODAY)/86400000)<=14; const sel=balanceId===b.id; return (
                <div key={b.id} onClick={()=>!exp&&setBalanceId(b.id)} style={{border:"2px solid "+(sel?"#3b82f6":exp?"#fca5a5":"#e2e8f0"),borderRadius:9,padding:"10px 14px",cursor:exp?"not-allowed":"pointer",background:sel?"#eff6ff":exp?"#fff5f5":"#fff",opacity:exp?0.7:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><div style={{width:10,height:10,borderRadius:"50%",background:exp?"#ef4444":soon?"#f59e0b":"#10b981",flexShrink:0}}/><span style={{fontWeight:700,fontSize:12,color:NAV}}>{b.id}</span>{sel&&<span style={{marginLeft:"auto",fontSize:10,background:"#3b82f6",color:"#fff",borderRadius:4,padding:"1px 6px",fontWeight:700}}>Selected</span>}</div>
                  <div style={{fontSize:12,color:"#475569",marginBottom:4}}>{b.name}</div>
                  <div style={{fontSize:10,fontWeight:700,color:exp?"#ef4444":soon?"#f59e0b":"#64748b"}}>{exp?"⚠ EXPIRED":soon?"⚠ Exp soon":"✔ Valid"}</div>
                </div>
              ); })}
            </div>
            {calExpired&&<div style={{marginTop:8,background:"#fee2e2",borderRadius:7,padding:"8px 12px",fontSize:12,color:"#991b1b",fontWeight:700}}>⛔ Selected balance calibration has expired.</div>}
          </div>
          <div style={{background:"#f8fafc",borderRadius:10,border:"1.5px solid #e2e8f0",overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"1.2fr 0.8fr 1fr 0.5fr",background:"#f1f5f9",borderBottom:"2px solid #e2e8f0"}}>
              {["Sample ID","Matrix","Weight (g)","Status"].map(h=><div key={h} style={{padding:"9px 12px",fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:".05em"}}>{h}</div>)}
            </div>
            {realSamples.map(s=>{ const ws=weightStatus(weights[s.id]); const isOut=ws==="out",isOk=ws==="ok"; const expanded=activeRow===s.id&&isOut; const reasonMissing=submitted&&isOut&&!(reasons[s.id]||"").trim(); return (
              <div key={s.id} style={{borderTop:"1px solid #f1f5f9",background:isOut?"#fff9f9":isOk?"#f0fdf4":"#fff"}}>
                <div style={{display:"grid",gridTemplateColumns:"1.2fr 0.8fr 1fr 0.5fr",alignItems:"center"}}>
                  <div style={{padding:"10px 12px",fontWeight:600,fontSize:13,color:NAV}}>{s.id}</div>
                  <div style={{padding:"10px 12px",fontSize:12,color:"#64748b"}}>{s.matrix}</div>
                  <div style={{padding:"6px 12px"}}>
                    <input type="number" step="0.001" placeholder="0.000" value={weights[s.id]} onChange={e=>{const v=e.target.value;setWeights(p=>({...p,[s.id]:v}));if(weightStatus(v)==="out")setActiveRow(s.id);else if(activeRow===s.id)setActiveRow(null);}}
                      style={{border:"2px solid "+(isOut?"#ef4444":isOk?"#10b981":"#e2e8f0"),borderRadius:7,padding:"7px 10px",width:110,textAlign:"right",fontFamily:"monospace",fontWeight:700,fontSize:13,background:isOut?"#fff5f5":isOk?"#f0fdf4":"#fff",outline:"none"}}/>
                  </div>
                  <div style={{padding:"6px 12px",display:"flex",alignItems:"center"}}>
                    {ws===null&&<span style={{fontSize:12,color:"#cbd5e1"}}>—</span>}
                    {isOk&&<span style={{fontSize:13,color:"#10b981",fontWeight:800}}>✔</span>}
                    {isOut&&<button onClick={()=>setActiveRow(p=>p===s.id?null:s.id)} style={{background:"#fee2e2",color:"#991b1b",border:"none",borderRadius:5,padding:"3px 8px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⚠ {expanded?"▴":"▾"}</button>}
                  </div>
                </div>
                {isOut&&expanded&&(
                  <div style={{padding:"0 12px 12px",borderTop:"1px dashed #fca5a5",background:"#fff5f5"}}>
                    <div style={{fontSize:11,color:"#7f1d1d",fontWeight:700,marginBottom:4,marginTop:8}}>Out of range — reason required <span style={{color:"#ef4444"}}>*</span></div>
                    <textarea value={reasons[s.id]||""} onChange={e=>setReasons(p=>({...p,[s.id]:e.target.value}))} placeholder="e.g. Sample partially dried…" rows={2}
                      style={{width:"100%",boxSizing:"border-box",border:"1.5px solid "+(reasonMissing?"#ef4444":"#fca5a5"),borderRadius:7,padding:"7px 10px",fontSize:12,resize:"vertical",outline:"none",fontFamily:"inherit",color:"#334155",background:"#fff"}}/>
                    {reasonMissing&&<div style={{fontSize:11,color:"#ef4444",marginTop:3,fontWeight:700}}>⚠ Required before confirming.</div>}
                  </div>
                )}
              </div>
            ); })}
          </div>
          {submitted&&!canConfirm&&<div style={{background:"#fee2e2",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#991b1b",fontWeight:600,border:"1px solid #fca5a5"}}>⚠ Please resolve all issues above.</div>}
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",padding:"14px 22px",borderTop:"1px solid #f1f5f9",background:"#fafafa",flexShrink:0}}>
          <button onClick={onCancel} style={{padding:"9px 20px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
          <button onClick={handleConfirm} style={{padding:"9px 22px",borderRadius:8,border:"none",background:canConfirm?"#10b981":"#94a3b8",color:"#fff",fontSize:13,fontWeight:700,cursor:canConfirm?"pointer":"not-allowed"}}>✔ Confirm Weighing</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AQC LOT INPUT
// ══════════════════════════════════════════════════════════════════════════════
function AqcLotInput({value,onChange,onLookup,lotInfo,submitted}) {
  const aqcExpired=lotInfo&&lotInfo!=="checking"&&lotInfo!=="not_found"&&equipCalStatus(lotInfo.expiry)==="expired";
  const aqcValid=lotInfo&&lotInfo!=="checking"&&lotInfo!=="not_found"&&!aqcExpired;
  return (
    <div style={{background:"#f8fafc",borderRadius:10,border:"1.5px solid #e2e8f0",padding:"14px 16px"}}>
      <div style={{fontWeight:800,fontSize:13,color:NAV,marginBottom:6}}>📊 AQC Lot Number <span style={{color:"#ef4444"}}>*</span></div>
      <div style={{fontSize:11,color:"#64748b",marginBottom:8}}>Try: <span style={{fontFamily:"monospace",fontWeight:700,color:NAV}}>AQC-2025-001</span>, <span style={{fontFamily:"monospace",fontWeight:700,color:NAV}}>AQC-2026-001</span></div>
      <div style={{display:"flex",gap:8}}>
        <input value={value} onChange={e=>onChange(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")onLookup(value);}} placeholder="e.g. AQC-2025-001"
          style={{flex:1,border:"1.5px solid "+(aqcExpired?"#ef4444":aqcValid?"#10b981":"#e2e8f0"),borderRadius:7,padding:"8px 12px",fontSize:13,outline:"none",fontFamily:"monospace",fontWeight:600,color:"#1e293b",background:aqcExpired?"#fff5f5":aqcValid?"#f0fdf4":"#fff"}}/>
        <button onClick={()=>onLookup(value)} style={{padding:"8px 16px",borderRadius:7,border:"none",background:NAV,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}>{lotInfo==="checking"?"…":"Check"}</button>
      </div>
      {lotInfo==="checking"&&<div style={{marginTop:8,fontSize:12,color:"#64748b",display:"flex",alignItems:"center",gap:6}}><div style={{width:12,height:12,borderRadius:"50%",border:"2px solid #0d9488",borderTopColor:"transparent",animation:"spin 0.7s linear infinite",flexShrink:0}}/>Checking…</div>}
      {lotInfo==="not_found"&&<div style={{marginTop:8,background:"#fee2e2",borderRadius:7,padding:"8px 12px",fontSize:12,color:"#991b1b",fontWeight:700}}>⚠ Lot not found in LIMS.</div>}
      {aqcValid&&<div style={{marginTop:8,background:"#f0fdf4",borderRadius:7,padding:"10px 14px",border:"1px solid #6ee7b7"}}><div style={{fontSize:12,fontWeight:800,color:"#065f46",marginBottom:2}}>✔ {lotInfo.lotId} — {lotInfo.name}</div><div style={{fontSize:11,color:"#64748b"}}>Expiry: {new Date(lotInfo.expiry).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</div></div>}
      {aqcExpired&&lotInfo&&lotInfo!=="checking"&&lotInfo!=="not_found"&&<div style={{marginTop:8,background:"#fee2e2",borderRadius:7,padding:"10px 14px",border:"1px solid #fca5a5",fontSize:12,color:"#991b1b",fontWeight:700}}>⛔ AQC lot EXPIRED — use a valid lot.</div>}
      {submitted&&!aqcValid&&<div style={{fontSize:11,color:"#ef4444",marginTop:6,fontWeight:700}}>⚠ A valid non-expired AQC lot is required.</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ACIDIFICATION MODAL
// ══════════════════════════════════════════════════════════════════════════════
function AcidificationModal({samples,sessionEq,onConfirm,onCancel}) {
  const realSamples=samples.filter(s=>!s.isQC);
  const sessionEdp=sessionEq?.edpId?EDPS.find(e=>e.id===sessionEq.edpId):null;
  const sessionEdpOk=sessionEdp&&equipCalStatus(sessionEdp.calExpiry)!=="expired";
  const [edpId,setEdpId]=useState(sessionEdpOk?sessionEq.edpId:"");
  const [aqcLot,setAqcLot]=useState("");
  const [aqcLotInfo,setAqcLotInfo]=useState(null);
  const [submitted,setSubmitted]=useState(false);
  const edp=EDPS.find(e=>e.id===edpId)||null;
  const edpExpired=edp?equipCalStatus(edp.calExpiry)==="expired":false;
  const aqcExpired=aqcLotInfo&&aqcLotInfo!=="checking"&&aqcLotInfo!=="not_found"&&equipCalStatus(aqcLotInfo.expiry)==="expired";
  const aqcValid=aqcLotInfo&&aqcLotInfo!=="checking"&&aqcLotInfo!=="not_found"&&!aqcExpired;
  const canConfirm=edpId&&!edpExpired&&aqcValid;
  function lookupAqc(val){ const t=val.trim().toUpperCase(); if(!t){setAqcLotInfo(null);return;} setAqcLotInfo("checking"); setTimeout(()=>{ const key=Object.keys(AQC_LOT_DB).find(k=>k===t); setAqcLotInfo(key?{...AQC_LOT_DB[key],lotId:key}:"not_found"); },400); }
  return (
    <div style={{position:"fixed",inset:0,background:"#00000077",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onCancel}>
      <div style={{background:"#fff",borderRadius:14,maxWidth:560,width:"100%",maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px #0006",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        <div style={{background:`linear-gradient(90deg,${NAV},#1e5fa0)`,padding:"16px 22px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <span style={{fontSize:22}}>🧪</span>
          <div><div style={{fontWeight:800,fontSize:15,color:"#fff"}}>Acidification — Complete Step</div><div style={{fontSize:12,color:"#93c5fd"}}>{realSamples.length} samples · AQC sets generated on confirm</div></div>
          <button onClick={onCancel} style={{marginLeft:"auto",background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer",opacity:.7}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"18px 22px",display:"flex",flexDirection:"column",gap:16}}>
          <div style={{background:"#ede9fe",border:"1.5px solid #c4b5fd",borderRadius:10,padding:"12px 16px"}}>
            <div style={{fontWeight:800,fontSize:12,color:"#7c3aed",marginBottom:6}}>🧪 AQC Coverage Preview</div>
            <div style={{fontSize:12,color:"#4c1d95"}}>{realSamples.length} samples → <strong>{Math.ceil(realSamples.length/AQC_BATCH_SIZE)}</strong> AQC set{Math.ceil(realSamples.length/AQC_BATCH_SIZE)!==1?"s":""} (1 LCS + 1 MB each). Sets will travel through all subsequent steps.</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:8}}>
              {Array.from({length:Math.ceil(realSamples.length/AQC_BATCH_SIZE)},(_,i)=>{ const start=i*AQC_BATCH_SIZE+1,end=Math.min((i+1)*AQC_BATCH_SIZE,realSamples.length); return <div key={i} style={{background:"#fff",border:"1px solid #c4b5fd",borderRadius:6,padding:"3px 8px",fontSize:11,color:"#7c3aed",fontWeight:600}}>Set {i+1}: samples {start}–{end} → LCS+MB</div>; })}
            </div>
          </div>
          {sessionEdpOk?(
            <div style={{display:"flex",alignItems:"center",gap:10,background:"#f0fdf4",border:"1px solid #6ee7b7",borderRadius:9,padding:"10px 14px"}}>
              <span>💧</span>
              <div style={{flex:1}}><div style={{fontSize:11,fontWeight:700,color:"#065f46",textTransform:"uppercase",marginBottom:1}}>EDP — from session</div><div style={{fontSize:13,fontWeight:700,color:NAV}}>{sessionEdp.id} <span style={{fontWeight:400,color:"#475569"}}>— {sessionEdp.name}</span></div></div>
              <span style={{fontSize:10,background:"#d1fae5",color:"#065f46",borderRadius:4,padding:"2px 7px",fontWeight:700}}>✔ In use</span>
            </div>
          ):(
            <div style={{background:"#f8fafc",borderRadius:10,border:"1.5px solid #e2e8f0",padding:"14px 16px"}}>
              <div style={{fontWeight:800,fontSize:13,color:NAV,marginBottom:10}}>💧 EDP <span style={{color:"#ef4444"}}>*</span></div>
              {EDPS.map(e=>{ const st=equipCalStatus(e.calExpiry),exp=st==="expired",sel=edpId===e.id; return (
                <label key={e.id} onClick={ev=>{if(exp)ev.preventDefault();}}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",border:"2px solid "+(sel?"#3b82f6":exp?"#fca5a5":"#e2e8f0"),borderRadius:8,cursor:exp?"not-allowed":"pointer",background:sel?"#eff6ff":exp?"#fff5f5":"#fff",opacity:exp?.65:1,marginBottom:4}}>
                  <input type="radio" name="edp" checked={sel} disabled={exp} onChange={()=>setEdpId(e.id)} style={{accentColor:"#3b82f6"}}/>
                  <div style={{flex:1}}><span style={{fontWeight:600,fontSize:12,color:NAV}}>{e.id}</span><span style={{fontSize:12,color:"#64748b",marginLeft:8}}>{e.name}</span></div>
                  {sel&&<span style={{fontSize:10,background:"#3b82f6",color:"#fff",borderRadius:4,padding:"1px 7px",fontWeight:700}}>In use</span>}
                </label>
              ); })}
              {edpExpired&&<div style={{marginTop:4,background:"#fee2e2",borderRadius:7,padding:"8px 12px",fontSize:12,color:"#991b1b",fontWeight:700}}>⛔ EDP calibration expired.</div>}
            </div>
          )}
          <AqcLotInput value={aqcLot} onChange={v=>{setAqcLot(v);setAqcLotInfo(null);}} onLookup={lookupAqc} lotInfo={aqcLotInfo} submitted={submitted}/>
          {submitted&&!canConfirm&&<div style={{background:"#fee2e2",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#991b1b",fontWeight:600,border:"1px solid #fca5a5"}}>⚠ Please resolve all issues above.</div>}
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",padding:"14px 22px",borderTop:"1px solid #f1f5f9",background:"#fafafa",flexShrink:0}}>
          <button onClick={onCancel} style={{padding:"9px 20px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>{setSubmitted(true);if(canConfirm)onConfirm({edpId,edpName:edp?.name||sessionEdp?.name,aqcLotId:aqcLotInfo.lotId,aqcLotName:aqcLotInfo.name});}}
            style={{padding:"9px 22px",borderRadius:8,border:"none",background:canConfirm?"#10b981":"#94a3b8",color:"#fff",fontSize:13,fontWeight:700,cursor:canConfirm?"pointer":"not-allowed"}}>✔ Confirm Acidification</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FILTRATION MODAL
// ══════════════════════════════════════════════════════════════════════════════
function FiltrationModal({samples,sessionEq,onConfirm,onCancel}) {
  const realSamples=samples.filter(s=>!s.isQC);
  const sessionFp=sessionEq?.filterPaperId?FILTER_PAPERS.find(f=>f.id===sessionEq.filterPaperId):null;
  const sessionFpOk=sessionFp&&equipCalStatus(sessionFp.expiry)!=="expired";
  const [lotInput,setLotInput]=useState("");
  const [lotInfo,setLotInfo]=useState(sessionFpOk?{...sessionFp,lotId:sessionFp.id}:null);
  const [checking,setChecking]=useState(false);
  const [notFound,setNotFound]=useState(false);
  const [submitted,setSubmitted]=useState(false);
  const fpExpired=lotInfo&&!checking&&!notFound?equipCalStatus(lotInfo.expiry)==="expired":false;
  const fpValid=lotInfo&&!checking&&!notFound&&!fpExpired;
  function lookup(val){ const t=val.trim().toUpperCase(); if(!t){setLotInfo(null);setNotFound(false);return;} setChecking(true);setNotFound(false);setLotInfo(null); setTimeout(()=>{ const fp=FILTER_PAPERS.find(f=>f.id===t); setChecking(false); if(fp)setLotInfo({...fp,lotId:fp.id}); else setNotFound(true); },400); }
  return (
    <div style={{position:"fixed",inset:0,background:"#00000077",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onCancel}>
      <div style={{background:"#fff",borderRadius:14,maxWidth:520,width:"100%",maxHeight:"88vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px #0006",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        <div style={{background:`linear-gradient(90deg,${NAV},#1e5fa0)`,padding:"16px 22px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <span style={{fontSize:22}}>🗂</span>
          <div><div style={{fontWeight:800,fontSize:15,color:"#fff"}}>Filtration — Complete Step</div><div style={{fontSize:12,color:"#93c5fd"}}>{realSamples.length} sample{realSamples.length!==1?"s":""}</div></div>
          <button onClick={onCancel} style={{marginLeft:"auto",background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer",opacity:.7}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"18px 22px",display:"flex",flexDirection:"column",gap:16}}>
          {sessionFpOk?(
            <div style={{display:"flex",alignItems:"center",gap:10,background:"#f0fdf4",border:"1px solid #6ee7b7",borderRadius:9,padding:"10px 14px"}}>
              <span>🗂</span>
              <div style={{flex:1}}><div style={{fontSize:11,fontWeight:700,color:"#065f46",textTransform:"uppercase",marginBottom:1}}>Filter Paper — from session</div><div style={{fontSize:13,fontWeight:700,color:NAV}}>{sessionFp.id} — {sessionFp.name}</div></div>
              <span style={{fontSize:10,background:"#d1fae5",color:"#065f46",borderRadius:4,padding:"2px 7px",fontWeight:700}}>✔ In use</span>
            </div>
          ):(
            <div style={{background:"#f8fafc",borderRadius:10,border:"1.5px solid #e2e8f0",padding:"14px 16px"}}>
              <div style={{fontWeight:800,fontSize:13,color:NAV,marginBottom:4}}>🗂 Filter Paper Lot <span style={{color:"#ef4444"}}>*</span></div>
              <div style={{fontSize:11,color:"#64748b",marginBottom:8}}>Try: {FILTER_PAPERS.map((fp,i)=><span key={fp.id}>{i>0&&", "}<span style={{fontFamily:"monospace",fontWeight:700,color:NAV}}>{fp.id}</span></span>)}</div>
              <div style={{display:"flex",gap:8}}>
                <input value={lotInput} onChange={e=>{setLotInput(e.target.value);setLotInfo(null);setNotFound(false);}} onKeyDown={e=>{if(e.key==="Enter")lookup(lotInput);}} placeholder="e.g. FP-LOT-2025B"
                  style={{flex:1,border:"1.5px solid "+(fpExpired?"#ef4444":fpValid?"#10b981":"#e2e8f0"),borderRadius:7,padding:"8px 12px",fontSize:13,outline:"none",fontFamily:"monospace",fontWeight:600,color:"#1e293b"}}/>
                <button onClick={()=>lookup(lotInput)} style={{padding:"8px 16px",borderRadius:7,border:"none",background:NAV,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}>{checking?"…":"Check"}</button>
              </div>
              {notFound&&<div style={{marginTop:8,background:"#fee2e2",borderRadius:7,padding:"8px 12px",fontSize:12,color:"#991b1b",fontWeight:700}}>⚠ Lot not found.</div>}
              {fpValid&&lotInfo&&<div style={{marginTop:8,background:"#f0fdf4",borderRadius:7,padding:"10px 14px",border:"1px solid #6ee7b7",fontSize:12,color:"#065f46",fontWeight:700}}>✔ {lotInfo.lotId} — {lotInfo.name}</div>}
              {submitted&&!fpValid&&<div style={{fontSize:11,color:"#ef4444",marginTop:6,fontWeight:700}}>⚠ Valid lot required.</div>}
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",padding:"14px 22px",borderTop:"1px solid #f1f5f9",background:"#fafafa",flexShrink:0}}>
          <button onClick={onCancel} style={{padding:"9px 20px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>{setSubmitted(true);if(fpValid)onConfirm({filterPaperLotId:lotInfo.lotId,filterPaperName:lotInfo.name});}}
            style={{padding:"9px 22px",borderRadius:8,border:"none",background:fpValid?"#10b981":"#94a3b8",color:"#fff",fontSize:13,fontWeight:700,cursor:fpValid?"pointer":"not-allowed"}}>✔ Confirm Filtration</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// REOPEN MODAL
// ══════════════════════════════════════════════════════════════════════════════
function ChemReopenModal({rows,prevSteps,onConfirm,onCancel}) {
  const realRows=rows.filter(r=>!r.qcType);
  const [targetIdx,setTargetIdx]=useState(prevSteps.length>0?prevSteps.length-1:0);
  const [reason,setReason]=useState("");
  const canConfirm=reason.trim().length>0&&targetIdx>=0&&prevSteps.length>0;
  return (
    <div style={{position:"fixed",inset:0,background:"#00000066",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onCancel}>
      <div style={{background:"#fff",borderRadius:14,maxWidth:460,width:"100%",maxHeight:"88vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px #0005",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"18px 22px 14px",borderBottom:"1px solid #f1f5f9",flexShrink:0}}>
          <div style={{width:40,height:40,borderRadius:"50%",background:"#fee2e2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>↺</div>
          <div><div style={{fontWeight:800,fontSize:15,color:NAV}}>Reopen — Send Back</div><div style={{fontSize:12,color:"#94a3b8"}}>{realRows.length} sample{realRows.length!==1?"s":""}</div></div>
          <button onClick={onCancel} style={{marginLeft:"auto",background:"none",border:"none",fontSize:18,color:"#94a3b8",cursor:"pointer"}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"16px 22px",display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{realRows.map(r=><span key={r.sampleId} style={{background:"#fee2e2",color:"#991b1b",borderRadius:6,padding:"3px 9px",fontSize:12,fontWeight:700}}>{r.sampleId}</span>)}</div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:8}}>Send back to step:</div>
            {prevSteps.length===0?<div style={{fontSize:12,color:"#94a3b8",fontStyle:"italic"}}>No previous steps.</div>:prevSteps.map((st,i)=>(
              <label key={st.id+i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",border:"1.5px solid "+(targetIdx===i?"#ef4444":"#e2e8f0"),borderRadius:8,cursor:"pointer",background:targetIdx===i?"#fff5f5":"#fff",marginBottom:6}}>
                <input type="radio" name="reopenStep" checked={targetIdx===i} onChange={()=>setTargetIdx(i)} style={{accentColor:"#ef4444"}}/>
                <div><div style={{fontSize:13,fontWeight:600,color:NAV}}>{st.name}</div></div>
              </label>
            ))}
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:6}}>Reason <span style={{color:"#ef4444"}}>*</span></div>
            <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. Instrument calibration failed…" rows={3}
              style={{width:"100%",boxSizing:"border-box",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"9px 11px",fontSize:13,resize:"vertical",outline:"none",fontFamily:"inherit",color:"#334155"}}/>
          </div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",padding:"14px 22px",borderTop:"1px solid #f1f5f9",background:"#fafafa",flexShrink:0}}>
          <button onClick={onCancel} style={{padding:"9px 20px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>canConfirm&&onConfirm(prevSteps[targetIdx].id,reason)} disabled={!canConfirm}
            style={{padding:"9px 22px",borderRadius:8,border:"none",background:canConfirm?"#ef4444":"#fca5a5",color:"#fff",fontSize:13,fontWeight:700,cursor:canConfirm?"pointer":"not-allowed"}}>↺ Send Back</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DILUTION & REPLICATION MODAL
// ══════════════════════════════════════════════════════════════════════════════
function DilutionReplicationModal({samples,onConfirm,onCancel}) {
  const [mode,setMode]=useState("dilution");
  const [dilMode,setDilMode]=useState("same");
  const [globalDil,setGlobalDil]=useState("");
  const [globalDilCustom,setGlobalDilCustom]=useState("");
  const [globalDilUseCustom,setGlobalDilUseCustom]=useState(false);
  const [indivDil,setIndivDil]=useState(()=>Object.fromEntries(samples.map(s=>[s.id,{preset:"",custom:"",useCustom:false}])));
  const [repMode,setRepMode]=useState("same");
  const [globalRep,setGlobalRep]=useState(1);
  const [indivRep,setIndivRep]=useState(()=>Object.fromEntries(samples.map(s=>[s.id,s.replications||1])));
  const [submitted,setSubmitted]=useState(false);

  function resolveDil(id){ if(dilMode==="same") return globalDilUseCustom?globalDilCustom.trim():globalDil; const d=indivDil[id]; return d?(d.useCustom?d.custom.trim():d.preset):""; }
  function resolveRep(id){ return repMode==="same"?globalRep:(indivRep[id]||1); }
  const canConfirm=mode==="dilution"?samples.every(s=>resolveDil(s.id)):samples.every(s=>resolveRep(s.id)>=1);

  function handleConfirm(){ setSubmitted(true); if(!canConfirm) return; const updates=samples.map(s=>({_id:s._id,id:s.id,dilution:mode==="dilution"?resolveDil(s.id):(s.dilution||null),replications:mode==="replication"?resolveRep(s.id):(s.replications||1)})); onConfirm(updates,mode); }

  const presetBtn=(val,current,onSet)=>(
    <button key={val} onClick={()=>onSet(val)} style={{padding:"4px 10px",borderRadius:6,border:"1.5px solid "+(current===val?"#3b82f6":"#e2e8f0"),background:current===val?"#eff6ff":"#f8fafc",color:current===val?"#1d4ed8":"#475569",fontSize:11,fontWeight:current===val?800:500,cursor:"pointer"}}>{val}</button>
  );

  return (
    <div style={{position:"fixed",inset:0,background:"#00000077",zIndex:1050,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onCancel}>
      <div style={{background:"#fff",borderRadius:14,maxWidth:600,width:"100%",maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px #0006",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        <div style={{background:`linear-gradient(90deg,${NAV},#1e5fa0)`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 22px 10px"}}>
            <span style={{fontSize:22}}>🧫</span>
            <div><div style={{fontWeight:800,fontSize:15,color:"#fff"}}>Dilution &amp; Replication</div><div style={{fontSize:12,color:"#93c5fd"}}>{samples.length} sample{samples.length!==1?"s":""} selected</div></div>
            <button onClick={onCancel} style={{marginLeft:"auto",background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer",opacity:.7}}>✕</button>
          </div>
          <div style={{display:"flex",borderTop:"1px solid #ffffff22",margin:"0 22px"}}>
            {["dilution","replication"].map(id=>(
              <button key={id} onClick={()=>{setMode(id);setSubmitted(false);}}
                style={{flex:1,padding:"10px 0",border:"none",borderBottom:mode===id?"3px solid #fff":"3px solid transparent",background:"transparent",color:mode===id?"#fff":"#93c5fd",fontWeight:mode===id?800:500,fontSize:13,cursor:"pointer"}}>
                {id==="dilution"?"💧 Dilution":"🔁 Replication"}
              </button>
            ))}
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"18px 22px",display:"flex",flexDirection:"column",gap:14}}>
          {mode==="dilution"&&(<>
            <div style={{display:"flex",gap:6,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:4}}>
              {[["same","Apply same to all"],["individual","Set individually"]].map(([v,l])=>(
                <button key={v} onClick={()=>setDilMode(v)} style={{flex:1,padding:"7px 10px",borderRadius:6,border:"none",background:dilMode===v?NAV:"transparent",color:dilMode===v?"#fff":"#64748b",fontSize:12,fontWeight:dilMode===v?700:400,cursor:"pointer"}}>{l}</button>
              ))}
            </div>
            {dilMode==="same"&&(
              <div style={{background:"#f8fafc",borderRadius:10,border:"1.5px solid #e2e8f0",padding:"14px 16px"}}>
                <div style={{fontSize:12,fontWeight:700,color:NAV,marginBottom:10}}>Dilution factor <span style={{color:"#ef4444"}}>*</span></div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                  {DILUTION_PRESETS.map(v=>presetBtn(v,!globalDilUseCustom?globalDil:"",val=>{setGlobalDil(val);setGlobalDilUseCustom(false);}))}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:11,color:"#64748b",flexShrink:0}}>Custom:</span>
                  <input value={globalDilCustom} onChange={e=>{setGlobalDilCustom(e.target.value);setGlobalDilUseCustom(true);setGlobalDil("");}} placeholder="e.g. 1:250"
                    style={{flex:1,border:"1.5px solid "+(globalDilUseCustom&&globalDilCustom?"#3b82f6":"#e2e8f0"),borderRadius:7,padding:"6px 10px",fontSize:12,outline:"none",fontFamily:"monospace",fontWeight:600}}/>
                </div>
                {resolveDil(samples[0]?.id)&&<div style={{marginTop:10,background:"#eff6ff",borderRadius:7,padding:"7px 12px",fontSize:12,color:"#1d4ed8",fontWeight:600}}>Will apply <strong>{resolveDil(samples[0]?.id)}</strong> to all {samples.length} samples</div>}
                {submitted&&!resolveDil(samples[0]?.id)&&<div style={{fontSize:11,color:"#ef4444",marginTop:6,fontWeight:700}}>⚠ Select or enter a dilution factor.</div>}
              </div>
            )}
            {dilMode==="individual"&&(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {samples.map(s=>{ const d=indivDil[s.id]; const val=resolveDil(s.id); const err=submitted&&!val; return (
                  <div key={s.id} style={{background:"#f8fafc",borderRadius:9,border:"1.5px solid "+(err?"#ef4444":val?"#3b82f6":"#e2e8f0"),padding:"10px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <span style={{fontWeight:700,fontSize:13,color:NAV,minWidth:100}}>{s.id}</span>
                      <span style={{fontSize:11,color:"#64748b"}}>{s.matrix}</span>
                      {val&&<span style={{marginLeft:"auto",fontSize:11,background:"#eff6ff",color:"#1d4ed8",borderRadius:4,padding:"1px 8px",fontWeight:700,fontFamily:"monospace"}}>{val}</span>}
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>
                      {DILUTION_PRESETS.map(v=>presetBtn(v,!d.useCustom?d.preset:"",val=>setIndivDil(p=>({...p,[s.id]:{...p[s.id],preset:val,useCustom:false}}))))}
                    </div>
                    <input value={d.custom} onChange={e=>setIndivDil(p=>({...p,[s.id]:{preset:"",custom:e.target.value,useCustom:true}}))} placeholder="Custom, e.g. 1:250"
                      style={{width:"100%",boxSizing:"border-box",border:"1.5px solid "+(d.useCustom&&d.custom?"#3b82f6":"#e2e8f0"),borderRadius:7,padding:"6px 10px",fontSize:12,outline:"none",fontFamily:"monospace"}}/>
                    {err&&<div style={{fontSize:11,color:"#ef4444",marginTop:4,fontWeight:700}}>⚠ Required</div>}
                  </div>
                ); })}
              </div>
            )}
          </>)}
          {mode==="replication"&&(<>
            <div style={{background:"#f0fdf4",border:"1px solid #86efac",borderRadius:9,padding:"10px 14px",fontSize:12,color:"#166534"}}>
              Number of replicate analyses per sample. <strong>1</strong> = none, <strong>2</strong> = duplicate, <strong>3</strong> = triplicate.
            </div>
            <div style={{display:"flex",gap:6,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:4}}>
              {[["same","Apply same to all"],["individual","Set individually"]].map(([v,l])=>(
                <button key={v} onClick={()=>setRepMode(v)} style={{flex:1,padding:"7px 10px",borderRadius:6,border:"none",background:repMode===v?NAV:"transparent",color:repMode===v?"#fff":"#64748b",fontSize:12,fontWeight:repMode===v?700:400,cursor:"pointer"}}>{l}</button>
              ))}
            </div>
            {repMode==="same"&&(
              <div style={{background:"#f8fafc",borderRadius:10,border:"1.5px solid #e2e8f0",padding:"14px 16px"}}>
                <div style={{fontSize:12,fontWeight:700,color:NAV,marginBottom:10}}>Replications for all samples</div>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <button onClick={()=>setGlobalRep(r=>Math.max(1,r-1))} style={{width:34,height:34,borderRadius:8,border:"1.5px solid #e2e8f0",background:"#fff",fontSize:18,fontWeight:700,cursor:"pointer",color:NAV}}>−</button>
                  <div style={{textAlign:"center",minWidth:60}}>
                    <div style={{fontSize:28,fontWeight:800,color:NAV,lineHeight:1}}>{globalRep}</div>
                    <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{globalRep===1?"none":globalRep===2?"duplicate":globalRep===3?"triplicate":`×${globalRep}`}</div>
                  </div>
                  <button onClick={()=>setGlobalRep(r=>Math.min(10,r+1))} style={{width:34,height:34,borderRadius:8,border:"1.5px solid #e2e8f0",background:"#fff",fontSize:18,fontWeight:700,cursor:"pointer",color:NAV}}>+</button>
                  <div style={{flex:1,display:"flex",gap:5,flexWrap:"wrap"}}>
                    {[1,2,3,4,5].map(n=><button key={n} onClick={()=>setGlobalRep(n)} style={{padding:"4px 12px",borderRadius:6,border:"1.5px solid "+(globalRep===n?"#10b981":"#e2e8f0"),background:globalRep===n?"#d1fae5":"#f8fafc",color:globalRep===n?"#065f46":"#475569",fontSize:12,fontWeight:globalRep===n?700:400,cursor:"pointer"}}>{n===1?"×1":n===2?"×2 dup":n===3?"×3 tri":`×${n}`}</button>)}
                  </div>
                </div>
              </div>
            )}
            {repMode==="individual"&&(
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {samples.map(s=>{ const rep=resolveRep(s.id); return (
                  <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,background:"#f8fafc",borderRadius:9,border:"1.5px solid #e2e8f0",padding:"9px 14px"}}>
                    <span style={{fontWeight:700,fontSize:13,color:NAV,minWidth:100}}>{s.id}</span>
                    <span style={{fontSize:11,color:"#64748b",flex:1}}>{s.matrix}</span>
                    <button onClick={()=>setIndivRep(p=>({...p,[s.id]:Math.max(1,(p[s.id]||1)-1)}))} style={{width:28,height:28,borderRadius:6,border:"1.5px solid #e2e8f0",background:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",color:NAV,flexShrink:0}}>−</button>
                    <div style={{textAlign:"center",minWidth:48,flexShrink:0}}><div style={{fontSize:18,fontWeight:800,color:NAV,lineHeight:1}}>{rep}</div><div style={{fontSize:9,color:"#94a3b8"}}>{rep===1?"none":rep===2?"dup":rep===3?"tri":`×${rep}`}</div></div>
                    <button onClick={()=>setIndivRep(p=>({...p,[s.id]:Math.min(10,(p[s.id]||1)+1)}))} style={{width:28,height:28,borderRadius:6,border:"1.5px solid #e2e8f0",background:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",color:NAV,flexShrink:0}}>+</button>
                    {rep>1&&<span style={{fontSize:11,background:"#d1fae5",color:"#065f46",borderRadius:4,padding:"1px 8px",fontWeight:700,flexShrink:0}}>×{rep}</span>}
                  </div>
                ); })}
              </div>
            )}
          </>)}
          {submitted&&!canConfirm&&<div style={{background:"#fee2e2",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#991b1b",fontWeight:600,border:"1px solid #fca5a5"}}>⚠ Please fill in all required fields.</div>}
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",padding:"14px 22px",borderTop:"1px solid #f1f5f9",background:"#fafafa",flexShrink:0}}>
          <button onClick={onCancel} style={{padding:"9px 20px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
          <button onClick={handleConfirm} style={{padding:"9px 22px",borderRadius:8,border:"none",background:canConfirm?"#10b981":"#94a3b8",color:"#fff",fontSize:13,fontWeight:700,cursor:canConfirm?"pointer":"not-allowed"}}>✔ Apply {mode==="dilution"?"Dilution":"Replication"}</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DUPLICATE MODAL
// ══════════════════════════════════════════════════════════════════════════════
function DuplicateModal({ samples, onConfirm, onCancel }) {
  const [step, setStep] = useState(1); // 1 = how many, 2 = dilution per copy
  const [count, setCount] = useState(1);
  const [dilMode, setDilMode] = useState("same");
  const [globalDil, setGlobalDil] = useState("");
  const [globalDilCustom, setGlobalDilCustom] = useState("");
  const [globalDilUseCustom, setGlobalDilUseCustom] = useState(false);
  const [indivDil, setIndivDil] = useState(
    () => Object.fromEntries(samples.map(s => [s.id, { preset:"", custom:"", useCustom:false }]))
  );
  const [submitted, setSubmitted] = useState(false);

  const totalNew = samples.length * count;

  function resolveDil(id) {
    if(dilMode === "same") return globalDilUseCustom ? globalDilCustom.trim() : globalDil;
    const d = indivDil[id]; return d ? (d.useCustom ? d.custom.trim() : d.preset) : "";
  }
  const dilOk = samples.every(s => resolveDil(s.id));

  function handleNext() {
    if(step === 1) { setStep(2); return; }
    setSubmitted(true);
    if(!dilOk) return;
    // Build duplicate entries
    const dupes = [];
    for(let c = 1; c <= count; c++) {
      samples.forEach(s => {
        const dil = resolveDil(s.id);
        dupes.push({ originalId: s.id, original_id: s._id, copyIndex: c, dilution: dil || null });
      });
    }
    onConfirm(dupes, count);
  }

  const presetBtn = (val, current, onSet) => (
    <button key={val} onClick={() => onSet(val)}
      style={{ padding:"4px 10px", borderRadius:6, border:"1.5px solid "+(current===val?"#3b82f6":"#e2e8f0"),
        background:current===val?"#eff6ff":"#f8fafc", color:current===val?"#1d4ed8":"#475569",
        fontSize:11, fontWeight:current===val?800:500, cursor:"pointer" }}>
      {val}
    </button>
  );

  return (
    <div style={{position:"fixed",inset:0,background:"#00000077",zIndex:1060,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onCancel}>
      <div style={{background:"#fff",borderRadius:14,maxWidth:560,width:"100%",maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px #0006",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{background:`linear-gradient(90deg,${NAV},#1e5fa0)`,padding:"14px 22px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <span style={{fontSize:22}}>🔁</span>
          <div>
            <div style={{fontWeight:800,fontSize:15,color:"#fff"}}>Duplicate Samples</div>
            <div style={{fontSize:12,color:"#93c5fd"}}>{samples.length} sample{samples.length!==1?"s":""} selected · Step {step} of 2</div>
          </div>
          <button onClick={onCancel} style={{marginLeft:"auto",background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer",opacity:.7}}>✕</button>
        </div>

        {/* Step indicator */}
        <div style={{display:"flex",background:"#f8fafc",borderBottom:"2px solid #e2e8f0",flexShrink:0}}>
          {[["1","How many copies?"],["2","Dilution for copies"]].map(([n,label]) => (
            <div key={n} style={{flex:1,padding:"10px 16px",display:"flex",alignItems:"center",gap:8,borderBottom:step===parseInt(n)?"3px solid "+NAV:"3px solid transparent",background:"transparent"}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:step>=parseInt(n)?NAV:"#e2e8f0",color:step>=parseInt(n)?"#fff":"#94a3b8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0}}>{n}</div>
              <span style={{fontSize:12,fontWeight:step===parseInt(n)?700:400,color:step===parseInt(n)?NAV:"#94a3b8"}}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"20px 22px",display:"flex",flexDirection:"column",gap:16}}>

          {/* ── STEP 1: count ── */}
          {step===1 && (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:9,padding:"10px 14px",fontSize:12,color:"#0369a1"}}>
                Each selected sample will have <strong>{count}</strong> extra cop{count===1?"y":"ies"} added, creating <strong>{totalNew}</strong> new row{totalNew!==1?"s":""} total.
              </div>
              <div style={{background:"#f8fafc",borderRadius:10,border:"1.5px solid #e2e8f0",padding:"20px"}}>
                <div style={{fontSize:13,fontWeight:700,color:NAV,marginBottom:16,textAlign:"center"}}>Number of duplicate copies per sample</div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16,marginBottom:16}}>
                  <button onClick={()=>setCount(c=>Math.max(1,c-1))}
                    style={{width:40,height:40,borderRadius:10,border:"1.5px solid #e2e8f0",background:"#fff",fontSize:22,fontWeight:700,cursor:"pointer",color:NAV}}>−</button>
                  <div style={{textAlign:"center",minWidth:80}}>
                    <div style={{fontSize:40,fontWeight:800,color:NAV,lineHeight:1}}>{count}</div>
                    <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>
                      {count===1?"duplicate":count===2?"triplicates":`×${count+1} total`}
                    </div>
                  </div>
                  <button onClick={()=>setCount(c=>Math.min(9,c+1))}
                    style={{width:40,height:40,borderRadius:10,border:"1.5px solid #e2e8f0",background:"#fff",fontSize:22,fontWeight:700,cursor:"pointer",color:NAV}}>+</button>
                </div>
                {/* Quick pick */}
                <div style={{display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap"}}>
                  {[[1,"DUP"],[2,"TRIP"],[3,"×4"],[4,"×5"]].map(([n,label])=>(
                    <button key={n} onClick={()=>setCount(n)}
                      style={{padding:"6px 14px",borderRadius:7,border:"1.5px solid "+(count===n?"#3b82f6":"#e2e8f0"),background:count===n?"#eff6ff":"#f8fafc",color:count===n?"#1d4ed8":"#475569",fontSize:12,fontWeight:count===n?800:500,cursor:"pointer"}}>
                      {n}× — {label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Preview */}
              <div style={{background:"#f8fafc",borderRadius:9,border:"1px solid #e2e8f0",padding:"10px 14px"}}>
                <div style={{fontSize:11,fontWeight:700,color:NAV,marginBottom:6}}>Preview — samples to be duplicated:</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {samples.map(s=>(
                    <span key={s.id} style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:5,padding:"2px 8px",fontSize:11,color:NAV,fontWeight:600}}>
                      {s.id} <span style={{color:"#94a3b8"}}>→ +{count} cop{count===1?"y":"ies"}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: dilution ── */}
          {step===2 && (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{background:"#fef3c7",border:"1px solid #fde68a",borderRadius:9,padding:"10px 14px",fontSize:12,color:"#92400e"}}>
                Set the dilution factor for the <strong>{count}</strong> cop{count===1?"y":"ies"} of each sample. Leave on "None" to inherit the original sample's dilution.
              </div>
              {/* same / individual */}
              <div style={{display:"flex",gap:6,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:4}}>
                {[["same","Apply same to all copies"],["individual","Set per original sample"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setDilMode(v)} style={{flex:1,padding:"7px 10px",borderRadius:6,border:"none",background:dilMode===v?NAV:"transparent",color:dilMode===v?"#fff":"#64748b",fontSize:12,fontWeight:dilMode===v?700:400,cursor:"pointer"}}>{l}</button>
                ))}
              </div>

              {dilMode==="same" && (
                <div style={{background:"#f8fafc",borderRadius:10,border:"1.5px solid #e2e8f0",padding:"14px 16px"}}>
                  <div style={{fontSize:12,fontWeight:700,color:NAV,marginBottom:10}}>Dilution factor for all copies <span style={{color:"#94a3b8",fontWeight:400}}>(optional)</span></div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                    {presetBtn("None", !globalDilUseCustom&&globalDil===""?"None":"", val=>{ setGlobalDil(""); setGlobalDilUseCustom(false); })}
                    {DILUTION_PRESETS.map(v=>presetBtn(v, !globalDilUseCustom?globalDil:"", val=>{ setGlobalDil(val); setGlobalDilUseCustom(false); }))}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11,color:"#64748b",flexShrink:0}}>Custom:</span>
                    <input value={globalDilCustom} onChange={e=>{ setGlobalDilCustom(e.target.value); setGlobalDilUseCustom(true); setGlobalDil(""); }}
                      placeholder="e.g. 1:250"
                      style={{flex:1,border:"1.5px solid "+(globalDilUseCustom&&globalDilCustom?"#3b82f6":"#e2e8f0"),borderRadius:7,padding:"6px 10px",fontSize:12,outline:"none",fontFamily:"monospace",fontWeight:600}}/>
                  </div>
                </div>
              )}

              {dilMode==="individual" && (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {samples.map(s => {
                    const d = indivDil[s.id]; const val = resolveDil(s.id);
                    return (
                      <div key={s.id} style={{background:"#f8fafc",borderRadius:9,border:"1.5px solid #e2e8f0",padding:"10px 14px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                          <span style={{fontWeight:700,fontSize:13,color:NAV,minWidth:100}}>{s.id}</span>
                          <span style={{fontSize:11,color:"#64748b"}}>{s.matrix}</span>
                          {val&&<span style={{marginLeft:"auto",fontSize:11,background:"#eff6ff",color:"#1d4ed8",borderRadius:4,padding:"1px 8px",fontWeight:700,fontFamily:"monospace"}}>{val}</span>}
                        </div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>
                          {presetBtn("None", !d.useCustom&&d.preset===""?"None":"", ()=>setIndivDil(p=>({...p,[s.id]:{preset:"",custom:"",useCustom:false}})))}
                          {DILUTION_PRESETS.map(v=>presetBtn(v, !d.useCustom?d.preset:"", val=>setIndivDil(p=>({...p,[s.id]:{...p[s.id],preset:val,useCustom:false}}))))}
                        </div>
                        <input value={d.custom} onChange={e=>setIndivDil(p=>({...p,[s.id]:{preset:"",custom:e.target.value,useCustom:true}}))}
                          placeholder="Custom, e.g. 1:250"
                          style={{width:"100%",boxSizing:"border-box",border:"1.5px solid "+(d.useCustom&&d.custom?"#3b82f6":"#e2e8f0"),borderRadius:7,padding:"6px 10px",fontSize:12,outline:"none",fontFamily:"monospace"}}/>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Final preview */}
              <div style={{background:"#f8fafc",borderRadius:9,border:"1px solid #e2e8f0",padding:"10px 14px"}}>
                <div style={{fontSize:11,fontWeight:700,color:NAV,marginBottom:6}}>Will create {totalNew} new sample row{totalNew!==1?"s":""}:</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {samples.flatMap(s=>Array.from({length:count},(_,ci)=>(
                    <span key={s.id+ci} style={{background:"#d1fae5",border:"1px solid #6ee7b7",borderRadius:5,padding:"2px 8px",fontSize:10,color:"#065f46",fontWeight:700}}>
                      {s.id}-D{ci+1}{resolveDil(s.id)?` [${resolveDil(s.id)}]`:""}
                    </span>
                  )))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center",padding:"14px 22px",borderTop:"1px solid #f1f5f9",background:"#fafafa",flexShrink:0}}>
          <button onClick={()=>step===1?onCancel():setStep(1)} style={{padding:"9px 20px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer"}}>
            {step===1?"Cancel":"← Back"}
          </button>
          <button onClick={handleNext}
            style={{padding:"9px 22px",borderRadius:8,border:"none",background:step===2&&submitted&&!dilOk?"#94a3b8":NAV,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
            {step===1?"Next: Set Dilution →":"🔁 Create Duplicates"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AQC BLOCKER BANNER
// ══════════════════════════════════════════════════════════════════════════════
function AqcBlockerBanner({realCount,aqcCount,requiredSets}) {
  const actualSets=Math.floor(aqcCount/2);
  const missing=requiredSets-actualSets;
  if(missing<=0) return null;
  return (
    <div style={{background:"#fef3c7",border:"2px solid #f59e0b",borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"flex-start",gap:10,flexShrink:0,margin:"0 20px"}}>
      <span style={{fontSize:20,flexShrink:0}}>🧪</span>
      <div>
        <div style={{fontWeight:800,fontSize:13,color:"#92400e",marginBottom:2}}>AQC Sets Required — Cannot Proceed Without Them</div>
        <div style={{fontSize:12,color:"#78350f"}}>{realCount} sample{realCount!==1?"s":""} require <strong>{requiredSets}</strong> AQC set{requiredSets!==1?"s":""} but only <strong>{actualSets}</strong> present. <span style={{color:"#dc2626",fontWeight:700}}>{missing} set{missing!==1?"s":""} missing.</span></div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CHEM STEP VIEW
// ══════════════════════════════════════════════════════════════════════════════
function ChemStepView({activeKey,sections,setSections,auditLog,setAuditLog,sessionEq}) {
  const activeSection=sections.find(s=>s.id===activeKey.secId);
  const activeCategory=activeSection?activeSection.categories.find(c=>c.id===activeKey.catId):null;
  const steps=activeCategory?activeCategory.steps:[];
  const activeStepIdx=steps.findIndex(s=>s.id===activeKey.stepId);
  const activeStep=activeStepIdx>=0?steps[activeStepIdx]:null;
  const nextStep=activeStepIdx>=0&&activeStepIdx<steps.length-1?steps[activeStepIdx+1]:null;
  const isLastStep=activeStepIdx===steps.length-1;
  const prevSteps=activeStepIdx>0?steps.slice(0,activeStepIdx):[];
  const stepKey=[activeKey.secId,activeKey.catId,activeKey.stepId].join("||");
  const currentAudit=auditLog[stepKey]||[];
  const rawSamples=activeStep?activeStep.samples:[];
  const stepQcEligible=activeStep?(activeStep.qcEligible||false):false;

  const mutateSamples=useCallback(fn=>makeMutate(setSections,activeKey)(fn),[setSections,activeKey]);

  const [moveTarget,setMoveTarget]=useState(null);
  const [groupingModal,setGroupingModal]=useState(null);
  const [reopenModal,setReopenModal]=useState(null);
  const [weighingModal,setWeighingModal]=useState(null);
  const [acidModal,setAcidModal]=useState(null);
  const [filtrationModal,setFiltrationModal]=useState(null);
  const [dilRepModal,setDilRepModal]=useState(null);
  const [dupeModal,setDupeModal]=useState(null);
  const [auditOpen,setAuditOpen]=useState(false);
  const [showAnalytes,setShowA]=useState(false);
  const [runView,setRunView]=useState("run");
  const [expandedRuns,setExpandedRuns]=useState(new Set());
  const [runDragState,setRunDragState]=useState({dragId:null,overId:null});

  const isWeighingStep=activeStep&&activeStep.id==="WEI";
  const isAcidStep=activeStep&&activeStep.id==="ACS";
  const isFiltrationStep=activeStep&&activeStep.id==="FIL";

  const hasRuns=useMemo(()=>rawSamples.some(s=>!s.isQC&&s.runId),[rawSamples]);
  const runGroups=useMemo(()=>{
    if(!hasRuns) return [];
    const map={};
    rawSamples.forEach(s=>{ const key=s.runId||"__none__"; if(!map[key]) map[key]=[]; map[key].push(s); });
    return Object.entries(map).sort((a,b)=>{ if(a[0]==="__none__")return 1; if(b[0]==="__none__")return -1; return a[0]<b[0]?-1:1; }).map(([runId,samples])=>({runId:runId==="__none__"?null:runId,samples}));
  },[rawSamples,hasRuns]);

  const realSamplesInStep=useMemo(()=>rawSamples.filter(s=>!s.isQC),[rawSamples]);
  const aqcSamplesInStep=useMemo(()=>rawSamples.filter(s=>s.isQC&&s.autoQC),[rawSamples]);
  const requiredAqcSets=useMemo(()=>realSamplesInStep.length>0?Math.ceil(realSamplesInStep.length/AQC_BATCH_SIZE):0,[realSamplesInStep]);
  const actualAqcSets=useMemo(()=>Math.floor(aqcSamplesInStep.length/2),[aqcSamplesInStep]);
  const aqcCoverageOk=!stepQcEligible||realSamplesInStep.length===0||actualAqcSets>=requiredAqcSets;

  const selectedRef=useRef(new Set());
  const {scanInput,setScanInput,scanState,scannedTrays,selected,setSelected,doScan,clearScan}=useScan(rawSamples,stepKey,pushAudit);
  useEffect(()=>{ selectedRef.current=selected; },[selected]);

  function pushAudit(key,entry){ setAuditLog(p=>({...p,[key]:(p[key]||[]).concat([{...entry,user:CURRENT_USER.name,time:nowStr()}])})); }

  function toggleQcEligible(){
    const turningOn=!stepQcEligible;
    setSections(prev=>prev.map(sec=>{ if(sec.id!==activeKey.secId) return sec; return {...sec,categories:sec.categories.map(cat=>{ if(cat.id!==activeKey.catId) return cat; return {...cat,steps:cat.steps.map(st=>{ if(st.id!==activeKey.stepId) return st; const newSamples=turningOn?st.samples:st.samples.filter(s=>!(s.isQC&&s.autoQC)); return {...st,qcEligible:!st.qcEligible,samples:newSamples}; })}; })}; }));
    pushAudit(stepKey,{type:"qc_toggled",target:activeStep?activeStep.name:"",detail:`AQC ${stepQcEligible?"disabled":"enabled"}`});
  }

  function applyGrouping(assignments){
    mutateSamples(ss=>{
      const updated=ss.map(s=>{ if(s.isQC) return s; const newRunId=assignments[s._id]; return newRunId!==undefined?{...s,runId:newRunId}:s; });
      return rebuildAqc(updated);
    });
    pushAudit(stepKey,{type:"grouped",target:"All samples",detail:`${Object.keys(assignments).length} samples re-assigned · AQC ${stepQcEligible?"rebuilt":"n/a"}`});
    setGroupingModal(null);
  }

  function confirmDilRep(updates,mode){
    mutateSamples(ss=>ss.map(s=>{ if(s.isQC) return s; const u=updates.find(u=>u._id===s._id); if(!u) return s; return mode==="dilution"?{...s,dilution:u.dilution}:{...s,replications:u.replications}; }));
    pushAudit(stepKey,{type:"confirmed",target:updates.map(u=>u.id).join(", "),detail:mode==="dilution"?`Dilution: ${[...new Set(updates.map(u=>u.dilution))].join(", ")}`:`Replications: ${[...new Set(updates.map(u=>u.replications))].join(", ")}×`});
    setDilRepModal(null);
  }

  function confirmDuplicate(dupes, copyCount) {
    mutateSamples(ss => {
      const origMap = Object.fromEntries(ss.filter(s=>!s.isQC).map(s=>[s.id,s]));
      const dupesByOrig = {};
      dupes.forEach(d => { if(!dupesByOrig[d.originalId]) dupesByOrig[d.originalId]=[]; dupesByOrig[d.originalId].push(d); });
      // Insert copies immediately after their original
      const result = [];
      ss.forEach(s => {
        result.push(s);
        if(!s.isQC && dupesByOrig[s.id]) {
          dupesByOrig[s.id].forEach(d => {
            result.push({
              ...origMap[s.id],
              _id: uid(),
              id: `${s.id}-${d.copyIndex}`,       // dash + index, no "D" prefix
              isDuplicate: true,
              dilution: d.dilution !== null ? d.dilution : (s.dilution||null),
              replications: s.replications || 1,
              trayCode: null,
              runId: s.runId || null,
              analytes: (s.analytes||[]).map(a=>({...a,status:"Pending"})),
            });
          });
        }
      });
      return rebuildAqc(result);
    });
    const ids = dupes.map(d=>`${d.originalId}-${d.copyIndex}`).join(", ");
    pushAudit(stepKey,{type:"confirmed",target:ids,detail:`${dupes.length} duplicate${dupes.length!==1?"s":""} created (${copyCount} cop${copyCount===1?"y":"ies"} each)${stepQcEligible?" · AQC rebuilt":""}`});
    setDupeModal(null);
    setSelected(new Set());
  }

  const flatRows=useMemo(()=>rawSamples.map(s=>{
    if(s.isQC) return {sampleId:s.id,_sampleId:s._id,matrix:s.matrix||"",status:(s.analytes&&s.analytes[0]?s.analytes[0].status:"Pending"),dueDate:"",qcType:s.qcType,qcReason:s.qcReason,trayCode:null,analytes:s.autoQC?s.analytes:null,coveredByQC:[],autoQC:s.autoQC||false,runId:s.runId||null,dilution:null,replications:1};
    return {sampleId:s.id,_sampleId:s._id,matrix:s.matrix,status:(s.analytes&&s.analytes[0]?s.analytes[0].status:"Pending"),dueDate:(s.analytes&&s.analytes[0]?s.analytes[0].dueDate:fmt(new Date("2026-03-14"))),methodName:(s.analytes&&s.analytes[0]?s.analytes[0].methodId:(s.primaryMethodId||"")),qcType:null,trayCode:s.trayCode||null,analytes:s.analytes,coveredByQC:s.coveredByQC||[],autoQC:false,runId:s.runId||null,dilution:s.dilution||null,replications:s.replications||1,isDuplicate:s.isDuplicate||false};
  }),[rawSamples]);

  const statusCounts=useMemo(()=>{ const c={Pending:0,Confirmed:0,Skipped:0,Reopened:0}; flatRows.forEach(r=>{ if(c[r.status]!==undefined) c[r.status]++; }); return c; },[flatRows]);
  const selCount=selected.size;
  const allSel=flatRows.length>0&&flatRows.every(r=>selected.has(r.sampleId));
  const qcCount=flatRows.filter(r=>r.qcType).length;
  const realCount=flatRows.filter(r=>!r.qcType).length;

  function withAqc(realRows){
    const runKeys=new Set(realRows.map(r=>r.runId==null?"__null__":r.runId));
    const aqcRows=rawSamples.filter(s=>s.isQC&&s.autoQC&&runKeys.has(s.runId==null?"__null__":s.runId)).map(s=>({sampleId:s.id,_sampleId:s._id,qcType:s.qcType,runId:s.runId}));
    const existingIds=new Set(realRows.map(r=>r._sampleId));
    return [...realRows,...aqcRows.filter(r=>!existingIds.has(r._sampleId))];
  }

  function rebuildAqc(samples) {
    if(!stepQcEligible) return samples.filter(s=>!s.autoQC);
    const reals=samples.filter(s=>!s.isQC);
    const byRun={},runOrder=[];
    reals.forEach(s=>{ const key=s.runId||"__none__"; if(!byRun[key]){byRun[key]=[];runOrder.push(key);} byRun[key].push(s); });
    const result=[];
    [...new Set(runOrder)].forEach(key=>{ const runId=key==="__none__"?null:key; buildAqcSandwich(byRun[key],runId).forEach(r=>result.push(r)); });
    return result;
  }

  function handleAction(action,sampleId){
    if(action==="remove_qc"){
      mutateSamples(ss=>{ const updated=ss.filter(s=>s.id!==sampleId); return rebuildAqc(updated); });
      pushAudit(stepKey,{type:"qc_deleted",target:sampleId,detail:"Cancelled"});
      return;
    }
    if(action==="remove_dupe"){
      mutateSamples(ss=>{ const updated=ss.filter(s=>s.id!==sampleId); return rebuildAqc(updated); });
      pushAudit(stepKey,{type:"qc_deleted",target:sampleId,detail:"Duplicate removed"+(stepQcEligible?" · AQC rebuilt":"")});
      setSelected(p=>{ const n=new Set(p); n.delete(sampleId); return n; });
      return;
    }
    const cur=selectedRef.current; const inSel=cur.has(sampleId)&&cur.size>1;
    const rows=flatRows.filter(r=>(inSel?[...cur]:[sampleId]).includes(r.sampleId));
    if(!rows.length) return;
    if(action==="Reopened"){ if(prevSteps.length>0) setReopenModal({rows}); return; }
    if(isWeighingStep&&action==="Confirmed"){ setWeighingModal({rows}); return; }
    if(isAcidStep&&action==="Confirmed"){ setAcidModal({rows}); return; }
    if(isFiltrationStep&&action==="Confirmed"){ setFiltrationModal({rows}); return; }
    setMoveTarget({action,rows});
  }

  function confirmReopen(targetStepId,reason){
    const {rows}=reopenModal; const realIds=new Set(rows.filter(r=>!r.qcType).map(r=>r._sampleId));
    setSections(prev=>{
      const sec=prev.find(s=>s.id===activeKey.secId); if(!sec) return prev;
      const cat=sec.categories.find(c=>c.id===activeKey.catId); if(!cat) return prev;
      const stIdx=cat.steps.findIndex(s=>s.id===activeKey.stepId); if(stIdx<0) return prev;
      const tgtIdx=cat.steps.findIndex(s=>s.id===targetStepId); if(tgtIdx<0) return prev;
      const curSamples=cat.steps[stIdx].samples;
      return prev.map(s=>{ if(s.id!==activeKey.secId) return s; return {...s,categories:s.categories.map(c=>{ if(c.id!==activeKey.catId) return c; return {...c,steps:c.steps.map((st,idx)=>{ if(idx===stIdx) return {...st,samples:st.samples.filter(s=>!realIds.has(s._id))}; if(idx===tgtIdx){ const toAdd=curSamples.filter(s=>realIds.has(s._id)).map(s=>({...s,analytes:(s.analytes||[]).map(a=>({...a,status:"Reopened"})),coveredByQC:[],runId:undefined})); const merged=st.samples.slice(); toAdd.forEach(ns=>{if(!merged.find(x=>x._id===ns._id))merged.push(ns);}); return {...st,samples:merged}; } return st; })}; })}; });
    });
    pushAudit(stepKey,{type:"reopened",target:rows.map(r=>r.sampleId).join(", "),detail:`→ ${targetStepId} — ${reason}`});
    setReopenModal(null); setSelected(new Set());
  }

  function confirmWeighing(weightResults){
    mutateSamples(ss=>ss.map(s=>{ const wr=weightResults.find(r=>r._id===s._id); if(!wr) return s; return {...s,weightG:wr.weight,weightOk:wr.weightOk,weightReason:wr.weightReason||null,balanceId:wr.balanceId,balanceName:wr.balanceName}; }));
    const flagged=weightResults.filter(r=>!r.weightOk);
    pushAudit(stepKey,{type:"confirmed",target:weightResults.map(r=>r.id).join(", "),detail:`Balance: ${weightResults[0]?.balanceName||""} · ${flagged.length>0?`${flagged.length} flagged`:"All in range"}`});
    setWeighingModal(null);
    confirmMove("Confirmed",withAqc(weightResults.map(r=>({sampleId:r.id,_sampleId:r._id,qcType:null,runId:r.runId||null}))));
  }
  function confirmAcidification(meta){
    mutateSamples(ss=>ss.map(s=>{ if(s.isQC) return s; if(!acidModal.rows.some(r=>r._sampleId===s._id)) return s; return {...s,acidEdpId:meta.edpId,acidEdpName:meta.edpName,acidAqcLotId:meta.aqcLotId,acidAqcLotName:meta.aqcLotName}; }));
    pushAudit(stepKey,{type:"confirmed",target:acidModal.rows.map(r=>r.sampleId).join(", "),detail:`EDP: ${meta.edpId} · AQC Lot: ${meta.aqcLotId}`});
    const realRows=acidModal.rows; setAcidModal(null);
    confirmMove("Confirmed",withAqc(realRows));
  }
  function confirmFiltration(meta){
    mutateSamples(ss=>ss.map(s=>{ if(s.isQC) return s; if(!filtrationModal.rows.some(r=>r._sampleId===s._id)) return s; return {...s,filterPaperLotId:meta.filterPaperLotId,filterPaperName:meta.filterPaperName}; }));
    pushAudit(stepKey,{type:"confirmed",target:filtrationModal.rows.map(r=>r.sampleId).join(", "),detail:`Filter Paper: ${meta.filterPaperLotId}`});
    const realRows=filtrationModal.rows; setFiltrationModal(null);
    confirmMove("Confirmed",withAqc(realRows));
  }

  function confirmMove(action,rows){
    if(action==="Confirmed"&&stepQcEligible&&!aqcCoverageOk) return;
    setSections(prev=>{
      const sec=prev.find(s=>s.id===activeKey.secId); if(!sec) return prev;
      const cat=sec.categories.find(c=>c.id===activeKey.catId); if(!cat) return prev;
      const stIdx=cat.steps.findIndex(s=>s.id===activeKey.stepId); if(stIdx<0) return prev;
      const isLast=stIdx===cat.steps.length-1;
      const next=!isLast?cat.steps[stIdx+1]:null;
      const nextQcOn=next?(next.qcEligible||false):false;
      const curSamples=cat.steps[stIdx].samples;
      const realSampleIds=new Set(rows.filter(r=>!r.qcType).map(r=>r._sampleId));
      const stampedReal=curSamples.filter(s=>!s.isQC&&realSampleIds.has(s._id)).map(s=>({...s,analytes:s.analytes.map(a=>({...a,status:"Pending"}))}));
      const movedRunIds=new Set(stampedReal.map(s=>s.runId).filter(Boolean));
      const hasUnassignedReal=stampedReal.some(s=>!s.runId);
      const existingAqc=curSamples.filter(s=>s.isQC&&s.autoQC&&((s.runId&&movedRunIds.has(s.runId))||(!s.runId&&hasUnassignedReal)));
      const destSamples=!isLast&&next?next.samples:[];
      const existingAqcRunIds=new Set(destSamples.filter(s=>s.isQC&&s.autoQC&&s.runId).map(s=>s.runId));

      const byRun={},runOrder=[];
      stampedReal.forEach(s=>{ const rId=s.runId||"__none__"; if(!byRun[rId]){byRun[rId]=[];runOrder.push(rId);} byRun[rId].push(s); });

      let toNextStep=[];
      if(nextQcOn){
        [...new Set(runOrder)].forEach(rId=>{ const runId=rId==="__none__"?null:rId; if(runId&&existingAqcRunIds.has(runId)){ byRun[rId].forEach(row=>toNextStep.push(row)); } else { buildAqcSandwich(byRun[rId],runId).forEach(row=>toNextStep.push(row)); } });
      } else {
        [...new Set(runOrder)].forEach(rId=>{
          const realForRun=byRun[rId];
          const aqcForRun=existingAqc.filter(q=>(q.runId||"__none__")===rId);
          if(!aqcForRun.length){ realForRun.forEach(s=>toNextStep.push(s)); }
          else { [...realForRun,...aqcForRun].sort((a,b)=>curSamples.findIndex(x=>x._id===a._id)-curSamples.findIndex(x=>x._id===b._id)).forEach(s=>toNextStep.push(s)); }
        });
        stampedReal.filter(s=>!s.runId).forEach(s=>{ if(!toNextStep.find(x=>x._id===s._id)) toNextStep.push(s); });
        existingAqc.filter(q=>!q.runId).forEach(q=>{ if(!toNextStep.find(x=>x._id===q._id)) toNextStep.push(q); });
        const seen=new Set(); toNextStep=toNextStep.filter(s=>{ if(seen.has(s._id))return false; seen.add(s._id); return true; });
      }

      const removeIds=new Set([...stampedReal.map(s=>s._id),...existingAqc.map(s=>s._id)]);
      return prev.map(s=>{ if(s.id!==activeKey.secId) return s; return {...s,categories:s.categories.map(c=>{ if(c.id!==activeKey.catId) return c; return {...c,steps:c.steps.map((st,idx)=>{ if(idx===stIdx) return {...st,samples:st.samples.filter(sm=>!removeIds.has(sm._id))}; if(!isLast&&next&&st.id===next.id){ const merged=st.samples.slice(); toNextStep.forEach(ns=>{if(!merged.find(x=>x._id===ns._id))merged.push(ns);}); return {...st,samples:merged}; } return st; })}; })}; });
    });
    pushAudit(stepKey,{type:action==="Confirmed"?"confirmed":"skipped",target:rows.map(r=>r.sampleId).join(", "),detail:`→ ${isLastStep?"Completed":(nextStep?nextStep.name:"next step")}`});
    setSelected(new Set()); setMoveTarget(null); clearScan();
  }

  function handleReorder(draggedIds,targetId){
    mutateSamples(ss=>{
      const dragSet=new Set(draggedIds);
      const reals=ss.filter(s=>!s.isQC);
      const dragged=reals.filter(s=>dragSet.has(s.id));
      const rest=reals.filter(s=>!dragSet.has(s.id));
      const idx=rest.findIndex(s=>s.id===targetId);
      const at=idx===-1?rest.length:idx;
      const reordered=[...rest.slice(0,at),...dragged,...rest.slice(at)];
      if(stepQcEligible){
        const byRun={},runOrder=[];
        reordered.forEach(s=>{ const key=s.runId||"__none__"; if(!byRun[key]){byRun[key]=[];runOrder.push(key);} byRun[key].push(s); });
        const result=[];
        [...new Set(runOrder)].forEach(key=>{ const runId=key==="__none__"?null:key; buildAqcSandwich(byRun[key],runId).forEach(r=>result.push(r)); });
        return result;
      }
      return reordered;
    });
    pushAudit(stepKey,{type:"reordered",target:draggedIds.join(", "),detail:`Before ${targetId}${stepQcEligible?" · AQC rebuilt":""}`});
  }

  function toggleRunExpand(runId){ setExpandedRuns(p=>{ const n=new Set(p); n.has(runId)?n.delete(runId):n.add(runId); return n; }); }

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {auditOpen&&<AuditLogFloat entries={currentAudit} onClose={()=>setAuditOpen(false)}/>}
      {groupingModal&&<GroupingModal samples={rawSamples.filter(s=>!s.isQC&&groupingModal.selectedIds.has(s.id))} aqcEnabled={stepQcEligible} onConfirm={applyGrouping} onCancel={()=>setGroupingModal(null)}/>}
      {dupeModal&&<DuplicateModal samples={rawSamples.filter(s=>!s.isQC&&dupeModal.rows.some(r=>r._sampleId===s._id))} onConfirm={confirmDuplicate} onCancel={()=>setDupeModal(null)}/>}
      {dilRepModal&&<DilutionReplicationModal samples={rawSamples.filter(s=>!s.isQC&&dilRepModal.rows.some(r=>r._sampleId===s._id))} onConfirm={confirmDilRep} onCancel={()=>setDilRepModal(null)}/>}
      {acidModal&&<AcidificationModal samples={rawSamples.filter(s=>!s.isQC&&acidModal.rows.some(r=>r._sampleId===s._id))} sessionEq={sessionEq} onConfirm={confirmAcidification} onCancel={()=>setAcidModal(null)}/>}
      {filtrationModal&&<FiltrationModal samples={rawSamples.filter(s=>!s.isQC&&filtrationModal.rows.some(r=>r._sampleId===s._id))} sessionEq={sessionEq} onConfirm={confirmFiltration} onCancel={()=>setFiltrationModal(null)}/>}
      {weighingModal&&<WeighingModal samples={rawSamples.filter(s=>!s.isQC&&weighingModal.rows.some(r=>r._sampleId===s._id))} sessionEq={sessionEq} onConfirm={confirmWeighing} onCancel={()=>setWeighingModal(null)}/>}
      {reopenModal&&<ChemReopenModal rows={reopenModal.rows} prevSteps={prevSteps} onConfirm={confirmReopen} onCancel={()=>setReopenModal(null)}/>}

      {moveTarget&&(
        <div style={{position:"fixed",inset:0,background:"#00000066",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setMoveTarget(null)}>
          <div style={{background:"#fff",borderRadius:14,maxWidth:420,width:"90%",padding:24,boxShadow:"0 20px 60px #0005"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontWeight:800,fontSize:16,color:NAV,marginBottom:6}}>{moveTarget.action==="Confirmed"?"✔ Confirm Step":"⏭ Skip Step"}</div>
            <div style={{fontSize:13,color:"#64748b",marginBottom:16}}>{moveTarget.rows.filter(r=>!r.qcType).length} sample{moveTarget.rows.filter(r=>!r.qcType).length!==1?"s":""} → <strong>{isLastStep?"Complete":(nextStep?nextStep.name:"next step")}</strong></div>
            {moveTarget.action==="Confirmed"&&stepQcEligible&&!aqcCoverageOk&&<div style={{background:"#fef3c7",border:"1px solid #f59e0b",borderRadius:8,padding:"9px 12px",fontSize:12,color:"#92400e",fontWeight:700,marginBottom:12}}>⚠ AQC coverage incomplete — resolve before confirming.</div>}
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>setMoveTarget(null)} style={{padding:"8px 18px",borderRadius:7,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button disabled={moveTarget.action==="Confirmed"&&stepQcEligible&&!aqcCoverageOk} onClick={()=>confirmMove(moveTarget.action,withAqc(moveTarget.rows))}
                style={{padding:"8px 18px",borderRadius:7,border:"none",background:moveTarget.action==="Confirmed"?(stepQcEligible&&!aqcCoverageOk?"#94a3b8":"#10b981"):"#94a3b8",color:"#fff",fontSize:13,fontWeight:700,cursor:(moveTarget.action==="Confirmed"&&stepQcEligible&&!aqcCoverageOk)?"not-allowed":"pointer"}}>
                {moveTarget.action==="Confirmed"?"✔ Confirm":"⏭ Skip"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexShrink:0}}>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:NAV,marginBottom:2,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            {activeStep?activeStep.name:""}
            {stepQcEligible&&realCount>0&&<span style={{fontSize:11,background:aqcCoverageOk?"#d1fae5":"#fef3c7",color:aqcCoverageOk?"#065f46":"#92400e",border:"1px solid "+(aqcCoverageOk?"#6ee7b7":"#fde68a"),borderRadius:5,padding:"2px 8px",fontWeight:700}}>🧪 {actualAqcSets}/{requiredAqcSets} AQC sets{aqcCoverageOk?" ✔":" ⚠"}</span>}
          </div>
          <div style={{fontSize:12,color:"#94a3b8"}}>
            <strong>{realCount}</strong> samples{qcCount>0&&<span> · <strong style={{color:"#0891b2"}}>🧪 {qcCount} QC rows</strong></span>}
            <span style={{marginLeft:8}}>{steps.map((st,i)=>{ const isCur=st.id===activeKey.stepId; return <span key={st.id+i}>{i>0&&<span style={{opacity:.4,margin:"0 3px"}}>›</span>}<span style={{fontWeight:isCur?800:400,color:isCur?NAV:"#cbd5e1",background:isCur?"#dbeafe":"transparent",borderRadius:4,padding:"1px 5px"}}>{i+1}. {st.name}</span></span>; })}</span>
          </div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",justifyContent:"flex-end"}}>
          <button onClick={()=>{ const selSamples=rawSamples.filter(s=>!s.isQC&&selected.has(s.id)); if(!selSamples.length) return; setGroupingModal({selectedIds:new Set(selSamples.map(s=>s.id))}); }} disabled={selCount===0}
            style={{display:"flex",alignItems:"center",gap:5,background:selCount>0?"#e0f2fe":"#f1f5f9",color:selCount>0?"#0369a1":"#cbd5e1",border:"1px solid "+(selCount>0?"#7dd3fc":"#e2e8f0"),borderRadius:7,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:selCount>0?"pointer":"not-allowed"}}>
            🗂 Group{selCount>0?` (${selCount})`:""}
          </button>
          {hasRuns&&(
            <div style={{display:"flex",alignItems:"center",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"3px 4px",gap:2}}>
              <button onClick={()=>setRunView("sample")} style={{padding:"4px 10px",borderRadius:6,border:"none",background:runView==="sample"?NAV:"transparent",color:runView==="sample"?"#fff":"#64748b",fontSize:11,fontWeight:700,cursor:"pointer"}}>🔬 Sample</button>
              <button onClick={()=>setRunView("run")} style={{padding:"4px 10px",borderRadius:6,border:"none",background:runView==="run"?NAV:"transparent",color:runView==="run"?"#fff":"#64748b",fontSize:11,fontWeight:700,cursor:"pointer"}}>🗂 Run</button>
            </div>
          )}
          {selCount>0&&(
            <div style={{display:"flex",gap:6,alignItems:"center",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"5px 10px"}}>
              <span style={{fontSize:12,color:"#475569",fontWeight:600}}>{selCount} sel.</span>
              <button onClick={()=>{ const rows=flatRows.filter(r=>selected.has(r.sampleId)&&!r.qcType); if(!rows.length) return; if(isWeighingStep) setWeighingModal({rows}); else if(isAcidStep) setAcidModal({rows}); else if(isFiltrationStep) setFiltrationModal({rows}); else setMoveTarget({action:"Confirmed",rows}); }} style={{background:"#d1fae5",color:"#065f46",border:"none",borderRadius:5,padding:"4px 9px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✔ Confirm</button>
              <button onClick={()=>{ const rows=flatRows.filter(r=>selected.has(r.sampleId)&&!r.qcType); if(rows.length) setMoveTarget({action:"Skipped",rows}); }} style={{background:"#f1f5f9",color:"#475569",border:"none",borderRadius:5,padding:"4px 9px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⏭ Skip</button>
              {prevSteps.length>0&&<button onClick={()=>{ const rows=flatRows.filter(r=>selected.has(r.sampleId)&&!r.qcType); if(rows.length) setReopenModal({rows}); }} style={{background:"#fee2e2",color:"#991b1b",border:"none",borderRadius:5,padding:"4px 9px",fontSize:11,fontWeight:700,cursor:"pointer"}}>↺ Reopen</button>}
              <div style={{width:1,height:18,background:"#e2e8f0",flexShrink:0}}/>
              <button onClick={()=>{ const rows=flatRows.filter(r=>selected.has(r.sampleId)&&!r.qcType); if(rows.length) setDilRepModal({rows}); }} style={{background:"#fef3c7",color:"#92400e",border:"1px solid #fde68a",borderRadius:5,padding:"4px 9px",fontSize:11,fontWeight:700,cursor:"pointer"}}>🧫 Dil / Rep</button>
              <button onClick={()=>{ const rows=flatRows.filter(r=>selected.has(r.sampleId)&&!r.qcType); if(rows.length) setDupeModal({rows}); }} style={{background:"#ede9fe",color:"#7c3aed",border:"1px solid #c4b5fd",borderRadius:5,padding:"4px 9px",fontSize:11,fontWeight:700,cursor:"pointer"}}>🔁 Duplicate</button>
            </div>
          )}
          <button onClick={()=>setAuditOpen(o=>!o)} style={{background:currentAudit.length>0?"#f0f9ff":"none",border:"1px solid "+(currentAudit.length>0?"#bae6fd":"#e2e8f0"),borderRadius:7,padding:"5px 10px",color:NAV,fontSize:12,cursor:"pointer",opacity:currentAudit.length===0?.5:1}}>
            🗒{currentAudit.length>0&&<span style={{marginLeft:4,fontSize:10,background:"#f59e0b",color:"#fff",borderRadius:8,padding:"1px 6px",fontWeight:700}}>{currentAudit.length}</span>}
          </button>
        </div>
      </div>

      {stepQcEligible&&realCount>0&&!aqcCoverageOk&&<div style={{padding:"10px 0 0"}}><AqcBlockerBanner realCount={realCount} aqcCount={aqcSamplesInStep.length} requiredSets={requiredAqcSets}/></div>}

      {/* Status strip */}
      <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"8px 20px",display:"flex",gap:8,flexShrink:0}}>
        {["Pending","Confirmed","Skipped"].map(st=>{ const m=STATUS_META[st],cnt=statusCounts[st]||0,pct=flatRows.length>0?Math.round(cnt/flatRows.length*100):0; return (
          <div key={st} style={{flex:1,background:"#f8fafc",border:"1.5px solid "+m.color+"44",borderRadius:9,padding:"7px 10px"}}>
            <div style={{fontSize:10,fontWeight:700,color:m.color,textTransform:"uppercase",marginBottom:2}}>{m.icon} {st}</div>
            <div style={{fontSize:18,fontWeight:800,color:m.color,lineHeight:1}}>{cnt}</div>
            <div style={{marginTop:4,height:3,background:"#e2e8f0",borderRadius:2,overflow:"hidden"}}><div style={{width:pct+"%",height:"100%",background:m.color}}/></div>
          </div>
        ); })}
      </div>

      <ScanBar scanInput={scanInput} setScanInput={setScanInput} scanState={scanState} onCommit={doScan} onClear={clearScan} scannedTrays={scannedTrays} selCount={selCount}/>

      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",padding:"10px 20px"}}>
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"#fff",borderRadius:10,border:"1px solid #e2e8f0"}}>
          {hasRuns&&runView==="run"?(
            <div style={{flex:1,overflowY:"auto"}}>
              {runGroups.length===0
                ?<div style={{padding:48,textAlign:"center",color:"#94a3b8"}}>No runs yet. Use 🗂 Grouping to assign.</div>
                :runGroups.map(({runId,samples:rSamples},gi)=>{
                  const color=RUN_COLORS[gi%RUN_COLORS.length];
                  const isExpanded=runId?expandedRuns.has(runId):true;
                  const realInRun=rSamples.filter(s=>!s.isQC);
                  const allRunSel=realInRun.length>0&&realInRun.every(s=>selected.has(s.id));
                  const statCounts={Pending:0,Confirmed:0,Skipped:0};
                  realInRun.forEach(s=>{ const st=s.analytes&&s.analytes[0]?s.analytes[0].status:"Pending"; if(statCounts[st]!==undefined)statCounts[st]++; });
                  return (
                    <div key={runId||"__none__"} style={{borderBottom:"2px solid #f1f5f9"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:color+"0d",borderBottom:"1px solid "+color+"22",cursor:"pointer"}} onClick={()=>runId&&toggleRunExpand(runId)}>
                        <input type="checkbox" checked={allRunSel} onChange={e=>{e.stopPropagation();setSelected(p=>{const n=new Set(p);realInRun.forEach(s=>e.target.checked?n.add(s.id):n.delete(s.id));return n;});}} onClick={e=>e.stopPropagation()} style={{accentColor:NAV,cursor:"pointer"}}/>
                        {runId?<span style={{fontFamily:"monospace",fontSize:12,fontWeight:800,background:"#1e293b",color:"#e2e8f0",borderRadius:5,padding:"3px 9px"}}>{runId}</span>:<span style={{fontSize:12,fontWeight:700,color:"#94a3b8",fontStyle:"italic"}}>Unassigned</span>}
                        <span style={{fontSize:11,background:color+"22",color,borderRadius:4,padding:"2px 8px",fontWeight:700,border:"1px solid "+color+"44"}}>{realInRun.length} sample{realInRun.length!==1?"s":""}</span>
                        {Object.entries(statCounts).map(([st,cnt])=>cnt>0&&<span key={st} style={{fontSize:10,background:STATUS_META[st].bg,color:STATUS_META[st].color,borderRadius:4,padding:"1px 6px",fontWeight:700}}>{STATUS_META[st].icon} {cnt}</span>)}
                        <div style={{marginLeft:"auto",display:"flex",gap:5,alignItems:"center"}}>
                          <button onClick={e=>{ e.stopPropagation(); const rows=realInRun.map(s=>({sampleId:s.id,_sampleId:s._id,qcType:null,runId:s.runId||null})); if(!rows.length) return; if(isWeighingStep){setWeighingModal({rows});return;} if(isAcidStep){setAcidModal({rows});return;} if(isFiltrationStep){setFiltrationModal({rows});return;} setMoveTarget({action:"Confirmed",rows}); }} style={{background:"#d1fae5",color:"#065f46",border:"none",borderRadius:5,padding:"4px 9px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✔ Run</button>
                          <button onClick={e=>{ e.stopPropagation(); const rows=realInRun.map(s=>({sampleId:s.id,_sampleId:s._id,qcType:null})); setMoveTarget({action:"Skipped",rows}); }} style={{background:"#f1f5f9",color:"#475569",border:"none",borderRadius:5,padding:"4px 9px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⏭ Run</button>
                          {runId&&<span style={{fontSize:11,color,opacity:.7,userSelect:"none"}}>{isExpanded?"▾":"▸"}</span>}
                        </div>
                      </div>
                      {isExpanded&&rSamples.map((s,si)=>{
                        const st=s.analytes&&s.analytes[0]?s.analytes[0].status:"Pending";
                        const isQC=!!s.qcType; const q=isQC?QC_TYPES[s.qcType]:null;
                        const isDragging=runDragState.dragId===s.id;
                        const isOver=runDragState.overId===s.id&&!isDragging;
                        return (
                          <div key={s._id} draggable={!isQC}
                            onDragStart={!isQC?()=>setRunDragState({dragId:s.id,overId:null}):undefined}
                            onDragOver={e=>{e.preventDefault();if(runDragState.dragId&&runDragState.dragId!==s.id)setRunDragState(p=>({...p,overId:s.id}));}}
                            onDrop={e=>{e.preventDefault();if(runDragState.dragId&&runDragState.dragId!==s.id)handleReorder([runDragState.dragId],s.id);setRunDragState({dragId:null,overId:null});}}
                            onDragEnd={()=>setRunDragState({dragId:null,overId:null})}
                            style={{display:"flex",alignItems:"center",gap:10,padding:"7px 16px 7px 44px",borderTop:isOver?"2.5px solid #3b82f6":si>0?"1px solid #f8fafc":"1px solid "+color+"18",background:isDragging?"#e0f2fe":selected.has(s.id)?"#f0f9ff":isQC?(q?q.bg+"33":"#fff"):"#fff",opacity:isDragging?0.45:1,cursor:!isQC?"grab":"default"}}>
                            {!isQC&&<span style={{fontSize:13,color:isDragging?"#6366f1":"#cbd5e1",userSelect:"none",flexShrink:0}}>⠿</span>}
                            {!isQC&&<input type="checkbox" checked={selected.has(s.id)} onChange={()=>setSelected(p=>{const n=new Set(p);n.has(s.id)?n.delete(s.id):n.add(s.id);return n;})} style={{accentColor:NAV,cursor:"pointer"}}/>}
                            {isQC&&<span style={{width:28,flexShrink:0}}/>}
                            {s.trayCode&&<TrayBadge trayCode={s.trayCode}/>}
                            <span style={{fontWeight:600,fontSize:13,color:isQC&&q?q.color:NAV,minWidth:110}}>{s.id}</span>
                            {isQC&&<QCBadge qcType={s.qcType} reason={s.qcReason}/>}
                            {!isQC&&(
                              <div style={{display:"flex",alignItems:"center",gap:4,flex:1,minWidth:0}}>
                                <span style={{fontSize:12,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.matrix}</span>
                                {s.isDuplicate&&<span style={{fontSize:9,background:"#ede9fe",color:"#7c3aed",border:"1px solid #c4b5fd",borderRadius:3,padding:"1px 4px",fontWeight:800,flexShrink:0}}>DUP</span>}
                                {s.replications>1&&<span style={{fontSize:9,background:"#d1fae5",color:"#065f46",border:"1px solid #6ee7b7",borderRadius:3,padding:"1px 5px",fontWeight:800,flexShrink:0}}>×{s.replications}</span>}
                              </div>
                            )}
                            {/* Dilution column in run view */}
                            {!isQC&&(
                              s.dilution
                                ?<span style={{fontSize:10,background:"#fef3c7",color:"#92400e",border:"1px solid #fde68a",borderRadius:4,padding:"1px 6px",fontWeight:800,whiteSpace:"nowrap",fontFamily:"monospace",flexShrink:0}}>{s.dilution}</span>
                                :<span style={{fontSize:11,color:"#e2e8f0",flexShrink:0}}>—</span>
                            )}
                            <span style={{fontSize:11,background:"#f1f5f9",color:"#334155",borderRadius:4,padding:"2px 7px",fontWeight:700}}>{s.primaryMethodId}</span>
                            <StatusBadge status={st}/>
                            {s.analytes&&s.analytes[0]&&s.analytes[0].dueDate&&<DueBadge dueDate={s.analytes[0].dueDate}/>}
                            {!isQC&&(
                              <div style={{display:"flex",gap:3}}>
                                <button onClick={()=>handleAction("Confirmed",s.id)} style={{background:"#d1fae5",color:"#065f46",border:"none",borderRadius:5,padding:"3px 7px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✔</button>
                                <button onClick={()=>handleAction("Skipped",s.id)} style={{background:"#f1f5f9",color:"#475569",border:"none",borderRadius:5,padding:"3px 7px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⏭</button>
                                {s.isDuplicate
                                  ?<FixedTooltip tip="Remove duplicate"><button onClick={()=>handleAction("remove_dupe",s.id)} style={{background:"#ede9fe",color:"#7c3aed",border:"1px solid #c4b5fd",borderRadius:5,padding:"3px 7px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✕</button></FixedTooltip>
                                  :prevSteps.length>0&&<button onClick={()=>setReopenModal({rows:[{sampleId:s.id,_sampleId:s._id,qcType:null}]})} style={{background:"#fee2e2",color:"#991b1b",border:"none",borderRadius:5,padding:"3px 7px",fontSize:11,fontWeight:700,cursor:"pointer"}}>↺</button>
                                }
                              </div>
                            )}
                            {isQC&&<button onClick={()=>handleAction("remove_qc",s.id)} style={{background:"#fee2e2",color:"#991b1b",border:"none",borderRadius:5,padding:"3px 7px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✕</button>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              }
            </div>
          ):(
            <>
              <div style={{display:"grid",gridTemplateColumns:CHEM_GRID_TPL,background:"#f8fafc",borderBottom:"2px solid #e2e8f0",flexShrink:0}}>
                <div style={{height:40,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:11,color:"#cbd5e1"}}>⠿</span></div>
                <div style={{padding:"0 8px",display:"flex",alignItems:"center"}}><input type="checkbox" checked={allSel} onChange={e=>{if(e.target.checked)setSelected(new Set(flatRows.map(r=>r.sampleId)));else setSelected(new Set());}} style={{accentColor:NAV,cursor:"pointer"}}/></div>
                {["Tray","Sample ID","Matrix","Dilution","Method","Status","Due","Actions"].map(h=><div key={h} style={{padding:"10px 8px",fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:".05em",display:"flex",alignItems:"center"}}>{h}</div>)}
                <div style={{padding:"6px 8px",display:"flex",alignItems:"center"}}><button onClick={()=>setShowA(v=>!v)} style={{background:showAnalytes?"#3b82f6":"#e2e8f0",color:showAnalytes?"#fff":"#64748b",border:"none",borderRadius:6,padding:"4px 8px",fontSize:10,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>🧬 {showAnalytes?"Hide":"Show"}</button></div>
              </div>
              {flatRows.length===0
                ?<div style={{padding:48,textAlign:"center",color:"#94a3b8"}}><div style={{fontSize:32,marginBottom:10}}>✅</div><div style={{fontWeight:700,color:NAV}}>No samples in this step</div></div>
                :<ChemVirtualGrid rows={flatRows} selected={selected} onToggle={id=>setSelected(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;})} onAction={handleAction} showAnalytes={showAnalytes} onReorder={handleReorder}/>
              }
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CHEM SAMPLE ROW
// ══════════════════════════════════════════════════════════════════════════════
const ChemSampleRow=memo(function ChemSampleRow({row,isSelected,onToggle,onAction,showAnalytes,isDragOver,isDragging,onDragStart,onDragOver,onDrop,onDragEnd}){
  const isQC=!!row.qcType,q=isQC?QC_TYPES[row.qcType]:null,canDrag=!row.qcType;
  const isDupe=!isQC&&row.isDuplicate;
  const bg=isSelected?"#f0f9ff":isDragging?"#e0f2fe":isQC?(q?q.bg+"55":"#fff"):isDupe?"#fdf4ff":"#fff";
  const leftBorder=isQC&&q?`3px solid ${q.color}`:isDupe?"3px solid #a855f7":isSelected?`3px solid ${NAV}`:"3px solid transparent";
  const primaryMethod=!isQC&&row.analytes&&row.analytes.length>0?row.analytes[0].methodId:null;
  const hasMulti=!isQC&&row.analytes?new Set(row.analytes.map(a=>a.methodId)).size>1:false;
  const rowAnalytes=row.analytes||[];
  const showAnalyteBar=showAnalytes&&(!isQC||row.autoQC)&&rowAnalytes.length>0;
  return (
    <div style={{display:"flex",borderTop:isDragOver?"2.5px solid #3b82f6":"1px solid #f1f5f9",background:bg,opacity:isDragging?0.45:1,transition:"background 0.1s"}}
      draggable={canDrag} onDragStart={canDrag?onDragStart:undefined} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd}>
      <div style={{display:"grid",gridTemplateColumns:CHEM_GRID_TPL,flex:"0 0 auto",width:"100%"}}>
        <div style={{...CS,justifyContent:"center",padding:0,borderLeft:leftBorder,cursor:canDrag?"grab":"default"}}>{canDrag&&<span style={{fontSize:13,color:isDragging?"#6366f1":isSelected?"#3b82f6":"#cbd5e1",userSelect:"none"}}>⠿</span>}</div>
        <div style={{...CS,justifyContent:"center",padding:"0 8px"}}><input type="checkbox" checked={isSelected} onChange={()=>onToggle(row.sampleId)} style={{accentColor:NAV,cursor:"pointer"}}/></div>
        {/* Tray */}
        <div style={{...CS,padding:"0 6px"}}>{row.trayCode&&<TrayBadge trayCode={row.trayCode}/>}</div>
        {/* Sample ID */}
        <div style={{...CS,fontWeight:600,color:isQC&&q?q.color:isDupe?"#7c3aed":NAV,gap:4,minWidth:0,flexWrap:"nowrap"}}>
          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.sampleId}</span>
          {isDupe&&<span style={{fontSize:9,background:"#ede9fe",color:"#7c3aed",border:"1px solid #c4b5fd",borderRadius:3,padding:"1px 4px",fontWeight:800,flexShrink:0}}>DUP</span>}
          {row.runId&&<RunBadge runId={row.runId}/>}
        </div>
        {/* Matrix */}
        <div style={{...CS,padding:"0 8px",minWidth:0}}>
          {isQC
            ?<QCBadge qcType={row.qcType} reason={row.qcReason}/>
            :<div style={{display:"flex",alignItems:"center",gap:4,minWidth:0}}>
              <span style={{fontSize:12,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.matrix}</span>
              {row.replications>1&&<span style={{fontSize:9,background:"#d1fae5",color:"#065f46",border:"1px solid #6ee7b7",borderRadius:3,padding:"1px 5px",fontWeight:800,whiteSpace:"nowrap",flexShrink:0}}>×{row.replications}</span>}
            </div>
          }
        </div>
        {/* Dilution — own column */}
        <div style={{...CS,padding:"0 8px"}}>
          {!isQC&&row.dilution
            ?<span style={{fontSize:11,background:"#fef3c7",color:"#92400e",border:"1px solid #fde68a",borderRadius:4,padding:"2px 7px",fontWeight:800,whiteSpace:"nowrap",fontFamily:"monospace"}}>{row.dilution}</span>
            :<span style={{fontSize:12,color:"#e2e8f0"}}>—</span>
          }
        </div>
        {/* Method */}
        <div style={{...CS,padding:"0 8px"}}>
          {primaryMethod&&<FixedTooltip tip={METHOD_FULL[primaryMethod]||primaryMethod}><span style={{background:"#f1f5f9",color:"#334155",border:"1px solid "+(hasMulti?"#f59e0b":"#cbd5e1"),borderRadius:4,padding:"2px 7px",fontSize:11,fontWeight:700,cursor:"default"}}>{primaryMethod}{hasMulti&&<span style={{color:"#f59e0b",marginLeft:3}}>+</span>}</span></FixedTooltip>}
        </div>
        {/* Status */}
        <div style={{...CS,padding:"0 8px"}}><StatusBadge status={row.status}/></div>
        {/* Due */}
        <div style={{...CS,justifyContent:"center"}}>{row.dueDate&&<DueBadge dueDate={row.dueDate}/>}</div>
        {/* Actions */}
        <div style={{padding:"0 4px",height:ROW_H,display:"flex",alignItems:"center",gap:2}}>
          {!isQC&&!isDupe&&<>
            <button onClick={()=>onAction("Confirmed",row.sampleId)} style={{background:"#d1fae5",color:"#065f46",border:"none",borderRadius:5,padding:"4px 6px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✔</button>
            <button onClick={()=>onAction("Skipped",row.sampleId)} style={{background:"#f1f5f9",color:"#475569",border:"none",borderRadius:5,padding:"4px 6px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⏭</button>
            <button onClick={()=>onAction("Reopened",row.sampleId)} style={{background:"#fee2e2",color:"#991b1b",border:"none",borderRadius:5,padding:"4px 6px",fontSize:11,fontWeight:700,cursor:"pointer"}}>↺</button>
          </>}
          {!isQC&&isDupe&&<>
            <button onClick={()=>onAction("Confirmed",row.sampleId)} style={{background:"#d1fae5",color:"#065f46",border:"none",borderRadius:5,padding:"4px 6px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✔</button>
            <button onClick={()=>onAction("Skipped",row.sampleId)} style={{background:"#f1f5f9",color:"#475569",border:"none",borderRadius:5,padding:"4px 6px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⏭</button>
            <FixedTooltip tip="Remove duplicate">
              <button onClick={()=>onAction("remove_dupe",row.sampleId)} style={{background:"#ede9fe",color:"#7c3aed",border:"1px solid #c4b5fd",borderRadius:5,padding:"4px 6px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✕</button>
            </FixedTooltip>
          </>}
          {isQC&&row.autoQC&&<button onClick={()=>onAction("remove_qc",row.sampleId)} style={{background:"#fee2e2",color:"#991b1b",border:"none",borderRadius:5,padding:"4px 6px",fontSize:12,fontWeight:700,cursor:"pointer"}}>✕</button>}
        </div>
        {/* Analyte toggle */}
        <div style={{padding:"0 4px",height:ROW_H,display:"flex",alignItems:"center"}}>
          {(!isQC||row.autoQC)&&rowAnalytes.length>0&&<span style={{fontSize:10,fontWeight:700,color:showAnalytes?"#3b82f6":"#94a3b8",background:showAnalytes?"#eff6ff":"#f1f5f9",border:"1px solid "+(showAnalytes?"#bfdbfe":"#e2e8f0"),borderRadius:10,padding:"1px 6px"}}>{rowAnalytes.length}</span>}
        </div>
      </div>
      {showAnalyteBar&&(
        <div style={{display:"flex",alignItems:"center",borderLeft:"2px solid #e0f2fe",flexShrink:0}}>
          {rowAnalytes.map((a,i)=><div key={i} style={{width:ANALYTE_COL_W,height:ROW_H,display:"flex",alignItems:"center",padding:"0 10px",borderRight:"1px solid #f1f5f9",background:i%2===0?"#f8fbff":"#f0f7ff",flexShrink:0}}><AnalyteCell analyte={a}/></div>)}
        </div>
      )}
    </div>
  );
});

function ChemVirtualGrid({rows,selected,onToggle,onAction,showAnalytes,onReorder}){
  const outerRef=useRef();
  const [scrollTop,setScrollTop]=useState(0);
  const [viewH,setViewH]=useState(500);
  const [draggedIds,setDraggedIds]=useState(new Set());
  const [dragOverId,setDragOverId]=useState(null);
  const dragRef=useRef(new Set());
  useEffect(()=>{
    const el=outerRef.current; if(!el) return;
    setViewH(el.clientHeight);
    const ro=new ResizeObserver(()=>setViewH(el.clientHeight)); ro.observe(el);
    return ()=>ro.disconnect();
  },[]);
  const si=Math.max(0,Math.floor(scrollTop/ROW_H)-OVERSCAN);
  const ei=Math.min(rows.length,Math.ceil((scrollTop+viewH)/ROW_H)+OVERSCAN);
  function onDS(e,id){ const dragSet=selected.has(id)&&selected.size>1?new Set([...selected].filter(sid=>{const r=rows.find(r=>r.sampleId===sid);return r&&!r.qcType;})):new Set([id]); if(!dragSet.size){e.preventDefault();return;} e.dataTransfer.effectAllowed="move"; e.dataTransfer.setData("text/plain",[...dragSet].join(",")); dragRef.current=dragSet; setDraggedIds(dragSet); }
  function onDO(e,id){ e.preventDefault(); if(!dragRef.current.has(id)) setDragOverId(id); }
  function onDr(e,id){ e.preventDefault(); const ids=e.dataTransfer.getData("text/plain").split(","); if(ids.length&&!ids.includes(id)) onReorder(ids,id); dragRef.current=new Set(); setDraggedIds(new Set()); setDragOverId(null); }
  function onDE(){ dragRef.current=new Set(); setDraggedIds(new Set()); setDragOverId(null); }
  return (
    <div ref={outerRef} style={{flex:1,overflow:"auto"}} onScroll={e=>setScrollTop(e.currentTarget.scrollTop)}>
      <div style={{position:"relative",height:rows.length*ROW_H,minWidth:"100%"}}>
        <div style={{position:"absolute",top:si*ROW_H,left:0,right:0}}>
          {rows.slice(si,ei).map(row=>(
            <ChemSampleRow key={row.sampleId} row={row} isSelected={selected.has(row.sampleId)}
              onToggle={onToggle} onAction={onAction} showAnalytes={showAnalytes}
              isDragOver={dragOverId===row.sampleId} isDragging={draggedIds.has(row.sampleId)}
              onDragStart={e=>onDS(e,row.sampleId)} onDragOver={e=>onDO(e,row.sampleId)}
              onDrop={e=>onDr(e,row.sampleId)} onDragEnd={onDE}/>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App(){
  const [lab,setLab]=useState(LABS[0]);
  const [labOpen,setLabOpen]=useState(false);
  const [labChanging,setLabChanging]=useState(false);
  const [sections,setSectionsRaw]=useState(buildAllSections);
  const historyRef=useRef([]); const [historyLen,setHistoryLen]=useState(0);
  const MAX_HISTORY=50;

  function setSections(updater){ setSectionsRaw(prev=>{ const next=typeof updater==="function"?updater(prev):updater; if(next!==prev){historyRef.current=[...historyRef.current.slice(-MAX_HISTORY),prev];setHistoryLen(historyRef.current.length);} return next; }); }
  function undo(){ if(!historyRef.current.length) return; const prev=historyRef.current[historyRef.current.length-1]; historyRef.current=historyRef.current.slice(0,-1); setHistoryLen(historyRef.current.length); setSectionsRaw(prev); }
  useEffect(()=>{ function onKey(e){if((e.ctrlKey||e.metaKey)&&e.key==="z"&&!e.shiftKey){e.preventDefault();undo();}} window.addEventListener("keydown",onKey); return ()=>window.removeEventListener("keydown",onKey); },[]);

  const [expandedSec,setExpandedSec]=useState({});
  const [expandedCat,setExpandedCat]=useState({});
  const [activeKey,setActiveKey]=useState(null);
  const [auditLog,setAuditLog]=useState({});
  const [globalSessionEq,setGlobalSessionEq]=useState(EMPTY_SESSION_EQ);
  const [globalEquipModal,setGlobalEquipModal]=useState(false);

  const globalEqSummary=useMemo(()=>{ const p=[]; if(globalSessionEq.balanceId)p.push(globalSessionEq.balanceId); if(globalSessionEq.edpId)p.push(globalSessionEq.edpId); if(globalSessionEq.filterPaperId)p.push(globalSessionEq.filterPaperId); if(globalSessionEq.heatingBlockId)p.push(globalSessionEq.heatingBlockId); return p; },[globalSessionEq]);

  const activeSection=activeKey?sections.find(s=>s.id===activeKey.secId):null;
  const activeCategory=activeSection?activeSection.categories.find(c=>c.id===activeKey.catId):null;
  const activeStep=activeCategory?activeCategory.steps.find(s=>s.id===activeKey.stepId):null;

  function toggleStepQcEligible(secId,catId,stId){
    setSections(prev=>prev.map(sec=>{ if(sec.id!==secId) return sec; return {...sec,categories:sec.categories.map(cat=>{ if(cat.id!==catId) return cat; return {...cat,steps:cat.steps.map(st=>{ if(st.id!==stId) return st; const turningOff=st.qcEligible; const newSamples=turningOff?st.samples.filter(s=>!(s.isQC&&s.autoQC)):st.samples; return {...st,qcEligible:!st.qcEligible,samples:newSamples}; })}; })}; }));
  }
  function openStep(secId,catId,stepId){ setActiveKey({secId,catId,stepId}); }
  function goHome(){ setActiveKey(null); }
  function handleLabChange(l){ setLabChanging(true); setTimeout(()=>{ setLab(l);setLabOpen(false);setSectionsRaw(buildAllSections());historyRef.current=[];setHistoryLen(0);setActiveKey(null);setExpandedSec({});setExpandedCat({});setLabChanging(false); },400); }

  const sectionStats=useMemo(()=>{ const stats={}; sections.forEach(sec=>sec.categories.forEach(cat=>cat.steps.forEach(st=>{ st.samples.forEach(s=>{ if(!s.isQC){ if(!stats[sec.id])stats[sec.id]={total:0,pending:0}; stats[sec.id].total++; const status=s.status||(s.analytes&&s.analytes[0]?s.analytes[0].status:"Pending"); if(status==="Pending")stats[sec.id].pending++; } }); }))); return stats; },[sections]);

  const idleScreen=(
    <div style={{flex:1,overflowY:"auto",padding:"32px 28px"}}>
      <div style={{fontSize:20,fontWeight:800,color:NAV,marginBottom:4}}>👋 Bem-vindo, Maria</div>
      <div style={{fontSize:13,color:"#64748b",marginBottom:20}}>Select a section and step from the left panel to begin.</div>
      <div style={{background:"#ede9fe",border:"2px solid #c4b5fd",borderRadius:12,padding:"14px 18px",marginBottom:20}}>
        <div style={{fontWeight:800,fontSize:13,color:"#7c3aed",marginBottom:6}}>🧪 AQC Rule Summary</div>
        <div style={{fontSize:12,color:"#4c1d95",lineHeight:1.6}}>
          • AQC sets: <strong>1 LCS + 1 MB</strong> per set<br/>
          • 1 set per <strong>{AQC_BATCH_SIZE} samples</strong> (remainder also gets a set)<br/>
          • Default AQC step: <strong>Acidification</strong> — toggle any step using the sidebar switch<br/>
          • AQC sets travel with samples through <strong>all subsequent steps</strong><br/>
          • Samples cannot be confirmed until all required sets are present
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16,marginBottom:24}}>
        {sections.map(sec=>{ const st=sectionStats[sec.id]||{total:0,pending:0}; const pct=st.total>0?Math.round((st.total-st.pending)/st.total*100):0; return (
          <div key={sec.id} style={{background:"#fff",borderRadius:14,border:"2px solid #7c3aed33",padding:20,boxShadow:"0 2px 8px #0001"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <div style={{width:40,height:40,borderRadius:10,background:"#ede9fe",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🧪</div>
              <div><div style={{fontWeight:800,fontSize:14,color:NAV}}>{sec.name}</div><div style={{fontSize:11,color:"#64748b"}}>{sec.categories.length} categor{sec.categories.length===1?"y":"ies"}</div></div>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <span style={{fontSize:11,background:"#fef3c7",color:"#b45309",borderRadius:4,padding:"2px 8px",fontWeight:700}}>⏳ {st.pending} pending</span>
              <span style={{fontSize:11,background:"#d1fae5",color:"#065f46",borderRadius:4,padding:"2px 8px",fontWeight:700}}>✔ {st.total-st.pending} done</span>
            </div>
            <div style={{height:6,background:"#e2e8f0",borderRadius:3,overflow:"hidden"}}><div style={{width:pct+"%",height:"100%",background:"#7c3aed",borderRadius:3}}/></div>
            <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,marginTop:4}}>{pct}% processed</div>
          </div>
        ); })}
      </div>
      <div style={{background:"#f0fdfa",border:"1.5px solid #99f6e4",borderRadius:12,padding:"14px 18px"}}>
        <div style={{fontWeight:700,fontSize:13,color:"#0d9488",marginBottom:6}}>🗂 Sample Tray Codes — try scanning these</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {Object.keys(MOCK_TRAY_DB).slice(0,6).map(code=><span key={code} style={{background:"#ccfbf1",color:"#0f766e",border:"1px solid #5eead4",borderRadius:6,padding:"4px 10px",fontSize:12,fontWeight:700,fontFamily:"monospace"}}>{code}</span>)}
          <span style={{fontSize:11,color:"#94a3b8",alignSelf:"center"}}>+{Math.max(0,Object.keys(MOCK_TRAY_DB).length-6)} more…</span>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{fontFamily:"'Inter',sans-serif",background:"#f1f5f9",height:"100vh",display:"flex",flexDirection:"column",fontSize:14}}>
      {globalEquipModal&&<EquipmentModal initial={globalSessionEq} onSave={eq=>{setGlobalSessionEq(eq);setGlobalEquipModal(false);}} onCancel={()=>setGlobalEquipModal(false)}/>}
      <style>{`@keyframes spin{to{transform:translateY(-50%) rotate(360deg);}}`}</style>
      <div style={{background:"linear-gradient(90deg,#7c3aed,#6d28d9)",color:"#fff",padding:"4px 20px",display:"flex",alignItems:"center",gap:10,flexShrink:0,fontSize:11,fontWeight:600}}>
        <span style={{background:"#ffffff25",border:"1px solid #ffffff40",borderRadius:4,padding:"1px 7px",fontSize:10,fontWeight:800,textTransform:"uppercase"}}>UAT</span>
        <span style={{opacity:.85}}>EnviroLab — Chemistry Work-Step System · Simulated data</span>
        <span style={{marginLeft:"auto",opacity:.55,fontSize:10}}>v2.1 · 18 Mar 2026</span>
      </div>
      {labChanging&&<div style={{position:"fixed",inset:0,background:"#1e3a5fee",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{color:"#fff",fontSize:15,fontWeight:700}}>A mudar de laboratório…</div></div>}
      <div style={{background:NAV,color:"#fff",padding:"0 20px",height:52,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,zIndex:20}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <FixedTooltip tip="Home"><button onClick={goHome} style={{background:"#ffffff18",border:"1px solid #ffffff30",borderRadius:7,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:"#fff"}}>⌂</button></FixedTooltip>
          <span style={{fontWeight:800,fontSize:16}}>🔬 EnviroLab</span>
          <span style={{opacity:.3,fontSize:20}}>│</span>
          <span style={{fontSize:13,opacity:.75}}>Chemistry Work-Step System</span>
          <span style={{fontSize:10,background:"#7c3aed",color:"#fff",borderRadius:4,padding:"2px 7px",fontWeight:800,border:"1px solid #a78bfa"}}>UAT</span>
          {activeKey&&<><span style={{opacity:.3}}>›</span><span style={{fontSize:11,background:"#ede9fe",color:"#7c3aed",borderRadius:4,padding:"1px 7px",fontWeight:700}}>🧪 Chemistry</span><span style={{opacity:.3}}>›</span><span style={{fontSize:12,opacity:.75}}>{activeSection?activeSection.name:""}</span><span style={{opacity:.3}}>›</span><span style={{fontSize:12,color:"#93c5fd",fontWeight:600}}>{activeStep?activeStep.name:""}</span></>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {historyLen>0&&<FixedTooltip tip="Undo (Ctrl+Z)"><button onClick={undo} style={{background:"#ffffff18",border:"1px solid #ffffff30",borderRadius:7,padding:"5px 10px",color:"#fff",fontSize:12,cursor:"pointer"}}>↩ Undo ({historyLen})</button></FixedTooltip>}
          <div style={{position:"relative"}}>
            <button onClick={()=>setLabOpen(o=>!o)} style={{background:"#ffffff18",border:"1px solid #ffffff30",borderRadius:7,padding:"5px 12px",color:"#fff",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:7}}>🏢 {lab} <span style={{opacity:.5,fontSize:11}}>▾</span></button>
            {labOpen&&<div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,boxShadow:"0 6px 24px #0003",zIndex:100,minWidth:150,overflow:"hidden"}}>
              {LABS.map(l=><div key={l} onClick={()=>{setLabOpen(false);if(l!==lab)handleLabChange(l);}} style={{padding:"10px 16px",fontSize:13,color:l===lab?NAV:"#334155",fontWeight:l===lab?700:400,background:l===lab?"#eff6ff":"#fff",cursor:l===lab?"default":"pointer"}}>{(l===lab?"✔ ":"")+l}</div>)}
            </div>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <div style={{width:30,height:30,borderRadius:"50%",background:"#3b82f6",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12}}>MA</div>
            <div><div style={{fontWeight:600,fontSize:12}}>Maria Alves</div><div style={{fontSize:10,opacity:.55}}>Lab Analyst</div></div>
            <button onClick={()=>setGlobalEquipModal(true)} style={{display:"flex",alignItems:"center",gap:5,background:globalEqSummary.length>0?"#334155":"#ffffff18",color:"#fff",border:"1px solid "+(globalEqSummary.length>0?"#475569":"#ffffff30"),borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer",marginLeft:4}}>
              🔧{globalEqSummary.length>0&&<span style={{background:"#3b82f6",color:"#fff",borderRadius:10,padding:"0 6px",fontSize:9,fontWeight:800}}>{globalEqSummary.length}</span>}
            </button>
          </div>
        </div>
      </div>
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        <div style={{width:272,background:"#fff",borderRight:"1px solid #e2e8f0",overflowY:"auto",flexShrink:0,display:"flex",flexDirection:"column"}}>
          <div style={{padding:"10px 14px 6px",borderBottom:"1px solid #f1f5f9",flexShrink:0}}>
            <div style={{fontSize:10,fontWeight:800,color:"#7c3aed",textTransform:"uppercase",letterSpacing:".08em",display:"flex",alignItems:"center",gap:6}}><span>🧪</span> Chemistry Sections</div>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:3}}>Toggle AQC switch on any step</div>
          </div>
          <div style={{flex:1,overflowY:"auto"}}>
            {sections.map(sec=>(
              <div key={sec.id}>
                <div onClick={()=>setExpandedSec(p=>({...p,[sec.id]:!p[sec.id]}))} style={{padding:"8px 14px",fontSize:12,fontWeight:700,color:"#334155",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid #f1f5f9",userSelect:"none"}}>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sec.name}</span>
                  <span style={{opacity:.4,flexShrink:0}}>{expandedSec[sec.id]?"▾":"▸"}</span>
                </div>
                {expandedSec[sec.id]&&sec.categories.map(cat=>(
                  <div key={cat.id}>
                    <div onClick={()=>setExpandedCat(p=>({...p,[cat.id]:!p[cat.id]}))} style={{padding:"6px 14px 6px 22px",fontSize:11,fontWeight:700,color:NAV,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#f8fafc",userSelect:"none"}}>
                      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat.name}</span>
                      <span style={{opacity:.4,fontSize:11,flexShrink:0}}>{expandedCat[cat.id]?"▾":"▸"}</span>
                    </div>
                    {expandedCat[cat.id]&&cat.steps.map((st,stIdx)=>{
                      const isActive=activeKey&&activeKey.secId===sec.id&&activeKey.catId===cat.id&&activeKey.stepId===st.id;
                      const cnt=st.samples.filter(s=>!s.isQC).length;
                      const qcIn=st.samples.filter(s=>s.isQC).length;
                      return (
                        <div key={st.id+cat.id} style={{display:"flex",alignItems:"center",padding:"4px 6px 4px 28px",margin:"1px 6px",borderRadius:6,background:isActive?NAV:"transparent",cursor:"pointer"}} onClick={()=>openStep(sec.id,cat.id,st.id)}>
                          <span style={{fontSize:13,marginRight:4}}>⚗</span>
                          <span style={{fontSize:11,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:isActive?"#fff":"#64748b"}}><span style={{opacity:.5,marginRight:3}}>{stIdx+1}.</span>{st.name}</span>
                          <div style={{display:"flex",gap:3,alignItems:"center",flexShrink:0}}>
                            <span style={{background:isActive?"#ffffff25":"#e2e8f0",color:isActive?"#fff":"#64748b",borderRadius:10,padding:"1px 6px",fontSize:10,fontWeight:700}}>{cnt}</span>
                            {qcIn>0&&<span style={{background:isActive?"#ffffff20":"#e0f2fe",color:isActive?"#fff":"#0891b2",borderRadius:10,padding:"1px 5px",fontSize:9,fontWeight:700}}>🧪{qcIn}</span>}
                            <AQCToggleSwitch enabled={st.qcEligible} isActive={!!isActive} stepName={st.name} onToggle={()=>toggleStepQcEligible(sec.id,cat.id,st.id)}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {!activeKey&&idleScreen}
          {activeKey&&<ChemStepView key={activeKey.secId+"||"+activeKey.catId+"||"+activeKey.stepId} activeKey={activeKey} sections={sections} setSections={setSections} auditLog={auditLog} setAuditLog={setAuditLog} sessionEq={globalSessionEq}/>}
        </div>
      </div>
    </div>
  );
}
