import { scoreDescription, compareScoreModels } from "./lib/asset-scores.mjs";
import { filterResearchRows, validDateRange, rankIC } from "./lib/research-evidence.mjs";
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? "—").replace(/[&<>"']/g, (c) => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"})[c]);
const num = (v, d = 2) => Number.isFinite(v) ? v.toFixed(d) : "—";
const signed = (v) => Number.isFinite(v) ? `${v > 0 ? "+" : ""}${v.toFixed(2)}` : "—";
const pct = (v) => Number.isFinite(v) ? `${(100 * v).toFixed(1)}%` : "—";
const tr = (cells) => `<tr>${cells.map((v, i) => i ? `<td>${v}</td>` : `<th scope="row">${v}</th>`).join("")}</tr>`;
const table = (caption, headers, rows) => `<div class="table-wrap" tabindex="0" role="region" aria-label="${esc(caption)}; scroll horizontally"><table><caption>${esc(caption)}</caption><thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;

function gauge(z, kind) {
  if (!Number.isFinite(z)) return '<span class="score-missing">No eligible score</span>';
  const x = 50 + Math.max(-3, Math.min(3, z)) / 3 * 46;
  return `<div class="score-gauge ${kind}" aria-hidden="true"><span class="score-zero"></span><span class="score-dot" style="left:${x}%"></span></div>`;
}

function lineChart(rows, asset) {
  const width = 800, height = 260, left = 48, right = 20, top = 22, bottom = 36;
  if (!rows.some((r) => Number.isFinite(r.assets[asset].price.z) || Number.isFinite(r.assets[asset].value.z))) return '<p class="sub">No eligible score history in this period.</p>';
  const finite = rows.flatMap((r) => [r.assets[asset].value.z, r.assets[asset].price.z]).filter(Number.isFinite);
  const limit = Math.max(3, Math.ceil(Math.max(...finite.map(Math.abs))));
  const x = (i) => left + i / Math.max(1, rows.length - 1) * (width - left - right);
  const y = (v) => top + (limit - v) / (2 * limit) * (height - top - bottom);
  let html = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${asset} historical value and price z-scores; positive value means relatively cheaper and positive price means above historical price"><title>${asset}: separate value and price z-scores</title>`;
  for (const level of [-limit, 0, limit]) html += `<path d="M${left} ${y(level)}H${width - right}" stroke="${level === 0 ? '#69758a' : '#293447'}"/><text x="5" y="${y(level) + 4}" fill="#a7b3c5" font-size="12">${level}</text>`;
  for (const [kind, color] of [["value", "#60d6ab"], ["price", "#e2b752"]]) {
    let path = "", pen = false;
    rows.forEach((r, i) => {
      const z = r.assets[asset][kind].z;
      if (!Number.isFinite(z)) { pen = false; return; }
      path += `${pen ? "L" : "M"}${x(i).toFixed(2)} ${y(z).toFixed(2)} `;
      pen = true;
    });
    html += `<path d="${path}" fill="none" stroke="${color}" stroke-width="2"/>`;
  }
  for (const i of [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])]) html += `<text x="${x(i)}" y="${height - 9}" text-anchor="middle" fill="#a7b3c5" font-size="12">${rows[i].month}</text>`;
  return html + '</svg><div class="chart-legend"><span style="color:#60d6ab">● Value z · higher means relatively cheaper / higher yield</span><span style="color:#e2b752">● Price z · higher means above historical log price</span></div>';
}

