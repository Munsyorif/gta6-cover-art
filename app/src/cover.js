// Draws a multi-panel sunset cover onto a canvas 2D context. Everything here is drawn by hand:
// the panel grid, the sunset grade, the sun and palm silhouettes, and the title band. No artwork is
// loaded from anywhere: only the user's photos are drawn, everything else is vector work.

const FRAME_RATIO = 0.012; // outer frame, as a share of the cover width
const GUTTER_RATIO = 0.008; // gap between panels, as a share of the cover width
const BAND_RATIO = 0.16; // title band height, as a share of the cover height

/** How many photo slots a layout has. */
export function panelCount(layout) {
  return layout === 'triptych' ? 3 : 4;
}

/** Panel rectangles (in cover pixels) for a layout at a given cover size. */
export function coverPanels(layout, w, h) {
  const frame = Math.max(4, Math.round(w * FRAME_RATIO));
  const gutter = Math.max(3, Math.round(w * GUTTER_RATIO));
  const area = { x: frame, y: frame, w: w - frame * 2, h: h * (1 - BAND_RATIO) - frame };
  const split = (rect, parts, horizontal) => {
    const out = [];
    const total = horizontal ? rect.w : rect.h;
    const each = (total - gutter * (parts - 1)) / parts;
    for (let i = 0; i < parts; i++) {
      if (horizontal) out.push({ x: rect.x + i * (each + gutter), y: rect.y, w: each, h: rect.h });
      else out.push({ x: rect.x, y: rect.y + i * (each + gutter), w: rect.w, h: each });
    }
    return out;
  };
  if (layout === 'grid') {
    const rows = split(area, 2, false);
    return [split(rows[0], 2, true), split(rows[1], 2, true)].flat();
  }
  if (layout === 'triptych') {
    return split(area, 3, w > h);
  }
  // hero: one big panel plus three small ones.
  if (w > h) {
    const heroW = area.w * 0.6;
    const hero = { x: area.x, y: area.y, w: heroW - gutter, h: area.h };
    const side = { x: area.x + heroW, y: area.y, w: area.w - heroW, h: area.h };
    return [hero, ...split(side, 3, false)];
  }
  const heroH = area.h * 0.62;
  const hero = { x: area.x, y: area.y, w: area.w, h: heroH - gutter };
  const bottom = { x: area.x, y: area.y + heroH, w: area.w, h: area.h - heroH };
  return [hero, ...split(bottom, 3, true)];
}

/** Draws an image to cover a rectangle, with a zoom and a pan offset (both clamped so the photo always covers). */
function drawPhotoCovered(ctx, img, rect, zoom, ox, oy) {
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * Math.max(1, zoom);
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const maxX = (pw - rect.w) / 2;
  const maxY = (ph - rect.h) / 2;
  const dx = Math.max(-maxX, Math.min(maxX, ox * rect.w));
  const dy = Math.max(-maxY, Math.min(maxY, oy * rect.h));
  ctx.drawImage(img, rect.x + (rect.w - pw) / 2 + dx, rect.y + (rect.h - ph) / 2 + dy, pw, ph);
}

/** The Vice City sunset grade: warm orange rising from the bottom into magenta, plus a vignette.
 * The warm stop at the TOP matters: without it a bright daylight photo keeps a blue sky and
 * reads as midday, not sunset. The alphas below are for grade 1; the grade slider scales them. */
