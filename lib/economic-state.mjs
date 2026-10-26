export const STATE_VERSION = "economic-state-3";
export const STATE_DEFINITIONS = [
  {
    id: "activityState",
    series: "CFNAIMA3",
    name: "Activity relative to trend (CFNAI-MA3)",
    group: "state",
    frequency: "monthly",
    transform: "level",
    unit: "index",
    maxAge: 90,
    completePeriodsOnly: true,
  },
  {
    id: "headlinePce",
    series: "PCEPI",
    name: "Headline PCE inflation",
    group: "state",
    frequency: "monthly",
    transform: "yoy",
    unit: "% YoY",
    maxAge: 90,
    completePeriodsOnly: true,
  },
  ...[
    ["realIncome", "W875RX1", "Real income excluding transfers", "yoy"],
    ["realConsumption", "PCEC96", "Real personal consumption", "yoy"],
    ["realSales", "CMRMTSPL", "Real manufacturing & trade sales", "yoy"],
    ["householdEmployment", "CE16OV", "Household-survey employment", "yoy"],
    ["coreCpi", "CPILFESL", "Core CPI", "yoy"],
    [
      "trimmedPce",
      "PCETRIM12M159SFRBDAL",
      "Dallas Fed trimmed-mean PCE",
      "level",
    ],
  ].map(([id, series, name, transform]) => ({
    id,
    series,
    name,
    transform,
    group: "state",
    frequency: "monthly",
    unit: "% YoY",
    maxAge: 90,
    completePeriodsOnly: true,
  })),
];
export const STATE_EVIDENCE_GROUPS = [
  { name: "Quadrant anchors", ids: ["activityState", "headlinePce"] },
  {
    name: "Output, income & demand",
    ids: ["gdp", "production", "realIncome", "realConsumption", "realSales"],
  },
  {
    name: "Labour market",
    ids: ["payrolls", "householdEmployment", "unemployment"],
  },
  {
    name: "Inflation & wages",
    ids: ["pce", "trimmedPce", "cpi", "coreCpi", "shelter", "wages"],
  },
];
const BREADTH_IDS = [
  "production",
  "realIncome",
  "realConsumption",
  "realSales",
  "payrolls",
  "householdEmployment",
];
export const STATE_RULES = Object.freeze({
  activityAnchor: 0,
  inflationAnchor: 2,
  activityBuffer: 0.1,
  inflationBuffer: 0.2,
  maxPeriodGapMonths: 0,
  anchorEpsilon: 1e-9,
  minBreadthInputs: 4,
  maxBreadthPeriodGapMonths: 2,
});
const finite = Number.isFinite;
const month = (date) =>
  Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));

