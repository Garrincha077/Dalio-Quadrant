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
  STATE_DEFINITIONS,
} from "../lib/economic-state.mjs";
import { historyRecord } from "../lib/archive.mjs";
import { fetchSeriesMetadata } from "../lib/fred.mjs";
const now = new Date("2026-10-19T12:00:00Z");
const rows = (activity = 0.4, pce = 3) => [
  { id: "activityState", value: activity, date: "2026-08-01", status: "ok" },
  { id: "headlinePce", value: pce, date: "2026-08-01", status: "ok" },
];
const breadthRows = () =>
  [
    ["production", 1],
    ["realIncome", 2],
    ["realConsumption", 3],
    ["realSales", -1],
    ["payrolls", 0],
    ["householdEmployment", 0.5],
  ].map(([id, value]) => ({ id, value, date: "2026-08-01", status: "ok" }));
test("six monthly measures distinguish expansion, contraction and zero without counting stale readings", () => {
  const inputs = [...rows(), ...breadthRows()];
  const a = buildEconomicState(inputs, null, now);
  assert.equal(a.evidence.flatMap((g) => g.indicators).length, 16);
  assert.deepEqual(
    [
      a.activityBreadth.positive,
      a.activityBreadth.negative,
      a.activityBreadth.unchanged,
    ],
    [4, 1, 1],
  );
  assert.equal(a.activityBreadth.available, true);
  assert.equal(a.activityBreadth.count, 6);
  for (const id of ["production", "realIncome", "realConsumption"])
    inputs.find((d) => d.id === id).status = "stale";
  const b = buildEconomicState(inputs, null, now);
  assert.equal(b.activityBreadth.count, 3);
  assert.equal(b.activityBreadth.available, false);
  assert.equal(b.available, true);
  assert.equal(b.regime.id, a.regime.id);
});
test("breadth requires completed and comparable reference periods, with no forward filling", () => {
  const inputs = breadthRows();
  inputs[0].date = "2026-09-01";
  inputs[1].date = "2026-06-01";
  inputs[2].date = "2026-10-01";
  inputs[3].date = "2026-07-01";
  const s = buildEconomicState(inputs, null, now);
  assert.equal(s.activityBreadth.count, 4);
  assert.equal(s.activityBreadth.available, true);
  assert.equal(s.activityBreadth.earliest, "2026-07-01");
  assert.equal(s.activityBreadth.latest, "2026-09-01");
  assert.equal(
    s.activityBreadth.indicators[1].status,
    "older reference period",
  );
  assert.equal(s.activityBreadth.indicators[2].status, "incomplete period");
  const empty = buildEconomicState([], null, now).activityBreadth;
  assert.equal(empty.count, 0);
  assert.equal(empty.available, false);
  assert.equal(empty.earliest, null);
});
test("new real-economy measures use exact annual growth; published trimmed PCE is never differenced again", () => {
  const raw = Object.fromEntries(
    STATE_DEFINITIONS.slice(2).map((d) => [
      d.series,
      {
        observations:
          d.id === "trimmedPce"
            ? [{ date: "2026-08-01", value: "2.19" }]
            : [
                { date: "2025-08-01", value: "100" },
                { date: "2026-08-01", value: "103" },
                { date: "2026-10-01", value: "999" },
              ],
      },
    ]),
  );
  const s = buildSnapshot(raw, now);
  for (const id of [
    "realIncome",
    "realConsumption",
    "realSales",
    "householdEmployment",
    "coreCpi",
  ]) {
    const d = s.indicators.find((d) => d.id === id);
    assert.ok(Math.abs(d.value - 3) < 1e-12);
    assert.equal(d.date, "2026-08-01");
    assert.equal(d.score, null);
  }
  assert.equal(s.indicators.find((d) => d.id === "trimmedPce").value, 2.19);
  assert.equal(s.growth.score, null);
  assert.equal(s.inflation.score, null);
  delete raw.W875RX1.observations[0];
  raw.W875RX1.observations = raw.W875RX1.observations.filter(Boolean);
  assert.equal(
    buildSnapshot(raw, now).indicators.find((d) => d.id === "realIncome")
      .status,
    "missing",
  );
});
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
