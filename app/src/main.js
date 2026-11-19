// Wires the Sunset Cover Maker: photo upload, layout and panel editing, caption and sunset
// grade, live preview, and PNG export at the three post sizes. A `?shot=` query sets up a
// fixed scene for a screenshot instead (./shots.js).
import { drawCoverArt, coverPanels, panelCount } from './cover.js';
import { runShot } from './shots.js';

const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square 1080 × 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait 1080 × 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Wide 1920 × 1080' },
};
const LAYOUT_LABELS = {
  hero: ['Hero', 'Panel 2', 'Panel 3', 'Panel 4'],
  grid: ['Top left', 'Top right', 'Bottom left', 'Bottom right'],
  triptych: ['Panel 1', 'Panel 2', 'Panel 3'],
};
const SAMPLES = [
  { name: 'Pier', url: 'samples/pier.jpg' },
  { name: 'Boulevard', url: 'samples/boulevard.jpg' },
];

const state = {
  layout: 'hero',
  size: { w: 1080, h: 1080 },
  title: 'SUNSET HEIST',
  subtitle: 'A STORY IN EVERY FRAME',
  grade: 0.8,
  photos: [], // { img, name, url }
  panels: [], // { photo: index into photos or -1, zoom: 1..3, ox, oy }
  selected: 0,
};

const preview = document.getElementById('preview');
const titleInput = document.getElementById('titleInput');
const subtitleInput = document.getElementById('subtitleInput');
const gradeInput = document.getElementById('gradeInput');
const gradeValue = document.getElementById('gradeValue');
const panelList = document.getElementById('panelList');
const photoList = document.getElementById('photoList');
const status = document.getElementById('status');
const sizeLabel = document.getElementById('sizeLabel');

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function freshPanels() {
  const old = state.panels;
  return Array.from({ length: panelCount(state.layout) }, (_, i) => ({
    photo: old[i] ? old[i].photo : -1,
    zoom: old[i] ? old[i].zoom : 1,
    ox: old[i] ? old[i].ox : 0,
    oy: old[i] ? old[i].oy : 0,
  }));
}

// When one photo fills several panels, each panel opens on a different part of it, so the
// cover reads as several shots instead of one image repeated. Applied when a photo is assigned.
// Each slot targets a different point of the photo (fractions of its width/height), and the
// pan is solved from that target and the panel's own aspect — a fixed zoom/offset preset cannot
// do this, because drawPhotoCovered clamps the pan to the slack the zoom leaves, and that slack
// depends on the panel shape: at zoom ~1 a square photo leaves almost no slack, so the old
// fixed presets collapsed every panel onto the same centred crop (the grid showed two images
// duplicated, the hero's three side panels one arm repeated 3x). Slot 0 is the whole shot;
// the rest are detail regions. Note the pan signs: a positive ox shifts the photo right, so
// the visible window moves LEFT in the photo (and vice versa).
const CROP_TARGETS = [
  { fx: 0.5, fy: 0.44, zoom: 1.0 }, // slot 0: the whole shot, biased slightly up so faces are not cut
  { fx: 0.68, fy: 0.68, zoom: 2.3 }, // bottom-right detail: hands + reel, car + street
  { fx: 0.42, fy: 0.28, zoom: 2.3 }, // face detail, centred on the face: face + hat, face + hair
  { fx: 0.85, fy: 0.45, zoom: 2.1 }, // top-right detail: water + rod tip, palms + street
];
function applyCropPreset(slot, i) {
  const target = CROP_TARGETS[i];
  const img = slot.photo >= 0 ? state.photos[slot.photo]?.img : null;
  const rect = coverPanels(state.layout, state.size.w, state.size.h)[i];
  if (!target || !img || !rect) { slot.zoom = 1; slot.ox = 0; slot.oy = 0; return; }
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * target.zoom;
  // The rect's centre shows the photo point (fx, fy): window centre = photo centre - pan/scale.
  slot.zoom = target.zoom;
  slot.ox = (0.5 - target.fx) * img.naturalWidth * scale / rect.w;
  slot.oy = (0.5 - target.fy) * img.naturalHeight * scale / rect.h;
}

