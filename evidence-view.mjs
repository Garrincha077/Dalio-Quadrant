import { MODEL_LABELS, filterResearchRows, evaluateRankingRows, validDateRange, cumulativeSeries, scoreForwardRecord } from "./lib/research-evidence.mjs";
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? "—").replace(/[&<>"']/g,(c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const num = (v) => Number.isFinite(v) ? v.toFixed(2) : "—";
const pct = (v) => Number.isFinite(v) ? `${(100*v).toFixed(1)}%` : "—";
const pp = (v) => Number.isFinite(v) ? `${(100*v).toFixed(1)} pp` : "—";
const table = (caption,heads,rows) => `<div class="table-wrap" tabindex="0" role="region" aria-label="${esc(caption)}; scroll horizontally"><table><caption>${esc(caption)}</caption><thead><tr>${heads.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
const tr = (values) => `<tr>${values.map((v,i) => i ? `<td>${v}</td>` : `<th scope="row">${v}</th>`).join("")}</tr>`;

function subperiodMetrics(rows) {
  if (!rows.length) return null;
  let wealth=1,peak=1,drawdown=0,stress=1;
  const excess=rows.map((r) => r.return-r.cash),mean=excess.reduce((s,v) => s+v,0)/rows.length;
  for(const r of rows) { wealth*=1+r.return;peak=Math.max(peak,wealth);drawdown=Math.min(drawdown,wealth/peak-1);stress*=1+r.return-1.5*r.cost; }
  const sd=Math.sqrt(excess.reduce((s,v) => s+(v-mean)**2,0)/(rows.length-1));
  const average=rows.reduce((s,r) => s+r.return,0)/rows.length;
  const volatility=Math.sqrt(rows.reduce((s,r) => s+(r.return-average)**2,0)/(rows.length-1))*Math.sqrt(12);
  return {n:rows.length,cagr:wealth**(12/rows.length)-1,drawdown,volatility,sharpe:sd>0 ? mean/sd*Math.sqrt(12) : null,
    stress:stress**(12/rows.length)-1,turnover:12*rows.reduce((s,r) => s+r.turnover,0)/rows.length};
}

function equityPlot(series) {
  const entries=Object.entries(series).filter(([,r]) => r.length);
  if(!entries.length) return '<p class="sub">No complete strategy outcomes in this view.</p>';
  const width=760,height=260,left=55,right=20,top=20,bottom=40,colors=["#e2b752","#87b6ff","#60d6ab"];
  const months=[...new Set(entries.flatMap(([,rows]) => rows.map((r) => r.month)))].sort();
  const curves=entries.map(([name,rows]) => [name,cumulativeSeries(rows)]);
  const all=[100,...curves.flatMap(([,rows]) => rows.map((r) => r.wealth))];
  const lo=Math.floor(Math.min(...all)*.9/10)*10,hi=Math.ceil(Math.max(...all)*1.05/10)*10;
  const x=(m) => left+months.indexOf(m)/Math.max(1,months.length-1)*(width-left-right),y=(v) => top+(hi-v)/(hi-lo||1)*(height-top-bottom);
  let svg=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly growth of 100 dollars after assumed costs; selected historical view"><title>Selected view: growth of $100, monthly closes</title>`;
  for(let i=0;i<4;i++) { const v=lo+(hi-lo)*i/3;svg+=`<path d="M${left} ${y(v)}H${width-right}" stroke="#293447"/><text x="4" y="${y(v)+4}" fill="#a7b3c5" font-size="12">$${v.toFixed(0)}</text>`; }
  for(const i of [...new Set([0,Math.floor((months.length-1)/2),months.length-1])]) svg+=`<text x="${x(months[i])}" y="${height-8}" fill="#a7b3c5" font-size="12" text-anchor="middle">${months[i]}</text>`;
  curves.forEach(([name,rows],j) => {
    svg+=`<polyline points="${rows.map((r) => `${x(r.month)},${y(r.wealth)}`).join(" ")}" fill="none" stroke="${colors[j]}" stroke-width="2.5"/>`;
    const last=rows.at(-1);svg+=`<circle cx="${x(last.month)}" cy="${y(last.wealth)}" r="4" fill="${colors[j]}"><title>${esc(name)} · ${last.month} · $${last.wealth.toFixed(2)}</title></circle>`;
  });
  return svg+`</svg><div class="chart-legend">${entries.map(([name],i) => `<span style="color:${colors[i]}">● ${esc(name)}</span>`).join("")}</div>`;
}

export function renderLayerEvidence(snapshot) {
  for(const [id,title,description] of [
    ["stateEvidence","Static state","Activity relative to trend and inflation relative to 2%. Historical states use revised data; the asset preference is an exploratory analogue."],
    ["momentumEvidence","Momentum","Direction of change in growth and inflation. The quadrant is descriptive; predictive models are tested separately."]]) {
    const host=$(id);if(!host) continue;
    const state=snapshot?.economicState;
    const dates=id==="stateEvidence" ? [state?.activity?.date,state?.inflation?.date].filter(Boolean).join(" / ") : snapshot?.fetchedAt?.slice(0,10);
    host.innerHTML=`<div><span class="evidence-badge">Observed data</span> <strong>${title}</strong><p class="sub">${description} ${dates ? `Dated ${esc(dates)}.` : "Waiting for fresh observations."}</p></div><button type="button" data-open-research>Inspect evidence & tests →</button>`;
  }
}

export function createEvidenceView() {
  let data=null,history=null,audit=null,ledger=null;
  const host=$("evidenceResearch");
  async function load() {
    host.innerHTML='<p class="status" role="status">Loading source coverage and reproducible research…</p>';
    try {
      [data,history,audit,ledger]=await Promise.all(["research-v2","research-history","evidence-audit","forecast-ledger"].map(async (name) => {
        const r=await fetch(`/data/${name}.json`,{cache:"no-cache"});if(!r.ok) throw new Error("Research source unavailable");return r.json();
      }));
      if(data.version!=="state-momentum-research-2" || history.version!=="research-history-2") throw new Error("Research version mismatch");
      host.innerHTML=`
        <article class="panel evidence-intro">
          <div class="eyebrow">Evidence first · research as of ${esc(data.asOf)}</div>
          <h2>Does state + momentum help predict returns?</h2>
          <p>Compare the location of the economy, its momentum and their combination on the same information and dates. The main test is <strong>12 months</strong>; 3 and 36 months are additional checks.</p>
          <p><button type="button" data-open-asset-scores>Explore the value & price z-score extension →</button></p>
          <div class="evidence-three"><div><span class="evidence-badge">Historical association</span><p>What followed earlier economic states?</p></div><div><span class="evidence-badge">Retrospective predictive check</span><p>What could a model using then-available data have predicted?</p></div><div><span class="evidence-badge">Forward tracking</span><p>What was recorded before a future trade?</p></div></div>
          <p class="note"><strong>Predictive edge remains unconfirmed.</strong> The 12-month combination's advantage over the historical-average model is ${num(data.horizons["12"].comparisons.find((t) => t.against==="unconditional")?.difference)} in rank correlation. ${data.horizons["12"].comparisons.find((t) => t.against==="unconditional")?.lower95<=0 ? "Its uncertainty interval includes zero." : "This is a retrospective result requiring independent forward confirmation."} Historical association and a modelled estimate do not establish a reliable future advantage.</p>
          <p class="sub">The 12-month combination's monthly trading policy earned ${pct(data.horizons["12"].strategies.combined?.cagr)} CAGR versus ${pct(data.horizons["12"].strategies.unconditional?.cagr)} for the historical-average selector, after the same assumed costs and risk rule. A small change in ranking accuracy does not necessarily improve investment results.</p>
        </article>
        <article class="panel"><h2>Compare the models</h2>
          <div class="state-controls evidence-controls">
            <label for="evidenceHorizon">Forecast horizon<select id="evidenceHorizon"><option value="3">3 months · additional check</option><option value="12" selected>12 months · primary</option><option value="36">36 months · additional check</option></select></label>
            <label for="evidenceModel">Focus model<select id="evidenceModel">${Object.entries(MODEL_LABELS).map(([key,name]) => `<option value="${key}" ${key==="combined"?"selected":""}>${name}</option>`).join("")}</select></label>
            <label for="evidencePeriod">Display period<select id="evidencePeriod"><option value="full">Full verified history</option><option value="last20">Last 20 years</option><option value="custom">Custom dates</option></select></label>
            <label for="evidenceStart" id="evidenceStartLabel" hidden>From<input type="month" id="evidenceStart"></label>
            <label for="evidenceEnd" id="evidenceEndLabel" hidden>Through<input type="month" id="evidenceEnd"></label>
          </div>
          <p id="evidenceSelection" class="status" role="status" aria-live="polite"></p>
          <div id="evidenceModels"></div><p class="sub">Rank correlation measures how well the forecast orders the five assets: +1 is a perfect order, 0 no rank relationship, −1 the reverse. Top-choice excess is the realised cumulative return above cash of the first-ranked asset. These monthly windows overlap.</p>
          <details><summary>Why does the predictive test start later than the historical chart?</summary><div id="evidenceMaximum"></div><p class="sub">The main comparison uses identical training eligibility and evaluation dates. Maximum-history results use each model's own available inputs and are not a fair head-to-head comparison. None is an untouched holdout for this new protocol.</p></details>
        </article>
        <article class="panel"><h2>Inspect a dated model estimate</h2><label for="evidenceDecision">Decision month <select id="evidenceDecision"></select></label><div id="evidenceForecast"></div></article>
        <article class="panel"><h2>Strategy returns after costs</h2><p class="sub">Monthly rebalance using the selected forecast horizon. All main strategies target 10% annual volatility from the previous 36 completed months, without leverage. Realised risk can differ. Missing signals use cash.</p><p id="evidenceStrategyWindow" class="sub"></p><div id="evidenceEquity"></div><div id="evidenceStrategies"></div><details><summary>Full-exposure reference portfolios</summary><div id="evidenceRawStrategies"></div></details><p class="sub">Costs: 10 bp per risky buy/sell leg; stress: 25 bp. These are assumptions. Subperiods continue the original holdings and costs; selecting dates does not restart or retrain a strategy. Drawdowns use monthly closes.</p></article>
        <article class="panel"><h2>How strong is the evidence?</h2><div id="evidenceTests"></div><p class="sub">Protocol tests always use the full matched historical sample. The display-period controls do not rerun hypothesis selection. Intervals describe uncertainty in historical rank-correlation differences, not future return ranges. The three primary 12-month comparisons use Holm correction.</p><details><summary>Stability across calendar decades</summary><div id="evidenceDecades"></div></details></article>
        <article class="panel"><div class="eyebrow">Longest verified history</div><h2>More history, with its limits visible</h2><div id="evidenceTimeline"></div><h3>What followed economic states since 1967?</h3><p class="sub">Broad-US-equity research proxy from the Fama/French library. Revised economic states; reference-month entry. This is a descriptive study of the full historical sample, separate from the predictive models and date-filtered strategy view.</p><div id="evidenceLongEquity"></div><details id="evidenceProxyDetails"><summary>Monthly broad-US-equity returns from 1926</summary><p class="sub">Native monthly derived market return = Fama/French market excess + RF. This is a broad market research proxy, not an S&amp;P 500 ETF. Earlier months do not have the present economic-state classifier.</p><div id="evidenceProxyReturns"></div></details><details><summary>Annual context from 1870</summary><p class="sub">US annual research data from Jordà–Schularick–Taylor. Equity and bond coverage start later than bills; missing outcomes stay missing. Annual observations are never converted into invented monthly history or used by the monthly models.</p><div id="evidenceAnnual"></div><p class="sub"><a href="https://www.macrohistory.net/database/" target="_blank" rel="noopener">Source and documentation</a> · CC BY-NC-SA 4.0. Jordà, Schularick & Taylor (2017); Jordà, Knoll, Kuvshinov, Schularick & Taylor (2019). This historical context ends in 2020.</p></details></article>
        <article class="panel"><h2>Source coverage & independent checks</h2><div id="evidenceAudit"></div><details><summary>Source-by-source coverage</summary><div id="evidenceSources"></div></details><details><summary>Read the method and download the evidence</summary><p>Static state: CFNAI-MA3 and PCE YoY minus 2%. Momentum: the existing growth and inflation scores. Their combination uses all four. The same regularised linear model is fitted on past matured outcomes; state + 3M trend is a separate pooled analogue reference.</p><ul>${data.limitations.map((s) => `<li>${esc(s)}</li>`).join("")}</ul><p><a href="https://github.com/Garrincha077/Dalio-Quadrant/blob/codex/history-predictive-evidence/scripts/research/v2/protocol.md" target="_blank" rel="noopener">Fixed protocol</a> · <a href="/data/research-v2.json" download>Model and strategy results · JSON</a> · <a href="/data/research-history.json" download>Historical research · JSON</a> · <a href="/data/evidence-audit.json" download>Source and calculation checks · JSON</a></p><p class="sub">Method hash: ${esc(data.protocolSha256)}. Raw provider prices and credentials are excluded from these downloads.</p></details></article>
        <article class="panel"><h2>Recorded forward forecasts</h2><div id="evidenceLedger"></div></article>`;
      for(const id of ["evidenceHorizon","evidenceModel","evidencePeriod","evidenceStart","evidenceEnd"]) $(id).addEventListener("change",render);
      $("evidenceDecision").addEventListener("change",renderForecast);
      $("evidenceProxyDetails").addEventListener("toggle",() => {
        if($("evidenceProxyDetails").open && !$("evidenceProxyReturns").childElementCount)
          $("evidenceProxyReturns").innerHTML=`<div class="evidence-scroll">${table("Monthly broad-US-equity proxy · full native history",["Month","Market total-return proxy"],(history.equityProxy.monthlyReturns||[]).map((r) => tr([r.month,pct(r.return)])))}</div>`;
      });
      render();
    } catch {
      host.innerHTML='<article class="panel"><h2>Evidence temporarily unavailable</h2><p>The research files could not be verified. No substitute results are shown.</p><button id="evidenceRetry" type="button">Retry research</button></article>';
      $("evidenceRetry").addEventListener("click",load);
    }
  }
  function render() {
    if(!data || !$("evidenceHorizon")) return;
    const h=$("evidenceHorizon").value,m=$("evidenceModel").value,period=$("evidencePeriod").value;
    const start=$("evidenceStart").value,end=$("evidenceEnd").value;
    $("evidenceStartLabel").hidden=$("evidenceEndLabel").hidden=period!=="custom";
    if(period==="custom" && !validDateRange(start,end)) {
      $("evidenceSelection").textContent="Choose a valid date range with From no later than Through. Results are withheld until the dates are valid.";
      for(const id of ["evidenceModels","evidenceMaximum","evidenceEquity","evidenceStrategies","evidenceRawStrategies","evidenceTests","evidenceDecades","evidenceLongEquity","evidenceForecast"]) $(id).innerHTML="";
      return;
    }
    const study=data.horizons[h],filter={period,start,end};
    const rows=filterResearchRows(study.forecastRows,filter);
    const decisions=rows.filter((r) => r.predictions[m].every(Number.isFinite)),priorDecision=$("evidenceDecision").value;
    $("evidenceDecision").innerHTML=decisions.slice().reverse().map((r) => `<option value="${r.month}">${r.month}${r.outcomes.every(Number.isFinite)?"":" · outcomes not complete"}</option>`).join("");
    if(decisions.some((r) => r.month===priorDecision)) $("evidenceDecision").value=priorDecision;
    renderForecast();
    const matched=rows.filter((r) => r.common);
    $("evidenceSelection").textContent=matched.length ? `${h}-month forecast · ${matched[0].month}–${matched.at(-1).month} · ${matched.length} overlapping decision months · ${data.status==="retrospective-walk-forward"?"retrospective research":""}. Display filters do not retrain models.` : "No completed common outcomes in this date range. Try a wider period.";
    $("evidenceModels").innerHTML=table("Forecasts on the same decision months",["Model","Rank correlation","Top-choice excess over cash","Monthly starts"],Object.entries(MODEL_LABELS).map(([key,label]) => {
      const stats=evaluateRankingRows(rows,key),valid=rows.filter((r) => r.common&&r.predictions[key].every(Number.isFinite)&&r.outcomes.every(Number.isFinite));
      const excess=valid.length ? valid.reduce((sum,r) => sum+r.outcomes[r.predictions[key].indexOf(Math.max(...r.predictions[key]))],0)/valid.length : null;
      return tr([`${key===m?"● ":""}${label}`,num(stats.meanRankIC),pct(excess),stats.n]);
    }));
    $("evidenceMaximum").innerHTML=table("Full available history per model · independent of display filter",["Model","Matched test","Maximum-history test","Starts"],Object.entries(study.models).map(([key,v]) => tr([MODEL_LABELS[key],`${esc(v.first)}–${esc(v.last)}`,`${esc(v.maximumHistory.first)}–${esc(v.maximumHistory.last)}`,v.maximumHistory.n])));
    const selectedStrategies={};
    const strategyRows=[],rawRows=[];
    for(const [key,s] of Object.entries(study.strategies)) {
      if(!s?.available) { strategyRows.push(tr([esc(MODEL_LABELS[key]||key),"Unavailable",esc(s?.reason||"Insufficient history"),"—","—","—","—"]));continue; }
      // Strategy rows are HOLDING months, ranking rows are decision months.
      const selected=filterResearchRows(s.rows,filter),stats=subperiodMetrics(selected);
      selectedStrategies[key]=selected;
      const line=tr([esc(MODEL_LABELS[key]||key),pct(stats?.cagr),num(stats?.sharpe),pct(stats?.volatility),pct(stats?.drawdown),pct(stats?.stress),stats?.n??0]);
      (key.endsWith("full exposure")?rawRows:strategyRows).push(line);
    }
    const heads=["Strategy","CAGR","Excess Sharpe","Volatility","Max drawdown","CAGR · 25 bp","Months"];
    $("evidenceStrategies").innerHTML=table("Risk-controlled strategies · realised holding months",heads,strategyRows);
    $("evidenceRawStrategies").innerHTML=table("Full exposure · different risk levels",heads,rawRows);
    $("evidenceEquity").innerHTML=equityPlot({[MODEL_LABELS[m]]:selectedStrategies[m]||[],"Equal five":selectedStrategies["Equal five"]||[],"SPY · risk controlled":selectedStrategies.SPY||[]});
    const policy=selectedStrategies[m]||[];
    $("evidenceStrategyWindow").textContent=policy.length ? `Realised monthly policy outcomes: ${policy[0].month}–${policy.at(-1).month}. The ${h}-month ranking test requires a longer completed outcome and can end earlier.` : "No complete policy outcomes in this view.";
    $("evidenceTests").innerHTML=table(`${h}M · full-sample ${h==="12"?"primary":"exploratory"} comparisons`,["Combination versus","Rank-correlation difference","95% block interval","Adjusted p / status"],study.comparisons.map((t) => tr([MODEL_LABELS[t.against],num(t.difference),t.available ? `${num(t.lower95)} to ${num(t.upper95)}` : esc(t.reason),h==="12"?num(t.holmP):"Exploratory"])));
    $("evidenceDecades").innerHTML=table("Fixed calendar periods · unchanged fitted models",["Period","Actual coverage","Starts",...Object.values(MODEL_LABELS)],Object.entries(study.periods).map(([key,p]) => tr([esc(key),`${p.first}–${p.last}`,p.n,...Object.keys(MODEL_LABELS).map((m) => num(p.rankIC[m]))])));
    const pointFirst=history.points[0]?.month,pointLast=history.points.at(-1)?.month,proxy=history.equityProxy;
    $("evidenceTimeline").innerHTML=table("Coverage is determined by verified sources",["Evidence layer","Verified coverage","What it supports"],[
      tr(["Annual economic context",`${history.annualContext.metadata?.first??"—"}–${history.annualContext.metadata?.last??"—"}`,"Annual US return history; excluded from monthly models"]),
      tr(["Monthly broad-US-equity proxy",`${esc(proxy.first)}–${esc(proxy.last)}`,"Long descriptive return history; not a backfilled ETF"]),
      tr(["Static economic-state history",`${esc(pointFirst)}–${esc(pointLast)}`,`${history.points.length} revised reference months`]),
      tr(["Verified original CFNAI releases","2001 onward","Releases reconstructed before ALFRED coverage; other inputs have separate limits"]),
      ...Object.entries(data.priceCoverage).map(([a,p]) => tr([`${a} adjusted prices`,`${p.first}–${p.last}`,`${p.n} completed prices · ${p.missing} missing interior months`])),
      tr(["Matched predictive outcomes",`${esc(study.models.combined.first)}–${esc(study.models.combined.last)}`,`${study.models.combined.n} overlapping starts at ${h} months; training and maturity shorten the sample`])]);
    const cohort=proxy.cohorts?.[h];
    const stateNames={"above-above":"Above-trend activity / PCE above 2%","above-below":"Above-trend activity / PCE below 2%","below-above":"Below-trend activity / PCE above 2%","below-below":"Below-trend activity / PCE below 2%",boundary:"Exactly on an anchor"};
    $("evidenceLongEquity").innerHTML=cohort ? table(`${h}M broad-US-equity cumulative returns · ${cohort.first}–${cohort.last}`, ["Economic state","Mean / median","Difference from own baseline","Monthly starts / episodes"],Object.entries(cohort.cells).filter(([,v]) => v.n).map(([q,v]) => tr([esc(stateNames[q]),`${pct(v.mean)} / ${pct(v.median)}`,pp(v.lift),`${v.n} / ${v.episodes}`])))+`<p class="sub">Baseline ${pct(cohort.mean)} over the same ${cohort.n} starts. Activity anchor = trend; inflation anchor = 2%. Below 2% does not necessarily mean deflation. <a href="${esc(proxy.source)}" target="_blank" rel="noopener">Source</a></p>` : '<p class="sub">Long equity history is unavailable.</p>';
    $("evidenceAnnual").innerHTML=`<div class="evidence-scroll">${table("Annual US research returns · gaps are retained",["Year","Equities","Government bonds","Bills"],history.annualContext.rows.map((r) => tr([r.year,pct(r.equity),pct(r.bonds),pct(r.bills)])))}</div>`;
    const checks=audit.independentChecks;
    $("evidenceAudit").innerHTML=`<p><strong>${checks.forecastChecks.toLocaleString()} forecast checks</strong> and <strong>${checks.strategyChecks.toLocaleString()} monthly strategy checks</strong> were recomputed independently from private source inputs. ${checks.frozenPriceComparisons.toLocaleString()} frozen v1 return comparisons have maximum difference ${(10000*checks.maxFrozenReturnDifference).toFixed(3)} basis points.</p><p class="sub">${audit.limitations.map(esc).join(" ")}</p>`;
    $("evidenceSources").innerHTML=table("Macro observations and first ALFRED vintage · these are different dates",["Series","Observation history","First ALFRED vintage","Count"],audit.macroSources.map((s) => tr([`<a href="${esc(s.source)}" target="_blank" rel="noopener">${esc(s.id)}</a>`,`${s.first}–${s.last}`,esc(s.vintageStart),s.n])));
    $("evidenceLedger").innerHTML=ledger.forecasts.length ? table("Immutable pre-execution records and matured outcomes",["Recorded / model","Execution / horizon","Leading asset","Realised rank correlation","Selected / equal five / SPY"],ledger.forecasts.map((r) => {
      const score=scoreForwardRecord(r,ledger.outcomes.find((o) => o.forecastId===r.id));
      return tr([`${esc(r.recordedAt)}<br>${esc(r.modelLabel||MODEL_LABELS[r.model]||r.model)}`,`${esc(r.executionAt)}<br>${r.horizon} months`,esc(r.ranking[0]),score?num(score.rankIC):"Outcome not recorded",score?`${pct(score.selected)} / ${pct(score.equalFive)} / ${pct(score.spy)}`:"—"]);
    }))+ '<p class="sub">Recorded ranks are scored only against appended mature outcomes. These are cumulative asset returns before trading costs and risk scaling; they are separate from the monthly strategy backtest.</p>' : '<p class="note">No genuine forward forecast has been recorded yet. Historical backtest rows stay in the research dataset. The first ledger entry must be saved after its information cutoff and before its planned execution.</p>';
  }
  function renderForecast() {
    const study=data.horizons[$("evidenceHorizon").value],model=$("evidenceModel").value,month=$("evidenceDecision").value;
    const record=study.forecastRows.find((r) => r.month===month);
    if(!record || !record.predictions[model].every(Number.isFinite)) { $("evidenceForecast").innerHTML='<p class="sub">No model estimate in the selected view.</p>';return; }
    const order=data.assets.map((a,i) => ({asset:a,prediction:record.predictions[model][i],outcome:record.outcomes[i]})).sort((a,b) => b.prediction-a.prediction);
    $("evidenceForecast").innerHTML=`<p class="note"><span class="evidence-badge">Historical reconstruction</span> ${esc(MODEL_LABELS[model])} · information through ${record.cutoff} · hypothetical execution ${record.tradeDate} · economic state reference ${esc(record.stateMonth)} · ${record.training[model]} matured training starts. This was reconstructed later; it is not a forecast recorded before that trade.</p>`+table(`${$("evidenceHorizon").value}-month cumulative excess return above cash`,["Model rank / asset","Model estimate","Realised excess outcome"],order.map((r,i) => tr([`${i+1} · ${r.asset}`,pct(r.prediction),Number.isFinite(r.outcome)?pct(r.outcome):"Not yet complete"])));
  }
  return {load,redraw:render};
}
