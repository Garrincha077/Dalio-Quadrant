import test from "node:test";
import assert from "node:assert/strict";
import {
  referenceStatistics,
  historicalProfile,
  contextFingerprint,
} from "../lib/statistics.mjs";
import {
  normalizedHistory,
  fiscalInterestPoints,
  transform,
  FISCAL_DEFINITION,
  isCompatibleSnapshot,
  MODEL_VERSION,
  VERSION,
} from "../lib/model.mjs";
import { historyRecord } from "../lib/archive.mjs";
import { loadDashboard } from "../lib/fred.mjs";
const approx = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const monthly = (count) =>
  Array.from({ length: count }, (_, i) => ({
    date: new Date(Date.UTC(2000, 0 + i, 1)).toISOString().slice(0, 10),
    value: i,
    momentum: i / 10,
  }));
test("sample standard deviation, robust scaling and empirical ranks are explicit", () => {
  const s = referenceStatistics(3, [0, 1, 2], 3);
  assert.equal(s.mean, 1);
  assert.equal(s.sd, 1);
  assert.equal(s.z, 2);
  approx(s.robustZ, 2 / 1.4826);
  assert.equal(s.percentile, 100);
  assert.equal(referenceStatistics(1, [1, 1, 2, 2], 4).percentile, 25);
});
test("zero dispersion is unavailable and raw z values are not clipped", () => {
  const constant = referenceStatistics(8, [2, 2, 2], 3);
  assert.equal(constant.z, null);
  assert.equal(constant.robustZ, null);
  assert.equal(referenceStatistics(2, [1, 1, 1, 10], 4).robustZ, null);
  assert.ok(referenceStatistics(100, [0, 1, 2], 3).z > 3);
});
test("5-year baseline excludes the current observation and stays backward-only", () => {
  const history = monthly(61),
    p = historicalProfile({ id: "test", frequency: "monthly" }, history),
    s = p.windows[5].level;
  assert.equal(s.n, 60);
  assert.equal(s.expected, 60);
  assert.equal(s.mean, 29.5);
  assert.equal(p.windows[5].end, "2004-12-01");
  const changed = historicalProfile({ frequency: "monthly" }, [
    ...history.slice(0, -1),
    { ...history.at(-1), value: 999 },
  ]);
  assert.equal(changed.windows[5].level.mean, 29.5);
  assert.notEqual(changed.windows[5].level.z, s.z);
});
test("small interior gaps keep explicit counts; excessive gaps and short histories are unavailable", () => {
  const rows = monthly(61);
  rows.splice(15, 1);
  const p = historicalProfile({ frequency: "monthly" }, rows);
  assert.equal(p.windows[5].level.n, 59);
  assert.equal(p.windows[5].level.status, "partial_window");
  assert.notEqual(p.windows[5].level.z, null);
  const missingMomentum = monthly(61);
  missingMomentum[15].momentum = null;
  assert.equal(
    historicalProfile({ frequency: "monthly" }, missingMomentum).windows[5]
      .momentum.n,
    59,
  );
  const sparse = monthly(61);
  sparse.splice(10, 10);
  assert.equal(
    historicalProfile({ frequency: "monthly" }, sparse).windows[5].level.z,
    null,
  );
  assert.equal(
    historicalProfile({ frequency: "monthly" }, monthly(60)).windows[5].level.z,
    null,
  );
});
test("quarterly data use 20 independent observations for five years, not forward-filled months", () => {
  const rows = Array.from({ length: 21 }, (_, i) => ({
    date: new Date(Date.UTC(2000, i * 3, 1)).toISOString().slice(0, 10),
    value: i,
    momentum: i,
  }));
  const p = historicalProfile({ frequency: "quarterly" }, rows);
  assert.equal(p.windows[5].level.n, 20);
  assert.equal(p.windows[5].level.expected, 20);
  assert.equal(p.windows[10].level.z, null);
});
test("weekly context samples completed months once and excludes future observations", () => {
  const rows = [
    { date: "2026-08-28", value: 1 },
    { date: "2026-09-02", value: 2 },
    { date: "2026-09-30", value: 3 },
    { date: "2026-10-07", value: 4 },
    { date: "2027-01-01", value: 99 },
  ];
  const h = normalizedHistory(
    { frequency: "weekly", transform: "level" },
    rows,
    new Date("2026-10-15"),
  );
  assert.equal(h.length, 2);
  assert.equal(h.at(-1).date, "2026-09-01");
  assert.equal(h.at(-1).value, 3);
  assert.equal(h.at(-1).sourceDate, "2026-09-30");
});
test("fiscal interest burden joins exact fiscal years and uses a one-year change", () => {
  const raw = {
    FYOINT: {
      observations: [
        { date: "2024-09-30", value: "10" },
        { date: "2025-09-30", value: "30" },
      ],
    },
    FYFR: {
      observations: [
        { date: "2024-09-30", value: "100" },
        { date: "2025-09-30", value: "200" },
        { date: "2026-09-30", value: "0" },
      ],
    },
  };
  const points = fiscalInterestPoints(raw),
    row = transform(FISCAL_DEFINITION, points, new Date("2026-10-15"));
  assert.equal(row.value, 15);
  assert.equal(row.delta, 5);
  assert.equal(row.deltaMonths, 12);
  assert.equal(
    fiscalInterestPoints({
      FYOINT: raw.FYOINT,
      FYFR: { observations: [{ date: "2023-09-30", value: "100" }] },
    }).length,
    0,
  );
});
test("a missing YoY base stays missing in the long-run profile", () => {
  const h = normalizedHistory(
    { frequency: "monthly", transform: "yoy" },
    [
      { date: "2026-08-01", value: 300 },
      { date: "2026-09-01", value: 310 },
    ],
    new Date("2026-10-15"),
  );
  assert.equal(h.at(-1).value, null);
  assert.equal(h.at(-1).momentum, null);
});
test("additive statistics retain compatible version 2.0 logs and do not bloat saved history", () => {
  assert.equal(isCompatibleSnapshot({ version: "2.0.0" }), true);
  assert.equal(
    isCompatibleSnapshot({ version: "2.0.0", modelVersion: "different" }),
    false,
  );
  assert.equal(
    historyRecord({ version: "2.0.0", indicators: [] }).version,
    "2.0.0",
  );
  assert.equal(
    isCompatibleSnapshot({ version: VERSION, modelVersion: MODEL_VERSION }),
    true,
  );
  assert.equal(
    isCompatibleSnapshot({ version: "3.0.0", modelVersion: "different" }),
    false,
  );
  const record = historyRecord({
    version: VERSION,
    indicators: [],
    profiles: [
      historicalProfile({ id: "sample", frequency: "monthly" }, monthly(300)),
    ],
    recessions: monthly(20),
  });
  assert.equal(record.profiles, undefined);
  assert.equal(record.recessions, undefined);
  assert.equal(record.context[0].scores.length, 3);
  assert.equal(record.context[0].history, undefined);
});
test("source requests fetch 25 years without truncating daily liquidity inputs", async () => {
  const urls = [];
  await loadDashboard("test-only", {
    now: new Date("2026-10-15"),
    fetchImpl: async (url) => {
      urls.push(new URL(url));
      return { ok: true, json: async () => ({ observations: [] }) };
    },
  });
  const rrp = urls.find((u) => u.searchParams.get("series_id") === "RRPONTSYD");
  assert.equal(rrp.searchParams.get("observation_start"), "2001-10-15");
  assert.equal(rrp.searchParams.get("limit"), "10000");
  const vix = urls.find((u) => u.searchParams.get("series_id") === "VIXCLS");
  assert.equal(vix.searchParams.get("observation_start"), "2024-04-15");
  assert.equal(vix.searchParams.get("limit"), "2000");
});
test("older reference revisions change the context signature even when current values are unchanged", () => {
  const rows = monthly(61),
    before = historicalProfile({ id: "test", frequency: "monthly" }, rows);
  const revised = rows.map((p, i) => (i === 10 ? { ...p, value: 999 } : p)),
    after = historicalProfile({ id: "test", frequency: "monthly" }, revised);
  assert.equal(before.current.value, after.current.value);
  assert.notEqual(contextFingerprint([before]), contextFingerprint([after]));
});