function drawSunsetGrade(ctx, rect, grade) {
  if (grade <= 0) return;
  const tint = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  tint.addColorStop(0, `rgba(255, 185, 115, ${0.1 * grade})`);
  tint.addColorStop(0.45, `rgba(255, 115, 70, ${0.18 * grade})`);
  tint.addColorStop(0.8, `rgba(195, 45, 110, ${0.36 * grade})`);
  tint.addColorStop(1, `rgba(65, 20, 95, ${0.32 * grade})`);
  ctx.fillStyle = tint;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const r = Math.hypot(rect.w, rect.h) / 2;
  const vig = ctx.createRadialGradient(cx, cy, r * 0.45, cx, cy, r);
  vig.addColorStop(0, 'rgba(20, 5, 35, 0)');
  vig.addColorStop(1, `rgba(20, 5, 35, ${0.32 * grade})`);
  ctx.fillStyle = vig;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

/** A low sun and palm silhouettes on the hero panel, drawn as vectors. */
function drawSunAndPalms(ctx, rect, grade) {
  if (grade < 0.25) return;
  // Sun: a small warm disc with a soft glow, blended so it brightens the photo instead of covering it.
  const sx = rect.x + rect.w * 0.78;
  const sy = rect.y + rect.h * 0.18;
  const sr = rect.h * 0.075;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const glow = ctx.createRadialGradient(sx, sy, sr * 0.1, sx, sy, sr * 4);
  glow.addColorStop(0, `rgba(255, 214, 140, ${0.5 * grade})`);
  glow.addColorStop(0.4, `rgba(255, 170, 110, ${0.22 * grade})`);
  glow.addColorStop(1, 'rgba(255, 140, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
  // Soft-edged core: opaque warm centre fading out, so the sun reads as light, not a pasted disc.
  const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 1.6);
  core.addColorStop(0, `rgba(255, 228, 165, ${0.85 * grade})`);
  core.addColorStop(0.55, `rgba(255, 214, 140, ${0.5 * grade})`);
  core.addColorStop(1, 'rgba(255, 210, 130, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(sx, sy, sr * 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Palms: silhouettes along the panel's foot, trunks with filled drooping fronds.
  ctx.fillStyle = 'rgba(24, 10, 40, 0.9)';
  ctx.strokeStyle = 'rgba(24, 10, 40, 0.9)';
  const frond = (tx, ty, angle, len) => {
    const ex = tx + Math.cos(angle) * len;
    const ey = ty + Math.sin(angle) * len + len * 0.32;
    const c1x = tx + Math.cos(angle) * len * 0.55;
    const c1y = ty + Math.sin(angle) * len * 0.55 - len * 0.24;
    const c2x = tx + Math.cos(angle) * len * 0.45;
    const c2y = ty + Math.sin(angle) * len * 0.45 + len * 0.06;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(c1x, c1y, ex, ey);
    ctx.quadraticCurveTo(c2x, c2y, tx, ty);
    ctx.closePath();
    ctx.fill();
  };
  const palm = (bx, by, height, lean) => {
    const topX = bx + lean * height;
    const topY = by - height;
    ctx.lineWidth = Math.max(2.5, height * 0.05);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + lean * height * 0.4, by - height * 0.55, topX, topY);
    ctx.stroke();
    const spread = [-2.75, -2.3, -1.85, -1.35, -0.9, -0.4];
    spread.forEach((a, i) => frond(topX, topY, a, height * (0.34 + (i % 2) * 0.08)));
  };
  const ph = rect.h * 0.22;
  const baseY = rect.y + rect.h - 1;
  palm(rect.x + rect.w * 0.07, baseY, ph, 0.22);
  palm(rect.x + rect.w * 0.16, baseY, ph * 0.68, -0.18);
  palm(rect.x + rect.w * 0.92, baseY, ph * 0.8, -0.22);
}

/** The title band across the foot: a sunset gradient, the title in Anton, the subtitle letterspaced beneath. */
function drawTitleBand(ctx, w, h, title, subtitle) {
  const bandY = h * (1 - BAND_RATIO);
  const bandH = h * BAND_RATIO;
  const band = ctx.createLinearGradient(0, bandY, 0, h);
  band.addColorStop(0, '#3b1155');
  band.addColorStop(0.55, '#a92c6b');
  band.addColorStop(1, '#ff7a3c');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY, w, bandH);
  ctx.fillStyle = 'rgba(255, 210, 140, 0.85)';
  ctx.fillRect(0, bandY, w, Math.max(2, h * 0.004));
  const text = (title || '').trim().toUpperCase();
  if (!text) return;
  let size = bandH * 0.56;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fit = () => {
    ctx.font = `${size}px Anton, sans-serif`;
    return ctx.measureText(text).width <= w * 0.92;
  };
  while (!fit() && size > 12) {
    size -= 2;
  }
  ctx.font = `${size}px Anton, sans-serif`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(22, 8, 34, 0.9)';
  ctx.lineWidth = Math.max(2, size * 0.07);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetY = size * 0.03;
  const titleY = bandY + bandH * (subtitle.trim() ? 0.38 : 0.52);
  ctx.strokeText(text, w / 2, titleY);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, w / 2, titleY);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  const sub = (subtitle || '').trim().toUpperCase();
  if (sub) {
    const subSize = Math.max(10, size * 0.26);
    ctx.font = `600 ${subSize}px system-ui, sans-serif`;
    try { ctx.letterSpacing = `${Math.max(2, subSize * 0.22)}px`; } catch { /* older canvas: no letterspacing */ }
    ctx.fillStyle = 'rgba(255, 235, 210, 0.95)';
    ctx.fillText(sub, w / 2, bandY + bandH * 0.78);
    try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
  }
}

/**
 * Draws the whole cover. `state` holds layout, title, subtitle, grade (0..1), photos (loaded
 * Images) and panels: [{ photo: index into photos or -1, zoom: 1..3, ox, oy }].
 */
export function drawCoverArt(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  ctx.fillStyle = '#f7ead2';
  ctx.fillRect(0, 0, w, h);
  const rects = coverPanels(state.layout, w, h);
  rects.forEach((rect, i) => {
    const slot = state.panels[i] || { photo: -1, zoom: 1, ox: 0, oy: 0 };
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    const entry = slot.photo >= 0 ? state.photos[slot.photo] : null;
    const img = entry ? entry.img : null;
    if (img) {
      drawPhotoCovered(ctx, img, rect, slot.zoom, slot.ox, slot.oy);
    } else {
      const empty = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      empty.addColorStop(0, '#4a2358');
      empty.addColorStop(1, '#1c0f2e');
      ctx.fillStyle = empty;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    drawSunsetGrade(ctx, rect, state.grade);
    if (i === 0) drawSunAndPalms(ctx, rect, state.grade);
    ctx.restore();
  });
  drawTitleBand(ctx, w, h, state.title, state.subtitle);
}
