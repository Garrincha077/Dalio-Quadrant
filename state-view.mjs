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
function chart(state) {
  const w = window.matchMedia("(max-width: 600px)").matches ? 340 : 600,
    h = 360,
    cx = w / 2,
    cy = 170;
  const xMax = Math.max(
    1,
    Math.ceil(Math.abs(state?.available ? state.activity.value : 0) * 1.3 * 2) /
      2,
  );
  const yMax = Math.max(
    2,
    Math.ceil(Math.abs(state?.available ? state.inflationGap : 0) * 1.3),
  );
  const dx = (w - 88) / 2,
    dy = 112,
    x = (v) => cx + (v / xMax) * dx,
    y = (v) => cy - (v / yMax) * dy;
  const label = state?.available
    ? `${state.regime.name}. Activity ${fmt(state.activity.value)}, ${month(state.activity.date)}; headline PCE ${fmt(state.inflation.value)} percent YoY, ${month(state.inflation.date)}. Inflation gap ${signed(state.inflationGap)} percentage points.`
    : "No valid current state point. Both fresh inputs and compatible periods are required.";
  let svg = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><rect width="${w}" height="${h}" fill="#101725"/>`;
  for (const [color, a, b] of [
    ["#fb899512", 0, 40],
    ["#f3b36c12", cx, 40],
    ["#87b6ff12", 0, cy],
    ["#60d6ab12", cx, cy],
  ])
    svg += `<rect x="${a}" y="${b}" width="${cx}" height="130" fill="${color}"/>`;
  const rules = state?.rules || { activityBuffer: 0.1, inflationBuffer: 0.2 };
  svg += `<rect x="${x(-rules.activityBuffer)}" y="40" width="${x(rules.activityBuffer) - x(-rules.activityBuffer)}" height="260" fill="#a7b3c512"/><rect x="0" y="${y(rules.inflationBuffer)}" width="${w}" height="${y(-rules.inflationBuffer) - y(rules.inflationBuffer)}" fill="#a7b3c512"/>`;
  svg += `<path d="M0 ${cy} H${w} M${cx} 40 V300" stroke="#62738e" stroke-dasharray="4 4"/>`;
  for (const a of [-xMax, -xMax / 2, 0, xMax / 2, xMax])
    svg += `<path d="M${x(a)} 300 v4" stroke="#62738e"/><text x="${x(a)}" y="320" text-anchor="middle" font-size="11" fill="#a7b3c5">${fmt(a, 1)}</text>`;
  for (const b of [-yMax, 0, yMax])
    svg += `<text x="5" y="${y(b) + 4}" font-size="10" fill="#a7b3c5">${signed(b, 0)} pp</text>`;
  svg += `<g font-size="10" fill="#b7c3d6"><text x="9" y="19">BELOW-TREND ACTIVITY</text><text x="9" y="32">INFLATION ABOVE 2%</text><text x="${w - 9}" y="19" text-anchor="end">ABOVE-TREND ACTIVITY</text><text x="${w - 9}" y="32" text-anchor="end">INFLATION ABOVE 2%</text><text x="9" y="340">BELOW-TREND ACTIVITY</text><text x="9" y="353">INFLATION BELOW 2%</text><text x="${w - 9}" y="340" text-anchor="end">ABOVE-TREND ACTIVITY</text><text x="${w - 9}" y="353" text-anchor="end">INFLATION BELOW 2%</text></g>`;
  if (state?.available) {
    const px = x(state.activity.value),
      py = y(state.inflationGap);
    svg += `<circle cx="${px}" cy="${py}" r="13" fill="#e2b752"/><circle cx="${px}" cy="${py}" r="19" fill="none" stroke="#e2b752"/><text x="${Math.min(w - 52, px + 24)}" y="${Math.max(56, py - 16)}" fill="#f0cf7e" font-size="12">Latest</text>`;
  } else
    svg += `<text x="${cx}" y="130" text-anchor="middle" fill="#a7b3c5" font-size="12">State unavailable</text>`;
  return svg + "</svg>";
}
function observation(d) {
  return d
    ? `<tr><th scope="row"><a href="https://fred.stlouisfed.org/series/${esc(d.series)}" target="_blank" rel="noopener">${esc(d.name)}</a></th><td>${fmt(d.value)} ${esc(d.unit)}</td><td>${d.frequency === "quarterly" ? quarter(d.date) : month(d.date)}</td><td><span class="pill ${d.status === "ok" ? "ok" : "stale"}">${esc(d.status)}</span></td></tr>`
    : "";
}
export function createStateView() {
  let snapshot = null;
  function redraw() {
    $("stateChart").innerHTML = chart(snapshot?.economicState);
  }
  function render(next) {
    snapshot = next;
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
        : "Both state inputs are fresh and their reference periods are no more than one month apart."
      : s?.periodGapMonths > 1
        ? "State withheld: activity and inflation reference months are too far apart."
        : "State withheld until both inputs are available and fresh. No substitute values are used.";
    const g = next?.growth.score,
      i = next?.inflation.score;
    $("stateDirection").textContent =
      finite(g) && finite(i)
        ? `State is a level; direction is a separate question. The momentum view currently reads growth ${signed(g)} and inflation ${signed(i)} (${next.regime.name}). Improving momentum can coexist with below-trend activity; easing inflation can remain above 2%.`
        : "Momentum is a separate lens and is currently unavailable.";
    const indicators = next?.indicators || [],
      get = (id) => indicators.find((d) => d.id === id),
      rows = [
        get("activityState"),
        get("headlinePce"),
        get("gdp"),
        get("pce"),
        get("unemployment"),
      ];
    $("stateEvidence").innerHTML = next
      ? `<table><caption>Dated levels behind the state and its cross-checks</caption><thead><tr><th>Indicator</th><th>Level</th><th>Reference period</th><th>Status</th></tr></thead><tbody>${rows.map(observation).join("")}</tbody></table>`
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
