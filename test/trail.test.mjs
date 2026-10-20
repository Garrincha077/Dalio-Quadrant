import test from "node:test";
import assert from "node:assert/strict";
import { buildTrail, reconstructPosition, trailStyle } from "../lib/trail.mjs";
import { DEFINITIONS, classify } from "../lib/model.mjs";
function fixture(at = "2026-10-19T10:00:00Z") {
  return {
    fetchedAt: at,
    growth: { score: 0.2, coverage: 1 },
    inflation: { score: -0.3, coverage: 1 },
    regime: classify(0.2, -0.3),
    profiles: DEFINITIONS.filter((d) =>
      ["growth", "inflation"].includes(d.group),
    ).map((def) => ({
      id: def.id,
      history: Array.from({ length: 27 * 12 }, (_, i) => ({
        date: new Date(Date.UTC(2000, i, 1)).toISOString().slice(0, 10),
        momentum: def.scale * 0.5,
      })).filter(
        (p) =>
          def.frequency !== "quarterly" || Number(p.date.slice(5, 7)) % 3 === 1,
      ),
    })),
  };
}
test("default monthly trail is now plus eleven completed months, without duplicating the current bucket", () => {
  const slots = buildTrail(fixture());
  assert.equal(slots.length, 12);
  assert.equal(slots[0].key, "2025-11");
  assert.equal(slots[10].key, "2026-09");
  assert.equal(slots[10].point.date, "2026-09-30");
  assert.equal(slots[11].point.date, "2026-10-19");
  assert.equal(slots[11].point.growth.score, 0.2);
  assert.equal(slots[11].kind, "current");
  assert.ok(slots.slice(0, -1).every((s) => s.kind === "reconstructed"));
});
test("quarterly and annual selections keep the same momentum math and use completed calendar buckets", () => {
  const s = fixture(),
    quarters = buildTrail(s, { cadence: "quarterly" }),
    years = buildTrail(s, { cadence: "annual" });
  assert.equal(quarters[0].key, "2024 Q1");
  assert.equal(quarters[10].key, "2026 Q3");
  assert.equal(years[0].key, "2015");
  assert.equal(years[10].point.date, "2025-12-31");
  assert.ok(Math.abs(quarters[10].point.growth.score - 0.5) < 1e-12);
  assert.ok(Math.abs(years[10].point.inflation.score - 0.5) < 1e-12);
});
test("UTC year boundaries and leap months are sampled correctly", () => {
  const slots = buildTrail(fixture("2024-03-01T00:30:00Z"));
  assert.equal(slots.at(-2).point.date, "2024-02-29");
  const jan = fixture("2026-01-01T00:01:00Z");
  assert.equal(buildTrail(jan).at(-2).key, "2025-12");
  assert.equal(buildTrail(jan, { cadence: "quarterly" }).at(-2).key, "2025 Q4");
  assert.equal(buildTrail(jan, { cadence: "annual" }).at(-2).key, "2025");
});
test("reference cutoff excludes unfinished periods and future reference data", () => {
  const s = fixture(),
    before = reconstructPosition(s.profiles, "2026-08-31");
  for (const p of s.profiles)
    for (const row of p.history)
      if (row.date >= "2026-09-01") row.momentum = -100;
  assert.deepEqual(reconstructPosition(s.profiles, "2026-08-31"), before);
  const gdp = s.profiles.find((p) => p.id === "gdp");
  gdp.history.find((p) => p.date === "2026-07-01").momentum = -100;
  assert.deepEqual(reconstructPosition(s.profiles, "2026-08-31"), before);
});
test("insufficient buckets remain gaps; longer buckets select their last valid monthly reference position", () => {
  const s = fixture();
  for (const p of s.profiles)
    for (const row of p.history)
      if (["2025-10-01", "2025-12-01"].includes(row.date)) row.momentum = null;
  const december = buildTrail(s).find((p) => p.key === "2025-12");
  assert.equal(december.point, null);
  const year = buildTrail(s, { cadence: "annual" }).find(
    (p) => p.key === "2025",
  );
  assert.equal(year.point.date, "2025-11-30");
  assert.equal(year.periodEnd, "2025-12-31");
  const stale = fixture();
  stale.profiles.forEach(
    (p) => (p.history = p.history.filter((r) => r.date < "2020-01-01")),
  );
  assert.equal(buildTrail(stale).at(-2).point, null);
});
test("fade and radii increase monotonically with recency; invalid current data never becomes a historical substitute", () => {
  const styles = Array.from({ length: 12 }, (_, i) => trailStyle(i, 12));
  assert.equal(styles[0].opacity, 0.16);
  assert.equal(styles.at(-1).opacity, 1);
  assert.equal(styles.at(-1).radius, 14);
  assert.ok(styles[0].radius >= 8, "oldest circle must fit a readable number");
  assert.equal(buildTrail(fixture())[0].sequence, 1);
  assert.equal(buildTrail(fixture()).at(-1).sequence, 12);
  assert.ok(
    styles.every(
      (s, i) =>
        i === 0 ||
        (s.radius > styles[i - 1].radius && s.opacity > styles[i - 1].opacity),
    ),
  );
  const s = fixture();
  s.growth.score = null;
  assert.equal(buildTrail(s).at(-1).point, null);
  assert.deepEqual(buildTrail(null), []);
  assert.throws(() => buildTrail(s, { cadence: "daily" }));
  assert.throws(() => buildTrail(s, { count: 10 }));
});
