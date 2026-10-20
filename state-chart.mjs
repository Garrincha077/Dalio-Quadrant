import { STATE_RULES } from "./lib/economic-state.mjs";
const finite = Number.isFinite;
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmt = (n) => (finite(n) ? n.toFixed(2) : "—");
export function statePointLabel(slot) {
  const p = slot.point;
  return p
    ? `#${slot.sequence} · ${slot.label} · Activity ${fmt(p.activity)} (${p.activityDate.slice(0, 7)}) · PCE ${fmt(p.inflation)}% YoY (${p.inflationDate.slice(0, 7)}) · ${p.regime.name}`
    : `#${slot.sequence} · ${slot.label}: ${slot.kind === "current" ? "latest state withheld until both axes are fresh" : "no same-month historical pair"}. Gap remains unconnected.`;
}
export function renderStateChart(slots, scale, selected, mobile = false) {
  const w = mobile ? 340 : 600,
    h = 408,
    left = 42,
    right = w - 24,
    top = 48,
    bottom = 342;
  const cx = (left + right) / 2,
    cy = (top + bottom) / 2,
    dx = (right - left) / 2,
    dy = (bottom - top) / 2;
  const x = (v) => cx + (v / scale.activity) * dx,
    y = (v) => cy - (v / scale.inflation) * dy;
  const summary = `${slots.filter((s) => s.point).length} of ${slots.length} economic-state positions. Activity zero and PCE 2 percent define the boundaries. Number 1 is oldest. Use Inspect position for overlapping dots and exact values.`;
  let svg = `<svg viewBox="0 0 ${w} ${h}" role="group" aria-label="${esc(summary)}"><title>${esc(summary)}</title><defs><clipPath id="statePlotClip"><rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}"/></clipPath><marker id="stateMoveArrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7Z" fill="#e2b752"/></marker></defs><rect width="${w}" height="${h}" fill="#101725"/>`;
  for (const [color, a, b] of [
    ["#fb899512", left, top],
    ["#f3b36c12", cx, top],
    ["#87b6ff12", left, cy],
    ["#60d6ab12", cx, cy],
  ])
    svg += `<rect x="${a}" y="${b}" width="${dx}" height="${dy}" fill="${color}"/>`;
  svg += `<g clip-path="url(#statePlotClip)"><rect x="${x(-STATE_RULES.activityBuffer)}" y="${top}" width="${x(STATE_RULES.activityBuffer) - x(-STATE_RULES.activityBuffer)}" height="${bottom - top}" fill="#a7b3c518"/><rect x="${left}" y="${y(STATE_RULES.inflationBuffer)}" width="${right - left}" height="${y(-STATE_RULES.inflationBuffer) - y(STATE_RULES.inflationBuffer)}" fill="#a7b3c518"/></g>`;
  for (const a of [
    -scale.activity,
    -scale.activity / 2,
    0,
    scale.activity / 2,
    scale.activity,
  ]) {
    svg += `<path d="M${x(a)} ${top} V${bottom}" stroke="${a === 0 ? "#8796ae" : "#293447"}" stroke-dasharray="${a === 0 ? "4 4" : "2 5"}"/><text x="${x(a)}" y="${bottom + 18}" text-anchor="middle" font-size="10" fill="#b7c3d6">${scale.activity < 1 ? a.toFixed(2) : a.toFixed(1)}</text>`;
  }
  for (const b of [
    -scale.inflation,
    -scale.inflation / 2,
    0,
    scale.inflation / 2,
    scale.inflation,
  ])
    svg += `<path d="M${left} ${y(b)} H${right}" stroke="${b === 0 ? "#8796ae" : "#293447"}" stroke-dasharray="${b === 0 ? "4 4" : "2 5"}"/><text x="${left - 6}" y="${y(b) + 4}" text-anchor="end" font-size="10" fill="#b7c3d6">${b > 0 ? "+" : ""}${b}</text>`;
  svg += `<g font-size="9" fill="#b7c3d6"><text x="${left}" y="15">BELOW TREND</text><text x="${left}" y="29">PCE ABOVE 2%</text><text x="${right}" y="15" text-anchor="end">ABOVE TREND</text><text x="${right}" y="29" text-anchor="end">PCE ABOVE 2%</text><text x="${left}" y="386">BELOW TREND · PCE BELOW 2%</text><text x="${right}" y="400" text-anchor="end">ABOVE TREND · PCE BELOW 2%</text><text x="${cx}" y="${bottom + 34}" text-anchor="middle">ACTIVITY INDEX · ZERO = TREND</text><text x="${left}" y="${top - 6}">PCE GAP · pp</text></g>`;
  const marks = slots.map((slot, i) =>
    slot.point
      ? {
          slot,
          i,
          px: x(slot.point.activity),
          py: y(slot.point.inflationGap),
          radius: 8.5 + (5.5 * i) / 11,
          opacity: 0.16 + (0.84 * i) / 11,
        }
      : null,
  );
  svg += '<g clip-path="url(#statePlotClip)">';
  for (let i = 1; i < marks.length; i++) {
    const a = marks[i - 1],
      b = marks[i];
    if (!a || !b) continue;
    svg += `<path d="M${a.px} ${a.py} L${b.px} ${b.py}" stroke="#e2b752" stroke-opacity="${0.12 + (0.58 * i) / 11}" stroke-width="${1 + i / 11}" fill="none"/>`;
    const length = Math.hypot(b.px - a.px, b.py - a.py),
      inside =
        Math.abs(b.slot.point.activity) <= scale.activity &&
        Math.abs(b.slot.point.inflationGap) <= scale.inflation;
    if (i === marks.length - 1 && inside && length > a.radius + b.radius + 14) {
      const endX = b.px - ((b.px - a.px) / length) * (b.radius + 5),
        endY = b.py - ((b.py - a.py) / length) * (b.radius + 5);
      svg += `<path d="M${a.px} ${a.py} L${endX} ${endY}" stroke="#e2b752" stroke-width="2" marker-end="url(#stateMoveArrow)"/>`;
    }
  }
  svg += "</g>";
  function mark(p, focus = false) {
    const off =
      Math.abs(p.slot.point.activity) > scale.activity ||
      Math.abs(p.slot.point.inflationGap) > scale.inflation;
    const px = Math.max(left + 2, Math.min(right - 2, p.px)),
      py = Math.max(top + 2, Math.min(bottom - 2, p.py));
    const label =
      statePointLabel(p.slot) +
      (off
        ? " · Outside visible range. Select Full history scale for exact placement."
        : "");
    let s = `<g data-state-key="${esc(p.slot.key)}" role="button" tabindex="0" aria-label="${esc(label)}" class="state-mark"><title>${esc(label)}</title>`;
    if (off)
      s += `<path d="M${px} ${py - 10} L${px + 10} ${py} L${px} ${py + 10} L${px - 10} ${py} Z" fill="#101725" stroke="#e2b752" stroke-width="2"/>`;
    else
      s += `<circle cx="${px}" cy="${py}" r="${p.radius}" fill="#e2b752" fill-opacity="${focus ? 1 : p.opacity}" stroke="#e2b752" stroke-opacity="${Math.max(0.35, p.opacity)}"/>`;
    s += `<text x="${px}" y="${py + 0.5}" text-anchor="middle" dominant-baseline="middle" font-size="${p.i === 11 ? 11 : 9}" font-weight="700" fill="${off ? "#e2b752" : focus || p.opacity > 0.6 ? "#101725" : "#e8edf5"}" pointer-events="none">${p.slot.sequence}</text>`;
    if (p.i === 11 && !off)
      s += `<circle cx="${px}" cy="${py}" r="${p.radius + 5}" fill="none" stroke="#e2b752"/>`;
    if (focus)
      s += `<circle cx="${px}" cy="${py}" r="${p.radius + 3}" fill="none" stroke="#f2f5fa" stroke-width="1.5"/>`;
    return s + "</g>";
  }
  for (const p of marks.filter(Boolean))
    if (p.slot.key !== selected) svg += mark(p);
  const chosen = marks.find((p) => p?.slot.key === selected);
  if (chosen) svg += mark(chosen, true);
  if (!marks.some(Boolean))
    svg += `<text x="${cx}" y="${cy - 30}" text-anchor="middle" font-size="12" fill="#a7b3c5">No valid state positions</text>`;
  return svg + "</svg>";
}
export function renderActivityHistogram(context, value) {
  if (!context.values.length) return "";
  const w = 360,
    h = 76,
    pad = 16,
    limit = 2,
    n = 32,
    bins = Array(n).fill(0);
  const x = (v) =>
    pad +
    ((Math.max(-limit, Math.min(limit, v)) + limit) / (2 * limit)) *
      (w - 2 * pad);
  for (const v of context.values)
    bins[
      Math.max(0, Math.min(n - 1, Math.floor(((v + limit) / (2 * limit)) * n)))
    ]++;
  const max = Math.max(1, ...bins),
    bw = (w - 2 * pad) / n;
  let s = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Activity distribution from ${esc(context.first)} to ${esc(context.last)}. Zero is the economic trend anchor. Values outside minus or plus 2 are grouped in edge bins.">`;
  bins.forEach((b, i) => {
    const bh = (b / max) * 43;
    s += `<rect x="${pad + i * bw}" y="${52 - bh}" width="${bw - 1}" height="${bh}" fill="#62738e"/>`;
  });
  s += `<path d="M${x(0)} 5 V55" stroke="#e8edf5" stroke-dasharray="3 3"/>`;
  if (finite(value))
    s += `<path d="M${x(value)} 1 V57" stroke="#e2b752" stroke-width="2"/>`;
  for (const v of [-2, -1, 0, 1, 2])
    s += `<text x="${x(v)}" y="72" text-anchor="middle" font-size="10" fill="#a7b3c5">${v}</text>`;
  return s + "</svg>";
}
