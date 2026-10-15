import { VERSION } from "./model.mjs";
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
  const entry = {
    version: VERSION,
    fetchedAt: snapshot.fetchedAt,
    signature: snapshot.signature,
    growth: snapshot.growth,
    inflation: snapshot.inflation,
    regime: snapshot.regime,
    indicators: snapshot.indicators
      .filter((d) => ["growth", "inflation", "credit"].includes(d.group))
      .map((d) => ({
        ...d,
        source: `https://fred.stlouisfed.org/series/${d.series}`,
      })),
  };
  if (
    records.at(-1)?.signature === entry.signature &&
    records.at(-1)?.version === VERSION
  )
    return records;
  return [...records, entry].slice(-500);
}
