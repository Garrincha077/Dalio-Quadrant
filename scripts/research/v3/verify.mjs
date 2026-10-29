// Independent implementation: reconstruct native value/price measures and
// z-scores from private provider inputs, then publish only a checked candidate.
import { readFile, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { standardScore } from "../../../lib/asset-scores.mjs";
import { rankIC } from "../../../lib/research-evidence.mjs";
import { mean, ridgeForecast } from "./independent-math.mjs";
const root = new URL("../../../", import.meta.url);
const read = async (p) => JSON.parse(await readFile(new URL(p, root), "utf8"));
const hash = async (p) => createHash("sha256").update(await readFile(new URL(p, root))).digest("hex");
const data = await read("work/research-v3/research-candidate.json");
const source = await read("work/research-v3/source-manifest.json");
const base = await read("work/research-v2/features.json");
const valueFeatures = await read("work/research-v3/features.json");
assert.equal(await hash("scripts/research/v3/protocol.md"), data.protocolSha256);
assert.equal(await hash("work/research-v3/features.json"), data.inputSha256);
assert.equal(await hash("work/research-v3/source-manifest.json"), data.sourceManifestSha256);
assert.equal(await hash("work/research-v2/features.json"), source.baseFeatureSha256);
assert.equal(data.sourceStatus, source.failures.length ? "partial" : "complete");
const raw = {}, prices = {};
for (const s of source.sources) {
  assert.equal(await hash(`work/research-v3/fred/${s.id}.json`), s.sha256);
  raw[s.id] = await read(`work/research-v3/fred/${s.id}.json`);
}
for (const a of data.assets) {
  if (source.actions[a]) {
    assert.equal(await hash(`work/research-v2/prices/${a}.csv`), source.actions[a].priceSha256);
    assert.equal(await hash(`work/research-v3/actions/${a}.json`), source.actions[a].sha256);
  }
  const lines = (await readFile(new URL(`work/research-v2/prices/${a}.csv`, root), "utf8")).trim().split(/\r?\n/);
  const headers = lines.shift().split(",");
  prices[a] = lines.map((l) => {
    const r = l.split(",");
    return {date: r[0], month: r[0].slice(0, 7), close: Number(r[headers.indexOf("close")]), adjusted: Number(r[headers.indexOf("adjusted close")])};
  }).sort((a, b) => a.date.localeCompare(b.date));
}
const shift = (m, n) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1)).toISOString().slice(0, 7);
const end = (m) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).toISOString().slice(0, 10);
const close = (a, b, tol = 1e-9) => assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < tol, `Mismatch ${a} versus ${b}`);
const quarterIndex = (date) => Number(date.slice(0, 4)) * 4 + Math.floor((Number(date.slice(5, 7)) - 1) / 3);
const quarterMonth = (k) => `${Math.floor(k / 4)}-${String((k % 4) * 3 + 3).padStart(2, "0")}`;

