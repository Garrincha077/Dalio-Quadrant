import { VERSION, MODEL_VERSION, isCompatibleSnapshot } from "./model.mjs";
import { compactPressure } from "./composite.mjs";
export function historyRecord(snapshot) {
  return {
    version: snapshot.version || VERSION,
    modelVersion: snapshot.modelVersion || MODEL_VERSION,
    fetchedAt: snapshot.fetchedAt,
    signature: snapshot.signature,
    growth: snapshot.growth,
    inflation: snapshot.inflation,
    regime: snapshot.regime,
    pressure: compactPressure(snapshot.pressure),
    context:
      snapshot.profiles?.map((p) => ({
        id: p.id,
        date: p.current?.date,
        scores: [5, 10, 20].map((y) => ({
          years: y,
          level: [
            p.windows[y].level.z,
            p.windows[y].level.robustZ,
            p.windows[y].level.percentile,
            p.windows[y].level.n,
          ],
          momentum: [
            p.windows[y].momentum.z,
            p.windows[y].momentum.robustZ,
            p.windows[y].momentum.percentile,
            p.windows[y].momentum.n,
          ],
        })),
      })) ?? snapshot.context,
    indicators: (snapshot.indicators || [])
      .filter((d) =>
        ["growth", "inflation", "credit", "debt"].includes(d.group),
      )
      .map((d) => ({
        ...d,
        source: `https://fred.stlouisfed.org/series/${d.series}`,
      })),
  };
}
export function appendArchive(records, snapshot) {
  if (
    snapshot.version !== VERSION ||
    snapshot.errors?.length ||
    !Number.isFinite(snapshot.growth.score) ||
    !Number.isFinite(snapshot.inflation.score)
  )
    throw new Error(
      "Archive requires a complete successful refresh and valid axes.",
    );
  const entry = historyRecord(snapshot);
  if (
    records.at(-1)?.signature === entry.signature &&
    isCompatibleSnapshot(records.at(-1))
  )
    return records;
  return [...records, entry].slice(-500);
}
