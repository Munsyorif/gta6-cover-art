'use strict';
/* Sunset Cover Maker — screenshot hooks.
 *
 * The app's own driver for reproducible screenshots: the Playwright script
 * that takes this entry's screenshots calls these functions instead of
 * clicking around, so every shot is deterministic. Nothing here is needed
 * for the app itself; the editor works the same without it.
 */

(function () {
  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function coverReady() {
    return new Promise(function (resolve) {
      function check() {
        if (window.__cover && window.__cover.state) resolve(window.__cover);
        else setTimeout(check, 50);
      }
      check();
    });
  }

  var readyPromise = coverReady().then(function (cover) {
    var fontsReady = (document.fonts && document.fonts.ready)
      ? document.fonts.ready.catch(function () {})
      : Promise.resolve();
    // Wait for the fonts and for the first sample photo to land.
    return fontsReady.then(function () { return sleep(250); }).then(function () {
      return cover.loadSample('pier').then(function () { return sleep(150); });
    }).then(function () {
      cover.render();
      return sleep(150);
    });
  });

  /* Configure the editor for one named shot, then paint. cfg:
   * {photo, layout, title, subtitle, grade, comic, exportW, exportH} */
  function setupShot(cfg) {
    return coverReady().then(function (cover) {
      var photo = (cfg && cfg.photo) || 'pier';
      return cover.loadSample(photo).then(function () {
        if (cfg.layout) cover.setLayout(cfg.layout);
        if (cfg.title != null || cfg.subtitle != null) {
          cover.setTitle(cfg.title != null ? cfg.title : undefined,
            cfg.subtitle != null ? cfg.subtitle : undefined);
        }
        if (cfg.grade != null) cover.setGrade(cfg.grade);
        if (cfg.comic != null && cover.setComic) cover.setComic(cfg.comic);
        if (cfg.exportW && cfg.exportH) cover.setExportSize(cfg.exportW, cfg.exportH);
        // Fill every panel from the one photo with distinct crops.
        var st = cover.state;
        var anchors = [
          { cx: 0.5, cy: 0.32, zoom: 1 },
          { cx: 0.22, cy: 0.5, zoom: 1.2 },
          { cx: 0.78, cy: 0.5, zoom: 1.2 },
          { cx: 0.5, cy: 0.68, zoom: 1.35 },
        ];
        var photoIndex = st.panels[0].photo;
        for (var i = 0; i < st.panels.length; i++) {
          st.panels[i].photo = photoIndex;
          st.panels[i].cx = anchors[i].cx;
          st.panels[i].cy = anchors[i].cy;
          st.panels[i].zoom = anchors[i].zoom;
        }
        cover.render();
        return sleep(200);
      });
    });
  }

  window.__shots = {
    ready: readyPromise,
    setupShot: setupShot,
    exportCover: function (w, h) {
      return coverReady().then(function (cover) {
        return cover.exportDataURL(w, h);
      });
    },
    state: function () {
      return window.__cover ? window.__cover.state : null;
    },
  };
})();
