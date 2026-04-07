import { useState, useRef, useMemo, useEffect, memo } from "react";

const LABS = ["Porto","Tondela","Coimbra","Braga","Évora"];
const NAV = "#1e3a5f";
const ROW_H = 48;
const OVERSCAN = 5;
const CURRENT_USER = { name:"Maria Alves", initials:"MA" };
const TRAY_PREFIX = "TRY-";
const BLANK_INTERVAL = 5;
const BATCH_TIMER_MS = 2 * 60 * 60 * 1000;
const TODAY = new Date("2026-03-18");
const GRID_COLS = "18px 32px 72px 110px 90px 150px 100px 80px 100px 90px 80px";

const TEST_TYPES = {
  "E. coli":                 { incubationH:48, color:"#dc2626", bg:"#fee2e2" },
  "Total Coliforms":         { incubationH:24, color:"#b45309", bg:"#fef3c7" },
  "Enterococci":             { incubationH:48, color:"#7c3aed", bg:"#ede9fe" },
  "Pseudomonas aeruginosa":  { incubationH:48, color:"#0891b2", bg:"#e0f2fe" },
  "Legionella":              { incubationH:48, color:"#059669", bg:"#d1fae5" },
  "Clostridium perfringens": { incubationH:44, color:"#6366f1", bg:"#eef2ff" },
  "Intestinal Enterococci":  { incubationH:48, color:"#db2777", bg:"#fce7f3" },
};
const ALL_TESTS = Object.keys(TEST_TYPES);
const METHODS = {
  "ISO 9308-1":{ full:"E. coli & coliforms — membrane filtration" },
  "ISO 7899-2":{ full:"Intestinal enterococci — membrane filtration" },
  "ISO 11731": { full:"Legionella — culture method" },
  "EPA 1600":  { full:"Enterococci — membrane filter" },
  "ISO 14189": { full:"Clostridium perfringens — membrane filtration" },
  "APHA 9215": { full:"Heterotrophic plate count" },
  "ISO 16266": { full:"Pseudomonas aeruginosa — membrane filtration" },
};
const ALL_METHODS = Object.keys(METHODS);
const TEST_METHODS = {
  "E. coli":                ["ISO 9308-1","APHA 9215"],
  "Total Coliforms":        ["ISO 9308-1","APHA 9215"],
  "Enterococci":            ["ISO 7899-2","EPA 1600"],
  "Pseudomonas aeruginosa": ["ISO 16266"],
  "Legionella":             ["ISO 11731"],
  "Clostridium perfringens":["ISO 14189"],
  "Intestinal Enterococci": ["ISO 7899-2","EPA 1600"],
};
const MATRICES   = ["Drinking Water","Swimming Pool","Wastewater","Surface Water","Groundwater"];
const MANIFOLDS  = ["MF-01","MF-02","MF-03","MF-04"];
const PIPETTES   = ["PIP-100µl-A","PIP-100µl-B","PIP-1ml-A","PIP-1ml-B","PIP-10ml-A"];
const INCUBATORS = ["INC-01 (35°C)","INC-02 (35°C)","INC-03 (44.5°C)","INC-04 (37°C)","INC-05 (44.5°C)"];
const QC_TYPES = {
  BLANK:    { label:"Method Blank",                 color:"#0891b2", bg:"#e0f2fe", icon:"⬜" },
  MEDIA_CH: { label:"Media Change Blank",           color:"#7c3aed", bg:"#ede9fe", icon:"🔄" },
  POS_ENUM: { label:"Positive Enumerative Control", color:"#059669", bg:"#d1fae5", icon:"➕" },
  POS_STK:  { label:"Positive Streak Control",      color:"#b45309", bg:"#fef3c7", icon:"🔬" },
  NEG_STK:  { label:"Negative Streak Control",      color:"#94a3b8", bg:"#f1f5f9", icon:"➖" },
};
const STATUS_META = {
  Pending:   { color:"#f59e0b", bg:"#fef3c7", icon:"⏳" },
  Confirmed: { color:"#10b981", bg:"#d1fae5", icon:"✔"  },
  Skipped:   { color:"#94a3b8", bg:"#f1f5f9", icon:"⏭"  },
  Reopened:  { color:"#ef4444", bg:"#fee2e2", icon:"↺"  },
};
const DUE_OUT_META = {
  "Ready":    { color:"#10b981", bg:"#d1fae5", icon:"✅" },
  "Not Ready":{ color:"#f59e0b", bg:"#fef3c7", icon:"⏳" },
  "Overdue":  { color:"#dc2626", bg:"#fee2e2", icon:"🔴" },
};
const AUDIT_META = {
  confirmed: { icon:"✔",  color:"#10b981", bg:"#d1fae5", label:"Confirmed"    },
  skipped:   { icon:"⏭",  color:"#94a3b8", bg:"#f1f5f9", label:"Skipped"      },
  reopened:  { icon:"↺",  color:"#ef4444", bg:"#fee2e2", label:"Reopened"     },
  qc_removed:{ icon:"🗑",  color:"#ef4444", bg:"#fee2e2", label:"QC Removed"   },
  qc_added:  { icon:"🧪",  color:"#0891b2", bg:"#e0f2fe", label:"QC Added"     },
  incubation:{ icon:"🌡",  color:"#f59e0b", bg:"#fef3c7", label:"Incubation"   },
  timer_done:{ icon:"⏰",  color:"#6366f1", bg:"#eef2ff", label:"2h Prompt"    },
  media_chg: { icon:"🔄",  color:"#7c3aed", bg:"#ede9fe", label:"Media Change" },
  comment:   { icon:"💬",  color:"#0891b2", bg:"#e0f2fe", label:"Comment"      },
};
const STEP_ICONS = { processing:"🧫", incubation:"🌡", postincub:"📋" };

function uid()  { return Math.random().toString(36).slice(2,9); }
function rnd(a) { return a[Math.floor(Math.random()*a.length)]; }
function fmt(d) { return d.toISOString().split("T")[0]; }
function addD(d,n) { const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function nowStr() {
  const d=new Date();
  return d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})+" · "+d.toLocaleDateString("en-GB",{day:"2-digit",month:"short"});
}
function fmtDT(d) {
  if (!d) return "—";
  const dt=typeof d==="string"?new Date(d):d;
  return dt.toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
}
function fmtDate(d) {
  if (!d) return "—";
  const dt=typeof d==="string"?new Date(d):d;
  return dt.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
}
function expiryStatus(s) {
  if (!s||s.length<8) return null;
  const exp=new Date(s); if(isNaN(exp.getTime())) return null;
  const diff=Math.ceil((exp-TODAY)/86400000);
  return diff<0?"expired":diff<=7?"soon":"ok";
}
// Due status for a sample given its dueDate
function dueDateStatus(dueDate) {
  if (!dueDate) return null;
  const due=new Date(dueDate);
  const diff=Math.ceil((due-TODAY)/86400000);
  if (diff<0)  return "overdue";
  if (diff===0)return "today";
  if (diff<=2) return "soon";
  return "ok";
}

function ExpiryHint({value}) {
  const w=expiryStatus(value);
  if (!w||w==="ok") return null;
  return <div style={{fontSize:11,color:w==="expired"?"#ef4444":"#f59e0b",marginTop:3,fontWeight:700}}>{w==="expired"?"⛔ Batch EXPIRED":"⚠ Expiring within 7 days"}</div>;
}

