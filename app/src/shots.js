'use strict';
/* Sunset Cover Maker — screenshot hooks.
 *
 * The entry's own driver for reproducible screenshots: the Playwright
 * script that takes this entry's screenshots calls these functions instead
 * of clicking around, so every shot is deterministic. The editor works the
 * same without them.
 */

(function () {
  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function coverReady() {
    return new Promise(function (resolve) {
      (function check() {
        if (window.__cover && window.__cover.state) resolve(window.__cover);
        else setTimeout(check, 50);
      })();
    });
  }

  var readyPromise = coverReady().then(function (cover) {
    var fonts = (document.fonts && document.fonts.ready)
      ? document.fonts.ready.catch(function () {})
      : Promise.resolve();
    // Wait for Anton and for the first sample photo to land.
    return fonts.then(function () { return sleep(250); }).then(function () {
      return cover.loadSample('pier').then(function () { return sleep(150); });
    }).then(function () {
      cover.fillAll();
      if (cover.repaint) cover.repaint(); else cover.render();
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
        if (cfg.comic != null) cover.setComic(cfg.comic);
        if (cfg.exportW && cfg.exportH) cover.setExportSize(cfg.exportW, cfg.exportH);
        // One photo across every panel, each with its own crop.
        cover.fillAll();
        if (cover.repaint) cover.repaint(); else cover.render();
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