function policyStats(rows) {
  if (!rows.length) return null;
  let wealth = 1, peak = 1, dd = 0, stress = 1;
  const excess = rows.map((r) => r.return - r.cash), mean = excess.reduce((s, v) => s + v, 0) / rows.length;
  const avg = rows.reduce((s, r) => s + r.return, 0) / rows.length;
  for (const r of rows) {
    wealth *= 1 + r.return; peak = Math.max(peak, wealth); dd = Math.min(dd, wealth / peak - 1);
    stress *= 1 + r.return - 1.5 * r.cost;
  }
  const sd = Math.sqrt(excess.reduce((s, v) => s + (v - mean) ** 2, 0) / (rows.length - 1));
  const vol = Math.sqrt(rows.reduce((s, r) => s + (r.return - avg) ** 2, 0) / (rows.length - 1)) * Math.sqrt(12);
  return {cagr: wealth ** (12 / rows.length) - 1, sharpe: sd > 0 ? mean / sd * Math.sqrt(12) : null,
    volatility: vol, dd, stress: stress ** (12 / rows.length) - 1,
    turnover: 12 * rows.reduce((s, r) => s + r.turnover, 0) / rows.length, n: rows.length};
}

export function createAssetScoresView() {
  let data = null;
  const host = $("assetScores");
  async function load() {
    host.innerHTML = '<p class="status" role="status">Loading dated asset scores and model comparisons…</p>';
    try {
      const response = await fetch("/data/asset-scores.json", {cache: "no-cache"});
      if (!response.ok) throw new Error("Scores unavailable");
      const candidate = await response.json();
      if (candidate.version !== "value-price-research-3" || candidate.audit?.status !== "Actual-source reconstruction passed") throw new Error("Unverified score artifact");
      data = candidate;
      host.innerHTML = `
        <article class="panel"><div class="eyebrow">Separate information · research snapshot ${esc(data.asOf)}</div><h2>Value and price answer different questions</h2>
          <p>Value describes the starting yield or relative valuation. Price z describes how far an asset's log price is from its own preceding history. Neither score is a forecast probability or an automatic trade.</p>
          <div class="evidence-three"><div><span class="evidence-badge">Value z</span><p>Positive = relatively cheaper / higher yield.</p></div><div><span class="evidence-badge">Price z</span><p>Positive = above its historical log-price reference.</p></div><div><span class="evidence-badge">Tested separately</span><p>The model learns each signal's relationship with future returns.</p></div></div>
          <p class="note"><strong>Predictive advantage remains unconfirmed.</strong> The comparisons below use historical reconstructions. Scores are dated observations, with different proxy quality across assets.</p>
          ${data.sourceStatus === "complete" && data.horizons["12"].models.full.n ? `<p class="sub"><strong>Primary 12-month result:</strong> ${data.horizons["12"].models.full.n} shared overlapping starts, ${data.horizons["12"].models.full.first}–${data.horizons["12"].models.full.last}. Rank correlation is ${num(data.horizons["12"].models.full.meanRankIC, 3)} for macro + value + price, ${num(data.horizons["12"].models.macro.meanRankIC, 3)} for macro alone and ${num(data.horizons["12"].models.mean.meanRankIC, 3)} for the historical-average model. More inputs have not established a better forecast.</p>` : ""}
          ${data.sourceStatus === "partial" ? `<p class="note"><strong>Value sources incomplete.</strong> Original-vintage acquisition is unavailable for ${data.sourceFailures.map((s) => esc(s.id)).join(", ")}. Missing values are withheld. The full seven-model experiment waits for these sources; the separate exploratory price experiment uses verified existing prices and macro inputs.</p>` : ""}
          <label for="assetScoreDate">Inspect information date<select id="assetScoreDate"><option value="latest">Latest research snapshot · ${esc(data.asOf)}</option>${data.scoreHistory.slice().reverse().map((r) => `<option value="${r.month}">${r.month} · information through ${r.cutoff}</option>`).join("")}</select></label>
          <p id="assetScoreDateNote" class="sub" role="status" aria-live="polite"></p><div id="assetScoreCards" class="asset-score-grid"></div>
        </article>
        <article class="panel"><h2>Inspect the measurement</h2><p class="sub">Primary reference: preceding 10 calendar years, excluding the current observation; sample standard deviation. At least 60 prior months or 20 prior quarters. Missing or stale inputs stay unavailable. The 20-year score is a fixed sensitivity check.</p><div id="assetScoreDetails"></div><details><summary>Definitions, sources and limitations</summary><div id="assetScoreDefinitions"></div></details></article>
        <article class="panel"><h2>How the two scores changed</h2><label for="assetScoreAsset">Asset<select id="assetScoreAsset">${data.assets.map((a) => `<option>${a}</option>`).join("")}</select></label><div id="assetScoreChart"></div><p class="sub">Monthly decision cutoffs; completed prices and original macro vintages. Lines stop at missing scores. The two measures have different meanings even when their values coincide.</p></article>
        <article class="panel"><div class="eyebrow">New retrospective experiment · separate from frozen v2</div><h2>Do value and price improve the model?</h2>
          <div class="state-controls evidence-controls"><label for="assetScoreExperiment">Experiment<select id="assetScoreExperiment"><option value="full" ${data.sourceStatus === "complete" ? "selected" : ""}>Value + price · full experiment</option><option value="price" ${data.sourceStatus === "partial" ? "selected" : ""}>Price extension · exploratory</option></select></label><label for="assetScoreHorizon">Forecast horizon<select id="assetScoreHorizon"><option value="3">3 months · exploratory</option><option value="12" selected>12 months · main horizon</option><option value="36">36 months · exploratory</option></select></label>
          <label for="assetScorePeriod">Display period<select id="assetScorePeriod"><option value="full">Full verified history</option><option value="last20">Last 20 years</option><option value="custom">Custom dates</option></select></label>
          <label id="assetScoreFromLabel" for="assetScoreFrom" hidden>From<input type="month" id="assetScoreFrom"></label><label id="assetScoreToLabel" for="assetScoreTo" hidden>Through<input type="month" id="assetScoreTo"></label></div>
          <p id="assetScoreResearchStatus" class="status" role="status" aria-live="polite"></p><div id="assetScoreModels"></div>
          <p id="assetScoreCohortNote" class="sub"></p>
          <h3>Monthly policy after costs</h3><div id="assetScoreStrategies"></div><p class="sub">Identical winner-or-cash rule for every model; 10% annual volatility target using 36 prior completed months, no leverage. Costs 10 bp per risky buy/sell leg; stress 25 bp. Realised risks can differ. Holding months and forecast-outcome windows differ. Date filters do not retrain or restart holdings.</p>
          <details><summary>Which assets did the policies actually hold?</summary><div id="assetScoreSelections"></div></details>
        </article>
        <article class="panel"><h2>Inspect a dated forecast and its outcome</h2><div class="state-controls evidence-controls"><label for="assetForecastModel">Model<select id="assetForecastModel"></select></label><label for="assetForecastDate">Decision month<select id="assetForecastDate"></select></label><button type="button" id="assetForecastInputs">Inspect these input scores</button></div><div id="assetForecastResult"></div><p class="sub">These estimates were reconstructed later from then-available inputs. They are separate from genuine forecasts recorded before a future trade. Values are research estimates of cumulative excess return over cash, not calibrated probabilities.</p></article>
        <article class="panel"><h2>Does each signal add information?</h2><div id="assetScoreTests"></div><p id="assetScoreTestNote" class="sub"></p><details><summary>20-year normalisation sensitivity</summary><div id="assetScoreSensitivity"></div><p class="sub">Same evaluation dates for the 10- and 20-year scores. This fixed exploratory check does not replace the primary 10-year model.</p></details><details><summary>Fixed calendar-decade diagnostics</summary><div id="assetScoreDecades"></div></details></article>
        <article class="panel"><h2>Coverage and reproducibility</h2><div id="assetScoreCoverage"></div><details><summary>Original sources and split checks</summary><div id="assetScoreSources"></div></details>
          <p class="sub">Independent actual-source checks: ${data.audit.scoreChecks.toLocaleString()} score calculations, ${(data.audit.predictionChecks || 0).toLocaleString()} refitted model estimates, ${(data.audit.trainingChecks || 0).toLocaleString()} matured training cohorts, ${data.audit.forecastChecks.toLocaleString()} forward-return calculations and ${data.audit.strategyChecks.toLocaleString()} net monthly strategy returns. These checks establish computational consistency, not a predictive edge.</p>
          <p><a href="/data/asset-scores.json" download>Download scores, forecasts and evidence · JSON</a> · <a href="https://github.com/Garrincha077/Dalio-Quadrant/blob/codex/history-predictive-evidence/scripts/research/v3/protocol.md" target="_blank" rel="noopener">Read the fixed protocol</a></p><p class="sub">Protocol hash: ${esc(data.protocolSha256)}. Research date ${esc(data.asOf)}; no live market quotes. Provider price levels and credentials are excluded.</p>
        </article>`;
      $("assetScoreDate").addEventListener("change", renderScores);
      $("assetScoreAsset").addEventListener("change", renderChart);
      for (const id of ["assetForecastModel", "assetForecastDate"]) $(id).addEventListener("change", renderForecast);
      $("assetForecastInputs").addEventListener("click", () => {
        $("assetScoreDate").value = $("assetForecastDate").value;
        renderScores();
        $("assetScoreCards").scrollIntoView({behavior: "smooth", block: "start"});
      });
      for (const id of ["assetScoreExperiment", "assetScoreHorizon", "assetScorePeriod", "assetScoreFrom", "assetScoreTo"]) $(id).addEventListener("change", renderResearch);
      $("assetScoreDefinitions").innerHTML = table("Asset-specific value measures", ["Asset / type", "Measure and formula", "Limits"], data.assets.map((a) => {
        const d = data.definitions[a];
        return tr([`${a}<br><small>${esc(d.kind)}</small>`, `${esc(d.measure)}<br><small>${esc(d.formula)}</small>`, esc(d.limitation)]);
      }));
      $("assetScoreCoverage").innerHTML = table("First eligible scores; source and minimum-history limits remain visible", ["Asset", "Value score decisions", "Price score decisions"], data.assets.map((a) => tr([a, ...["value", "price"].map((k) => {
        const rows = data.scoreHistory.filter((r) => Number.isFinite(r.assets[a][k].z));
        return rows.length ? `${rows[0].month}–${rows.at(-1).month} · ${rows.length} starts` : "Unavailable";
      })]))) + `<p class="sub">Full experiment: ${data.horizons["12"].coverage.completeInputs}/${data.horizons["12"].coverage.decisions} decision months have complete macro, value and price inputs. The 60-matured-start training requirement and 12-month outcome maturity leave ${data.horizons["12"].models.full.n} shared completed starts. Complete source acquisition does not fill historical gaps: ${data.scoreHistory.filter((r) => r.assets.SPY.value.reason?.includes("stale")).length} equity-value decisions have stale original reference data and remain unavailable.</p>`;
      $("assetScoreSources").innerHTML = table("Original FRED/ALFRED sources", ["Series", "Observation history", "First archived vintage", "Units"], data.sources.map((s) => tr([`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.id)}</a>`, `${s.observationFirst}–${s.observationLast}`, s.firstVintage, esc(s.units)]))) + table("ETF split-history audit", ["Asset", "Verified coverage", "Splits"], data.assets.map((a) => {
        const audit = data.splitAudits[a];
        return tr([audit ? `<a href="${esc(audit.source)}" target="_blank" rel="noopener">${a}</a>` : a, audit ? `${audit.first}–${audit.last}` : "Unavailable", audit ? audit.splits.length : "Unavailable"]);
      })) + `<p class="sub">Equity duplicate: ${data.equityDuplicateAudit.n ? `${data.equityDuplicateAudit.n} comparisons with the same latest quarter; maximum relative difference ${num(data.equityDuplicateAudit.maxRelativeDifference * 100, 6)}%.` : "Reconciliation awaits the original sources."} Old series units are billions; replacement units millions, converted explicitly.${data.equityDuplicateAudit.unmatchedPeriods?.length ? ` Another ${data.equityDuplicateAudit.unmatchedPeriods.length} cutoffs had different latest quarters and are listed below. The current replacement series is used for those decisions; the older alias is not mixed into it.` : ""}</p>` + (data.equityDuplicateAudit.unmatchedPeriods?.length ? table("Duplicate archive lag · excluded from level reconciliation, retained in research with canonical source", ["Information cutoff", "Old alias latest quarter", "Replacement latest quarter"], data.equityDuplicateAudit.unmatchedPeriods.map((r) => tr([r.cutoff, r.oldPeriod, r.newPeriod]))) : "");
      renderScores(); renderChart(); renderResearch();
    } catch {
      host.innerHTML = '<article class="panel"><h2>Asset score evidence unavailable</h2><p>Verified value and price research could not be loaded. No neutral scores or substitute results are shown.</p><button type="button" id="assetScoreRetry">Retry asset research</button></article>';
      $("assetScoreRetry").addEventListener("click", load);
    }
  }
  function renderScores() {
    const row = $("assetScoreDate").value === "latest" ? data.latest : data.scoreHistory.find((r) => r.month === $("assetScoreDate").value);
    $("assetScoreDateNote").textContent = `Information through ${row.cutoff}. ${row.tradeDate ? `Historical reconstruction before hypothetical execution ${row.tradeDate}.` : "Saved research snapshot; not a live quote."} Price z uses completed monthly closes. Gauge positions stop at ±3; numerical scores remain uncapped.`;
    $("assetScoreCards").innerHTML = data.assets.map((a) => {
      const pair = row.assets[a];
      return `<section class="asset-score-card" aria-label="${a} value and price scores"><h3>${a} <small>${esc(data.definitions[a].name)}</small></h3>${["value", "price"].map((kind) => {
        const s = pair[kind];
        return `<div class="asset-score-reading ${kind}"><div class="asset-score-line"><strong>${kind === "value" ? "Value z" : "Price z"}</strong><span>${signed(s.z)}</span></div>${gauge(s.z, kind)}<p>${esc(scoreDescription(s.z, kind))}</p><small>${Number.isFinite(s.z) ? `${esc(s.period)} · ${s.n} prior ${a === "SPY" && kind === "value" ? "quarters" : "months"} · ${num(s.percentile, 0)}th oriented historical percentile` : esc(s.reason)}</small></div>`;
      }).join("")}<p class="sub">${esc(data.definitions[a].kind)}</p></section>`;
    }).join("");
    $("assetScoreDetails").innerHTML = table("Selected date: measure, normalisation and sensitivity", ["Asset / signal", "Measure level", "10Y z / 20Y z", "Reference periods / count", "Reference mean / SD", "Period age"], data.assets.flatMap((a) => ["value", "price"].map((kind) => {
      const s = row.assets[a][kind];
      return tr([`${a} · ${kind}${s.sourceLeg ? `<br><small>${esc(s.sourceLeg)}</small>` : ""}`, Number.isFinite(s.level) ? `${num(s.level, 4)} ${kind === "value" ? esc(data.definitions[a].unit) : "log price"}` : "—", `${signed(s.z)} / ${signed(s.z20)}`, s.referenceFirst ? `${s.referenceFirst}–${s.referenceLast}<br>${s.n} native observations` : esc(s.reason), `${num(s.mean, 4)} / ${num(s.sd, 4)}`, Number.isFinite(s.ageDays) ? `${s.ageDays} days from ${s.periodEnd}` : "—"]);
    })));
  }
  function renderChart() {
    const period = $("assetScorePeriod").value;
    const rows = filterResearchRows(data.scoreHistory, {period, start: $("assetScoreFrom").value, end: $("assetScoreTo").value});
    $("assetScoreChart").innerHTML = lineChart(rows, $("assetScoreAsset").value);
  }
  function renderResearch() {
    const h = $("assetScoreHorizon").value, priceOnly = $("assetScoreExperiment").value === "price";
    const study = priceOnly ? data.horizons[h].priceOnly : data.horizons[h], period = $("assetScorePeriod").value;
    const modelKeys = Object.keys(study.models), focus = priceOnly ? "macro-price" : "full";
    const start = $("assetScoreFrom").value, end = $("assetScoreTo").value;
    $("assetScoreFromLabel").hidden = $("assetScoreToLabel").hidden = period !== "custom";
    if (period === "custom" && !validDateRange(start, end)) {
      $("assetScoreResearchStatus").textContent = "Choose a valid From/Through date range. Results are withheld until it is valid.";
      for (const id of ["assetScoreModels", "assetScoreStrategies", "assetScoreSelections", "assetScoreChart", "assetForecastResult"]) $(id).innerHTML = "";
      for (const id of ["assetForecastModel", "assetForecastDate", "assetForecastInputs"]) $(id).disabled = true;
      return;
    }
    const filter = {period, start, end}, rows = filterResearchRows(study.forecastRows, filter), matched = rows.filter((r) => r.common);
    $("assetScoreResearchStatus").textContent = matched.length ? `${priceOnly ? "Exploratory price experiment" : "Full value + price experiment"} · ${h}-month forecasts · ${matched[0].month}–${matched.at(-1).month} · ${matched.length} overlapping starts · retrospective. Filters do not retrain.` : data.sourceStatus === "partial" && !priceOnly ? "Full value + price comparison withheld: required original-vintage value sources are unavailable." : "No completed common forecasts in this view. Widen the date range.";
    $("assetScoreCohortNote").textContent = `${priceOnly ? "The four exploratory price models share macro and price eligibility; missing value inputs are excluded from this separate experiment." : "All seven models share complete macro, value and price eligibility."} Mature training outcomes and evaluation dates match within each experiment. Each asset receives only its own value/price input. Rank correlation orders five assets; top-choice excess is the realised cumulative return above cash. Starts overlap.`;
    const priorModel = $("assetForecastModel").value, priorDate = $("assetForecastDate").value;
    $("assetForecastModel").innerHTML = modelKeys.map((m) => `<option value="${m}">${esc(data.modelLabels[m])}</option>`).join("");
    $("assetForecastModel").value = modelKeys.includes(priorModel) ? priorModel : focus;
    $("assetForecastDate").innerHTML = rows.slice().reverse().map((r) => `<option value="${r.month}">${r.month}${r.outcomes.every(Number.isFinite) ? "" : " · outcome not complete"}</option>`).join("");
    if (rows.some((r) => r.month === priorDate)) $("assetForecastDate").value = priorDate;
    for (const id of ["assetForecastModel", "assetForecastDate", "assetForecastInputs"]) $(id).disabled = !rows.length;
    renderForecast();
    $("assetScoreModels").innerHTML = table("Same dates, training eligibility and targets", ["Model", "Rank correlation", "Top-choice excess over cash", "Starts"], compareScoreModels(study, rows, rankIC).map((r) => tr([data.modelLabels[r.model], num(r.meanRankIC), pct(r.topAssetExcess), r.n])));
    $("assetScoreStrategies").innerHTML = table("Same-risk-rule monthly policies on the selected holding months", ["Policy", "CAGR", "Sharpe", "Volatility", "Max drawdown", "CAGR · 25 bp", "Annual turnover", "Months"], Object.entries(study.strategies).map(([m, policy]) => {
      const stats = policy?.available ? policyStats(filterResearchRows(policy.rows, filter)) : null;
      return tr([data.modelLabels[m] || m, pct(stats?.cagr), num(stats?.sharpe), pct(stats?.volatility), pct(stats?.dd), pct(stats?.stress), pct(stats?.turnover), stats?.n || 0]);
    }));
    $("assetScoreSelections").innerHTML = table("Actual leading holdings after risk scaling, selected holding months", ["Model", ...data.assets, "Cash only"], Object.entries(study.strategies).filter(([m, p]) => data.modelLabels[m] && p?.available).map(([m, policy]) => {
      const r = filterResearchRows(policy.rows, filter);
      return tr([data.modelLabels[m], ...data.assets.map((_, i) => r.filter((v) => v.weights[i + 1] > 0).length), r.filter((v) => v.weights[0] === 1).length]);
    }));
    $("assetScoreTests").innerHTML = study.comparisons.length ? table(`${h}M · full matched sample · ${h === "12" && !priceOnly ? "four primary comparisons" : "exploratory"}`, ["Model", "Compared with", "Rank IC difference", "95% block interval", "Adjusted p / status"], study.comparisons.map((t) => tr([data.modelLabels[t.model], data.modelLabels[t.against], num(t.difference, 3), t.available ? `${num(t.lower95, 3)} to ${num(t.upper95, 3)}` : esc(t.reason), t.exploratory ? `Exploratory · p ${num(t.p, 3)}` : num(t.holmP, 3)]))) : '<p class="sub">No matched outcomes for this experiment; statistical comparisons are withheld.</p>';
    $("assetScoreTestNote").textContent = `${priceOnly ? "These two price comparisons are exploratory at every horizon, with unadjusted p-values. They do not replace the primary value/price experiment." : "The four predeclared primary 12-month comparisons use Holm correction; other horizons are exploratory."} Full-sample calendar-block intervals account for overlapping horizons; they are not future return ranges. Display filters do not change these tests.`;
    $("assetScoreSensitivity").innerHTML = table(`Fixed 20Y sensitivity · ${study.sensitivity.n} shared starts`, ["Model", "10Y rank IC", "20Y rank IC"], modelKeys.map((m) => tr([data.modelLabels[m], num(study.sensitivity.tenYears[m].meanRankIC), num(study.sensitivity.twentyYears[m].meanRankIC)])));
    $("assetScoreDecades").innerHTML = table("Fixed decades · full matched history", ["Period", "Actual coverage", "Starts", ...modelKeys.map((m) => data.modelLabels[m])], Object.entries(study.periods).map(([period, models]) => tr([period, `${models[focus].first}–${models[focus].last}`, models[focus].n, ...modelKeys.map((m) => num(models[m].meanRankIC))])));
    renderChart();
  }
  function renderForecast() {
    const h = $("assetScoreHorizon").value, priceOnly = $("assetScoreExperiment").value === "price";
    const study = priceOnly ? data.horizons[h].priceOnly : data.horizons[h];
    const model = $("assetForecastModel").value, month = $("assetForecastDate").value;
    if ($("assetScorePeriod").value === "custom" && !validDateRange($("assetScoreFrom").value, $("assetScoreTo").value)) return;
    const record = study.forecastRows.find((r) => r.month === month);
    if (!record || !record.predictions[model]?.every(Number.isFinite)) {
      $("assetForecastResult").innerHTML = '<p class="sub">No estimate is available in this experiment and date range.</p>';
      return;
    }
    const inputs = data.scoreHistory.find((r) => r.month === month);
    const order = data.assets.map((asset, i) => ({asset, estimate: record.predictions[model][i],
      difference: record.predictions[model][i] - record.predictions.mean[i], actual: record.outcomes[i]})).sort((a, b) => b.estimate - a.estimate);
    const ic = rankIC(record.predictions[model], record.outcomes);
    $("assetForecastResult").innerHTML = `<p class="note"><span class="evidence-badge">Historical reconstruction</span> ${esc(data.modelLabels[model])} · information through ${record.cutoff} · hypothetical execution ${record.tradeDate} · ${record.training} matured training starts. ${ic === null ? "Outcomes are not yet complete; accuracy is withheld." : `Realised rank correlation ${num(ic, 3)}.`}</p>` + table(`${h}-month cumulative return above cash`, ["Rank / asset", "Model estimate", "Difference from historical-average estimate", "Realised excess outcome", "Value z at cutoff", "Price z at cutoff"], order.map((r, i) => tr([`${i + 1} · ${r.asset}`, pct(r.estimate), pct(r.difference), Number.isFinite(r.actual) ? pct(r.actual) : "Not yet complete", signed(inputs?.assets[r.asset].value.z), signed(inputs?.assets[r.asset].price.z)])));
  }
  return {load};
}
