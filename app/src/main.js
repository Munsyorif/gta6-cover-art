'use strict';
/* Sunset Cover Maker — editor.
 *
 * Owns the app state (layout, caption, grade, photos, one crop per panel)
 * and wires it to the page: photo upload + samples, layout picker, panel
 * picking by click, drag to pan, wheel/slider to zoom, anchor presets, and
 * one-click PNG export in the three post sizes. The poster itself is painted
 * by cover.js (SunsetCover.drawPoster), so the preview and the export are
 * always the same drawing.
 */

(function () {
  var SAMPLES = [
    { name: 'boulevard', label: 'Boulevard', src: 'samples/boulevard.jpeg' },
    { name: 'pier', label: 'Pier', src: 'samples/pier.jpeg' },
  ];

  /* One crop per panel: which photo, how far zoomed, and which point of the
   * photo sits at the panel's centre. Distinct defaults so a single photo
   * fills four panels with four genuinely different crops. */
  function defaultPanels() {
    return [
      { photo: 0, zoom: 1, cx: 0.5, cy: 0.32 },
      { photo: 0, zoom: 1.2, cx: 0.22, cy: 0.5 },
      { photo: 0, zoom: 1.2, cx: 0.78, cy: 0.5 },
      { photo: 0, zoom: 1.35, cx: 0.5, cy: 0.68 },
    ];
  }

  var ANCHORS = {
    center: { cx: 0.5, cy: 0.5 },
    top: { cx: 0.5, cy: 0.2 },
    face: { cx: 0.5, cy: 0.32 },
    left: { cx: 0.22, cy: 0.5 },
    right: { cx: 0.78, cy: 0.5 },
  };

  var EXPORT_SIZES = [
    { w: 1080, h: 1080, label: '1080 × 1080' },
    { w: 1080, h: 1350, label: '1080 × 1350' },
    { w: 1920, h: 1080, label: '1920 × 1080' },
  ];

  var state = {
    layout: 'hero',
    title: 'SUNSET HEIST',
    subtitle: 'VICE CITY \u2022 2026',
    grade: 0.7,
    comic: false,
    photos: [],
    panels: defaultPanels(),
    exportSize: EXPORT_SIZES[2],
  };
  var selected = 0;
  var canvas = null;
  var stageWrap = null;
  var selBox = null;
  var panelLabel = null;
  var renderQueued = false;

  function $(id) { return document.getElementById(id); }

  /* Preview canvas size: the export aspect at a long side of 960. */
  function previewDims() {
    var s = state.exportSize;
    var scale = 960 / Math.max(s.w, s.h);
    return { w: Math.round(s.w * scale), h: Math.round(s.h * scale) };
  }

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(function () {
      renderQueued = false;
      render();
    });
  }

  /* Comic style state + the toggle button. Defined here (IIFE scope) so the
   * editor wiring, the ?comic=1 query path and the __cover API all share it. */
  function syncComicBtn() {
    var comicBtn = $('comicToggle');
    if (!comicBtn) return;
    comicBtn.classList.toggle('active', state.comic);
    comicBtn.setAttribute('aria-pressed', state.comic ? 'true' : 'false');
    comicBtn.textContent = state.comic ? 'Comic style: on' : 'Comic style: off';
  }
  function setComic(on) {
    state.comic = !!on;
    syncComicBtn();
    queueRender();
  }

  function render() {
    if (!canvas) return;
    var d = previewDims();
    if (canvas.width !== d.w || canvas.height !== d.h) {
      canvas.width = d.w;
      canvas.height = d.h;
    }
    var ctx = canvas.getContext('2d');
    SunsetCover.drawPoster(ctx, d.w, d.h, state);
    updateSelectionBox();
  }

  function panelCount() {
    return state.layout === 'triptych' ? 3 : 4;
  }

  function updateSelectionBox() {
    if (!selBox || !canvas) return;
    var d = previewDims();
    var rects = SunsetCover.panelRects(state.layout, d.w, d.h);
    var r = rects[Math.min(selected, panelCount() - 1)];
    selBox.style.display = 'block';
    selBox.style.left = (r.x / d.w * 100) + '%';
    selBox.style.top = (r.y / d.h * 100) + '%';
    selBox.style.width = (r.w / d.w * 100) + '%';
    selBox.style.height = (r.h / d.h * 100) + '%';
    if (panelLabel) {
      panelLabel.textContent = 'Panel ' + (selected + 1) + ' of ' + panelCount();
    }
    var zoom = $('zoomRange');
    var zoomVal = $('zoomVal');
    var panel = state.panels[selected];
    if (zoom) zoom.value = String(Math.round(panel.zoom * 100));
    if (zoomVal) zoomVal.textContent = panel.zoom.toFixed(2) + '\u00d7';
    var sel = $('photoSelect');
    if (sel) sel.value = String(panel.photo);
  }

  /* Clamp a panel's focal point so the panel never shows empty space. */
  function clampPan(panel, rect, img) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    var s = Math.max(rect.w / iw, rect.h / ih) * panel.zoom;
    var sw = rect.w / s;
    var sh = rect.h / s;
    var minCx = sw >= iw ? 0.5 : (sw / 2) / iw;
    var maxCx = sw >= iw ? 0.5 : 1 - (sw / 2) / iw;
    var minCy = sh >= ih ? 0.5 : (sh / 2) / ih;
    var maxCy = sh >= ih ? 0.5 : 1 - (sh / 2) / ih;
    panel.cx = Math.min(maxCx, Math.max(minCx, panel.cx));
    panel.cy = Math.min(maxCy, Math.max(minCy, panel.cy));
  }

  function hitPanel(clientX, clientY) {
    var box = canvas.getBoundingClientRect();
    var x = (clientX - box.left) * (canvas.width / box.width);
    var y = (clientY - box.top) * (canvas.height / box.height);
    var rects = SunsetCover.panelRects(state.layout, canvas.width, canvas.height);
    for (var i = 0; i < panelCount(); i++) {
      var r = rects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  }

  function bindCanvas() {
    var dragging = false;
    var lastX = 0;
    var lastY = 0;
    canvas.addEventListener('pointerdown', function (ev) {
      var hit = hitPanel(ev.clientX, ev.clientY);
      if (hit < 0) return;
      selected = hit;
      dragging = true;
      lastX = ev.clientX;
      lastY = ev.clientY;
      canvas.setPointerCapture(ev.pointerId);
      updateSelectionBox();
    });
    canvas.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
      var box = canvas.getBoundingClientRect();
      var scaleX = canvas.width / box.width;
      var scaleY = canvas.height / box.height;
      var dx = (ev.clientX - lastX) * scaleX;
      var dy = (ev.clientY - lastY) * scaleY;
      lastX = ev.clientX;
      lastY = ev.clientY;
      var panel = state.panels[selected];
      var photo = state.photos[panel.photo];
      if (!photo || !photo.img) return;
      var rects = SunsetCover.panelRects(state.layout, canvas.width, canvas.height);
      var rect = rects[selected];
      var iw = photo.img.naturalWidth;
      var ih = photo.img.naturalHeight;
      var s = Math.max(rect.w / iw, rect.h / ih) * panel.zoom;
      panel.cx -= dx / (s * iw);
      panel.cy -= dy / (s * ih);
      clampPan(panel, rect, photo.img);
      queueRender();
    });
    canvas.addEventListener('pointerup', function () { dragging = false; });
    canvas.addEventListener('pointercancel', function () { dragging = false; });
    canvas.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var panel = state.panels[selected];
      panel.zoom = Math.min(4, Math.max(1, panel.zoom * Math.exp(-ev.deltaY * 0.0012)));
      queueRender();
    }, { passive: false });
  }

  function addPhoto(img, label) {
    var index = state.photos.length;
    state.photos.push({ img: img, label: label });
    var sel = $('photoSelect');
    if (sel) {
      var opt = document.createElement('option');
      opt.value = String(index);
      opt.textContent = label;
      sel.appendChild(opt);
    }
    return index;
  }

  function loadImageFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var index = addPhoto(img, file.name);
        if (state.photos.length === 1) {
          for (var i = 0; i < state.panels.length; i++) state.panels[i].photo = 0;
        }
        selected = 0;
        queueRender();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function loadSample(name) {
    var sample = null;
    for (var i = 0; i < SAMPLES.length; i++) {
      if (SAMPLES[i].name === name) sample = SAMPLES[i];
    }
    if (!sample) return Promise.resolve(false);
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var existing = -1;
        for (var j = 0; j < state.photos.length; j++) {
          if (state.photos[j].label === sample.label) existing = j;
        }
        var index = existing >= 0 ? existing : addPhoto(img, sample.label);
        state.panels[selected].photo = index;
        queueRender();
        resolve(true);
      };
      img.onerror = function () { resolve(false); };
      img.src = sample.src;
    });
  }

  function fillAllWithSelectedPhoto() {
    var panel = state.panels[selected];
    var anchors = ['face', 'left', 'right', 'top'];
    for (var i = 0; i < state.panels.length; i++) {
      state.panels[i].photo = panel.photo;
      var a = ANCHORS[anchors[i % anchors.length]];
      state.panels[i].cx = a.cx;
      state.panels[i].cy = a.cy;
      state.panels[i].zoom = i === 0 ? 1 : 1.25;
    }
    queueRender();
  }

  function exportPNG(w, h) {
    var c = SunsetCover.makeCanvas(w, h, state);
    return new Promise(function (resolve, reject) {
      try {
        c.toBlob(function (blob) {
          if (blob) resolve(blob);
          else reject(new Error('Export failed: the browser refused to read the canvas.'));
        }, 'image/png');
      } catch (e) {
        /* Chrome blocks canvas export when index.html is opened straight
         * from file:// (the local photos taint the canvas). Served over
         * http://localhost:8080 — how the app is meant to run — it works. */
        reject(new Error('Export blocked: this browser will not export a canvas opened from file://. Run "node serve.ts" and open http://localhost:8080 instead.'));
      }
    });
  }

  function downloadExport(size) {
    exportPNG(size.w, size.h).then(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'sunset-cover-' + size.w + 'x' + size.h + '.png';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 1000);
    }).catch(function (err) {
      window.alert(err && err.message ? err.message : String(err));
    });
  }

  function applyQuery() {
    var q = new URLSearchParams(window.location.search);
    var shot = q.get('shot');
    var layout = q.get('layout');
    if (layout && SunsetCover.layouts.indexOf(layout) >= 0) state.layout = layout;
    var title = q.get('title');
    if (title) state.title = title;
    var subtitle = q.get('subtitle');
    if (subtitle != null) state.subtitle = subtitle;
    var grade = parseFloat(q.get('grade') || '');
    if (!isNaN(grade)) state.grade = Math.min(1, Math.max(0, grade));
    if (q.get('comic') === '1') state.comic = true;
    var size = q.get('size');
    if (size) {
      var parts = size.split('x');
      var w = parseInt(parts[0], 10);
      var h = parseInt(parts[1], 10);
      if (w > 0 && h > 0) state.exportSize = { w: w, h: h, label: size };
    }
    return shot;
  }

  function bindControls() {
    var fileInput = $('fileInput');
    var uploadBtn = $('uploadBtn');
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function () {
        var files = fileInput.files;
        for (var i = 0; i < files.length; i++) loadImageFile(files[i]);
        fileInput.value = '';
      });
    }
    SAMPLES.forEach(function (sample) {
      var btn = $('sample-' + sample.name);
      if (btn) btn.addEventListener('click', function () { loadSample(sample.name); });
    });
    var layoutBtns = document.querySelectorAll('[data-layout]');
    layoutBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.layout = btn.getAttribute('data-layout');
        if (selected >= panelCount()) selected = 0;
        layoutBtns.forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        queueRender();
      });
    });
    var titleInput = $('titleInput');
    if (titleInput) {
      titleInput.value = state.title;
      titleInput.addEventListener('input', function () {
        state.title = titleInput.value;
        queueRender();
      });
    }
    var subtitleInput = $('subtitleInput');
    if (subtitleInput) {
      subtitleInput.value = state.subtitle;
      subtitleInput.addEventListener('input', function () {
        state.subtitle = subtitleInput.value;
        queueRender();
      });
    }
    var gradeRange = $('gradeRange');
    if (gradeRange) {
      gradeRange.value = String(Math.round(state.grade * 100));
      gradeRange.addEventListener('input', function () {
        state.grade = parseInt(gradeRange.value, 10) / 100;
        var gv = $('gradeVal');
        if (gv) gv.textContent = gradeRange.value + '%';
        queueRender();
      });
    }
    /* Comic style toggle: posterized colour + thick edge outlines, applied
     * to the user's own photos at draw time (preview and export alike). */
    var comicBtn = $('comicToggle');
    if (comicBtn) {
      comicBtn.addEventListener('click', function () { setComic(!state.comic); });
      syncComicBtn();
    }
    var photoSelect = $('photoSelect');
    if (photoSelect) {
      photoSelect.addEventListener('change', function () {
        state.panels[selected].photo = parseInt(photoSelect.value, 10) || 0;
        queueRender();
      });
    }
    var fillAll = $('fillAllBtn');
    if (fillAll) fillAll.addEventListener('click', fillAllWithSelectedPhoto);
    document.querySelectorAll('[data-anchor]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var a = ANCHORS[btn.getAttribute('data-anchor')];
        if (!a) return;
        var panel = state.panels[selected];
        panel.cx = a.cx;
        panel.cy = a.cy;
        queueRender();
      });
    });
    var zoomRange = $('zoomRange');
    if (zoomRange) {
      zoomRange.addEventListener('input', function () {
        state.panels[selected].zoom = Math.min(4, Math.max(1, parseInt(zoomRange.value, 10) / 100));
        queueRender();
      });
    }
    document.querySelectorAll('[data-export]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var w = parseInt(btn.getAttribute('data-w'), 10);
        var h = parseInt(btn.getAttribute('data-h'), 10);
        state.exportSize = { w: w, h: h, label: w + ' \u00d7 ' + h };
        document.querySelectorAll('[data-export]').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        downloadExport(state.exportSize);
        queueRender();
      });
    });
  }

  function init() {
    canvas = $('poster');
    stageWrap = $('stageWrap');
    selBox = $('selBox');
    panelLabel = $('panelLabel');
    var shot = applyQuery();
    bindControls();
    bindCanvas();
    // Anton, vendored locally: load it before the first paint, repaint after.
    if (document.fonts && document.fonts.load) {
      var face = new FontFace('Anton', 'url(fonts/Anton-Regular.ttf)');
      face.load().then(function (loaded) {
        document.fonts.add(loaded);
        queueRender();
      }).catch(function () { queueRender(); });
      if (document.fonts.ready) document.fonts.ready.then(function () { queueRender(); });
    }
    // Start with a sample photo so the poster is never empty.
    var startPhoto = new URLSearchParams(window.location.search).get('photo') || 'pier';
    loadSample(startPhoto).then(function () {
      if (shot === 'cover') {
        // Cover shots keep the hero crop tight on the subject.
        state.panels[0].cx = 0.5;
        state.panels[0].cy = 0.32;
      }
      queueRender();
    });
    render();
  }

  window.__cover = {
    state: state,
    render: render,
    queueRender: queueRender,
    loadSample: loadSample,
    exportPNG: exportPNG,
    exportDataURL: function (w, h) {
      return exportPNG(w, h).then(function (blob) {
        return new Promise(function (resolve) {
          var reader = new FileReader();
          reader.onload = function () { resolve(reader.result); };
          reader.readAsDataURL(blob);
        });
      });
    },
    setLayout: function (layout) {
      if (SunsetCover.layouts.indexOf(layout) >= 0) {
        state.layout = layout;
        if (selected >= panelCount()) selected = 0;
        queueRender();
      }
    },
    setTitle: function (title, subtitle) {
      if (title != null) state.title = title;
      if (subtitle != null) state.subtitle = subtitle;
      queueRender();
    },
    setGrade: function (g) {
      state.grade = Math.min(1, Math.max(0, g));
      queueRender();
    },
    setComic: function (on) {
      setComic(on);
    },
    setExportSize: function (w, h) {
      state.exportSize = { w: w, h: h, label: w + ' \u00d7 ' + h };
      queueRender();
    },
    ready: null,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
