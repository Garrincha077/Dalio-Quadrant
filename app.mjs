import {
  VERSION,
  DEFINITIONS,
  classify,
  isCompatibleSnapshot,
} from "./lib/model.mjs";
import { historyRecord } from "./lib/archive.mjs";
import { createHistoryView } from "./history-view.mjs";
import { createQuadrantView } from "./quadrant-view.mjs";
import { createAssetsView } from "./assets-view.mjs";
import { createResearchView } from "./research-view.mjs";
import { createStateView } from "./state-view.mjs";
import { createEvidenceView, renderLayerEvidence } from "./evidence-view.mjs";
import { createAssetScoresView } from "./asset-scores-view.mjs";
import { setupPwa, checkForPwaUpdate } from "./pwa.mjs";
import {
  saveOfflineSummary,
  showOfflineSummary,
  clearOfflineSummary,
} from "./offline-summary.mjs";
setupPwa();
const stateView = createStateView();
const longRun = createHistoryView();
const assetsView = createAssetsView();
const quadrantView = createQuadrantView((slot) =>
  assetsView.render(snapshot, slot),
);
const researchView = createResearchView((s) => assetsView.setResearch(s));
const evidenceView = createEvidenceView();
const assetScoresView = createAssetScoresView();
renderLayerEvidence(null);
document.addEventListener("click", (event) => {
  if (event.target.closest("[data-open-asset-scores]")) {
    document.getElementById("tab-asset-scores").click();
    document.getElementById("assetScores").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (event.target.closest("[data-open-research]")) {
    document.getElementById("tab-research").click();
    document.getElementById("evidenceResearch").scrollIntoView({ behavior: "smooth", block: "start" });
  }
});
const $ = (id) => document.getElementById(id),
  finite = Number.isFinite;
const fmt = (v, d = 2) => (finite(v) ? v.toFixed(d) : "—");
const signed = (v, d = 2) =>
  finite(v) ? `${v > 0 ? "+" : ""}${v.toFixed(d)}` : "—";
const text = (id, value) => ($(id).textContent = value);
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const date = (s, f) =>
  !s
    ? "No observation"
    : f === "quarterly"
      ? `Q${Math.floor((Number(s.slice(5, 7)) - 1) / 3) + 1} ${s.slice(0, 4)}`
      : f === "annual"
        ? `FY ${s.slice(0, 4)}`
        : new Date(s + "T00:00:00Z").toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            ...(f === "monthly" ? {} : { day: "numeric" }),
            timeZone: "UTC",
          });
const when = (s) => new Date(s).toLocaleString();
let snapshot = null,
  history = [],
  refreshing = false,
  sharedLoaded = false;
let retryTimer = null;
try {
  const stored = JSON.parse(localStorage.getItem("dq_v2_history") || "[]");
  if (Array.isArray(stored))
    history = stored
      .filter(
        (s) =>
          isCompatibleSnapshot(s) &&
          finite(s.growth?.score) &&
          finite(s.inflation?.score) &&
          s.signature &&
          s.fetchedAt,
      )
      .map(historyRecord)
      .slice(-200);
  // Remove a legacy credential without deleting the user's version 1 records.
  const legacy = JSON.parse(localStorage.getItem("dq3_state") || "null");
  if (legacy && "fredKey" in legacy) {
    delete legacy.fredKey;
    localStorage.setItem("dq3_state", JSON.stringify(legacy));
  }
} catch {}

