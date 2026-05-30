// ============================================================================
//  Indian Job Market Visualizer — rendering + layers + stats + prompt scoring
// ============================================================================
const GROUP_COLORS = window.GROUP_COLORS;
const svg = d3.select("#chart"), tip = d3.select("#tip"), legend = d3.select("#legend");
let DATA = window.REAL_OCCUPATIONS; // active dataset (real ILOSTAT by default)
let TOTAL_EMP = 0;                 // recomputed per dataset
let dataset = "real";             // "real" | "mock"
let layer = "group";              // active colour layer
let customScores = null;          // map: name -> 0..1, from prompt scoring
let filter = null;                // {lo,hi,top,label} — click a tier/bin to drill in

// One consistent ramp for EVERY numeric layer: green (low) -> red (high).
// Using a single scale across layers avoids the "different palette each time"
// confusion — only the categorical "group" layer uses distinct hues.
const RAMP = t => d3.interpolateRdYlGn(1 - Math.max(0, Math.min(1, t)));

function setDataset(key){
  dataset = key;
  DATA = key==="real" ? window.REAL_OCCUPATIONS : window.OCCUPATIONS;
  TOTAL_EMP = d3.sum(DATA, d => d.employment);
  customScores = null; filter = null;
  if(layer==="custom") layer = "group";   // prompt scores don't carry across datasets
  document.getElementById("total").textContent = Math.round(TOTAL_EMP);
  document.getElementById("count").textContent = DATA.length;
  const m = window.DATASET_META[key];
  document.getElementById("srcnote").innerHTML =
    `<b style="color:var(--ink)">${m.badge}</b> — ${m.note}`;
  d3.selectAll("#datasets button").classed("on", false);
  d3.select(`#datasets button[data-d="${key}"]`).classed("on", true);
  d3.selectAll("#layers button").classed("on", false);
  d3.select(`#layers button[data-k="${layer}"]`).classed("on", true);
  setStatus("");
  render();
}

// --- normalise any layer's value to 0..1 (higher = "more") ------------------
const clamp01 = v => Math.max(0, Math.min(1, v));
function scoreNorm(d, lyr = layer){
  switch(lyr){
    case "wage":      return clamp01((d.wage - 8000) / 72000);
    case "education": return (d.education - 1) / 4;
    case "formality": return d.formality;
    case "ai":        return d.ai;
    case "custom":    return customScores ? (customScores[d.name] ?? 0) : 0;
    case "group":     return d.ai;            // fallback metric for the stats strip
  }
}
const LAYER_NAME = { group:"AI exposure", wage:"pay level", education:"education",
                     formality:"formality", ai:"AI exposure", custom:"prompt score" };

function colorOf(d){
  if(layer === "group") return GROUP_COLORS[d.data.group] || "#888";
  if(layer === "custom" && !customScores) return "#444";
  return RAMP(scoreNorm(d.data));
}

const INR = n => "₹" + (n>=1000 ? (n/1000).toFixed(n%1000?1:0)+"k" : n);
const EDU = ["", "Below primary", "Primary", "Secondary", "Higher sec / diploma", "Graduate+"];

// --- treemap ----------------------------------------------------------------
function inFilter(d){
  if(!filter) return true;
  const s = scoreNorm(d);
  return s >= filter.lo && (filter.top ? s <= filter.hi : s < filter.hi);
}
function layout(w, h){
  const data = DATA.filter(inFilter);
  const root = d3.hierarchy({children: d3.groups(data, d=>d.group)
        .map(([k,v]) => ({group:k, children:v}))})
    .sum(d => d.employment)
    .sort((a,b)=> b.value - a.value);
  d3.treemap().size([w,h]).paddingInner(2).paddingTop(0).round(true)(root);
  return root.leaves();
}