function redraw() {
  if (preview.width !== state.size.w || preview.height !== state.size.h) {
    preview.width = state.size.w;
    preview.height = state.size.h;
  }
  drawCoverArt(preview, state);
  // Outline the selected panel so the editor shows which one the controls edit.
  const rects = coverPanels(state.layout, preview.width, preview.height);
  const rect = rects[state.selected];
  if (rect && !document.body.classList.contains('shot-cover')) {
    const ctx = preview.getContext('2d');
    ctx.save();
    ctx.strokeStyle = '#ffd28c';
    ctx.lineWidth = Math.max(3, preview.width * 0.004);
    ctx.setLineDash([Math.max(8, preview.width * 0.012), Math.max(6, preview.width * 0.008)]);
    ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
    ctx.restore();
  }
}

function panelLabel(i) {
  return (LAYOUT_LABELS[state.layout] || [])[i] ?? `Panel ${i + 1}`;
}

function rebuildPanelList() {
  panelList.innerHTML = '';
  state.panels.forEach((slot, i) => {
    const row = document.createElement('div');
    row.className = 'panel-row' + (i === state.selected ? ' selected' : '');
    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'panel-name';
    label.textContent = panelLabel(i);
    label.addEventListener('click', () => { state.selected = i; rebuildPanelList(); redraw(); });
    const select = document.createElement('select');
    select.setAttribute('aria-label', `Photo for ${panelLabel(i)}`);
    const none = document.createElement('option');
    none.value = '-1';
    none.textContent = 'No photo';
    select.appendChild(none);
    state.photos.forEach((p, pi) => {
      const opt = document.createElement('option');
      opt.value = String(pi);
      opt.textContent = p.name;
      select.appendChild(opt);
    });
    select.value = String(slot.photo);
    select.addEventListener('change', () => {
      slot.photo = Number(select.value);
      if (slot.photo >= 0) applyCropPreset(slot, i);
      redraw();
    });
    const zoom = document.createElement('input');
    zoom.type = 'range';
    zoom.min = '1';
    zoom.max = '3';
    zoom.step = '0.05';
    zoom.value = String(slot.zoom);
    zoom.setAttribute('aria-label', `Zoom for ${panelLabel(i)}`);
    zoom.addEventListener('input', () => { slot.zoom = Number(zoom.value); redraw(); });
    row.append(label, select, zoom);
    panelList.appendChild(row);
  });
}

function rebuildPhotoList() {
  photoList.innerHTML = '';
  state.photos.forEach((p, pi) => {
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'thumb';
    thumb.title = `Use ${p.name} in the selected panel`;
    const img = document.createElement('img');
    img.src = p.url;
    img.alt = p.name;
    const name = document.createElement('span');
    name.textContent = p.name;
    thumb.append(img, name);
    thumb.addEventListener('click', () => {
      state.panels[state.selected].photo = pi;
      rebuildPanelList();
      redraw();
    });
    photoList.appendChild(thumb);
  });
}

