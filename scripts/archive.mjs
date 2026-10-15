import { mkdir, readFile, writeFile } from "node:fs/promises";
import { loadDashboard } from "../lib/fred.mjs";
import { appendArchive } from "../lib/archive.mjs";
if (!process.env.FRED_API_KEY)
  throw new Error("Set FRED_API_KEY for the scheduled archive.");
let previous = [];
try {
  previous = JSON.parse(await readFile("data/history.json", "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const snapshot = await loadDashboard(process.env.FRED_API_KEY, {
    archiveOnly: true,
  }),
  next = appendArchive(previous, snapshot);
if (next === previous) {
  console.log("No changed macro observations. Archive unchanged.");
} else {
  await mkdir("data", { recursive: true });
  await writeFile("data/history.json", JSON.stringify(next, null, 2) + "\n");
  console.log(
    `Archived observed macro dataset. Records: ${next.length}. No market-provider price history is republished.`,
  );
}
