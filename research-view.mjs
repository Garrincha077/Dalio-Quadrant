import { loadExtendedResearch } from "./extended-research-view.mjs";
import { loadEntryOpportunities } from "./entry-opportunities-view.mjs";
import { initLearnedResearch } from "./learned-entry-view.mjs";
import { initZScoreResearch } from "./zscore-entry-view.mjs";
const $ = (id) => document.getElementById(id);
const pct = (v, d = 1) =>
  Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : "—";
const num = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");
const pp = (v) => pct(v).replace("%", " pp");
const esc = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const colors = ["#87b6ff", "#e2b752", "#60d6ab", "#c3a4ff"];
const strategies = [
  "SPY buy & hold",
  "Predictive rotation",
  "Predictive SPY",
  "GLD buy & hold",
];
function equityChart(summary) {
  const width = window.matchMedia("(max-width: 600px)").matches ? 340 : 670;
  const x = (i) => 54 + i * ((width - 95) / 5),
    y = (v) => 214 - (v - 90) * 1.25;
  const years = [2021, 2022, 2023, 2024, 2025];
  let svg = `<svg viewBox="0 0 ${width} 260" role="img" aria-label="Year-end growth of 100 dollars, net of assumed costs, 2021 to 2025. Exact annual returns follow in the table.">`;
  for (const value of [100, 150, 200, 250])
    svg += `<path d="M54 ${y(value)} H${width - 30}" stroke="#293447"/><text x="8" y="${y(value) + 4}" fill="#a7b3c5" font-size="12">$${value}</text>`;
  for (let i = 0; i <= 5; i++)
    svg += `<text x="${x(i)}" y="245" text-anchor="middle" fill="#a7b3c5" font-size="12">${i ? years[i - 1] : "Start"}</text>`;
  strategies.forEach((name, j) => {
    let value = 100;
    const points = [[x(0), y(value)]];
    for (const [i, year] of years.entries()) {
      value *=
        1 +
        summary.annualReturns.find(
          (r) => r.strategy === name && r.year === year,
        ).return;
      points.push([x(i + 1), y(value)]);
    }
    svg += `<polyline points="${points.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${colors[j]}" stroke-width="2.5"/>`;
    points.forEach(([a, b], i) => {
      svg += `<circle cx="${a}" cy="${b}" r="3.5" fill="${colors[j]}"><title>${esc(name)} · ${i ? years[i - 1] : "Start"} · $${(100 + (214 - b) / 1.25 - 10).toFixed(1)}</title></circle>`;
    });
  });
  return (
    svg +
    '</svg><div class="chart-legend">' +
    strategies
      .map((name, j) => `<span style="color:${colors[j]}">● ${name}</span>`)
      .join("") +
    "</div>"
  );
}
function resultTable(s) {
  return `<table><caption>Reserved test: Jan 2021–Dec 2025 · 60 monthly returns · USD</caption><thead><tr><th>Strategy</th><th>CAGR</th><th>Excess Sharpe</th><th>Volatility</th><th>Max drawdown</th><th>CAGR at 25 bp</th></tr></thead><tbody>${s.results.map((r) => `<tr><th scope="row">${esc(r.name)}</th><td>${pct(r.cagr)}</td><td>${num(r.sharpe)}</td><td>${pct(r.volatility)}</td><td>${pct(r.maxDrawdown)}</td><td>${pct(r.cagrAt25bps)}</td></tr>`).join("")}</tbody></table>`;
}
export function createResearchView(onLoaded = () => {}) {
  let current = null;
  function redraw() {
    if (current) $("researchEquity").innerHTML = equityChart(current);
  }
  async function load() {
    initZScoreResearch();
    initLearnedResearch();
    const extended = loadExtendedResearch();
    const entries = loadEntryOpportunities();
    try {
      const response = await fetch("/data/research-summary.json");
      if (!response.ok) throw new Error();
      const s = await response.json();
      if (s.version !== "walk-forward-research-1" || s.results.length !== 13)
        throw new Error();
      current = s;
      const spy = s.results.find((r) => r.name === "SPY buy & hold"),
        rotation = s.results.find((r) => r.name === "Predictive rotation");
      const interval = rotation.advantageVsSPY;
      const gold = s.results.find((r) => r.name === "GLD buy & hold");
      $("researchOverview").innerHTML =
        `<div class="eyebrow">Reserved test · 2021–2025 · ${s.results[0].months} months</div><h2>Predictive edge: unconfirmed</h2><p>The momentum quadrants describe an economic direction. They did not consistently identify the next month's best asset in this test. A separate macro predictor earned ${pct(rotation.cagr)} CAGR versus ${pct(spy.cagr)} for SPY, with a smaller monthly drawdown.</p><div class="metrics"><div class="metric"><strong>${pct(rotation.cagr)}</strong><span>Predictive rotation CAGR</span></div><div class="metric"><strong>${pct(spy.cagr)}</strong><span>SPY buy & hold CAGR</span></div><div class="metric"><strong>${pct(rotation.maxDrawdown)}</strong><span>Rotation max drawdown</span></div></div><p class="note">The paired 95% block-bootstrap interval for annual mean return advantage over SPY is ${pp(interval.lower95)} to ${pp(interval.upper95)}. It includes zero. A small apparent improvement is not an established forecasting edge.</p>`;
      $("researchOverview").innerHTML +=
        `<p class="sub">Gold buy & hold returned ${pct(gold.cagr)}, exceeding the rotation in the same window. Choosing the best static asset after seeing results would also be hindsight.</p>`;
      $("researchEquity").innerHTML = equityChart(s);
      $("researchResults").innerHTML = resultTable(s);
      $("researchAnnual").innerHTML =
        `<table><caption>Net calendar-year returns</caption><thead><tr><th>Year</th>${strategies.map((n) => `<th>${esc(n)}</th>`).join("")}</tr></thead><tbody>${[2021, 2022, 2023, 2024, 2025].map((year) => `<tr><th scope="row">${year}</th>${strategies.map((name) => `<td>${pct(s.annualReturns.find((r) => r.strategy === name && r.year === year).return)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
      $("researchConditional").innerHTML =
        `<table><caption>Mean NEXT-month asset returns by original quadrant · 2021–25 · before switching costs</caption><thead><tr><th>Momentum at decision</th><th>Months</th>${Object.keys(
          s.assetNames,
        )
          .map((a) => `<th>${a}</th>`)
          .join(
            "",
          )}<th>Observed leader</th></tr></thead><tbody>${s.conditionalReturns
          .map(
            (r) =>
              `<tr><th scope="row">${esc(r.label)}</th><td>${r.n}${r.smallSample ? " · small" : ""}</td>${Object.keys(
                s.assetNames,
              )
                .map((a) => `<td>${pct(r.meanNextMonthReturns[a], 2)}</td>`)
                .join("")}<td>${r.historicalLeader}</td></tr>`,
          )
          .join(
            "",
          )}</tbody></table><p class="sub">Valid buckets contain only 7–21 cases. One additional unavailable decision uses the cash fallback. These retrospective means do not establish future winners; adjacent months are dependent and leaders change with the test window.</p>`;
      const lag = (axis, direction, h) =>
        s.lagChecks.find(
          (r) =>
            r.axis === axis &&
            r.direction === direction &&
            r.horizonMonths === h,
        );
      $("researchLag").innerHTML =
        `<p>Growth momentum correlates ${num(lag("g", "trailing", 6).correlation)} with the preceding six-month SPY return and ${num(lag("g", "forward", 6).correlation)} with the following six months. Its next-month correlation is only ${num(lag("g", "forward", 1).correlation)}.</p><p class="sub">This suggests a descriptive component, not a proven fixed lead/lag. Correlation is not a trading result. Diagnostics use available vintage quadrants from 2011; overlapping horizons and varying sample sizes (${lag("g", "forward", 6).n} for forward 6M) limit inference.</p>`;
      $("researchLag").innerHTML +=
        `<div class="table-wrap"><table><caption>Vintage macro score vs SPY return · Pearson correlation</caption><thead><tr><th>Axis</th><th>Horizon</th><th>Preceding return</th><th>Following return</th><th>Forward N</th></tr></thead><tbody>${["g", "i"].flatMap((axis) => [1, 3, 6].map((h) => `<tr><th scope="row">${axis === "g" ? "Growth" : "Inflation"}</th><td>${h}M</td><td>${num(lag(axis, "trailing", h).correlation)}</td><td>${num(lag(axis, "forward", h).correlation)}</td><td>${lag(axis, "forward", h).n}</td></tr>`)).join("")}</tbody></table></div><h3>What was actually known before trading?</h3><p class="sub">For example, at the March 2020 cutoff both scores were still positive. Release lags matter: the revised reference-period trail must not be used as a tradable backtest.</p><div class="table-wrap"><table><thead><tr><th>Information cutoff</th><th>Growth score</th><th>Inflation score</th><th>GDP period / YoY</th><th>Core PCE period / YoY</th></tr></thead><tbody>${s.vintageExamples.map((r) => `<tr><th scope="row">${r.cutoff}</th><td>${num(r.g)}</td><td>${num(r.i)}</td><td>${r.inputDates.gdp.slice(0, 7)} / ${r.gdp_yoy.toFixed(1)}%</td><td>${r.inputDates.pce.slice(0, 7)} / ${r.pce_yoy.toFixed(1)}%</td></tr>`).join("")}</tbody></table></div>`;
      const p = s.latestPrediction;
      const ranked = Object.entries(p.assetForecasts).sort(
        (a, b) => b[1] - a[1],
      );
      const expired = new Date().toISOString().slice(0, 7) > p.targetMonth;
      $("researchPrediction").innerHTML =
        `<div class="eyebrow">Separate model · ${expired ? "Expired research snapshot" : "Dated research snapshot"}</div><h2>Experimental forward view</h2><p>Information cutoff <strong>${p.asOf}</strong> · target <strong>${p.targetMonth}</strong> · entry assumption ${p.tradeDate} close.</p><div class="metrics"><div class="metric"><strong>${pct(p.spyForecastExcessReturn, 2)}</strong><span>SPY model estimate above cash / 1M</span></div><div class="metric"><strong>${ranked[0][0]}</strong><span>Highest asset-model estimate</span></div></div><div class="table-wrap"><table><thead><tr><th>Asset</th><th>Estimated 1M excess return</th></tr></thead><tbody>${ranked.map(([a, v]) => `<tr><th scope="row">${esc(s.assetNames[a])}</th><td>${pct(v, 2)}</td></tr>`).join("")}</tbody></table></div><p class="note">Research only. These point estimates are not calibrated probabilities or expected guaranteed returns. The evidence does not establish an edge. This frozen snapshot is not refreshed by the dashboard's FRED refresh button and ${expired ? "is no longer a current signal" : "is not an intramonth trading signal"}.</p>`;
      $("researchProtocol").innerHTML =
        `<p>Development labels end ${s.developmentLabelsEnd}; December 2020 is embargoed. ${s.candidateCount} predeclared candidates: 9 SPY predictors, 6 asset predictors, 27 quadrant variants. Selection uses development excess Sharpe only. Each monthly refit uses labels that have already matured; minimum 60 training months. Training-only median imputation, winsorisation and standardisation.</p><p>Selected SPY and asset models: macro ridge, λ=100; seven inputs (growth/inflation momentum, GDP and PCE YoY, yield curve, policy change, NFCI). The SPY model switches SPY/cash at a positive excess forecast. Rotation selects the highest positive forecast among SPY, IEF, GLD, TIP, DBC, otherwise cash. These are concentrated research rules, not diversified portfolio recommendations.</p><p>Calibrated quadrant research: scale factors G=${s.selection.quadrants.growthScaleFactor}, I=${s.selection.quadrants.inflationScaleFactor}; transition band ${s.selection.quadrants.transitionBand}. Conditional means require 12 cases and shrink toward training global means with 12 pseudo-observations. These settings were not adopted into the descriptive chart because the reserved test does not support an improvement.</p><p>Original illustrative map: G↑/I↓→SPY; G↑/I↑→DBC; G↓/I↑→GLD; G↓/I↓→IEF; transition→cash. Baselines include monthly-rebalanced 60/40 SPY/IEF and an equal five-asset basket. The 200-day baseline holds SPY only above its trailing adjusted-price average.</p><p>Execution: features available by the calendar day before the traded month-end close; hold one month. Adjusted ETF closes are a dividend-adjusted total-return proxy. Fees: 10 bp for each risky-asset buy/sell leg, 25 bp stress; drifted holdings are rebalanced. No taxes, financing, bid/ask spread model or intramonth path. Drawdowns use monthly closes. ${esc(s.cashAssumption)}.</p><p>Vintage source coverage: ${s.sample.validOriginalQuadrants} original-regime dates, first ${s.sample.firstOriginalQuadrant}, from ${s.sample.featureRows} feature dates. Earlier missing archived series are not backfilled into the original quadrant. ${s.quality.monthlyCrossCheckCount} overlapping SPY monthly returns were reconciled across Alpha Vantage/Yahoo: median difference ${s.quality.medianReturnDifferenceBps.toFixed(3)} bp, maximum ${s.quality.maxReturnDifferenceBps.toFixed(2)} bp.</p><p>Uncertainty: 2,500 paired circular block-bootstrap samples, 12-month blocks. Only one five-year test window; candidate selection, regime imbalance and limited crisis coverage constrain generalisation. No final-window parameter retuning.</p><p>Research compiled ${s.asOf}. ${s.sources.map((r) => `<a href="${r.url}" target="_blank" rel="noopener">${esc(r.name)}</a>`).join(" · ")}. <a href="/data/research-summary.json" download>Download aggregate research JSON</a>.</p>`;
      $("researchStatus").textContent =
        `Separate historical studies: each card states its own data window and evidence limits. The original momentum study was compiled ${s.asOf}, with its reserved test ending December 2025. Research is separate from live FRED observations.`;
      onLoaded(s);
    } catch {
      current = null;
      for (const id of [
        "researchOverview",
        "researchEquity",
        "researchResults",
        "researchAnnual",
        "researchConditional",
        "researchLag",
        "researchPrediction",
        "researchProtocol",
      ])
        $(id).replaceChildren();
      onLoaded(null);
      $("researchStatus").textContent =
        "Original momentum research summary unavailable. Other research cards report their own availability and evidence limits.";
    }
    try {
      const response = await fetch("/data/historical-audit.json");
      if (!response.ok) throw new Error();
      const audit = await response.json();
      $("researchAudit").innerHTML =
        `<p class="sub">${esc(audit.method)} Source snapshot: ${esc(audit.asOf.slice(0, 10))}.</p><div class="table-wrap"><table><caption>Momentum direction compared with the economic level</caption><thead><tr><th>Period end</th><th>Momentum phase</th><th>GDP YoY</th><th>Core PCE YoY</th><th>NBER recession</th><th>Interpretation</th></tr></thead><tbody>${audit.rows.map((r) => `<tr><th scope="row">${r.date}</th><td>${esc(r.regime)}</td><td>${r.gdpYoy.toFixed(1)}%</td><td>${r.pceYoy.toFixed(1)}%</td><td>${r.nberRecession ? "Yes" : "No"}</td><td class="audit-note">${esc(r.interpretation)}</td></tr>`).join("")}</tbody></table></div><p class="sub">Revised <a href="https://fred.stlouisfed.org/series/GDPC1">GDP</a>, <a href="https://fred.stlouisfed.org/series/PCEPILFE">core PCE</a> and <a href="https://fred.stlouisfed.org/series/USREC">USREC</a>; <a href="https://www.nber.org/research/business-cycle-dating/business-cycle-dating-committee-announcements">NBER dating announcements</a>. Recession dates were announced later, not known in real time. This economic audit is separate from the vintage-based investment test.</p>`;
    } catch {
      $("researchAudit").textContent = "Historical economic audit unavailable.";
    }
    await extended;
    await entries;
  }
  return { load, redraw };
}
