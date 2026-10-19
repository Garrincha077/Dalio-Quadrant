import { buildPressure, pressureDirection } from "./lib/composite.mjs";
const $ = (id) => document.getElementById(id),
  finite = Number.isFinite;
const fmt = (v, n = 0) => (finite(v) ? v.toFixed(n) : "—");
const period = (d, f) =>
  !d
    ? "No date"
    : f === "quarterly"
      ? `Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1} ${d.slice(0, 4)}`
      : f === "annual"
        ? `FY ${d.slice(0, 4)}`
        : d.slice(0, 7);
const signed = (v, n = 2) =>
  finite(v) ? `${v > 0 ? "+" : ""}${v.toFixed(n)}` : "—";
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const reason = (s) =>
  ({
    stale: "stale observation",
    missing: "missing observation",
    insufficient_history: "insufficient reference history",
    missing_current: "missing transformed value",
    constant_baseline: "zero reference dispersion",
  })[s] || String(s || "unavailable").replaceAll("_", " ");
export function createPressureView(onSelect) {
  let result = null,
    selected = "growth";
  const movement = (m) =>
    `${pressureDirection(m.z)}${finite(m.z) ? ` · ${signed(m.z)} z` : ""}`;
  function renderDrivers() {
    if (!result) return;
    const pillar = result.pillars.find((p) => p.id === selected);
    $("pressureDriverTitle").textContent = `${pillar.name} — inputs`;
    $("pressureDriverNote").textContent =
      `25% of the composite. ${pillar.level.used}/${pillar.level.total} inputs available; equal weights among available inputs. Bars show oriented z-scores capped at ±3. Select an input to inspect its history.`;
    $("pressureDrivers").innerHTML = pillar.members
      .map((m) => {
        const z = m.level.z,
          points =
            finite(z) && finite(result.score)
              ? ((50 / 3) * z * 0.25) / pillar.level.used
              : null;
        return `<button type="button" class="pressure-driver" data-input="${m.id}" aria-label="${escape(m.name)}, ${finite(z) ? `oriented z ${signed(z)}, contribution ${signed(points)} points` : escape(reason(m.level.reason))}. Inspect history."><span><strong>${escape(m.name)}</strong><small>${escape(period(m.date, m.frequency))} · ${m.sign < 0 ? "lower = more pressure" : "higher = more pressure"}</small></span><span class="driver-track" aria-hidden="true"><i style="left:${finite(z) ? 50 + (Math.min(0, z) * 50) / 3 : 50}%;width:${finite(z) ? (Math.abs(z) * 50) / 3 : 0}%;background:${z >= 0 ? "#e6a25e" : "#77aef0"}"></i></span><span class="driver-value">${finite(z) ? `${signed(z)} z<small>${signed(points)} pts to total${Math.abs(m.level.rawZ) > 3 ? " · capped" : ""}</small>` : `Excluded<small>${escape(reason(m.level.reason))}</small>`}</span></button>`;
      })
      .join("");
  }
  function render(snapshot, years, estimator) {
    result =
      snapshot.pressure?.scores?.find(
        (s) => s.years === years && s.estimator === estimator,
      ) || buildPressure(snapshot, { years, estimator });
    $("pressureScore").textContent = fmt(result.score, 1);
    $("pressureBand").textContent = result.band;
    $("pressureReference").textContent =
      `${years}-year reference · ${estimator === "robust" ? "median / scaled MAD" : "mean / standard deviation"}`;
    $("pressureMarker").hidden = !finite(result.score);
    $("pressureMarker").style.left = `${result.score ?? 50}%`;
    $("pressureGauge").setAttribute(
      "aria-label",
      finite(result.score)
        ? `Long-run macro pressure ${fmt(result.score, 1)} out of 100. ${result.band}. 50 is the historical centre.`
        : "Composite unavailable: insufficient fresh reference coverage",
    );
    $("pressureCoverage").textContent =
      `${result.used}/16 inputs · ${fmt(result.coverage * 100)}% weighted coverage`;
    $("pressureMovement").textContent = movement(result.momentum);
    $("pressureMovement").title =
      `${fmt(result.momentum.coverage * 100)}% weighted momentum coverage. Historical standardization of changes, not a change in the composite score.`;
    $("pressureExport").disabled = false;
    const available = result.pillars.filter((p) => finite(p.level.score));
    const strongest = [...available].sort(
      (a, b) => b.level.score - a.level.score,
    )[0];
    const weakest = [...available].sort(
      (a, b) => a.level.score - b.level.score,
    )[0];
    $("pressureReading").textContent = !finite(result.score)
      ? "The total needs all four pillars, at least two-thirds of each pillar and 75% weighted coverage. Available pillars remain visible."
      : strongest && weakest && strongest.level.score - weakest.level.score > 10
        ? `Highest: ${strongest.name.toLowerCase()}. Lowest: ${weakest.name.toLowerCase()}. Their ${fmt(strongest.level.score - weakest.level.score)}-point spread shows what the average can hide.`
        : "The four pillars are close together. Inspect their inputs for the underlying differences.";
    $("pressurePillars").innerHTML = result.pillars
      .map(
        (p) =>
          `<button type="button" class="pressure-pillar ${selected === p.id ? "chosen" : ""}" data-pillar="${p.id}" aria-pressed="${selected === p.id}" aria-label="${p.name}, ${fmt(p.level.score)} out of 100. ${p.level.used}/${p.level.total} inputs. ${movement(p.momentum)}. Show inputs."><span class="pillar-heading"><strong>${p.name}</strong><span>${fmt(p.level.score)}<small> / 100</small></span></span><span class="pillar-track" aria-hidden="true"><span class="pillar-centre"></span>${finite(p.level.score) ? `<i style="left:${p.level.score}%"></i>` : ""}</span><span class="pillar-foot"><span>${p.level.used}/${p.level.total} inputs · 25% weight</span><span>${movement(p.momentum)}</span></span></button>`,
      )
      .join("");
    renderDrivers();
  }
  $("pressurePillars").addEventListener("click", (event) => {
    const button = event.target.closest("[data-pillar]");
    if (!button || !result) return;
    selected = button.dataset.pillar;
    $("pressurePillars")
      .querySelectorAll("[data-pillar]")
      .forEach((b) => {
        b.classList.toggle("chosen", b === button);
        b.setAttribute("aria-pressed", String(b === button));
      });
    renderDrivers();
  });
  $("pressureDrivers").addEventListener("click", (event) => {
    const button = event.target.closest("[data-input]");
    if (button) onSelect(button.dataset.input);
  });
  $("pressureExport").addEventListener("click", () => {
    if (!result) return;
    const cell = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const rows = [
      [
        "model",
        "years",
        "estimator",
        "total_score",
        "pillar",
        "id",
        "fred_series",
        "source",
        "date",
        "orientation",
        "level_raw_z",
        "level_capped_oriented_z",
        "effective_weight",
        "points_to_total",
        "level_exclusion",
        "momentum_raw_z",
        "momentum_capped_oriented_z",
        "momentum_exclusion",
      ],
      ...result.pillars.flatMap((p) =>
        p.members.map((m) => {
          const weight =
            finite(m.level.z) && finite(result.score)
              ? 0.25 / p.level.used
              : null;
          return [
            result.modelVersion,
            result.years,
            result.estimator,
            result.score,
            p.id,
            m.id,
            m.series,
            m.series ? `https://fred.stlouisfed.org/series/${m.series}` : null,
            m.date,
            m.sign,
            m.level.rawZ,
            m.level.z,
            weight,
            finite(weight) ? (50 / 3) * m.level.z * weight : null,
            m.level.reason,
            m.momentum.rawZ,
            m.momentum.z,
            m.momentum.reason,
          ];
        }),
      ),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.map((r) => r.map(cell).join(",")).join("\n") + "\n"], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `macro-pressure-${result.years}y-${result.estimator}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  return {
    render,
    clear() {
      result = null;
      $("pressureScore").textContent = "—";
      $("pressureBand").textContent = "Current data unavailable";
      $("pressureMarker").hidden = true;
      $("pressureGauge").setAttribute(
        "aria-label",
        "Current macro pressure unavailable",
      );
      $("pressureReference").textContent = "Refresh to calculate";
      $("pressureCoverage").textContent = "No current coverage";
      $("pressureMovement").textContent = "Direction unavailable";
      $("pressureMovement").title = "";
      $("pressureReading").textContent =
        "Refresh data before interpreting the score.";
      $("pressurePillars").textContent = "Current data unavailable.";
      $("pressureDrivers").textContent = "";
      $("pressureDriverTitle").textContent = "Pillar inputs";
      $("pressureDriverNote").textContent = "";
      $("pressureExport").disabled = true;
    },
  };
}
