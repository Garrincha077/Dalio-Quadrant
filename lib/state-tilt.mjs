import { STATE_RULES, classifyEconomicState } from "./economic-state.mjs";

export const TILT_VERSION = "state-tilt-1";
export const TILT_RULES = Object.freeze({
  trendMonths: 3,
  prior: 24,
  entryLag: 2,
  minMatches: 24,
  minEpisodes: 6,
  closeLeaderGap: 0.01,
});
const finite = Number.isFinite;
const clamp = (x) => Math.max(0, Math.min(1, x));
export const shiftMonth = (m, n) =>
  new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1))
    .toISOString()
    .slice(0, 7);
const month = (p) => p.month || p.date?.slice(0, 7);
const valid = (p) => p && finite(p.activity) && finite(p.inflation);
export function trendDirection(value, band) {
  return value > band + 1e-9
    ? "rising"
    : value < -band - 1e-9
      ? "falling"
      : "flat";
}
export function stateTrend(rows, end, current = null) {
  const map = new Map(rows.map((p) => [month(p), p]));
  return trendFromMap(map, end, current);
}
function trendFromMap(map, end, current = null) {
  const four = Array.from({ length: 4 }, (_, i) =>
    i === 3 && current ? current : map.get(shiftMonth(end, i - 3)),
  );
  if (!four.every(valid)) return null;
  const activity = four[3].activity - four[0].activity;
  const inflation = four[3].inflation - four[0].inflation;
  const a = trendDirection(activity, STATE_RULES.activityBuffer);
  const p = trendDirection(inflation, STATE_RULES.inflationBuffer);
  return {
    from: shiftMonth(end, -3),
    to: end,
    activity,
    inflation,
    activityDirection: a,
    inflationDirection: p,
    key: `${a}/${p}`,
  };
}
export function quadrantWeights(activity, inflation) {
  const above = clamp(
    (activity + STATE_RULES.activityBuffer) / (2 * STATE_RULES.activityBuffer),
  );
  const high = clamp(
    (inflation - STATE_RULES.inflationAnchor + STATE_RULES.inflationBuffer) /
      (2 * STATE_RULES.inflationBuffer),
  );
  return {
    "above-above": above * high,
    "above-below": above * (1 - high),
    "below-above": (1 - above) * high,
    "below-below": (1 - above) * (1 - high),
  };
}
export function weightedQuantile(values, weights, fraction) {
  const ordered = values
    .map((v, i) => [v, weights[i]])
    .filter(([, w]) => w > 0)
    .sort((a, b) => a[0] - b[0]);
  let sum = 0;
  for (const [value, weight] of ordered) {
    sum += weight;
    if (sum + 1e-12 >= fraction) return value;
  }
  return ordered.at(-1)?.[0] ?? null;
}
function episodes(rows, predicate) {
  let count = 0,
    previous = null;
  for (const row of rows)
    if (predicate(row)) {
      if (!previous || shiftMonth(previous, 1) !== row.month) count++;
      previous = row.month;
    }
  return count;
}
const mean = (values, weights) =>
  values.reduce((s, v, i) => s + v * weights[i], 0);

