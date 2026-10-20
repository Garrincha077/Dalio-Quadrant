import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { selectedForwardPoint } from "../forward-view.mjs";

const data = JSON.parse(
  await readFile(new URL("../data/state-forward.json", import.meta.url)),
);
test("forward cohorts retain exact mature dates and identical asset samples", () => {
  for (const lag of [0, 2])
    for (const horizon of [3, 12, 36]) {
      const cohort = data.cohorts[lag][horizon].common;
      for (const r of Object.values(cohort)) {
        assert.equal(r.n, cohort.SPY.n);
        assert.equal(r.first, cohort.SPY.first);
        assert.equal(r.last, cohort.SPY.last);
        assert.equal(
          Object.values(r.cells).reduce((s, c) => s + c.n, 0),
          r.n,
        );
      }
    }
  assert.equal(data.cohorts[0][36].common.SPY.last, "2023-09");
  assert.equal(data.cohorts[2][12].common.SPY.last, "2025-07");
});
test("current unfinished outcomes and early unavailable prices remain null", () => {
  for (const lag of [0, 2])
    for (const vals of Object.values(data.points.at(-1).returns[lag]))
      assert.deepEqual(vals, [null, null, null]);
  assert.deepEqual(data.points[0].returns[0].SPY, [null, null, null]);
});
test("selected state never borrows a return for mixed or unavailable reference months", () => {
  const row = data.points.find((p) => p.month === "2020-04");
  const slot = {
    date: "2020-04-01",
    point: { ...row, activityDate: "2020-04-01", inflationDate: "2020-04-01" },
  };
  assert.equal(selectedForwardPoint(data, slot).row, row);
  assert.equal(selectedForwardPoint(data, slot).revised, false);
  assert.ok(
    selectedForwardPoint(data, {
      ...slot,
      point: { ...slot.point, inflationDate: "2020-03-01" },
    }).error,
  );
  assert.equal(
    selectedForwardPoint(data, {
      ...slot,
      point: { ...slot.point, activity: 0 },
    }).revised,
    true,
  );
  assert.ok(selectedForwardPoint(data, { point: null }).error);
});
