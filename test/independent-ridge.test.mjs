import test from "node:test";
import assert from "node:assert/strict";
import { ridgeForecast, solve } from "../scripts/research/v3/independent-math.mjs";

test("independent ridge matches a manually solvable regularised one-feature example", () => {
  // Symmetric x gives sum(standardised x²)=3 and x_test*X'y=3.
  const prediction = ridgeForecast([[-1], [0], [1]], [1, 2, 3], [1], 100);
  assert.ok(Math.abs(prediction - (2 + 3 / 103)) < 1e-12);
  const translated = ridgeForecast([[9], [10], [11]], [8, 9, 10], [11], 100);
  assert.ok(Math.abs(translated - prediction - 7) < 1e-12);
});
test("independent solver uses a stable pivot and refuses missing regression data", () => {
  const result = solve([[0, 2], [1, 1]], [4, 3]);
  assert.deepEqual(result, [1, 2]);
  assert.throws(() => ridgeForecast([[1], [null]], [1, 2], [3]), /Incomplete/);
});
