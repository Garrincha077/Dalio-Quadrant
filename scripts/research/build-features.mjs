import { readFile, writeFile } from "node:fs/promises";
import {
  DEFINITIONS,
  clean,
  transform,
  summarizeAxis,
} from "../../lib/model.mjs";
const root = new URL("../../work/research/", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("vintage-manifest.json", root), "utf8"),
);
if (manifest.failures.length)
  throw new Error(
    "Resolve failed vintage source fetches before building research features",
  );
const data = {};
for (const id of manifest.series) {
  data[id] = JSON.parse(
    await readFile(new URL(`fred/${id}.json`, root), "utf8"),
  ).data.observations;
}
const defs = DEFINITIONS.filter((d) =>
  ["growth", "inflation"].includes(d.group),
);
const rows = manifest.cutoffs.map((cutoff, index) => {
  const key = cutoff.replaceAll("-", ""),
    now = new Date(cutoff + "T23:59:59Z");
  const points = (id) =>
    clean(
      data[id].map((r) => ({ date: r.date, value: r[`${id}_${key}`] })),
    ).filter((r) => r.date <= cutoff);
  const indicators = defs.map((def) => transform(def, points(def.series), now));
  const g = summarizeAxis(indicators, "growth"),
    i = summarizeAxis(indicators, "inflation");
  const byId = Object.fromEntries(indicators.map((d) => [d.id, d]));
  const average = (ids) => {
    const values = ids.map((id) => byId[id].score).filter(Number.isFinite);
    return values.length >= 2
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;
  };
  const level = (id) => points(id).at(-1)?.value ?? null;
  const policy = transform(
    {
      id: "policy",
      series: "FEDFUNDS",
      frequency: "monthly",
      transform: "level",
      maxAge: 80,
    },
    points("FEDFUNDS"),
    now,
  );
  return {
    tradeDate: manifest.tradingDates[index],
    cutoff,
    g: g.score,
    i: i.score,
    gCoverage: g.coverage,
    iCoverage: i.coverage,
    core_g: average(["gdp", "production", "payrolls"]),
    core_i: average(["pce", "cpi"]),
    gdp_yoy: byId.gdp.value,
    pce_yoy: byId.pce.value,
    curve:
      level("GS10") !== null && level("GS2") !== null
        ? level("GS10") - level("GS2")
        : null,
    policy_change3: policy.delta,
    nfci: level("NFCI"),
    cash_yield: level("TB3MS"),
    deltas: Object.fromEntries(
      indicators.map((d) => [d.id, d.status === "ok" ? d.delta : null]),
    ),
    inputDates: Object.fromEntries(indicators.map((d) => [d.id, d.date])),
  };
});
await writeFile(
  new URL("features.json", root),
  JSON.stringify(
    {
      source: "ALFRED output_type=2; known vintage at cutoff",
      generatedAt: new Date().toISOString(),
      definitions: defs,
      rows,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    rows: rows.length,
    first: rows[0].cutoff,
    last: rows.at(-1).cutoff,
    validOriginalQuadrants: rows.filter(
      (r) => Number.isFinite(r.g) && Number.isFinite(r.i),
    ).length,
    firstOriginalQuadrant: rows.find(
      (r) => Number.isFinite(r.g) && Number.isFinite(r.i),
    )?.cutoff,
    missingSources: manifest.failures,
  }),
);
