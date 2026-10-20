// Independent JS arithmetic against private source prices; no backtest.py helpers.
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const root = new URL("../../", import.meta.url);
const s = JSON.parse(
  await readFile(new URL("data/research-summary.json", root), "utf8"),
);
const csv = (
  await readFile(new URL("work/research/prices/SPY.csv", root), "utf8")
)
  .trim()
  .split(/\r?\n/);
const headers = csv.shift().split(","),
  priceIndex = headers.indexOf("adjusted close");
const p = csv
  .map((r) => r.split(","))
  .map((r) => ({ date: r[0], value: Number(r[priceIndex]) }))
  .sort((a, b) => a.date.localeCompare(b.date));
const months = p.filter(
  (r) => r.date >= "2020-12-01" && r.date <= "2025-12-31",
);
assert.equal(months.length, 61);
let wealth = 1,
  peak = 1,
  worst = 0;
for (let i = 1; i < months.length; i++) {
  const ret = months[i].value / months[i - 1].value - 1 - (i === 1 ? 0.001 : 0);
  wealth *= 1 + ret;
  peak = Math.max(peak, wealth);
  worst = Math.min(worst, wealth / peak - 1);
}
const result = s.results.find((r) => r.name === "SPY buy & hold");
assert.ok(Math.abs(result.cagr - (wealth ** 0.2 - 1)) < 1e-12);
assert.ok(Math.abs(result.maxDrawdown - worst) < 1e-12);
const features = JSON.parse(
  await readFile(new URL("work/research/features.json", root), "utf8"),
);
for (const r of features.rows) {
  assert.ok(r.cutoff < r.tradeDate);
  for (const date of Object.values(r.inputDates))
    assert.ok(!date || date <= r.cutoff);
}
const receipt = {
  validatedAt: new Date().toISOString(),
  independentSPYCagr: wealth ** 0.2 - 1,
  independentSPYMaxDrawdown: worst,
  holdingMonths: 60,
  macroCutoffsChecked: features.rows.length,
  source:
    "Alpha Vantage monthly adjusted SPY; independent Node compounding and drawdown",
};
await writeFile(
  new URL("work/research/validation.json", root),
  JSON.stringify(receipt, null, 2),
);
console.log(JSON.stringify(receipt));
