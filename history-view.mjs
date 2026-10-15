const $ = (id) => document.getElementById(id),
  finite = Number.isFinite;
const fmt = (v, n = 2) => (finite(v) ? v.toFixed(n) : "—");
const signed = (v) => (finite(v) ? `${v > 0 ? "+" : ""}${v.toFixed(2)}` : "—");
const period = (d, f) =>
  !d
    ? "none"
    : f === "annual"
      ? `FY ${d.slice(0, 4)}`
      : f === "quarterly"
        ? `Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1} ${d.slice(0, 4)}`
        : d.slice(0, 7);
function statsReason(stats, robust) {
  if (!stats) return "No reference window";
  if (stats.status === "insufficient_history")
    return `Incomplete history: ${stats.n}/${stats.expected} prior observations`;
  if (stats.status === "missing_current")
    return "Current transformed observation is missing";
  if (stats.status === "constant_baseline")
    return "Reference standard deviation is zero";
  if (robust && !finite(stats.robustZ))
    return "Reference median absolute deviation is zero";
  if (stats.status === "partial_window")
    return `Reference has gaps: ${stats.n}/${stats.expected} prior observations (at least 95% required)`;
  return `${stats.n} preceding observations`;
}
export function createHistoryView() {
  let snapshot = null,
    selected = "pce",
    years = 10;
  const measure = () => $("contextMeasure").value;
  const robust = () => $("contextEstimator").value === "robust";
  const statistic = (p) => p.windows[years][measure()];
  const zValue = (stats) => stats?.[robust() ? "robustZ" : "z"];
  function renderTable() {
    if (!snapshot) return;
    const currentById = new Map(snapshot.indicators.map((d) => [d.id, d]));
    $("contextTable").innerHTML =
      `<table class="context-table"><thead><tr><th>Indicator / statistical period</th><th>${measure() === "level" ? "Level" : "Momentum"}</th><th>Z 5Y</th><th>Z 10Y</th><th>Z 20Y</th><th>20Y percentile</th></tr></thead><tbody>${snapshot.profiles
        .map((p) => {
          const row = currentById.get(p.id),
            value = p.current?.[measure() === "level" ? "value" : "momentum"];
          return `<tr><td><a href="https://fred.stlouisfed.org/series/${p.series}" target="_blank" rel="noopener">${p.name}</a><small>${period(p.current?.date, p.frequency)} · ${p.frequency}${row?.status !== "ok" ? ` · ${row?.status || "missing"}` : ""}</small></td><td>${fmt(value)}<small>${measure() === "level" ? p.unit : `${p.unit === "index" ? "points" : "pp"} / ${p.frequency === "annual" ? "1Y" : p.id === "nfci" || p.id === "liquidity" || p.id === "loans" ? "13 weeks" : "3M"}`}</small></td>${[
            5, 10, 20,
          ]
            .map((y) => {
              const stat = p.windows[y][measure()],
                z = zValue(stat),
                alpha = finite(z)
                  ? Math.min(0.65, 0.12 + Math.abs(z) * 0.13)
                  : 0;
              const color = finite(z)
                ? `background:rgba(${z >= 0 ? "230,155,80" : "90,157,240"},${alpha})`
                : "";
              return `<td><button type="button" class="z-cell ${selected === p.id && years === y ? "chosen" : ""}" style="${color}" data-profile="${p.id}" data-years="${y}" aria-label="${p.name}, ${y}-year ${measure()} z-score ${signed(z)}. ${statsReason(stat, robust())}" title="${statsReason(stat, robust())}">${signed(z)}<small>n=${stat.n}/${stat.expected}</small></button></td>`;
            })
            .join(
              "",
            )}<td>${fmt(p.windows[20][measure()].percentile, 1)}${finite(p.windows[20][measure()].percentile) ? "%" : ""}</td></tr>`;
        })
        .join("")}</tbody></table>`;
  }
  function draw() {
    if (!snapshot) return;
    const p = snapshot.profiles.find((p) => p.id === selected);
    if (!p) return;
    const stat = statistic(p),
      z = zValue(stat),
      centre = robust() ? stat.median : stat.mean,
      dispersion = robust() ? 1.4826 * stat.mad : stat.sd;
    const unit =
      measure() === "level" ? p.unit : p.unit === "index" ? "points" : "pp";
    $("contextTitle").textContent =
      `${p.name} · ${years} years · ${measure()} (${unit})`;
    $("contextDetail").textContent =
      `${robust() ? "Robust" : "Standard"} z-score ${signed(z)} · ${statsReason(stat, robust())}. Reference: ${period(p.windows[years].start, p.frequency)} to ${period(p.windows[years].end, p.frequency)}; current ${period(p.current?.date, p.frequency)}. ${p.frequency === "annual" ? "Annual reference samples are small. " : ""}Descriptive comparison of the latest revised data.`;
    const canvas = $("contextChart"),
      r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = r.width * dpr;
    canvas.height = r.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const w = r.width,
      h = r.height,
      pad = { l: 56, r: 18, t: 20, b: 36 },
      right = w - pad.r,
      bottom = h - pad.b;
    ctx.fillStyle = "#101725";
    ctx.fillRect(0, 0, w, h);
    const metric = measure() === "level" ? "value" : "momentum",
      last = p.current?.date;
    if (!last) {
      ctx.fillStyle = "#a7b3c5";
      ctx.fillText("No dated history is available.", pad.l, 45);
      return;
    }
    const lower = new Date(last + "T00:00:00Z");
    lower.setUTCFullYear(lower.getUTCFullYear() - years);
    const from = lower.getTime(),
      to = Date.parse(last),
      rows = p.history.filter((d) => Date.parse(d.date) >= from),
      values = rows.map((d) => d[metric]).filter(finite);
    if (!values.length) {
      ctx.fillStyle = "#a7b3c5";
      ctx.fillText("No transformed values are available.", pad.l, 45);
      return;
    }
    if (finite(centre) && finite(dispersion))
      values.push(centre - 2 * dispersion, centre + 2 * dispersion);
    const lo = Math.min(...values),
      hi = Math.max(...values),
      margin = Math.max((hi - lo) * 0.12, 0.1),
      min = lo - margin,
      max = hi + margin;
    const x = (date) =>
        pad.l + ((Date.parse(date) - from) / (to - from)) * (right - pad.l),
      y = (v) => bottom - ((v - min) / (max - min)) * (bottom - pad.t);
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.l, pad.t, right - pad.l, bottom - pad.t);
    ctx.clip();
    for (const recession of snapshot.recessions || []) {
      const end = new Date(recession.date + "T00:00:00Z");
      end.setUTCMonth(end.getUTCMonth() + 1);
      ctx.fillStyle = "#9aa7bb26";
      ctx.fillRect(
        x(recession.date),
        pad.t,
        x(end.toISOString().slice(0, 10)) - x(recession.date),
        bottom - pad.t,
      );
    }
    if (finite(centre) && finite(dispersion)) {
      ctx.fillStyle = "#87b6ff12";
      ctx.fillRect(
        pad.l,
        y(centre + 2 * dispersion),
        right - pad.l,
        y(centre - 2 * dispersion) - y(centre + 2 * dispersion),
      );
      ctx.strokeStyle = "#87b6ff88";
      ctx.setLineDash([5, 5]);
      for (const v of [
        centre - 2 * dispersion,
        centre,
        centre + 2 * dispersion,
      ]) {
        ctx.beginPath();
        ctx.moveTo(pad.l, y(v));
        ctx.lineTo(right, y(v));
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = "#e2b752";
    ctx.lineWidth = 2;
    ctx.beginPath();
    let drawing = false,
      lastMonth = null;
    for (const row of rows) {
      const value = row[metric],
        m = Number(row.date.slice(0, 4)) * 12 + Number(row.date.slice(5, 7)),
        step =
          p.frequency === "quarterly" ? 3 : p.frequency === "annual" ? 12 : 1;
      if (!finite(value)) {
        drawing = false;
        continue;
      }
      if (lastMonth !== null && m - lastMonth > step) drawing = false;
      if (drawing) ctx.lineTo(x(row.date), y(value));
      else ctx.moveTo(x(row.date), y(value));
      drawing = true;
      lastMonth = m;
    }
    ctx.stroke();
    ctx.restore();
    ctx.font = "11px system-ui,sans-serif";
    ctx.fillStyle = "#a7b3c5";
    ctx.textAlign = "right";
    for (let j = 0; j < 5; j++) {
      const v = min + ((max - min) * j) / 4;
      ctx.fillText(fmt(v, 1), pad.l - 7, y(v) + 4);
    }
    ctx.textAlign = "center";
    for (let j = 0; j < 5; j++) {
      const time = from + ((to - from) * j) / 4;
      ctx.fillText(
        String(new Date(time).getUTCFullYear()),
        pad.l + ((right - pad.l) * j) / 4,
        h - 12,
      );
    }
    canvas.setAttribute(
      "aria-label",
      `${p.name} ${measure()} in ${unit} over ${years} years. Selected z-score ${signed(z)}; baseline ${stat.n} observations. The heatmap shows numeric statistics; Export selected series provides the underlying chart values.`,
    );
  }
  function render(next) {
    snapshot = next;
    $("contextExport").disabled = false;
    if (!snapshot.profiles.some((p) => p.id === selected))
      selected = snapshot.profiles[0]?.id;
    $("contextIndicator").innerHTML = snapshot.profiles
      .map((p) => `<option value="${p.id}">${p.name}</option>`)
      .join("");
    $("contextIndicator").value = selected;
    renderTable();
    draw();
  }
  $("contextTable").addEventListener("click", (event) => {
    const button = event.target.closest("[data-profile]");
    if (!button) return;
    selected = button.dataset.profile;
    years = Number(button.dataset.years);
    $("contextIndicator").value = selected;
    $("contextYears").value = String(years);
    renderTable();
    draw();
  });
  for (const id of [
    "contextMeasure",
    "contextEstimator",
    "contextIndicator",
    "contextYears",
  ])
    $(id).addEventListener("change", () => {
      selected = $("contextIndicator").value || selected;
      years = Number($("contextYears").value);
      renderTable();
      draw();
    });
  $("contextExport").addEventListener("click", () => {
    const p = snapshot?.profiles.find((p) => p.id === selected);
    if (!p) return;
    const rows = [
      "date,value,momentum,frequency,unit,source",
      ...p.history.map((r) =>
        [
          r.date,
          r.value ?? "",
          r.momentum ?? "",
          p.frequency,
          p.unit,
          `https://fred.stlouisfed.org/series/${p.series}`,
        ].join(","),
      ),
    ];
    const url = URL.createObjectURL(
        new Blob([rows.join("\n") + "\n"], { type: "text/csv;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = `${p.series}-${p.id}-history.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  return {
    render,
    redraw: draw,
    clear() {
      snapshot = null;
      $("contextExport").disabled = true;
      $("contextTitle").textContent = "Historical comparison";
      $("contextTable").textContent = "Current data is unavailable.";
      $("contextDetail").textContent =
        "Refresh data before making a comparison.";
      $("contextChart")
        .getContext("2d")
        .clearRect(0, 0, $("contextChart").width, $("contextChart").height);
    },
  };
}