function syncLayoutButtons() {
  document.querySelectorAll('.layout-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
}

function setLayout(layout) {
  state.layout = layout;
  state.panels = freshPanels();
  state.selected = 0;
  syncLayoutButtons();
  rebuildPanelList();
  redraw();
}

async function addPhotoFile(file) {
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  state.photos.push({ img, name: file.name, url });
  const pi = state.photos.length - 1;
  state.panels.forEach((slot, i) => { if (slot.photo === -1) { slot.photo = pi; applyCropPreset(slot, i); } });
  rebuildPhotoList();
  rebuildPanelList();
  redraw();
  return pi;
}

async function addSample(sample) {
  if (state.photos.some((p) => p.name === sample.name)) return;
  const img = await loadImage(sample.url);
  state.photos.push({ img, name: sample.name, url: sample.url });
  const pi = state.photos.length - 1;
  state.panels.forEach((slot, i) => { if (slot.photo === -1) { slot.photo = pi; applyCropPreset(slot, i); } });
  rebuildPhotoList();
  rebuildPanelList();
  redraw();
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Renders the cover at an export size and downloads it as a PNG. */
function exportPNG(key) {
  const size = SIZES[key];
  state.size = size;
  sizeLabel.textContent = size.label;
  redraw();
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCoverArt(off, state);
  off.toBlob((blob) => {
    if (!blob) { status.textContent = 'Export failed.'; return; }
    downloadBlob(blob, `sunset-cover-${size.w}x${size.h}.png`);
    status.textContent = `Saved sunset-cover-${size.w}x${size.h}.png`;
  }, 'image/png');
}

// --- pointer editing on the preview: click a panel to select it, drag to pan its photo, wheel to zoom.
let drag = null;
function canvasPoint(e) {
  const r = preview.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (preview.width / r.width),
    y: (e.clientY - r.top) * (preview.height / r.height),
  };
}
preview.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const rects = coverPanels(state.layout, preview.width, preview.height);
  const hit = rects.findIndex((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
  if (hit === -1) return;
  state.selected = hit;
  const slot = state.panels[hit];
  drag = { x: p.x, y: p.y, ox: slot.ox, oy: slot.oy, rect: rects[hit] };
  preview.setPointerCapture(e.pointerId);
  rebuildPanelList();
  redraw();
});
preview.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const slot = state.panels[state.selected];
  slot.ox = drag.ox + (p.x - drag.x) / drag.rect.w;
  slot.oy = drag.oy + (p.y - drag.y) / drag.rect.h;
  redraw();
});
preview.addEventListener('pointerup', () => { drag = null; });
preview.addEventListener('wheel', (e) => {
  e.preventDefault();
  const slot = state.panels[state.selected];
  slot.zoom = Math.max(1, Math.min(3, slot.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
  rebuildPanelList();
  redraw();
}, { passive: false });

// --- controls
document.getElementById('photoFile').addEventListener('change', async (e) => {
  for (const file of e.target.files) await addPhotoFile(file);
  status.textContent = `${state.photos.length} photo(s) loaded. Click a panel, then drag it to position the photo.`;
});
document.querySelectorAll('.sample-btn').forEach((b) => {
  b.addEventListener('click', async () => {
    await addSample(SAMPLES.find((s) => s.name === b.dataset.sample));
    status.textContent = `Sample "${b.dataset.sample}" loaded into the empty panels.`;
  });
});
document.querySelectorAll('.layout-btn').forEach((b) => {
  b.addEventListener('click', () => setLayout(b.dataset.layout));
});
titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });
gradeInput.addEventListener('input', () => {
  state.grade = Number(gradeInput.value) / 100;
  gradeValue.textContent = `${gradeInput.value}%`;
  redraw();
});
document.querySelectorAll('.export-btn').forEach((b) => {
  b.addEventListener('click', () => exportPNG(b.dataset.size));
});

// --- boot
async function boot() {
  state.panels = freshPanels();
  titleInput.value = state.title;
  subtitleInput.value = state.subtitle;
  gradeInput.value = String(Math.round(state.grade * 100));
  gradeValue.textContent = `${Math.round(state.grade * 100)}%`;
  sizeLabel.textContent = SIZES['1080x1080'].label;
  syncLayoutButtons();
  rebuildPanelList();
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) {
    await runShot(shot, new URLSearchParams(location.search), async (scene) => {
      state.layout = scene.layout;
      state.title = scene.title;
      state.subtitle = scene.subtitle;
      titleInput.value = state.title;
      subtitleInput.value = state.subtitle;
      if (scene.grade != null) {
        state.grade = Math.max(0, Math.min(1, scene.grade));
        gradeInput.value = String(Math.round(state.grade * 100));
        gradeValue.textContent = `${Math.round(state.grade * 100)}%`;
      }
      const [w, h] = scene.size.split('x').map(Number);
      state.size = { w, h };
      sizeLabel.textContent = `${w} × ${h}`;
      const img = await loadImage(`samples/${scene.photo}.jpg`);
      state.photos = [{ img, name: scene.photo, url: `samples/${scene.photo}.jpg` }];
      state.panels = freshPanels();
      state.panels.forEach((slot, i) => { slot.photo = 0; applyCropPreset(slot, i); });
      syncLayoutButtons();
      rebuildPanelList();
      rebuildPhotoList();
      redraw();
    });
    return;
  }
  try { await document.fonts.load('100px Anton'); } catch { /* fall back to sans-serif */ }
  redraw();
}
boot();