function render(){
  const node = document.getElementById("chart");
  const w = node.clientWidth, h = node.clientHeight;
  svg.attr("viewBox", `0 0 ${w} ${h}`);
  const leaves = layout(w, h);

  const g = svg.selectAll("g.cell").data(leaves, d=>d.data.name)
    .join(enter => {
      const g = enter.append("g").attr("class","cell");
      g.append("rect").attr("class","tile");
      g.append("text").attr("class","tlabel");
      g.append("text").attr("class","tsub");
      return g;
    });

  g.attr("transform", d=>`translate(${d.x0},${d.y0})`);
  g.select("rect.tile")
    .attr("width",  d=>Math.max(0,d.x1-d.x0))
    .attr("height", d=>Math.max(0,d.y1-d.y0))
    .attr("fill", colorOf)
    .on("mousemove", showTip).on("mouseleave", hideTip);

  g.select("text.tlabel")
    .attr("x",6).attr("y",16)
    .text(d => (d.x1-d.x0 > 60 && d.y1-d.y0 > 26) ? fit(d.data.name, d.x1-d.x0) : "");
  g.select("text.tsub")
    .attr("x",6).attr("y",30)
    .text(d => (d.x1-d.x0 > 70 && d.y1-d.y0 > 40) ? d.data.employment+"M" : "");

  drawLegend();
  renderStats();
  renderTable();
  updateFilterStatus();
}
function fit(s, w){ const max = Math.floor(w/6.6); return s.length>max ? s.slice(0,max-1)+"…" : s; }

function updateFilterStatus(){
  const el = document.getElementById("status");
  if(!filter){ return; }   // leave any prompt message in place when no filter
  const sub = DATA.filter(inFilter);
  const emp = Math.round(d3.sum(sub, d=>d.employment));
  el.innerHTML = `Filtered → <b style="color:var(--ink)">${filter.label}</b> · ${sub.length} groups · ${emp}M jobs &nbsp;<a id="clr">✕ clear</a>`;
  document.getElementById("clr").onclick = () => { filter = null; setStatus(""); render(); };
}
function setFilter(lo, hi, top, label){
  if(filter && filter.lo===lo && filter.hi===hi){ filter = null; setStatus(""); }  // toggle off
  else filter = {lo, hi, top, label};
  render();
}

// --- tooltip ----------------------------------------------------------------
function showTip(ev, d){
  const o = d.data, cs = customScores ? Math.round((customScores[o.name]??0)*100) : null;
  const ty = ev.clientY + 14 > innerHeight - 160 ? ev.clientY - 150 : ev.clientY + 14;
  tip.style("opacity",1)
     .style("left", Math.min(ev.clientX+14, innerWidth-250)+"px")
     .style("top",  ty+"px")
     .html(`<h4>${o.name}</h4>
       <div class="row"><span>Group</span><b>${o.group}</b></div>
       <div class="row"><span>Workers</span><b>${o.employment} M</b></div>
       <div class="row"><span>Median pay</span><b>${INR(o.wage)}/mo</b></div>
       <div class="row"><span>Education</span><b>${EDU[o.education]}</b></div>
       <div class="row"><span>Formal contract</span><b>${Math.round(o.formality*100)}%</b></div>
       <div class="row"><span>AI exposure</span><b>${(o.ai*10).toFixed(1)}/10</b></div>
       ${cs!==null ? `<div class="row"><span>Prompt score</span><b>${(cs/10).toFixed(1)}/10</b></div>`:""}`);
}
function hideTip(){ tip.style("opacity",0); }

// --- legend (single ramp) ---------------------------------------------------
function drawLegend(){
  if(layer==="group"){
    const items = Object.entries(GROUP_COLORS)
      .map(([k,c])=>`<div class="sw"><i style="background:${c}"></i>${k}</div>`).join("");
    legend.html(`<div class="ttl">Occupation group</div><div class="swatches">${items}</div>`);
    return;
  }
  const stops = d3.range(0,1.001,0.1).map(t=>RAMP(t)).join(",");
  const title = {wage:"Median pay", education:"Education", formality:"Job formality",
                 ai:"Generative-AI exposure", custom: customScores?"Prompt score":"Run a prompt →"}[layer];
  legend.html(`<div class="ttl">${title}</div>
    <div class="grad" style="background:linear-gradient(90deg,${stops})"></div>
    <div class="grad-lab"><span>Low</span><span>High</span></div>`);
}

