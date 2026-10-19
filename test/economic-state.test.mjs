import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSnapshot,
  VERSION,
  MODEL_VERSION,
  SERIES,
} from "../lib/model.mjs";
import {
  classifyEconomicState,
  buildEconomicState,
  buildGDPNow,
  STATE_VERSION,
} from "../lib/economic-state.mjs";
import { historyRecord } from "../lib/archive.mjs";
import { fetchSeriesMetadata } from "../lib/fred.mjs";
const now = new Date("2026-10-19T12:00:00Z");
const rows = (activity = 0.4, pce = 3) => [
  { id: "activityState", value: activity, date: "2026-08-01", status: "ok" },
  { id: "headlinePce", value: pce, date: "2026-08-01", status: "ok" },
];
test("economic-state quadrants use indicator levels around trend and PCE's 2% anchor", () => {
  assert.equal(classifyEconomicState(0.4, 3).id, "above-above");
  assert.equal(classifyEconomicState(0.4, 1).id, "above-below");
  assert.equal(classifyEconomicState(-0.4, 3).id, "below-above");
  assert.equal(classifyEconomicState(-0.4, 1).id, "below-below");
  assert.equal(classifyEconomicState(0, 2).id, "boundary");
  assert.equal(classifyEconomicState(0.01, 3).nearBoundary, true);
  assert.equal(classifyEconomicState(0.4, 2.2).nearBoundary, true);
  assert.equal(classifyEconomicState(null, 3).id, "unavailable");
  assert.equal(classifyEconomicState(NaN, 3).id, "unavailable");
});
test("static levels remain unchanged when the momentum comparisons change", () => {
  const a = buildEconomicState(rows()),
    b = buildEconomicState(
      rows().map((d) => ({ ...d, delta: -999, score: -1 })),
    );
  assert.deepEqual(a, b);
  assert.equal(a.inflationGap, 1);
});
test("stale, missing or mismatched periods cannot claim a current joint state", () => {
  const stale = rows();
  stale[0].status = "stale";
  assert.equal(buildEconomicState(stale).available, false);
  assert.equal(buildEconomicState(rows().slice(1)).available, false);
  const mixed = rows();
  mixed[1].date = "2026-07-01";
  assert.equal(buildEconomicState(mixed).available, true);
  assert.equal(buildEconomicState(mixed).mixedPeriods, true);
  mixed[1].date = "2026-06-01";
  assert.equal(buildEconomicState(mixed).available, false);
});
test("snapshot state uses exact headline PCE YoY and leaves the original momentum model separate", () => {
  const s = buildSnapshot(
    {
      CFNAIMA3: { observations: [{ date: "2026-08-01", value: "0.4" }] },
      PCEPI: {
        observations: [
          { date: "2025-08-01", value: "100" },
          { date: "2026-08-01", value: "103" },
        ],
      },
    },
    now,
  );
  assert.ok(Math.abs(s.economicState.inflation.value - 3) < 1e-12);
  assert.equal(s.economicState.regime.id, "above-above");
  assert.equal(s.regime.id, "unavailable");
  assert.equal(s.economicState.method, STATE_VERSION);
  assert.equal(s.modelVersion, MODEL_VERSION);
  assert.equal(historyRecord(s).economicState.activity.value, 0.4);
  assert.equal(
    historyRecord({ version: "2.0.0", indicators: [] }).economicState,
    undefined,
  );
  assert.equal(SERIES.length, new Set(SERIES).size);
  const revised = buildSnapshot(
    { CFNAIMA3: { observations: [{ date: "2026-08-01", value: "0.5" }] } },
    now,
  );
  assert.notEqual(s.signature, revised.signature);
});
test("missing year-earlier PCE and future observations are not filled into static axes", () => {
  const s = buildSnapshot(
    {
      CFNAIMA3: {
        observations: [
          { date: "2026-08-01", value: "0.4" },
          { date: "2026-10-01", value: "8" },
          { date: "2026-11-01", value: "9" },
        ],
      },
      PCEPI: {
        observations: [
          { date: "2025-07-01", value: "100" },
          { date: "2026-08-01", value: "103" },
        ],
      },
    },
    now,
  );
  assert.equal(s.economicState.activity.value, 0.4);
  assert.equal(s.economicState.available, false);
});
test("GDPNow uses its actual update timestamp and target quarter, with distinct units", () => {
  const p = [
    { date: "2026-07-01", value: 3.64 },
    { date: "2027-01-01", value: 99 },
  ];
  const n = buildGDPNow(p, { lastUpdated: "2026-10-15 11:02:40-05" }, now);
  assert.equal(n.status, "ok");
  assert.equal(n.date, "2026-07-01");
  assert.equal(n.value, 3.64);
  assert.equal(n.updatedAt, "2026-10-15T16:02:40.000Z");
  assert.equal(n.unit, "% q/q annualised (SAAR)");
  assert.equal(buildGDPNow(p, null, now).status, "update date unavailable");
  assert.equal(
    buildGDPNow(p, { lastUpdated: "2026-09-01 11:00:00-05" }, now).status,
    "stale",
  );
  assert.equal(
    buildGDPNow(p, { lastUpdated: "2026-11-01 11:00:00-05" }, now).status,
    "update date unavailable",
  );
  assert.equal(
    buildGDPNow(
      [{ date: "2025-01-01", value: 3 }],
      { lastUpdated: "2026-10-15 11:02:40-05" },
      now,
    ).status,
    "stale",
  );
});
test("metadata fetch returns only inspected update metadata, with a safe failure on invalid results", async () => {
  const metadata = await fetchSeriesMetadata("GDPNOW", "not-a-real-key", {
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        seriess: [{ last_updated: "2026-10-15 11:02:40-05" }],
      }),
    }),
  });
  assert.deepEqual(metadata, { lastUpdated: "2026-10-15 11:02:40-05" });
  const failed = await fetchSeriesMetadata("GDPNOW", "not-a-real-key", {
    fetchImpl: async () => {
      throw new Error("network");
    },
  });
  assert.deepEqual(failed, { error: true });
});
