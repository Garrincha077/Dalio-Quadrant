import { readFile, writeFile } from "node:fs/promises";
import { DEFINITIONS, clean, transform, summarizeAxis } from "../../../lib/model.mjs";
import { STATE_DEFINITIONS } from "../../../lib/economic-state.mjs";
import { buildStateHistory } from "../../../lib/state-history.mjs";
import { stateTrend } from "../../../lib/state-tilt.mjs";
import { vintagePoints } from "./vintage-points.mjs";

const work = new URL("../../../work/research-v2/", import.meta.url);
const read = async (path) => JSON.parse(await readFile(new URL(path, work), "utf8"));
const manifest = await read("source-manifest.json");
if (manifest.failures.some((f) => manifest.series.includes(f.id)))
  throw new Error("A required macro source failed. Keep the previous verified research until acquisition succeeds.");
const defs = DEFINITIONS.filter((d) => ["growth", "inflation"].includes(d.group));
const raw = {};
for (const id of manifest.series) {
  try { raw[id] = await read(`fred/${id}.json`); } catch { raw[id] = null; }
}
let chicago = [];
try { chicago = await read("chicago-vintages.json"); } catch {}
const finite = Number.isFinite;

function points(id, cutoff, revised = false) {
  const source = raw[id];
  if (revised) return clean(source?.latest || []).filter((p) => p.date <= cutoff);
  return vintagePoints(source, id, cutoff, chicago);
}

function row(cutoff, tradeDate, revised = false) {
  const now = new Date(`${cutoff}T23:59:59Z`);
  const indicators = defs.map((d) => transform(d, points(d.series, cutoff, revised), now));
  const growth = summarizeAxis(indicators, "growth");
  const inflation = summarizeAxis(indicators, "inflation");
  const a = points("CFNAIMA3", cutoff, revised), p = points("PCEPI", cutoff, revised);
  const history = buildStateHistory(a, p, now).history;
  const pair = history.filter((p) => finite(p.activity) && finite(p.inflation)).at(-1);
  // Compare the newest complete same-month pair; never carry an old state indefinitely.
  const stateAge = pair ? (now - Date.UTC(Number(pair.date.slice(0, 4)), Number(pair.date.slice(5, 7)), 0, 23, 59, 59)) / 86400000 : Infinity;
  const validState = !!pair && stateAge <= 90;
  const trend = validState ? stateTrend(history, pair.date.slice(0, 7)) : null;
  const cash = points("TB3MS", cutoff, revised).at(-1);
  const cashAge = cash ? (now - new Date(`${cash.date}T00:00:00Z`)) / 86400000 : Infinity;
  return {
    cutoff, tradeDate, basis: revised ? "latest-revised" : "point-in-time",
    activity: validState ? pair.activity : null,
    inflationGap: validState ? pair.inflation - 2 : null,
    stateMonth: validState ? pair.date.slice(0, 7) : null,
    stateAgeDays: finite(stateAge) ? stateAge : null,
    stateTrend: trend?.key || null,
    growth: growth.score, inflation: inflation.score,
    growthCoverage: growth.coverage, inflationCoverage: inflation.coverage,
    cashYield: cashAge <= 90 ? cash.value : null,
    inputDates: Object.fromEntries(indicators.map((d) => [d.series, d.status === "ok" ? d.date : null])),
    source: revised ? "FRED revised history" : (raw.CFNAIMA3?.availableCutoffs.includes(cutoff) ? "ALFRED" : "ALFRED + original Chicago Fed release"),
  };
}

const rows = manifest.cutoffs.map((d, i) => row(d, manifest.tradingDates[i]));
await writeFile(new URL("features.json", work), JSON.stringify({
  version: "features-v2", asOf: manifest.asOf, definitions: defs,
  sourceHashes: manifest.sources, rows,
}));

const state = buildStateHistory(points("CFNAIMA3", manifest.asOf, true), points("PCEPI", manifest.asOf, true), new Date(`${manifest.asOf}T23:59:59Z`));
const revised = state.history.map((p) => {
  const end = new Date(Date.UTC(Number(p.date.slice(0, 4)), Number(p.date.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const r = row(end, end, true);
  return { month: p.date.slice(0, 7), activity: p.activity, inflationGap: finite(p.inflation) ? p.inflation - 2 : null, growth: r.growth, inflation: r.inflation };
});
await writeFile(new URL("revised-history.json", work), JSON.stringify({
  asOf: manifest.asOf, basis: "Latest-revised reference periods; CFNAI was not published before March 2001", points: revised,
}));
console.log(JSON.stringify({ rows: rows.length, validState: rows.filter((r) => finite(r.activity)).length,
  validMomentum: rows.filter((r) => finite(r.growth) && finite(r.inflation)).length,
  firstState: rows.find((r) => finite(r.activity))?.cutoff,
  firstMomentum: rows.find((r) => finite(r.growth) && finite(r.inflation))?.cutoff,
  revisedHistory: revised.length }));
