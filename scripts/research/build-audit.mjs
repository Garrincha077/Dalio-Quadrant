import { readFile, writeFile } from "node:fs/promises";
import { reconstructPosition } from "../../lib/trail.mjs";
import { periodEnd } from "../../lib/model.mjs";
const s = JSON.parse(
  await readFile(new URL("../../work/snapshot.json", import.meta.url), "utf8"),
);
const cases = [
  [
    "2008-12-31",
    "Growth and inflation momentum fell during the NBER recession.",
  ],
  [
    "2009-09-30",
    "Recovery momentum improved while real GDP remained below its year-earlier level.",
  ],
  [
    "2020-04-30",
    "Both axes fell in the pandemic recession. NBER dated the trough later, in July 2021.",
  ],
  [
    "2020-09-30",
    "Recovery acceleration is not proof of an overheated economy; GDP YoY was still negative.",
  ],
  [
    "2022-06-30",
    "High inflation and near-zero inflation momentum coexist. Transition does not mean inflation was low.",
  ],
  [
    "2022-12-31",
    "Slowing inflation momentum coexisted with elevated inflation; neither axis establishes recession.",
  ],
];
const rows = cases.map(([date, interpretation]) => {
  const p = reconstructPosition(s.profiles, date);
  const level = (id) => {
    const d = s.profiles.find((d) => d.id === id);
    return (
      d.history.findLast(
        (r) =>
          periodEnd(r.date, d.frequency) <= Date.parse(date + "T23:59:59Z"),
      )?.value ?? null
    );
  };
  return {
    date,
    growth: p.growth.score,
    inflation: p.inflation.score,
    regime: p.regime.name,
    gdpYoy: level("gdp"),
    pceYoy: level("pce"),
    nberRecession: s.recessions.some(
      (r) => r.date.slice(0, 7) === date.slice(0, 7),
    ),
    interpretation,
  };
});
await writeFile(
  new URL("../../data/historical-audit.json", import.meta.url),
  JSON.stringify(
    {
      asOf: s.fetchedAt,
      method:
        "Latest revised complete reference periods; not a publication-vintage backtest. NBER recession labels are retrospective.",
      rows,
    },
    null,
    2,
  ),
);
console.log(`Wrote ${rows.length} historical economic checks`);
