// Independent implementation against actual inputs, not Python builder helpers.
import fs from "node:fs";
import assert from "node:assert/strict";
import { classifyEconomicState } from "../../lib/economic-state.mjs";
const data = JSON.parse(fs.readFileSync("data/state-forward.json", "utf8"));
const raw = JSON.parse(
  fs
    .readFileSync("work/state-history-sources.json", "utf8")
    .replace(/^\uFEFF/, ""),
);
const source = (key) =>
  new Map(
    raw[key].observations
      .filter((d) => d.value !== ".")
      .map((d) => [d.date.slice(0, 7), Number(d.value)]),
  );
const activity = source("CFNAIMA3"),
  pce = source("PCEPI");
const shift = (m, n) =>
  new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1))
    .toISOString()
    .slice(0, 7);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
const prices = {};
for (const asset of Object.keys(data.assets)) {
  const rows = fs
    .readFileSync(`work/research/prices/${asset}.csv`, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((s) => s.split(","));
  const index = rows.shift().indexOf("adjusted close");
  prices[asset] = new Map(
    rows
      .filter((r) => r[0].slice(0, 7) < data.asOf.slice(0, 7))
      .map((r) => [r[0].slice(0, 7), Number(r[index])]),
  );
}
let verified = 0;
for (const point of data.points) {
  close(point.activity, activity.get(point.month));
  close(
    point.inflation,
    100 * (pce.get(point.month) / pce.get(shift(point.month, -12)) - 1),
  );
  assert.equal(
    point.quadrant,
    classifyEconomicState(point.activity, point.inflation).id,
  );
  for (const lag of data.lags)
    for (const asset of Object.keys(prices))
      for (let i = 0; i < 3; i++) {
        const h = data.horizons[i],
          entry = shift(point.month, lag),
          exit = shift(entry, h),
          map = prices[asset];
        const valid = Array.from({ length: h + 1 }, (_, k) =>
          map.has(shift(entry, k)),
        ).every(Boolean);
        const r = point.returns[lag][asset][i];
        if (valid) close(r, map.get(exit) / map.get(entry) - 1);
        else assert.equal(r, null);
        verified++;
      }
}
for (const lag of data.lags)
  for (let i = 0; i < 3; i++)
    for (const mode of ["asset", "common"])
      for (const asset of Object.keys(prices)) {
        const points = data.points.filter((p) =>
          mode === "common"
            ? Object.values(p.returns[lag]).every((v) => Number.isFinite(v[i]))
            : Number.isFinite(p.returns[lag][asset][i]),
        );
        const result = data.cohorts[lag][data.horizons[i]][mode][asset];
        assert.equal(result.n, points.length);
        assert.equal(result.first, points[0].month);
        assert.equal(result.last, points.at(-1).month);
        const mean =
          points.reduce((s, p) => s + p.returns[lag][asset][i], 0) /
          points.length;
        close(result.mean, mean);
        for (const [q, cell] of Object.entries(result.cells)) {
          const values = points
            .filter((p) => p.quadrant === q)
            .map((p) => p.returns[lag][asset][i])
            .sort((a, b) => a - b);
          assert.equal(cell.n, values.length);
          if (!values.length) continue;
          const m = values.reduce((s, v) => s + v, 0) / values.length;
          close(cell.mean, m);
          close(cell.lift, m - mean);
          const middle = Math.floor(values.length / 2);
          close(
            cell.median,
            values.length % 2
              ? values[middle]
              : (values[middle - 1] + values[middle]) / 2,
          );
          close(
            cell.positive,
            values.filter((v) => v > 0).length / values.length,
          );
        }
      }
console.log(
  JSON.stringify(
    {
      verifiedStates: data.points.length,
      verifiedPointAssetHorizonOutcomes: verified,
      verifiedCohorts: 60,
      status:
        "Independent state classification, exact returns, cohorts, means, medians and positive rates agree",
    },
    null,
    2,
  ),
);
