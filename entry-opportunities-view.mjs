const esc = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const pct = v => Number.isFinite(v) ? `${(100*v).toFixed(2)}%` : '—';
const pp = v => Number.isFinite(v) ? `${v>0?'+':''}${(100*v).toFixed(2)} pp` : '—';
const states={'above-above':'Activity above trend · inflation above 2%','above-below':'Activity above trend · inflation below 2%','below-above':'Activity below trend · inflation above 2%','below-below':'Activity below trend · inflation below 2%','boundary':'On an economic anchor'};
const families={'state':'State only','state-trend':'State + direction','state-trend-distance':'State + direction + distance'};
const assetNames={EQUITY:'US equities',TREASURY:'US Treasuries',GOLD:'Gold',COMMODITIES:'Broad commodities',SPY:'US equities · SPY',IEF:'US Treasuries · IEF',GLD:'Gold · GLD',TIP:'Inflation-linked bonds · TIP',DBC:'Broad commodities · DBC'};
export function conditionLabel(key) {
  const [state,trend,strength]=key.split('|');
  const parts=[states[state]||state];
  if(trend) {const [a,p]=trend.split('/');parts.push(`activity ${a}, inflation ${p}`);}
  if(strength) {const [a,p]=strength.split('/');parts.push(`activity distance ${a}, inflation distance ${p}`);}
  return parts.join(' / ');
}

export function candidateRows(panel, asset, horizon, family, includeThin=false) {
  return panel.cells.filter(c=>c.asset===asset&&c.horizon===Number(horizon)&&c.family===family&&c.condition.split('|')[0]!=='boundary'&&(includeThin||c.supported)).sort((a,b)=>b.lift-a.lift||a.condition.localeCompare(b.condition));
}

