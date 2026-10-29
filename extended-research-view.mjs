const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const pct = value => Number.isFinite(value) ? `${(100*value).toFixed(2)}%` : '—';
const labels = {'state-trend':'State + trend / 12M sleeves','unconditional':'Unconditional selection / 12M sleeves','state-only':'State without trend / 12M sleeves','equal-weight':'Equal-weight basket / ramped','equity':'US equities / ramped','60-40':'60/40 equities–Treasuries / ramped','cash':'Cash'};

export function extendedChart(study, cost='10') {
  const names=['state-trend','unconditional','equity'], colors=['#e2b752','#60d6ab','#87b6ff'];
  const series=names.map(name=>study.costCases[cost].growthOf100[name]);
  const maximum=Math.max(...series.flat()), minimum=Math.min(...series.flat());
  const lower=Math.log(minimum), span=Math.max(Math.log(maximum)-lower,.01);
  const x=i=>50+i*560/(series[0].length-1), y=v=>205-(Math.log(v)-lower)*175/span;
  let chart=`<svg viewBox="0 0 640 245" role="img" aria-label="Monthly growth of 100 dollars on a logarithmic vertical scale, at ${esc(cost)} basis points assumed cost per buy/sell. Exact statistics follow in the table.">`;
  for(let i=0;i<4;i++) {
    const v=Math.exp(lower+i*span/3);
    chart+=`<path d="M50 ${y(v)} H610" stroke="#293447"/><text x="3" y="${y(v)+4}" fill="#a7b3c5" font-size="11">$${v.toFixed(0)}</text>`;
  }
  series.forEach((values,k)=>{
    chart+=`<polyline points="${values.map((v,i)=>`${x(i)},${y(v)}`).join(' ')}" fill="none" stroke="${colors[k]}" stroke-width="2"/>`;
  });
  chart+=`<text x="50" y="232" fill="#a7b3c5" font-size="12">${esc(study.actualDecisionStart)}</text><text x="610" y="232" text-anchor="end" fill="#a7b3c5" font-size="12">${esc(study.lastPriceMonth)}</text></svg>`;
  return chart+`<div class="chart-legend">${names.map((n,i)=>`<span style="color:${colors[i]}">● ${labels[n]}</span>`).join('')}</div>`;
}

export function renderExtendedStudy(report, cost='10') {
  const s=report.returnStudy;
  if(s?.status!=='complete') return '<p>Return study unavailable. No strategy result is shown.</p>';
  const long=s.panelVersion==='long-public-proxy-1';
  const c=s.costCases[cost], comparison=c.comparison, ci=comparison.interval95;
  return `<p class="note"><strong>${long?'Exploratory long history using revised data and reconstructed asset proxies.':'Retrospective ETF simulation using revised macro data.'} Predictive edge: unconfirmed.</strong> ${long?'Monthly average gold and reconstructed bonds are not executable month-end prices.':'A two-month delay does not remove economic revision bias.'} This is separate from the existing 2021–2025 momentum experiment and is not a publication-vintage test.</p>
  <p>Decisions ${esc(s.actualDecisionStart)}–${esc(s.decisions.at(-1).decisionMonth)} · portfolio valued through ${esc(s.lastPriceMonth)} · ${c.results['state-trend'].months} monthly returns · USD · ${esc(cost)} bp per risky buy/sell leg.</p>
  <p class="sub">Every new monthly sleeve holds its chosen asset for 12 months; the portfolio starts with 12 cash sleeves. A missing signal affects the new sleeve; existing holdings continue. Fixed-allocation controls introduce risk over the same first 12 decisions. No leverage or taxes. Drawdowns use monthly observations.</p>
  <div class="table-wrap"><table><caption>Same-period portfolio results · assumed ${esc(cost)} bp trading cost</caption><thead><tr><th>Policy</th><th>CAGR</th><th>Monthly max drawdown</th><th>Volatility</th></tr></thead><tbody>${Object.entries(c.results).map(([name,r])=>`<tr><th scope="row">${labels[name]||esc(name)}</th><td>${pct(r.cagr)}</td><td>${pct(r.monthlyMaxDrawdown)}</td><td>${pct(r.volatility)}</td></tr>`).join('')}</tbody></table></div>
  <p>Annual arithmetic mean advantage over unconditional selection: <strong>${pct(comparison.annualMeanDifference)}</strong>${ci?`; paired 95% interval ${pct(ci[0])} to ${pct(ci[1])}`:'; insufficient history for an uncertainty interval'}. ${ci&&ci[0]<=0&&ci[1]>=0?'The interval includes zero; an advantage is not established.':'Retrospective uncertainty does not establish a prospective edge.'}</p>
  <details><summary>Sources and timing</summary><ul>${Object.values(s.assets).map(a=>`<li>${esc(a.instrument)} · ${esc(a.source)}${a.reconstructed||a.backcast?' · reconstructed history':''}</li>`).join('')}</ul><p>${esc(s.cash.instrument)}. ${s.sourceLimitations.map(esc).join(' ')}</p><p>Original sources stay private; the downloadable research contains derived portfolio returns, dated decisions and input hashes. Unfinished 12-month outcomes are excluded from training and completed-outcome diagnostics.</p></details>`;
}

