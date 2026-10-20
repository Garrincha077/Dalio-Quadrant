import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStateTilt,
  quadrantWeights,
  stateTrend,
  trendDirection,
  shiftMonth,
  weightedQuantile,
} from "../lib/state-tilt.mjs";

const now = new Date("2026-10-20T12:00:00Z");
function fixture() {
  const assets = {
    SPY: "Equities",
    IEF: "Treasuries",
    GLD: "Gold",
    TIP: "TIPS",
    DBC: "Commodities",
  };
  const points = Array.from({ length: 72 }, (_, i) => ({
    month: shiftMonth("2018-01", i),
    activity: i === 28 ? 0.9 : 0.5,
    inflation: 3,
    quadrant: "above-above",
    returns: {
      2: Object.fromEntries(
        Object.keys(assets).map((a) => [
          a,
          [0, 1, 2].map(() =>
            a === "GLD" ? 0.1 : a === "SPY" ? (i === 28 ? 1 : 0.01) : 0.02,
          ),
        ]),
      ),
    },
  }));
  const history = Array.from({ length: 4 }, (_, i) => ({
    date: shiftMonth("2026-05", i) + "-01",
    activity: i === 3 ? 0.9 : 0.5,
    inflation: 3,
  }));
  return {
    data: {
      version: "state-forward-1",
      asOf: "2026-10-20",
      lastPriceMonth: "2026-09",
      horizons: [3, 12, 36],
      assets,
      points,
    },
    snapshot: {
      economicState: {
        available: true,
        activity: { status: "ok", date: "2026-08-01", value: 0.9 },
        inflation: { status: "ok", date: "2026-08-01", value: 3 },
      },
      stateHistory: { history },
    },
  };
}
test("economic zero blends boundaries and activity +.01 has 55/45 membership", () => {
  const w = quadrantWeights(0.01, 3);
  assert.ok(Math.abs(w["above-above"] - 0.55) < 1e-12);
  assert.ok(Math.abs(w["below-above"] - 0.45) < 1e-12);
  assert.deepEqual(quadrantWeights(0, 2), {
    "above-above": 0.25,
    "above-below": 0.25,
    "below-above": 0.25,
    "below-below": 0.25,
  });
  for (const a of [-8, -0.1, 0, 0.01, 0.1, 5])
    for (const p of [-1, 1.8, 2, 2.2, 12])
      assert.ok(
        Math.abs(
          Object.values(quadrantWeights(a, p)).reduce((s, v) => s + v, 0) - 1,
        ) < 1e-12,
      );
});
test("noise-band edges remain flat despite floating-point subtraction", () => {
  assert.equal(trendDirection(0.3 - 0.2, 0.1), "flat");
  assert.equal(trendDirection(3.2 - 3, 0.2), "flat");
  assert.equal(trendDirection(-0.100001, 0.1), "falling");
  assert.equal(trendDirection(0.200001, 0.2), "rising");
});
test("trend requires four consecutive pairs and ignores future observations", () => {
  const { snapshot } = fixture(),
    rows = snapshot.stateHistory.history;
  assert.equal(stateTrend(rows, "2026-08").key, "rising/flat");
  assert.equal(
    stateTrend(
      rows.filter((_, i) => i !== 1),
      "2026-08",
    ),
    null,
  );
  assert.deepEqual(
    stateTrend(
      [...rows, { date: "2026-09-01", activity: -50, inflation: 99 }],
      "2026-08",
    ),
    stateTrend(rows, "2026-08"),
  );
});
test("one spectacular matched result is pooled toward broad evidence", () => {
  const { snapshot, data } = fixture();
  const r = buildStateTilt(snapshot, data, 12, now);
  assert.equal(r.available, true);
  assert.equal(r.cohort.matches, 1);
  assert.equal(r.cohort.thin, true);
  assert.equal(r.preference, "GLD");
  const spy = r.ranking.find((a) => a.asset === "SPY");
  assert.ok(Math.abs(spy.mean - (1 / 25 + (24 / 25) * spy.baseline)) < 1e-12);
  assert.ok(
    Math.abs(r.mixing.trend + r.mixing.state + r.mixing.prior - 1) < 1e-12,
  );
});
test("only common, mature labels enter and future labels cannot change a current ranking", () => {
  const { snapshot, data } = fixture();
  const expected = buildStateTilt(snapshot, data, 12, now);
  const extra = {
    ...structuredClone(data.points[0]),
    month: "2026-08",
    returns: {
      2: Object.fromEntries(
        Object.keys(data.assets).map((a) => [a, [100, 100, 100]]),
      ),
    },
  };
  data.points.push(extra);
  assert.deepEqual(buildStateTilt(snapshot, data, 12, now), expected);
  data.points[10].returns[2].TIP[1] = null;
  assert.equal(
    buildStateTilt(snapshot, data, 12, now).cohort.n,
    expected.cohort.n - 1,
  );
});
test("stale, mixed, missing, incomplete or unsupported inputs withhold preferences", () => {
  const { snapshot, data } = fixture();
  for (const change of [
    (s) => (s.economicState.available = false),
    (s) => (s.economicState.activity.status = "stale"),
    (s) => (s.economicState.inflation.date = "2026-07-01"),
    (s) => s.stateHistory.history.splice(1, 1),
    (s) => (s.economicState.activity.value = null),
  ]) {
    const s = structuredClone(snapshot);
    change(s);
    assert.equal(buildStateTilt(s, data, 12, now).available, false);
  }
  assert.equal(buildStateTilt(snapshot, null, 12, now).available, false);
  assert.equal(buildStateTilt(snapshot, data, 1, now).available, false);
  assert.equal(
    buildStateTilt(snapshot, data, 12, new Date("2026-08-20")).available,
    false,
  );
});
test("all-negative cohorts produce no positive preference and weighted quantiles use observation weights", () => {
  const { snapshot, data } = fixture();
  for (const p of data.points)
    for (const a of Object.keys(data.assets))
      p.returns[2][a] = [-0.1, -0.1, -0.1];
  const r = buildStateTilt(snapshot, data, 12, now);
  assert.equal(r.preference, null);
  assert.equal(r.closeLeaders, true);
  assert.equal(weightedQuantile([-1, 0, 1], [0.1, 0.8, 0.1], 0.5), 0);
  assert.equal(weightedQuantile([-1, 0, 1], [0.8, 0.1, 0.1], 0.5), -1);
});
test("rankings move continuously through economic zero", () => {
  const { snapshot, data } = fixture();
  const results = [-0.000001, 0.000001].map((value) => {
    const s = structuredClone(snapshot);
    s.economicState.activity.value = value;
    return buildStateTilt(s, data, 12, now);
  });
  for (const a of Object.keys(data.assets))
    assert.ok(
      Math.abs(
        results[0].ranking.find((r) => r.asset === a).mean -
          results[1].ranking.find((r) => r.asset === a).mean,
      ) < 0.0001,
    );
});