// ============================================================================
//  Stats strip — reactive to the active layer (mirrors Karpathy's header)
// ============================================================================
function fmtEmp(m){ return m>=1 ? Math.round(m)+"M" : Math.round(m*1000)+"k"; }
function bar(width, color){ return `<span class="mb"><i style="width:${Math.round(width)}%;background:${color}"></i></span>`; }

function renderStats(){
  const metric = LAYER_NAME[layer];
  // job-weighted average score on a 0–10 scale
  const wSum = d3.sum(DATA, d=> scoreNorm(d)*10*d.employment);
  const avg = wSum / TOTAL_EMP;

  // histogram: employment in each 0–10 bin
  const bins = new Array(10).fill(0);
  DATA.forEach(d=>{ let b=Math.min(9, Math.floor(scoreNorm(d)*10)); bins[b]+=d.employment; });
  const bMax = Math.max(...bins);
  const hist = bins.map((v,i)=>{ const lo=i/10, hi=(i+1)/10, on=filter&&filter.lo===lo&&filter.hi===hi;
    return `<i class="${on?'on':''}" data-flo="${lo}" data-fhi="${hi}" data-ftop="${i===9?1:0}" data-flabel="score ${i}–${i+1}" title="${i}–${i+1}: ${fmtEmp(v)} — click to filter" style="height:${(v/bMax)*42}px;background:${RAMP((i+0.5)/10)}"></i>`; }).join("");

  // 5 exposure tiers
  const tiers = [["Minimal","0–2"],["Low","2–4"],["Moderate","4–6"],["High","6–8"],["Very high","8–10"]]
    .map(([lab,rng],i)=>{ const lo=i*2/10, hi=(i+1)*2/10;
      const emp=d3.sum(DATA.filter(d=>{const s=scoreNorm(d);return s>=lo && (i===4? s<=hi : s<hi);}), d=>d.employment);
      return {lab,emp,col:RAMP((i*2+1)/10)}; });
  const tMax = Math.max(...tiers.map(t=>t.emp))||1;
  const tierRows = tiers.map((t,i)=>{ const lo=i*2/10, hi=(i+1)*2/10, on=filter&&filter.lo===lo&&filter.hi===hi;
    return `<div class="srow clk ${on?'on':''}" data-flo="${lo}" data-fhi="${hi}" data-ftop="${i===4?1:0}" data-flabel="${t.lab} (${i*2}–${(i+1)*2})"><span class="lab">${t.lab}</span>${bar(t.emp/tMax*100,t.col)}<span class="num">${fmtEmp(t.emp)}</span><span class="pct">${Math.round(t.emp/TOTAL_EMP*100)}%</span></div>`; }).join("");

  // avg score within pay buckets
  const payB = [["<₹12k",0,12000],["₹12–18k",12000,18000],["₹18–30k",18000,30000],["₹30–60k",30000,60000],["₹60k+",60000,1e9]];
  const payRows = payB.map(([lab,lo,hi])=>{ const sub=DATA.filter(d=>d.wage>=lo&&d.wage<hi);
      const e=d3.sum(sub,d=>d.employment); const a= e? d3.sum(sub,d=>scoreNorm(d)*10*d.employment)/e : 0;
      return `<div class="srow"><span class="lab">${lab}</span>${bar(a/10*100,RAMP(a/10))}<span class="num">${a.toFixed(1)}</span></div>`; }).join("");

  // avg score by education level
  const eduRows = [5,4,3,2,1].map(lvl=>{ const sub=DATA.filter(d=>d.education===lvl);
      const e=d3.sum(sub,d=>d.employment); const a= e? d3.sum(sub,d=>scoreNorm(d)*10*d.employment)/e : 0;
      const lab=["","No formal","Primary","Secondary","Higher-sec/Dip","Graduate+"][lvl];
      return `<div class="srow"><span class="lab">${lab}</span>${bar(a/10*100,RAMP(a/10))}<span class="num">${a.toFixed(1)}</span></div>`; }).join("");

  // annual wage bill of jobs in the top tier (score ≥ 7), in ₹ trillion
  const topT = d3.sum(DATA.filter(d=>scoreNorm(d)>=0.7), d=> d.wage*12*d.employment/1e6);

  document.getElementById("stats").innerHTML = `
    <div class="stat"><div class="k">Total jobs</div><div class="v">${Math.round(TOTAL_EMP)}M</div><div class="vsub">usual-status workers</div></div>
    <div class="stat"><div class="k">Avg ${metric}</div><div class="v" style="color:${RAMP(avg/10)}">${avg.toFixed(1)}</div><div class="vsub">job-weighted, 0–10</div></div>
    <div class="stat"><div class="k">Jobs by ${metric}</div><div class="hist">${hist}</div><div class="hist-ax"><span>0</span><span>5</span><span>10</span></div></div>
    <div class="stat"><div class="k">${metric} tiers</div>${tierRows}</div>
    <div class="stat"><div class="k">${metric} by pay</div>${payRows}</div>
    <div class="stat"><div class="k">${metric} by education</div>${eduRows}</div>
    <div class="stat"><div class="k">Wages in top tier (≥7)</div><div class="v" style="color:${RAMP(0.85)}">₹${topT.toFixed(1)}T</div><div class="vsub">annual, jobs scoring ≥7</div></div>`;
}

