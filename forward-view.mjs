import { createStateTiltView } from "./state-tilt-view.mjs";
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const pct = (n) =>
  Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${(100 * n).toFixed(1)}%` : "—";
const pp = (n) =>
  Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${(100 * n).toFixed(1)} pp` : "—";
const corr = (n) => (Number.isFinite(n) ? n.toFixed(2) : "—");
const shift = (month, n) =>
  new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1),
  )
    .toISOString()
    .slice(0, 7);

export function selectedForwardPoint(data, slot) {
  if (!slot?.point)
    return {
      error:
        "Select an available economic position to inspect its subsequent returns.",
    };
  const p = slot.point;
  if (p.activityDate !== p.inflationDate)
    return {
      error:
        "This position combines different reference months. Select a historical same-month position for this study.",
    };
  const row = data.points.find((d) => d.month === slot.date.slice(0, 7));
  if (!row)
    return {
      error: "This month is outside the frozen research state history.",
    };
  return {
    row,
    revised:
      Math.abs(row.activity - p.activity) > 0.000001 ||
      Math.abs(row.inflation - p.inflation) > 0.000001,
  };
}

export function createForwardView() {
  const tiltView = createStateTiltView();
  let data = null,
    slot = null,
    snapshot = null;
  function renderPoint() {
    if (!data) return;
    const result = selectedForwardPoint(data, slot);
    if (result.error) {
      $("stateForwardPoint").textContent = result.error;
      return;
    }
    const { row, revised } = result,
      lag = $("forwardLag").value;
    const entry = shift(row.month, Number(lag));
    $("stateForwardPoint").innerHTML =
      `<h3>After selected position · ${esc(row.month)}</h3><p class="sub">${esc(data.quadrants[row.quadrant])} · entry at ${entry} month end. ${revised ? `The live source has revised this position; these frozen outcomes use activity ${row.activity.toFixed(2)}, PCE ${row.inflation.toFixed(2)}%. ` : ""}Cumulative adjusted-price returns in USD; unfinished outcomes are withheld.</p><div class="table-wrap" tabindex="0" role="region" aria-label="Selected position forward returns; scroll horizontally"><table class="forward-point-table"><thead><tr><th>Asset</th>${data.horizons.map((h) => `<th>${h} months<br><small>to ${shift(entry, h)}</small></th>`).join("")}</tr></thead><tbody>${Object.entries(
        data.assets,
      )
        .map(
          ([asset, name]) =>
            `<tr><th scope="row">${asset} <small>${esc(name)}</small></th>${row.returns[lag][asset].map((r, i) => `<td>${Number.isFinite(r) ? `<strong>${pct(r)}</strong>` : `<span class="sub">${shift(entry, data.horizons[i]) > data.priceCoverage[asset].lastPrice ? "Not yet complete" : "No price history"}</span>`}</td>`).join("")}</tr>`,
        )
        .join("")}</tbody></table></div>`;
  }
  function render() {
    if (!data) return;
    const horizon = $("forwardHorizon").value,
      lag = $("forwardLag").value,
      mode = $("forwardSample").value,
      metric = $("forwardMetric").value,
      asset = $("forwardAsset").value;
    const cohort = data.cohorts[lag][horizon][mode],
      selected = cohort[asset];
    const metricName = {
      mean: "Mean cumulative return",
      median: "Median cumulative return",
      lift: "Mean vs own cohort baseline",
    }[metric];
    $("forwardStatus").textContent =
      `Frozen research · ${data.asOf} · prices through ${data.lastPriceMonth} · ${data.stateCoverage.n} monthly economic states (${data.stateCoverage.first}–${data.stateCoverage.last}). Chart sampling does not filter this study.`;
    $("forwardTiming").textContent =
      lag === "0"
        ? "Reference-month study: enter at the end of the economic reference month, before its data were fully published. Latest-revised states create look-ahead and revision bias."
        : "Delayed-entry sensitivity: enter two months after the reference month, then hold for the full selected horizon. This still uses revised states; it is not a point-in-time investment test.";
    const headers = Object.entries(data.assets)
      .map(
        ([a, name]) =>
          `<th scope="col">${a}<small>${esc(name)}</small><small>State ${cohort[a].first}–${cohort[a].last} · N=${cohort[a].n}</small></th>`,
      )
      .join("");
    $("forwardHeatmap").innerHTML =
      `<table class="forward-heatmap"><caption>${esc(metricName)} · ${horizon} months after entry · ${mode === "common" ? "identical state months for all assets" : "maximum history for each asset"}</caption><thead><tr><th>Economic state</th>${headers}</tr></thead><tbody>${Object.entries(
        data.quadrants,
      )
        .map(
          ([q, label]) =>
            `<tr><th scope="row">${esc(label)}</th>${Object.keys(data.assets)
              .map((a) => {
                const c = cohort[a].cells[q],
                  v = c[metric];
                return `<td style="background:${Number.isFinite(v) ? `rgba(${v >= 0 ? "57,190,145" : "240,106,116"},${0.05 + Math.min(Math.abs(v), 0.6) * 0.35})` : "transparent"}">${c.n ? `<strong>${metric === "lift" ? pp(v) : pct(v)}</strong><small>N=${c.n} · ${c.episodes} episodes</small>` : "No observations"}</td>`;
              })
              .join("")}</tr>`,
        )
        .join(
          "",
        )}<tr class="forward-baseline"><th scope="row">Unconditional baseline<small>Same cohort, all states</small></th>${Object.values(
        cohort,
      )
        .map((c) => `<td>${metric === "lift" ? "0.0 pp" : pct(c[metric])}</td>`)
        .join("")}</tr></tbody></table>`;
    const leaders = Object.entries(selected.cells)
      .filter(([key, c]) => key !== "boundary" && c.n)
      .sort((a, b) => b[1].mean - a[1].mean);
    const [q, c] = leaders[0];
    $("forwardFinding").textContent =
      `${asset}: highest historical mean among the four quadrants after ${data.quadrants[q]} · ${pct(c.mean)} over ${horizon} months (median ${pct(c.median)}, N=${c.n}, ${c.episodes} episodes). Difference from its own cohort mean ${pp(c.lift)}. Exact-anchor cases remain separate. A retrospective rank is not evidence of a reliable forecast.`;
    $("forwardDetails").innerHTML =
      `<table><caption>${asset} · overlapping outcomes from reference months ${selected.first}–${selected.last}</caption><thead><tr><th>Economic state</th><th>Mean / median</th><th>Positive / P10–P90</th><th>Difference vs baseline<br>95% block interval · pp</th><th>Correlation*</th></tr></thead><tbody>${Object.entries(
        selected.cells,
      )
        .map(
          ([key, v]) =>
            `<tr><th scope="row">${esc(data.quadrants[key])}${v.n ? `<small>${v.first}–${v.last} · ${v.n} windows / ${v.episodes} episodes</small>` : ""}</th>${v.n ? `<td>${pct(v.mean)} / ${pct(v.median)}</td><td>${(100 * v.positive).toFixed(0)}% / ${pct(v.p10)} to ${pct(v.p90)}</td><td>${pp(v.lift)}<small>${v.liftCI ? `${pp(v.liftCI[0])} to ${pp(v.liftCI[1])}` : "Interval unavailable: insufficient category representation"}</small></td><td>${corr(v.correlation)}</td>` : '<td colspan="4">No observations</td>'}</tr>`,
        )
        .join("")}</tbody></table>`;
    const axes = selected.continuous;
    $("forwardAssociation").textContent =
      `*One-versus-rest point-biserial correlation; quadrant IDs are not numeric scores. Categorical η² = ${(100 * selected.etaSquared).toFixed(1)}% of sample return variance between state means. Activity Pearson / Spearman: ${corr(axes.activity.pearson)} / ${corr(axes.activity.spearman)}. Inflation gap: ${corr(axes.inflationGap.pearson)} / ${corr(axes.inflationGap.spearman)}. Descriptive, in-sample associations.`;
    $("forwardCoverage").textContent =
      `State history starts ${data.stateCoverage.first}; asset prices start ${Object.entries(
        data.priceCoverage,
      )
        .map(([a, c]) => `${a} ${c.firstPrice}`)
        .join(
          ", ",
        )}. Only fully observed ${horizon}-month outcomes enter this table; the last eligible state month varies with horizon and entry delay. N counts overlapping monthly windows. Boundary observations are retained separately; near-boundary states stay in their signed quadrant.`;
    renderPoint();
  }
  for (const id of [
    "forwardHorizon",
    "forwardLag",
    "forwardSample",
    "forwardMetric",
    "forwardAsset",
  ])
    $(id).addEventListener("change", render);
  async function load() {
    try {
      const response = await fetch("/data/state-forward.json");
      if (!response.ok) throw new Error("Research unavailable");
      const next = await response.json();
      if (
        next.version !== "state-forward-1" ||
        !next.points?.length ||
        !next.cohorts?.["0"]?.["36"]?.common?.SPY
      )
        throw new Error("Invalid research snapshot");
      data = next;
      render();
      tiltView.render(snapshot, data);
    } catch {
      $("forwardStatus").textContent =
        "Forward-return research could not be loaded. Reload to retry; no example results are substituted.";
      $("stateForwardPoint").textContent =
        "Forward-return research unavailable.";
      tiltView.render(snapshot, null);
    }
  }
  load();
  return {
    setSnapshot(next) {
      snapshot = next;
      tiltView.render(snapshot, data);
    },
    inspect(next) {
      slot = next;
      renderPoint();
    },
  };
}
