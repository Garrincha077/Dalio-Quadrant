// Shared presentation semantics. Date filters never change model fitting.
export const EVIDENCE_LABELS = Object.freeze({
  descriptive: "Historical association",
  "retrospective-walk-forward": "Retrospective predictive check",
  "forward-tracking": "Recorded forward forecast",
});
export const MODEL_LABELS = Object.freeze({
  state: "Static state", momentum: "Momentum", combined: "State + momentum",
  unconditional: "Historical average", "state-trend": "State + 3M trend",
});
export function filterResearchRows(rows, { period = "full", start = "", end = "" } = {}) {
  const last = rows.at(-1)?.month;
  const twenty = last ? `${Number(last.slice(0, 4)) - 20}-${last.slice(5)}` : "";
  return rows.filter((r) => (period !== "last20" || r.month > twenty) &&
    (period !== "custom" || ((!start || r.month >= start) && (!end || r.month <= end))));
}
export function rankIC(predicted, actual) {
  if (!predicted?.every(Number.isFinite) || !actual?.every(Number.isFinite)) return null;
  const rank = (values) => values.map((v) => 1 + values.filter((x) => x < v).length +
    (values.filter((x) => x === v).length - 1) / 2);
  const x = rank(predicted), y = rank(actual), mean = (a) => a.reduce((s,v) => s+v,0)/a.length;
  const mx = mean(x), my = mean(y);
  const cov = x.reduce((s,v,i) => s+(v-mx)*(y[i]-my),0);
  const denom = Math.sqrt(x.reduce((s,v) => s+(v-mx)**2,0)*y.reduce((s,v) => s+(v-my)**2,0));
  return denom ? cov/denom : null;
}
export function evaluateRankingRows(rows, model) {
  const selected = rows.filter((r) => r.common && r.predictions[model]?.every(Number.isFinite) && r.outcomes?.every(Number.isFinite));
  const values = selected.map((r) => rankIC(r.predictions[model], r.outcomes)).filter(Number.isFinite);
  return { n: selected.length, first: selected[0]?.month || null, last: selected.at(-1)?.month || null,
    meanRankIC: values.length ? values.reduce((s,v) => s+v,0)/values.length : null };
}
export function validDateRange(start, end) {
  return (!start || /^\d{4}-(0[1-9]|1[0-2])$/.test(start)) &&
    (!end || /^\d{4}-(0[1-9]|1[0-2])$/.test(end)) && (!start || !end || start <= end);
}
export function cumulativeSeries(rows) {
  let wealth = 100;
  return rows.map((r) => ({ month: r.month, wealth: wealth *= 1+r.return }));
}
export function scoreForwardRecord(record, outcome, assets = ["SPY","IEF","GLD","TIP","DBC"]) {
  if(!outcome || assets.some((a) => !Number.isFinite(outcome.returns?.[a])) ||
    assets.some((a) => !record.ranking?.includes(a))) return null;
  const actual=assets.map((a) => outcome.returns[a]);
  const predicted=assets.map((a) => assets.length-record.ranking.indexOf(a));
  return { rankIC:rankIC(predicted,actual), selected:outcome.returns[record.ranking[0]],
    equalFive:actual.reduce((s,v) => s+v,0)/actual.length, spy:outcome.returns.SPY };
}