document.querySelectorAll("[role=tab]").forEach((button) =>
  button.addEventListener("click", () => {
    document
      .querySelectorAll("[role=tab]")
      .forEach((b) => b.setAttribute("aria-selected", String(b === button)));
    document
      .querySelectorAll("[role=tabpanel]")
      .forEach(
        (p) => (p.hidden = p.id !== button.getAttribute("aria-controls")),
      );
    if (button.id === "tab-dashboard") drawQuadrant();
    if (button.id === "tab-state") stateView.redraw();
    if (button.id === "tab-context") longRun.redraw();
    if (button.id === "tab-history") {
      renderHistory();
      loadSharedHistory();
    }
  }),
);
document
  .querySelector("[role=tablist]")
  .addEventListener("keydown", (event) => {
    const tabs = [...document.querySelectorAll("[role=tab]")],
      i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const target =
      event.key === "ArrowRight"
        ? (i + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (i + tabs.length - 1) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : null;
    if (target !== null) {
      event.preventDefault();
      tabs[target].focus();
      tabs[target].click();
    }
  });
function badge(d) {
  return `<span class="pill ${d.status}">${d.status === "ok" ? "Dated" : d.status}</span>`;
}
function table(items) {
  return `<table><thead><tr><th>Indicator / observation period</th><th>Latest</th><th>Change</th><th>Status</th></tr></thead><tbody>${items.map((d) => `<tr><td><a href="https://fred.stlouisfed.org/series/${d.series}" target="_blank" rel="noopener">${d.name}</a><small>${date(d.date, d.frequency)} · ${d.frequency}</small></td><td>${fmt(d.value)} <small>${d.unit}</small></td><td>${signed(d.delta)} <small>${d.unit === "index" ? "points" : "pp"} / ${d.deltaMonths === 12 ? "1Y" : "3M"}</small></td><td>${badge(d)}${d.value !== null && d.previous === null ? "<small>No comparison</small>" : ""}</td></tr>`).join("")}</tbody></table>`;
}
const sensitivity = {
  goldilocks:
    "Illustrative sensitivity: equities may benefit from stronger activity and easing inflation pressure.",
  overheating:
    "Illustrative sensitivity: real assets may benefit; nominal duration can face inflation pressure.",
  stagflation:
    "Illustrative sensitivity: inflation protection may help; growth-sensitive assets can face pressure.",
  deflation:
    "Illustrative sensitivity: nominal duration may help if yields fall; slowing growth can pressure equities.",
  transition:
    "Evidence is close to a boundary. Small input changes can change the label.",
  unavailable: "A conclusion requires enough fresh observations on both axes.",
};
function render() {
  const s = snapshot,
    g = s.growth.score,
    i = s.inflation.score;
  stateView.render(s);
  renderLayerEvidence(s);
  text("regime", s.regime.name);
  text("growthScore", signed(g));
  text("inflationScore", signed(i));
  text(
    "coverage",
    `${Math.round(Math.min(s.growth.coverage, s.inflation.coverage) * 100)}%`,
  );
  $("growthScore").className = g === null ? "" : g >= 0 ? "pos" : "neg";
  $("inflationScore").className = i === null ? "" : i >= 0 ? "neg" : "blue";
  text(
    "interpretation",
    g === null || i === null
      ? "One or both axes lack 75% fresh weighted coverage. No regime conclusion is available."
      : `Observed activity is ${g > 0 ? "accelerating" : g < 0 ? "decelerating" : "mixed"}; annual inflation is ${i > 0 ? "accelerating" : i < 0 ? "slowing" : "mixed"}. These observations arrive at different dates and may be revised.`,
  );
  text("balanceNote", sensitivity[s.regime.id]);
  for (const group of ["growth", "inflation", "credit", "debt"])
    $(group + "Table").innerHTML = table(
      s.indicators.filter((d) => d.group === group),
    );
  const drivers = s.indicators
    .filter((d) => finite(d.score))
    .map((d) => ({
      ...d,
      contribution:
        (d.score * d.weight) /
        s.indicators
          .filter((x) => x.group === d.group && finite(x.score))
          .reduce((a, x) => a + x.weight, 0),
    }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  $("drivers").innerHTML =
    drivers
      .slice(0, 5)
      .map(
        (d) =>
          `<li><strong>${d.name}</strong> · ${d.group}<br><span class="muted">${fmt(d.value)}% YoY vs ${fmt(d.previous)}% three months earlier → ${signed(d.delta)} pp; contribution ${signed(d.contribution, 3)}.</span></li>`,
      )
      .join("") || "<li>Fresh comparison periods are unavailable.</li>";
  const contrary = drivers.filter(
    (d) =>
      Math.sign(d.score) !== Math.sign(d.group === "growth" ? g : i) &&
      d.score !== 0,
  );
  const missing = s.indicators.filter(
    (d) => ["growth", "inflation"].includes(d.group) && !finite(d.score),
  );
  $("counterEvidence").innerHTML =
    `<p>${contrary.length ? `Dissenting indicators: ${contrary.map((d) => d.name).join(", ")}.` : "No dissent among the available directional signals, or no axis conclusion is available."}</p><p>${missing.length ? `Excluded from scoring: ${missing.map((d) => d.name).join(", ")}.` : "All configured macro comparisons are available and within the freshness rules."}</p><p>Next fresh observations and revisions can change this view. Agreement among correlated indicators is not independent confirmation.</p>`;
  $("stress").innerHTML = s.warnings
    .map(
      (d) =>
        `<div class="stress ${d.triggered ? "triggered" : ""}"><div class="eyebrow">${d.triggered === null ? "Unknown" : d.triggered ? "Triggered" : "Below trigger"}</div><strong>${d.name}</strong><div>${fmt(d.value)} ${d.unit}</div><div class="sub">${d.comparison === "lt" ? "<" : "≥"} ${d.threshold} ${d.unit} · ${date(d.date)}</div></div>`,
    )
    .join("");
  $("market").innerHTML = s.market
    .map(
      (d) =>
        `<div class="tile"><h3><a href="https://fred.stlouisfed.org/series/${d.series}" target="_blank" rel="noopener">${d.name}</a></h3><strong>${fmt(d.value)}</strong> <span class="sub">${d.unit}</span><div>${signed(d.change)} ${d.changeUnit} <span class="sub">/ ~30D</span></div><div class="sub">${date(d.date)}</div>${badge(d)}</div>`,
    )
    .join("");
  drawQuadrant();
  longRun.render(s);
  renderHistory();
}
function renderHistory() {
  $("historyTable").innerHTML = history.length
    ? `<table><thead><tr><th>Seen at (local time)</th><th>Growth</th><th>Inflation</th><th>Regime</th></tr></thead><tbody>${history
        .slice()
        .reverse()
        .map(
          (s) =>
            `<tr><td>${escape(when(s.fetchedAt))}</td><td>${signed(s.growth.score)}</td><td>${signed(s.inflation.score)}</td><td>${escape(classify(s.growth.score, s.inflation.score).name)}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : "<p>No valid observed snapshots yet.</p>";
}
async function loadSharedHistory() {
  if (sharedLoaded) return;
  try {
    const response = await fetch("/data/history.json");
    if (!response.ok) throw new Error();
    const records = await response.json();
    if (!Array.isArray(records)) throw new Error();
    const valid = records.filter(
      (s) =>
        isCompatibleSnapshot(s) &&
        finite(s.growth?.score) &&
        finite(s.inflation?.score) &&
        s.signature &&
        s.fetchedAt,
    );
    const bySignature = new Map(
      [...valid, ...history].map((s) => [s.signature, s]),
    );
    history = [...bySignature.values()]
      .sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt))
      .slice(-500);
    sharedLoaded = true;
    renderHistory();
    drawQuadrant();
    text(
      "historyMessage",
      `Shared archive: ${valid.length} changed datasets. Last archived: ${valid.at(-1) ? when(valid.at(-1).fetchedAt) : "none"}. Combined with this browser's observations; identical datasets are deduplicated.`,
    );
  } catch {
    text(
      "historyMessage",
      "Shared archive is unavailable. Showing observations saved in this browser.",
    );
  }
}
function drawQuadrant() {
  quadrantView.render(snapshot);
}
async function refresh() {
  if (refreshing) return;
  clearTimeout(retryTimer);
  retryTimer = null;
  refreshing = true;
  $("refresh").disabled = true;
  text("status", "Refreshing source observations…");
  $("status").className = "status";
  try {
    const response = await fetch(`/api/dashboard?v=${VERSION}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(60000),
      }),
      s = await response.json();
    if (!response.ok) {
      const error = new Error(s.error || "Refresh failed.");
      if (s.errorCode === "FRED_NOT_CONFIGURED") error.retryAfterSeconds = 0;
      else {
        const retry = Number(s.retryAfterSeconds || response.headers.get("Retry-After"));
        error.retryAfterSeconds = Number.isFinite(retry) && retry > 0 ? Math.max(30, Math.min(900, retry)) : 60;
      }
      throw error;
    }
    if (s.version !== VERSION || !Array.isArray(s.indicators)) {
      checkForPwaUpdate();
      throw new Error("Unexpected data version. Please reload.");
    }
    snapshot = s;
    saveOfflineSummary(s);
    clearOfflineSummary();
    if (
      finite(s.growth.score) &&
      finite(s.inflation.score) &&
      history.at(-1)?.signature !== s.signature
    ) {
      history.push(historyRecord(s));
      history = history.slice(-500);
      try {
        localStorage.setItem(
          "dq_v2_history",
          JSON.stringify(history.slice(-200)),
        );
      } catch {
        text(
          "historyMessage",
          "Browser storage is unavailable or full. Export to preserve this session.",
        );
      }
    }
    render();
    const usable = s.indicators.filter((d) => d.status === "ok").length;
    text(
      "status",
      `${s.errors?.length ? "Partial refresh" : "Fetched"} ${when(s.fetchedAt)} · ${usable}/${s.indicators.length} indicators within freshness limits${s.errors?.length ? ` · Unavailable series: ${s.errors.join(", ")}` : ""}. Observation periods are shown per row.`,
    );
    $("status").className =
      `status ${s.errors?.length || s.regime.id === "unavailable" ? "error" : "ok"}`;
  } catch (error) {
    snapshot = null;
    text("regime", "Data unavailable");
    text(
      "interpretation",
      "The current regime is withheld because the refresh failed. Historical observations remain in History.",
    );
    ["growthScore", "inflationScore", "coverage"].forEach((id) =>
      text(id, "—"),
    );
    for (const group of ["growth", "inflation", "credit", "debt"])
      $(group + "Table").innerHTML =
        '<p class="muted">No current observation.</p>';
    ["drivers", "counterEvidence", "stress", "market", "balanceNote"].forEach(
      (id) => text(id, ""),
    );
    const delay = error.retryAfterSeconds ?? (navigator.onLine ? 60 : 0);
    if (delay) retryTimer = setTimeout(() => {
      retryTimer = null;
      if (!document.hidden && navigator.onLine) refresh();
    }, delay * 1000);
    text("status", `${error.message}${delay ? ` Automatic retry at ${new Date(Date.now() + delay * 1000).toLocaleTimeString()}. Refresh data retries now.` : ""}`);
    $("status").className = "status error";
    drawQuadrant();
    longRun.clear();
    stateView.render(null);
    renderLayerEvidence(null);
    await showOfflineSummary();
  } finally {
    refreshing = false;
    $("refresh").disabled = false;
  }
}
$("refresh").addEventListener("click", () => {
  refresh();
  assetScoresView.load();
});
window.addEventListener("online", refresh);
$("export").addEventListener("click", () => {
  const blob = new Blob(
    [
      JSON.stringify(
        { version: VERSION, exportedAt: new Date().toISOString(), history },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `dalio-evidence-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
function scenario() {
  const g = Number($("sg").value),
    i = Number($("si").value),
    r = classify(g, i);
  text("sgValue", fmt(g));
  text("siValue", fmt(i));
  text("scenarioResult", `${r.name}. ${sensitivity[r.id]}`);
}
["sg", "si"].forEach((id) => $(id).addEventListener("input", scenario));
text("version", VERSION);
scenario();
stateView.render(null);
drawQuadrant();
renderHistory();
$("methodTable").innerHTML =
  `<table><thead><tr><th>Indicator</th><th>Scale (pp)</th><th>Weight</th><th>Max age since period end (days)</th></tr></thead><tbody>${DEFINITIONS.filter(
    (d) => d.weight,
  )
    .map(
      (d) =>
        `<tr><td>${d.name}</td><td>${d.scale}</td><td>${d.weight}</td><td>${d.maxAge}</td></tr>`,
    )
    .join("")}</tbody></table>`;
window.addEventListener("resize", () => {
  drawQuadrant();
  longRun.redraw();
  researchView.redraw();
  stateView.redraw();
  evidenceView.redraw();
});
setInterval(
  () => {
    if (!document.hidden) refresh();
  },
  6 * 3600 * 1000,
);
document.addEventListener("visibilitychange", () => {
  if (
    !document.hidden &&
    (!snapshot || Date.now() - Date.parse(snapshot.fetchedAt) > 6 * 3600 * 1000)
  )
    refresh();
});
refresh();
researchView.load();
evidenceView.load();
assetScoresView.load();