export function buildStateTilt(snapshot, data, horizon = 12, now = new Date()) {
  const unavailable = (reason) => ({
    available: false,
    version: TILT_VERSION,
    reason,
  });
  if (![3, 12, 36].includes(Number(horizon)))
    return unavailable("Unsupported holding horizon.");
  if (data?.version !== "state-forward-1" || !Array.isArray(data.points))
    return unavailable("Waiting for the frozen asset-return research.");
  const state = snapshot?.economicState;
  if (
    !state?.available ||
    state.activity?.status !== "ok" ||
    state.inflation?.status !== "ok" ||
    !finite(state.activity.value) ||
    !finite(state.inflation.value)
  )
    return unavailable(
      "A recommendation requires both fresh economic-state axes.",
    );
  const reference = state.activity.date?.slice(0, 7);
  if (!reference || reference !== state.inflation.date?.slice(0, 7))
    return unavailable(
      "Recommendation withheld: activity and inflation refer to different months.",
    );
  const current = {
    activity: state.activity.value,
    inflation: state.inflation.value,
  };
  const trend = stateTrend(
    snapshot.stateHistory?.history || [],
    reference,
    current,
  );
  if (!trend)
    return unavailable(
      "Recommendation withheld: four consecutive same-month state pairs are needed for the 3-month trend.",
    );
  const lastCompleted = shiftMonth(now.toISOString().slice(0, 7), -1);
  if (reference > lastCompleted)
    return unavailable(
      "Recommendation withheld until the reference month is complete.",
    );
  const cutoff = [data.lastPriceMonth, lastCompleted].sort()[0];
  const assets = Object.keys(data.assets);
  const h = data.horizons.indexOf(Number(horizon));
  const lag = String(TILT_RULES.entryLag);
  if (h < 0 || assets.length !== 5)
    return unavailable("Incompatible return research.");
  const historical = new Map(data.points.map((p) => [p.month, p]));
  const rows = data.points
    .map((p) => ({ ...p, trend: trendFromMap(historical, p.month) }))
    .filter(
      (p) =>
        p.trend &&
        shiftMonth(p.month, TILT_RULES.entryLag + Number(horizon)) <= cutoff &&
        assets.every((a) => finite(p.returns?.[lag]?.[a]?.[h])),
    )
    .sort((a, b) => a.month.localeCompare(b.month));
  if (rows.length < TILT_RULES.minMatches)
    return unavailable(
      "Insufficient common mature return history for this horizon.",
    );
  const shares = quadrantWeights(current.activity, current.inflation);
  const weights = new Array(rows.length).fill(0),
    components = [];
  let trendMix = 0,
    stateMix = 0,
    priorMix = 0;
  for (const [q, share] of Object.entries(shares)) {
    if (share <= 1e-12) continue;
    const parent = rows.filter((r) => r.quadrant === q);
    const joint = parent.filter((r) => r.trend.key === trend.key);
    const alpha = parent.length / (parent.length + TILT_RULES.prior);
    const beta = joint.length / (joint.length + TILT_RULES.prior);
    const componentWeights = rows.map(
      (r) =>
        beta *
          (r.quadrant === q && r.trend.key === trend.key
            ? 1 / joint.length
            : 0) +
        (1 - beta) *
          (alpha * (r.quadrant === q ? 1 / parent.length : 0) +
            (1 - alpha) / rows.length),
    );
    componentWeights.forEach((w, i) => {
      weights[i] += share * w;
    });
    trendMix += share * beta;
    stateMix += share * (1 - beta) * alpha;
    priorMix += share * (1 - beta) * (1 - alpha);
    const componentRanking = assets
      .map((a) => ({
        asset: a,
        mean: mean(
          rows.map((r) => r.returns[lag][a][h]),
          componentWeights,
        ),
      }))
      .sort((a, b) => b.mean - a.mean || a.asset.localeCompare(b.asset));
    components.push({
      quadrant: q,
      share,
      stateN: parent.length,
      matches: joint.length,
      episodes: episodes(
        rows,
        (r) => r.quadrant === q && r.trend.key === trend.key,
      ),
      leader: componentRanking[0].asset,
      mean: componentRanking[0].mean,
    });
  }
  const ranking = assets
    .map((a) => {
      const values = rows.map((r) => r.returns[lag][a][h]);
      const average = mean(values, weights);
      const baseline = values.reduce((s, v) => s + v, 0) / values.length;
      return {
        asset: a,
        name: data.assets[a],
        mean: average,
        baseline,
        lift: average - baseline,
        median: weightedQuantile(values, weights, 0.5),
        p10: weightedQuantile(values, weights, 0.1),
        lossFrequency: weights.reduce(
          (s, w, i) => s + (values[i] < 0 ? w : 0),
          0,
        ),
      };
    })
    .sort((a, b) => b.mean - a.mean || a.asset.localeCompare(b.asset));
  const matching = (r) =>
    shares[r.quadrant] > 1e-12 && r.trend.key === trend.key;
  const matches = rows.filter(matching).length,
    matchedEpisodes = episodes(rows, matching);
  return {
    available: true,
    version: TILT_VERSION,
    reference,
    horizon: Number(horizon),
    entryLag: TILT_RULES.entryLag,
    researchAsOf: data.asOf,
    priceCutoff: cutoff,
    current,
    trend,
    regime: classifyEconomicState(current.activity, current.inflation),
    ranking,
    preference: ranking[0].mean > 0 ? ranking[0].asset : null,
    closeLeaders: ranking[0].mean - ranking[1].mean < TILT_RULES.closeLeaderGap,
    nearBoundary: components.length > 1,
    boundaryDisagreement: new Set(components.map((c) => c.leader)).size > 1,
    components,
    mixing: { trend: trendMix, state: stateMix, prior: priorMix },
    cohort: {
      n: rows.length,
      first: rows[0].month,
      last: rows.at(-1).month,
      matches,
      episodes: matchedEpisodes,
      thin:
        matches < TILT_RULES.minMatches ||
        matchedEpisodes < TILT_RULES.minEpisodes,
    },
    outdated: shiftMonth(data.lastPriceMonth, 6) < reference,
  };
}