// --- dataset switching ------------------------------------------------------
d3.selectAll("#datasets button").on("click", function(){ setDataset(this.dataset.d); });

// --- click a histogram bin or tier row to filter the treemap ----------------
document.getElementById("stats").addEventListener("click", e=>{
  const el = e.target.closest("[data-flo]"); if(!el) return;
  setFilter(+el.dataset.flo, +el.dataset.fhi, el.dataset.ftop==="1", el.dataset.flabel);
});

// --- layer switching --------------------------------------------------------
d3.selectAll("#layers button").on("click", function(){
  layer = this.dataset.k;
  filter = null;            // a filter set for one metric doesn't carry to another
  d3.selectAll("#layers button").classed("on", false);
  d3.select(this).classed("on", true);
  setStatus(layer==="custom" && !customScores ? "Type a prompt and hit Score to colour this layer." : "");
  render();
});
function recolor(){
  svg.selectAll("rect.tile").transition().duration(350).attr("fill", colorOf);
  drawLegend(); renderStats();
}

// ============================================================================
//  Prompt scoring (offline heuristic; swap for a real LLM API if desired)
// ============================================================================
const KEYS = {
  automation:["automat","robot","machine","replace","ai ","artificial"],
  manual:    ["manual","physical","hand","labour","labor","body","outdoor","field"],
  cognitive: ["think","analy","creativ","decision","knowledge","write","design","cognit"],
  routine:   ["routine","repetit","predictab","data","entry","clerical"],
  risk:      ["risk","danger","hazard","safety","unsafe"],
  pay:       ["pay","salary","wage","earn","income","money"],
};
const hits = (q, arr) => { q=q.toLowerCase(); return arr.some(k=>q.includes(k.trim())); };
function scoreByHeuristic(q, o){
  const manual = 1-(o.education-1)/4, cognitive=(o.education-1)/4, routine=o.ai;
  const payNorm = Math.min(1,(o.wage-8000)/72000);
  let s = 0.5;
  if(hits(q,KEYS.automation)) s = 0.6*o.ai + 0.4*routine;
  else if(hits(q,KEYS.manual)) s = manual;
  else if(hits(q,KEYS.cognitive)) s = cognitive;
  else if(hits(q,KEYS.routine)) s = routine;
  else if(hits(q,KEYS.risk)) s = 0.7*manual + 0.3*(1-o.formality);
  else if(hits(q,KEYS.pay)) s = payNorm;
  else s = 0.5*o.ai + 0.25*manual + 0.25*payNorm;
  return Math.max(0, Math.min(1, s));
}
async function runPrompt(){
  const q = document.getElementById("q").value.trim();
  if(!q){ setStatus("Enter a prompt first."); return; }
  const btn = document.getElementById("run"); btn.disabled = true;
  setStatus("Scoring " + DATA.length + " occupations…");
  await new Promise(r=>setTimeout(r,250));
  customScores = {}; DATA.forEach(o => customScores[o.name] = scoreByHeuristic(q, o));
  layer = "custom"; filter = null;
  d3.selectAll("#layers button").classed("on", false);
  d3.select("#customBtn").classed("on", true);
  render(); btn.disabled = false;
  setStatus(`Coloured by: “${q}” (heuristic). Hover a tile for its score.`);
}
document.getElementById("run").onclick = runPrompt;
document.getElementById("q").addEventListener("keydown", e=>{ if(e.key==="Enter") runPrompt(); });
function setStatus(t){ document.getElementById("status").textContent = t; }

