import { DEFINITIONS, summarizeAxis, classify, periodEnd } from "./model.mjs";
export const TRAIL_VERSION = "reference-period-trail-1";
const finite = Number.isFinite;
const DAY = 86400000;
const definitions = DEFINITIONS.filter((d) =>
  ["growth", "inflation"].includes(d.group),
);
const dateString = (d) => d.toISOString().slice(0, 10);

// These cutoffs refer to completed economic reference periods, not release dates.
// Original publication lags and historical FRED vintages are not simulated.
export function reconstructPosition(profiles, cutoff) {
  const time = Date.parse(cutoff + "T23:59:59Z");
  const byId = new Map((profiles || []).map((p) => [p.id, p]));
  const rows = definitions.map((def) => {
    const point = byId
      .get(def.id)
      ?.history?.findLast((p) => periodEnd(p.date, def.frequency) <= time);
    const valid =
      point &&
      finite(point.momentum) &&
      (time - periodEnd(point.date, def.frequency)) / DAY <= def.maxAge;
    return {
      ...def,
      score: valid
        ? Math.max(-1, Math.min(1, point.momentum / def.scale))
        : null,
    };
  });
  const growth = summarizeAxis(rows, "growth"),
    inflation = summarizeAxis(rows, "inflation");
  return {
    date: cutoff,
    growth,
    inflation,
    regime: classify(growth.score, inflation.score),
  };
}

export function buildTrail(snapshot, { cadence = "monthly", count = 12 } = {}) {
  const step = { monthly: 1, quarterly: 3, annual: 12 }[cadence];
  if (!step || ![5, 12, 20].includes(count))
    throw new Error("Unsupported trail selection");
  if (!snapshot?.fetchedAt || !finite(Date.parse(snapshot.fetchedAt)))
    return [];
  const now = new Date(snapshot.fetchedAt),
    year = now.getUTCFullYear();
  const month = Math.floor(now.getUTCMonth() / step) * step;
  const slots = [];
  for (let age = count - 1; age >= 1; age--) {
    const start = new Date(Date.UTC(year, month - step * age, 1));
    const end = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + step, 0),
    );
    const key =
      cadence === "annual"
        ? String(start.getUTCFullYear())
        : cadence === "quarterly"
          ? `${start.getUTCFullYear()} Q${Math.floor(start.getUTCMonth() / 3) + 1}`
          : dateString(start).slice(0, 7);
    let point = null;
    // Last valid monthly reference-period position inside this completed bucket.
    for (let m = step; m >= 1; m--) {
      const cutoff = dateString(
        new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + m, 0)),
      );
      const candidate = reconstructPosition(snapshot.profiles, cutoff);
      if (finite(candidate.growth.score) && finite(candidate.inflation.score)) {
        point = candidate;
        break;
      }
    }
    slots.push({
      key,
      sequence: count - age,
      label: key,
      kind: "reconstructed",
      periodStart: dateString(start),
      periodEnd: dateString(end),
      point,
    });
  }
  const validNow =
    finite(snapshot.growth?.score) && finite(snapshot.inflation?.score);
  slots.push({
    key: "now",
    sequence: count,
    label: "Now",
    kind: "current",
    periodStart: dateString(new Date(Date.UTC(year, month, 1))),
    periodEnd: dateString(now),
    point: validNow
      ? {
          date: dateString(now),
          growth: snapshot.growth,
          inflation: snapshot.inflation,
          regime: snapshot.regime,
        }
      : null,
  });
  return slots;
}

export function trailStyle(index, count) {
  const age = count > 1 ? index / (count - 1) : 1;
  return {
    radius: 8.5 + 5.5 * age,
    opacity: 0.16 + 0.84 * age,
    lineOpacity: 0.12 + 0.58 * age,
    lineWidth: 1 + age,
  };
}
