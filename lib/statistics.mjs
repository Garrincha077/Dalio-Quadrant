// Current observations compared with preceding complete calendar windows.
// These are descriptive statistics of today's vintage, not real-time backtests.
export const HORIZONS = [5, 10, 20];
const finite = Number.isFinite;
export function contextFingerprint(profiles) {
  const payload = JSON.stringify(
    profiles.map((p) => [p.id, p.current?.date, p.windows]),
  );
  // Non-security checksum used only to detect changed statistical references.
  let a = 2166136261,
    b = 2246822519;
  for (let i = 0; i < payload.length; i++) {
    a = Math.imul(a ^ payload.charCodeAt(i), 16777619);
    b = Math.imul(b ^ payload.charCodeAt(i), 3266489917);
  }
  return (
    (a >>> 0).toString(16).padStart(8, "0") +
    (b >>> 0).toString(16).padStart(8, "0")
  );
}
function median(values) {
  const a = [...values].sort((x, y) => x - y),
    m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
export function referenceStatistics(
  value,
  baseline,
  expected,
  allowGaps = false,
) {
  const values = baseline.filter(finite),
    n = values.length;
  const result = {
    z: null,
    robustZ: null,
    percentile: null,
    mean: null,
    sd: null,
    median: null,
    mad: null,
    n,
    expected,
    status: "insufficient_history",
  };
  if (!finite(value)) return { ...result, status: "missing_current" };
  // Do not silently turn a short series into a full 10/20-year comparison.
  if (
    n < (allowGaps ? Math.ceil(expected * 0.95) : expected) ||
    n > expected ||
    n < 2
  )
    return result;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1),
  );
  const centre = median(values),
    mad = median(values.map((v) => Math.abs(v - centre)));
  const percentile =
    (100 *
      (values.filter((v) => v < value).length +
        0.5 * values.filter((v) => v === value).length)) /
    n;
  return {
    ...result,
    mean,
    sd,
    median: centre,
    mad,
    percentile,
    z: sd > 1e-12 ? (value - mean) / sd : null,
    robustZ: mad > 1e-12 ? (value - centre) / (1.4826 * mad) : null,
    status:
      sd > 1e-12
        ? n === expected
          ? "ok"
          : "partial_window"
        : "constant_baseline",
  };
}
const monthIndex = (date) =>
  Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
export function historicalProfile(def, history) {
  const current = history.at(-1),
    frequency = ["weekly", "daily"].includes(def.frequency)
      ? "monthly"
      : def.frequency;
  const perYear =
    frequency === "quarterly" ? 4 : frequency === "annual" ? 1 : 12;
  const windows = {};
  for (const years of HORIZONS) {
    const expected = years * perYear;
    const baseline = current
      ? history.filter(
          (p) =>
            monthIndex(p.date) >= monthIndex(current.date) - years * 12 &&
            p.date < current.date,
        )
      : [];
    const comparison = (metric) => {
      const first = history.find((p) => finite(p[metric]));
      const spansWindow =
        first &&
        current &&
        monthIndex(first.date) <= monthIndex(current.date) - years * 12;
      const stat = referenceStatistics(
        current?.[metric],
        baseline.map((p) => p[metric]),
        expected,
        true,
      );
      return spansWindow
        ? stat
        : {
            ...stat,
            z: null,
            robustZ: null,
            percentile: null,
            mean: null,
            sd: null,
            median: null,
            mad: null,
            status: "insufficient_history",
          };
    };
    windows[years] = {
      start: baseline[0]?.date ?? null,
      end: baseline.at(-1)?.date ?? null,
      level: comparison("value"),
      momentum: comparison("momentum"),
    };
  }
  return {
    id: def.id,
    name: def.name,
    group: def.group,
    series: def.series,
    unit: def.unit,
    frequency,
    current: current ?? null,
    windows,
    history,
  };
}