function genAnalytes() {
  const n=1+Math.floor(Math.random()*3);
  return [...ALL_TESTS].sort(()=>Math.random()-.5).slice(0,n).map(t=>({
    id:uid(), name:t, method:rnd(TEST_METHODS[t]||ALL_METHODS), status:"Pending",
  }));
}
function computeBlanks(realRows,mediaBatch) {
  const byTest={};
  realRows.forEach(r=>{ if(!byTest[r.testType]) byTest[r.testType]=0; byTest[r.testType]++; });
  const blanks=[];
  Object.keys(byTest).forEach(test=>{
    const n=Math.ceil(byTest[test]/BLANK_INTERVAL);
    for (let i=0;i<n;i++) blanks.push({
      _id:uid(),
      id:"BLK-"+test.replace(/ /g,"").slice(0,5).toUpperCase()+"-"+String(i+1).padStart(2,"0"),
      isQC:true,qcType:"BLANK",testType:test,matrix:"Blank",
      status:"Pending",dueDate:"",trayCode:null,mediaBatch:mediaBatch||"",
      incubationStart:null,incubationEnd:null,history:[],linkedSampleIds:[],
      analytes:[{id:uid(),name:test,method:rnd(TEST_METHODS[test]||ALL_METHODS),status:"Pending"}],
      qcReason:"Auto: 1 blank per "+BLANK_INTERVAL+" "+test+" (batch "+(i*BLANK_INTERVAL+1)+"–"+Math.min((i+1)*BLANK_INTERVAL,byTest[test])+")",
    });
  });
  return blanks;
}
function insertBlanks(samples) {
  const byTest={};
  samples.forEach(s=>{ if(!byTest[s.testType]) byTest[s.testType]=[]; byTest[s.testType].push(s); });
  const result=[];
  Object.keys(byTest).forEach(test=>{
    byTest[test].forEach((s,i)=>{
      result.push(s);
      if ((i+1)%BLANK_INTERVAL===0) {
        const batch=byTest[test].slice(Math.max(0,i-BLANK_INTERVAL+1),i+1);
        result.push({
          _id:uid(),
          id:"BLK-"+test.replace(/ /g,"").slice(0,5).toUpperCase()+"-"+String(Math.floor(i/BLANK_INTERVAL)+1).padStart(2,"0"),
          isQC:true,qcType:"BLANK",testType:test,matrix:"Blank",
          status:"Pending",dueDate:"",trayCode:null,mediaBatch:"",
          incubationStart:null,incubationEnd:null,history:[],
          linkedSampleIds:batch.map(b=>b.id),
          analytes:[{id:uid(),name:test,method:rnd(TEST_METHODS[test]||ALL_METHODS),status:"Pending"}],
          qcReason:"Auto: 1 blank per "+BLANK_INTERVAL+" "+test,
        });
      }
    });
  });
  return result;
}
let MOCK_TRAY_DB={};
function mockTrayLookup(code) {
  return new Promise((res,rej)=>{
    setTimeout(()=>{
      if (Math.random()<0.07){rej(new Error("Tray service unavailable."));return;}
      const e=MOCK_TRAY_DB[code];
      if (!e){rej(new Error("Tray not found: "+code));return;}
      res({trayCode:code,samples:e.samples,totalInTray:e.samples.length});
    },300+Math.random()*300);
  });
}
function genSamples(prefix,n) {
  return Array.from({length:n},(_,i)=>{
    const analytes=genAnalytes();
    return {
      _id:uid(),id:prefix+"-"+String(i+1).padStart(3,"0"),
      isQC:false,qcType:null,matrix:rnd(MATRICES),
      testType:analytes[0].name,analytes,
      status:"Pending",
      dueDate:fmt(addD(TODAY,Math.floor(Math.random()*6)-1)),
      trayCode:null,mediaBatch:null,
      incubationStart:null,incubationEnd:null,history:[],linkedSampleIds:[],
    };
  });
}
function buildSections() {
  const filtS=genSamples("FILT",18),cgS=genSamples("CG",12);
  const secs=[
    {id:"filt",name:"Filtration",categories:[{id:"filt-cat",name:"Microbiology – Filtration",steps:[
      {id:"proc", name:"Processing (Pre-incubation)",stepType:"processing",samples:insertBlanks(filtS.slice()),mediaBatch:null,mediaExpiry:null},
      {id:"incub",name:"Incubation Handling",        stepType:"incubation",samples:[],mediaBatch:null,mediaExpiry:null},
      {id:"post", name:"Post-Incubation",            stepType:"postincub", samples:[],mediaBatch:null,mediaExpiry:null},
    ]}]},
    {id:"cg",name:"Crypto & Giardia",categories:[{id:"cg-cat",name:"Microbiology – Crypto & Giardia",steps:[
      {id:"proc", name:"Processing (Pre-incubation)",stepType:"processing",samples:insertBlanks(cgS.slice()),mediaBatch:null,mediaExpiry:null},
      {id:"incub",name:"Incubation Handling",        stepType:"incubation",samples:[],mediaBatch:null,mediaExpiry:null},
      {id:"post", name:"Post-Incubation",            stepType:"postincub", samples:[],mediaBatch:null,mediaExpiry:null},
    ]}]},
  ];
  MOCK_TRAY_DB={};
  let tc=1;
  secs.forEach(sec=>sec.categories.forEach(cat=>cat.steps.forEach(st=>{
    const ids=st.samples.filter(s=>!s.isQC).map(s=>s.id);
    for (let i=0;i<ids.length;i+=4){
      const code=TRAY_PREFIX+String(tc++).padStart(4,"0");
      const chunk=ids.slice(i,i+4);
      MOCK_TRAY_DB[code]={samples:chunk};
      chunk.forEach(sid=>{const s=st.samples.find(x=>x.id===sid);if(s)s.trayCode=code;});
    }
  })));
  return secs;
}
function findSampleStep(sections,sampleId) {
  for (const sec of sections) for (const cat of sec.categories) for (const st of cat.steps) {
    if (st.samples.some(s=>s.id===sampleId)) return {secId:sec.id,catId:cat.id,stepId:st.id};
  }
  return null;
}
function findTrayStep(sections,trayCode) {
  for (const sec of sections) for (const cat of sec.categories) for (const st of cat.steps) {
    if (st.samples.some(s=>s.trayCode===trayCode)) return {secId:sec.id,catId:cat.id,stepId:st.id,trayCode};
  }
  return null;
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function Tip({children,tip}) {
  const ref=useRef(); const [pos,setPos]=useState(null);
  return (
    <div ref={ref} style={{display:"inline-block"}}
      onMouseEnter={()=>{if(ref.current){const r=ref.current.getBoundingClientRect();setPos({top:r.top,left:r.left+r.width/2});}}}
      onMouseLeave={()=>setPos(null)}>
      {children}
      {pos&&<div style={{position:"fixed",zIndex:9999,pointerEvents:"none",top:pos.top-8,left:pos.left,transform:"translate(-50%,-100%)",background:"#1e293b",color:"#fff",borderRadius:7,padding:"5px 10px",fontSize:11,whiteSpace:"nowrap",boxShadow:"0 4px 16px #0004"}}>
        {tip}<div style={{position:"absolute",bottom:-4,left:"50%",transform:"translateX(-50%)",width:8,height:8,background:"#1e293b",rotate:"45deg"}}/>
      </div>}
    </div>
  );
}
function FilterDropdown({options,selected,onChange,onClear}) {
  return (
    <div style={{position:"absolute",top:"100%",left:0,zIndex:300,background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,boxShadow:"0 6px 24px #0003",minWidth:170,padding:"6px 0"}} onClick={e=>e.stopPropagation()}>
      <div style={{padding:"4px 10px 6px",fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",borderBottom:"1px solid #f1f5f9",marginBottom:4}}>Filter</div>
      <div style={{maxHeight:200,overflowY:"auto"}}>
        {options.map(opt=>(
          <label key={opt} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 12px",fontSize:12,color:"#334155",cursor:"pointer"}}>
            <input type="checkbox" checked={selected.includes(opt)} onChange={()=>onChange(opt)} style={{accentColor:NAV}}/>{opt}
          </label>
        ))}
      </div>
      <div style={{borderTop:"1px solid #f1f5f9",marginTop:4,padding:"5px 12px"}}>
        <button onClick={onClear} style={{fontSize:11,color:"#94a3b8",background:"none",border:"none",cursor:"pointer",padding:0}}>Clear all</button>
      </div>
    </div>
  );
}
function ColHeader({label,sortKey,filterKey,sort,setSort,filters,setFilters,filterOptions}) {
  const [open,setOpen]=useState(false);
  const active=filterKey?(filters[filterKey]||[]):[];
  const isSorted=sort.key===sortKey;
  return (
    <div style={{position:"relative",padding:"0 8px",height:38,fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:".04em",display:"flex",alignItems:"center",background:"#f8fafc",borderBottom:"2px solid #e2e8f0",userSelect:"none",gap:3}}>
      {sortKey
        ?<span style={{cursor:"pointer",flex:1}} onClick={()=>{setSort(p=>p.key===sortKey?(p.dir==="asc"?{key:sortKey,dir:"desc"}:{key:null,dir:null}):{key:sortKey,dir:"asc"});setOpen(false);}}>
          {label}{isSorted&&<span style={{marginLeft:2}}>{sort.dir==="asc"?"↑":"↓"}</span>}{!isSorted&&<span style={{opacity:.2,marginLeft:2}}>⇅</span>}
        </span>
        :<span style={{flex:1}}>{label}</span>}
      {filterKey&&filterOptions&&(
        <span onClick={e=>{e.stopPropagation();setOpen(o=>!o);}} style={{cursor:"pointer",fontSize:12,color:active.length>0?NAV:"#cbd5e1"}}>
          {active.length>0?"⧩":"⧨"}
          {active.length>0&&<sup style={{fontSize:9,fontWeight:800,color:NAV}}>{active.length}</sup>}
        </span>
      )}
      {open&&filterKey&&filterOptions&&(
        <FilterDropdown options={filterOptions} selected={active}
          onChange={v=>setFilters(p=>{const cur=p[filterKey]||[];return{...p,[filterKey]:cur.includes(v)?cur.filter(x=>x!==v):[...cur,v]};})}
          onClear={()=>{setFilters(p=>({...p,[filterKey]:[]}));setOpen(false);}}/>
      )}
    </div>
  );
}

// ── Badges ────────────────────────────────────────────────────────────────────
function TestBadge({t}) {
  const d=TEST_TYPES[t]||{color:"#64748b",bg:"#f1f5f9"};
  return <span style={{background:d.bg,color:d.color,border:"1px solid "+d.color+"44",borderRadius:4,padding:"1px 5px",fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{t}</span>;
}
function MethodBadge({m}) {
  return <Tip tip={METHODS[m]?METHODS[m].full:m}><span style={{background:"#f1f5f9",color:"#334155",border:"1px solid #e2e8f0",borderRadius:4,padding:"1px 5px",fontSize:10,fontWeight:700,whiteSpace:"nowrap",cursor:"default"}}>{m}</span></Tip>;
}
function StatusBadge({s}) {
  const m=STATUS_META[s]||STATUS_META.Pending;
  return <span style={{background:m.bg,color:m.color,border:"1px solid "+m.color+"44",borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{m.icon} {s}</span>;
}
function DueOutBadge({s}) {
  const m=DUE_OUT_META[s]||DUE_OUT_META["Not Ready"];
  return <span style={{background:m.bg,color:m.color,border:"1px solid "+m.color+"44",borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{m.icon} {s}</span>;
}
function DueBadge({dueDate}) {
  const ds=dueDateStatus(dueDate);
  if (!ds) return <span style={{fontSize:10,color:"#cbd5e1"}}>—</span>;
  const cfg={
    overdue:{ label:"Overdue",color:"#dc2626",bg:"#fee2e2",icon:"🔴" },
    today:  { label:"Due today",color:"#f59e0b",bg:"#fef3c7",icon:"⚠" },
    soon:   { label:"Due soon", color:"#f59e0b",bg:"#fffbeb",icon:"⏰" },
    ok:     { label:"On track", color:"#10b981",bg:"#d1fae5",icon:"✅" },
  }[ds];
  return (
    <Tip tip={"Due: "+fmtDate(dueDate)}>
      <span style={{background:cfg.bg,color:cfg.color,border:"1px solid "+cfg.color+"44",borderRadius:4,padding:"1px 5px",fontSize:10,fontWeight:700,whiteSpace:"nowrap",cursor:"default"}}>
        {cfg.icon} {cfg.label}
      </span>
    </Tip>
  );
}

// ── QC Failure Modal (enhanced) ───────────────────────────────────────────────
function QCFailureModal({qcRow,linkedSamples,onConfirm,onCancel}) {
  const [action,setAction]=useState("reopen");
  const [comment,setComment]=useState("");
  const ok=comment.trim();
  return (
    <div style={{position:"fixed",inset:0,background:"#00000077",zIndex:1300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onCancel}>
      <div style={{background:"#fff",borderRadius:14,maxWidth:500,width:"100%",boxShadow:"0 20px 60px #0005",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        <div style={{background:"linear-gradient(90deg,#7f1d1d,#dc2626)",padding:"14px 20px",display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:22}}>🚨</span>
          <div>
            <div style={{fontWeight:800,fontSize:15,color:"#fff"}}>QC Failure — {qcRow.id}</div>
            <div style={{fontSize:11,color:"#fca5a5"}}>{linkedSamples.length} linked sample{linkedSamples.length!==1?"s":""} affected</div>
          </div>
          <button onClick={onCancel} style={{marginLeft:"auto",background:"none",border:"none",color:"#fff",fontSize:18,cursor:"pointer",opacity:.7}}>✕</button>
        </div>
        <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:"#fff5f5",border:"1px solid #fca5a5",borderRadius:9,padding:"10px 14px"}}>
            <div style={{fontWeight:700,fontSize:12,color:"#991b1b",marginBottom:6}}>Linked samples</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {linkedSamples.map(s=>(
                <span key={s.id} style={{fontSize:11,fontWeight:600,color:NAV,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:5,padding:"2px 8px"}}>{s.id}</span>
              ))}
              {linkedSamples.length===0&&<span style={{fontSize:11,color:"#94a3b8"}}>No linked samples.</span>}
            </div>
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:12,color:"#334155",marginBottom:8}}>What should happen to these samples?</div>
            {[
              {val:"reopen",  label:"↺ Reopen samples",   desc:"Send all linked samples back to Processing for repeat",  color:"#dc2626"},
              {val:"nothing", label:"✓ Do nothing",        desc:"Keep samples at current status — analyst will handle manually", color:"#64748b"},
              {val:"comment", label:"💬 Record comment only",desc:"Flag the QC failure but let samples proceed with a note", color:"#0891b2"},
            ].map(opt=>(
              <label key={opt.val} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",border:"1.5px solid "+(action===opt.val?opt.color:"#e2e8f0"),borderRadius:9,cursor:"pointer",background:action===opt.val?"#fafafa":"#fff",marginBottom:6}}>
                <input type="radio" name="qcfail" checked={action===opt.val} onChange={()=>setAction(opt.val)} style={{accentColor:opt.color,marginTop:2}}/>
                <div>
                  <div style={{fontWeight:700,fontSize:12,color:opt.color}}>{opt.label}</div>
                  <div style={{fontSize:11,color:"#64748b",marginTop:1}}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:12,color:"#334155",marginBottom:5}}>Comment / Reason <span style={{color:"#ef4444"}}>*</span></div>
            <textarea value={comment} onChange={e=>setComment(e.target.value)} rows={3}
              placeholder="Describe what happened with this QC sample…"
              style={{width:"100%",boxSizing:"border-box",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"8px 10px",fontSize:12,resize:"vertical",outline:"none",fontFamily:"inherit",color:"#334155"}}/>
          </div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",padding:"10px 20px",borderTop:"1px solid #f1f5f9",background:"#fafafa"}}>
          <button onClick={onCancel} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:12,fontWeight:600,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>{if(ok)onConfirm(action,comment);}} disabled={!ok}
            style={{padding:"8px 20px",borderRadius:8,border:"none",background:ok?"#dc2626":"#fca5a5",color:"#fff",fontSize:12,fontWeight:700,cursor:ok?"pointer":"not-allowed"}}>
            🚨 Confirm Failure
          </button>
        </div>
      </div>
    </div>
  );
}

// ── QC Link Panel ─────────────────────────────────────────────────────────────
function QCLinkPanel({qcRow,allSamples,onClose,onOpenFailure}) {
  const q=QC_TYPES[qcRow.qcType]||{};
  const linked=allSamples.filter(s=>!s.isQC&&(qcRow.linkedSampleIds||[]).includes(s.id));
  return (
    <div style={{position:"fixed",inset:0,background:"#00000044",zIndex:900,display:"flex",alignItems:"flex-end",justifyContent:"flex-end",padding:16}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:14,width:380,maxHeight:"80vh",display:"flex",flexDirection:"column",boxShadow:"0 16px 48px #0005",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"12px 16px",background:q.bg||"#e0f2fe",borderBottom:"2px solid "+(q.color||"#0891b2")+"33",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:18}}>{q.icon}</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:13,color:q.color}}>{q.label}</div>
            <div style={{fontSize:11,color:q.color,opacity:.8}}>{qcRow.id}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:16,cursor:"pointer",color:q.color,opacity:.7}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{fontSize:11,color:"#64748b",fontWeight:600}}>{qcRow.qcReason}</div>
          <div>
            <div style={{fontWeight:800,fontSize:12,color:NAV,marginBottom:8}}>🔗 Linked Samples ({linked.length})</div>
            {linked.length===0
              ?<div style={{fontSize:12,color:"#94a3b8"}}>No linked samples recorded.</div>
              :<div style={{display:"flex",flexDirection:"column",gap:4}}>
                {linked.map(s=>(
                  <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,background:"#f8fafc",borderRadius:7,padding:"6px 10px",border:"1px solid #e2e8f0"}}>
                    <span style={{fontWeight:700,color:NAV,fontSize:12,minWidth:90}}>{s.id}</span>
                    <span style={{fontSize:11,color:"#64748b"}}>{s.matrix}</span>
                    <StatusBadge s={s.status}/>
                    {s.trayCode&&<span style={{fontSize:9,background:"#ccfbf1",color:"#0d9488",borderRadius:3,padding:"1px 5px",fontWeight:700,border:"1px solid #99f6e4"}}>{s.trayCode}</span>}
                  </div>
                ))}
              </div>}
          </div>
          {(qcRow.incubationStart||qcRow.incubationEnd)&&(
            <div style={{background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:9,padding:"10px 12px"}}>
              <div style={{fontWeight:700,fontSize:12,color:"#92400e",marginBottom:6}}>🌡 Incubation</div>
              <div style={{fontSize:12,color:"#64748b"}}>Start: <strong style={{color:"#334155"}}>{fmtDT(qcRow.incubationStart)}</strong></div>
              <div style={{fontSize:12,color:"#64748b",marginTop:3}}>End: <strong style={{color:"#334155"}}>{fmtDT(qcRow.incubationEnd)}</strong></div>
            </div>
          )}
          <div style={{background:"#fff5f5",border:"1.5px solid #fca5a5",borderRadius:9,padding:"10px 12px"}}>
            <div style={{fontWeight:700,fontSize:12,color:"#991b1b",marginBottom:8}}>⚠ QC Failure Action</div>
            <button onClick={()=>onOpenFailure(qcRow,linked)} style={{background:"#ef4444",color:"#fff",border:"none",borderRadius:7,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",width:"100%"}}>
              🚨 Flag QC Failure…
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sample Row ────────────────────────────────────────────────────────────────
const SampleRow = memo(function SampleRow({row,isSelected,onToggle,onAction,stepType,isDragOver,isDragging,onDragStart,onDragOver,onDrop,onDragEnd,onQCClick}) {
  const isQC=row.isQC;
  const qc=isQC?(QC_TYPES[row.qcType]||{}):null;
  const analytes=row.analytes||[];
  const innerH=Math.max(ROW_H,analytes.length*24+14);
  const bg=isDragging?"#f0f9ff":isQC?(qc.bg+"88"):"#fff";
  return (
    <div style={{display:"grid",gridTemplateColumns:GRID_COLS,borderTop:isDragOver?"2.5px solid #3b82f6":"1px solid #f1f5f9",background:bg,opacity:isDragging?.5:1,minHeight:innerH,alignItems:"start"}}
      draggable={!isQC} onDragStart={!isQC?onDragStart:undefined} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd}>
      {/* drag */}
      <div style={{paddingTop:15,display:"flex",justifyContent:"center",borderLeft:isQC?"3px solid "+(qc.color||"#0891b2"):"3px solid transparent",cursor:!isQC?"grab":"default",height:"100%"}}>
        {!isQC&&<span style={{fontSize:12,color:isDragging?"#6366f1":"#cbd5e1",userSelect:"none"}}>⠿</span>}
      </div>
      {/* checkbox */}
      <div style={{paddingTop:15,display:"flex",justifyContent:"center"}}>
        <input type="checkbox" checked={isSelected} onChange={()=>onToggle(row.id)} style={{accentColor:NAV,cursor:"pointer"}}/>
      </div>
      {/* tray */}
      <div style={{paddingTop:13,paddingLeft:4}}>
        {row.trayCode&&<span style={{fontSize:9,background:"#ccfbf1",color:"#0d9488",borderRadius:3,padding:"1px 5px",fontWeight:700,border:"1px solid #99f6e4"}}>{row.trayCode}</span>}
      </div>
      {/* id */}
      <div style={{paddingTop:12,paddingBottom:8,display:"flex",flexDirection:"column",gap:2,paddingLeft:6,paddingRight:4}}>
        <span style={{fontWeight:600,color:isQC?(qc.color||"#0891b2"):NAV,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.id}</span>
        {isQC&&<span onClick={onQCClick} style={{fontSize:9,background:qc.bg,color:qc.color,borderRadius:3,padding:"1px 4px",fontWeight:800,alignSelf:"flex-start",cursor:"pointer",textDecoration:"underline"}}>{qc.icon} {qc.label}{row.linkedSampleIds&&row.linkedSampleIds.length>0?" · "+row.linkedSampleIds.length+" linked":""}</span>}
        {row.status==="Reopened"&&<span style={{fontSize:9,background:"#fee2e2",color:"#ef4444",borderRadius:3,padding:"1px 4px",fontWeight:800,alignSelf:"flex-start"}}>↺ Reopened</span>}
      </div>
      {/* matrix */}
      <div style={{paddingTop:14,paddingLeft:6,fontSize:11,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.matrix}</div>
      {/* analyte */}
      <div style={{display:"flex",flexDirection:"column",paddingTop:8,paddingBottom:6,paddingLeft:6,gap:3}}>
        {analytes.length===0&&<span style={{fontSize:10,color:"#cbd5e1"}}>—</span>}
        {analytes.map(a=>{const td=TEST_TYPES[a.name]||{color:"#64748b",bg:"#f1f5f9"};return <span key={a.id} style={{fontSize:10,fontWeight:700,color:td.color,background:td.bg,border:"1px solid "+td.color+"44",borderRadius:4,padding:"1px 5px",whiteSpace:"nowrap",alignSelf:"flex-start"}}>{a.name}</span>;})}
      </div>
      {/* method */}
      <div style={{display:"flex",flexDirection:"column",paddingTop:8,paddingBottom:6,paddingLeft:4,gap:3}}>
        {analytes.length===0&&<span style={{fontSize:10,color:"#cbd5e1"}}>—</span>}
        {analytes.map(a=><MethodBadge key={a.id} m={a.method}/>)}
      </div>
      {/* due */}
      <div style={{paddingTop:12,paddingLeft:4}}>
        {isQC ? <span style={{fontSize:10,color:"#cbd5e1"}}>QC</span> : <DueBadge dueDate={row.dueDate}/>}
      </div>
      {/* status */}
      <div style={{paddingTop:12,paddingLeft:4}}>
        {stepType==="postincub"?<DueOutBadge s={row.dueOut||"Not Ready"}/>:<StatusBadge s={row.status}/>}
      </div>
      {/* media */}
      <div style={{paddingTop:14,paddingLeft:4,overflow:"hidden"}}>
        {row.mediaBatch&&<span style={{fontSize:10,background:"#f1f5f9",borderRadius:3,padding:"1px 5px",border:"1px solid #e2e8f0",fontWeight:600,whiteSpace:"nowrap",display:"block",overflow:"hidden",textOverflow:"ellipsis"}}>{row.mediaBatch}</span>}
      </div>
      {/* actions */}
      <div style={{paddingTop:10,paddingLeft:4,display:"flex",gap:2,flexShrink:0}}>
        {stepType!=="postincub"&&(
          isQC
            ?<Tip tip="Remove QC"><button onClick={()=>onAction("remove_qc",row.id)} style={{background:"#fee2e2",color:"#991b1b",border:"none",borderRadius:5,padding:"3px 6px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✕</button></Tip>
            :<span style={{display:"flex",gap:2}}>
              <Tip tip="✔ Confirm"><button onClick={()=>onAction("Confirmed",row.id)} style={{background:"#d1fae5",color:"#065f46",border:"none",borderRadius:5,padding:"3px 6px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✔</button></Tip>
              <Tip tip="⏭ Skip"><button onClick={()=>onAction("Skipped",row.id)} style={{background:"#f1f5f9",color:"#475569",border:"none",borderRadius:5,padding:"3px 6px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⏭</button></Tip>
              <Tip tip="↺ Reopen"><button onClick={()=>onAction("reopen",row.id)} style={{background:"#fee2e2",color:"#991b1b",border:"none",borderRadius:5,padding:"3px 6px",fontSize:11,fontWeight:700,cursor:"pointer"}}>↺</button></Tip>
            </span>
        )}
      </div>
    </div>
  );
});

// ── Virtual Grid ──────────────────────────────────────────────────────────────
function rowH(row) { return Math.max(ROW_H,(row.analytes||[]).length*24+14); }
function VirtualGrid({rows,selected,onToggle,onAction,stepType,onReorder,onQCClick}) {
  const outerRef=useRef(); const [scrollTop,setScrollTop]=useState(0); const [viewH,setViewH]=useState(500);
  const [dragIds,setDragIds]=useState(new Set()); const [dragOver,setDragOver]=useState(null); const dragRef=useRef(new Set());
  useEffect(()=>{
    const el=outerRef.current; if(!el) return;
    setViewH(el.clientHeight);
    const ro=new ResizeObserver(()=>setViewH(el.clientHeight)); ro.observe(el); return()=>ro.disconnect();
  },[]);
  const tops=useMemo(()=>{const a=[0];for(let i=0;i<rows.length;i++)a.push(a[i]+rowH(rows[i]));return a;},[rows]);
  const totalH=tops[rows.length]||0;
  let si=0,ei=rows.length;
  for(let i=0;i<rows.length;i++){if(tops[i+1]>scrollTop-OVERSCAN*ROW_H){si=i;break;}}
  for(let i=si;i<rows.length;i++){if(tops[i]>scrollTop+viewH+OVERSCAN*ROW_H){ei=i;break;}}
  function dStart(e,id){const ids=selected.has(id)&&selected.size>1?new Set([...selected].filter(s=>{const r=rows.find(x=>x.id===s);return r&&!r.isQC;})):new Set([id]);if(!ids.size){e.preventDefault();return;}e.dataTransfer.setData("text/plain",[...ids].join(","));dragRef.current=ids;setDragIds(ids);}
  function dOver(e,id){e.preventDefault();if(!dragRef.current.has(id))setDragOver(id);}
  function dDrop(e,id){e.preventDefault();const ids=e.dataTransfer.getData("text/plain").split(",");if(ids.length&&!ids.includes(id))onReorder(ids,id);dragRef.current=new Set();setDragIds(new Set());setDragOver(null);}
  function dEnd(){dragRef.current=new Set();setDragIds(new Set());setDragOver(null);}
  return (
    <div ref={outerRef} style={{flex:1,overflow:"auto"}} onScroll={e=>setScrollTop(e.currentTarget.scrollTop)}>
      <div style={{position:"relative",height:totalH,minWidth:800}}>
        {rows.slice(si,ei).map((row,idx)=>{
          const ri=si+idx;
          return (
            <div key={row.id} style={{position:"absolute",top:tops[ri],left:0,right:0}}>
              <SampleRow row={row} isSelected={selected.has(row.id)} onToggle={onToggle} onAction={onAction} stepType={stepType}
                isDragOver={dragOver===row.id} isDragging={dragIds.has(row.id)}
                onDragStart={e=>dStart(e,row.id)} onDragOver={e=>dOver(e,row.id)}
                onDrop={e=>dDrop(e,row.id)} onDragEnd={dEnd} onQCClick={()=>onQCClick(row)}/>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Modals ────────────────────────────────────────────────────────────────────
function SkipModal({rows,nextStepName,isLastStep,onConfirm,onCancel}) {
  const [reason,setReason]=useState("");
  const sampleIds=[...new Set(rows.filter(r=>!r.isQC).map(r=>r.id))];
  return (
    <div style={{position:"fixed",inset:0,background:"#00000066",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onCancel}>
      <div style={{background:"#fff",borderRadius:14,maxWidth:460,width:"100%",boxShadow:"0 20px 60px #0005",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        <div style={{background:"linear-gradient(90deg,#475569,#64748b)",padding:"14px 20px",display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:20}}>⏭</span>
          <div><div style={{fontWeight:800,fontSize:14,color:"#fff"}}>Skip Step</div><div style={{fontSize:11,color:"#cbd5e1"}}>{sampleIds.length} sample{sampleIds.length!==1?"s":""}</div></div>
          <button onClick={onCancel} style={{marginLeft:"auto",background:"none",border:"none",color:"#fff",fontSize:18,cursor:"pointer",opacity:.7}}>✕</button>
        </div>
        <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:"#f8fafc",borderRadius:9,padding:"8px 12px",maxHeight:80,overflowY:"auto",display:"flex",flexWrap:"wrap",gap:"4px 10px"}}>
            {sampleIds.slice(0,20).map(sid=><span key={sid} style={{fontSize:12,fontWeight:600,color:NAV}}>• {sid}</span>)}
            {sampleIds.length>20&&<span style={{fontSize:11,color:"#94a3b8"}}>+{sampleIds.length-20} more</span>}
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:5}}>Reason <span style={{color:"#ef4444"}}>*</span></div>
            <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3}
              style={{width:"100%",boxSizing:"border-box",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"7px 10px",fontSize:12,resize:"vertical",outline:"none",fontFamily:"inherit",color:"#334155"}}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:isLastStep?"#ede9fe":"#f1f5f9",borderRadius:8,fontSize:12}}>
            <span>➡</span>
            {isLastStep?<span style={{color:"#7c3aed",fontWeight:700}}>Last step — completed.</span>
              :<span><span style={{color:"#64748b"}}>Moving to: </span><strong style={{color:NAV}}>{nextStepName}</strong></span>}
          </div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",padding:"10px 20px",borderTop:"1px solid #f1f5f9",background:"#fafafa"}}>
          <button onClick={onCancel} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:12,fontWeight:600,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>{if(reason.trim())onConfirm(reason);}} disabled={!reason.trim()}
            style={{padding:"8px 20px",borderRadius:8,border:"none",background:reason.trim()?"#64748b":"#cbd5e1",color:"#fff",fontSize:12,fontWeight:700,cursor:reason.trim()?"pointer":"not-allowed"}}>⏭ Skip</button>
        </div>
      </div>
    </div>
  );
}
function RemoveQCModal({qcRow,onConfirm,onCancel}) {
  const [reason,setReason]=useState(""); const q=QC_TYPES[qcRow.qcType]||{};
  return (
    <div style={{position:"fixed",inset:0,background:"#00000066",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onCancel}>
      <div style={{background:"#fff",borderRadius:14,maxWidth:420,width:"100%",boxShadow:"0 20px 60px #0005",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        <div style={{background:"#fee2e2",padding:"12px 18px",display:"flex",alignItems:"center",gap:8}}>
          <span>🗑</span><div><div style={{fontWeight:800,fontSize:13,color:"#991b1b"}}>Remove QC</div><div style={{fontSize:11,color:"#b91c1c"}}>{qcRow.id}</div></div>
          <button onClick={onCancel} style={{marginLeft:"auto",background:"none",border:"none",fontSize:16,cursor:"pointer",color:"#991b1b"}}>✕</button>
        </div>
        <div style={{padding:"14px 18px"}}>
          <div style={{marginBottom:10}}><span style={{background:q.bg,color:q.color,border:"1px solid "+q.color+"44",borderRadius:4,padding:"2px 7px",fontSize:11,fontWeight:800}}>{q.icon} {q.label}</span></div>
          <div style={{fontSize:12,color:"#64748b",marginBottom:4,fontWeight:700}}>Reason <span style={{color:"#ef4444"}}>*</span></div>
          <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3}
            style={{width:"100%",boxSizing:"border-box",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"7px 10px",fontSize:12,resize:"vertical",outline:"none",fontFamily:"inherit"}}/>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",padding:"10px 18px",borderTop:"1px solid #f1f5f9",background:"#fafafa"}}>
          <button onClick={onCancel} style={{padding:"7px 16px",borderRadius:7,border:"1.5px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:12,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>{if(reason.trim())onConfirm(reason);}} disabled={!reason.trim()}
            style={{padding:"7px 16px",borderRadius:7,border:"none",background:reason.trim()?"#ef4444":"#fca5a5",color:"#fff",fontSize:12,fontWeight:700,cursor:reason.trim()?"pointer":"not-allowed"}}>Remove</button>
        </div>
      </div>
    </div>
  );
}
function ReopenModal({selectedIds,allSteps,currentStepIdx,onConfirm,onCancel}) {
  const prev=allSteps.slice(0,currentStepIdx);
  const [ti,setTi]=useState(prev.length-1); const [reason,setReason]=useState(""); const ok=reason.trim()&&ti>=0;
  return (
    <div style={{position:"fixed",inset:0,background:"#00000066",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onCancel}>
      <div style={{background:"#fff",borderRadius:14,maxWidth:500,width:"100%",maxHeight:"88vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px #0005",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        <div style={{background:"linear-gradient(90deg,#7f1d1d,#dc2626)",padding:"12px 18px",display:"flex",alignItems:"center",gap:8}}>
          <span>↺</span>
          <div><div style={{fontWeight:800,fontSize:13,color:"#fff"}}>Reopen — Send Back</div><div style={{fontSize:11,color:"#fca5a5"}}>{selectedIds.length} sample{selectedIds.length!==1?"s":""}</div></div>
          <button onClick={onCancel} style={{marginLeft:"auto",background:"none",border:"none",fontSize:16,cursor:"pointer",color:"#fff",opacity:.7}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"14px 18px"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:6}}>Send back to step:</div>
          {prev.length===0&&<div style={{fontSize:12,color:"#94a3b8",padding:"8px 0"}}>No previous steps available.</div>}
          {prev.map((st,i)=>(
            <label key={st.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",border:"1.5px solid "+(ti===i?"#dc2626":"#e2e8f0"),borderRadius:8,cursor:"pointer",background:ti===i?"#fff5f5":"#fff",marginBottom:5}}>
              <input type="radio" name="rstep" checked={ti===i} onChange={()=>setTi(i)} style={{accentColor:"#dc2626"}}/>
              <span>{STEP_ICONS[st.stepType]||"•"}</span>
              <div><div style={{fontSize:12,fontWeight:600,color:NAV}}>{st.name}</div><div style={{fontSize:10,color:"#94a3b8"}}>Step {i+1}</div></div>
            </label>
          ))}
          <div style={{marginTop:12}}>
            <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:5}}>Reason <span style={{color:"#ef4444"}}>*</span></div>
            <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3}
              style={{width:"100%",boxSizing:"border-box",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"7px 10px",fontSize:12,resize:"vertical",outline:"none",fontFamily:"inherit"}}/>
          </div>
          <div style={{background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:8,padding:"8px 12px",marginTop:10,fontSize:11,color:"#92400e"}}>ℹ Metadata preserved. Status reset to Pending.</div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",padding:"10px 18px",borderTop:"1px solid #f1f5f9",background:"#fafafa"}}>
          <button onClick={onCancel} style={{padding:"7px 16px",borderRadius:7,border:"1.5px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:12,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>{if(ok)onConfirm(ti,reason);}} disabled={!ok}
            style={{padding:"7px 16px",borderRadius:7,border:"none",background:ok?"#dc2626":"#fca5a5",color:"#fff",fontSize:12,fontWeight:700,cursor:ok?"pointer":"not-allowed"}}>↺ Send Back</button>
        </div>
      </div>
    </div>
  );
}

// ── 2-Hour Modal ──────────────────────────────────────────────────────────────
// Records end times + labels, then on confirm hands off to the Processing modal
function TwoHourModal({samples,onConfirm,onDismiss}) {
  const [endTimes,setEndTimes]=useState(()=>{const m={};samples.forEach(s=>{m[s.id]="2026-03-18T12:00";});return m;});
  const [printDone,setPrintDone]=useState(false);
  return (
    <div style={{position:"fixed",inset:0,background:"#00000077",zIndex:1200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#fff",borderRadius:14,maxWidth:540,width:"100%",maxHeight:"88vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px #0005",overflow:"hidden"}}>
        <div style={{background:"linear-gradient(90deg,#1e40af,#3b82f6)",padding:"12px 18px",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22}}>⏰</span>
          <div><div style={{fontWeight:800,fontSize:14,color:"#fff"}}>2-Hour Batch Checkpoint</div><div style={{fontSize:11,color:"#bfdbfe"}}>Confirm end times · then confirm equipment &amp; media to advance</div></div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"14px 18px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:"#f8fafc",borderRadius:10,border:"1.5px solid #e2e8f0",padding:"12px 14px"}}>
            <div style={{fontWeight:800,fontSize:12,color:NAV,marginBottom:8}}>⏱ End Time per Sample</div>
            <div style={{display:"flex",flexDirection:"column",gap:7,maxHeight:180,overflowY:"auto"}}>
              {samples.map(s=>(
                <div key={s.id} style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:11,fontWeight:600,color:NAV,minWidth:100}}>{s.id}</span>
                  <input type="datetime-local" value={endTimes[s.id]||""} onChange={e=>setEndTimes(p=>({...p,[s.id]:e.target.value}))}
                    style={{border:"1.5px solid #e2e8f0",borderRadius:6,padding:"3px 7px",fontSize:11,outline:"none",flex:1}}/>
                </div>
              ))}
            </div>
          </div>
          <div style={{background:"#eff6ff",borderRadius:10,border:"1.5px solid #bfdbfe",padding:"12px 14px"}}>
            {!printDone
              ?<button onClick={()=>setPrintDone(true)} style={{background:"#3b82f6",color:"#fff",border:"none",borderRadius:7,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>🖨 Print Labels (simulated)</button>
              :<div style={{fontSize:12,color:"#10b981",fontWeight:700,background:"#d1fae5",borderRadius:6,padding:"6px 10px"}}>✔ Labels printed</div>}
          </div>
          <div style={{background:"#f0fdf4",border:"1.5px solid #86efac",borderRadius:10,padding:"12px 14px",fontSize:12,color:"#166534"}}>
            <strong>Next:</strong> Clicking "Confirm &amp; Process" will open the Processing confirmation window so you can validate equipment, media batch and QC — samples will then advance to the next step.
          </div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",padding:"10px 18px",borderTop:"1px solid #f1f5f9",background:"#fafafa"}}>
          <button onClick={onDismiss} style={{padding:"7px 16px",borderRadius:7,border:"1.5px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:12,cursor:"pointer"}}>Dismiss</button>
          <button onClick={()=>onConfirm(endTimes)} style={{padding:"7px 18px",borderRadius:7,border:"none",background:"#3b82f6",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>✔ Confirm &amp; Process →</button>
        </div>
      </div>
    </div>
  );
}

function ProcessingModal({rows,nextStepName,isLastStep,prevMediaBatch,prevMediaExpiry,dayEquipment,onConfirm,onCancel}) {
  const realRows=rows.filter(r=>!r.isQC);
  const sampleIds=[...new Set(realRows.map(r=>r.id))];
  const [manifold,setManifold]=useState(dayEquipment&&dayEquipment.manifold||"");
  const [pipette,setPipette]=useState(dayEquipment&&dayEquipment.pipette||"");
  const [mediaBatch,setMediaBatch]=useState(prevMediaBatch||"");
  const [mediaExpiry,setMediaExpiry]=useState(prevMediaExpiry||"");
  const [printS,setPrintS]=useState(false); const [printD,setPrintD]=useState(false); const [printed,setPrinted]=useState(false);
  const [removedBlanks,setRemovedBlanks]=useState({}); const [removingId,setRemovingId]=useState(null); const [removeReason,setRemoveReason]=useState("");
  const isMediaChange=!!(prevMediaBatch&&mediaBatch&&mediaBatch!==prevMediaBatch);
  const expWarn=expiryStatus(mediaExpiry);
  const blanks=useMemo(()=>computeBlanks(realRows,mediaBatch),[realRows.length,mediaBatch]);
  const visibleBlanks=blanks.filter(b=>!removedBlanks[b.id]);
  const needsPrint=printS||printD;
  const ok=manifold&&pipette&&mediaBatch&&mediaExpiry&&expWarn!=="expired";
  const fs={width:"100%",boxSizing:"border-box",border:"1.5px solid #e2e8f0",borderRadius:7,padding:"7px 10px",fontSize:12,outline:"none",color:"#1e293b",background:"#fff"};
  const ls={fontSize:11,fontWeight:700,color:"#64748b",marginBottom:4,display:"block"};
  function handleConfirm(){if(needsPrint&&!printed){setPrinted(true);return;}onConfirm({manifold,pipette,mediaBatch,mediaExpiry,printS,printD,blanks:visibleBlanks,removedBlanks,isMediaChange,linkedSampleIds:sampleIds});}
  return (
    <div style={{position:"fixed",inset:0,background:"#00000066",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onCancel}>
      <div style={{background:"#fff",borderRadius:14,maxWidth:620,width:"100%",maxHeight:"94vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px #0005",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        <div style={{background:"linear-gradient(90deg,"+NAV+",#1e5fa0)",padding:"12px 18px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <span style={{fontSize:20}}>🧫</span>
          <div><div style={{fontWeight:800,fontSize:14,color:"#fff"}}>Processing — Pre-incubation</div><div style={{fontSize:11,color:"#93c5fd"}}>{sampleIds.length} samples · {visibleBlanks.length} blanks</div></div>
          <button onClick={onCancel} style={{marginLeft:"auto",background:"none",border:"none",color:"#fff",fontSize:18,cursor:"pointer",opacity:.7}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"14px 18px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:"#f8fafc",borderRadius:10,border:"1.5px solid #e2e8f0",padding:"12px 14px"}}>
            <div style={{fontWeight:800,fontSize:12,color:NAV,marginBottom:2}}>🔧 Equipment</div>
            {dayEquipment&&dayEquipment.manifold&&<div style={{fontSize:10,color:"#10b981",marginBottom:6,fontWeight:600}}>✔ Pre-filled from today's session</div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><label style={ls}>Manifold <span style={{color:"#ef4444"}}>*</span></label>
                <select value={manifold} onChange={e=>setManifold(e.target.value)} style={fs}><option value="">— select —</option>{MANIFOLDS.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
              <div><label style={ls}>Pipette <span style={{color:"#ef4444"}}>*</span></label>
                <select value={pipette} onChange={e=>setPipette(e.target.value)} style={fs}><option value="">— select —</option>{PIPETTES.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
            </div>
          </div>
          <div style={{background:"#f8fafc",borderRadius:10,border:"1.5px solid "+(isMediaChange?"#7c3aed":"#e2e8f0"),padding:"12px 14px"}}>
            <div style={{fontWeight:800,fontSize:12,color:isMediaChange?"#7c3aed":NAV,marginBottom:8}}>🧪 Media Batch{isMediaChange&&<span style={{fontSize:10,background:"#ede9fe",color:"#7c3aed",borderRadius:4,padding:"1px 7px",marginLeft:8}}>🔄 Change</span>}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><label style={ls}>Batch Ref <span style={{color:"#ef4444"}}>*</span></label>
                <input value={mediaBatch} onChange={e=>setMediaBatch(e.target.value)} placeholder="e.g. MB-2026-041" style={fs}/>
                {prevMediaBatch&&mediaBatch===prevMediaBatch&&<div style={{fontSize:10,color:"#10b981",marginTop:2,fontWeight:600}}>✔ Same batch</div>}</div>
              <div><label style={ls}>Expiry Date <span style={{color:"#ef4444"}}>*</span></label>
                <input type="date" value={mediaExpiry} onChange={e=>setMediaExpiry(e.target.value)} style={{...fs,borderColor:expWarn==="expired"?"#ef4444":expWarn==="soon"?"#f59e0b":"#e2e8f0"}}/>
                <ExpiryHint value={mediaExpiry}/></div>
            </div>
          </div>
          <div style={{background:"#f0f9ff",borderRadius:10,border:"1.5px solid #bae6fd",padding:"10px 14px"}}>
            <div style={{fontWeight:800,fontSize:12,color:"#0369a1",marginBottom:6}}>🧪 QC Blanks (1 per {BLANK_INTERVAL} per test)</div>
            {visibleBlanks.length===0?<div style={{fontSize:11,color:"#94a3b8"}}>No blanks required.</div>
              :<div style={{display:"flex",flexDirection:"column",gap:4}}>
                {visibleBlanks.map(b=>{const q=QC_TYPES[b.qcType]||{};return(
                  <div key={b.id} style={{display:"flex",alignItems:"center",gap:7,background:"#fff",border:"1px solid "+(q.color||"#e2e8f0")+"44",borderRadius:7,padding:"5px 9px"}}>
                    <span style={{fontSize:10,fontWeight:800,color:q.color,background:q.bg,borderRadius:4,padding:"1px 6px",flexShrink:0}}>{q.icon} {b.id}</span>
                    <span style={{fontSize:11,color:"#334155",flex:1}}>{b.qcReason}</span>
                    <button onClick={()=>{setRemovingId(b.id);setRemoveReason("");}} style={{background:"#fee2e2",color:"#991b1b",border:"none",borderRadius:5,padding:"2px 7px",fontSize:10,cursor:"pointer",fontWeight:700}}>✕</button>
                  </div>
                );})}
              </div>}
            {Object.keys(removedBlanks).length>0&&<div style={{marginTop:5,fontSize:10,color:"#94a3b8"}}>{Object.keys(removedBlanks).length} removed.</div>}
          </div>
          {removingId&&(
            <div style={{background:"#fff5f5",border:"2px solid #ef4444",borderRadius:10,padding:"10px 14px"}}>
              <div style={{fontWeight:700,fontSize:12,color:"#991b1b",marginBottom:6}}>Reason for removing {removingId} *</div>
              <textarea value={removeReason} onChange={e=>setRemoveReason(e.target.value)} rows={2}
                style={{width:"100%",boxSizing:"border-box",border:"1.5px solid #fca5a5",borderRadius:7,padding:"6px 9px",fontSize:11,outline:"none",resize:"none",fontFamily:"inherit"}}/>
              <div style={{display:"flex",gap:7,marginTop:7}}>
                <button onClick={()=>setRemovingId(null)} style={{padding:"5px 12px",borderRadius:6,border:"1.5px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:11,cursor:"pointer"}}>Cancel</button>
                <button onClick={()=>{if(removeReason.trim()){setRemovedBlanks(p=>({...p,[removingId]:removeReason}));setRemovingId(null);}}} disabled={!removeReason.trim()}
                  style={{padding:"5px 12px",borderRadius:6,border:"none",background:removeReason.trim()?"#ef4444":"#fca5a5",color:"#fff",fontSize:11,fontWeight:700,cursor:removeReason.trim()?"pointer":"not-allowed"}}>Confirm</button>
              </div>
            </div>
          )}
          <div style={{background:"#faf5ff",borderRadius:10,border:"1.5px solid #c4b5fd",padding:"10px 14px"}}>
            <div style={{fontWeight:800,fontSize:12,color:"#6d28d9",marginBottom:8}}>🏷 Print Labels</div>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,color:"#334155",marginBottom:5}}><input type="checkbox" checked={printS} onChange={e=>{setPrintS(e.target.checked);setPrinted(false);}} style={{accentColor:"#7c3aed"}}/>Sample labels ({sampleIds.length})</label>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,color:"#334155"}}><input type="checkbox" checked={printD} onChange={e=>{setPrintD(e.target.checked);setPrinted(false);}} style={{accentColor:"#7c3aed"}}/>Dilution labels</label>
            {needsPrint&&!printed&&<div style={{fontSize:10,color:"#7c3aed",background:"#ede9fe",borderRadius:6,padding:"5px 9px",marginTop:7}}>Click "Print &amp; Continue"</div>}
            {printed&&<div style={{fontSize:10,color:"#10b981",background:"#d1fae5",borderRadius:6,padding:"5px 9px",marginTop:7,fontWeight:700}}>✔ Printed</div>}
          </div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",padding:"10px 18px",borderTop:"1px solid #f1f5f9",background:"#fafafa"}}>
          <button onClick={onCancel} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:12,fontWeight:600,cursor:"pointer"}}>Cancel</button>
          <button onClick={handleConfirm} disabled={!ok||!!removingId}
            style={{padding:"8px 20px",borderRadius:8,border:"none",background:(!ok||removingId)?"#94a3b8":(needsPrint&&!printed)?"#7c3aed":"#10b981",color:"#fff",fontSize:12,fontWeight:700,cursor:(!ok||removingId)?"not-allowed":"pointer"}}>
            {needsPrint&&!printed?"🖨 Print & Continue":"✔ Confirm & Move"}
          </button>
        </div>
      </div>
    </div>
  );
}

function IncubationModal({rows,nextStepName,prevMediaBatch,prevMediaExpiry,dayEquipment,onConfirm,onCancel}) {
  const realRows=rows.filter(r=>!r.isQC);
  const sampleIds=[...new Set(realRows.map(r=>r.id))];
  const [incubator,setIncubator]=useState(dayEquipment&&dayEquipment.incubator||"");
  const [startDT,setStartDT]=useState("2026-03-18T10:00");
  const defQCs=[{qcType:"POS_ENUM",included:true,reason:""},{qcType:"POS_STK",included:true,reason:""},{qcType:"NEG_STK",included:true,reason:""}];
  const [qcControls,setQcControls]=useState(defQCs);
  const [removingQC,setRemovingQC]=useState(null); const [removeReason,setRemoveReason]=useState("");
  function confirmRmQC(){if(!removeReason.trim())return;setQcControls(p=>p.map((q,i)=>i===removingQC?{...q,included:false,reason:removeReason}:q));setRemovingQC(null);}
  const ok=incubator&&startDT; const included=qcControls.filter(q=>q.included);
  const byTest={};
  realRows.forEach(r=>{if(!byTest[r.testType])byTest[r.testType]={count:0,hours:(TEST_TYPES[r.testType]||{incubationH:48}).incubationH};byTest[r.testType].count++;});
  function calcEnd(h){if(!startDT)return"—";const d=new Date(startDT);d.setHours(d.getHours()+h);return fmtDT(d);}
  return (
    <div style={{position:"fixed",inset:0,background:"#00000066",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onCancel}>
      <div style={{background:"#fff",borderRadius:14,maxWidth:600,width:"100%",maxHeight:"94vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px #0005",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        <div style={{background:"linear-gradient(90deg,#92400e,#b45309)",padding:"12px 18px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <span style={{fontSize:20}}>🌡</span>
          <div><div style={{fontWeight:800,fontSize:14,color:"#fff"}}>Incubation Handling — Start</div><div style={{fontSize:11,color:"#fde68a"}}>{sampleIds.length} samples · {included.length} QC controls</div></div>
          <button onClick={onCancel} style={{marginLeft:"auto",background:"none",border:"none",color:"#fff",fontSize:18,cursor:"pointer",opacity:.7}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"14px 18px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:4,display:"block"}}>Incubator <span style={{color:"#ef4444"}}>*</span></label>
              {dayEquipment&&dayEquipment.incubator&&<div style={{fontSize:10,color:"#10b981",marginBottom:4,fontWeight:600}}>✔ Pre-filled from today</div>}
              <select value={incubator} onChange={e=>setIncubator(e.target.value)} style={{width:"100%",boxSizing:"border-box",border:"1.5px solid #e2e8f0",borderRadius:7,padding:"7px 10px",fontSize:12,outline:"none",background:"#fff"}}>
                <option value="">— select —</option>{INCUBATORS.map(i=><option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:4,display:"block"}}>Start Date/Time <span style={{color:"#ef4444"}}>*</span></label>
              <input type="datetime-local" value={startDT} onChange={e=>setStartDT(e.target.value)} style={{width:"100%",boxSizing:"border-box",border:"1.5px solid #e2e8f0",borderRadius:7,padding:"7px 10px",fontSize:12,outline:"none"}}/>
            </div>
          </div>
          <div style={{background:"#f8fafc",borderRadius:10,border:"1.5px solid #e2e8f0",padding:"10px 14px"}}>
            <div style={{fontWeight:800,fontSize:12,color:NAV,marginBottom:7}}>🧪 Media Batch (carried from Processing)</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><div style={{fontSize:11,color:"#64748b",fontWeight:700,marginBottom:3}}>Batch Ref</div><div style={{background:"#f1f5f9",borderRadius:7,padding:"7px 10px",fontSize:12,color:prevMediaBatch?"#1e293b":"#94a3b8",border:"1.5px solid #e2e8f0",fontWeight:prevMediaBatch?600:400}}>{prevMediaBatch||"—"}</div></div>
              <div><div style={{fontSize:11,color:"#64748b",fontWeight:700,marginBottom:3}}>Expiry</div><div style={{background:"#f1f5f9",borderRadius:7,padding:"7px 10px",fontSize:12,color:prevMediaExpiry?"#1e293b":"#94a3b8",border:"1.5px solid #e2e8f0"}}>{prevMediaExpiry||"—"}</div><ExpiryHint value={prevMediaExpiry}/></div>
            </div>
          </div>
          <div style={{background:"#f0fdf4",borderRadius:10,border:"1.5px solid #86efac",padding:"10px 14px"}}>
            <div style={{fontWeight:800,fontSize:12,color:"#15803d",marginBottom:8}}>🧪 QC Controls</div>
            {qcControls.map((ctrl,idx)=>{const q=QC_TYPES[ctrl.qcType];return(
              <div key={ctrl.qcType} style={{display:"flex",alignItems:"center",gap:7,background:ctrl.included?"#fff":"#f8fafc",border:"1.5px solid "+(ctrl.included?q.color+"55":"#e2e8f0"),borderRadius:8,padding:"6px 10px",opacity:ctrl.included?1:.6,marginBottom:5}}>
                <span style={{background:q.bg,color:q.color,borderRadius:4,padding:"1px 7px",fontSize:10,fontWeight:800,flexShrink:0}}>{q.icon} {q.label}</span>
                <span style={{fontSize:11,color:"#334155",flex:1}}>{ctrl.included?"Will be added":"Removed — "+ctrl.reason}</span>
                {ctrl.included?<button onClick={()=>{setRemovingQC(idx);setRemoveReason("");}} style={{background:"#fee2e2",color:"#991b1b",border:"none",borderRadius:5,padding:"2px 7px",fontSize:10,cursor:"pointer",fontWeight:700}}>✕</button>
                  :<button onClick={()=>setQcControls(p=>p.map((q,i)=>i===idx?{...q,included:true,reason:""}:q))} style={{background:"#d1fae5",color:"#065f46",border:"none",borderRadius:5,padding:"2px 7px",fontSize:10,cursor:"pointer",fontWeight:700}}>+ Re-add</button>}
              </div>
            );})}
            {removingQC!==null&&(
              <div style={{background:"#fff5f5",border:"2px solid #ef4444",borderRadius:8,padding:"9px 11px",marginTop:8}}>
                <div style={{fontSize:11,fontWeight:700,color:"#991b1b",marginBottom:5}}>Reason for removing {QC_TYPES[qcControls[removingQC].qcType].label} *</div>
                <textarea value={removeReason} onChange={e=>setRemoveReason(e.target.value)} rows={2}
                  style={{width:"100%",boxSizing:"border-box",border:"1.5px solid #fca5a5",borderRadius:7,padding:"6px 9px",fontSize:11,outline:"none",resize:"none",fontFamily:"inherit"}}/>
                <div style={{display:"flex",gap:7,marginTop:7}}>
                  <button onClick={()=>setRemovingQC(null)} style={{padding:"5px 11px",borderRadius:6,border:"1.5px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:11,cursor:"pointer"}}>Cancel</button>
                  <button onClick={confirmRmQC} disabled={!removeReason.trim()} style={{padding:"5px 11px",borderRadius:6,border:"none",background:removeReason.trim()?"#ef4444":"#fca5a5",color:"#fff",fontSize:11,fontWeight:700,cursor:removeReason.trim()?"pointer":"not-allowed"}}>Confirm</button>
                </div>
              </div>
            )}
          </div>
          <div style={{background:"#fffbeb",borderRadius:10,border:"1.5px solid #fde68a",padding:"10px 14px"}}>
            <div style={{fontWeight:800,fontSize:12,color:"#92400e",marginBottom:8}}>⏱ Expected End Times</div>
            {Object.keys(byTest).map(test=>{const t=TEST_TYPES[test]||{color:"#64748b",bg:"#f1f5f9"};return(
              <div key={test} style={{display:"flex",alignItems:"center",gap:8,background:"#fff",borderRadius:7,padding:"5px 10px",border:"1px solid "+t.color+"33",marginBottom:4}}>
                <span style={{background:t.bg,color:t.color,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700,flexShrink:0}}>{test}</span>
                <span style={{fontSize:11,color:"#64748b",flex:1}}>{byTest[test].count} · {byTest[test].hours}h</span>
                <span style={{fontSize:11,fontWeight:700,color:"#92400e"}}>Due: {calcEnd(byTest[test].hours)}</span>
              </div>
            );})}
          </div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",padding:"10px 18px",borderTop:"1px solid #f1f5f9",background:"#fafafa"}}>
          <button onClick={onCancel} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:12,fontWeight:600,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>onConfirm({incubator,startDT,mediaBatch:prevMediaBatch,mediaExpiry:prevMediaExpiry,includedQCs:included,linkedSampleIds:sampleIds})}
            disabled={!ok||removingQC!==null}
            style={{padding:"8px 20px",borderRadius:8,border:"none",background:(ok&&removingQC===null)?"#f59e0b":"#94a3b8",color:"#fff",fontSize:12,fontWeight:700,cursor:(ok&&removingQC===null)?"pointer":"not-allowed"}}>
            🌡 Start {included.length>0&&"+ "+included.length+" QC"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Post-Incubation ───────────────────────────────────────────────────────────
function PostIncubView({samples,onQCClick,onReopenSamples,allSteps}) {
  const now=new Date("2026-03-18T10:00:00");
  const [filters,setFilters]=useState({}); const [sort,setSort]=useState({key:null,dir:null});
  const [selectedIds,setSelectedIds]=useState(new Set());
  const [showReopen,setShowReopen]=useState(false);

  function getDueOut(s) {
    if (s.isQC) return s.incubationEnd?"Ready":"Not Ready";
    if (!s.incubationEnd) return "Not Ready";
    const e=new Date(s.incubationEnd);
    if (now<e) return "Not Ready";
    if ((now-e)/3600000>4) return "Overdue";
    return "Ready";
  }
  const filterOpts=useMemo(()=>({
    matrix:[...new Set(samples.map(s=>s.matrix))].sort(),
    testType:[...new Set(samples.map(s=>s.testType))].sort(),
    dueOut:["Ready","Not Ready","Overdue"],
  }),[samples]);
  const rows=useMemo(()=>{
    let r=samples.map(s=>({...s,_do:getDueOut(s)}));
    Object.keys(filters).forEach(fk=>{const v=filters[fk];if(!v||!v.length)return;r=r.filter(x=>fk==="dueOut"?v.includes(x._do):v.includes(x[fk]));});
    if (sort.key){const asc=sort.dir==="asc";r.sort((a,b)=>{const av=a[sort.key]||"",bv=b[sort.key]||"";return av<bv?(asc?-1:1):av>bv?(asc?1:-1):0;});}
    return r;
  },[samples,filters,sort]);
  const ac=Object.values(filters).reduce((n,v)=>n+(v?v.length:0),0);
  const byTest={};
  samples.forEach(s=>{if(!s.isQC){if(!byTest[s.testType])byTest[s.testType]={ready:0,notReady:0,overdue:0};const d=getDueOut(s);byTest[s.testType][d==="Ready"?"ready":d==="Overdue"?"overdue":"notReady"]++;}});
  const realSamples=samples.filter(s=>!s.isQC);
  const allSel=realSamples.length>0&&realSamples.every(s=>selectedIds.has(s.id));
  const selCount=selectedIds.size;
  if (!samples.length) return <div style={{padding:48,textAlign:"center",color:"#94a3b8"}}><div style={{fontSize:32}}>⏳</div><div style={{fontWeight:700,color:NAV,marginTop:10}}>No samples yet</div></div>;
  const PICOLS="32px 1fr 90px 140px 110px 130px 90px";
  const colDefs=[
    {label:"",        sortKey:null,       filterKey:null},
    {label:"Sample",  sortKey:"id",       filterKey:null},
    {label:"Matrix",  sortKey:"matrix",   filterKey:"matrix",   filterOptions:filterOpts.matrix},
    {label:"Test Type",sortKey:"testType",filterKey:"testType", filterOptions:filterOpts.testType},
    {label:"Due Out", sortKey:null,       filterKey:"dueOut",   filterOptions:filterOpts.dueOut},
    {label:"Incub. End",sortKey:null,     filterKey:null},
    {label:"Actions", sortKey:null,       filterKey:null},
  ];
  return (
    <div style={{flex:1,overflow:"auto",padding:"14px 18px",display:"flex",flexDirection:"column",gap:12}}>
      {showReopen&&<ReopenModal selectedIds={[...selectedIds]} allSteps={allSteps} currentStepIdx={allSteps.length} onConfirm={(ti,reason)=>{onReopenSamples([...selectedIds],ti,reason);setSelectedIds(new Set());setShowReopen(false);}} onCancel={()=>setShowReopen(false)}/>}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {Object.keys(byTest).map(test=>{const t=TEST_TYPES[test]||{color:"#64748b",bg:"#f1f5f9"};const d=byTest[test];return(
          <div key={test} style={{background:"#fff",border:"1.5px solid "+t.color+"44",borderRadius:10,padding:"10px 14px",minWidth:160}}>
            <div style={{fontSize:10,fontWeight:800,color:t.color,marginBottom:6}}>{test}</div>
            <div style={{display:"flex",gap:5}}>
              <span style={{fontSize:10,background:"#d1fae5",color:"#065f46",borderRadius:4,padding:"1px 6px",fontWeight:700}}>✅ {d.ready}</span>
              <span style={{fontSize:10,background:"#fef3c7",color:"#92400e",borderRadius:4,padding:"1px 6px",fontWeight:700}}>⏳ {d.notReady}</span>
              {d.overdue>0&&<span style={{fontSize:10,background:"#fee2e2",color:"#dc2626",borderRadius:4,padding:"1px 6px",fontWeight:700}}>🔴 {d.overdue}</span>}
            </div>
          </div>
        );})}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <span style={{fontSize:11,color:"#64748b",fontWeight:600}}>{rows.length} / {samples.length}</span>
        {ac>0&&<button onClick={()=>setFilters({})} style={{fontSize:10,background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:5,padding:"2px 7px",cursor:"pointer",fontWeight:600}}>✕ {ac} filter{ac!==1?"s":""}</button>}
        {selCount>0&&(
          <div style={{display:"flex",gap:6,alignItems:"center",background:"#fff5f5",border:"1px solid #fca5a5",borderRadius:7,padding:"4px 10px",marginLeft:"auto"}}>
            <span style={{fontSize:11,color:"#991b1b",fontWeight:600}}>{selCount} selected</span>
            <button onClick={()=>setShowReopen(true)} style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:5,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>↺ Reopen</button>
          </div>
        )}
      </div>
      <div style={{background:"#fff",borderRadius:10,border:"1px solid #e2e8f0",overflow:"auto",flex:1}}>
        <div style={{display:"grid",gridTemplateColumns:PICOLS,minWidth:620}} onClick={e=>e.stopPropagation()}>
          <div style={{height:38,background:"#f8fafc",borderBottom:"2px solid #e2e8f0",display:"flex",alignItems:"center",padding:"0 8px"}}>
            <input type="checkbox" checked={allSel} onChange={e=>{if(e.target.checked)setSelectedIds(new Set(realSamples.map(s=>s.id)));else setSelectedIds(new Set());}} style={{accentColor:NAV,cursor:"pointer"}}/>
          </div>
          {colDefs.slice(1).map((ch,i)=><ColHeader key={i} label={ch.label} sortKey={ch.sortKey} filterKey={ch.filterKey} sort={sort} setSort={setSort} filters={filters} setFilters={setFilters} filterOptions={ch.filterOptions}/>)}
        </div>
        {rows.length===0?<div style={{padding:24,textAlign:"center",fontSize:12,color:"#94a3b8"}}>No rows match filters.</div>
          :rows.map(s=>{
            const d=s._do; const qc=s.isQC?(QC_TYPES[s.qcType]||{}):null;
            return(
              <div key={s._id} style={{display:"grid",gridTemplateColumns:PICOLS,borderTop:"1px solid #f1f5f9",background:d==="Overdue"?"#fff5f5":"#fff",borderLeft:s.isQC?"3px solid "+(qc&&qc.color||"#0891b2"):"3px solid transparent",minWidth:620}}>
                <div style={{padding:"12px 8px",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {!s.isQC&&<input type="checkbox" checked={selectedIds.has(s.id)} onChange={()=>setSelectedIds(p=>{const n=new Set(p);n.has(s.id)?n.delete(s.id):n.add(s.id);return n;})} style={{accentColor:NAV,cursor:"pointer"}}/>}
                </div>
                <div style={{padding:"10px 8px",display:"flex",flexDirection:"column",gap:2}}>
                  <span style={{fontWeight:600,color:s.isQC?(qc&&qc.color||"#0891b2"):NAV,fontSize:12}}>{s.id}</span>
                  {s.isQC&&<span onClick={()=>onQCClick(s)} style={{fontSize:9,background:qc&&qc.bg,color:qc&&qc.color,borderRadius:3,padding:"1px 4px",fontWeight:800,cursor:"pointer",textDecoration:"underline",alignSelf:"flex-start"}}>{qc&&qc.icon} {qc&&qc.label}{s.linkedSampleIds&&s.linkedSampleIds.length>0?" · "+s.linkedSampleIds.length+" linked":""}</span>}
                  {s.status==="Reopened"&&<span style={{fontSize:9,background:"#fee2e2",color:"#ef4444",borderRadius:3,padding:"1px 4px",fontWeight:800,alignSelf:"flex-start"}}>↺ Reopened</span>}
                </div>
                <div style={{padding:"12px 8px",fontSize:11,color:"#64748b"}}>{s.matrix}</div>
                <div style={{padding:"10px 6px"}}><TestBadge t={s.testType}/></div>
                <div style={{padding:"10px 6px"}}><DueOutBadge s={d}/></div>
                <div style={{padding:"12px 8px",fontSize:11,color:"#64748b"}}>{fmtDT(s.incubationEnd)}</div>
                <div style={{padding:"10px 6px",display:"flex",alignItems:"center",gap:4}}>
                  {!s.isQC&&<Tip tip="↺ Reopen this sample"><button onClick={()=>{setSelectedIds(new Set([s.id]));setShowReopen(true);}} style={{background:"#fee2e2",color:"#991b1b",border:"none",borderRadius:5,padding:"3px 7px",fontSize:11,fontWeight:700,cursor:"pointer"}}>↺</button></Tip>}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ── Audit Log ─────────────────────────────────────────────────────────────────
function AuditLog({entries,onClose}) {
  return (
    <div style={{position:"fixed",inset:0,background:"#00000033",zIndex:800,display:"flex",alignItems:"flex-end",justifyContent:"flex-end",padding:16}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:14,width:340,maxHeight:"68vh",boxShadow:"0 16px 48px #0004",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",gap:7,padding:"10px 14px",background:NAV,color:"#fff"}}>
          <span>🗒</span><span style={{fontWeight:700,fontSize:13}}>Audit Log</span>
          {entries.length>0&&<span style={{fontSize:10,background:"#ffffff30",borderRadius:10,padding:"1px 6px"}}>{entries.length}</span>}
          <button onClick={onClose} style={{marginLeft:"auto",background:"none",border:"none",color:"#fff",fontSize:15,cursor:"pointer",opacity:.7}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"8px 12px"}}>
          {entries.length===0&&<div style={{padding:"20px 0",textAlign:"center",fontSize:12,color:"#cbd5e1"}}>No activity yet.</div>}
          {[...entries].reverse().map((e,i)=>{
            const m=AUDIT_META[e.type]||AUDIT_META.confirmed;
            return(
              <div key={i} style={{display:"flex",gap:8,padding:"6px 7px",borderRadius:7,background:i%2===0?"#f8fafc":"#fff",borderLeft:"3px solid "+m.color,marginBottom:2}}>
                <div style={{width:22,height:22,borderRadius:"50%",background:m.bg,color:m.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,flexShrink:0}}>{m.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,fontWeight:800,color:m.color,textTransform:"uppercase"}}>{m.label}</div>
                  {e.target&&<div style={{fontSize:10,color:NAV,fontWeight:600}}>{e.target}</div>}
                  {e.detail&&<div style={{fontSize:10,color:"#475569"}}>{e.detail}</div>}
                  <div style={{fontSize:9,color:"#94a3b8",marginTop:1}}>{e.user} · {e.time}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Scan Bar ──────────────────────────────────────────────────────────────────
function ScanBar({scanInput,setScanInput,scanState,onCommit,onClear,scannedTrays,selCount,compact}) {
  const {status,message}=scanState;
  const border=status==="error"?"#ef4444":status==="warn"?"#f59e0b":status==="ok"?"#0d9488":"#93c5fd";
  return (
    <div style={{background:compact?"#f8fafc":"#1e293b",border:compact?"1.5px solid #e2e8f0":"none",borderRadius:compact?10:0,borderBottom:compact?"none":"1px solid #334155",padding:compact?"10px 14px":"7px 18px",display:"flex",alignItems:"center",gap:9,flexShrink:0}}>
      <span style={{fontSize:compact?18:14}}>📷</span>
      {!compact&&<span style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".06em",flexShrink:0}}>Scan</span>}
      <div style={{position:"relative",flex:1,maxWidth:compact?undefined:340}}>
        <input value={scanInput} onChange={e=>setScanInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")onCommit(scanInput);}}
          placeholder={"Sample ID or "+TRAY_PREFIX+"XXXX…"}
          style={{width:"100%",boxSizing:"border-box",border:"2px solid "+border,borderRadius:8,padding:"6px 11px",fontSize:12,outline:"none",background:status==="error"?"#fff5f5":status==="ok"?"#f0fdfa":"#fff",color:"#1e293b"}}/>
        {status==="loading"&&<div style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",width:13,height:13,borderRadius:"50%",border:"2px solid #0d9488",borderTopColor:"transparent",animation:"spin 0.7s linear infinite"}}/>}
      </div>
      <div style={{flex:1,fontSize:11}}>
        {status==="error"&&<span style={{color:compact?"#ef4444":"#fca5a5",fontWeight:600}}>⚠ {message}</span>}
        {status==="warn"&&<span style={{color:compact?"#f59e0b":"#fde68a",fontWeight:600}}>⚠ {message}</span>}
        {status==="ok"&&<span style={{color:compact?"#059669":"#6ee7b7",fontWeight:600}}>✔ {message}</span>}
        {status==="loading"&&<span style={{color:compact?"#0d9488":"#5eead4"}}>🔍 Looking up…</span>}
        {status==="idle"&&(scannedTrays&&scannedTrays.length>0
          ?<span style={{color:compact?NAV:"#5eead4",fontWeight:700}}>🗂 {scannedTrays.length} tray · <strong>{selCount}</strong> selected</span>
          :<span style={{opacity:.5,color:compact?"#64748b":"#fff"}}>Scan sample ID or tray</span>)}
      </div>
      {scannedTrays&&scannedTrays.map(t=>(
        <div key={t.code} style={{display:"flex",alignItems:"center",gap:3,background:"#134e4a",border:"1px solid #0d9488",borderRadius:6,padding:"2px 7px"}}>
          <span style={{fontSize:10,fontWeight:700,color:"#5eead4"}}>🗂 {t.code}</span>
          <span style={{fontSize:9,color:"#99f6e4"}}>{t.matched}/{t.total}</span>
        </div>
      ))}
      <button onClick={onClear} style={{fontSize:10,color:compact?"#64748b":"#94a3b8",background:compact?"#e2e8f0":"#ffffff10",border:"1px solid "+(compact?"#cbd5e1":"#ffffff20"),borderRadius:6,padding:"3px 9px",cursor:"pointer",fontWeight:600}}>✕</button>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [lab,setLab]=useState(LABS[0]);
  const [labOpen,setLabOpen]=useState(false);
  const [labChanging,setLabChanging]=useState(false);
  const [sections,setSections]=useState(buildSections);
  const histRef=useRef([]); const [histLen,setHistLen]=useState(0);
  const [expandedSec,setExpandedSec]=useState({}); const [expandedCat,setExpandedCat]=useState({});
  const [activeKey,setActiveKey]=useState(null);
  const [selected,setSelected]=useState(new Set());
  const [auditLog,setAuditLog]=useState({}); const [auditOpen,setAuditOpen]=useState(false);
  const [modal,setModal]=useState(null); const [skipModal,setSkipModal]=useState(null);
  const [removeQCRow,setRemoveQCRow]=useState(null); const [reopenRows,setReopenRows]=useState(null);
  const [twoHourModal,setTwoHourModal]=useState(null);
  const [qcPanelRow,setQcPanelRow]=useState(null);
  const [qcFailureData,setQcFailureData]=useState(null); // {qcRow, linkedSamples}
  const [scanInput,setScanInput]=useState(""); const [scanState,setScanState]=useState({status:"idle",message:""});
  const [scannedTrays,setScannedTrays]=useState([]);
  const [filters,setFilters]=useState({}); const [sort,setSort]=useState({key:null,dir:null});
  const [batchTimers,setBatchTimers]=useState({}); const [timerFired,setTimerFired]=useState({});
  const [dayEquipment,setDayEquipment]=useState({});
  // pending scan-navigate: after opening a step, auto-select these
  const pendingScanRef=useRef(null);
  const timerRef=useRef(null); const selectedRef=useRef(selected);
  useEffect(()=>{selectedRef.current=selected;},[selected]);

  useEffect(()=>{
    function onKey(e){if((e.ctrlKey||e.metaKey)&&e.key==="z"&&!e.shiftKey){e.preventDefault();undo();}}
    window.addEventListener("keydown",onKey); return()=>window.removeEventListener("keydown",onKey);
  },[]);

  useEffect(()=>{
    timerRef.current=setInterval(()=>{
      const now=Date.now();
      Object.keys(batchTimers).forEach(key=>{
        if(timerFired[key])return;
        if((now-batchTimers[key])>=BATCH_TIMER_MS){
          const [sid,cid,stid]=key.split("||");
          const sec=sections.find(s=>s.id===sid); if(!sec)return;
          const cat=sec.categories.find(c=>c.id===cid); if(!cat)return;
          const st=cat.steps.find(s=>s.id===stid); if(!st)return;
          const real=st.samples.filter(s=>!s.isQC);
          if(real.length>0){setTimerFired(p=>({...p,[key]:true}));setTwoHourModal({stepKey:key,samples:real});}
        }
      });
    },15000);
    return()=>clearInterval(timerRef.current);
  },[batchTimers,timerFired,sections]);

  // After navigating to a step from scan, apply pending selection
  useEffect(()=>{
    if (!activeKey||!pendingScanRef.current) return;
    const pending=pendingScanRef.current; pendingScanRef.current=null;
    const {secId,catId,stepId}=activeKey;
    if (pending.secId!==secId||pending.catId!==catId||pending.stepId!==stepId) return;
    const sec=sections.find(s=>s.id===secId); if(!sec)return;
    const cat=sec.categories.find(c=>c.id===catId); if(!cat)return;
    const st=cat.steps.find(s=>s.id===stepId); if(!st)return;
    const toSelect=new Set();
    if (pending.sampleId) {
      const s=st.samples.find(x=>x.id===pending.sampleId||x.id.toUpperCase().includes(pending.sampleId));
      if(s) toSelect.add(s.id);
    }
    if (pending.trayCode) {
      st.samples.filter(s=>s.trayCode===pending.trayCode).forEach(s=>toSelect.add(s.id));
    }
    if (toSelect.size>0) setSelected(toSelect);
  },[activeKey,sections]);

  function undo(){if(!histRef.current.length)return;const p=histRef.current[histRef.current.length-1];histRef.current=histRef.current.slice(0,-1);setHistLen(histRef.current.length);setSections(p);}
  function pushHist(snap){histRef.current=histRef.current.slice(-40).concat([snap]);setHistLen(histRef.current.length);}
  function pushAudit(key,entry){setAuditLog(p=>({...p,[key]:(p[key]||[]).concat([{...entry,user:CURRENT_USER.name,time:nowStr()}])}));}

  const activeSection=activeKey?sections.find(s=>s.id===activeKey.secId):null;
  const activeCategory=activeSection?activeSection.categories.find(c=>c.id===activeKey.catId):null;
  const activeStep=activeCategory?activeCategory.steps.find(s=>s.id===activeKey.stepId):null;
  const activeStepIdx=activeCategory?activeCategory.steps.findIndex(s=>s.id===activeKey.stepId):-1;
  const nextStep=activeCategory&&activeStepIdx>=0&&activeStepIdx<activeCategory.steps.length-1?activeCategory.steps[activeStepIdx+1]:null;
  const isLastStep=activeCategory?activeStepIdx===activeCategory.steps.length-1:false;
  const stepKey=activeKey?[activeKey.secId,activeKey.catId,activeKey.stepId].join("||"):null;
  const currentAudit=stepKey?(auditLog[stepKey]||[]):[];
  const samples=activeStep?activeStep.samples:[];
  const stepType=activeStep?activeStep.stepType:null;
  const stepMediaBatch=activeStep?activeStep.mediaBatch:null;
  const stepMediaExpiry=activeStep?activeStep.mediaExpiry:null;

  const filterOpts=useMemo(()=>({
    matrix:[...new Set(samples.map(s=>s.matrix))].sort(),
    analyte:[...new Set(samples.flatMap(s=>(s.analytes||[]).map(a=>a.name)))].sort(),
    method:[...new Set(samples.flatMap(s=>(s.analytes||[]).map(a=>a.method)))].sort(),
    status:[...new Set(samples.map(s=>s.status))].sort(),
    mediaBatch:[...new Set(samples.filter(s=>s.mediaBatch).map(s=>s.mediaBatch))].sort(),
    due:["Overdue","Due today","Due soon","On track"],
  }),[samples]);

  const displayRows=useMemo(()=>{
    let r=samples.slice();
    Object.keys(filters).forEach(fk=>{
      const v=filters[fk]; if(!v||!v.length)return;
      if(fk==="analyte")r=r.filter(x=>(x.analytes||[]).some(a=>v.includes(a.name)));
      else if(fk==="method")r=r.filter(x=>(x.analytes||[]).some(a=>v.includes(a.method)));
      else if(fk==="due")r=r.filter(x=>{if(x.isQC)return false;const ds=dueDateStatus(x.dueDate);const label={overdue:"Overdue",today:"Due today",soon:"Due soon",ok:"On track"}[ds||"ok"];return v.includes(label);});
      else r=r.filter(x=>v.includes(x[fk]));
    });
    if(sort.key){const asc=sort.dir==="asc";r.sort((a,b)=>{const av=a[sort.key]||"",bv=b[sort.key]||"";return av<bv?(asc?-1:1):av>bv?(asc?1:-1):0;});}
    return r;
  },[samples,filters,sort]);

  const activeFilterCount=Object.values(filters).reduce((n,v)=>n+(v?v.length:0),0);
  function mutateSections(fn){setSections(prev=>{pushHist(prev);return fn(prev);});}
  function updateStep(sId,cId,stId,pFn){mutateSections(prev=>prev.map(s=>s.id!==sId?s:{...s,categories:s.categories.map(c=>c.id!==cId?c:{...c,steps:c.steps.map(st=>st.id!==stId?st:{...st,...pFn(st)})})}));}

  function handleAction(action,sampleId){
    if(action==="toggle"){setSelected(p=>{const n=new Set(p);n.has(sampleId)?n.delete(sampleId):n.add(sampleId);return n;});return;}
    if(action==="remove_qc"){const row=samples.find(s=>s.id===sampleId);if(row)setRemoveQCRow(row);return;}
    if(action==="reopen"){const cur=selectedRef.current;const ids=cur.has(sampleId)&&cur.size>1?[...cur]:[sampleId];setReopenRows(ids);return;}
    const cur=selectedRef.current;const ids=cur.has(sampleId)&&cur.size>1?[...cur]:[sampleId];
    const targetRows=samples.filter(s=>ids.includes(s.id));
    if(action==="Skipped"){setSkipModal({rows:targetRows});return;}
    setModal({action,rows:targetRows});
  }
  function handleBulk(action){
    if(action==="reopen"){if(selected.size>0)setReopenRows([...selected]);return;}
    const rows=samples.filter(s=>selected.has(s.id));if(!rows.length)return;
    if(action==="Skipped"){setSkipModal({rows});return;}
    setModal({action,rows});
  }
  function handleSkipConfirm(reason){
    const realIds=new Set(skipModal.rows.filter(r=>!r.isQC).map(r=>r._id));
    const snap=samples.slice();const key=activeKey;const nid=nextStep&&nextStep.id;
    mutateSections(prev=>prev.map(s=>s.id!==key.secId?s:{...s,categories:s.categories.map(c=>c.id!==key.catId?c:{...c,steps:c.steps.map(st=>{
      if(st.id===key.stepId)return{...st,samples:st.samples.filter(s=>!realIds.has(s._id))};
      if(nid&&st.id===nid){const toAdd=snap.filter(s=>realIds.has(s._id)).map(s=>({...s,status:"Skipped"}));const m=st.samples.slice();toAdd.forEach(ns=>{if(!m.find(x=>x._id===ns._id))m.push(ns);});return{...st,samples:m};}
      return st;
    })})}));
    pushAudit(stepKey,{type:"skipped",target:skipModal.rows.filter(r=>!r.isQC).map(r=>r.id).join(", "),detail:"Reason: "+reason});
    setSelected(new Set());setSkipModal(null);clearScan();
  }
  function handleProcessingConfirm(meta){
    const realRows=modal.rows.filter(r=>!r.isQC);
    const realIds=realRows.map(r=>r._id);
    const allQCIds=samples.filter(s=>s.isQC).map(s=>s._id);
    const snap=samples.slice();const key=activeKey;const nid=nextStep&&nextStep.id;
    setDayEquipment(p=>({...p,manifold:meta.manifold,pipette:meta.pipette}));
    mutateSections(prev=>prev.map(s=>s.id!==key.secId?s:{...s,categories:s.categories.map(c=>c.id!==key.catId?c:{...c,steps:c.steps.map(st=>{
      if(st.id===key.stepId)return{...st,mediaBatch:meta.mediaBatch,mediaExpiry:meta.mediaExpiry,samples:st.samples.filter(s=>!new Set([...realIds,...allQCIds]).has(s._id))};
      if(nid&&st.id===nid){
        const moved=snap.filter(s=>new Set(realIds).has(s._id)).map(s=>({...s,status:"Confirmed",mediaBatch:meta.mediaBatch}));
        const mcQC=meta.isMediaChange?ALL_TESTS.map(test=>({_id:uid(),id:"MCH-"+test.replace(/ /g,"").slice(0,5).toUpperCase()+"-001",isQC:true,qcType:"MEDIA_CH",testType:test,matrix:"Media Change Blank",status:"Pending",dueDate:"",trayCode:null,mediaBatch:meta.mediaBatch,incubationStart:null,incubationEnd:null,history:[],linkedSampleIds:meta.linkedSampleIds,analytes:[],qcReason:"Media change: "+meta.mediaBatch})):[];
        const linkedBlanks=meta.blanks.map(b=>({...b,mediaBatch:meta.mediaBatch,linkedSampleIds:meta.linkedSampleIds}));
        const toAdd=[...moved,...linkedBlanks,...mcQC];
        const m=st.samples.slice();toAdd.forEach(ns=>{if(!m.find(x=>x._id===ns._id))m.push(ns);});
        return{...st,mediaBatch:meta.mediaBatch,mediaExpiry:meta.mediaExpiry,samples:m};
      }
      return st;
    })})}));
    if(stepKey)setBatchTimers(p=>({...p,[stepKey]:Date.now()}));
    pushAudit(stepKey,{type:"confirmed",target:realRows.map(r=>r.id).join(", "),detail:"Manifold:"+meta.manifold+" · Pipette:"+meta.pipette+" · Media:"+meta.mediaBatch});
    if(meta.isMediaChange)pushAudit(stepKey,{type:"media_chg",target:meta.mediaBatch,detail:"Full blank set regenerated"});
    Object.keys(meta.removedBlanks).forEach(id=>pushAudit(stepKey,{type:"qc_removed",target:id,detail:meta.removedBlanks[id]}));
    setSelected(new Set());setModal(null);clearScan();
  }
  function handleIncubationConfirm(meta){
    const realRows=modal.rows.filter(r=>!r.isQC);
    const realIds=new Set(realRows.map(r=>r._id));
    const existingQCIds=new Set(samples.filter(s=>s.isQC&&s.qcType!=="POS_ENUM"&&s.qcType!=="POS_STK"&&s.qcType!=="NEG_STK").map(s=>s._id));
    const snap=samples.slice();const key=activeKey;const nid=nextStep&&nextStep.id;
    const startDT=new Date(meta.startDT);
    setDayEquipment(p=>({...p,incubator:meta.incubator}));
    const newQCRows=(meta.includedQCs||[]).map(ctrl=>{const q=QC_TYPES[ctrl.qcType];return{_id:uid(),id:ctrl.qcType+"-"+String(Date.now()).slice(-4),isQC:true,qcType:ctrl.qcType,testType:rnd(ALL_TESTS),matrix:"Control",status:"Pending",dueDate:"",trayCode:null,mediaBatch:meta.mediaBatch,incubationStart:meta.startDT,incubationEnd:null,history:[],linkedSampleIds:meta.linkedSampleIds,analytes:[],qcReason:"Incubation QC: "+q.label};});
    mutateSections(prev=>prev.map(s=>s.id!==key.secId?s:{...s,categories:s.categories.map(c=>c.id!==key.catId?c:{...c,steps:c.steps.map(st=>{
      if(st.id===key.stepId)return{...st,mediaBatch:meta.mediaBatch,mediaExpiry:meta.mediaExpiry,samples:st.samples.filter(s=>!realIds.has(s._id)&&!existingQCIds.has(s._id))};
      if(nid&&st.id===nid){
        const toAdd=[...snap.filter(s=>realIds.has(s._id)||existingQCIds.has(s._id)).map(s=>{
          if(s.isQC)return{...s,status:"Pending",mediaBatch:meta.mediaBatch};
          const h=(TEST_TYPES[s.testType]||{incubationH:48}).incubationH;
          const end=new Date(startDT);end.setHours(end.getHours()+h);
          return{...s,status:"Confirmed",mediaBatch:meta.mediaBatch,incubationStart:meta.startDT,incubationEnd:end.toISOString()};
        }),...newQCRows];
        const m=st.samples.slice();toAdd.forEach(ns=>{if(!m.find(x=>x._id===ns._id))m.push(ns);});
        return{...st,mediaBatch:meta.mediaBatch,mediaExpiry:meta.mediaExpiry,samples:m};
      }
      return st;
    })})}));
    pushAudit(stepKey,{type:"incubation",target:realRows.map(r=>r.id).join(", "),detail:"Incubator:"+meta.incubator+" · Start:"+fmtDT(meta.startDT)+" · Media:"+meta.mediaBatch});
    if(newQCRows.length)pushAudit(stepKey,{type:"qc_added",target:newQCRows.map(q=>q.id).join(", "),detail:"Linked to "+meta.linkedSampleIds.length+" samples"});
    setSelected(new Set());setModal(null);clearScan();
  }
  function handleRemoveQC(reason){
    const id=removeQCRow.id;
    updateStep(activeKey.secId,activeKey.catId,activeKey.stepId,st=>({samples:st.samples.filter(s=>s.id!==id)}));
    pushAudit(stepKey,{type:"qc_removed",target:id,detail:"Reason: "+reason});
    setRemoveQCRow(null);
  }
  function doReopen(sampleIds,ti,reason,auditKey){
    const ids=new Set(sampleIds);const key=activeKey;
    const allSteps=activeCategory?activeCategory.steps:[];
    const targetId=allSteps[ti]&&allSteps[ti].id; if(!targetId)return;
    const snap=samples.slice();
    mutateSections(prev=>prev.map(s=>s.id!==key.secId?s:{...s,categories:s.categories.map(c=>c.id!==key.catId?c:{...c,steps:c.steps.map(st=>{
      if(st.id===key.stepId)return{...st,samples:st.samples.filter(s=>!ids.has(s.id))};
      if(st.id===targetId){const toAdd=snap.filter(s=>ids.has(s.id)).map(s=>({...s,status:"Reopened",history:[...(s.history||[]),{from:key.stepId,reason,time:nowStr()}]}));const m=st.samples.slice();toAdd.forEach(ns=>{if(!m.find(x=>x._id===ns._id))m.push(ns);});return{...st,samples:m};}
      return st;
    })})}));
    pushAudit(auditKey||stepKey,{type:"reopened",target:[...ids].join(", "),detail:"→ "+allSteps[ti].name+" | "+reason});
  }
  function handleReopen(ti,reason){doReopen(reopenRows,ti,reason);setReopenRows(null);setSelected(new Set());}

  function handleQCFailureConfirm(action,comment){
    const {qcRow,linkedSamples}=qcFailureData;
    if(action==="reopen"&&activeCategory){
      const allSteps=activeCategory.steps;
      const ti=0; // send back to Processing (step 0)
      const ids=[qcRow.id,...linkedSamples.map(s=>s.id)];
      doReopen(ids,ti,"QC Failure: "+comment);
      pushAudit(stepKey,{type:"comment",target:qcRow.id,detail:"QC Failure action=Reopen | "+comment});
    } else if(action==="nothing"){
      pushAudit(stepKey,{type:"comment",target:qcRow.id,detail:"QC Failure action=DoNothing | "+comment});
    } else if(action==="comment"){
      pushAudit(stepKey,{type:"comment",target:qcRow.id,detail:"QC Failure action=CommentOnly | "+comment});
    }
    setQcFailureData(null);setQcPanelRow(null);
  }

  function handleTwoHourConfirm(endTimes){
    const key=twoHourModal.stepKey;const [sid,cid,stid]=key.split("||");
    const linkedIds=twoHourModal.samples.map(s=>s.id);
    const newQC=[
      {_id:uid(),id:"POS-ENUM-001",isQC:true,qcType:"POS_ENUM",testType:rnd(ALL_TESTS),matrix:"Control",status:"Pending",dueDate:"",trayCode:null,mediaBatch:null,incubationStart:null,incubationEnd:null,history:[],linkedSampleIds:linkedIds,analytes:[],qcReason:"2h checkpoint"},
      {_id:uid(),id:"POS-STK-001", isQC:true,qcType:"POS_STK", testType:rnd(ALL_TESTS),matrix:"Control",status:"Pending",dueDate:"",trayCode:null,mediaBatch:null,incubationStart:null,incubationEnd:null,history:[],linkedSampleIds:linkedIds,analytes:[],qcReason:"2h checkpoint"},
      {_id:uid(),id:"NEG-STK-001", isQC:true,qcType:"NEG_STK", testType:rnd(ALL_TESTS),matrix:"Control",status:"Pending",dueDate:"",trayCode:null,mediaBatch:null,incubationStart:null,incubationEnd:null,history:[],linkedSampleIds:linkedIds,analytes:[],qcReason:"2h checkpoint"},
    ];
    // Add the QC rows to the step
    updateStep(sid,cid,stid,st=>({samples:[...st.samples,...newQC]}));
    pushAudit(key,{type:"timer_done",target:"2h checkpoint",detail:"End times recorded · 3 QC controls added"});
    setTwoHourModal(null);
    // Navigate to the step
    openStepFn(sid,cid,stid);
    // Find the step's current samples + the newly added QC to pass to ProcessingModal
    // We read from sections state via a short timeout so state has settled
    setTimeout(()=>{
      setSections(prev=>{
        const sec=prev.find(s=>s.id===sid); if(!sec) return prev;
        const cat=sec.categories.find(c=>c.id===cid); if(!cat) return prev;
        const st=cat.steps.find(s=>s.id===stid); if(!st) return prev;
        // Open modal with ALL rows in the step (samples + new QC)
        setModal({action:"Confirmed", rows: st.samples});
        return prev; // no mutation — just reading
      });
    },50);
  }
  function handleReorder(draggedIds,targetId){
    updateStep(activeKey.secId,activeKey.catId,activeKey.stepId,st=>{
      const ds=new Set(draggedIds);const dragged=st.samples.filter(s=>ds.has(s.id));const rest=st.samples.filter(s=>!ds.has(s.id));
      const idx=rest.findIndex(s=>s.id===targetId);
      return{samples:[...rest.slice(0,idx===-1?rest.length:idx),...dragged,...rest.slice(idx===-1?rest.length:idx)]};
    });
  }
  function handleReopenPostIncub(sampleIds,ti,reason){
    const ids=new Set(sampleIds);const key=activeKey;
    const allSteps=activeCategory?activeCategory.steps:[];
    const targetId=allSteps[ti]&&allSteps[ti].id; if(!targetId)return;
    const snap=samples.slice();
    mutateSections(prev=>prev.map(s=>s.id!==key.secId?s:{...s,categories:s.categories.map(c=>c.id!==key.catId?c:{...c,steps:c.steps.map(st=>{
      if(st.id===key.stepId)return{...st,samples:st.samples.filter(s=>!ids.has(s.id))};
      if(st.id===targetId){const toAdd=snap.filter(s=>ids.has(s.id)).map(s=>({...s,status:"Reopened",history:[...(s.history||[]),{from:key.stepId,reason,time:nowStr()}]}));const m=st.samples.slice();toAdd.forEach(ns=>{if(!m.find(x=>x._id===ns._id))m.push(ns);});return{...st,samples:m};}
      return st;
    })})}));
    pushAudit(stepKey,{type:"reopened",target:[...ids].join(", "),detail:"From Post-Incubation → "+allSteps[ti].name+" | "+reason});
  }

  function doScan(raw,isHome){
    const v=raw.trim().toUpperCase();if(!v)return;setScanInput("");
    if(v.startsWith(TRAY_PREFIX)){
      if(!isHome&&scannedTrays.find(t=>t.code===v)){setScanState({status:"warn",message:"Already scanned."});setTimeout(()=>setScanState({status:"idle",message:""}),3000);return;}
      setScanState({status:"loading",message:""});
      mockTrayLookup(v).then(res=>{
        if(isHome){
          const loc=findTrayStep(sections,v);
          if(loc){
            pendingScanRef.current={...loc,trayCode:v};
            openStepFn(loc.secId,loc.catId,loc.stepId);
            setScanState({status:"ok",message:"Tray "+v+" found — opening step & selecting samples."});
            setTimeout(()=>setScanState({status:"idle",message:""}),3500);
          } else {
            setScanState({status:"error",message:"Tray "+v+" not found in any step."});
            setTimeout(()=>setScanState({status:"idle",message:""}),4000);
          }
          return;
        }
        const stepIds=new Set(samples.filter(s=>!s.isQC).map(s=>s.id));
        const matched=res.samples.filter(sid=>stepIds.has(sid));
        setSelected(p=>{const n=new Set(p);matched.forEach(sid=>n.add(sid));return n;});
        setScannedTrays(p=>[...p,{code:v,matched:matched.length,total:res.totalInTray}]);
        setScanState({status:"ok",message:"Tray "+v+": "+matched.length+" matched."});
        setTimeout(()=>setScanState({status:"idle",message:""}),3500);
      }).catch(err=>{setScanState({status:"error",message:err.message});setTimeout(()=>setScanState({status:"idle",message:""}),5000);});
    } else {
      if(isHome){
        const loc=findSampleStep(sections,v);
        if(loc){
          pendingScanRef.current={...loc,sampleId:v};
          openStepFn(loc.secId,loc.catId,loc.stepId);
          setScanState({status:"ok",message:"Sample "+v+" found — opening step & selecting."});
          setTimeout(()=>setScanState({status:"idle",message:""}),3000);
        } else {
          setScanState({status:"error",message:v+" not found."});
          setTimeout(()=>setScanState({status:"idle",message:""}),4000);
        }
        return;
      }
      const m=samples.find(s=>!s.isQC&&s.id.toUpperCase().includes(v));
      if(m){setSelected(p=>{const n=new Set(p);n.add(m.id);return n;});setScanState({status:"ok",message:"Sample "+m.id+" selected."});setTimeout(()=>setScanState({status:"idle",message:""}),2500);}
      else{setScanState({status:"error",message:v+" not found."});setTimeout(()=>setScanState({status:"idle",message:""}),3000);}
    }
  }
  function clearScan(){setScanInput("");setSelected(new Set());setScannedTrays([]);setScanState({status:"idle",message:""});}
  function openStepFn(secId,catId,stepId){
    setActiveKey({secId,catId,stepId});setSelected(new Set());setFilters({});setSort({key:null,dir:null});clearScan();
    setExpandedSec(p=>({...p,[secId]:true}));setExpandedCat(p=>({...p,[catId]:true}));
  }
  function goHome(){setActiveKey(null);clearScan();setSelected(new Set());}
  function handleLabChange(l){
    setLabChanging(true);
    setTimeout(()=>{setLab(l);setLabOpen(false);setSections(buildSections());histRef.current=[];setHistLen(0);setActiveKey(null);setExpandedSec({});setExpandedCat({});setSelected(new Set());setDayEquipment({});clearScan();setLabChanging(false);},400);
  }

  const realSamples=samples.filter(s=>!s.isQC);
  const blankCount=samples.filter(s=>s.isQC).length;
  const selCount=selected.size;
  const allSel=realSamples.length>0&&realSamples.every(s=>selected.has(s.id));
  const statusCounts=useMemo(()=>{const c={Pending:0,Confirmed:0,Skipped:0};samples.forEach(s=>{if(!s.isQC&&c[s.status]!==undefined)c[s.status]++;});return c;},[samples]);
  const batchTimerActive=stepKey&&batchTimers[stepKey]&&!timerFired[stepKey];
  const batchElapsedMin=batchTimerActive?Math.floor((Date.now()-batchTimers[stepKey])/60000):null;
  const knownTrays=Object.keys(MOCK_TRAY_DB).slice(0,6);
  const allSamplesFlat=useMemo(()=>sections.flatMap(s=>s.categories.flatMap(c=>c.steps.flatMap(st=>st.samples))),[sections]);

  const colHeaders=[
    {label:"",       sortKey:null,       filterKey:null},
    {label:"",       sortKey:null,       filterKey:null},
    {label:"Tray",   sortKey:"trayCode", filterKey:null},
    {label:"ID",     sortKey:"id",       filterKey:null},
    {label:"Matrix", sortKey:"matrix",   filterKey:"matrix",    filterOptions:filterOpts.matrix},
    {label:"Analyte",sortKey:null,       filterKey:"analyte",   filterOptions:filterOpts.analyte},
    {label:"Method", sortKey:null,       filterKey:"method",    filterOptions:filterOpts.method},
    {label:"Due",    sortKey:"dueDate",  filterKey:"due",       filterOptions:filterOpts.due},
    {label:"Status", sortKey:"status",   filterKey:"status",    filterOptions:filterOpts.status},
    {label:"Media",  sortKey:null,       filterKey:"mediaBatch",filterOptions:filterOpts.mediaBatch},
    {label:"Actions",sortKey:null,       filterKey:null},
  ];

  return (
    <div style={{fontFamily:"'Inter',sans-serif",background:"#f1f5f9",height:"100vh",display:"flex",flexDirection:"column",fontSize:14}} onClick={()=>setLabOpen(false)}>
      <style>{"@keyframes spin{to{transform:translateY(-50%) rotate(360deg);}}"}</style>

      <div style={{background:"linear-gradient(90deg,#7c3aed,#6d28d9)",color:"#fff",padding:"3px 18px",display:"flex",alignItems:"center",gap:8,flexShrink:0,fontSize:10,fontWeight:600}}>
        <span style={{background:"#ffffff25",border:"1px solid #ffffff40",borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:800,textTransform:"uppercase"}}>UAT</span>
        <span style={{opacity:.85}}>Microbiology Work-Step Lab — simulated, not persisted</span>
        <span style={{marginLeft:"auto",opacity:.55,fontSize:9}}>v0.7 · 18 Mar 2026</span>
      </div>

      {labChanging&&<div style={{position:"fixed",inset:0,background:"#1e3a5fee",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{color:"#fff",fontSize:14,fontWeight:700}}>A mudar de laboratório…</div></div>}
      {auditOpen&&<AuditLog entries={currentAudit} onClose={()=>setAuditOpen(false)}/>}
      {removeQCRow&&<RemoveQCModal qcRow={removeQCRow} onConfirm={handleRemoveQC} onCancel={()=>setRemoveQCRow(null)}/>}
      {reopenRows&&activeCategory&&<ReopenModal selectedIds={reopenRows} allSteps={activeCategory.steps} currentStepIdx={activeStepIdx} onConfirm={handleReopen} onCancel={()=>setReopenRows(null)}/>}
      {twoHourModal&&<TwoHourModal samples={twoHourModal.samples} onConfirm={handleTwoHourConfirm} onDismiss={()=>setTwoHourModal(null)}/>}
      {skipModal&&<SkipModal rows={skipModal.rows} nextStepName={nextStep&&nextStep.name} isLastStep={isLastStep} onConfirm={handleSkipConfirm} onCancel={()=>setSkipModal(null)}/>}
      {modal&&stepType==="processing"&&<ProcessingModal rows={modal.rows} nextStepName={nextStep&&nextStep.name} isLastStep={isLastStep} prevMediaBatch={stepMediaBatch} prevMediaExpiry={stepMediaExpiry} dayEquipment={dayEquipment} onConfirm={handleProcessingConfirm} onCancel={()=>setModal(null)}/>}
      {modal&&stepType==="incubation"&&<IncubationModal rows={modal.rows} nextStepName={nextStep&&nextStep.name} prevMediaBatch={stepMediaBatch} prevMediaExpiry={stepMediaExpiry} dayEquipment={dayEquipment} onConfirm={handleIncubationConfirm} onCancel={()=>setModal(null)}/>}
      {qcPanelRow&&!qcFailureData&&<QCLinkPanel qcRow={qcPanelRow} allSamples={allSamplesFlat} onClose={()=>setQcPanelRow(null)} onOpenFailure={(qcRow,linked)=>setQcFailureData({qcRow,linkedSamples:linked})}/>}
      {qcFailureData&&<QCFailureModal qcRow={qcFailureData.qcRow} linkedSamples={qcFailureData.linkedSamples} onConfirm={handleQCFailureConfirm} onCancel={()=>setQcFailureData(null)}/>}

      {/* Topbar */}
      <div style={{background:NAV,color:"#fff",padding:"0 18px",height:48,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,zIndex:20}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <Tip tip="Home"><button onClick={goHome} style={{background:"#ffffff18",border:"1px solid #ffffff30",borderRadius:7,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:15,color:"#fff"}}>⌂</button></Tip>
          <span style={{fontWeight:800,fontSize:15}}>🧫 EnviroLab</span>
          <span style={{opacity:.3,fontSize:18}}>│</span>
          <span style={{fontSize:12,opacity:.75}}>Work-step Lab</span>
          <span style={{fontSize:9,background:"#7c3aed",color:"#fff",borderRadius:4,padding:"1px 6px",fontWeight:800,border:"1px solid #a78bfa"}}>UAT</span>
          {activeKey&&<><span style={{opacity:.3}}>›</span><span style={{fontSize:11,opacity:.75}}>{activeSection&&activeSection.name}</span><span style={{opacity:.3}}>›</span><span style={{fontSize:11,color:"#93c5fd",fontWeight:600}}>{activeStep&&activeStep.name}</span></>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          {batchTimerActive&&<div style={{background:"#fef3c7",color:"#92400e",borderRadius:7,padding:"3px 10px",fontSize:11,fontWeight:700,border:"1px solid #fde68a"}}>⏱ {batchElapsedMin}m/{BATCH_TIMER_MS/60000}m</div>}
          {histLen>0&&<Tip tip="Undo (Ctrl+Z)"><button onClick={undo} style={{background:"#ffffff18",border:"1px solid #ffffff30",borderRadius:7,padding:"4px 9px",color:"#fff",fontSize:11,cursor:"pointer"}}>↩ Undo</button></Tip>}
          {activeKey&&<button onClick={()=>setAuditOpen(o=>!o)} style={{background:currentAudit.length>0?"#ffffff18":"none",border:"1px solid "+(currentAudit.length>0?"#ffffff40":"#ffffff20"),borderRadius:7,padding:"4px 9px",color:"#fff",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:4,opacity:currentAudit.length===0?.5:1}}>
            🗒 {currentAudit.length>0&&<span style={{fontSize:9,background:"#f59e0b",color:"#fff",borderRadius:8,padding:"1px 5px",fontWeight:700}}>{currentAudit.length}</span>}
          </button>}
          <div style={{position:"relative"}}>
            <button onClick={e=>{e.stopPropagation();setLabOpen(o=>!o);}} style={{background:"#ffffff18",border:"1px solid #ffffff30",borderRadius:7,padding:"4px 11px",color:"#fff",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>🏢 {lab} <span style={{opacity:.5,fontSize:10}}>▾</span></button>
            {labOpen&&<div style={{position:"absolute",top:"calc(100% + 5px)",right:0,background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,boxShadow:"0 6px 24px #0003",zIndex:100,minWidth:130,overflow:"hidden"}}>
              {LABS.map(l=><div key={l} onClick={()=>{if(l!==lab)handleLabChange(l);}} style={{padding:"9px 14px",fontSize:12,color:l===lab?NAV:"#334155",fontWeight:l===lab?700:400,background:l===lab?"#eff6ff":"#fff",cursor:l===lab?"default":"pointer"}}>{(l===lab?"✔ ":"")+l}</div>)}
            </div>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:"#3b82f6",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:11}}>MA</div>
            <div><div style={{fontWeight:600,fontSize:11}}>Maria Alves</div><div style={{fontSize:9,opacity:.55}}>Lab Analyst</div></div>
          </div>
        </div>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* Sidebar */}
        <div style={{width:230,background:"#fff",borderRight:"1px solid #e2e8f0",overflowY:"auto",flexShrink:0}}>
          <div style={{padding:"10px 12px 3px",fontSize:9,fontWeight:800,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".08em"}}>Sections</div>
          {sections.map(sec=>(
            <div key={sec.id}>
              <div onClick={()=>setExpandedSec(p=>({...p,[sec.id]:!p[sec.id]}))} style={{padding:"8px 12px",fontSize:11,fontWeight:800,color:"#334155",textTransform:"uppercase",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid #f1f5f9",userSelect:"none"}}>
                <span>{sec.name}</span><span style={{opacity:.4}}>{expandedSec[sec.id]?"▾":"▸"}</span>
              </div>
              {expandedSec[sec.id]&&sec.categories.map(cat=>(
                <div key={cat.id}>
                  <div onClick={()=>setExpandedCat(p=>({...p,[cat.id]:!p[cat.id]}))} style={{padding:"5px 12px 5px 20px",fontSize:10,fontWeight:700,color:NAV,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#f8fafc",userSelect:"none"}}>
                    <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat.name}</span>
                    <span style={{opacity:.4,flexShrink:0,marginLeft:3}}>{expandedCat[cat.id]?"▾":"▸"}</span>
                  </div>
                  {expandedCat[cat.id]&&cat.steps.map((st,si)=>{
                    const isActive=activeKey&&activeKey.secId===sec.id&&activeKey.catId===cat.id&&activeKey.stepId===st.id;
                    const cnt=st.samples.filter(s=>!s.isQC).length;
                    const blk=st.samples.filter(s=>s.isQC).length;
                    const tKey=[sec.id,cat.id,st.id].join("||");
                    const timerOn=batchTimers[tKey]&&!timerFired[tKey];
                    return(
                      <div key={st.id} onClick={()=>openStepFn(sec.id,cat.id,st.id)} style={{display:"flex",alignItems:"center",padding:"4px 7px 4px 24px",margin:"1px 5px",borderRadius:6,background:isActive?NAV:"transparent",cursor:"pointer"}}>
                        <span style={{fontSize:13,marginRight:4}}>{STEP_ICONS[st.stepType]||"•"}</span>
                        <span style={{fontSize:10,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:isActive?"#fff":"#64748b"}}><span style={{opacity:.5,marginRight:2}}>{si+1}.</span>{st.name}</span>
                        {timerOn&&<span style={{fontSize:8,background:"#fef3c7",color:"#92400e",borderRadius:8,padding:"1px 4px",fontWeight:700}}>⏱</span>}
                        <span style={{background:isActive?"#ffffff25":"#e2e8f0",color:isActive?"#fff":"#64748b",borderRadius:10,padding:"1px 5px",fontSize:9,fontWeight:700,marginLeft:3}}>{cnt}</span>
                        {blk>0&&<span style={{background:isActive?"#ffffff20":"#e0f2fe",color:isActive?"#fff":"#0891b2",borderRadius:10,padding:"1px 4px",fontSize:8,fontWeight:700,marginLeft:2}}>🧪{blk}</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Main */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {!activeKey&&(
            <div style={{flex:1,overflowY:"auto",padding:"28px 24px"}}>
              <div style={{fontSize:18,fontWeight:800,color:NAV,marginBottom:3}}>👋 Bem-vindo, Maria</div>
              <div style={{fontSize:12,color:"#64748b",marginBottom:20}}>Scan a sample or tray to jump to its step, or select from the sidebar.</div>
              <div style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:"16px 18px",marginBottom:20,boxShadow:"0 1px 4px #0001"}}>
                <div style={{fontWeight:800,fontSize:13,color:NAV,marginBottom:10}}>📷 Quick Scan — Find Sample or Tray</div>
                <ScanBar compact={true} scanInput={scanInput} setScanInput={setScanInput} scanState={scanState} onCommit={v=>doScan(v,true)} onClear={clearScan} scannedTrays={[]} selCount={0}/>
                <div style={{fontSize:11,color:"#94a3b8",marginTop:8}}>Opens the step and automatically selects the scanned sample(s) in the grid.</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:10,marginBottom:20}}>
                {sections.map(sec=>{
                  const tot=sec.categories.reduce((a,c)=>a+c.steps.reduce((b,st)=>b+st.samples.filter(s=>!s.isQC).length,0),0);
                  const pend=sec.categories.reduce((a,c)=>a+c.steps.reduce((b,st)=>b+st.samples.filter(s=>!s.isQC&&s.status==="Pending").length,0),0);
                  return(
                    <div key={sec.id} onClick={()=>openStepFn(sec.id,sec.categories[0].id,sec.categories[0].steps[0].id)} style={{background:"#fff",borderRadius:12,border:"1.5px solid #e2e8f0",padding:14,cursor:"pointer",boxShadow:"0 1px 4px #0001"}}>
                      <div style={{fontWeight:800,fontSize:13,color:NAV,marginBottom:8}}>{sec.name}</div>
                      <span style={{fontSize:10,background:"#fef3c7",color:"#b45309",borderRadius:4,padding:"2px 6px",fontWeight:700}}>⏳ {pend} pending</span>
                      <div style={{height:3,background:"#e2e8f0",borderRadius:2,overflow:"hidden",marginTop:9}}><div style={{width:(tot>0?Math.round((tot-pend)/tot*100):0)+"%",height:"100%",background:"#10b981",borderRadius:2}}/></div>
                    </div>
                  );
                })}
              </div>
              <div style={{background:"#f0fdfa",border:"1.5px solid #99f6e4",borderRadius:12,padding:"12px 16px"}}>
                <div style={{fontWeight:700,fontSize:12,color:"#0d9488",marginBottom:5}}>🗂 Mock Tray Codes (scan to test)</div>
                <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                  {knownTrays.map(code=><span key={code} style={{background:"#ccfbf1",color:"#0f766e",border:"1px solid #5eead4",borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:700}}>{code}</span>)}
                  <span style={{fontSize:10,color:"#94a3b8",alignSelf:"center"}}>+{Object.keys(MOCK_TRAY_DB).length-6} more</span>
                </div>
              </div>
            </div>
          )}

          {activeKey&&(
            <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
              <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"9px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexShrink:0}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:NAV,marginBottom:2,display:"flex",alignItems:"center",gap:7}}>
                    {STEP_ICONS[stepType]} {activeStep&&activeStep.name}
                    {stepMediaBatch&&<span style={{fontSize:10,background:"#f1f5f9",color:"#64748b",borderRadius:4,padding:"2px 7px",border:"1px solid #e2e8f0",fontWeight:600}}>🧪 {stepMediaBatch}{stepMediaExpiry&&" · exp "+stepMediaExpiry}</span>}
                    {activeFilterCount>0&&<button onClick={()=>setFilters({})} style={{fontSize:10,background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:5,padding:"1px 7px",cursor:"pointer",fontWeight:600}}>✕ {activeFilterCount} filter{activeFilterCount!==1?"s":""}</button>}
                  </div>
                  <div style={{fontSize:11,color:"#94a3b8"}}>
                    <strong style={{color:"#334155"}}>{realSamples.length}</strong> samples
                    {blankCount>0&&<span> · <strong style={{color:"#0891b2"}}>🧪 {blankCount} QC</strong></span>}
                    {displayRows.length!==samples.length&&<span style={{color:"#f59e0b",marginLeft:5}}>({displayRows.length} shown)</span>}
                  </div>
                </div>
                {selCount>0&&stepType!=="postincub"&&(
                  <div style={{display:"flex",gap:5,alignItems:"center",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"4px 9px"}}>
                    <span style={{fontSize:11,color:"#475569",fontWeight:600}}>{selCount} sel.</span>
                    <button onClick={()=>handleBulk("Confirmed")} style={{background:"#d1fae5",color:"#065f46",border:"none",borderRadius:5,padding:"3px 8px",fontSize:10,fontWeight:700,cursor:"pointer"}}>✔</button>
                    <button onClick={()=>handleBulk("Skipped")}   style={{background:"#f1f5f9",color:"#475569",border:"none",borderRadius:5,padding:"3px 8px",fontSize:10,fontWeight:700,cursor:"pointer"}}>⏭</button>
                    <button onClick={()=>handleBulk("reopen")}    style={{background:"#fee2e2",color:"#991b1b",border:"none",borderRadius:5,padding:"3px 8px",fontSize:10,fontWeight:700,cursor:"pointer"}}>↺</button>
                  </div>
                )}
              </div>
              {stepType!=="postincub"&&(
                <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"6px 18px",display:"flex",gap:7,flexShrink:0}}>
                  {["Pending","Confirmed","Skipped"].map(st=>{const m=STATUS_META[st];const cnt=statusCounts[st]||0;const pct=realSamples.length>0?Math.round(cnt/realSamples.length*100):0;return(
                    <div key={st} style={{flex:1,background:"#f8fafc",border:"1.5px solid "+m.color+"44",borderRadius:8,padding:"5px 9px"}}>
                      <div style={{fontSize:9,fontWeight:700,color:m.color,textTransform:"uppercase",marginBottom:1}}>{m.icon} {st}</div>
                      <div style={{fontSize:16,fontWeight:800,color:m.color,lineHeight:1}}>{cnt}</div>
                      <div style={{marginTop:3,height:2,background:"#e2e8f0",borderRadius:2,overflow:"hidden"}}><div style={{width:pct+"%",height:"100%",background:m.color}}/></div>
                    </div>
                  );})}
                </div>
              )}
              {stepType!=="postincub"&&<ScanBar scanInput={scanInput} setScanInput={setScanInput} scanState={scanState} onCommit={v=>doScan(v,false)} onClear={clearScan} scannedTrays={scannedTrays} selCount={selCount}/>}
              {stepType==="postincub"
                ?<PostIncubView samples={samples} onQCClick={setQcPanelRow} onReopenSamples={handleReopenPostIncub} allSteps={activeCategory?activeCategory.steps:[]}/>
                :(
                  <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",padding:"9px 18px"}}>
                    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"#fff",borderRadius:10,border:"1px solid #e2e8f0"}}>
                      <div style={{display:"grid",gridTemplateColumns:GRID_COLS,flexShrink:0,minWidth:800}} onClick={e=>e.stopPropagation()}>
                        <div style={{height:38,background:"#f8fafc",borderBottom:"2px solid #e2e8f0"}}/>
                        <div style={{height:38,background:"#f8fafc",borderBottom:"2px solid #e2e8f0",display:"flex",alignItems:"center",padding:"0 7px"}}>
                          <input type="checkbox" checked={allSel} onChange={e=>{if(e.target.checked)setSelected(new Set(realSamples.map(s=>s.id)));else setSelected(new Set());}} style={{accentColor:NAV,cursor:"pointer"}}/>
                        </div>
                        {colHeaders.slice(2).map((ch,i)=>(
                          <ColHeader key={i} label={ch.label} sortKey={ch.sortKey} filterKey={ch.filterKey} sort={sort} setSort={setSort} filters={filters} setFilters={setFilters} filterOptions={ch.filterOptions}/>
                        ))}
                      </div>
                      {displayRows.length===0
                        ?<div style={{padding:40,textAlign:"center",color:"#94a3b8"}}><div style={{fontSize:28}}>✅</div><div style={{fontWeight:700,color:NAV,marginTop:8}}>{samples.length===0?"No samples in this step":"No rows match filters"}</div></div>
                        :<VirtualGrid rows={displayRows} selected={selected} onToggle={id=>setSelected(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;})} onAction={handleAction} stepType={stepType} onReorder={handleReorder} onQCClick={setQcPanelRow}/>
                      }
                    </div>
                  </div>
                )
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
