// Application heuristics inspired by public All Weather principles.
// Not Bridgewater's proprietary rules or calibrated probabilities.
import { historicalProfile, contextFingerprint } from "./statistics.mjs";
import { pressureOverview, PRESSURE_VERSION } from "./composite.mjs";
import { buildStateHistory } from "./state-history.mjs";
import {
  STATE_DEFINITIONS,
  buildEconomicState,
  buildGDPNow,
} from "./economic-state.mjs";
export const VERSION = "2.18.0";
export const MODEL_VERSION = "momentum-1";
export const isCompatibleSnapshot = (s) =>
  s?.modelVersion ? s.modelVersion === MODEL_VERSION : s?.version === "2.0.0";
const DAY = 86400000;
export const DEFINITIONS = [
  {
    id: "gdp",
    series: "GDPC1",
    name: "Real GDP",
    group: "growth",
    frequency: "quarterly",
    transform: "yoy",
    unit: "% YoY",
    weight: 1,
    scale: 0.75,
    maxAge: 130,
  },
  {
    id: "production",
    series: "INDPRO",
    name: "Industrial production",
    group: "growth",
    frequency: "monthly",
    transform: "yoy",
    unit: "% YoY",
    weight: 1,
    scale: 1,
    maxAge: 80,
  },
  {
    id: "orders",
    series: "AMTMNO",
    name: "Nominal manufacturing orders",
    group: "growth",
    frequency: "monthly",
    transform: "yoy",
    unit: "% YoY",
    weight: 0.8,
    scale: 2,
    maxAge: 100,
  },
  {
    id: "payrolls",
    series: "PAYEMS",
    name: "Nonfarm payrolls",
    group: "growth",
    frequency: "monthly",
    transform: "yoy",
    unit: "% YoY",
    weight: 1,
    scale: 0.5,
    maxAge: 80,
  },
  {
    id: "temp",
    series: "TEMPHELPS",
    name: "Temporary employment",
    group: "growth",
    frequency: "monthly",
    transform: "yoy",
    unit: "% YoY",
    weight: 0.6,
    scale: 2,
    maxAge: 80,
  },
  {
    id: "pce",
    series: "PCEPILFE",
    name: "Core PCE",
    group: "inflation",
    frequency: "monthly",
    transform: "yoy",
    unit: "% YoY",
    weight: 1.3,
    scale: 0.5,
    maxAge: 100,
  },
  {
    id: "cpi",
    series: "CPIAUCSL",
    name: "Consumer prices",
    group: "inflation",
    frequency: "monthly",
    transform: "yoy",
    unit: "% YoY",
    weight: 1,
    scale: 0.5,
    maxAge: 80,
  },
  {
    id: "wages",
    series: "CES0500000003",
    name: "Hourly earnings",
    group: "inflation",
    frequency: "monthly",
    transform: "yoy",
    unit: "% YoY",
    weight: 0.7,
    scale: 0.5,
    maxAge: 80,
  },
  {
    id: "shelter",
    series: "CUSR0000SAH1",
    name: "Shelter CPI",
    group: "inflation",
    frequency: "monthly",
    transform: "yoy",
    unit: "% YoY",
    weight: 0.5,
    scale: 0.5,
    maxAge: 80,
  },
  {
    id: "loans",
    series: "TOTLL",
    name: "Bank lending",
    group: "credit",
    frequency: "weekly",
    transform: "yoy",
    unit: "% YoY",
    maxAge: 28,
  },
  {
    id: "nfci",
    series: "NFCI",
    name: "Financial conditions",
    group: "credit",
    frequency: "weekly",
    transform: "level",
    unit: "index",
    maxAge: 28,
  },
  {
    id: "policy",
    series: "FEDFUNDS",
    name: "Fed funds rate",
    group: "credit",
    frequency: "monthly",
    transform: "level",
    unit: "%",
    maxAge: 80,
  },
  {
    id: "unemployment",
    series: "UNRATE",
    name: "Unemployment",
    group: "stress",
    frequency: "monthly",
    transform: "level",
    unit: "%",
    maxAge: 80,
    threshold: 5,
    comparison: "gte",
  },
  {
    id: "sahm",
    series: "SAHMREALTIME",
    name: "Sahm rule",
    group: "stress",
    frequency: "monthly",
    transform: "level",
    unit: "pp",
    maxAge: 80,
    threshold: 0.5,
    comparison: "gte",
  },
  {
    id: "curve",
    series: "T10Y2Y",
    name: "10Y − 2Y curve",
    group: "stress",
    frequency: "daily",
    transform: "level",
    unit: "pp",
    maxAge: 14,
    threshold: 0,
    comparison: "lt",
  },
  {
    id: "hy",
    series: "BAMLH0A0HYM2",
    name: "High-yield credit spread",
    group: "stress",
    frequency: "daily",
    transform: "level",
    unit: "%",
    maxAge: 14,
    threshold: 5,
    comparison: "gte",
  },
  {
    id: "treasury",
    series: "DGS10",
    name: "10Y Treasury yield",
    group: "market",
    frequency: "daily",
    transform: "level",
    unit: "%",
    changeUnit: "bp",
    maxAge: 14,
  },
  {
    id: "realYield",
    series: "DFII10",
    name: "10Y real yield",
    group: "market",
    frequency: "daily",
    transform: "level",
    unit: "%",
    changeUnit: "bp",
    maxAge: 14,
  },
  {
    id: "breakeven",
    series: "T10YIE",
    name: "10Y inflation breakeven",
    group: "market",
    frequency: "daily",
    transform: "level",
    unit: "%",
    changeUnit: "bp",
    maxAge: 14,
  },
  {
    id: "dollar",
    series: "DTWEXBGS",
    name: "Broad US dollar",
    group: "market",
    frequency: "daily",
    transform: "level",
    unit: "index",
    changeUnit: "%",
    maxAge: 18,
  },
  {
    id: "oil",
    series: "DCOILWTICO",
    name: "WTI spot oil",
    group: "market",
    frequency: "daily",
    transform: "level",
    unit: "$/barrel",
    changeUnit: "%",
    maxAge: 18,
  },
  {
    id: "vix",
    series: "VIXCLS",
    name: "VIX close",
    group: "market",
    frequency: "daily",
    transform: "level",
    unit: "index",
    changeUnit: "points",
    maxAge: 14,
  },
  {
    id: "householdService",
    series: "TDSP",
    name: "Household debt service / disposable income",
    group: "debt",
    frequency: "quarterly",
    transform: "level",
    unit: "%",
    maxAge: 160,
    note: "Required household debt payments as a share of disposable personal income.",
  },
  {
    id: "lendingStandards",
    series: "DRTSCILM",
    name: "Banks tightening business lending standards",
    group: "debt",
    frequency: "quarterly",
    transform: "level",
    unit: "net %",
    maxAge: 130,
    note: "Net share tightening C&I standards for large and middle-market firms. Positive = net tightening; negative = net easing.",
  },
  {
    id: "governmentDebt",
    series: "GFDEGDQ188S",
    name: "Gross federal debt / GDP",
    group: "debt",
    frequency: "quarterly",
    transform: "level",
    unit: "% GDP",
    maxAge: 160,
    note: "Gross federal debt, including intragovernmental holdings. A debt ratio, not a default probability.",
  },
  ...STATE_DEFINITIONS,
];
export const SERIES = [
  ...new Set([
    ...DEFINITIONS.map((d) => d.series),
    "WALCL",
    "WTREGEN",
    "RRPONTSYD",
    "FYOINT",
    "FYFR",
    "USREC",
    "GDPNOW",
  ]),
];
export function clean(observations = []) {
  return observations
    .map((o) => ({ date: o.date, value: Number.parseFloat(o.value) }))
    .filter(
      (o) => /^\d{4}-\d{2}-\d{2}$/.test(o.date) && Number.isFinite(o.value),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}
function monthsBefore(date, n) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
}
function daysBefore(date, n) {
  return new Date(Date.parse(date) - n * DAY).toISOString().slice(0, 10);
}
export function periodEnd(date, frequency) {
  if (!["monthly", "quarterly"].includes(frequency)) return Date.parse(date);
  const d = new Date(date + "T00:00:00Z");
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth() + (frequency === "quarterly" ? 3 : 1),
    0,
    23,
    59,
    59,
  );
}
export function atOrBefore(points, date, maxDays = 8) {
  const p = points.findLast((p) => p.date <= date);
  return p && (Date.parse(date) - Date.parse(p.date)) / DAY <= maxDays
    ? p
    : null;
}
function period(points, date, frequency) {
  return frequency === "weekly" || frequency === "daily"
    ? atOrBefore(points, date, frequency === "weekly" ? 8 : 5)
    : points.find((p) => p.date.slice(0, 7) === date.slice(0, 7)) || null;
}
export function yoy(points, date, frequency) {
  const current = period(points, date, frequency);
  if (!current) return null;
  const base = period(
    points,
    frequency === "weekly"
      ? daysBefore(current.date, 364)
      : monthsBefore(current.date, 12),
    frequency,
  );
  return base && base.value > 0 ? (current.value / base.value - 1) * 100 : null;
}
export function transform(def, points, now = new Date()) {
  points = points.filter(
    (p) =>
      p.date <= now.toISOString().slice(0, 10) &&
      (!def.completePeriodsOnly || periodEnd(p.date, def.frequency) <= +now),
  );
  const latest = points.at(-1);
  const base = {
    ...def,
    value: null,
    previous: null,
    delta: null,
    date: latest?.date || null,
    status: "missing",
    score: null,
  };
  if (!latest) return base;
  const value =
    def.transform === "yoy"
      ? yoy(points, latest.date, def.frequency)
      : latest.value;
  const previousDate =
    def.frequency === "weekly"
      ? daysBefore(latest.date, 91)
      : monthsBefore(latest.date, def.frequency === "annual" ? 12 : 3);
  const previousPoint = period(points, previousDate, def.frequency);
  const previous = previousPoint
    ? def.transform === "yoy"
      ? yoy(points, previousPoint.date, def.frequency)
      : previousPoint.value
    : null;
  const stale =
    (now - periodEnd(latest.date, def.frequency)) / DAY > def.maxAge;
  const status = value === null ? "missing" : stale ? "stale" : "ok";
  const delta = value !== null && previous !== null ? value - previous : null;
  return {
    ...base,
    value,
    previous,
    delta,
    deltaMonths: def.frequency === "annual" ? 12 : 3,
    status,
    score:
      status === "ok" && delta !== null && def.scale
        ? Math.max(-1, Math.min(1, delta / def.scale))
        : null,
  };
}
function liquidityPoints(raw) {
  const series = Object.fromEntries(
    ["WALCL", "WTREGEN", "RRPONTSYD"].map((id) => [
      id,
      clean(raw[id]?.observations),
    ]),
  );
  const points = series.WALCL.map((p) => {
    const tga = atOrBefore(series.WTREGEN, p.date, 8),
      rrp = atOrBefore(series.RRPONTSYD, p.date, 5);
    return {
      date: p.date,
      value: tga && rrp ? (p.value - tga.value) / 1000 - rrp.value : NaN,
    };
  }).filter((p) => Number.isFinite(p.value));
  return points;
}
export function netLiquidity(raw, now = new Date()) {
  const points = liquidityPoints(raw).filter(
    (p) => p.date <= now.toISOString().slice(0, 10),
  );
  const result = transform(
    {
      id: "liquidity",
      series: "WALCL",
      name: "Fed net liquidity proxy",
      group: "credit",
      frequency: "weekly",
      transform: "yoy",
      unit: "% YoY",
      maxAge: 28,
    },
    points,
    now,
  );
  return {
    ...result,
    level: points.at(-1)?.value ?? null,
    note: "(WALCL − WTREGEN) / 1000 − RRPONTSYD; USD billions. Weekly TGA average, Wednesday assets and aligned daily RRP: an approximate balance-sheet proxy.",
  };
}
export const FISCAL_DEFINITION = {
  id: "fiscalInterest",
  series: "FYOINT",
  name: "Federal interest outlays / receipts",
  group: "debt",
  frequency: "annual",
  transform: "level",
  unit: "% receipts",
  maxAge: 550,
  note: "100 × FYOINT / FYFR, matching fiscal-year end dates. Annual data; the change is over one year.",
};
export function fiscalInterestPoints(raw) {
  const receipts = new Map(
    clean(raw.FYFR?.observations).map((p) => [p.date, p.value]),
  );
  return clean(raw.FYOINT?.observations)
    .filter((p) => receipts.get(p.date) > 0)
    .map((p) => ({
      date: p.date,
      value: (100 * p.value) / receipts.get(p.date),
    }));
}
export function normalizedHistory(def, points, now = new Date()) {
  points = points.filter((p) => p.date <= now.toISOString().slice(0, 10));
  const rows = points.map((p) => {
    const value =
      def.transform === "yoy" ? yoy(points, p.date, def.frequency) : p.value;
    const previous = period(
      points,
      def.frequency === "weekly"
        ? daysBefore(p.date, 91)
        : monthsBefore(p.date, def.frequency === "annual" ? 12 : 3),
      def.frequency,
    );
    const previousValue = previous
      ? def.transform === "yoy"
        ? yoy(points, previous.date, def.frequency)
        : previous.value
      : null;
    return {
      date: p.date,
      value,
      momentum:
        value !== null && previousValue !== null ? value - previousValue : null,
    };
  });
  if (["weekly", "daily"].includes(def.frequency)) {
    const monthly = new Map();
    for (const row of rows) {
      const key = row.date.slice(0, 7) + "-01";
      if (periodEnd(key, "monthly") <= now.getTime())
        monthly.set(key, { ...row, date: key, sourceDate: row.date });
    }
    return [...monthly.values()];
  }
  return rows.filter((p) => periodEnd(p.date, def.frequency) <= now.getTime());
}
export function summarizeAxis(indicators, group) {
  const all = indicators.filter((d) => d.group === group),
    valid = all.filter((d) => Number.isFinite(d.score));
  const total = all.reduce((s, d) => s + d.weight, 0),
    available = valid.reduce((s, d) => s + d.weight, 0),
    coverage = available / total;
  return {
    coverage,
    count: valid.length,
    total: all.length,
    score:
      coverage >= 0.75
        ? valid.reduce((s, d) => s + d.score * d.weight, 0) / available
        : null,
  };
}
export function classify(g, i) {
  if (g === null || i === null)
    return { id: "unavailable", name: "Insufficient fresh data" };
  if (Math.abs(g) < 0.15 || Math.abs(i) < 0.15)
    return { id: "transition", name: "Transition / mixed signals" };
  const id =
    g > 0
      ? i > 0
        ? "overheating"
        : "goldilocks"
      : i > 0
        ? "stagflation"
        : "deflation";
  return {
    id,
    name: {
      overheating: "Growth ↑ · Inflation ↑",
      goldilocks: "Growth ↑ · Inflation ↓",
      stagflation: "Growth ↓ · Inflation ↑",
      deflation: "Growth ↓ · Inflation ↓",
    }[id],
  };
}
export function buildSnapshot(raw, now = new Date()) {
  const indicators = DEFINITIONS.map((def) =>
    transform(def, clean(raw[def.series]?.observations), now),
  );
  indicators.push(netLiquidity(raw, now));
  const fiscalPoints = fiscalInterestPoints(raw);
  indicators.push(transform(FISCAL_DEFINITION, fiscalPoints, now));
  const profileDefinitions = [
    ...DEFINITIONS.filter((d) =>
      ["growth", "inflation", "credit", "debt"].includes(d.group),
    ),
    FISCAL_DEFINITION,
  ];
  const profiles = profileDefinitions.map((def) =>
    historicalProfile(
      def,
      normalizedHistory(
        def,
        def.id === "fiscalInterest"
          ? fiscalPoints
          : clean(raw[def.series]?.observations),
        now,
      ),
    ),
  );
  profiles.push(
    historicalProfile(
      indicators.find((d) => d.id === "liquidity"),
      normalizedHistory(
        indicators.find((d) => d.id === "liquidity"),
        liquidityPoints(raw),
        now,
      ),
    ),
  );
  const growth = summarizeAxis(indicators, "growth"),
    inflation = summarizeAxis(indicators, "inflation"),
    regime = classify(growth.score, inflation.score);
  const economicState = buildEconomicState(
    indicators,
    buildGDPNow(clean(raw.GDPNOW?.observations), raw.GDPNOW?.metadata, now),
    now,
  );
  const warnings = indicators
    .filter((d) => d.group === "stress")
    .map((d) => ({
      ...d,
      triggered:
        d.status === "ok"
          ? d.comparison === "lt"
            ? d.value < d.threshold
            : d.value >= d.threshold
          : null,
    }));
  const market = indicators
    .filter((d) => d.group === "market")
    .map((d) => {
      const points = clean(raw[d.series]?.observations).filter(
        (p) => p.date <= now.toISOString().slice(0, 10),
      );
      const last = points.at(-1),
        base = last ? atOrBefore(points, daysBefore(last.date, 30), 5) : null;
      const change =
        last && base
          ? d.changeUnit === "%"
            ? base.value > 0
              ? (last.value / base.value - 1) * 100
              : null
            : (last.value - base.value) * (d.changeUnit === "bp" ? 100 : 1)
          : null;
      return { ...d, change, changeDate: base?.date ?? null };
    });
  return {
    version: VERSION,
    modelVersion: MODEL_VERSION,
    fetchedAt: now.toISOString(),
    indicators,
    growth,
    inflation,
    regime,
    economicState,
    stateHistory: buildStateHistory(
      clean(raw.CFNAIMA3?.observations),
      clean(raw.PCEPI?.observations),
      now,
    ),
    warnings,
    market,
    profiles,
    pressure: pressureOverview({ profiles, indicators }),
    recessions: clean(raw.USREC?.observations).filter(
      (p) => p.value === 1 && p.date <= now.toISOString().slice(0, 10),
    ),
    signature:
      JSON.stringify(
        indicators
          .filter((d) =>
            ["growth", "inflation", "credit", "debt"].includes(d.group),
          )
          .map((d) => [d.id, d.date, d.value, d.previous, d.status]),
      ) +
      "|context:" +
      contextFingerprint(profiles) +
      "|pressure:" +
      PRESSURE_VERSION +
      "|state:" +
      JSON.stringify(economicState),
  };
}
