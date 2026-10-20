import test from "node:test";
import assert from "node:assert/strict";
import {
  clean,
  yoy,
  transform,
  netLiquidity,
  atOrBefore,
  summarizeAxis,
  classify,
  buildSnapshot,
} from "../lib/model.mjs";
const approx = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
test("GDP YoY uses the same quarter a year earlier, not a quarterly annualized rate", () => {
  const points = clean([
    { date: "2025-04-01", value: "100" },
    { date: "2026-01-01", value: "105" },
    { date: "2026-04-01", value: "110" },
  ]);
  approx(yoy(points, "2026-04-01", "quarterly"), 10);
});
test("missing year-earlier month cannot borrow a nearby month or become a level", () => {
  const points = clean([
    { date: "2025-08-01", value: "100" },
    { date: "2026-09-01", value: "110" },
  ]);
  const result = transform(
    { frequency: "monthly", transform: "yoy", maxAge: 80, scale: 0.5 },
    points,
    new Date("2026-10-15"),
  );
  assert.equal(result.value, null);
  assert.equal(result.status, "missing");
  assert.equal(result.score, null);
});
test("quarterly freshness starts at quarter end, so the normal published quarter is retained", () => {
  const points = clean([
    { date: "2025-01-01", value: "100" },
    { date: "2025-04-01", value: "100" },
    { date: "2026-01-01", value: "102" },
    { date: "2026-04-01", value: "103" },
  ]);
  const result = transform(
    { frequency: "quarterly", transform: "yoy", maxAge: 130, scale: 0.75 },
    points,
    new Date("2026-10-15"),
  );
  assert.equal(result.status, "ok");
  assert.notEqual(result.score, null);
});
test("weekly credit growth requires 52 weeks even if the latest 16 weeks exist", () => {
  const short = Array.from({ length: 16 }, (_, i) => ({
    date: new Date(Date.parse("2026-10-07") - 7 * (15 - i) * 86400000)
      .toISOString()
      .slice(0, 10),
    value: 100 + i,
  }));
  assert.equal(yoy(short, "2026-10-07", "weekly"), null);
  approx(
    yoy([{ date: "2025-10-08", value: 100 }, ...short], "2026-10-07", "weekly"),
    15,
  );
});
test("a high but falling inflation rate scores negative", () => {
  const points = clean([
    { date: "2025-06-01", value: "100" },
    { date: "2025-09-01", value: "100" },
    { date: "2026-06-01", value: "105" },
    { date: "2026-09-01", value: "104" },
  ]);
  const result = transform(
    { frequency: "monthly", transform: "yoy", maxAge: 80, scale: 0.5 },
    points,
    new Date("2026-10-15"),
  );
  approx(result.value, 4);
  approx(result.previous, 5);
  assert.equal(result.score, -1);
});
test("stale inputs are visible but excluded from scores", () => {
  const points = clean([
    { date: "2024-06-01", value: "100" },
    { date: "2024-09-01", value: "100" },
    { date: "2025-06-01", value: "105" },
    { date: "2025-09-01", value: "104" },
  ]);
  const result = transform(
    { frequency: "monthly", transform: "yoy", maxAge: 80, scale: 0.5 },
    points,
    new Date("2026-10-15"),
  );
  assert.equal(result.status, "stale");
  assert.equal(result.score, null);
  approx(result.value, 4);
});
test("date alignment cannot select a future observation", () => {
  assert.equal(
    atOrBefore([{ date: "2026-10-08", value: 9 }], "2026-10-07"),
    null,
  );
  assert.equal(
    atOrBefore([{ date: "2026-09-01", value: 9 }], "2026-10-07"),
    null,
  );
});
test("liquidity converts BOTH millions series to billions before subtracting RRP", () => {
  const dates = ["2025-10-08", "2026-07-08", "2026-10-07"];
  const obs = (values) => ({
    observations: values.map((value, i) => ({
      date: dates[i],
      value: String(value),
    })),
  });
  const result = netLiquidity(
    {
      WALCL: obs([8000000, 8000000, 8000000]),
      WTREGEN: obs([1000000, 900000, 800000]),
      RRPONTSYD: obs([500, 400, 300]),
    },
    new Date("2026-10-15"),
  );
  assert.equal(result.level, 6900);
  approx(result.value, (6900 / 6500 - 1) * 100);
});
test("coverage uses configured weights; a sparse subset cannot claim a regime", () => {
  const result = summarizeAxis(
    [
      { group: "growth", weight: 3, score: null },
      { group: "growth", weight: 1, score: 1 },
    ],
    "growth",
  );
  assert.equal(result.coverage, 0.25);
  assert.equal(result.score, null);
  assert.equal(classify(result.score, 1).id, "unavailable");
});
test("transition band prevents a hard label near either axis", () => {
  assert.equal(classify(0.5, 0.08).id, "transition");
  assert.equal(classify(-0.4, -0.3).id, "deflation");
});
test("market yield changes use basis points, not percent returns; missing values skipped", () => {
  const snapshot = buildSnapshot(
    {
      DGS10: {
        observations: [
          { date: "2026-09-14", value: "4" },
          { date: "2026-10-13", value: "." },
          { date: "2026-10-14", value: "4.25" },
        ],
      },
    },
    new Date("2026-10-15"),
  );
  const row = snapshot.market.find((d) => d.id === "treasury");
  assert.equal(row.change, 25);
  assert.equal(row.changeUnit, "bp");
});
test("empty source never generates a regime from example numbers", () => {
  const s = buildSnapshot({}, new Date("2026-10-15"));
  assert.equal(s.regime.id, "unavailable");
  assert.equal(s.growth.coverage, 0);
  assert.equal(s.warnings[0].triggered, null);
});
