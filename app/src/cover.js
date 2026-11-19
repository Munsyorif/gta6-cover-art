'use strict';
/* Sunset Cover Maker — poster renderer.
 *
 * Draws a multi-panel GTA-style poster on any canvas: each panel shows a
 * photo with its own crop (focal point + zoom), then a Vice City sunset
 * grade (warm overlay wash, low sun, vignette), palm silhouettes, and the
 * bold Anton caption across the bottom. The same drawPoster() paints the
 * live preview and the exported PNGs, so what you see is what you get.
 */

(function (global) {
  var FONT = 'Anton, "Arial Narrow", sans-serif';

  /* Panel geometry for each layout, as fractions of the poster size.
   * Returns [{x, y, w, h}] in pixels, with a small gap between panels. */
  function panelRects(layout, W, H) {
    var g = Math.max(2, Math.round(Math.min(W, H) * 0.012));
    var rects = [];
    if (layout === 'grid') {
      var hw = (W - g) / 2;
      var hh = (H - g) / 2;
      rects = [
        { x: 0, y: 0, w: hw, h: hh },
        { x: hw + g, y: 0, w: hw, h: hh },
        { x: 0, y: hh + g, w: hw, h: hh },
        { x: hw + g, y: hh + g, w: hw, h: hh },
      ];
    } else if (layout === 'triptych') {
      var cw = (W - 2 * g) / 3;
      for (var i = 0; i < 3; i++) {
        rects.push({ x: i * (cw + g), y: 0, w: cw, h: H });
      }
      rects.push({ x: 0, y: 0, w: 0, h: 0 }); // triptych uses three panels
    } else {
      // hero: big hero panel + three small ones
      if (W >= H * 1.3) {
        var heroW = Math.round(W * 0.62);
        var sideX = heroW + g;
        var sideW = W - sideX;
        var sh = (H - 2 * g) / 3;
        rects = [
          { x: 0, y: 0, w: heroW, h: H },
          { x: sideX, y: 0, w: sideW, h: sh },
          { x: sideX, y: sh + g, w: sideW, h: sh },
          { x: sideX, y: 2 * (sh + g), w: sideW, h: sh },
        ];
      } else {
        var heroH = Math.round(H * 0.58);
        var rowY = heroH + g;
        var rowH = H - rowY;
        var pw = (W - 2 * g) / 3;
        rects = [
          { x: 0, y: 0, w: W, h: heroH },
          { x: 0, y: rowY, w: pw, h: rowH },
          { x: pw + g, y: rowY, w: pw, h: rowH },
          { x: 2 * (pw + g), y: rowY, w: pw, h: rowH },
        ];
      }
    }
    return rects;
  }

  /* Paint one photo into a panel rect, cover-fit around the panel's focal
   * point (cx, cy in 0..1 of the photo) and zoom. The grade also lifts the
   * photo itself: more saturation and contrast, so a flat daylight shot
   * already reads as a warm sunset frame before the overlay wash. With
   * comic style on, the same draw passes through the #comic SVG filter
   * (posterized colour + thick edge outlines) after the saturation lift,
   * so preview and export always match. */
  function drawPhoto(ctx, img, rect, panel, grade, comic) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    var base = Math.max(rect.w / iw, rect.h / ih);
    var s = base * (panel.zoom || 1);
    var dw = iw * s;
    var dh = ih * s;
    var dx = rect.x + rect.w / 2 - (panel.cx || 0.5) * dw;
    var dy = rect.y + rect.h / 2 - (panel.cy || 0.5) * dh;
    var g = grade == null ? 0.7 : grade;
    var sat = 1 + 0.55 * g + (comic ? 0.25 : 0);
    var con = 1 + 0.18 * g + (comic ? 0.10 : 0);
    var f = 'saturate(' + sat.toFixed(2) + ') contrast(' + con.toFixed(2) + ')';
    if (comic) f += ' url(#comic)';
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.filter = f;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  /* A low sun disc with a warm halo, drawn inside the hero panel. */
  function drawSun(ctx, hero, W, H) {
    /* A low sun tucked into the lower-right of the hero panel, near the
     * horizon — faces sit upper-centre, so the disc never hides the subject. */
    var cx = hero.x + hero.w * 0.82;
    var cy = hero.y + hero.h * 0.74;
    var r = Math.max(hero.w, hero.h) * 0.11;
    var glow = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 2.4);
    glow.addColorStop(0, 'rgba(255, 196, 120, 0.85)');
    glow.addColorStop(0.35, 'rgba(255, 130, 80, 0.35)');
    glow.addColorStop(1, 'rgba(255, 120, 80, 0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = glow;
    ctx.fillRect(hero.x, hero.y, hero.w, hero.h);
    ctx.restore();
    var disc = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    disc.addColorStop(0, '#ffe9b0');
    disc.addColorStop(0.7, '#ffb36b');
    disc.addColorStop(1, '#ff7a5c');
    ctx.save();
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* One palm silhouette: a leaning trunk and a crown of drooping fronds.
   * (bx, by) is the base, h the height, lean the top's sideways drift. */
  function drawPalm(ctx, bx, by, h, lean, flip) {
    var tx = bx + lean;
    var ty = by - h;
    var dir = flip ? -1 : 1;
    ctx.save();
    ctx.fillStyle = '#150829';
    ctx.strokeStyle = '#150829';
    // Trunk: a tapered shape from the base to the crown.
    ctx.beginPath();
    ctx.moveTo(bx - h * 0.016, by);
    ctx.quadraticCurveTo(bx + lean * 0.4 - h * 0.02, by - h * 0.55, tx - h * 0.012, ty);
    ctx.lineTo(tx + h * 0.012, ty);
    ctx.quadraticCurveTo(bx + lean * 0.4 + h * 0.02, by - h * 0.55, bx + h * 0.016, by);
    ctx.closePath();
    ctx.fill();
    // Fronds: seven filled leaves fanning from the crown.
    var fronds = 7;
    for (var i = 0; i < fronds; i++) {
      var a = (-0.15 - i * 0.22) * Math.PI + (flip ? Math.PI : 0);
      var len = h * (0.34 + 0.1 * Math.sin(i * 1.7));
      var tipX = tx + Math.cos(a) * len * dir;
      var tipY = ty + Math.sin(a) * len * 0.55 + len * 0.34;
      var midX = tx + Math.cos(a) * len * 0.55 * dir;
      var midY = ty + Math.sin(a) * len * 0.4 - len * 0.1;
      var wdt = h * 0.035;
      var nx = -Math.sin(a) * wdt * dir;
      var ny = Math.cos(a) * wdt;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(midX + nx, midY + ny, tipX, tipY);
      ctx.quadraticCurveTo(midX - nx, midY - ny, tx, ty);
      ctx.closePath();
      ctx.fill();
    }
    // Coconuts at the crown.
    ctx.beginPath();
    ctx.arc(tx - h * 0.02, ty + h * 0.015, h * 0.018, 0, Math.PI * 2);
    ctx.arc(tx + h * 0.02, ty + h * 0.02, h * 0.016, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* A small gull: two short arcs. */
  function drawBird(ctx, x, y, s) {
    ctx.save();
    ctx.strokeStyle = 'rgba(26, 8, 46, 0.85)';
    ctx.lineWidth = Math.max(1.5, s * 0.08);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.55, x, y);
    ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.55, x + s, y);
    ctx.stroke();
    ctx.restore();
  }

  /* The sunset grade: a strong warm overlay wash plus a soft-light pass
   * and a vignette, strength 0..1. This is deliberately heavy — at the
   * default grade a plain daylight photo must already read as a sunset
   * poster frame, not as an untouched snapshot. */
  function drawGrade(ctx, W, H, grade) {
    var g = grade == null ? 0.7 : grade;
    ctx.save();
    var wash = ctx.createLinearGradient(0, 0, 0, H);
    wash.addColorStop(0, 'rgba(255, 122, 64, ' + (0.30 * g).toFixed(3) + ')');
    wash.addColorStop(0.55, 'rgba(255, 64, 128, ' + (0.36 * g).toFixed(3) + ')');
    wash.addColorStop(1, 'rgba(74, 22, 110, ' + (0.46 * g).toFixed(3) + ')');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);
    /* Hue shift: 'color' blend imposes the sunset hues (orange sky, pink
     * mid-tones, purple shadows) while keeping the photo's own brightness,
     * so a plain daylight shot stops looking like daylight. */
    var hue = ctx.createLinearGradient(0, 0, 0, H);
    hue.addColorStop(0, 'rgba(255, 140, 60, ' + (0.34 * g).toFixed(3) + ')');
    hue.addColorStop(0.55, 'rgba(255, 90, 120, ' + (0.30 * g).toFixed(3) + ')');
    hue.addColorStop(1, 'rgba(140, 50, 170, ' + (0.36 * g).toFixed(3) + ')');
    ctx.globalCompositeOperation = 'color';
    ctx.fillStyle = hue;
    ctx.fillRect(0, 0, W, H);
    var warm = ctx.createLinearGradient(0, 0, W, H);
    warm.addColorStop(0, 'rgba(255, 150, 60, ' + (0.28 * g).toFixed(3) + ')');
    warm.addColorStop(0.5, 'rgba(255, 80, 120, ' + (0.22 * g).toFixed(3) + ')');
    warm.addColorStop(1, 'rgba(120, 40, 160, ' + (0.30 * g).toFixed(3) + ')');
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(64, 12, 96, ' + (0.12 * g).toFixed(3) + ')';
    ctx.fillRect(0, H * 0.55, W, H * 0.45);
    var vig = ctx.createRadialGradient(
      W / 2, H / 2, Math.min(W, H) * 0.42,
      W / 2, H / 2, Math.max(W, H) * 0.75,
    );
    vig.addColorStop(0, 'rgba(16, 4, 32, 0)');
    vig.addColorStop(1, 'rgba(16, 4, 32, ' + (0.22 + 0.18 * g).toFixed(3) + ')');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* Bold Anton caption across the bottom, over a dark legibility band. */
  function drawCaption(ctx, W, H, title, subtitle) {
    var pad = Math.round(W * 0.03);
    var bandH = Math.round(H * 0.17);
    var band = ctx.createLinearGradient(0, H - bandH, 0, H);
    band.addColorStop(0, 'rgba(10, 4, 24, 0)');
    band.addColorStop(1, 'rgba(10, 4, 24, 0.88)');
    ctx.save();
    ctx.fillStyle = band;
    ctx.fillRect(0, H - bandH, W, bandH);
    // Accent rule above the subtitle.
    var rule = ctx.createLinearGradient(pad, 0, pad + W * 0.2, 0);
    rule.addColorStop(0, '#ff7a3c');
    rule.addColorStop(1, '#ff3d81');
    ctx.fillStyle = rule;
    ctx.fillRect(pad, H - bandH + Math.round(H * 0.028), Math.round(W * 0.2), Math.max(3, Math.round(H * 0.008)));
    var sub = (subtitle || '').trim();
    var top = (title || '').trim().toUpperCase() || 'SUNSET HEIST';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    try { ctx.letterSpacing = '0.02em'; } catch (e) { /* older canvas: no letter spacing */ }
    if (sub) {
      var subSize = Math.max(10, Math.round(H * 0.032));
      ctx.font = subSize + 'px ' + FONT;
      ctx.fillStyle = '#ffd9a0';
      ctx.fillText(sub.toUpperCase(), pad, H - bandH + Math.round(H * 0.028) + subSize + Math.round(H * 0.02));
    }
    var size = Math.round(H * 0.11);
    ctx.font = size + 'px ' + FONT;
    var maxW = W - pad * 2;
    while (size > Math.round(H * 0.04) && ctx.measureText(top).width > maxW) {
      size = Math.round(size * 0.92);
      ctx.font = size + 'px ' + FONT;
    }
    var baseY = H - Math.round(H * 0.035);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#160826';
    ctx.lineWidth = Math.max(3, Math.round(size * 0.16));
    ctx.strokeText(top, pad, baseY);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(top, pad, baseY);
    ctx.restore();
  }

  /* Paint the whole poster. state: {layout, title, subtitle, grade,
   * photos: [{img}], panels: [{photo, zoom, cx, cy}]} */
  function drawPoster(ctx, W, H, state) {
    ctx.save();
    ctx.fillStyle = '#0d0714';
    ctx.fillRect(0, 0, W, H);
    var rects = panelRects(state.layout || 'hero', W, H);
    var count = state.layout === 'triptych' ? 3 : 4;
    for (var i = 0; i < count; i++) {
      var panel = (state.panels && state.panels[i]) || { photo: 0, zoom: 1, cx: 0.5, cy: 0.5 };
      var photo = state.photos && state.photos[panel.photo];
      if (photo && photo.img) {
        drawPhoto(ctx, photo.img, rects[i], panel, state.grade, state.comic);
      } else {
        ctx.fillStyle = i === 0 ? '#241533' : '#1a1026';
        ctx.fillRect(rects[i].x, rects[i].y, rects[i].w, rects[i].h);
      }
    }
    drawSun(ctx, rects[0], W, H);
    /* The grade sits on top of everything. With comic style on, the
     * posterized panels are already punchy, so the wash is eased a little
     * (x0.85) to keep the cover clean instead of muddy. */
    drawGrade(ctx, W, H, state.comic ? state.grade * 0.85 : state.grade);
    // Birds in the hero sky.
    drawBird(ctx, rects[0].x + rects[0].w * 0.24, rects[0].y + rects[0].h * 0.16, Math.max(10, W * 0.018));
    drawBird(ctx, rects[0].x + rects[0].w * 0.34, rects[0].y + rects[0].h * 0.1, Math.max(8, W * 0.013));
    // Palms: a tall one bottom-right, a shorter one along the left edge.
    drawPalm(ctx, W * 0.995, H * 1.0, H * 0.36, -W * 0.05, true);
    drawPalm(ctx, W * 0.005, H * 1.0, H * 0.2, W * 0.03, false);
    drawCaption(ctx, W, H, state.title, state.subtitle);
    // Thin poster frame.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = Math.max(2, Math.round(Math.min(W, H) * 0.004));
    ctx.strokeRect(1, 1, W - 2, H - 2);
    ctx.restore();
  }

  /* A fresh canvas with the poster painted at W x H. */
  function makeCanvas(W, H, state) {
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    drawPoster(canvas.getContext('2d'), W, H, state);
    return canvas;
  }

  global.SunsetCover = {
    panelRects: panelRects,
    drawPoster: drawPoster,
    makeCanvas: makeCanvas,
    layouts: ['hero', 'grid', 'triptych'],
  };
})(window);
