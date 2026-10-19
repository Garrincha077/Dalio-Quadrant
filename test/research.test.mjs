import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const data = JSON.parse(
  await readFile(
    new URL("../data/research-summary.json", import.meta.url),
    "utf8",
  ),
);
test("published performance reconciles with five compound annual returns, with equal holdout samples", () => {
  assert.equal(data.results.length, 13);
  assert.equal(
    data.conditionalReturns.reduce((n, r) => n + r.n, 0),
    60,
  );
  for (const result of data.results) {
    assert.equal(result.months, 60);
    const years = data.annualReturns.filter((r) => r.strategy === result.name);
    assert.deepEqual(
      years.map((r) => r.year),
      [2021, 2022, 2023, 2024, 2025],
    );
    const wealth = years.reduce((v, r) => v * (1 + r.return), 1);
    assert.ok(Math.abs(wealth - 1 - result.totalReturn) < 1e-12);
    assert.ok(Math.abs(wealth ** 0.2 - 1 - result.cagr) < 1e-12);
    assert.ok(result.cagrAt25bps <= result.cagr + 1e-12);
    assert.ok(result.maxDrawdown <= 0);
  }
});
test("research does not claim a confirmed edge when its paired interval includes zero", () => {
  for (const r of data.results.filter((r) => r.advantageVsSPY)) {
    const ci = r.advantageVsSPY;
    assert.equal(ci.confirmedPositive, ci.lower95 > 0);
    assert.ok(ci.lower95 < ci.upper95);
  }
  assert.equal(data.latestPrediction.allResearchOnly, true);
  assert.ok(data.latestPrediction.asOf < data.latestPrediction.tradeDate);
  assert.ok(data.developmentLabelsEnd < data.holdoutStart);
  for (const r of data.vintageExamples)
    for (const date of Object.values(r.inputDates))
      assert.ok(!date || date <= r.cutoff);
});
test("research protocol matches its published digest", async () => {
  const bytes = await readFile(
    new URL("../scripts/research/protocol.md", import.meta.url),
  );
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    data.protocolSha256,
  );
});
