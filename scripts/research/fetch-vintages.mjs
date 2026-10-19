import { readFile, writeFile, mkdir } from "node:fs/promises";
import { DEFINITIONS } from "../../lib/model.mjs";
const root = new URL("../../work/research/", import.meta.url);
await mkdir(new URL("fred/", root), { recursive: true });
if (!process.env.FRED_API_KEY)
  throw new Error("FRED_API_KEY is required server-side");
const asOf =
  process.argv.find((a) => a.startsWith("--as-of="))?.slice(8) ||
  new Date().toISOString().slice(0, 10);
const prices = (await readFile(new URL("prices/SPY.csv", root), "utf8"))
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => line.split(",")[0])
  .filter((d) => d >= "2003-01-01" && d.slice(0, 7) < asOf.slice(0, 7))
  .sort();
const dates = prices.map((d) =>
  new Date(Date.parse(d) - 86400000).toISOString().slice(0, 10),
);
const ids = [
  ...DEFINITIONS.filter((d) => ["growth", "inflation"].includes(d.group)).map(
    (d) => d.series,
  ),
  "NFCI",
  "GS10",
  "GS2",
  "FEDFUNDS",
  "TB3MS",
];
async function request(path, params) {
  const u = new URL("https://api.stlouisfed.org/fred/" + path);
  u.search = new URLSearchParams({
    ...params,
    api_key: process.env.FRED_API_KEY,
    file_type: "json",
  });
  const r = await fetch(u, { signal: AbortSignal.timeout(90000) });
  const j = await r.json();
  if (!r.ok)
    throw new Error(
      String(j.error_message || r.status).replaceAll(
        process.env.FRED_API_KEY,
        "[redacted]",
      ),
    );
  return j;
}
let cursor = 0,
  failures = [];
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (cursor < ids.length) {
      const id = ids[cursor++],
        file = new URL(`fred/${id}.json`, root);
      try {
        try {
          const cached = JSON.parse(await readFile(file, "utf8"));
          if (cached.cutoffs?.join() === dates.join()) {
            console.log(id, "cached", cached.data.observations.length);
            continue;
          }
        } catch {}
        let validDates = dates;
        const first = await request("series/vintagedates", {
          series_id: id,
          sort_order: "asc",
          limit: "1",
        });
        if (first.vintage_dates?.[0])
          validDates = dates.filter((d) => d >= first.vintage_dates[0]);
        let data;
        if (id === "NFCI") {
          const merged = new Map();
          for (let k = 0; k < validDates.length; k += 36) {
            const chunk = await request("series/observations", {
              series_id: id,
              observation_start: "2000-01-01",
              vintage_dates: validDates.slice(k, k + 36).join(","),
              output_type: "2",
              limit: "100000",
              sort_order: "asc",
            });
            for (const row of chunk.observations || []) {
              merged.set(row.date, { ...merged.get(row.date), ...row });
            }
          }
          const observations = [...merged.values()].sort((a, b) =>
            a.date.localeCompare(b.date),
          );
          data = { count: observations.length, observations };
        } else
          data = await request("series/observations", {
            series_id: id,
            observation_start: "2000-01-01",
            vintage_dates: validDates.join(","),
            output_type: "2",
            limit: "100000",
            sort_order: "asc",
          });
        if (data.count !== data.observations?.length)
          throw new Error("Truncated vintage response");
        await writeFile(
          file,
          JSON.stringify({
            series: id,
            cutoffs: dates,
            availableCutoffs: validDates,
            fetchedAt: new Date().toISOString(),
            source: "https://fred.stlouisfed.org/series/" + id,
            data,
          }),
        );
        console.log(
          id,
          data.observations.length,
          "reference rows",
          validDates.length,
          "vintages",
        );
      } catch (e) {
        failures.push(id);
        console.log(id, "FAILED", String(e.message).slice(0, 180));
      }
    }
  }),
);
await writeFile(
  new URL("vintage-manifest.json", root),
  JSON.stringify(
    { asOf, cutoffs: dates, tradingDates: prices, series: ids, failures },
    null,
    2,
  ),
);
if (failures.length) process.exitCode = 1;
