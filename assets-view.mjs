import { periodEnd, DEFINITIONS } from "./lib/model.mjs";
const $ = (id) => document.getElementById(id);
const pct = (n) => (Number.isFinite(n) ? `${n.toFixed(1)}%` : "unavailable");
const scenarios = {
  goldilocks: [
    [
      "Diversified equities",
      "Improving activity and easing inflation can support earnings and valuations.",
    ],
    [
      "High-quality nominal bonds",
      "Potential support if yields fall; duration still depends on starting yields and term premium.",
    ],
  ],
  overheating: [
    [
      "Broad commodities / energy",
      "Potential demand and inflation hedge; futures returns include roll and carry.",
    ],
    [
      "Inflation-linked bonds",
      "Inflation protection, with real-rate duration risk. TIP is not a short-duration cash substitute.",
    ],
  ],
  stagflation: [
    [
      "Gold + Treasury bills",
      "Potential monetary hedge and liquidity reserve; gold is sensitive to real yields and the dollar.",
    ],
    [
      "Inflation-linked bonds / commodities",
      "Conditional hedge: distinguish a supply shock from weakening demand.",
    ],
  ],
  deflation: [
    [
      "High-quality government bonds",
      "Potential duration hedge if yields decline. Persistent inflation or fiscal pressure can break the relationship.",
    ],
    [
      "Treasury bills / defensive equities",
      "Liquidity and resilient cash flows; slowing momentum alone does not establish a recession.",
    ],
  ],
  transition: [
    [
      "Diversified exposure",
      "Mixed momentum offers little conviction for a single asset-class tilt.",
    ],
    [
      "Treasury bills / liquidity reserve",
      "Keep optionality while watching incoming activity, inflation and credit data.",
    ],
  ],
};
export function createAssetsView() {
  let summary = null,
    last = [null, null];
  function render(snapshot, slot) {
    last = [snapshot, slot];
    const host = $("preferredAssets");
    if (!snapshot || !slot?.point) {
      host.innerHTML =
        '<h3>Preferred assets</h3><p class="sub">No valid selected position. Asset sensitivities require both axes.</p>';
      return;
    }
    const point = slot.point,
      id = point.regime.id;
    const level = (key) => {
      if (slot.kind === "current") {
        const d = snapshot.indicators.find((d) => d.id === key);
        return d?.status === "ok" ? { value: d.value, date: d.date } : null;
      }
      const p = snapshot.profiles.find((d) => d.id === key);
      const time = Date.parse(point.date + "T23:59:59Z"),
        d = p?.history.findLast((d) => periodEnd(d.date, p.frequency) <= time);
      return d &&
        (time - periodEnd(d.date, p.frequency)) / 86400000 <=
          DEFINITIONS.find((r) => r.id === key).maxAge
        ? d
        : null;
    };
    const levelText = (key) => {
      const p = level(key);
      return p
        ? `${pct(p.value)} <span class="muted">(${key === "gdp" ? `${p.date.slice(0, 4)} Q${Math.floor((Number(p.date.slice(5, 7)) - 1) / 3) + 1}` : p.date.slice(0, 7)})</span>`
        : "unavailable";
    };
    const code = {
      goldilocks: 0,
      overheating: 1,
      stagflation: 2,
      deflation: 3,
      transition: 4,
    }[id];
    const evidence = summary?.conditionalReturns.find((d) => d.code === code);
    host.innerHTML = `<div class="eyebrow">Selected #${slot.sequence} · ${slot.label}</div><h3>Preferred assets</h3>
      <p class="sub">Conditional scenario fit · no portfolio weights or ranking</p>
      <div class="asset-levels">Real GDP YoY <strong>${levelText("gdp")}</strong><br>Core PCE YoY <strong>${levelText("pce")}</strong></div>
      <ul class="asset-list">${(scenarios[id] || []).map(([name, reason]) => `<li><strong>${name}</strong><span>${reason}</span></li>`).join("")}</ul>
      ${evidence ? `<p class="note">Reality check, 2021–25: ${summary.assetNames[evidence.historicalLeader]} had the highest average next-month return in this bucket (${evidence.n} months${evidence.smallSample ? "; very small sample" : "; limited sample"}). This retrospective leader can differ from the scenario fit. <a href="#research" id="assetResearchLink">See all returns</a>.</p>` : ""}
      <details class="sub"><summary>Pricing, liquidity & fiscal checks</summary><p>The All Weather framework concerns surprises relative to expectations; these axes measure observed momentum. Check earnings expectations, real yields, the dollar and credit before a tilt. Alden's fiscal and liquidity framework also cautions against treating long bonds as a universal hedge.</p><p>${slot.kind === "current" ? "Current dated financial conditions, net liquidity and fiscal ratios are shown below and in Long-run context." : "Historical dots use revised reference-period data. Today's liquidity or fiscal readings are not applied to this selected past date."}</p><p><a href="https://www.bridgewater.com/research-and-insights/the-all-weather-story" target="_blank" rel="noopener">Bridgewater framework</a> · <a href="https://www.lynalden.com/full-steam-ahead-all-aboard-fiscal-dominance/" target="_blank" rel="noopener">Alden: fiscal context</a></p></details>`;
    $("assetResearchLink")?.addEventListener("click", (event) => {
      event.preventDefault();
      $("tab-research").click();
      $("researchConditional").scrollIntoView({ block: "start" });
    });
  }
  return {
    render,
    setResearch(next) {
      summary = next;
      render(...last);
    },
  };
}
