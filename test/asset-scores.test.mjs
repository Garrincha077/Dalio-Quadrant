import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { scoreDescription, standardScore, compareScoreModels } from "../lib/asset-scores.mjs";
import { rankIC } from "../lib/research-evidence.mjs";

test("price distance and value orientation retain different meanings", () => {
  assert.equal(standardScore(4, [1, 2, 3]), 2);
  assert.equal(standardScore(4, [1, 2, 3], -1), -2);
  assert.equal(standardScore(4, [2, 2, 2]), null);
  assert.equal(standardScore(4, [1, null, 3]), null);
  assert.match(scoreDescription(2, "price"), /Above historical price/);
  assert.match(scoreDescription(2, "value"), /cheaper/);
  assert.equal(scoreDescription(null, "value"), "Unavailable");
});

test("model display uses only the shared cohort and never mutates estimates", () => {
  const rows = [{common: true, predictions: {macro: [1, 2, 3], full: [3, 2, 1]}, outcomes: [1, 2, 3]},
    {common: false, predictions: {macro: [1, 2, 3], full: [3, 2, 1]}, outcomes: [3, 2, 1]}];
  const before = JSON.stringify(rows);
  const result = compareScoreModels({models: {macro: {}, full: {}}}, rows, rankIC);
  assert.equal(result[0].meanRankIC, 1);
  assert.equal(result[1].meanRankIC, -1);
  assert.equal(result[0].n, 1);
  assert.equal(JSON.stringify(rows), before);
});

test("published value/price study pins its protocol and independently reconciles matched rankings", async () => {
  const d = JSON.parse(await readFile(new URL("../data/asset-scores.json", import.meta.url)));
  const protocol = await readFile(new URL("../scripts/research/v3/protocol.md", import.meta.url));
  assert.equal(createHash("sha256").update(protocol).digest("hex"), d.protocolSha256);
  assert.equal(d.audit.status, "Actual-source reconstruction passed");
  assert.equal(d.audit.checkedProtocolSha256, d.protocolSha256);
  assert.equal(d.audit.checkedInputSha256, d.inputSha256);
  assert.equal(d.status, "retrospective-walk-forward");
  assert.ok(d.audit.scoreChecks > 0 && d.audit.forecastChecks > 0 && d.audit.strategyChecks > 0);
  for (const main of Object.values(d.horizons)) for (const study of [main, main.priceOnly]) {
    assert.equal(new Set(Object.values(study.models).map((m) => m.n)).size, 1);
    for (const result of compareScoreModels(study, study.forecastRows, rankIC)) {
      const expected = study.models[result.model];
      assert.equal(result.n, expected.n);
      if (expected.n) assert.ok(Math.abs(result.meanRankIC - expected.meanRankIC) < 1e-12);
    }
    for (const r of study.forecastRows) assert.ok(r.training >= 60 && r.cutoff < r.tradeDate);
    for (const t of main.priceOnly.comparisons) assert.equal(t.exploratory, true);
  }
});

test("missing sources cannot turn into neutral value scores or a completed full study", async () => {
  const d = JSON.parse(await readFile(new URL("../data/asset-scores.json", import.meta.url)));
  assert.equal(d.sourceStatus, d.sourceFailures.length ? "partial" : "complete");
  for (const row of [...d.scoreHistory, d.latest]) for (const asset of d.assets) for (const kind of ["value", "price"]) {
    const score = row.assets[asset][kind];
    if (score.z === null) assert.ok(score.reason);
    else {
      assert.ok(score.n >= (asset === "SPY" && kind === "value" ? 20 : 60));
      assert.ok(score.periodEnd <= row.cutoff);
      assert.ok(score.ageDays >= 0 && score.ageDays <= (asset === "SPY" && kind === "value" ? 185 : 90));
      assert.ok(score.percentile >= 0 && score.percentile <= 100);
    }
  }
  if (d.sourceStatus === "partial" && d.sourceFailures.some((s) => s.id === "NFCPATAX")) {
    for (const h of Object.values(d.horizons)) assert.equal(h.models.full.n, 0);
    for (const row of d.scoreHistory) assert.equal(row.assets.SPY.value.z, null);
  }
});
