import { classifyEconomicState, STATE_RULES } from "./economic-state.mjs";
import { referenceStatistics } from "./statistics.mjs";

export const STATE_HISTORY_VERSION = "state-reference-periods-1";
const finite = Number.isFinite;
const monthIndex = (date) =>
  Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
const monthDate = (index) =>
  new Date(Date.UTC(Math.floor(index / 12), index % 12, 1))
    .toISOString()
    .slice(0, 10);
const complete = (date, now) =>
  Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0, 23, 59, 59) <=
  +now;
export function buildStateHistory(activity, prices, now = new Date()) {
  // Same-month reference periods in today's vintage. No publication dates are simulated.
  const a = new Map(
    activity
      .filter((p) => finite(p.value) && complete(p.date, now))
      .map((p) => [p.date, p.value]),
  );
  const p = new Map(
    prices
      .filter((p) => finite(p.value) && complete(p.date, now))
      .map((p) => [p.date, p.value]),
  );
  const start = [...a.keys()].sort()[0];
  const dates = [...new Set([...a.keys(), ...p.keys()])]
    .filter((d) => start && d >= start)
    .sort();
  return {
    version: STATE_HISTORY_VERSION,
    basis:
      "Latest-revised, completed economic reference months; not data known at historical trading dates",
    history: dates.map((date) => {
      const value = p.get(date),
        base = p.get(monthDate(monthIndex(date) - 12));
      return {
        date,
        activity: a.get(date) ?? null,
        inflation: finite(value) && base > 0 ? 100 * (value / base - 1) : null,
      };
    }),
  };
}
function position(row) {
  return row && finite(row.activity) && finite(row.inflation)
    ? {
        ...row,
        activityDate: row.date,
        inflationDate: row.date,
        inflationGap: row.inflation - STATE_RULES.inflationAnchor,
        regime: classifyEconomicState(row.activity, row.inflation),
      }
    : null;
}
export function buildStateTrail(
  snapshot,
  { cadence = "monthly", end = null, count = 12 } = {},
) {
  const step = { monthly: 1, quarterly: 3, annual: 12 }[cadence];
  if (
    !step ||
    count !== 12 ||
    (end !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(end))
  )
    throw new Error("Unsupported state trail selection");
  const history = snapshot?.stateHistory?.history || [],
    state = snapshot?.economicState;
  if (!history.length) return [];
  const liveDate =
    [state?.activity?.date, state?.inflation?.date]
      .filter(Boolean)
      .sort()
      .at(-1) || history.at(-1).date;
  const finish = end ? end + "-01" : liveDate;
  if (finish > liveDate || finish < history[0].date) return [];
  const lastIndex = monthIndex(finish),
    bucket = Math.floor(lastIndex / step) * step;
  const byDate = new Map(history.map((p) => [p.date, p]));
  return Array.from({ length: count }, (_, index) => {
    const last = index === count - 1;
    const date = last
      ? finish
      : monthDate(bucket - step * (count - 1 - index) + step - 1);
    const year = date.slice(0, 4),
      m = Number(date.slice(5, 7));
    const label =
      cadence === "annual"
        ? `${year}${last ? " · " + date.slice(0, 7) : ""}`
        : cadence === "quarterly"
          ? `${year} Q${Math.ceil(m / 3)}${last ? " · " + date.slice(0, 7) : ""}`
          : date.slice(0, 7);
    const current = last && !end;
    const point = current
      ? state?.available && state.activity?.date === state.inflation?.date
        ? {
            date: finish,
            activity: state.activity.value,
            inflation: state.inflation.value,
            activityDate: state.activity.date,
            inflationDate: state.inflation.date,
            inflationGap: state.inflationGap,
            regime: state.regime,
          }
        : null
      : position(byDate.get(date));
    return {
      key: current ? "latest" : date,
      sequence: index + 1,
      date,
      label: current ? `Latest · ${label}` : label,
      kind: current ? "current" : "reconstructed",
      point,
    };
  });
}
export function stateScale(mode, history = []) {
  // These are viewports in native units, independent of the latest point and percentile.
  if (mode === "standard") return { activity: 2, inflation: 6 };
  if (mode === "close") return { activity: 0.5, inflation: 2 };
  if (mode !== "full") throw new Error("Unsupported state scale");
  return {
    activity: Math.max(
      2,
      Math.ceil(
        Math.max(
          0,
          ...history
            .filter((d) => finite(d.activity))
            .map((d) => Math.abs(d.activity)),
        ),
      ),
    ),
    inflation: Math.max(
      6,
      Math.ceil(
        Math.max(
          0,
          ...history
            .filter((d) => finite(d.inflation))
            .map((d) => Math.abs(d.inflation - STATE_RULES.inflationAnchor)),
        ),
      ),
    ),
  };
}
export function activityContext(history, date, value, years = "full") {
  if (years !== "full" && ![10, 20].includes(Number(years)))
    throw new Error("Unsupported state context window");
  const rows = (history || []).filter(
    (d) =>
      finite(d.activity) &&
      d.date < date &&
      (years === "full" ||
        monthIndex(d.date) >= monthIndex(date) - Number(years) * 12),
  );
  const expected =
    years === "full"
      ? rows.length
        ? monthIndex(date) - monthIndex(rows[0].date)
        : 0
      : Number(years) * 12;
  const stats = referenceStatistics(
    value,
    rows.map((d) => d.activity),
    expected,
    true,
  );
  const usable =
    stats.n >= 24 && ["ok", "partial_window"].includes(stats.status);
  const robustSd = usable && stats.mad > 1e-12 ? 1.4826 * stats.mad : null;
  const distance = robustSd ? value / robustSd : null;
  return {
    ...stats,
    status: usable ? stats.status : "insufficient_history",
    robustSd,
    distance,
    strength: finite(distance)
      ? 50 + 50 * Math.max(-1, Math.min(1, distance / 3))
      : null,
    first: rows[0]?.date ?? null,
    last: rows.at(-1)?.date ?? null,
    min: rows.length ? Math.min(...rows.map((d) => d.activity)) : null,
    max: rows.length ? Math.max(...rows.map((d) => d.activity)) : null,
    values: rows.map((d) => d.activity),
  };
}
export function stateMove(slots) {
  const a = slots.at(-2)?.point,
    b = slots.at(-1)?.point;
  if (!a || !b) return null;
  const activity = b.activity - a.activity,
    inflation = b.inflation - a.inflation;
  const sx = Math.sign(activity),
    sy = Math.sign(inflation);
  const arrow =
    sx === 0
      ? sy > 0
        ? "↑"
        : sy < 0
          ? "↓"
          : "•"
      : sx > 0
        ? sy > 0
          ? "↗"
          : sy < 0
            ? "↘"
            : "→"
        : sy > 0
          ? "↖"
          : sy < 0
            ? "↙"
            : "←";
  return {
    activity,
    inflation,
    arrow,
    from: slots.at(-2).label,
    to: slots.at(-1).label,
  };
}
