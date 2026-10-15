import { mkdir, writeFile } from "node:fs/promises";
import { loadDashboard } from "../lib/fred.mjs";
if (!process.env.FRED_API_KEY)
  throw new Error("Set FRED_API_KEY before fetching observations.");
const snapshot = await loadDashboard(process.env.FRED_API_KEY);
await mkdir("work", { recursive: true });
await writeFile("work/snapshot.json", JSON.stringify(snapshot, null, 2));
console.log(
  JSON.stringify(
    {
      version: snapshot.version,
      seriesErrors: snapshot.errors,
      regime: snapshot.regime,
      growth: snapshot.growth,
      inflation: snapshot.inflation,
      indicators: snapshot.indicators.map((d) => ({
        id: d.id,
        value: d.value,
        date: d.date,
        status: d.status,
        delta: d.delta,
      })),
    },
    null,
    2,
  ),
);
