import {BOTTOMING_RULES,classifyBottoming} from './lib/bottoming.mjs';
const $=id=>document.getElementById(id),finite=Number.isFinite;
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const num=(v,d=2)=>finite(v)?v.toFixed(d):'—',pct=v=>finite(v)?`${(100*v).toFixed(1)}%`:'—';
const tr=c=>`<tr>${c.map((v,i)=>`<${i?'td':'th scope="row"'}>${v}</${i?'td':'th'}>`).join('')}</tr>`;
const table=(caption,heads,rows)=>`<div class="table-wrap" role="region" tabindex="0" aria-label="${esc(caption)}; scroll horizontally"><table><caption>${esc(caption)}</caption><thead><tr>${heads.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
export function createBottomingView(){
 let data=null,busy=false,live=null,liveError=false;
 const host=$('bottomingView');
 function current(){
  const s=live||data?.latest;if(!s)return;
  const c=classifyBottoming(s.inputs||s),saved=!live;
  $('bottomingCurrent').innerHTML=`<div class="eyebrow">${saved?'Saved research snapshot':'Refreshed weekly inputs'} · week ending ${esc(s.week)}</div><h2>${c.level===null?`Uncertain: L${c.lower}–L${c.upper}`:`L${c.level} · ${esc(c.label)}`}</h2>
   <p role="status">${saved?'Live refresh unavailable. Saved information cutoff '+esc(data.asOf)+'.':'Fetched '+esc(s.fetchedAt)+'.'} ${c.complete?'All three inputs match the completed index week.':`Incomplete inputs: ${Object.entries(c.inputs).filter(([,v])=>v===null).map(([k])=>k.toUpperCase()).join(', ')}. A missing value is not a normal reading.`}</p>
   <div class="evidence-three">${[['Weekly RSI(14)',c.inputs.rsi,'^GSPC'],['VIX close',c.inputs.vix,'VIXCLS'],['HY OAS · %',c.inputs.hy,'BAMLH0A0HYM2']].map(([label,v,source])=>`<div><span class="evidence-badge">${label}</span><p class="bottoming-value">${num(v)}</p><p class="sub">${esc(source)} · ${finite(v)?esc(s.priceDate):'Matching observation unavailable'}</p></div>`).join('')}</div>
   <p class="note">${!saved&&c.complete&&s.newSignal?'New level increase on a completed week.':'Repeated levels do not create a new level-increase signal.'} These levels measure stress severity; they do not confirm that the market has reached its bottom.</p><p class="sub">Weekly Wilder RSI period 14 is an explicit assumption: the supplied screenshots show weekly RSI without its period. L1/L2 require any two conditions; L3 requires all three. The highest satisfied level wins. No notifications are sent.</p>`;
  $('bottomingRefreshStatus').textContent=busy?'Refreshing weekly inputs…':liveError?'Live source unavailable; retry or inspect the dated research snapshot.':'';
 }
 async function refresh(){
  if(busy)return;busy=true;current();
  try{const response=await fetch('/api/bottoming',{cache:'no-store',signal:AbortSignal.timeout(18000)});if(!response.ok)throw Error();
   const candidate=await response.json();if(candidate.methodVersion!=='bottoming-0-3-1'||!candidate.week||!candidate.inputs||!candidate.readings)throw Error();
   live=candidate;liveError=false;
  }catch{live=null;liveError=true;}finally{busy=false;current();}
 }
 async function load(){
  if(data){refresh();return;}
  host.innerHTML='<p role="status">Loading the verified bottoming study…</p>';
  try{const response=await fetch('/data/bottoming.json',{cache:'no-cache'});if(!response.ok)throw Error();const d=await response.json();
   if(d.version!=='bottoming-research-5'||d.audit?.status!=='Independent source reconstruction passed'||!d.studies?.archive||!d.archiveWeeks?.length)throw Error();data=d;
   host.innerHTML=`<article class="panel"><div id="bottomingCurrent"></div><button id="bottomingRefresh" type="button">Refresh weekly inputs</button><p id="bottomingRefreshStatus" class="status" role="status"></p><details><summary>Exact rules from the supplied screenshots</summary>${table('Highest satisfied level is assigned',['Level','Weekly RSI','VIX close','HY OAS','Required'],BOTTOMING_RULES.map(r=>tr([`L${r.level} · ${r.label}`,`≤${r.rsi}`,`≥${r.vix}`,`≥${r.hy}%`,r.required===3?'All 3':'Any 2 of 3'])))}</details></article>
    <article class="panel"><div class="eyebrow">Historical event study · ${esc(data.asOf)} cutoff</div><h2>What happened after stress appeared?</h2><p class="note"><strong>Predictive edge remains unconfirmed.</strong> These are retrospective event returns, with few independent crises. Positive historical outcomes are not calibrated probabilities or a portfolio CAGR. Entry can precede a substantial further fall.</p>
    <div class="state-controls evidence-controls"><label for="bottomingCohort">Source cohort<select id="bottomingCohort"><option value="archive">Three inputs · verified HY archive</option><option value="full">Three inputs · original FRED vintages only</option><option value="two">Two-input RSI + VIX ablation</option></select></label><label for="bottomingHorizon">Holding horizon<select id="bottomingHorizon"><option value="252">252 trading sessions · primary ≈12M</option><option value="126">126 sessions · exploratory</option><option value="63">63 sessions · exploratory</option><option value="21">21 sessions · exploratory</option></select></label></div><p id="bottomingCoverage" class="status" role="status"></p><div id="bottomingResults"></div><p class="sub">SPY adjusted-close returns, after 10 bp on entry and exit; a 25 bp stress case is included. First qualifying week after a known nonqualifying week; repeated qualifying weeks are not new episodes. A separate cooldown for each horizon retains the first entry and skips overlapping entries. Execution is at the close of the second SPY session after the completed week. Worst adverse move uses daily adjusted closes and includes the entry day.</p>
    <details><summary>Overlapping unconditional weekly reference</summary><div id="bottomingReference"></div><p class="sub">Same source-eligible calendar and horizon, without signal filtering or cooldown. These starts overlap and are not an independent or paired estimate of an advantage.</p></details></article>
    <article class="panel"><h2>Inspect every episode and the further losses</h2><label for="bottomingRule">Entry rule<select id="bottomingRule"></select></label><div id="bottomingEntries"></div><p class="sub">Macro and z-score context below was last available by each entry cutoff. It is displayed for investigation and has not been fitted to select successful episodes.</p><label for="bottomingEntry">Episode context<select id="bottomingEntry"></select></label><div id="bottomingContext"></div></article>
    <article class="panel"><h2>Weekly severity history</h2><div id="bottomingChart"></div><label for="bottomingWeek">Inspect completed week<select id="bottomingWeek"></select></label><div id="bottomingInspection"></div></article>
    <article class="panel"><h2>Sources and verification</h2><p>The supplied HY file covers ${esc(d.archiveReceipt.first)}–${esc(d.archiveReceipt.last)}: ${d.archiveReceipt.nonmissing.toLocaleString()} observations and ${d.archiveReceipt.blanks} explicit blanks. All ${d.archiveReceipt.matched} overlapping observations match official FRED exactly; no HY threshold crossings differ. Older rows lack original publication vintages. Where original FRED snapshots exist, their availability is retained without archive replacement.</p><p>Modern VIX comparison starts after its September 2003 launch. Earlier VIX history was reconstructed and is excluded. Full original HY vintages begin in October 2023. Each cohort remains separate. Missing observations are never filled.</p><p class="sub">Independent reconstruction checked ${d.audit.classificationChecks.toLocaleString()} weekly classifications, ${d.audit.entryChecks.toLocaleString()} event entries and ${d.audit.outcomeChecks} mature event outcomes against the source files. All earlier macro/value research is preserved.</p><p><a href="${esc(d.archiveReceipt.url)}" target="_blank" rel="noopener">Pinned user HY archive</a> · <a href="https://fred.stlouisfed.org/series/BAMLH0A0HYM2" target="_blank" rel="noopener">Official HY series</a> · <a href="https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv" target="_blank" rel="noopener">Official VIX history</a> · <a href="/data/bottoming.json" download>Download evidence JSON</a> · <a href="https://github.com/Garrincha077/Dalio-Quadrant/tree/codex/history-predictive-evidence/scripts/research/v5" target="_blank" rel="noopener">Frozen protocols and reproduction</a></p><details><summary>Exact source receipts and limitations</summary><div class="sub">${table('Immutable receipts',['Receipt','SHA-256'],[['Original protocol',d.protocolSha256],['Archive extension protocol',d.archiveProtocolSha256],['Archive CSV',d.archiveReceipt.sha256],['Original source bundle',d.sourceManifestSha256]].map(r=>tr(r.map(esc))))}<ul>${d.limitations.map(l=>`<li>${esc(l)}</li>`).join('')}</ul></div></details></article>`;
   $('bottomingRefresh').addEventListener('click',refresh);
   for(const id of ['bottomingCohort','bottomingHorizon'])$(id).addEventListener('change',render);
   $('bottomingRule').addEventListener('change',entries);$('bottomingEntry').addEventListener('change',context);$('bottomingWeek').addEventListener('change',inspection);
   render();current();refresh();
  }catch{host.innerHTML='<article class="panel"><h2>Bottoming evidence unavailable</h2><p>The verified study could not be loaded.</p><button id="bottomingRetry">Retry bottoming study</button></article>';$('bottomingRetry').addEventListener('click',load);}
 }
 const study=()=>data.studies[$('bottomingCohort').value],history=()=>$('bottomingCohort').value==='archive'?data.archiveWeeks:data.weeks;
 function render(){
  const s=study(),h=$('bottomingHorizon').value,archive=$('bottomingCohort').value==='archive';
  $('bottomingCoverage').textContent=`${s.first}–${s.last} · ${s.eligibleWeeks} eligible completed weeks. ${archive?'Earlier HY values are a retrospective archive; they are not original release vintages.':s.label}`;
  const heads=['Rule','Mature events','Mean net return','Median','Positive outcomes','Worst adverse move','Mean · 25 bp','Skipped / immature'];
  const row=(label,s)=>tr([esc(label),s.n,pct(s.meanNetReturn),pct(s.medianNetReturn),s.n?`${Math.round(s.positiveShare*s.n)} / ${s.n}`:'No mature events',pct(s.worstMAE),pct(s.meanStressReturn),`${s.overlapSkipped} / ${s.unmatured}`]);
  $('bottomingResults').innerHTML=table('Nonoverlapping episodes; small samples need caution',heads,Object.values(s.rules).map(r=>row(r.label,r.horizons[h].stats)));
  $('bottomingReference').innerHTML=table('Descriptive reference; overlapping starts',heads,[row('All eligible weeks',s.unconditional[h])]);
  const selected=$('bottomingRule').value;$('bottomingRule').innerHTML=Object.entries(s.rules).map(([k,r])=>`<option value="${k}">${esc(r.label)}</option>`).join('');if(s.rules[selected])$('bottomingRule').value=selected;
  entries();const rows=history(),known=rows.filter(r=>r.level!==null),width=850,height=160;
  $('bottomingChart').innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Weekly stress severity, 0 to 3. Unknown levels omitted"><title>Weekly bottoming stress severity</title>${[0,1,2,3].map(l=>`<text x="0" y="${130-l*36}" fill="currentColor" font-size="12">L${l}</text><path d="M30 ${126-l*36}H840" stroke="#293447"/>`).join('')}<path d="${rows.map((r,i)=>r.level===null?'':`M${(30+i/(rows.length-1)*810).toFixed(1)} 126V${126-r.level*36}`).join(' ')}" stroke="#e2b752"/><text x="30" y="155" fill="currentColor" font-size="12">${rows[0].week}</text><text x="840" y="155" text-anchor="end" fill="currentColor" font-size="12">${rows.at(-1).week}</text></svg><p class="sub">${known.length} exact levels; ${rows.length-known.length} uncertain weeks omitted. Severity levels do not represent a recovery sequence.</p>`;
  $('bottomingWeek').innerHTML=rows.slice().reverse().map(r=>`<option value="${r.week}">${r.week} · ${r.level===null?`uncertain L${r.lower}–L${r.upper}`:`L${r.level}`}</option>`).join('');inspection();
 }
 function entries(){
  const result=study().rules[$('bottomingRule').value].horizons[$('bottomingHorizon').value];
  $('bottomingEntries').innerHTML=table('Every setup retained, including skipped and immature entries',['Signal week','Execution','RSI','VIX','HY %','Level','Status','Net return','Adverse move'],result.entries.map(r=>tr([r.week,r.executionDate,num(r.rsi),num(r.vix),num(r.hy),r.level===null?`L${r.lower}–L${r.upper}`:`L${r.level}`,esc(r.status),pct(r.netReturn),pct(r.mae)])));
  $('bottomingEntry').innerHTML=result.entries.map((r,i)=>`<option value="${i}">${r.week} · ${esc(r.status)}</option>`).join('');$('bottomingEntry').disabled=!result.entries.length;context();
 }
 function context(){
  const r=study().rules[$('bottomingRule').value].horizons[$('bottomingHorizon').value].entries[$('bottomingEntry').value];
  $('bottomingContext').innerHTML=r?`<p class="sub">Information cutoff ${r.cutoff}; macro cutoff ${r.context.macroCutoff||'unavailable'}; z-score cutoff ${r.context.scoreCutoff||'unavailable'}.</p>`+table('Previously available context; no selection fitted',['Activity','Inflation gap','Growth momentum','Inflation momentum','SPY value z','SPY price z'],[tr(['activity','inflationGap','growthMomentum','inflationMomentum','spyValueZ','spyPriceZ'].map(k=>num(r.context[k],3)))]):'<p>No episodes for this rule and source cohort.</p>';
 }
 function inspection(){
  const row=history().find(r=>r.week===$('bottomingWeek').value),c=classifyBottoming(row);
  $('bottomingInspection').innerHTML=`<p class="sub">Price date ${row.priceDate}; decision cutoff ${row.cutoff}; execution ${row.executionDate}. HY source: ${esc(row.hySource||'FRED original vintage; unavailable where missing')}. ${row.complete?'Complete inputs.':'Incomplete inputs.'}</p>`+table('Condition inspector · highest satisfied level',['Level','RSI condition','VIX condition','HY condition','Known matches','Result'],c.levels.map(r=>tr([`L${r.level}`,`${num(row.rsi)} ≤${r.rsi}: ${truth(r.conditions.rsi)}`,`${num(row.vix)} ≥${r.vix}: ${truth(r.conditions.vix)}`,`${num(row.hy)} ≥${r.hy}%: ${truth(r.conditions.hy)}`,`${r.matches} / ${r.required}`,r.confirmed?'Met':r.possible?'Uncertain':'Not met'])));
 }
 const truth=v=>v===null?'missing':v?'yes':'no';
 return {load};
}
