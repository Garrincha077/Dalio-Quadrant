const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const pct=v=>Number.isFinite(v)?`${(100*v).toFixed(2)}%`:'—';
const pp=v=>Number.isFinite(v)?`${v>0?'+':''}${(100*v).toFixed(2)} pp`:'—';
const names={fixed:'Fixed quadrants',calibrated:'Learned quadrant boundaries',linear:'Continuous linear response',curved:'Continuous curved response',selected:'Selected by past forecast error',timing_selected:'Selected by past entry lift'};
const assets={SPY:'US equities · SPY',IEF:'Treasuries · IEF',GLD:'Gold · GLD',TIP:'Inflation-linked bonds · TIP',DBC:'Commodities · DBC',EQUITY:'US equities',TREASURY:'Treasuries',GOLD:'Gold',COMMODITIES:'Commodities'};
export function modelScore(model,input){
 const kind=model.spec.family;
 if(kind==='unconditional')return 0;
 if(kind==='fixed'||kind==='calibrated'){
  const a=input[0]-model.spec.a,p=input[1]-model.spec.p;
  if(Math.abs(a)<=1e-9||Math.abs(p)<=1e-9)return 0;
  return model.cellScores[(a>0?2:0)+(p>0?1:0)];
 }
 const x=input.map((v,i)=>Math.max(model.clipLow[i],Math.min(model.clipHigh[i],v)));
 const b=kind==='curved'?[...x,x[0]**2,x[1]**2,x[0]*x[1]]:x;
 return b.reduce((sum,v,i)=>sum+(v-model.means[i])/model.scales[i]*model.beta[i],0);
}
function modelLabel(model){
 const s=model.spec;
 if(s.family==='unconditional')return 'No macro entry selected';
 if(s.family==='fixed'||s.family==='calibrated')return `Quadrants · activity ${s.a.toFixed(2)} / PCE ${s.p.toFixed(1)}%`;
 return `${s.family==='curved'?'Curved':'Linear'} · ${s.halfLife?'10-year history half-life':'full history'}`;
}
export function responseMap(model,deltaA=0,deltaP=0){
 const xs=[-1,-.75,-.5,-.25,0,.25,.5,.75,1],ys=[6,5,4,3,2,1,0];
 const values=ys.flatMap(p=>xs.map(a=>({a,p,value:modelScore(model,[a,p,deltaA,deltaP])})));
 const bound=Math.max(.01,...values.map(v=>Math.abs(v.value)));
 let svg='<svg viewBox="0 0 650 370" role="group" aria-label="Last fitted macro return response. Each focusable cell reports model lift above its training usual return; this is not realised future performance.">';
 values.forEach((v,i)=>{
  const x=70+(i%9)*60,y=25+Math.floor(i/9)*40,color=v.value>=0?'#60d6ab':'#ff7b83';
  const label=`Activity ${v.a.toFixed(2)}, PCE ${v.p.toFixed(1)}%; estimated lift ${pp(v.value)}. Fixed 3M changes: ${deltaA} activity / ${deltaP} inflation pp.`;
  svg+=`<rect tabindex="0" data-surface-label="${esc(label)}" aria-label="${esc(label)}" x="${x}" y="${y}" width="58" height="38" fill="${color}" fill-opacity="${.12+.75*Math.abs(v.value)/bound}"><title>${esc(label)}</title></rect>`;
 });
 xs.forEach((v,i)=>svg+=`<text x="${100+i*60}" y="326" text-anchor="middle" fill="#a7b3c5" font-size="12">${v.toFixed(2)}</text>`);
 ys.forEach((v,i)=>svg+=`<text x="53" y="${50+i*40}" text-anchor="end" fill="#a7b3c5" font-size="12">${v}%</text>`);
 svg+='<path d="M340 25 V305 M70 205 H610" stroke="#e2b752" stroke-dasharray="4 4" pointer-events="none"/><text x="340" y="353" text-anchor="middle" fill="#a7b3c5" font-size="13">Activity relative to trend</text><text x="8" y="14" fill="#a7b3c5" font-size="12">PCE YoY</text></svg>';
 return svg;
}
export function resultTable(target){
 return `<div class="table-wrap"><table><caption>Later-period entry screens · ${target.horizon}M cumulative net return lift</caption><thead><tr><th>Procedure</th><th>Lift</th><th>Selected / scored starts</th><th>Episodes</th><th>Unadjusted 95% interval</th></tr></thead><tbody>${Object.entries(target.results).map(([k,r])=>`<tr><th scope="row">${names[k]}</th><td>${pp(r.lift)}</td><td>${r.selectedStarts} / ${r.nScored}</td><td>${r.episodes??'—'}${r.supported?'':' · thin'}</td><td>${r.liftCI95?r.liftCI95.map(pp).join(' to '):'Unavailable'}</td></tr>`).join('')}</tbody></table></div>`;
}
export function initLearnedResearch(){
 const root=document.getElementById('researchLearnedEntry');
 if(!root||root.dataset.initialized)return;
 root.dataset.initialized='true';let started=false;
 async function load(){
  if(started)return;started=true;
  let data;
  try{const response=await fetch('/data/learned-entry.json');if(!response.ok)throw new Error();data=await response.json();if(data.version!=='learned-entry-1')throw new Error();}
  catch{root.textContent='Learned entry research unavailable. No fitted entry signal is shown.';return;}
  root.innerHTML=`<div class="eyebrow">Learning from history · chronological evaluation</div><h2>Can learned conditions identify better later entries?</h2><p>Models learn from completed past outcomes, then score later months. The main procedure selects its model using <strong>earlier entry lift</strong>; a separate forecast-error selector remains visible. The economic map keeps its original zero/2% anchors.</p>
  <div class="state-controls"><label>Information set <select id="learnedInformation"><option value="vintage">Actual archived macro vintages</option><option value="revised">Today's revised macro history</option></select></label><label>Assets <select id="learnedPanel"><option value="etf">Actual ETFs</option><option value="long">Long public proxies</option></select></label><label>Horizon <select id="learnedHorizon"><option value="3">3 months</option><option value="12" selected>12 months</option><option value="36">36 months</option></select></label></div>
  <p id="learnedCoverage" class="sub"></p><div id="learnedOverview" class="table-wrap"></div>
  <div class="state-controls"><label>Inspect asset <select id="learnedAsset"></select></label><label>Inspect procedure <select id="learnedPolicy">${Object.entries(names).map(([k,n])=>`<option value="${k}"${k==='timing_selected'?' selected':''}>${n}</option>`).join('')}</select></label></div>
  <div id="learnedResults"></div><p id="learnedEvidence" class="note"></p>
  <details><summary>Revised versus vintage procedures on identical dates</summary><div id="learnedCommon" class="table-wrap"></div></details>
  <h3>Inspect the last fitted response shape</h3><p id="learnedModelDate" class="sub"></p><div class="state-controls"><label>Activity change / 3M <select id="learnedDeltaA"><option value="-0.2">−0.20</option><option value="0" selected>0.00</option><option value="0.2">+0.20</option></select></label><label>Inflation change / 3M <select id="learnedDeltaP"><option value="-0.4">−0.40 pp</option><option value="0" selected>0.00 pp</option><option value="0.4">+0.40 pp</option></select></label></div>
  <div id="learnedResponse"></div><p id="learnedSurfaceReadout" class="sub" aria-live="polite">Tap or focus a cell to inspect its fitted response.</p>
  <p class="sub">Green means positive fitted lift, red negative. Dashed lines mark the descriptive economic anchors. Colours describe the model's training-derived response, not proven future returns or probabilities. Continuous inputs outside the training 1st/99th percentiles are clipped; the map can flatten at its edges.</p>
  <details><summary>How did the model choice change over time?</summary><div id="learnedRefits" class="table-wrap"></div></details>
  <details><summary>Method and evidence limits</summary><p>Four macro inputs: activity, PCE inflation and their three-month changes. Seventeen candidates: nine nearby quadrant boundaries plus linear/curved ridge models with two smoothing strengths and full/recent history. The curved model has seven features. Annual January refits require 60 matured labels.</p><p>Earlier January-origin validation folds choose parameters; training labels finish before their refit and validation labels before the later selection date. Entry requires a positive fitted lift above the model's training 75th-percentile score. The cutoff is never chosen from future evaluation scores. Insufficient validation uses a declared strong linear fallback. Coverage need not equal 25%.</p><p>Vintage mode uses each refit date's then-published historical reconstruction, and each target month's own exact prior-day snapshot, with a fixed two-reference-month lag. This permits learning from older backcasts already published at refit, without claiming pre-2001 CFNAI trading availability. Actual archives begin May 2011. Market return histories were collected for research; long proxies include reconstructed bonds and average gold and end May 2025.</p><p>Results are cumulative USD after 10 bp per entry/exit side, compared with the same asset on identical scored dates. Intervals use 5,000 calendar-block resamples, block max(12,h). They are unadjusted; Holm results and repetition counts are disclosed. The entry-lift selector is an explicitly disclosed exploratory extension of the original mean-error experiment. Previously researched windows are not untouched holdouts.</p></details>
  <p><a href="/data/learned-entry.csv" download>Download dated entry-screen decisions</a> · <a href="/data/learned-entry.json" download>Download model traces and research JSON</a></p>`;
  const get=id=>root.querySelector('#'+id);
  function panel(){return data.panels.find(p=>p.panel===get('learnedPanel').value&&p.information===get('learnedInformation').value);}
  function updateAssets(){const p=panel(),old=get('learnedAsset').value,map={SPY:'EQUITY',IEF:'TREASURY',GLD:'GOLD',DBC:'COMMODITIES',EQUITY:'SPY',TREASURY:'IEF',GOLD:'GLD',COMMODITIES:'DBC'};get('learnedAsset').innerHTML=Object.keys(p.assets).map(a=>`<option value="${a}">${assets[a]||a}</option>`).join('');if(p.assets[old])get('learnedAsset').value=old;else if(p.assets[map[old]])get('learnedAsset').value=map[old];}
  function target(){return panel().targets.find(t=>t.asset===get('learnedAsset').value&&t.horizon===Number(get('learnedHorizon').value));}
  function surface(){const p=panel(),t=target(),f=t.refits.at(-1),policy=get('learnedPolicy').value;if(!f){get('learnedModelDate').textContent='';get('learnedSurfaceReadout').textContent='';get('learnedResponse').textContent='No fitted model.';return;}const m=p.models[f.models[policy]];get('learnedModelDate').textContent=`Fitted ${m.refitMonth}${m.vintageCutoff?' · macro vintage '+m.vintageCutoff:''} · ${modelLabel(m)} · ${m.n} training labels · latest training exit ${m.lastTrainingExit}. This fitted frontier can include years whose future holdings are not yet mature; it is not a live recommendation.`;get('learnedResponse').innerHTML=responseMap(m,+get('learnedDeltaA').value,+get('learnedDeltaP').value);get('learnedSurfaceReadout').textContent='Tap or focus a cell to inspect its fitted response.';get('learnedResponse').querySelectorAll('[data-surface-label]').forEach(cell=>{const show=()=>get('learnedSurfaceReadout').textContent=cell.dataset.surfaceLabel;cell.addEventListener('pointerenter',show);cell.addEventListener('focus',show);cell.addEventListener('click',show);});}
  function redraw(){const p=panel(),t=target(),h=t.horizon,r=t.results[get('learnedPolicy').value];get('learnedCoverage').textContent=`${p.information==='vintage'?'Actual macro archives at the refit and signal dates.':'Revised-history research; historical revisions can affect results.'} Price inputs ${p.priceStart}–${p.priceEnd}.${p.panel==='long'?' Reconstructed and monthly-average proxy prices are not executable trading closes.':''} Current asset/horizon: ${r.nScored} scored starts, ${r.firstEntry||'unavailable'}–${r.lastEntry||'unavailable'}, last complete exit ${r.lastExit||'unavailable'}.`;
   get('learnedOverview').innerHTML=`<table><caption>Objective-aligned learned entry procedure versus fixed quadrants · ${h}M lift above each asset's own usual return</caption><thead><tr><th>Asset</th><th>Learned lift</th><th>Fixed-quadrant lift</th><th>Learned starts / episodes</th></tr></thead><tbody>${p.targets.filter(x=>x.horizon===h).map(x=>{const a=x.results.timing_selected,b=x.results.fixed;return `<tr><th scope="row">${assets[x.asset]}</th><td>${pp(a.lift)}</td><td>${pp(b.lift)}</td><td>${a.selectedStarts} / ${a.episodes??'—'}${a.supported?'':' · thin'}</td></tr>`;}).join('')}</tbody></table>`;
   get('learnedResults').innerHTML=resultTable(t);get('learnedEvidence').textContent=`${names[get('learnedPolicy').value]}: ${r.mean===null||r.mean===undefined?'no selected entry result.':`selected mean ${pct(r.mean)} versus usual ${pct(r.usualMean)}; lift ${pp(r.lift)}.`} ${r.supported?'At least 24 starts and six episodes; dependence remains.':'Too few repeated starts/episodes for a strong interpretation.'} ${r.holmP!==null&&r.holmP!==undefined?'Holm-adjusted p '+r.holmP.toFixed(3)+'.':''} This is research evidence, not confirmed prospective entry skill.`;
   const c=data.commonDateComparison.find(c=>c.panel===p.panel&&c.asset===t.asset&&c.horizon===h);get('learnedCommon').innerHTML=c?`<table><caption>${c.nCommon} identical dates · ${c.firstEntry}–${c.lastEntry}; point estimates</caption><thead><tr><th>Information</th><th>Timing selector lift</th><th>Fixed-quadrant lift</th></tr></thead><tbody>${Object.entries(c.results).map(([i,v])=>`<tr><th scope="row">${i}</th><td>${pp(v.timing_selected.lift)}</td><td>${pp(v.fixed.lift)}</td></tr>`).join('')}</tbody></table><p class="sub">Source histories and the prior validation information available to the procedures differ. This does not isolate revisions alone.</p>`:'No matching information-set comparison.';
   get('learnedRefits').innerHTML=`<table><caption>Most recent annual fits, including fitted frontiers without matured outcomes</caption><thead><tr><th>Refit</th><th>Chosen shape</th><th>Earlier validation</th><th>Scored starts</th></tr></thead><tbody>${t.refits.slice(-10).map(f=>`<tr><th scope="row">${f.refitMonth}</th><td>${esc(modelLabel(p.models[f.models[get('learnedPolicy').value]]))}</td><td>${f.fallback?'Declared fallback':`${f.folds} folds / ${f.nValidation} predictions`}</td><td>${f.scoredEntries}</td></tr>`).join('')}</tbody></table>`;surface();}
  for(const id of ['learnedInformation','learnedPanel'])get(id).addEventListener('change',()=>{updateAssets();redraw();});
  for(const id of ['learnedAsset','learnedHorizon','learnedPolicy'])get(id).addEventListener('change',redraw);
  for(const id of ['learnedDeltaA','learnedDeltaP'])get(id).addEventListener('change',surface);
  updateAssets();redraw();
 }
 document.getElementById('tab-research')?.addEventListener('click',()=>void load());
 if(!document.getElementById('research')?.hidden)void load();
}