function original(id, cutoff) {
  const s = raw[id];
  if (!s || !s.availableCutoffs.includes(cutoff)) return new Map();
  const key = `${id}_${cutoff.replaceAll("-", "")}`;
  return new Map(s.observations.filter((r) => r.date <= cutoff && r[key] !== "." && r[key] !== undefined && Number.isFinite(Number(r[key])))
    .map((r) => [r.date, Number(r[key])]));
}
function monthly(id, cutoff) {
  return new Map([...original(id, cutoff)].filter(([d]) => end(d.slice(0, 7)) <= cutoff).map(([d, v]) => [d.slice(0, 7), v]));
}
function quarters(id, cutoff, divisor = 1) {
  return new Map([...original(id, cutoff)].map(([d, v]) => [quarterIndex(d), v / divisor]).filter(([k]) => end(quarterMonth(k)) <= cutoff));
}
// Compare the latest reference quarter of both duplicates before reconciling
// their levels. A new release may revise Q1 while the old alias still stops at Q1.
for (const check of data.equityDuplicateAudit.checks) {
  const old = [...quarters("MVEONWMVBSNNCB", check.cutoff)], fresh = [...quarters("NCBEILQ027S", check.cutoff, 1000)];
  assert.equal(old.at(-1)[0], fresh.at(-1)[0]);
  close(Math.abs(old.at(-1)[1] / fresh.at(-1)[1] - 1), check.relativeDifference);
}
assert.equal(data.equityDuplicateAudit.n, data.equityDuplicateAudit.checks.length);
for (const check of data.equityDuplicateAudit.unmatchedPeriods || []) {
  const old = [...quarters("MVEONWMVBSNNCB", check.cutoff)], fresh = [...quarters("NCBEILQ027S", check.cutoff, 1000)];
  assert.notEqual(old.at(-1)[0], fresh.at(-1)[0]);
  const score = data.scoreHistory.find((r) => r.cutoff === check.cutoff)?.assets.SPY.value;
  assert.equal(score?.sourceLeg, "NCBEILQ027S");
}
function closes(asset, cutoff) {
  if (!source.actions[asset]) return new Map();
  return new Map(prices[asset].filter((r) => r.date <= cutoff && r.month < cutoff.slice(0, 7) && end(r.month) <= cutoff).map((r) => {
    let v = r.close;
    for (const s of source.actions[asset].splits) if (s.date <= cutoff && r.date < s.date) v /= s.numerator / s.denominator;
    return [r.month, v];
  }));
}
function ratio(a, b) {
  return new Map([...a].filter(([k, v]) => v > 0 && b.get(k) > 0).map(([k, v]) => [k, Math.log(v / b.get(k))]));
}
function measures(cutoff) {
  const cpi = monthly("CPIAUCSL", cutoff), newLeg = quarters("NCBEILQ027S", cutoff, 1000);
  const cap = newLeg.size ? newLeg : quarters("MVEONWMVBSNNCB", cutoff);
  const profits = quarters("NFCPATAX", cutoff), equity = new Map();
  for (const [k, v] of cap) {
    const trailing = [0, 1, 2, 3].map((lag) => profits.get(k - lag));
    if (v > 0 && trailing.every(Number.isFinite)) equity.set(k, 100 * trailing.reduce((s, x) => s + x, 0) / 4 / v);
  }
  return {SPY: equity, IEF: monthly("GS10", cutoff), TIP: monthly("FII10", cutoff),
    GLD: ratio(closes("GLD", cutoff), cpi), DBC: ratio(monthly("PPIACO", cutoff), cpi)};
}
let scoreChecks = 0, forecastChecks = 0, strategyChecks = 0, predictionChecks = 0, trainingChecks = 0;
function checkScore(published, values, cutoff, direction, years, quarterly, zKey) {
  const sorted = [...values].filter(([, v]) => Number.isFinite(v)).sort(([a], [b]) => a < b ? -1 : 1);
  if (!sorted.length) { assert.equal(published[zKey], null); return; }
  const [period, current] = sorted.at(-1), step = quarterly ? 4 : 12;
  const distance = (p) => quarterly ? period - p : (Number(period.slice(0, 4)) - Number(p.slice(0, 4))) * 12 + Number(period.slice(5, 7)) - Number(p.slice(5, 7));
  const prior = sorted.filter(([p]) => distance(p) > 0 && distance(p) <= years * step).map(([, v]) => v);
  const periodEnd = end(quarterly ? quarterMonth(period) : period);
  const age = (Date.parse(cutoff) - Date.parse(periodEnd)) / 86400000;
  const sufficient = prior.length >= (quarterly ? 20 : 60) && age >= 0 && age <= (quarterly ? 185 : 90);
  const z = sufficient ? standardScore(current, prior, direction) : null;
  if (z === null) assert.equal(published[zKey], null);
  else close(z, published[zKey]);
  if (years === 10) {
    close(current, published.level);
    assert.equal(published.n, prior.length);
    assert.equal(published.periodEnd, periodEnd);
    if (z !== null) {
      const percent = 100 * (prior.filter((v) => v < current).length + .5 * prior.filter((v) => v === current).length) / prior.length;
      close(published.percentile, direction === 1 ? percent : 100 - percent);
    }
  }
  scoreChecks++;
}
for (const row of [...data.scoreHistory, data.latest]) {
  const m = measures(row.cutoff);
  for (const a of data.assets) for (const years of [10, 20]) {
    checkScore(row.assets[a].value, m[a], row.cutoff, data.definitions[a].direction, years, a === "SPY", years === 10 ? "z" : "z20");
    checkScore(row.assets[a].price, new Map([...closes(a, row.cutoff)].map(([p, v]) => [p, Math.log(v)])), row.cutoff, 1, years, false, years === 10 ? "z" : "z20");
  }
}
for (const [h, main] of Object.entries(data.horizons)) for (const [studyIndex, study] of [main, main.priceOnly].entries()) {
  const months = base.rows.map((r) => r.tradeDate.slice(0, 7));
  const labelRows = base.rows.map((row, t) => {
    if (t + Number(h) >= base.rows.length || months[t + Number(h)] !== shift(months[t], Number(h))) return null;
    let cash = 1;
    for (let k = t; k < t + Number(h); k++) {
      if (!Number.isFinite(base.rows[k].cashYield) || months[k + 1] !== shift(months[k], 1)) return null;
      const days = (Date.parse(base.rows[k + 1].tradeDate) - Date.parse(base.rows[k].tradeDate)) / 86400000;
      cash *= (1 + base.rows[k].cashYield / 100) ** (days / 365);
    }
    const values = data.assets.map((a) => {
      const observations = Array.from({length: Number(h) + 1}, (_, k) => prices[a].find((p) => p.month === shift(months[t], k))?.adjusted);
      return observations.every(Number.isFinite) ? observations.at(-1) / observations[0] - cash : null;
    });
    return values.every(Number.isFinite) ? {values, matureAt: end(months[t + Number(h)])} : null;
  });
  const macro = base.rows.map((r) => [r.activity, r.inflationGap, r.growth, r.inflation]);
  const keys = Object.keys(study.models);
  const eligibility = (yearKey) => base.rows.map((_, i) => macro[i].every(Number.isFinite) && data.assets.every((a) =>
    Number.isFinite(valueFeatures.rows[i].assets[a].price[yearKey]) && (studyIndex === 1 || Number.isFinite(valueFeatures.rows[i].assets[a].value[yearKey]))));
  const eligible = eligibility("z"), eligible20 = eligibility("z20");
  const inputs = (i, a, model, yearKey) => [
    ...(["macro", "macro-value", "macro-price", "full"].includes(model) ? macro[i] : []),
    ...(["value", "macro-value", "full"].includes(model) ? [valueFeatures.rows[i].assets[a].value[yearKey]] : []),
    ...(["price", "macro-price", "full"].includes(model) ? [valueFeatures.rows[i].assets[a].price[yearKey]] : []),
  ];
  const independent = (t, train, yearKey) => Object.fromEntries(keys.map((model) => [model, data.assets.map((a, j) => {
    const target = train.map((i) => labelRows[i].values[j]);
    return model === "mean" ? mean(target) : ridgeForecast(train.map((i) => inputs(i, a, model, yearKey)), target, inputs(t, a, model, yearKey));
  })]));
  const sensitivity = Object.fromEntries(keys.map((m) => [m, []]));
  const matched = study.forecastRows.filter((r) => r.common);
  for (const row of study.forecastRows) {
    assert.ok(row.cutoff < row.tradeDate && row.training >= 60);
    const t = base.rows.findIndex((r) => r.tradeDate === row.tradeDate);
    assert.ok(eligible[t]);
    const train = base.rows.flatMap((_, i) => eligible[i] && labelRows[i] && labelRows[i].matureAt <= row.cutoff ? [i] : []);
    assert.equal(row.training, train.length); trainingChecks++;
    const recomputed = independent(t, train, "z");
    for (const model of keys) for (let a = 0; a < data.assets.length; a++) {
      close(recomputed[model][a], row.predictions[model][a]); predictionChecks++;
    }
    if (row.common && eligible20[t]) {
      const train20 = base.rows.flatMap((_, i) => eligible20[i] && labelRows[i] && labelRows[i].matureAt <= row.cutoff ? [i] : []);
      if (train20.length >= 60) {
        const p20 = independent(t, train20, "z20");
        for (const model of keys) sensitivity[model].push(rankIC(p20[model], labelRows[t].values));
      }
    }
    if (row.outcomes.every(Number.isFinite)) {
      const t = base.rows.findIndex((r) => r.tradeDate === row.tradeDate);
      let cash = 1;
      for (let k = t; k < t + Number(h); k++) {
        const days = (Date.parse(base.rows[k + 1].tradeDate) - Date.parse(base.rows[k].tradeDate)) / 86400000;
        cash *= (1 + base.rows[k].cashYield / 100) ** (days / 365);
      }
      for (const [i, a] of data.assets.entries()) {
        const start = prices[a].find((r) => r.month === row.month)?.adjusted;
        const finish = prices[a].find((r) => r.month === shift(row.month, Number(h)))?.adjusted;
        close(finish / start - cash, row.outcomes[i]); forecastChecks++;
      }
    }
  }
  for (const [m, stats] of Object.entries(study.models)) {
    assert.equal(stats.n, matched.length);
    if (matched.length) close(matched.reduce((s, r) => s + rankIC(r.predictions[m], r.outcomes), 0) / matched.length, stats.meanRankIC);
    assert.equal(sensitivity[m].length, study.sensitivity.n);
    if (sensitivity[m].length) close(mean(sensitivity[m]), study.sensitivity.twentyYears[m].meanRankIC);
  }
  for (const policy of Object.values(study.strategies)) {
    if (!policy?.available) continue;
    let previous = [1, 0, 0, 0, 0, 0], wealth = 1, peak = 1, dd = 0;
    for (const row of policy.rows) {
      const returns = [row.cash, ...data.assets.map((a) => prices[a].find((r) => r.month === row.month).adjusted / prices[a].find((r) => r.month === shift(row.month, -1)).adjusted - 1)];
      const cost = row.weights.slice(1).reduce((s, w, i) => s + Math.abs(w - previous[i + 1]) * .001, 0);
      const ret = row.weights.reduce((s, w, i) => s + w * returns[i], 0) - cost;
      close(cost, row.cost); close(ret, row.return); close(row.weights.reduce((s, w) => s + w, 0), 1);
      const grown = row.weights.map((w, i) => w * (1 + returns[i])), total = grown.reduce((s, v) => s + v, 0);
      previous = grown.map((v) => v / total);
      wealth *= 1 + ret; peak = Math.max(peak, wealth); dd = Math.min(dd, wealth / peak - 1); strategyChecks++;
    }
    close(wealth ** (12 / policy.rows.length) - 1, policy.cagr); close(dd, policy.maxDrawdown);
  }
}
data.audit = {status: "Actual-source reconstruction passed", scoreChecks, forecastChecks, strategyChecks, predictionChecks, trainingChecks,
  checkedProtocolSha256: data.protocolSha256, checkedInputSha256: data.inputSha256,
  sourceStatus: data.sourceStatus, missingSources: source.failures.map((f) => f.id)};
const temporary = new URL("data/asset-scores.json.tmp", root);
await writeFile(temporary, JSON.stringify(data));
await rename(temporary, new URL("data/asset-scores.json", root));
console.log(JSON.stringify(data.audit));