export function opportunityOverview(panel,horizon) {
  return `<div class="table-wrap"><table><caption>Best signed quadrant for each asset · ${horizon}M cumulative returns, net of assumed 10 bp per side</caption><thead><tr><th>Asset</th><th>Lift</th><th>Historical leading state</th><th>After state</th><th>Usual return</th><th>Starts / episodes</th></tr></thead><tbody>${Object.keys(panel.assets).map(asset=>{
    const c=candidateRows(panel,asset,horizon,'state')[0];
    return c?`<tr><th scope="row"><button type="button" data-entry-asset="${esc(asset)}">${assetNames[asset]||esc(asset)}</button></th><td>${pp(c.lift)}</td><td>${esc(conditionLabel(c.condition))}</td><td>${pct(c.mean)}</td><td>${pct(c.baseline)}</td><td>${c.n} / ${c.episodes}</td></tr>`:`<tr><th scope="row">${esc(asset)}</th><td colspan="5">Insufficient repeated cases</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

export function liftChart(cells,horizon) {
  if(!cells.length) return '<p>No condition meets the sample requirement for this family. Enable small samples to inspect exploratory cells.</p>';
  const rows=cells.slice(0,6), bound=Math.max(.01,...rows.map(c=>Math.abs(c.lift))), height=55+rows.length*38;
  let svg=`<svg viewBox="0 0 640 ${height}" role="img" aria-label="Top condition lifts above this asset's own average ${horizon}-month cumulative return, in percentage points. Exact values and conditions follow in the table."><path d="M320 16 V${height-20}" stroke="#a7b3c5"/>`;
  rows.forEach((c,i)=>{
    const width=Math.abs(c.lift)/bound*210, start=c.lift>=0?320:320-width, y=25+i*38;
    svg+=`<text x="8" y="${y+13}" fill="#a7b3c5" font-size="12">Condition ${i+1}</text><rect x="${start}" y="${y}" width="${width}" height="20" fill="${c.supported?'#e2b752':'#a7b3c5'}"><title>${esc(conditionLabel(c.condition))}: ${pp(c.lift)}; ${c.n} starts, ${c.episodes} episodes</title></rect><text x="628" y="${y+14}" text-anchor="end" fill="#edf0f6" font-size="12">${pp(c.lift)}</text>`;
  });
  return svg+'</svg>';
}

export function cellDetail(cell,panel) {
  if(!cell) return '<p>No adequately repeated condition to inspect. Small cells remain available as exploratory results.</p>';
  const ci=cell.liftCI95;
  const episodes=panel.leadingEpisodes[cell.id]||[];
  return `<h3>Selected condition</h3><p><strong>${esc(conditionLabel(cell.condition))}</strong></p>
  <div class="metrics"><div class="metric"><strong>${pct(cell.mean)}</strong><span>Mean after condition</span></div><div class="metric"><strong>${pct(cell.baseline)}</strong><span>Same-asset usual ${cell.horizon}M return</span></div><div class="metric"><strong>${pp(cell.lift)}</strong><span>Lift above usual return</span></div></div>
  <p class="note">${cell.supported?'Meets the minimum of 24 starts and six episodes; this does not establish independence or a forecasting edge.':'Small sample: fewer than 24 starts or six episodes. This historical maximum is unsupported.'} ${cell.lift<=0?'Even this leading condition did not exceed the asset\'s usual return. ':''}${ci?`Unadjusted 95% lift interval: ${pp(ci[0])} to ${pp(ci[1])}.`:'Too few valid block samples for an interval.'} ${cell.holmP===null?'No multiplicity claim for this thin cell.':`Holm-adjusted p = ${cell.holmP.toFixed(3)}, across ${panel.supportedComparisons} supported comparisons in this panel.`} None of these results is prospective validation.</p>
  <details><summary>Risk, repetition and sensitivity</summary><div class="table-wrap"><table><tbody>
  <tr><th scope="row">Matched monthly starts / episodes</th><td>${cell.n} / ${cell.episodes}</td></tr>
  <tr><th scope="row">Non-overlapping ${cell.horizon}M starts</th><td>${cell.nonoverlappingStarts}</td></tr>
  <tr><th scope="row">Entry range</th><td>${cell.firstEntry}–${cell.lastEntry}</td></tr>
  <tr><th scope="row">Median / historical P10</th><td>${pct(cell.median)} / ${pct(cell.p10)}</td></tr>
  <tr><th scope="row">Historical loss frequency</th><td>${pct(cell.lossFrequency)}</td></tr>
  <tr><th scope="row">Largest episode share of starts</th><td>${pct(cell.largestEpisodeShare)}</td></tr>
  <tr><th scope="row">Worst lift after removing one episode</th><td>${pp(cell.worstLiftWithoutOneEpisode)}</td></tr>
  <tr><th scope="row">Lift against decade-matched baseline</th><td>${pp(cell.decadeMatchedLift)}</td></tr>
  <tr><th scope="row">Lift outside both anchor buffers</th><td>${pp(cell.outsideBufferLift)} · ${cell.outsideBufferN} starts</td></tr>
  <tr><th scope="row">Mean / lift at 25 bp per side</th><td>${pct(cell.stress25bpMean)} / ${pp(cell.stress25bpLift)}</td></tr>
  </tbody></table></div><p class="sub">Loss frequencies and P10 are historical descriptions, not future probabilities. Non-overlapping starts and distinct episodes still need not be statistically independent.</p></details>
  ${episodes.length?`<details><summary>When did this leading condition occur? · ${episodes.length} episodes</summary><div class="table-wrap"><table><caption>Economic reference windows and two-month-delayed entries; outcomes overlap</caption><thead><tr><th>Reference months</th><th>Entry months</th><th>Starts</th><th>Mean ${cell.horizon}M return</th></tr></thead><tbody>${episodes.map(e=>`<tr><th scope="row">${e.firstReference}–${e.lastReference}</th><td>${e.firstEntry}–${e.lastEntry}</td><td>${e.starts}</td><td>${pct(e.meanReturn)}</td></tr>`).join('')}</tbody></table></div><p class="sub">Each row averages overlapping monthly starts; it is not a separate episode trading strategy.</p></details>`:''}`;
}

function temporalDetail(panel,asset,horizon,family) {
  const t=panel.temporal.find(r=>r.asset===asset&&r.horizon===Number(horizon)&&r.family===family);
  if(!t?.condition) return `<details><summary>Retrospective temporal check</summary><p>No condition met the development sample requirement. No later-period winner was substituted.</p></details>`;
  return `<details><summary>Did an earlier selected condition carry into later years?</summary><p>Development outcomes finished before ${t.split}. The condition selected then was <strong>${esc(conditionLabel(t.condition))}</strong>; it can differ from today's full-sample leader.</p><p>Development lift ${pp(t.developmentLift)} · later lift ${pp(t.laterLift)} · later ${t.laterConditionN} starts / ${t.laterEpisodes} episodes. Later results never choose a replacement winner. These periods were already researched; this is a retrospective temporal check, not an untouched holdout.</p></details>`;
}

export async function loadEntryOpportunities() {
  const root=document.getElementById('researchEntryOpportunities');
  if(!root) return;
  let data;
  try {
    const response=await fetch('/data/entry-opportunities.json');
    if(!response.ok) throw new Error('Unavailable');
    data=await response.json();
    if(data.version!=='entry-opportunities-1'||data.panels?.length!==2) throw new Error('Unsupported');
  } catch {
    root.textContent='Entry opportunity research unavailable. No condition or entry signal is inferred.';
    return;
  }
  root.innerHTML=`<div class="eyebrow">Conditional entry returns · exploratory</div><h2>When did each asset beat its usual return?</h2><p>Rank economic conditions by <strong>mean subsequent return minus the same asset's usual return</strong>, using identical eligible dates and horizons. A high absolute return alone does not define an opportunity.</p>
  <div class="state-controls"><label>History <select id="entryPanel"><option value="etf">Actual ETFs · 2006–2026 inputs</option><option value="long">Long public proxies · 1973–2025 inputs</option></select></label><label>Holding horizon <select id="entryHorizon"><option value="3">3 months</option><option value="12" selected>12 months</option><option value="36">36 months</option></select></label></div>
  <p id="entryCohort" class="sub"></p><div id="entryOverview"></div>
  <h3>Inspect conditions for one asset</h3><div class="state-controls"><label>Asset <select id="entryAsset"></select></label><label>Condition family <select id="entryFamily">${Object.entries(families).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label></div>
  <p><label><input type="checkbox" id="entryThin"> Include small samples (exploratory)</label></p><p id="entryRawMaximum" class="sub"></p>
  <div id="entryLiftChart"></div><div id="entryCandidates" class="table-wrap"></div><label>Inspect condition <select id="entryCondition" style="max-width:100%"></select></label>
  <div id="entryDetail" aria-live="polite"></div><div id="entryTemporal"></div>
  <details><summary>Method, timing and limits</summary><p>All ${data.horizons.join('/')}M outcomes are cumulative nominal USD, net of assumed 10 bp on each entry and exit. They are not annualised or risk-adjusted alpha. Entry is two months after the economic reference month, using revised CFNAI-MA3/PCE pairs. This does not reproduce the historical publication information set. Only fully matured outcomes enter.</p>
  <p>State anchors: activity zero, PCE 2%. Direction is a three-month change with fixed bands ±0.10 activity / ±0.20 inflation pp. Distance bands are near ≤0.10 / ≤0.20 pp, intermediate up to 0.50 / 2.00 pp, and distant beyond. They are descriptive, not return-fitted cutoffs or tail probabilities. Below 2% inflation is not necessarily deflation; below-trend activity is not necessarily a recession.</p>
  <p>All three families share one eligible cohort per asset panel and horizon. Intervals use 5,000 paired calendar-block draws, block length max(12,horizon). Intervals are unadjusted; Holm p-values adjust all adequately supported asset/horizon/condition tests in each panel. Thousands of scanned combinations make raw maxima especially fragile. Long proxies have reconstructed bonds and monthly-average gold; commodities end May 2025. Full and long ETF periods differ.</p>
  <p>The live joint-state method now requires matching reference months and tolerates numerical noise at exact anchors. No historical classifications in this frozen source changed. Asset returns did not choose the axes or category thresholds. The 2% anchor before its formal 2012 adoption is an analytical reference.</p></details>
  <details><summary>Proxy versus ETF on the same entry dates</summary><div id="entryOverlap" class="table-wrap"></div></details>
  <p><a href="/data/entry-opportunities.csv" download>Download all condition results · CSV</a> · <a href="/data/entry-opportunities.json" download>Download methods, temporal checks and JSON</a></p>`;
  const get=id=>root.querySelector('#'+id);
  function panel(){return data.panels.find(p=>p.name===get('entryPanel').value);}
  function updateAssets() {
    const old=get('entryAsset').value,p=panel(),map={EQUITY:'SPY',TREASURY:'IEF',GOLD:'GLD',COMMODITIES:'DBC',SPY:'EQUITY',IEF:'TREASURY',GLD:'GOLD',DBC:'COMMODITIES'};
    get('entryAsset').innerHTML=Object.keys(p.assets).map(a=>`<option value="${a}">${assetNames[a]||a}</option>`).join('');
    if(p.assets[old]) get('entryAsset').value=old;
    else if(p.assets[map[old]]) get('entryAsset').value=map[old];
  }
  function detail(){const p=panel(),c=p.cells.find(c=>c.id===get('entryCondition').value);get('entryDetail').innerHTML=cellDetail(c,p);}
  function redraw() {
    const p=panel(),h=Number(get('entryHorizon').value),a=get('entryAsset').value,f=get('entryFamily').value,co=p.cohorts[h];
    get('entryCohort').textContent=`${co.n} eligible monthly starts · entries ${co.firstEntry}–${co.lastEntry} · final realised exit ${co.lastExit}. Shared dates across assets and condition families. ${p.name==='long'?'Reconstructed public proxies; monthly observations are not all executable closes.':'Actual adjusted ETF closes; revised economic history.'}`;
    get('entryOverview').innerHTML=opportunityOverview(p,h);
    get('entryOverview').querySelectorAll('[data-entry-asset]').forEach(b=>b.addEventListener('click',()=>{get('entryAsset').value=b.dataset.entryAsset;redraw();}));
    const candidates=candidateRows(p,a,h,f,get('entryThin').checked),raw=candidateRows(p,a,h,f,true)[0];
    get('entryRawMaximum').textContent=raw?`Raw full-sample maximum: ${conditionLabel(raw.condition)} · lift ${pp(raw.lift)} · ${raw.n} starts / ${raw.episodes} episodes. ${raw.supported?'Meets the minimum repetition rule.':'Does not meet the minimum repetition rule; not a reliable entry signal.'}`:'No complete outcomes.';
    get('entryLiftChart').innerHTML=liftChart(candidates,h);
    get('entryCandidates').innerHTML=candidates.length?`<table><caption>Top observed conditions for ${esc(assetNames[a]||a)} · ${h}M</caption><thead><tr><th>Condition</th><th>Mean</th><th>Usual</th><th>Lift</th><th>Starts / episodes</th></tr></thead><tbody>${candidates.slice(0,6).map((c,i)=>`<tr><th scope="row">${i+1}. ${esc(conditionLabel(c.condition))}${c.supported?'':' · small sample'}</th><td>${pct(c.mean)}</td><td>${pct(c.baseline)}</td><td>${pp(c.lift)}</td><td>${c.n} / ${c.episodes}</td></tr>`).join('')}</tbody></table>`:'';
    get('entryCondition').innerHTML=candidates.map(c=>`<option value="${esc(c.id)}">${esc(conditionLabel(c.condition))}</option>`).join('');
    get('entryCondition').disabled=!candidates.length;
    get('entryTemporal').innerHTML=temporalDetail(p,a,h,f);
    const overlap=data.sameDateProxyCheck.find(r=>r.horizon===h&&(r.longAsset===a||r.etfAsset===a));
    get('entryOverlap').innerHTML=overlap?`<table><caption>${overlap.firstEntry}–${overlap.lastEntry} · ${overlap.n} shared starts</caption><thead><tr><th>State</th><th>N</th><th>Long proxy lift</th><th>ETF lift</th></tr></thead><tbody>${overlap.states.map(r=>`<tr><th scope="row">${esc(conditionLabel(r.state))}</th><td>${r.n}</td><td>${pp(r.longLift)}</td><td>${pp(r.etfLift)}</td></tr>`).join('')}</tbody></table><p class="sub">Different instruments and return constructions can disagree even on matching dates.</p>`:'No equivalent long proxy exists for inflation-linked bonds in this four-asset panel.';
    detail();
  }
  get('entryPanel').addEventListener('change',()=>{updateAssets();redraw();});
  for(const id of ['entryHorizon','entryAsset','entryFamily','entryThin']) get(id).addEventListener('change',redraw);
  get('entryCondition').addEventListener('change',detail);
  updateAssets();redraw();
}
