import {
  buildStateTrail,
  stateScale,
  activityContext,
  stateMove,
} from "./lib/state-history.mjs";
import {
  renderStateChart,
  renderActivityHistogram,
  statePointLabel,
} from "./state-chart.mjs";
import { createForwardView } from "./forward-view.mjs";
const $ = (id) => document.getElementById(id);
const finite = Number.isFinite;
const fmt = (n, d = 2) => (finite(n) ? n.toFixed(d) : "—");
const signed = (n, d = 2) =>
  finite(n) ? `${n > 0 ? "+" : ""}${n.toFixed(d)}` : "—";
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const month = (s) =>
  s
    ? new Date(s + "T00:00:00Z").toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "No observation";
const quarter = (s) =>
  s
    ? `${s.slice(0, 4)} Q${Math.floor((Number(s.slice(5, 7)) - 1) / 3) + 1}`
    : "No target quarter";
const updated = (s) =>
  s
    ? new Date(s).toLocaleDateString(undefined, {
        dateStyle: "medium",
        timeZone: "UTC",
      }) + " UTC"
    : "Update date unavailable";
function observation(d) {
  return d
    ? `<tr><th scope="row">${d.source ? `<a href="${esc(d.source)}" target="_blank" rel="noopener">${esc(d.name)}</a>` : esc(d.name)}</th><td>${fmt(d.value)} ${esc(d.unit)}</td><td>${d.frequency === "quarterly" ? quarter(d.date) : month(d.date)}</td><td><span class="pill ${d.status === "ok" ? "ok" : "stale"}">${esc(d.status)}</span></td></tr>`
    : "";
}
export function createStateView() {
  const forwardView = createForwardView();
  let snapshot = null,
    slots = [],
    selected = "latest",
    replayEnd = null;
  function redraw() {
    const history = snapshot?.stateHistory?.history || [];
    slots = buildStateTrail(snapshot, {
      cadence: $("stateCadence").value,
      end: replayEnd,
    });
    if (!slots.some((s) => s.key === selected))
      selected = slots.at(-1)?.key || "latest";
    const scale = stateScale($("stateZoom").value, history);
    $("stateChart").innerHTML = renderStateChart(
      slots,
      scale,
      selected,
      window.matchMedia("(max-width: 600px)").matches,
    );
    $("stateInspect").replaceChildren(
      ...slots.map((s) => {
        const option = document.createElement("option");
        option.value = s.key;
        option.textContent = `${s.sequence} · ${s.label}${s.point ? "" : " · unavailable"}`;
        return option;
      }),
    );
    $("stateInspect").value = selected;
    $("stateInspect").disabled = !slots.length;
    const chosen = slots.find((s) => s.key === selected);
    $("stateReadout").textContent = chosen
      ? statePointLabel(chosen)
      : "Waiting for source history.";
    forwardView.inspect(chosen);
    const outside = slots.filter(
      (s) =>
        s.point &&
        (Math.abs(s.point.activity) > scale.activity ||
          Math.abs(s.point.inflationGap) > scale.inflation),
    );
    $("stateTrailStatus").textContent =
      `${slots.filter((s) => s.point).length}/${slots.length || 12} positions · 1 oldest → 12 ${replayEnd ? "selected end" : "latest"}. ${outside.length ? `${outside.length} outside this viewport: diamonds mark the boundary; choose Full history for exact placement. ` : ""}Gaps are not connected.`;
    $("statePlotMode").textContent = replayEnd
      ? `Historical replay ending ${replayEnd} · latest-revised reference periods`
      : "Latest published state and preceding reference periods";
    $("stateLatest").disabled = !replayEnd;
    const last = slots.at(-1);
    if (!replayEnd && last) $("stateEnd").value = last.date.slice(0, 7);
    $("stateEnd").min = history[0]?.date.slice(0, 7) || "";
    $("stateEnd").max =
      [
        snapshot?.economicState?.activity?.date,
        snapshot?.economicState?.inflation?.date,
      ]
        .filter(Boolean)
        .sort()
        .at(-1)
        ?.slice(0, 7) || "";
    $("stateEnd").disabled = !history.length;
    const move = stateMove(slots);
    $("stateMove").textContent = move
      ? `Last sampled move ${move.arrow} · Activity ${signed(move.activity)} index · PCE ${signed(move.inflation)} pp · from ${move.from}. Observed change, not a forecast.`
      : "Direction unavailable across the last gap; no arrow bridges it.";
    renderContext();
  }
  function renderContext() {
    const d = snapshot?.economicState?.activity;
    if (d?.status !== "ok") {
      $("stateContextSummary").textContent = "Waiting for fresh activity data.";
      $("stateHistogram").innerHTML = "";
      $("stateContextDetails").textContent = "";
      return;
    }
    const c = activityContext(
      snapshot?.stateHistory?.history,
      d.date,
      d.value,
      $("stateContextWindow").value,
    );
    $("stateContextSummary").textContent = c.robustSd
      ? `Activity ${signed(d.value)} · ${signed(c.distance)} robust dispersion units from zero · Strength ${fmt(c.strength, 1)}/100 (50 = trend).`
      : "Insufficient history or zero robust dispersion in this reference window.";
    $("stateHistogram").innerHTML = renderActivityHistogram(c, d.value);
    $("stateContextDetails").textContent =
      `${c.n}/${c.expected} prior monthly observations · ${month(c.first)} – ${month(c.last)}. ${c.robustSd ? `Percentile ${fmt(c.percentile, 1)} · SD ${fmt(c.sd)} · robust dispersion ${fmt(c.robustSd)} · historical range ${signed(c.min)} to ${signed(c.max)}.` : ""} Gold line: latest activity. White dashed line: zero. Extreme values are grouped in edge bins. Percentile and strength are descriptive context, not probabilities; neither changes the axes.`;
  }
  function render(next) {
    snapshot = next;
    forwardView.setSnapshot(next);
    const s = next?.economicState;
    $("stateRegime").textContent =
      s?.regime.name || "Waiting for fresh state data";
    $("stateActivity").textContent =
      s?.activity.status === "ok" ? signed(s.activity.value) : "—";
    $("stateInflation").textContent =
      s?.inflation.status === "ok" ? `${fmt(s.inflation.value)}%` : "—";
    $("stateGap").textContent =
      s?.inflation.status === "ok" ? `${signed(s.inflationGap)} pp` : "—";
    $("stateDates").textContent = s
      ? `Activity: ${month(s.activity.date)} · Inflation: ${month(s.inflation.date)}${s.mixedPeriods ? " · different reference months" : ""}. Latest released observations; publication delays and revisions apply.`
      : "Both state inputs must be fresh. Check the source refresh status above.";
    $("stateQuality").textContent = s?.available
      ? s.regime.nearBoundary
        ? `${s.regime.nearActivity ? "Activity is close to its trend anchor. " : ""}${s.regime.nearInflation ? "Inflation is close to the 2% anchor. " : ""}Small revisions can change the side of a nearby boundary.`
        : "Both state inputs are fresh and describe the same completed reference month."
      : s?.periodGapMonths > 0
        ? "Joint state withheld: activity and inflation describe different reference months. Individual dated readings remain visible."
        : "State withheld until both inputs are available and fresh. No substitute values are used.";
    const g = next?.growth.score,
      i = next?.inflation.score;
    $("stateDirection").textContent =
      finite(g) && finite(i)
        ? `State is a level; direction is a separate question. The momentum view currently reads growth ${signed(g)} and inflation ${signed(i)} (${next.regime.name}). Improving momentum can coexist with below-trend activity; easing inflation can remain above 2%.`
        : "Momentum is a separate lens and is currently unavailable.";
    const indicators = next?.indicators || [],
      get = (id) => indicators.find((d) => d.id === id);
    const b = s?.activityBreadth;
    $("stateBreadth").innerHTML =
      `<h3>Monthly activity breadth</h3><strong>${b?.available ? `${b.positive} / ${b.count} expanding YoY` : "Insufficient fresh breadth data"}</strong><div class="state-breadth-dots" aria-hidden="true">${(b?.indicators || []).map((d) => `<span class="${d.status !== "ok" ? "unknown" : d.value > 0 ? "positive" : d.value < 0 ? "negative" : "flat"}"></span>`).join("")}</div><p class="sub">${b ? `${b.count}/${b.total} usable readings${b.count ? ` · ${month(b.earliest)}${b.latest !== b.earliest ? ` – ${month(b.latest)}` : ""}` : ""}. ` : ""}Six monthly output, income, spending, sales and employment measures. Positive YoY growth can still be below trend; the count is not a recession probability.</p>`;
    const groups = s?.evidence || [];
    const evidenceRows = groups.flatMap((group) => group.indicators);
    const fresh = evidenceRows.filter(
      (d) => d.status === "ok" && finite(d.value),
    ).length;
    $("stateCoverage").textContent = groups.length
      ? `${fresh}/${evidenceRows.length} fresh readings across activity, labour and prices. Each observation retains its reference period. Cross-checks do not add weight to the quadrant axes.`
      : "Waiting for dated evidence.";
    $("stateEvidence").innerHTML = groups.length
      ? `<table><caption>Economic state: ${evidenceRows.length} dated indicators</caption><thead><tr><th>Indicator</th><th>Level / annual growth</th><th>Reference period</th><th>Status</th></tr></thead>${groups.map((group) => `<tbody><tr class="state-group"><th colspan="4" scope="rowgroup">${esc(group.name)}</th></tr>${group.indicators.map(observation).join("")}</tbody>`).join("")}</table>`
      : "No current observations.";
    const n = s?.nowcast;
    $("stateNowcast").innerHTML =
      `<h3>Model nowcast</h3><strong class="lens-value">${n?.status === "ok" ? fmt(n.value) + "%" : "Unavailable"}</strong><p class="sub">${n ? `GDPNow · ${quarter(n.date)} · q/q annualised (SAAR)<br>FRED source updated ${updated(n.updatedAt)} · ${esc(n.status)}` : "Waiting for source data."}</p><p class="sub">A model estimate for its labelled quarter, separate from realised GDP YoY and from this app's asset-return experiment. <a href="https://www.atlantafed.org/research-and-data/data/gdpnow/explainer" target="_blank" rel="noopener">Atlanta Fed methodology</a>.</p>`;
    const be = next?.market.find((d) => d.id === "breakeven"),
      real = next?.market.find((d) => d.id === "realYield");
    $("statePricing").innerHTML =
      `<h3>Market pricing</h3><strong class="lens-value">${be?.status === "ok" ? fmt(be.value) + "%" : "Unavailable"}</strong><p class="sub"><a href="https://fred.stlouisfed.org/series/T10YIE" target="_blank" rel="noopener">10Y inflation breakeven</a> · ${be?.date || "No observation"}<br><a href="https://fred.stlouisfed.org/series/DFII10" target="_blank" rel="noopener">10Y real yield</a>: ${real?.status === "ok" ? fmt(real.value) + "%" : "unavailable"} · ${real?.date || "no observation"}</p><p class="sub">Ten-year market measures include risk and liquidity premia. Their horizon differs from current PCE inflation. They are not a consensus-surprise score.</p>`;
    const nfci = get("nfci"),
      liquidity = get("liquidity");
    $("stateFinancing").innerHTML =
      `<h3>Financial conditions</h3><strong class="lens-value">${nfci?.status === "ok" ? signed(nfci.value) : "Unavailable"}</strong><p class="sub"><a href="https://fred.stlouisfed.org/series/NFCI" target="_blank" rel="noopener">NFCI</a> · ${nfci?.date || "No observation"}<br>Fed net-liquidity proxy: ${liquidity?.status === "ok" ? signed(liquidity.value) + "% YoY" : "unavailable"} · ${liquidity?.date || "no observation"}</p><p class="sub">Negative NFCI means looser-than-average financial conditions. The liquidity proxy uses <a href="https://fred.stlouisfed.org/series/WALCL" target="_blank" rel="noopener">Fed assets</a>, <a href="https://fred.stlouisfed.org/series/WTREGEN" target="_blank" rel="noopener">TGA</a> and <a href="https://fred.stlouisfed.org/series/RRPONTSYD" target="_blank" rel="noopener">RRP</a>. They do not change the static quadrant.</p>`;
    redraw();
  }
  for (const id of ["stateCadence", "stateZoom"])
    $(id).addEventListener("change", () => redraw());
  $("stateContextWindow").addEventListener("change", renderContext);
  $("stateEnd").addEventListener("change", () => {
    const value = $("stateEnd").value;
    if (!value || value < $("stateEnd").min || value > $("stateEnd").max) {
      $("stateEnd").value = replayEnd || $("stateEnd").max;
      return;
    }
    replayEnd = value === $("stateEnd").max ? null : value;
    selected = "";
    redraw();
  });
  $("stateLatest").addEventListener("click", () => {
    replayEnd = null;
    selected = "latest";
    redraw();
  });
  $("stateInspect").addEventListener("change", () => {
    selected = $("stateInspect").value;
    redraw();
  });
  const inspectMark = (event) => {
    const mark = event.target.closest?.("[data-state-key]");
    if (
      !mark ||
      (event.type === "keydown" && !["Enter", " "].includes(event.key))
    )
      return;
    event.preventDefault();
    selected = mark.dataset.stateKey;
    redraw();
    $("stateInspect").focus();
  };
  $("stateChart").addEventListener("click", inspectMark);
  $("stateChart").addEventListener("keydown", inspectMark);
  for (const [id, target] of [
    ["stateToMomentum", "tab-dashboard"],
    ["stateToResearch", "tab-research"],
  ])
    $(id).addEventListener("click", () => {
      $(target).click();
      $(target).focus();
      window.scrollTo({ top: 0 });
    });
  return { render, redraw };
}
