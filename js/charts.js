/**
 * Two charts for the stats page, drawn as inline SVG.
 * Colours arrive as CSS custom properties so light and dark are one definition each.
 */
import { esc } from "./util.js";

const TOPIC_LABELS = {
  atoms: "Atoms & symbols", polyions: "Polyatomic ions", naming: "Naming compounds",
  balancing: "Balancing equations", moles: "Moles & molar mass", stoich: "Stoichiometry",
  gases: "Gas laws", trends: "Periodic trends",
  basics: "Points & lines", anglekinds: "Angle types", angles: "Parallel lines",
  trianglebasics: "Triangle basics", congruence: "Congruence", right: "Right triangles",
  similar: "Similarity", circles: "Circles", coords: "Coordinates", solids: "Area & volume",
  proofs: "Two-column proofs"
};
export const topicLabel = t => TOPIC_LABELS[t] || t;

/** Rounded only on the data end, square on the baseline end. */
function barPath(x, y, w, h, r, dir){
  r = Math.max(0, Math.min(r, dir === "up" ? w / 2 : h / 2, dir === "up" ? h : w));
  if (dir === "up")  return `M${x} ${y + h} V${y + r} q0 ${-r} ${r} ${-r} h${w - 2 * r} q${r} 0 ${r} ${r} V${y + h} Z`;
  return `M${x} ${y} h${w - r} q${r} 0 ${r} ${r} v${h - 2 * r} q0 ${r} ${-r} ${r} h${-(w - r)} Z`;
}

function tooltipLayer(host){
  const tip = document.createElement("div");
  tip.className = "viz-tip";
  tip.hidden = true;
  host.appendChild(tip);
  return {
    show(html, x, y){
      tip.innerHTML = html;
      tip.hidden = false;
      const box = host.getBoundingClientRect();
      const w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.max(4, Math.min(x - w / 2, box.width - w - 4)) + "px";
      tip.style.top  = Math.max(4, y - h - 12) + "px";
    },
    hide(){ tip.hidden = true; }
  };
}

/**
 * Accuracy by topic — one measure across categories, so a single hue and no legend.
 * Sorted by attempts, because "which have I actually practised" is the question underneath.
 */
export function topicChart(host, rows){
  host.innerHTML = "";
  const data = rows.slice().sort((a, b) => b.total - a.total).slice(0, 10)
    .map(r => ({ ...r, pct: r.total ? Math.round(r.right / r.total * 100) : 0 }));
  if (!data.length){ host.innerHTML = `<p class="viz-empty">No practice recorded yet.</p>`; return; }

  const rowH = 30, gap = 8, padL = 152, padR = 96, padT = 6, padB = 4;
  const w = 620, h = padT + data.length * (rowH + gap) - gap + padB;

  const bars = data.map((d, i) => {
    const y = padT + i * (rowH + gap);
    const full = w - padL - padR;
    const bw = Math.max(2, full * d.pct / 100);
    return `<g class="viz-row" data-i="${i}">
      <text class="viz-cat" x="${padL - 12}" y="${y + rowH / 2}" text-anchor="end" dominant-baseline="middle">${esc(topicLabel(d.topic))}</text>
      <rect class="viz-track" x="${padL}" y="${y + 6}" width="${full}" height="${rowH - 12}" rx="2"></rect>
      <path class="viz-bar" d="${barPath(padL, y + 6, bw, rowH - 12, 4, "right")}"></path>
      <text class="viz-val" x="${padL + full + 10}" y="${y + rowH / 2}" dominant-baseline="middle">${d.pct}%</text>
      <rect class="viz-hit" x="0" y="${y}" width="${w}" height="${rowH}" data-i="${i}"></rect>
    </g>`;
  }).join("");

  host.insertAdjacentHTML("beforeend",
    `<svg viewBox="0 0 ${w} ${h}" class="viz-svg" role="img" aria-label="Accuracy by topic">${bars}</svg>`);

  const tip = tooltipLayer(host);
  const svg = host.querySelector("svg");
  svg.addEventListener("pointermove", e => {
    const hit = e.target.closest(".viz-hit");
    if (!hit) return tip.hide();
    const d = data[+hit.dataset.i];
    const box = host.getBoundingClientRect();
    tip.show(`<b>${esc(topicLabel(d.topic))}</b><span>${d.right} right of ${d.total} · ${d.pct}%</span>`,
             e.clientX - box.left, e.clientY - box.top);
  });
  svg.addEventListener("pointerleave", tip.hide);
}