// ============================================================================
//  Full data table — every occupation, sortable + paginated
// ============================================================================
let tPage = 0, tSize = 50, tSort = { key: "employment", dir: -1 };
const COLS = [
  { key:"name",       label:"Occupation",  fmt:o=>`<span class="gdot" style="background:${GROUP_COLORS[o.group]||'#888'}"></span>${o.name}`, cls:"" },
  { key:"group",      label:"Group",       fmt:o=>o.group, cls:"grp" },
  { key:"employment", label:"Workers (M)", fmt:o=>o.employment.toFixed(1) },
  { key:"wage",       label:"Median pay",  fmt:o=>INR(o.wage)+"/mo" },
  { key:"education",  label:"Education",   fmt:o=>EDU[o.education] },
  { key:"formality",  label:"Formal %",    fmt:o=>Math.round(o.formality*100)+"%" },
  { key:"ai",         label:"AI /10",      fmt:o=>(o.ai*10).toFixed(1) },
];
function rowsForTable(){
  const rows = DATA.filter(inFilter).slice();
  const k = tSort.key, d = tSort.dir;
  rows.sort((a,b)=>{
    let av = k==="custom" ? (customScores?.[a.name]??0) : a[k];
    let bv = k==="custom" ? (customScores?.[b.name]??0) : b[k];
    if(typeof av==="string") return d * av.localeCompare(bv);
    return d * (av - bv);
  });
  return rows;
}
function renderTable(){
  const all = rowsForTable();
  const size = tSize, pages = Math.max(1, Math.ceil(all.length / size));
  if(tPage >= pages) tPage = pages - 1;
  const start = tPage * size, page = all.slice(start, start + size);

  const cols = COLS.slice();
  if(customScores) cols.push({ key:"custom", label:"Prompt /10", fmt:o=>((customScores[o.name]??0)*10).toFixed(1) });

  const head = cols.map(c=>{
    const s = tSort.key===c.key ? (tSort.dir<0?"s-desc":"s-asc") : "";
    return `<th class="${s}" data-sort="${c.key}">${c.label}</th>`;
  }).join("");
  const body = page.map(o=>"<tr>"+cols.map(c=>`<td class="${c.cls||''}">${c.fmt(o)}</td>`).join("")+"</tr>").join("");
  document.getElementById("tablehost").innerHTML =
    `<table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;

  const m = window.DATASET_META[dataset];
  document.getElementById("tablecap").textContent =
    `${all.length} occupations${filter?" (filtered)":""} · ${m.badge}. Click a column to sort.`;
  document.getElementById("pageinfo").textContent =
    `${all.length?start+1:0}–${Math.min(start+size, all.length)} of ${all.length}`;
  document.getElementById("prev").disabled = tPage<=0;
  document.getElementById("next").disabled = tPage>=pages-1;

  document.querySelectorAll("table.data th").forEach(th=>th.onclick=()=>{
    const k = th.dataset.sort;
    if(tSort.key===k) tSort.dir *= -1;
    else tSort = { key:k, dir: (k==="name"||k==="group") ? 1 : -1 };
    tPage = 0; renderTable();
  });
}
document.getElementById("prev").onclick = ()=>{ tPage--; renderTable(); };
document.getElementById("next").onclick = ()=>{ tPage++; renderTable(); };
document.getElementById("pagesize").onchange = e=>{ tSize = +e.target.value; tPage = 0; renderTable(); };

// --- boot + responsive ------------------------------------------------------
setDataset("real");
let rt; addEventListener("resize", ()=>{ clearTimeout(rt); rt=setTimeout(render,120); });
