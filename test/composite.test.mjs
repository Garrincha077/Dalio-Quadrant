import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPressure,
  pressureOverview,
  compactPressure,
  PILLARS,
} from "../lib/composite.mjs";
import { historyRecord } from "../lib/archive.mjs";
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
function fixture(z = 0) {
  const ids = PILLARS.flatMap((p) => p.members.map(([id]) => id));
  const stat = () => ({ z, robustZ: z * 2, status: "ok" });
  return {
    indicators: ids.map((id) => ({ id, status: "ok" })),
    profiles: ids.map((id) => ({
      id,
      current: { date: "2026-08-01" },
      windows: Object.fromEntries(
        [5, 10, 20].map((y) => [y, { level: stat(), momentum: stat() }]),
      ),
    })),
  };
}
test("neutral inputs yield 50; four pillar weights stay equal despite member counts", () => {
  close(buildPressure(fixture()).score, 50);
  const s = fixture();
  s.profiles.find((p) => p.id === "pce").windows[10].level.robustZ = 3;
  close(buildPressure(s).score, 50 + ((50 / 3) * 3) / 4 / 4);
  assert.equal(buildPressure(s).momentum.z, 0);
});
test("growth, lending and liquidity invert; higher inflation, tightness and debt increase pressure", () => {
  const s = fixture(1),
    score = buildPressure(s, { estimator: "standard" });
  close(score.pillars[0].level.z, -1);
  close(score.pillars[1].level.z, 1);
  close(score.pillars[2].level.z, 0);
  close(score.pillars[3].level.z, 1);
  close(score.score, 50 + (50 / 3) * 0.25);
});
test("only composite inputs are capped at ±3; raw z-scores and robust selection remain distinct", () => {
  const s = fixture(2),
    standard = buildPressure(s, { estimator: "standard" }),
    robust = buildPressure(s);
  assert.notEqual(standard.score, robust.score);
  assert.equal(robust.pillars[1].members[0].level.rawZ, 4);
  assert.equal(robust.pillars[1].level.z, 3);
  assert.equal(s.profiles[5].windows[10].level.robustZ, 4);
  for (const p of s.profiles)
    for (const y of [5, 10, 20])
      for (const measure of ["level", "momentum"])
        p.windows[y][measure].robustZ =
          PILLARS.flatMap((p) => p.members).find(([id]) => id === p.id)[1] *
          100;
  close(buildPressure(s).score, 100);
});
test("stale inputs are excluded; two of three debt metrics may carry the debt pillar", () => {
  const s = fixture();
  s.indicators.find((p) => p.id === "governmentDebt").status = "stale";
  const result = buildPressure(s);
  close(result.score, 50);
  close(result.coverage, 11 / 12);
  assert.equal(result.used, 15);
  assert.equal(result.pillars[3].members[1].level.z, null);
  s.indicators.find((p) => p.id === "fiscalInterest").status = "missing";
  assert.equal(buildPressure(s).score, null);
});
test("missing, sparse and zero-dispersion windows do not become neutral contributions", () => {
  const s = fixture();
  for (const id of ["gdp", "production"])
    s.profiles.find((p) => p.id === id).windows[10].level.status =
      "insufficient_history";
  assert.equal(buildPressure(s).score, null);
  assert.notEqual(buildPressure(s).momentum.score, null);
  const zero = fixture();
  zero.profiles[5].windows[10].level.robustZ = null;
  assert.equal(buildPressure(zero).pillars[1].level.used, 3);
  assert.equal(buildPressure({ profiles: [], indicators: [] }).score, null);
});
test("overall coverage also gates a composite when all four individual pillars barely qualify", () => {
  const s = fixture();
  for (const id of ["gdp", "pce", "loans"])
    s.indicators.find((p) => p.id === id).status = "stale";
  assert.notEqual(buildPressure(s).score, null);
  s.indicators.find((p) => p.id === "governmentDebt").status = "stale";
  assert.ok(buildPressure(s).pillars.every((p) => p.level.score !== null));
  assert.equal(buildPressure(s).score, null);
});
test("horizons use their own references; compact archive keeps method identity and survives re-reading", () => {
  const s = fixture(1);
  s.profiles[5].windows[20].level.robustZ = 0;
  assert.notEqual(
    buildPressure(s, { years: 20 }).score,
    buildPressure(s, { years: 10 }).score,
  );
  s.pressure = pressureOverview(s);
  const compact = compactPressure(s.pressure),
    record = historyRecord(s);
  assert.equal(compact.scores.length, 6);
  assert.deepEqual(record.pressure, compact);
  assert.deepEqual(historyRecord(record).pressure, compact);
  assert.ok(!JSON.stringify(compact).includes("members"));
  assert.throws(() => buildPressure(s, { years: 3 }));
});