/**
 * Problems answered per day over the last 30 days: correct stacked on missed.
 * Two series, so a legend is present and the tooltip names both.
 */
export function activityChart(host, daily){
  host.innerHTML = "";
  const days = [];
  for (let i = 29; i >= 0; i--){
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    const hit = daily.find(r => r.day === d);
    const total = hit ? hit.total : 0, right = hit ? (hit.right || 0) : 0;
    days.push({ day: d, total, right, missed: total - right });
  }
  const max = Math.max(4, ...days.map(d => d.total));

  const w = 620, h = 190, padL = 34, padR = 8, padT = 12, padB = 26;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const slot = plotW / days.length, bw = Math.min(14, slot - 3);

  const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  const grid = ticks.map(v => {
    const y = padT + plotH - (v / max) * plotH;
    return `<line class="viz-grid" x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}"></line>
            <text class="viz-tick" x="${padL - 8}" y="${y}" text-anchor="end" dominant-baseline="middle">${v}</text>`;
  }).join("");

  const bars = days.map((d, i) => {
    const x = padL + i * slot + (slot - bw) / 2;
    if (!d.total) return `<rect class="viz-hit" x="${padL + i * slot}" y="${padT}" width="${slot}" height="${plotH}" data-i="${i}"></rect>`;
    const totalH = (d.total / max) * plotH;
    const rightH = (d.right / max) * plotH;
    const missedH = Math.max(0, totalH - rightH - (d.missed && d.right ? 2 : 0)); // 2px surface gap between segments
    const yTop = padT + plotH - totalH;
    const parts = [];
    if (d.missed) parts.push(`<path class="viz-s2" d="${barPath(x, yTop, bw, missedH, 4, "up")}"></path>`);
    if (d.right)  parts.push(`<path class="viz-s1" d="${barPath(x, padT + plotH - rightH, bw, rightH, d.missed ? 0 : 4, "up")}"></path>`);
    return parts.join("") + `<rect class="viz-hit" x="${padL + i * slot}" y="${padT}" width="${slot}" height="${plotH}" data-i="${i}"></rect>`;
  }).join("");

  const fmtDay = s => new Date(s + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const axis = [0, 15, 29].map(i =>
    `<text class="viz-tick" x="${padL + i * slot + slot / 2}" y="${h - 8}" text-anchor="middle">${fmtDay(days[i].day)}</text>`).join("");

  host.insertAdjacentHTML("beforeend",
    `<svg viewBox="0 0 ${w} ${h}" class="viz-svg" role="img" aria-label="Problems answered per day over the last 30 days">
       ${grid}<line class="viz-base" x1="${padL}" y1="${padT + plotH}" x2="${w - padR}" y2="${padT + plotH}"></line>${bars}${axis}
     </svg>`);

  const tip = tooltipLayer(host);
  const svg = host.querySelector("svg");
  svg.addEventListener("pointermove", e => {
    const hit = e.target.closest(".viz-hit");
    if (!hit) return tip.hide();
    const d = days[+hit.dataset.i];
    const box = host.getBoundingClientRect();
    tip.show(d.total
      ? `<b>${fmtDay(d.day)}</b><span>${d.right} correct · ${d.missed} missed</span>`
      : `<b>${fmtDay(d.day)}</b><span>nothing practised</span>`,
      e.clientX - box.left, e.clientY - box.top);
  });
  svg.addEventListener("pointerleave", tip.hide);
}
