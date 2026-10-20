import { buildStateTilt } from "./lib/state-tilt.mjs";
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const percent = (n) => `${n >= 0 ? "+" : ""}${(100 * n).toFixed(1)}%`;
const pp = (n) => `${n >= 0 ? "+" : ""}${(100 * n).toFixed(1)} pp`;
const signed = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
const share = (n) => `${(100 * n).toFixed(1)}%`;
const directions = {
  rising: "rising",
  falling: "falling",
  flat: "broadly flat",
};

export function createStateTiltView() {
  let snapshot = null,
    study = null;
  function draw() {
    const r = buildStateTilt(
      snapshot,
      study,
      Number($("stateInvestmentHorizon").value),
    );
    const host = $("stateInvestmentResult");
    if (!r.available) {
      host.innerHTML = `<p class="sub">${esc(r.reason)}</p>`;
      return;
    }
    const lead = r.ranking[0];
    host.innerHTML = `<div class="tilt-leader"><span class="sub">First research preference · ${r.horizon}-month horizon</span><strong>${r.preference ? `${esc(lead.name)} · ${lead.asset}` : "No positive historical asset preference"}</strong></div>
      <p class="sub">Latest reference ${r.reference} · activity ${signed(r.current.activity)}, PCE ${r.current.inflation.toFixed(2)}%. Trend ${r.trend.from} → ${r.trend.to}: activity ${directions[r.trend.activityDirection]} (${signed(r.trend.activity)} index), inflation ${directions[r.trend.inflationDirection]} (${signed(r.trend.inflation)} pp).</p>
      <ol class="tilt-ranking">${r.ranking
        .slice(0, 3)
        .map(
          (a) =>
            `<li><div><strong>${a.asset} · ${esc(a.name)}</strong><span>Pooled historical mean ${percent(a.mean)} · median ${percent(a.median)}</span></div></li>`,
        )
        .join("")}</ol>
      <p class="note">${r.cohort.thin ? "Thin state + trend sample" : "Historical analogue coverage"}: ${r.cohort.matches} matching monthly starts / ${r.cohort.episodes} episodes. ${r.cohort.thin ? "Small cells are pulled strongly toward the broader state and common-history averages. " : "The estimates still pool small individual cells toward broader history. "}${r.nearBoundary ? `Near an anchor: neighbouring quadrants are blended.${r.boundaryDisagreement ? " Their leading assets differ." : ""} ` : ""}${r.closeLeaders ? "The first two means differ by less than 1 pp; treat them as close candidates. " : ""}${r.outdated ? "The frozen price history is more than six reference months old; refresh the study before relying on the ranking. " : ""}This new ranking rule has not been validated out of sample.</p>
      <details><summary>All assets, risk & evidence</summary>
        <div class="table-wrap" tabindex="0" role="region" aria-label="Research asset recommendations and historical risk; scroll horizontally"><table class="tilt-table"><caption>${r.horizon}-month cumulative USD outcomes · pooled historical distribution</caption><thead><tr><th>Rank / asset</th><th>Mean / median</th><th>Lift vs own baseline</th><th>P10 / loss frequency*</th></tr></thead><tbody>${r.ranking.map((a, i) => `<tr><th scope="row">${i + 1} · ${a.asset}</th><td>${percent(a.mean)} / ${percent(a.median)}</td><td>${pp(a.lift)}</td><td>${percent(a.p10)} / ${share(a.lossFrequency)}</td></tr>`).join("")}</tbody></table></div>
        <p class="sub">*Weighted historical frequency of negative outcomes, not the probability of a future loss. P10 is a historical quantile, not a loss limit. Ranking compares cumulative means, without equalising asset risk.</p>
        <p class="sub">Same common cohort for all five assets: ${r.cohort.first}–${r.cohort.last}, N=${r.cohort.n}. Historical entry is delayed two months, then held for the full ${r.horizon} months. Frozen research ${r.researchAsOf}; complete prices through ${r.priceCutoff}. Monthly holding windows overlap.</p>
        <p class="sub">Estimate mixture: state + trend ${share(r.mixing.trend)}, broader state ${share(r.mixing.state)}, unconditional prior ${share(r.mixing.prior)}. These are statistical blending weights, not portfolio allocations or state probabilities.</p>
        <ul class="tilt-components">${r.components.map((c) => `<li>${esc(study.quadrants[c.quadrant])}: ${share(c.share)} blend · ${c.matches} trend matches / ${c.episodes} episodes (${c.stateN} state observations). Component leader ${c.leader}.</li>`).join("")}</ul>
        <p class="sub">Fixed 3-month direction uses noise bands ±0.10 activity / ±0.20 pp inflation. Two-stage pooling uses 24 pseudo-observations per stage. Only the latest state drives this card; chart replay, dot selection and dot sampling do not change it.</p>
        <p class="sub">The underlying returns use revised economic data, not historical publication vintages. The two-month delay does not remove revision bias. Prices, expectations, costs and future changes can overturn these relationships. This is a research recommendation from conditional history, separate from the original momentum investment backtest. <a href="https://fred.stlouisfed.org/docs/api/fred/alfred.html" target="_blank" rel="noopener">Historical vintages</a> · <a href="#forwardStudy">Inspect the full return research</a>.</p>
      </details>`;
  }
  $("stateInvestmentHorizon").addEventListener("change", draw);
  return {
    render(next, data) {
      snapshot = next;
      study = data;
      draw();
    },
  };
}
