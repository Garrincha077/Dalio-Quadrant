export const STATE_VERSION = "economic-state-1";
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
];
export const STATE_RULES = Object.freeze({
  activityAnchor: 0,
  inflationAnchor: 2,
  activityBuffer: 0.1,
  inflationBuffer: 0.2,
  maxPeriodGapMonths: 1,
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
      activity === 0 || gap === 0
        ? "boundary"
        : `${activity > 0 ? "above" : "below"}-${gap > 0 ? "above" : "below"}`,
    name: `${nearActivity ? "Activity near trend" : activity > 0 ? "Activity above trend" : "Activity below trend"} · ${nearInflation ? "Inflation near 2%" : gap > 0 ? "Inflation above 2%" : "Inflation below 2%"}`,
    nearBoundary: nearActivity || nearInflation,
    nearActivity,
    nearInflation,
  };
}
export function buildEconomicState(indicators, nowcast = null) {
  const axes = Object.fromEntries(
    STATE_DEFINITIONS.map((def) => {
      const row = indicators.find((d) => d.id === def.id);
      return [
        def.id,
        {
          id: def.id,
          series: def.series,
          name: def.name,
          unit: def.unit,
          date: row?.date ?? null,
          value: row?.value ?? null,
          status: row?.status ?? "missing",
          source: `https://fred.stlouisfed.org/series/${def.series}`,
        },
      ];
    }),
  );
  const activity = axes.activityState,
    inflation = axes.headlinePce;
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
