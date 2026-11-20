'use strict';
/* Sunset Cover Maker — editor wiring.
 *
 * Connects the sidebar controls to the poster renderer: uploads and
 * samples, layout and caption inputs, the grade slider and comic toggle,
 * panel picking with drag-to-pan and scroll-to-zoom, per-panel anchors,
 * and the PNG export buttons. The poster object is exposed as
 * window.__cover so the screenshot hooks can drive the same editor.
 */

(function () {
  var canvas = document.getElementById('poster');
  var poster = window.SunsetPoster.create(canvas);
  var state = poster.state;
  window.__cover = poster;

  var selBox = document.getElementById('selBox');
  var panelLabel = document.getElementById('panelLabel');
  var photoSelect = document.getElementById('photoSelect');
  var zoomRange = document.getElementById('zoomRange');
  var zoomVal = document.getElementById('zoomVal');
  var gradeRange = document.getElementById('gradeRange');
  var gradeVal = document.getElementById('gradeVal');

  /* The preview canvas follows the chosen export aspect, capped at 960 px
   * on its long side so the editor stays fast. */
  function fitPreview() {
    var w = state.exportW;
    var h = state.exportH;
    var scale = Math.min(1, 960 / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
  }

  function currentRects() {
    return window.SunsetPoster.layoutRects(state.layout, canvas.width, canvas.height);
  }

  function refreshSelectionBox() {
    var rects = currentRects();
    var rect = rects[state.selected];
    var wrap = document.getElementById('stageWrap').getBoundingClientRect();
    var box = canvas.getBoundingClientRect();
    if (!rect || rect.w <= 0) {
      selBox.hidden = true;
      return;
    }
    var sx = canvas.width / box.width;
    selBox.hidden = false;
    selBox.style.left = (box.left - wrap.left + rect.x / sx) + 'px';
    selBox.style.top = (box.top - wrap.top + rect.y / sx) + 'px';
    selBox.style.width = (rect.w / sx) + 'px';
    selBox.style.height = (rect.h / sx) + 'px';
  }

  function refreshPanelControls() {
    var count = state.layout === 'triptych' ? 3 : 4;
    panelLabel.textContent = 'Panel ' + (state.selected + 1) + ' of ' + count;
    var panel = state.panels[state.selected];
    photoSelect.value = String(panel.photo);
    zoomRange.value = String(Math.round(panel.zoom * 100));
    zoomVal.textContent = panel.zoom.toFixed(2) + '×';
  }

  function refreshPhotoOptions() {
    photoSelect.innerHTML = '';
    state.photos.forEach(function (photo, i) {
      var opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = photo.name;
      photoSelect.appendChild(opt);
    });
    if (!state.photos.length) {
      var opt = document.createElement('option');
      opt.value = '0';
      opt.textContent = '(no photo yet)';
      photoSelect.appendChild(opt);
    }
  }

  function repaint() {
    fitPreview();
    poster.render();
    refreshSelectionBox();
    refreshPanelControls();
  }

  // The screenshot hooks drive the same repaint the editor uses.
  poster.repaint = repaint;

  function selectPanel(i) {
    var max = state.layout === 'triptych' ? 2 : 3;
    state.selected = Math.max(0, Math.min(max, i));
    repaint();
  }

  /* --- photos ------------------------------------------------------- */

  function notePhotoLoaded() {
    refreshPhotoOptions();
    repaint();
  }

  document.getElementById('uploadBtn').addEventListener('click', function () {
    document.getElementById('fileInput').click();
  });

  document.getElementById('fileInput').addEventListener('change', function (ev) {
    var files = Array.prototype.slice.call(ev.target.files || []);
    var chain = Promise.resolve();
    files.forEach(function (file) {
      chain = chain.then(function () {
        return new Promise(function (resolve) {
          var reader = new FileReader();
          reader.onload = function () {
            poster.loadImage(String(reader.result), file.name.replace(/\.[^.]+$/, ''))
              .then(resolve, resolve);
          };
          reader.onerror = function () { resolve(); };
          reader.readAsDataURL(file);
        });
      });
    });
    chain.then(notePhotoLoaded);
    ev.target.value = '';
  });

  document.getElementById('sample-boulevard').addEventListener('click', function () {
    poster.loadSample('boulevard').then(notePhotoLoaded);
  });
  document.getElementById('sample-pier').addEventListener('click', function () {
    poster.loadSample('pier').then(notePhotoLoaded);
  });

  /* --- layout, caption, grade, comic -------------------------------- */

  document.querySelectorAll('[data-layout]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('[data-layout]').forEach(function (b) { b.classList.remove('on'); });
      btn.classList.add('on');
      poster.setLayout(btn.getAttribute('data-layout'));
      selectPanel(Math.min(state.selected, state.layout === 'triptych' ? 2 : 3));
    });
  });

  document.getElementById('titleInput').addEventListener('input', function (ev) {
    poster.setTitle(ev.target.value, undefined);
    repaint();
  });
  document.getElementById('subtitleInput').addEventListener('input', function (ev) {
    poster.setTitle(undefined, ev.target.value);
    repaint();
  });

  gradeRange.addEventListener('input', function (ev) {
    var pct = Number(ev.target.value);
    gradeVal.textContent = pct + '%';
    poster.setGrade(pct / 100);
    repaint();
  });

  var comicToggle = document.getElementById('comicToggle');
  comicToggle.addEventListener('click', function () {
    poster.setComic(!state.comic);
    comicToggle.textContent = 'Comic style: ' + (state.comic ? 'on' : 'off');
    comicToggle.setAttribute('aria-pressed', String(state.comic));
    repaint();
  });

  /* --- selected panel ------------------------------------------------ */

  photoSelect.addEventListener('change', function (ev) {
    state.panels[state.selected].photo = Number(ev.target.value) || 0;
    repaint();
  });

  document.querySelectorAll('[data-anchor]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var panel = state.panels[state.selected];
      var anchor = btn.getAttribute('data-anchor');
      var spots = {
        face: [0.5, 0.30],
        center: [0.5, 0.5],
        top: [0.5, 0.15],
        left: [0.20, 0.5],
        right: [0.80, 0.5],
      };
      var spot = spots[anchor] || spots.center;
      panel.cx = spot[0];
      panel.cy = spot[1];
      repaint();
    });
  });

  zoomRange.addEventListener('input', function (ev) {
    state.panels[state.selected].zoom = Number(ev.target.value) / 100;
    zoomVal.textContent = state.panels[state.selected].zoom.toFixed(2) + '×';
    repaint();
  });

  document.getElementById('fillAllBtn').addEventListener('click', function () {
    poster.fillAll();
    repaint();
  });

  /* --- pointer: pick a panel, drag to pan, wheel to zoom ------------- */

  function panelAt(clientX, clientY) {
    var box = canvas.getBoundingClientRect();
    var x = (clientX - box.left) * (canvas.width / box.width);
    var y = (clientY - box.top) * (canvas.height / box.height);
    var rects = currentRects();
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (r.w > 0 && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
    }
    return -1;
  }

  var drag = null;
  canvas.addEventListener('pointerdown', function (ev) {
    var i = panelAt(ev.clientX, ev.clientY);
    if (i < 0) return;
    selectPanel(i);
    drag = { x: ev.clientX, y: ev.clientY, moved: false };
    canvas.setPointerCapture(ev.pointerId);
  });
  canvas.addEventListener('pointermove', function (ev) {
    if (!drag) return;
    var panel = state.panels[state.selected];
    var box = canvas.getBoundingClientRect();
    var scaleX = canvas.width / box.width;
    var scaleY = canvas.height / box.height;
    var rect = currentRects()[state.selected];
    if (rect && rect.w > 0) {
      panel.cx -= ((ev.clientX - drag.x) * scaleX) / rect.w * 0.6;
      panel.cy -= ((ev.clientY - drag.y) * scaleY) / rect.h * 0.6;
      panel.cx = Math.max(-0.5, Math.min(1.5, panel.cx));
      panel.cy = Math.max(-0.5, Math.min(1.5, panel.cy));
      drag.moved = true;
    }
    drag.x = ev.clientX;
    drag.y = ev.clientY;
    repaint();
  });
  canvas.addEventListener('pointerup', function () { drag = null; });
  canvas.addEventListener('wheel', function (ev) {
    ev.preventDefault();
    var panel = state.panels[state.selected];
    var factor = ev.deltaY < 0 ? 1.08 : 1 / 1.08;
    panel.zoom = Math.max(1, Math.min(4, panel.zoom * factor));
    repaint();
  }, { passive: false });

  /* --- export -------------------------------------------------------- */

  document.querySelectorAll('[data-export]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('[data-export]').forEach(function (b) { b.classList.remove('on'); });
      btn.classList.add('on');
      var w = Number(btn.getAttribute('data-w'));
      var h = Number(btn.getAttribute('data-h'));
      poster.setExportSize(w, h);
      fitPreview();
      poster.render();
      refreshSelectionBox();
      try {
        var url = poster.exportDataURL(w, h);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'sunset-cover-' + w + 'x' + h + '.png';
        a.click();
      } catch (err) {
        window.alert(
          'Export was blocked: Chrome taints the canvas when this page is opened ' +
          'straight from a file. Run `node serve.ts` and open ' +
          'http://localhost:8080 — export works there.'
        );
      }
    });
  });

  window.addEventListener('resize', refreshSelectionBox);

  /* Keep the sidebar in step when the poster changes programmatically:
   * the screenshot hooks drive the same setters the controls use, so the
   * buttons, inputs and slider must show what the poster actually holds. */
  var baseSetLayout = poster.setLayout;
  poster.setLayout = function (layout) {
    baseSetLayout(layout);
    document.querySelectorAll('[data-layout]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-layout') === layout);
    });
  };
  var baseSetTitle = poster.setTitle;
  poster.setTitle = function (title, subtitle) {
    baseSetTitle(title, subtitle);
    if (title != null) document.getElementById('titleInput').value = title;
    if (subtitle != null) document.getElementById('subtitleInput').value = subtitle;
  };
  var baseSetGrade = poster.setGrade;
  poster.setGrade = function (grade) {
    baseSetGrade(grade);
    gradeRange.value = String(Math.round(grade * 100));
    gradeVal.textContent = Math.round(grade * 100) + '%';
  };
  var baseSetComic = poster.setComic;
  poster.setComic = function (on) {
    baseSetComic(on);
    comicToggle.textContent = 'Comic style: ' + (state.comic ? 'on' : 'off');
    comicToggle.setAttribute('aria-pressed', String(state.comic));
  };

  /* First paint: load the pier sample so the poster is alive at once. */
  refreshPhotoOptions();
  fitPreview();
  poster.render();
  poster.loadSample('pier').then(function () {
    poster.fillAll();
    notePhotoLoaded();
  });
})();
