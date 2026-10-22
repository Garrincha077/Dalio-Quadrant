import {validateLab,labStudy,netWealth} from './lib/research-lab.mjs';
const $=id=>document.getElementById(id),finite=Number.isFinite;
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const num=(v,d=3)=>finite(v)?v.toFixed(d):'—',pct=v=>finite(v)?`${(v*100).toFixed(2)}%`:'—';
const tr=c=>`<tr>${c.map((v,i)=>i?`<td>${v}</td>`:`<th scope="row">${v}</th>`).join('')}</tr>`;
const table=(caption,headers,rows)=>`<div class="table-wrap" role="region" tabindex="0" aria-label="${esc(caption)}; scroll horizontally"><table><caption>${esc(caption)}</caption><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const next=m=>new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7),1)).toISOString().slice(0,7);
function chart(study,risk){
 const keys=['adaptive','market',risk?'past-risk':'mean'],colors=['#e2b752','#64b5f6','#60d6ab'];
 const lines=keys.map(k=>netWealth(study.strategies[k].rows)),values=lines.flatMap(r=>r.map(p=>p.value));
 const low=Math.min(.9,...values),high=Math.max(1.1,...values),width=820,height=240,left=52,right=16,top=18,bottom=30;
 const x=(i,n)=>left+i/Math.max(1,n-1)*(width-left-right),y=v=>top+(high-v)/(high-low)*(height-top-bottom);
 let svg=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Growth of one dollar after transaction costs; identical holding months"><title>Net portfolio growth on shared holding months</title>`;
 for(const v of [low,(low+high)/2,high])svg+=`<path d="M${left} ${y(v)}H${width-right}" stroke="#293447"/><text x="2" y="${y(v)+4}" fill="#a7b3c5" font-size="12">$${v.toFixed(2)}</text>`;
 lines.forEach((r,k)=>{svg+=`<path d="${r.map((p,i)=>`${i?'L':'M'}${x(i,r.length).toFixed(2)} ${y(p.value).toFixed(2)}`).join(' ')}" fill="none" stroke="${colors[k]}" stroke-width="2"/>`;});
 const rows=study.strategies.market.rows;
 svg+=`<text x="${left}" y="${height-6}" fill="#a7b3c5" font-size="12">${rows[0].month}</text><text x="${width-right}" y="${height-6}" text-anchor="end" fill="#a7b3c5" font-size="12">${rows.at(-1).month}</text></svg>`;
 return svg+`<div class="chart-legend">${keys.map((k,i)=>`<span style="color:${colors[i]}">● ${k==='adaptive'?'Adaptive selection':k==='market'?'Market reference':risk?'Past risk only':'Historical-average model'}</span>`).join('')}</div>`;
}
export function createResearchLabView(){
 let data=null;
 const host=$('researchLab');
 const label=m=>data.modelLabels[m]||({'past-risk':'Past 36-month risk only'}[m])||m;
 function current(){return labStudy(data,$('labQuestion').value,$('labHorizon').value,$('labCohort').value);}
 async function load(){
  host.innerHTML='<p class="status" role="status">Loading the complete experiment ledger…</p>';
  try{
   const response=await fetch('/data/research-lab.json',{cache:'no-cache'});if(!response.ok)throw Error();
   const candidate=await response.json();if(!validateLab(candidate))throw Error();data=candidate;
   host.innerHTML=`<article class="panel"><div class="eyebrow">Research lab · ${esc(data.asOf)} information cutoff</div><h2>Which version earns its extra complexity?</h2>
    <p class="note"><strong>Incremental macro advantage remains unconfirmed.</strong> All ${data.attemptCount} predictor configurations and ${data.selectorProcedureCount} additional portfolio-selection procedures are retained. Historical periods were already seen in earlier research. Some comparisons improve, but the tested procedures have not met the stronger evidence criteria.</p>
    <div class="evidence-three"><div><span class="evidence-badge">Forecast ranking</span><p>Does macro improve the order of future asset returns beyond market trend and risk?</p></div><div><span class="evidence-badge">Forecast risk</span><p>Does macro improve future monthly-return risk estimates?</p></div><div><span class="evidence-badge">Portfolio utility</span><p>Does choosing settings by earlier net performance improve the actual portfolio?</p></div></div>
    <div class="state-controls evidence-controls"><label for="labQuestion">Research question<select id="labQuestion"><option value="portfolio">Portfolio utility selection</option><option value="ranking">Return-ranking selection</option><option value="risk">Risk forecasting</option></select></label><label for="labHorizon">Horizon<select id="labHorizon"><option value="12">12 months</option><option value="3">3 months</option></select></label><label for="labCohort">Matched sample<select id="labCohort"><option value="main">Market + macro · longer coverage</option><option value="value">Value + price · separate shorter sample</option></select></label></div>
    <p id="labStatus" class="status" role="status" aria-live="polite"></p><p id="labMethod" class="sub"></p><div id="labModels"></div><details><summary>Simple reference portfolios on these same holding months</summary><div id="labReferences"></div></details>
    <div id="labChart"></div><p class="sub">Growth of $1 after costs. All policies in this view share the same holding calendar. The 10% volatility cap limits exposure without leverage; realised risks differ. Forecast starts overlap and are not independent trials.</p></article>
    <article class="panel"><h2>Inspect the decision before its outcome</h2><div class="state-controls evidence-controls"><label for="labModel">Selected procedure<select id="labModel"></select></label><label for="labDate">Decision month<select id="labDate"></select></label></div><div id="labForecast"></div></article>
    <article class="panel"><h2>Did the improvement survive the checks?</h2><div id="labComparisons"></div><p class="sub">Positive prediction difference favours macro. Intervals describe historical paired differences, not future return ranges. Correction covers six prediction-primary and ten policy-primary comparisons across this research round. Other tests are exploratory. Economic checks require higher net return, no more than 110% of the reference volatility and no worse monthly drawdown.</p><details><summary>Fixed calendar periods</summary><div id="labFolds"></div></details></article>
    <article class="panel"><h2>Every attempted configuration stays visible</h2><p class="sub">120 predictor configurations: 84 return-ranking and 36 risk configurations. Each family has the same six regularisation/history settings. The 18 utility selectors reuse the return predictions. No result below is a configuration selected in advance by its full-history performance.</p><div id="labAttempts"></div></article>
    <article class="panel"><h2>How this research can be checked</h2><p>Settings are chosen from earlier out-of-sample outcomes that were already known at each cutoff. Portfolio utility selection charges the selected strategy's actual switching costs. This causal timing does not erase the fact that the overall research design used previously inspected history.</p><p class="sub">Macro changes compare published state estimates three calendar months apart; they include revisions and are not surprises relative to market forecasts. Price momentum, price z and value z remain different measures. The separate value sample cannot be compared directly with the longer sample.</p><p class="sub">Independent verification refitted ${data.audit.predictionChecks.toLocaleString()} estimates, checked ${data.audit.selectionChecks.toLocaleString()} selector decisions and reconstructed ${data.audit.policyChecks.toLocaleString()} monthly policy rows. Every earlier frozen study remains separate below.</p><p><a href="/data/research-lab.json" download>Download the complete experiment ledger · JSON</a> · <a href="https://github.com/Garrincha077/Dalio-Quadrant/tree/codex/history-predictive-evidence/scripts/research/v4" target="_blank" rel="noopener">Protocols, code and reproduction</a></p><details><summary>Protocol and source receipts</summary><div id="labHashes" class="sub"></div></details></article>`;
   $('labHashes').innerHTML=table('Frozen protocols and exact input bundle',['Receipt','SHA-256'],[['Ranking',data.protocolSha256],['Risk extension',data.riskProtocolSha256],['Utility extension',data.policyProtocolSha256],['Input sources',data.inputSha256]].map(r=>tr(r.map(esc))));
   $('labQuestion').addEventListener('change',()=>{const risk=$('labQuestion').value==='risk';$('labHorizon').value=risk?'3':'12';if(risk)$('labCohort').value='main';render();});
   for(const id of ['labHorizon','labCohort'])$(id).addEventListener('change',render);
   for(const id of ['labModel','labDate'])$(id).addEventListener('change',forecast);
   render();
  }catch{host.innerHTML='<article class="panel"><h2>Research lab unavailable</h2><p>The independently verified experiment ledger could not be loaded.</p><button id="labRetry" type="button">Retry research lab</button></article>';$('labRetry').addEventListener('click',load);}
 }
 function render(){
  const question=$('labQuestion').value,risk=question==='risk',utility=question==='portfolio',h=$('labHorizon').value,s=current();
  $('labCohort').disabled=risk;const models=Object.keys(s.models),base=s.models.market;
  $('labStatus').textContent=`${h}-month ${risk?'risk forecasts':'return estimates'} · ${base.first}–${base.last} · ${base.n} completed overlapping starts · ${s.coverage.holdingMonths} holding months · ${s.coverage.cashFallbackMonths} cash fallback months.`;
  $('labMethod').textContent=risk?'Settings selected by earlier risk-forecast loss (QLIKE; lower is better). Target is the annualised future monthly excess-return second moment. A simple past-risk estimate is included as a separate comparator.':utility?'Settings selected by the last 36 known monthly portfolio returns, with at least 24 required, after costs. The selected strategy pays for its own actual changes in holdings.':'Settings selected by up to 60 earlier mature out-of-sample rank correlations, with at least 24 required. Predictors use market trend/risk, macro changes and declared interactions.';
  const headers=['Procedure',risk?'Risk loss · lower better':'Rank correlation','Net CAGR','Excess Sharpe','Volatility','Max drawdown','CAGR · 25 bp'];
  const rows=keys=>keys.map(m=>{const p=s.strategies[m];return tr([esc(label(m)),num(s.models[m]?.[risk?'meanQLIKE':'meanRankIC']),pct(p.cagr),num(p.sharpe),pct(p.volatility),pct(p.maxDrawdown),pct(p.cagrAt25bps)]);});
  $('labModels').innerHTML=table('Same sample, costs and risk constraints',headers,rows(models));
  $('labReferences').innerHTML=table('Passive references · identical holding calendar',headers,rows(Object.keys(s.strategies).filter(m=>!models.includes(m))));
  $('labChart').innerHTML=chart(s,risk);
  const prevModel=$('labModel').value,prevDate=$('labDate').value;
  $('labModel').innerHTML=models.map(m=>`<option value="${m}">${esc(label(m))}</option>`).join('');$('labModel').value=models.includes(prevModel)?prevModel:'adaptive';
  $('labDate').innerHTML=s.forecastRows.slice().reverse().map(r=>`<option value="${r.month}">${r.month}${r.common?'':' · outcome incomplete'}</option>`).join('');
  if(s.forecastRows.some(r=>r.month===prevDate))$('labDate').value=prevDate;
  $('labComparisons').innerHTML=table('Incremental results against the selected market model',['Procedure','Prediction gain / 95% interval','Net Sharpe gain / 95% interval','Adjusted p · prediction / policy','Economic checks','Evidence'],s.comparisons.map(c=>{
   const t=c.ranking||c.prediction,p=c.policy,interval=t=>t?.available?`${num(t.difference)} [${num(t.lower95)}, ${num(t.upper95)}]`:'Exploratory ranking only';
   const gates=Object.entries(c.economicGates).map(([k,v])=>`${v?'✓':'✗'} ${k==='higherNetCAGR'?'Net return':k==='comparableRisk'?'Risk':'Drawdown'}`).join(' · ');
   return tr([esc(label(c.model)),interval(t),interval(p),`${t?.holmP!==undefined?num(t.holmP):'exploratory'} / ${p.holmP!==undefined?num(p.holmP):'exploratory'}`,gates+(c.historicalMeanGates?`<br><small>Also beats mean policy on all gates: ${Object.values(c.historicalMeanGates).every(Boolean)?'yes':'no'}</small>`:''),esc(c.status)]);
  }));
  $('labFolds').innerHTML=table(utility?'Annual mean excess returns by holding period':'Prediction quality by decision period',['Period',...models.map(m=>esc(label(m)))],Object.entries(s.folds).map(([period,stats])=>tr([esc(period),...models.map(m=>utility?pct(stats[m].annualMeanExcess):num(stats[m][risk?'meanQLIKE':'meanRankIC']))])));
  const attempts=(risk?s:data.horizons[h][$('labCohort').value]).attempts;
  $('labAttempts').innerHTML=table(risk?'All configurations · current risk sample':'All configurations · each full causal prediction history; longer than selector evaluation',['Family','Ridge λ','Training window','Prediction dates','Starts',risk?'Risk loss':'Rank correlation'],attempts.map(c=>{
   const r=risk?c.risk:c.fullCandidateHistory;return tr([esc(c.family),c.alpha,c.window?`Last ${c.window} mature starts`:'Expanding',`${r.first}–${r.last}`,r.n,num(r[risk?'meanQLIKE':'meanRankIC'])]);
  }));forecast();
 }
 function forecast(){
  const s=current(),risk=$('labQuestion').value==='risk',model=$('labModel').value,row=s.forecastRows.find(r=>r.month===$('labDate').value),meta=row.methods[model];
  const holding=s.strategies[model].rows.find(r=>r.month===next(row.month));
  $('labForecast').innerHTML=`<p class="note"><span class="evidence-badge">Historical reconstruction</span> Information through ${row.cutoff}; hypothetical execution ${row.tradeDate}. ${meta?.selectionCount?`${meta.training} mature training starts; setting ${esc(meta.candidate)} selected from ${meta.selectionCount} earlier outcomes, last known by ${meta.selectionLastMaturity}.`:'Matched reference without setting selection.'}</p>`+
   table(risk?'Annualised monthly-return risk proxy; not intramonth volatility':`${s.horizon}-month cumulative excess return over cash`,['Asset','Estimate','Mature realised outcome','Next-month risky allocation'],data.assets.map((a,i)=>tr([a,pct(risk?Math.sqrt(row.predictions[model][i]):row.predictions[model][i]),finite(row.outcomes[i])?pct(risk?Math.sqrt(row.outcomes[i]):row.outcomes[i]):'Not yet complete',holding?pct(holding.weights[i+1]):'Holding outcome not yet available'])))+
   `<p class="sub">${holding?`Cash allocation ${pct(holding.weights[0])}; net holding-month return ${pct(holding.return)}.`:'The research source history does not yet contain the next completed holding month.'} Historical estimates are not recorded live forecasts or calibrated probabilities.</p>`;
 }
 return {load};
}
