// A descriptive application heuristic. No recession-probability calibration.
export const PRESSURE_VERSION = "long-run-pressure-1";
export const PILLARS = [
  {
    id: "growth",
    name: "Growth weakness",
    members: [
      ["gdp", -1],
      ["production", -1],
      ["orders", -1],
      ["payrolls", -1],
      ["temp", -1],
    ],
  },
  {
    id: "inflation",
    name: "Inflation pressure",
    members: [
      ["pce", 1],
      ["cpi", 1],
      ["wages", 1],
      ["shelter", 1],
    ],
  },
  {
    id: "financial",
    name: "Financial tightness",
    members: [
      ["loans", -1],
      ["nfci", 1],
      ["lendingStandards", 1],
      ["liquidity", -1],
    ],
  },
  {
    id: "debt",
    name: "Debt burden",
    members: [
      ["householdService", 1],
      ["governmentDebt", 1],
      ["fiscalInterest", 1],
    ],
  },
];
const finite = Number.isFinite;
const clip = (z) => Math.max(-3, Math.min(3, z));
const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
export const pressureBand = (score) =>
  !finite(score)
    ? "Unavailable"
    : score < 40
      ? "Below usual pressure"
      : score < 60
        ? "Near usual pressure"
        : score < 75
          ? "Elevated pressure"
          : "High pressure";
export const pressureDirection = (z) =>
  !finite(z)
    ? "Direction unavailable"
    : z > 0.15
      ? "Building"
      : z < -0.15
        ? "Easing"
        : "Little change";

export function buildPressure(
  snapshot,
  { years = 10, estimator = "robust" } = {},
) {
  if (
    ![5, 10, 20].includes(years) ||
    !["standard", "robust"].includes(estimator)
  )
    throw new Error("Unsupported pressure reference");
  const profiles = new Map((snapshot.profiles || []).map((p) => [p.id, p]));
  const indicators = new Map((snapshot.indicators || []).map((p) => [p.id, p]));
  const key = estimator === "robust" ? "robustZ" : "z";
  const pillars = PILLARS.map((pillar) => {
    const members = pillar.members.map(([id, sign]) => {
      const p = profiles.get(id),
        row = indicators.get(id),
        window = p?.windows?.[years];
      const metric = (measure) => {
        const stat = window?.[measure],
          raw = stat?.[key];
        const reason =
          row?.status !== "ok"
            ? row?.status || "missing observation"
            : !["ok", "partial_window"].includes(stat?.status)
              ? stat?.status || "missing reference"
              : !finite(raw)
                ? "zero or missing dispersion"
                : null;
        return {
          rawZ: finite(raw) ? raw : null,
          z: reason ? null : clip(sign * raw),
          reason,
        };
      };
      return {
        id,
        name: p?.name || row?.name || id,
        sign,
        frequency: p?.frequency,
        series: p?.series || row?.series,
        date: p?.current?.sourceDate || p?.current?.date || row?.date || null,
        level: metric("level"),
        momentum: metric("momentum"),
      };
    });
    const summarize = (measure) => {
      const used = members.filter((m) => finite(m[measure].z)),
        coverage = used.length / members.length;
      const z =
        coverage + 1e-12 >= 2 / 3 ? mean(used.map((m) => m[measure].z)) : null;
      return {
        z,
        score: finite(z) ? 50 + (50 / 3) * z : null,
        coverage,
        used: used.length,
        total: members.length,
      };
    };
    return {
      id: pillar.id,
      name: pillar.name,
      weight: 0.25,
      level: summarize("level"),
      momentum: summarize("momentum"),
      members,
    };
  });
  const summarize = (measure) => {
    const coverage = mean(pillars.map((p) => p[measure].coverage));
    const valid =
      coverage + 1e-12 >= 0.75 && pillars.every((p) => finite(p[measure].z));
    const z = valid ? mean(pillars.map((p) => p[measure].z)) : null;
    return {
      z,
      score: finite(z) ? 50 + (50 / 3) * z : null,
      coverage,
      used: pillars.reduce((n, p) => n + p[measure].used, 0),
      total: 16,
    };
  };
  const level = summarize("level"),
    momentum = summarize("momentum");
  return {
    modelVersion: PRESSURE_VERSION,
    years,
    estimator,
    ...level,
    band: pressureBand(level.score),
    momentum,
    pillars,
  };
}

export function pressureOverview(snapshot) {
  return {
    modelVersion: PRESSURE_VERSION,
    scores: [5, 10, 20].flatMap((years) =>
      ["standard", "robust"].map((estimator) =>
        buildPressure(snapshot, { years, estimator }),
      ),
    ),
  };
}

export function compactPressure(pressure) {
  if (!pressure || pressure.format === "compact") return pressure;
  return {
    modelVersion: pressure.modelVersion,
    format: "compact",
    scores: pressure.scores.map((s) => ({
      years: s.years,
      estimator: s.estimator,
      score: s.score,
      coverage: s.coverage,
      momentumZ: s.momentum.z,
      momentumCoverage: s.momentum.coverage,
      pillars: s.pillars.map((p) => ({
        id: p.id,
        score: p.level.score,
        coverage: p.level.coverage,
        momentumZ: p.momentum.z,
        momentumCoverage: p.momentum.coverage,
      })),
    })),
  };
}
