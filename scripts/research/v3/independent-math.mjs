// Independent JavaScript implementation of the declared regression. Training
// membership and data are supplied by verify.mjs, independently of Python.
export const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
export function quantile(values, p) {
  const a = [...values].sort((a, b) => a - b), t = (a.length - 1) * p;
  const lo = Math.floor(t), hi = Math.ceil(t);
  return a[lo] + (a[hi] - a[lo]) * (t - lo);
}
export function solve(matrix, vector) {
  const n = vector.length, rows = matrix.map((r, i) => [...r, vector[i]]);
  for (let k = 0; k < n; k++) {
    let pivot = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(rows[i][k]) > Math.abs(rows[pivot][k])) pivot = i;
    [rows[k], rows[pivot]] = [rows[pivot], rows[k]];
    if (Math.abs(rows[k][k]) < 1e-12) throw new Error("Singular independent regression");
    const divisor = rows[k][k];
    for (let j = k; j <= n; j++) rows[k][j] /= divisor;
    for (let i = 0; i < n; i++) if (i !== k) {
      const multiplier = rows[i][k];
      for (let j = k; j <= n; j++) rows[i][j] -= multiplier * rows[k][j];
    }
  }
  return rows.map((r) => r[n]);
}
export function ridgeForecast(training, target, test, lambda = 100) {
  if (!training.length || training.length !== target.length ||
      !training.every((r) => r.length === test.length && r.every(Number.isFinite)) ||
      !target.every(Number.isFinite) || !test.every(Number.isFinite)) throw new Error("Incomplete independent model inputs");
  const columns = test.map((_, j) => training.map((r) => r[j]));
  const transforms = columns.map((c) => {
    const lo = quantile(c, .01), hi = quantile(c, .99);
    const clipped = c.map((v) => Math.max(lo, Math.min(hi, v))), m = mean(clipped);
    const sd = Math.sqrt(mean(clipped.map((v) => (v - m) ** 2)));
    return {lo, hi, mean: m, sd: sd > 1e-10 ? sd : 1};
  });
  const scale = (r) => r.map((v, j) => {
    const t = transforms[j];
    return (Math.max(t.lo, Math.min(t.hi, v)) - t.mean) / t.sd;
  });
  const x = training.map(scale), now = scale(test), centre = mean(target);
  const matrix = test.map((_, j) => test.map((_, k) => x.reduce((s, r) => s + r[j] * r[k], 0) + (j === k ? lambda : 0)));
  const vector = test.map((_, j) => x.reduce((s, r, i) => s + r[j] * (target[i] - centre), 0));
  const beta = solve(matrix, vector);
  return centre + now.reduce((s, v, j) => s + v * beta[j], 0);
}