export async function loadExtendedResearch() {
  const root=document.getElementById('researchExtended');
  if(!root) return;
  const files=['extended-long-state.json','extended-state.json'];
  const loaded=await Promise.allSettled(files.map(async file=>{
    const response=await fetch(`/data/${file}`);
    if(!response.ok) throw new Error('Research unavailable');
    const report=await response.json();
    if(report.version!=='extended-state-1'||!Array.isArray(report.stateHistory?.quadrants)) throw new Error('Unsupported research');
    return report;
  }));
  const reports=loaded.map(r=>r.status==='fulfilled'?r.value:null);
  if(!reports.some(Boolean)) {
    root.textContent='Extended research unavailable. No return result is shown.';
    return;
  }
  const h=reports.find(Boolean).stateHistory;
  root.innerHTML=`<div class="eyebrow">Separate state + trend research</div><h2>Long history and asset selection</h2><p>Economic reference states: <strong>${esc(h.first)}–${esc(h.last)}</strong> · ${h.months} months. This revised history is descriptive; CFNAI was first published in March 2001.</p>
  <div class="controls"><label>Study <select id="extendedPanel">${reports.map((r,i)=>r?`<option value="${i}">${i===0?'Long public proxies · 1980–2025':'ETF simulation · 2013–2026'}</option>`:'').join('')}</select></label><label>Cost per buy/sell <select id="extendedCost"><option value="10">10 bp</option><option value="25">25 bp</option><option value="50">50 bp</option><option value="0">Before trading costs</option></select></label></div>
  <p class="sub">The 1973–2026 target is only partly covered: the common public proxy inputs run 1973-01–2025-05, with 1973–1979 used for initial learning. AQR commodity data stops in May 2025. A full target-period index study and publication-vintage validation remain pending.</p>
  <h3>Growth of $100 · log scale</h3><div id="extendedChart"></div><p class="sub" id="extendedChartNote"></p><div id="extendedResults"></div>
  <details><summary>Economic state coverage since 1967</summary><div class="table-wrap"><table><caption>Revised states; overlapping economic episodes are not independent trials</caption><thead><tr><th>State</th><th>Months</th><th>Share</th><th>Episodes</th><th>Longest run / months</th></tr></thead><tbody>${h.quadrants.map(q=>`<tr><th scope="row">${esc(q.label)}</th><td>${q.months}</td><td>${pct(q.share)}</td><td>${q.episodes}</td><td>${q.longestRun}</td></tr>`).join('')}</tbody></table></div></details>
  <p><a href="/data/extended-long-state.json" download>Download long proxy research</a> · <a href="/data/extended-state.json" download>Download ETF research</a></p>`;
  const panel=root.querySelector('#extendedPanel'), cost=root.querySelector('#extendedCost');
  function redraw() {
    const r=reports[Number(panel.value)];
    root.querySelector('#extendedResults').innerHTML=renderExtendedStudy(r,cost.value);
    const complete=r.returnStudy?.status==='complete';
    root.querySelector('#extendedChart').innerHTML=complete?extendedChart(r.returnStudy,cost.value):'';
    root.querySelector('#extendedChartNote').textContent=complete?'Monthly observations; losses inside a month can be larger. Chart and table use the selected trading cost.':'';
  }
  panel.addEventListener('change',redraw);cost.addEventListener('change',redraw);redraw();
}
