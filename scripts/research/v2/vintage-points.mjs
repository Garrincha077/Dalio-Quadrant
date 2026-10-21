import { clean } from "../../../lib/model.mjs";
export function vintagePoints(source, id, cutoff, chicago = []) {
  if (source?.availableCutoffs.includes(cutoff)) {
    const key = `${id}_${cutoff.replaceAll("-", "")}`;
    return clean(source.observations.map((p) => ({ date: p.date, value: p[key] })))
      .filter((p) => p.date <= cutoff);
  }
  if (id === "CFNAIMA3") {
    const release = chicago.filter((p) => p.releasedAt <= cutoff)
      .sort((a,b) => a.releasedAt.localeCompare(b.releasedAt)).at(-1);
    if (release) return clean(release.observations).filter((p) => p.date <= cutoff);
  }
  return [];
}
