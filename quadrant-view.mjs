import { buildTrail, trailStyle } from "./lib/trail.mjs";
const $ = (id) => document.getElementById(id),
  finite = Number.isFinite;
const signed = (n) => (finite(n) ? `${n > 0 ? "+" : ""}${n.toFixed(2)}` : "—");
const date = (s) =>
  new Date(s + "T00:00:00Z").toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
export function createQuadrantView(onInspect = () => {}) {
  let snapshot = null,
    slots = [],
    marks = [],
    selected = "now",
    cacheKey = "",
    cachedSnapshot = null;
  const canvas = $("quadrant");
  function hideTooltip() {
    $("quadrantTip").hidden = true;
  }
  function showTooltip(p) {
    const tip = $("quadrantTip"),
      r = canvas.getBoundingClientRect();
    tip.textContent = `#${p.slot.sequence} · ${p.slot.label} · ${date(p.slot.point.date)}\nGrowth ${signed(p.slot.point.growth.score)} · Inflation ${signed(p.slot.point.inflation.score)}\n${p.slot.point.regime.name}`;
    tip.style.left = `${Math.max(8, Math.min(r.width - 228, p.x + 15))}px`;
    tip.style.top = `${Math.max(8, Math.min(r.height - 90, p.y + 15))}px`;
    tip.hidden = false;
  }
  function updateReadout() {
    const slot = slots.find((s) => s.key === selected);
    onInspect(slot || null);
    $("quadrantInspect").value = selected;
    if (!slot) {
      $("quadrantReadout").textContent = "Waiting for verified data.";
      return;
    }
    $("quadrantReadout").textContent = slot.point
      ? `#${slot.sequence} · ${slot.label} · ${date(slot.point.date)} · Growth ${signed(slot.point.growth.score)} · Inflation ${signed(slot.point.inflation.score)} · ${slot.point.regime.name} · Coverage G ${Math.round(slot.point.growth.coverage * 100)}% / I ${Math.round(slot.point.inflation.coverage * 100)}%${slot.kind === "reconstructed" ? " · reconstructed" : " · current published data"}`
      : `#${slot.sequence} · ${slot.label}: no valid position with at least 75% coverage on both axes. This gap is not connected.`;
  }
  function draw() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = r.width * dpr;
    canvas.height = r.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const w = r.width,
      h = r.height,
      cx = w / 2,
      cy = h / 2,
      pad = 48;
    const x = (v) => cx + v * (cx - pad),
      y = (v) => cy - v * (cy - pad);
    ctx.fillStyle = "#101725";
    ctx.fillRect(0, 0, w, h);
    [
      ["#fb8995", 0, 0],
      ["#f3b36c", cx, 0],
      ["#87b6ff", 0, cy],
      ["#60d6ab", cx, cy],
    ].forEach(([color, a, b]) => {
      ctx.fillStyle = color + "12";
      ctx.fillRect(a, b, cx, cy);
    });
    ctx.fillStyle = "#a7b3c510";
    ctx.fillRect(x(-0.15), 0, x(0.15) - x(-0.15), h);
    ctx.fillRect(0, y(0.15), w, y(-0.15) - y(0.15));
    ctx.strokeStyle = "#40506b";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "10px ui-monospace,monospace";
    ctx.fillStyle = "#b7c3d6";
    ctx.textAlign = "left";
    ctx.fillText("GROWTH ↓", 9, 18);
    ctx.fillText("INFLATION ↑", 9, 31);
    ctx.fillText("GROWTH ↓", 9, h - 24);
    ctx.fillText("INFLATION ↓", 9, h - 10);
    ctx.textAlign = "right";
    ctx.fillText("GROWTH ↑", w - 9, 18);
    ctx.fillText("INFLATION ↑", w - 9, 31);
    ctx.fillText("GROWTH ↑", w - 9, h - 24);
    ctx.fillText("INFLATION ↓", w - 9, h - 10);
    ctx.fillStyle = "#a7b3c5";
    ctx.fillText("GROWTH →", w - 9, cy - 8);
    ctx.textAlign = "left";
    ctx.fillText("INFLATION ↑", 9, cy - 8);
    marks = slots.map((slot, index) =>
      slot.point
        ? {
            slot,
            index,
            x: x(slot.point.growth.score),
            y: y(slot.point.inflation.score),
            ...trailStyle(index, slots.length),
          }
        : null,
    );
    for (let j = 1; j < marks.length; j++) {
      const a = marks[j - 1],
        b = marks[j];
      if (!a || !b) continue;
      ctx.strokeStyle = `rgba(226,183,82,${b.lineOpacity})`;
      ctx.lineWidth = b.lineWidth;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    function drawMark(p, focus = false) {
      ctx.save();
      ctx.fillStyle = `rgba(226,183,82,${focus ? Math.max(0.8, p.opacity) : p.opacity})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(226,183,82,${Math.max(0.32, p.opacity)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = `700 ${p.slot.kind === "current" ? 11 : 9}px ui-monospace,monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = focus || p.opacity >= 0.65 ? "#101725" : "#e8edf5d9";
      ctx.fillText(String(p.slot.sequence), p.x, p.y + 0.5);
      if (p.slot.kind === "current") {
        ctx.strokeStyle = "#e2b752a0";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    for (const p of marks.filter(Boolean)) drawMark(p);
    const chosen = marks.find((p) => p?.slot.key === selected);
    if (chosen) {
      drawMark(chosen, true);
      ctx.strokeStyle = "#f2f5fa";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(chosen.x, chosen.y, chosen.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Endpoint labels only; exact values and all overlapping points use Inspect.
    const endpoints = [
      marks.find(Boolean),
      marks.find((p) => p?.slot.kind === "current"),
    ].filter((p, i, a) => p && a.indexOf(p) === i);
    ctx.font = "11px system-ui,sans-serif";
    for (const p of endpoints) {
      const label =
          p.slot.kind === "current" ? `Now · ${p.slot.sequence}` : p.slot.label,
        tw = ctx.measureText(label).width;
      const lx = Math.max(8, Math.min(w - tw - 8, p.x + 15)),
        ly = p.y < 42 ? p.y + 24 : p.y - 16;
      ctx.fillStyle = "#101725e8";
      ctx.fillRect(lx - 3, ly - 12, tw + 6, 17);
      ctx.fillStyle = p.slot.kind === "current" ? "#f0cf7e" : "#a7b3c5";
      ctx.fillText(label, lx, ly);
    }
    canvas.setAttribute(
      "aria-label",
      `Growth by inflation momentum, ${$("quadrantPeriod").value} sampling. ${marks.filter(Boolean).length} of ${slots.length} positions available. Older dots shrink and fade. Use Inspect position for dates, scores and coverage. Historical points are reconstructed from latest revised completed reference periods.`,
    );
  }
  function render(next) {
    hideTooltip();
    snapshot = next;
    const cadence = $("quadrantPeriod").value,
      count = Number($("quadrantCount").value),
      key = `${cadence}:${count}`;
    if (next !== cachedSnapshot || key !== cacheKey) {
      slots = buildTrail(next, { cadence, count });
      cachedSnapshot = next;
      cacheKey = key;
      if (!slots.some((s) => s.key === selected)) selected = "now";
      $("quadrantInspect").replaceChildren(
        ...slots.map((s) => {
          const option = document.createElement("option");
          option.value = s.key;
          option.textContent = `${s.sequence} · ${s.label}${s.point ? "" : " · unavailable"}`;
          return option;
        }),
      );
      $("quadrantInspect").disabled = !slots.length;
      const available = slots.filter((s) => s.point).length;
      $("quadrantTrailStatus").textContent = slots.length
        ? `${available}/${slots.length} positions · 1 = oldest, ${count} = Now. Missing numbers = unavailable periods. Older = smaller and fainter.`
        : "Waiting for source observations.";
    }
    updateReadout();
    draw();
  }
  for (const id of ["quadrantPeriod", "quadrantCount"])
    $(id).addEventListener("change", () => {
      selected = "now";
      render(snapshot);
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        canvas.animate([{ opacity: 0.4 }, { opacity: 1 }], {
          duration: 180,
          easing: "ease-out",
        });
    });
  $("quadrantInspect").addEventListener("change", () => {
    hideTooltip();
    selected = $("quadrantInspect").value;
    updateReadout();
    draw();
  });
  function hit(event) {
    const r = canvas.getBoundingClientRect(),
      px = event.clientX - r.left,
      py = event.clientY - r.top;
    return marks
      .filter(Boolean)
      .map((p) => ({ ...p, distance: Math.hypot(p.x - px, p.y - py) }))
      .filter((p) => p.distance <= Math.max(11, p.radius + 5))
      .sort((a, b) => a.distance - b.distance || b.index - a.index)[0];
  }
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    const point = hit(event);
    canvas.style.cursor = point ? "pointer" : "default";
    if (point) {
      if (selected !== point.slot.key) {
        selected = point.slot.key;
        updateReadout();
        draw();
      }
      showTooltip(point);
    } else hideTooltip();
  });
  canvas.addEventListener("pointerleave", hideTooltip);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideTooltip();
  });
  canvas.addEventListener("click", (event) => {
    const point = hit(event);
    if (point) {
      selected = point.slot.key;
      updateReadout();
      draw();
      showTooltip(point);
    } else hideTooltip();
  });
  return { render };
}