// Published indicator levels, not changes in growth/inflation or fitted return labels.
export function classifyEconomicState(activity, inflation) {
  if (!finite(activity) || !finite(inflation))
    return {
      id: "unavailable",
      name: "Insufficient fresh state data",
      nearBoundary: null,
    };
  const gap = inflation - STATE_RULES.inflationAnchor;
  const nearActivity = Math.abs(activity) <= STATE_RULES.activityBuffer;
  const nearInflation = Math.abs(gap) <= STATE_RULES.inflationBuffer + 1e-10;
  return {
    id:
      Math.abs(activity) <= STATE_RULES.anchorEpsilon ||
      Math.abs(gap) <= STATE_RULES.anchorEpsilon
        ? "boundary"
        : `${activity > 0 ? "above" : "below"}-${gap > 0 ? "above" : "below"}`,
    name: `${nearActivity ? "Activity near trend" : activity > 0 ? "Activity above trend" : "Activity below trend"} · ${nearInflation ? "Inflation near 2%" : gap > 0 ? "Inflation above 2%" : "Inflation below 2%"}`,
    nearBoundary: nearActivity || nearInflation,
    nearActivity,
    nearInflation,
  };
}
export function buildEconomicState(
  indicators,
  nowcast = null,
  now = new Date(),
) {
  const definitions = new Map(STATE_DEFINITIONS.map((d) => [d.id, d]));
  const evidence = STATE_EVIDENCE_GROUPS.map((group) => ({
    name: group.name,
    indicators: group.ids.map((id) => {
      const row = indicators.find((d) => d.id === id),
        def = definitions.get(id) || row;
      const date = row?.date ?? null;
      const complete =
        date &&
        Date.UTC(
          Number(date.slice(0, 4)),
          Number(date.slice(5, 7)) + (def?.frequency === "quarterly" ? 2 : 0),
          0,
          23,
          59,
          59,
        ) <= +now;
      return {
        id,
        series: def?.series ?? null,
        name: def?.name ?? id,
        frequency: def?.frequency ?? "monthly",
        unit: def?.unit ?? "% YoY",
        date,
        value: row?.value ?? null,
        status:
          !date || !finite(row?.value)
            ? "missing"
            : !complete
              ? "incomplete period"
              : (row.status ?? "missing"),
        source: def?.series
          ? `https://fred.stlouisfed.org/series/${def.series}`
          : null,
      };
    }),
  }));
  const all = evidence.flatMap((group) => group.indicators);
  const activity = all.find((d) => d.id === "activityState"),
    inflation = all.find((d) => d.id === "headlinePce");
  const periodGapMonths =
    activity.date && inflation.date
      ? Math.abs(month(activity.date) - month(inflation.date))
      : null;
  const aligned =
    periodGapMonths !== null &&
    periodGapMonths <= STATE_RULES.maxPeriodGapMonths;
  const available =
    aligned &&
    [activity, inflation].every((d) => d.status === "ok" && finite(d.value));
  const monthly = BREADTH_IDS.map((id) => all.find((d) => d.id === id));
  const freshest = Math.max(
    ...monthly
      .filter((d) => d.status === "ok" && d.date)
      .map((d) => month(d.date)),
  );
  const breadthRows = monthly.map((d) => ({
    ...d,
    status:
      d.status === "ok" &&
      freshest - month(d.date) > STATE_RULES.maxBreadthPeriodGapMonths
        ? "older reference period"
        : d.status,
  }));
  const valid = breadthRows.filter((d) => d.status === "ok" && finite(d.value));
  return {
    method: STATE_VERSION,
    rules: STATE_RULES,
    activity,
    inflation,
    available,
    periodGapMonths,
    mixedPeriods: periodGapMonths !== null && periodGapMonths !== 0,
    inflationGap: finite(inflation.value)
      ? inflation.value - STATE_RULES.inflationAnchor
      : null,
    regime: classifyEconomicState(
      available ? activity.value : null,
      available ? inflation.value : null,
    ),
    nowcast,
    evidence,
    activityBreadth: {
      available: valid.length >= STATE_RULES.minBreadthInputs,
      positive: valid.filter((d) => d.value > 0).length,
      negative: valid.filter((d) => d.value < 0).length,
      unchanged: valid.filter((d) => d.value === 0).length,
      count: valid.length,
      total: BREADTH_IDS.length,
      earliest:
        valid
          .map((d) => d.date)
          .sort()
          .at(0) ?? null,
      latest:
        valid
          .map((d) => d.date)
          .sort()
          .at(-1) ?? null,
      indicators: breadthRows,
    },
  };
}
// FRED's quarter label identifies the GDPNow target, not when a forecast was updated.
export function buildGDPNow(points, metadata, now = new Date()) {
  const latest = points
    .filter((p) => p.date <= now.toISOString().slice(0, 10))
    .at(-1);
  const stamp =
    typeof metadata?.lastUpdated === "string"
      ? metadata.lastUpdated.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00")
      : null;
  const updated = stamp ? Date.parse(stamp) : NaN;
  const periodEnd = latest
    ? Date.UTC(
        Number(latest.date.slice(0, 4)),
        Number(latest.date.slice(5, 7)) + 2,
        0,
        23,
        59,
        59,
      )
    : NaN;
  const metadataValid = finite(updated) && updated <= +now;
  const fresh =
    metadataValid &&
    (+now - updated) / 86400000 <= 21 &&
    (+now - periodEnd) / 86400000 <= 45;
  return {
    series: "GDPNOW",
    name: "Atlanta Fed GDPNow",
    source: "https://fred.stlouisfed.org/series/GDPNOW",
    value: latest?.value ?? null,
    date: latest?.date ?? null,
    unit: "% q/q annualised (SAAR)",
    updatedAt: metadataValid ? new Date(updated).toISOString() : null,
    updateBasis:
      "FRED series metadata last_updated; not an independently verified publisher release timestamp",
    status: !latest
      ? "missing"
      : !metadataValid
        ? "update date unavailable"
        : fresh
          ? "ok"
          : "stale",
  };
}
