// Value and price have deliberately different meanings. Display thresholds are
// descriptors of historical distance, never allocation rules or probabilities.
export function scoreDescription(z, kind) {
  if (!Number.isFinite(z)) return "Unavailable";
  if (kind === "value") return z >= 1 ? "Relatively cheaper / higher yield" : z <= -1 ? "Relatively dearer / lower yield" : "Near historical reference";
  return z >= 1 ? "Above historical price reference" : z <= -1 ? "Below historical price reference" : "Near historical price reference";
}

export function standardScore(current, previous, direction = 1) {
  if (!Number.isFinite(current) || previous.length < 2 || !previous.every(Number.isFinite)) return null;
  const mean = previous.reduce((s, v) => s + v, 0) / previous.length;
  const sd = Math.sqrt(previous.reduce((s, v) => s + (v - mean) ** 2, 0) / (previous.length - 1));
  return sd > 1e-12 ? direction * (current - mean) / sd : null;
}

export function compareScoreModels(study, rows, rankIC) {
  const selected = rows.filter((r) => r.common && r.outcomes.every(Number.isFinite));
  return Object.keys(study.models).map((model) => {
    const valid = selected.filter((r) => r.predictions[model]?.every(Number.isFinite));
    const ics = valid.map((r) => rankIC(r.predictions[model], r.outcomes)).filter(Number.isFinite);
    const top = valid.map((r) => r.outcomes[r.predictions[model].indexOf(Math.max(...r.predictions[model]))]);
    return {model, n: valid.length,
      meanRankIC: ics.length ? ics.reduce((s, v) => s + v, 0) / ics.length : null,
      topAssetExcess: top.length ? top.reduce((s, v) => s + v, 0) / top.length : null};
  });
}
