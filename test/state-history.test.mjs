import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStateHistory,
  buildStateTrail,
  stateScale,
  activityContext,
  stateMove,
} from "../lib/state-history.mjs";
import { buildSnapshot } from "../lib/model.mjs";
import { historyRecord } from "../lib/archive.mjs";
import { classifyEconomicState } from "../lib/economic-state.mjs";
import { loadDashboard } from "../lib/fred.mjs";
const now = new Date("2026-10-20T12:00:00Z");
const date = (i) => new Date(Date.UTC(1995, i, 1)).toISOString().slice(0, 10);
const fixture = () => {
  const history = Array.from({ length: 380 }, (_, i) => ({
    date: date(i),
    activity: ((i % 9) - 4) / 10,
    inflation: 3,
  }));
  return {
    stateHistory: { history },
    economicState: {
      available: true,
      activity: { date: "2026-08-01", value: 0.01 },
      inflation: { date: "2026-08-01", value: 3.42 },
      inflationGap: 1.42,
      regime: classifyEconomicState(0.01, 3.42),
    },
  };
};
test("state history pairs exact reference months and exact year-earlier bases, excluding unfinished and future data", () => {
  const a = [
    { date: "2026-08-01", value: 0.01 },
    { date: "2026-09-01", value: 0.2 },
    { date: "2026-10-01", value: 999 },
  ];
  const p = [
    { date: "2025-08-01", value: 100 },
    { date: "2025-10-01", value: 100 },
    { date: "2026-08-01", value: 103 },
    { date: "2026-09-01", value: 104 },
    { date: "2026-10-01", value: 999 },
  ];
  const h = buildStateHistory(a, p, now).history;
  assert.equal(h.length, 2);
  assert.ok(Math.abs(h[0].inflation - 3) < 1e-12);
  assert.equal(h[1].inflation, null);
  assert.equal(h[1].activity, 0.2);
});
test("monthly state trail ends at the indicator reference month, not the fetch month, without duplicating Latest", () => {
  const slots = buildStateTrail(fixture());
  assert.equal(slots.length, 12);
  assert.equal(slots[0].date, "2025-09-01");
  assert.equal(slots.at(-2).date, "2026-07-01");
  assert.equal(slots.at(-1).date, "2026-08-01");
  assert.equal(slots.at(-1).key, "latest");
  assert.equal(slots.at(-1).point.activity, 0.01);
  assert.deepEqual(
    slots.map((s) => s.sequence),
    Array.from({ length: 12 }, (_, i) => i + 1),
  );
});
test("quarterly and annual state sampling preserve final reference months and allow an explicitly partial final bucket", () => {
  const q = buildStateTrail(fixture(), { cadence: "quarterly" }),
    y = buildStateTrail(fixture(), { cadence: "annual" });
  assert.equal(q.at(-2).date, "2026-06-01");
  assert.equal(q.at(-1).date, "2026-08-01");
  assert.equal(q[0].date, "2023-12-01");
  assert.equal(y[0].date, "2015-12-01");
  assert.equal(y.at(-2).date, "2025-12-01");
});
test("replay uses its own same-month pair and cannot silently borrow current or earlier observations", () => {
  const s = fixture(),
    a = buildStateTrail(s, { end: "2008-12" });
  assert.equal(a.at(-1).kind, "reconstructed");
  assert.equal(a.at(-1).point.date, "2008-12-01");
  assert.equal(a.at(-1).point.inflation, 3);
  s.stateHistory.history = s.stateHistory.history.filter(
    (d) => d.date !== "2008-12-01",
  );
  assert.equal(buildStateTrail(s, { end: "2008-12" }).at(-1).point, null);
  assert.equal(stateMove(buildStateTrail(s, { end: "2008-12" })), null);
  assert.deepEqual(buildStateTrail(s, { end: "2026-09" }), []);
});
test("unavailable live state stays withheld even when reconstructed historical values exist", () => {
  const s = fixture();
  s.economicState.available = false;
  assert.equal(buildStateTrail(s).at(-1).point, null);
  assert.ok(buildStateTrail(s).at(-2).point);
  assert.throws(() => buildStateTrail(s, { end: "2026-99" }));
});
test("live mixed reference months are dated independently while historical pairs always match", () => {
  const s = fixture();
  s.economicState.inflation.date = "2026-09-01";
  const slots = buildStateTrail(s);
  assert.equal(slots.at(-1).date, "2026-09-01");
  assert.equal(slots.at(-2).date, "2026-08-01");
  assert.equal(slots.at(-1).point.activityDate, "2026-08-01");
  assert.equal(slots.at(-1).point.inflationDate, "2026-09-01");
  assert.equal(
    slots.at(-2).point.activityDate,
    slots.at(-2).point.inflationDate,
  );
});
test("viewports have fixed zero-centred bounds independent of current readings, with full range covering extremes", () => {
  const h = [
    { activity: -7.55, inflation: 0.46 },
    { activity: 4.58, inflation: 11.6 },
  ];
  assert.deepEqual(stateScale("standard", h), { activity: 2, inflation: 6 });
  assert.deepEqual(stateScale("close", h), { activity: 0.5, inflation: 2 });
  assert.deepEqual(stateScale("full", h), { activity: 8, inflation: 10 });
  assert.throws(() => stateScale("invalid"));
});
test("history percentile cannot move economic zero; neutral strength excludes the current observation and future values", () => {
  const h = Array.from({ length: 380 }, (_, i) => ({
    date: date(i),
    activity: i % 2 ? -0.2 : 0,
  }));
  const c = activityContext(h, "2026-08-01", 0, "20");
  assert.equal(c.n, 240);
  assert.equal(c.strength, 50);
  assert.equal(c.distance, 0);
  assert.ok(c.percentile > 50);
  assert.ok(c.z > 0);
  const changed = [
    ...h,
    { date: "2026-08-01", activity: 999 },
    { date: "2027-01-01", activity: -999 },
  ];
  assert.deepEqual(activityContext(changed, "2026-08-01", 0, "20"), c);
  assert.ok(activityContext(h, "2026-08-01", 0.01, "20").strength > 50);
  assert.equal(
    activityContext(h.slice(-10), "2026-08-01", 0.01, "20").strength,
    null,
  );
});
test("movement reflects actual changes and never crosses a missing slot", () => {
  const s = fixture(),
    slots = buildStateTrail(s);
  slots.at(-2).point.activity = 0.1;
  slots.at(-2).point.inflation = 3.8;
  const m = stateMove(slots);
  assert.equal(m.arrow, "↙");
  assert.ok(m.activity < 0 && m.inflation < 0);
  slots.at(-2).point = null;
  assert.equal(stateMove(slots), null);
});
test("historical arrays stay out of compact archives and original momentum scores", () => {
  const raw = {
    CFNAIMA3: { observations: [{ date: "2026-08-01", value: 0.01 }] },
    PCEPI: {
      observations: [
        { date: "2025-08-01", value: 100 },
        { date: "2026-08-01", value: 103 },
      ],
    },
  };
  const s = buildSnapshot(raw, now);
  assert.equal(s.stateHistory.history.length, 1);
  assert.equal(historyRecord(s).stateHistory, undefined);
  assert.equal(s.growth.score, null);
  assert.equal(s.inflation.score, null);
});
test("only state axes fetch their full source history; existing long and short source windows stay intact", async () => {
  const urls = [];
  await loadDashboard("test-only", {
    now,
    fetchImpl: async (u) => {
      urls.push(new URL(u));
      return { ok: true, json: async () => ({ observations: [] }) };
    },
  });
  for (const id of ["CFNAIMA3", "PCEPI"]) {
    const u = urls.find((u) => u.searchParams.get("series_id") === id);
    assert.equal(u.searchParams.get("observation_start"), "1959-01-01");
    assert.ok(Number(u.searchParams.get("limit")) >= 1000);
  }
  assert.equal(
    urls
      .find((u) => u.searchParams.get("series_id") === "PCETRIM12M159SFRBDAL")
      .searchParams.get("observation_start"),
    "2024-04-20",
  );
});
