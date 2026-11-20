'use strict';
/* Sunset Cover Maker — poster renderer.
 *
 * One function paints the whole poster on any canvas: each visible panel
 * shows a photo cover-fit around its own focal point and zoom, then a
 * Vice City sunset grade is laid over everything (warm overlay wash, a low
 * sun, palm silhouettes, birds, vignette) and the Anton caption sits in a
 * dark band across the bottom. The same painter draws the live preview and
 * the exported PNG, so what you see is what you get.
 */

(function (global) {
  var DISPLAY_FONT = 'Anton, "Arial Narrow", sans-serif';
  var GAP_FRAC = 0.012;

  /* Panel rectangles for a layout, as fractions of the poster, returned in
   * pixels. Triptych shows three columns; its fourth rect is empty. */
  function layoutRects(layout, W, H) {
    var g = Math.max(2, Math.round(Math.min(W, H) * GAP_FRAC));
    var rects;
    if (layout === 'grid') {
      var halfW = (W - g) / 2;
      var halfH = (H - g) / 2;
      rects = [
        { x: 0, y: 0, w: halfW, h: halfH },
        { x: halfW + g, y: 0, w: halfW, h: halfH },
        { x: 0, y: halfH + g, w: halfW, h: halfH },
        { x: halfW + g, y: halfH + g, w: halfW, h: halfH },
      ];
    } else if (layout === 'triptych') {
      var colW = (W - 2 * g) / 3;
      rects = [];
      for (var i = 0; i < 3; i++) {
        rects.push({ x: i * (colW + g), y: 0, w: colW, h: H });
      }
      rects.push({ x: 0, y: 0, w: 0, h: 0 });
    } else {
      // hero: one big panel plus three small ones.
      if (W >= H) {
        var heroW = Math.round(W * 0.62);
        var sideX = heroW + g;
        var sideW = W - sideX;
        var stripH = (H - 2 * g) / 3;
        rects = [
          { x: 0, y: 0, w: heroW, h: H },
          { x: sideX, y: 0, w: sideW, h: stripH },
          { x: sideX, y: stripH + g, w: sideW, h: stripH },
          { x: sideX, y: 2 * (stripH + g), w: sideW, h: stripH },
        ];
      } else {
        var heroH = Math.round(H * 0.56);
        var rowY = heroH + g;
        var rowH = H - rowY;
        var cellW = (W - 2 * g) / 3;
        rects = [
          { x: 0, y: 0, w: W, h: heroH },
          { x: 0, y: rowY, w: cellW, h: rowH },
          { x: cellW + g, y: rowY, w: cellW, h: rowH },
          { x: 2 * (cellW + g), y: rowY, w: cellW, h: rowH },
        ];
      }
    }
    return rects;
  }

  function visibleCount(layout) {
    return layout === 'triptych' ? 3 : 4;
  }

  /* One photo cover-fit into a panel, centred on the panel's focal point
   * (cx, cy in 0..1 of the photo) and scaled by its zoom. The grade lifts
   * the photo itself — extra saturation and contrast — and comic style
   * passes the same draw through the #comic SVG filter, so preview and
   * export always agree. */
  function paintPhoto(ctx, img, rect, panel, grade, comic) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih || rect.w <= 0 || rect.h <= 0) return;
    var base = Math.max(rect.w / iw, rect.h / ih);
    var scale = base * (panel.zoom || 1);
    var dw = iw * scale;
    var dh = ih * scale;
    var dx = rect.x + rect.w / 2 - (panel.cx == null ? 0.5 : panel.cx) * dw;
    var dy = rect.y + rect.h / 2 - (panel.cy == null ? 0.5 : panel.cy) * dh;
    // Clamp so the photo always covers the panel: a focal point near an
    // edge must never leave a gap of bare background at the other side.
    dx = Math.max(rect.x + rect.w - dw, Math.min(rect.x, dx));
    dy = Math.max(rect.y + rect.h - dh, Math.min(rect.y, dy));
    var sat = 1 + 0.55 * grade + (comic ? 0.25 : 0);
    var con = 1 + 0.18 * grade + (comic ? 0.10 : 0);
    var filter = 'saturate(' + sat.toFixed(2) + ') contrast(' + con.toFixed(2) + ')';
    if (comic) filter += ' url(#comic)';
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.filter = filter;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  /* Empty panel: a dusk gradient and an invitation, so the poster still
   * reads as a poster before any photo is loaded. */
  function paintEmpty(ctx, rect) {
    var grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    grad.addColorStop(0, '#ff8c2e');
    grad.addColorStop(0.55, '#e83e8c');
    grad.addColorStop(1, '#5b2a86');
    ctx.fillStyle = grad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = Math.max(14, Math.round(rect.w * 0.055)) + 'px ' + DISPLAY_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('YOUR PHOTO HERE', rect.x + rect.w / 2, rect.y + rect.h / 2);
  }

  /* A glowing low sun disc with a warm halo, clipped to the hero panel.
   * It sits high in the hero's top-right corner, clear of the subject. */
  function paintSun(ctx, hero, grade) {
    if (hero.w <= 0 || hero.h <= 0) return;
    var cx = hero.x + hero.w * 0.85;
    var cy = hero.y + hero.h * 0.16;
    var r = Math.max(hero.w, hero.h) * 0.085;
    ctx.save();
    ctx.beginPath();
    ctx.rect(hero.x, hero.y, hero.w, hero.h);
    ctx.clip();
    var halo = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 3.2);
    halo.addColorStop(0, 'rgba(255, 190, 90, ' + (0.45 * grade + 0.12).toFixed(2) + ')');
    halo.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(hero.x, hero.y, hero.w, hero.h);
    // One solid warm disc: no inner ring, so it reads as a sun, not a moon.
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* One palm silhouette: a leaning trunk and seven drooping fronds. */
  function paintPalm(ctx, x, y, size, lean) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ctx.strokeStyle = 'rgba(18, 6, 34, 0.92)';
    ctx.fillStyle = 'rgba(18, 6, 34, 0.92)';
    ctx.lineCap = 'round';
    // Trunk, leaning by `lean`.
    ctx.lineWidth = 0.09;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(lean * 0.4, -0.55, lean, -1);
    ctx.stroke();
    // Fronds fanning out from the crown: each one arches up from the crown
    // and droops toward its tip, thinner than the trunk.
    ctx.lineWidth = 0.035;
    for (var i = 0; i < 7; i++) {
      var a = Math.PI * (0.08 + (i / 6) * 0.84);
      var tipX = lean + Math.cos(a) * 0.62;
      var tipY = -1 - Math.sin(a) * 0.42 + 0.38;
      var midX = lean + Math.cos(a) * 0.32;
      var midY = -1 - Math.sin(a) * 0.30 - 0.06;
      ctx.beginPath();
      ctx.moveTo(lean, -1);
      ctx.quadraticCurveTo(midX, midY, tipX, tipY);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* Palms along the hero panel's bottom edge, plus a small one in a
   * corner of the last side panel, so the silhouette reads at any size. */
  function paintPalms(ctx, rects, W, H) {
    var hero = rects[0];
    if (hero.w <= 0) return;
    var base = hero.y + hero.h;
    var s = Math.min(hero.w, hero.h) * 0.40;
    paintPalm(ctx, hero.x + hero.w * 0.07, base, s, 0.25);
    paintPalm(ctx, hero.x + hero.w * 0.30, base, s * 0.68, -0.18);
    paintPalm(ctx, hero.x + hero.w * 0.92, base, s * 0.6, -0.3);
    var last = rects[rects.length - 1];
    if (last && last.w > 0 && rects.length > 1) {
      paintPalm(ctx, last.x + last.w * 0.85, last.y + last.h, Math.min(last.w, last.h) * 0.5, -0.2);
    }
  }

  /* A few distant birds, two short strokes each, high in the hero panel. */
  function paintBirds(ctx, hero, grade) {
    if (hero.w <= 0) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(24, 8, 40, ' + (0.35 + 0.45 * grade).toFixed(2) + ')';
    ctx.lineWidth = Math.max(1.5, hero.w * 0.004);
    ctx.lineCap = 'round';
    var spots = [
      [0.42, 0.16, 0.030], [0.55, 0.11, 0.022], [0.63, 0.20, 0.026], [0.34, 0.24, 0.018],
    ];
    for (var i = 0; i < spots.length; i++) {
      var bx = hero.x + hero.w * spots[i][0];
      var by = hero.y + hero.h * spots[i][1];
      var bw = hero.w * spots[i][2];
      ctx.beginPath();
      ctx.moveTo(bx - bw, by);
      ctx.quadraticCurveTo(bx - bw * 0.4, by - bw * 0.7, bx, by);
      ctx.quadraticCurveTo(bx + bw * 0.4, by - bw * 0.7, bx + bw, by);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* The sunset wash: a warm overlay gradient over the whole poster, plus
   * a faint straight wash so the colour holds even where the overlay
   * blend is subtle, then a vignette that darkens the corners. */
  function paintGrade(ctx, W, H, grade) {
    if (grade <= 0) return;
    var wash = ctx.createLinearGradient(0, 0, 0, H);
    wash.addColorStop(0, 'rgba(255, 122, 26, 1)');
    wash.addColorStop(0.5, 'rgba(255, 46, 136, 1)');
    wash.addColorStop(1, 'rgba(123, 47, 247, 1)');
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.30 * grade;
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.10 * grade;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    var vig = ctx.createRadialGradient(
      W / 2, H / 2, Math.min(W, H) * 0.42,
      W / 2, H / 2, Math.max(W, H) * 0.75
    );
    vig.addColorStop(0, 'rgba(8, 2, 18, 0)');
    vig.addColorStop(1, 'rgba(8, 2, 18, ' + (0.12 + 0.30 * grade).toFixed(2) + ')');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  /* The caption band: a dark gradient strip across the poster's bottom,
   * subtitle in small letterspaced caps above the big Anton title. The
   * title shrinks until it fits the poster width. */
  function paintCaption(ctx, W, H, title, subtitle) {
    var bandH = Math.round(H * 0.20);
    var band = ctx.createLinearGradient(0, H - bandH, 0, H);
    band.addColorStop(0, 'rgba(10, 3, 22, 0)');
    band.addColorStop(1, 'rgba(10, 3, 22, 0.88)');
    ctx.fillStyle = band;
    ctx.fillRect(0, H - bandH, W, bandH);

    var pad = Math.round(W * 0.035);
    var maxW = W - pad * 2;
    var text = (title || '').toUpperCase();
    var size = Math.round(W * 0.088);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = size + 'px ' + DISPLAY_FONT;
    while (size > 18 && ctx.measureText(text).width > maxW) {
      size -= 2;
      ctx.font = size + 'px ' + DISPLAY_FONT;
    }
    var titleY = H - Math.round(H * 0.028);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(20, 4, 36, 0.9)';
    ctx.lineWidth = Math.max(2, size * 0.10);
    ctx.strokeText(text, pad, titleY);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, pad, titleY);

    var sub = (subtitle || '').toUpperCase();
    if (sub) {
      var subSize = Math.max(12, Math.round(W * 0.024));
      ctx.font = subSize + 'px ' + DISPLAY_FONT;
      ctx.fillStyle = '#ffd9a8';
      var subY = titleY - size - Math.round(H * 0.018);
      ctx.fillText(spaced(sub), pad, subY);
    }
  }

  /* Letterspacing by hand: canvas has no letter-spacing on every engine,
   * so spaces are inserted between characters. */
  function spaced(text) {
    return text.split('').join(' ');
  }

  /* Paint the whole poster. state: {layout, panels, photos, title,
   * subtitle, grade, comic}. */
  function drawPoster(ctx, W, H, state) {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#160a24';
    ctx.fillRect(0, 0, W, H);
    var rects = layoutRects(state.layout, W, H);
    var count = visibleCount(state.layout);
    for (var i = 0; i < count; i++) {
      var panel = state.panels[i];
      var photo = panel ? state.photos[panel.photo] : null;
      if (photo && photo.img) {
        paintPhoto(ctx, photo.img, rects[i], panel, state.grade, state.comic);
      } else {
        paintEmpty(ctx, rects[i]);
      }
    }
    paintSun(ctx, rects[0], state.grade);
    paintBirds(ctx, rects[0], state.grade);
    paintPalms(ctx, rects, W, H);
    paintGrade(ctx, W, H, state.grade);
    paintCaption(ctx, W, H, state.title, state.subtitle);
    ctx.restore();
    return rects;
  }

  function freshPanels() {
    var panels = [];
    var defaults = [
      { cx: 0.5, cy: 0.32 },
      { cx: 0.5, cy: 0.5 },
      { cx: 0.5, cy: 0.5 },
      { cx: 0.5, cy: 0.62 },
    ];
    for (var i = 0; i < 4; i++) {
      panels.push({ photo: 0, cx: defaults[i].cx, cy: defaults[i].cy, zoom: 1 });
    }
    return panels;
  }

  function createPoster(canvas) {
    var state = {
      layout: 'hero',
      photos: [],
      panels: freshPanels(),
      selected: 0,
      title: 'SUNSET HEIST',
      subtitle: 'VICE CITY • 2026',
      grade: 0.7,
      comic: false,
      exportW: 1920,
      exportH: 1080,
    };

    function render() {
      var ctx = canvas.getContext('2d');
      return drawPoster(ctx, canvas.width, canvas.height, state);
    }

    function loadImage(src, name) {
      return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () {
          state.photos.push({ name: name, img: img });
          resolve(state.photos.length - 1);
        };
        img.onerror = function () { reject(new Error('could not load ' + name)); };
        img.src = src;
      });
    }

    function loadSample(which) {
      return loadImage('samples/' + which + '.jpeg', which);
    }

    /* Distinct crops of one photo across every visible panel. */
    function fillAll() {
      var crops = [
        { cx: 0.5, cy: 0.30, zoom: 1 },
        { cx: 0.22, cy: 0.5, zoom: 1.25 },
        { cx: 0.78, cy: 0.5, zoom: 1.25 },
        { cx: 0.5, cy: 0.70, zoom: 1.4 },
      ];
      var idx = state.panels[state.selected].photo;
      var count = visibleCount(state.layout);
      for (var i = 0; i < count; i++) {
        state.panels[i].photo = idx;
        state.panels[i].cx = crops[i].cx;
        state.panels[i].cy = crops[i].cy;
        state.panels[i].zoom = crops[i].zoom;
      }
    }

    function exportDataURL(w, h) {
      var off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      var ctx = off.getContext('2d');
      drawPoster(ctx, w, h, state);
      return off.toDataURL('image/png');
    }

    return {
      state: state,
      render: render,
      loadImage: loadImage,
      loadSample: loadSample,
      fillAll: fillAll,
      exportDataURL: exportDataURL,
      layoutRects: layoutRects,
      setLayout: function (layout) { state.layout = layout; },
      setTitle: function (title, subtitle) {
        if (title != null) state.title = title;
        if (subtitle != null) state.subtitle = subtitle;
      },
      setGrade: function (grade) { state.grade = grade; },
      setComic: function (on) { state.comic = !!on; },
      setExportSize: function (w, h) { state.exportW = w; state.exportH = h; },
    };
  }

  global.SunsetPoster = { create: createPoster, drawPoster: drawPoster, layoutRects: layoutRects };
})(window);
