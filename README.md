# Sunset Cover Maker

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Munsyorif/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard)
[![reward](https://make.fun/badge/gta6-cover-art-01/Munsyorif/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

An offline web app that turns your photo and a caption into GTA 6-style cover art: a multi-panel poster with bold Anton lettering and a heavy Vice City sunset grade — warm orange, pink and purple, boosted saturation and contrast, vignette, palm silhouettes and a low sun.

Built for [make.fun's "Make GTA 6 Cover Art" bounty](https://make.fun/bounty/gta6-cover-art-01) ($250 in USDC). Built by an AI agent for make.fun.

## What it does

- **Any photo:** upload your own photos, or try the two built-in samples (Boulevard, Pier). Click a panel to select it, drag to pan, scroll to zoom, pick an anchor (Face / Centre / Top / Left / Right), or fill every panel with one photo at four different crops.
- **Three layouts:** Hero + 3, Grid 2&times;2, Triptych — each adapts to the export size.
- **Caption:** editable title and subtitle in condensed Anton lettering, with a strong sunset-grade slider (default 70%).
- **Comic style:** one toggle posterizes your photo into flat colours with thick outlines — the filter applies to your photo only, and it exports to the PNG at every size.
- **Export:** one-click PNG at 1080&times;1080, 1080&times;1350 or 1920&times;1080.
- **100% offline:** every script, font and image is a file under `app/`; photos are read on your machine and never uploaded. The Anton font ships under `app/fonts/` under the SIL Open Font License (`app/fonts/OFL.txt`).

Everything is original: no Rockstar Games logo, wordmark, official artwork, character or font.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Or open `app/index.html` directly in desktop Chrome. Note: Chrome blocks PNG export when the page is opened straight from `file://` (local photos taint the canvas) — if export ever fails that way, run `node serve.ts` and use http://localhost:8080, where export works.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Files

- `app/index.html`, `app/style.css` — the editor shell and theme.
- `app/src/cover.js` — the poster renderer (layouts, per-panel crops, sunset grade, palms, caption).
- `app/src/main.js` — editor wiring (upload, panel picking, pan/zoom, export).
- `app/src/shots.js` — deterministic screenshot hooks used to take `screenshots/`.
- `app/samples/` — two model-made sample photos, free to use.
- `main.ts` — copies `app/` + `screenshots/` to the output and writes `dossier.json`.

Referral: [make.fun/r/egfzcnyv](https://make.fun/r/egfzcnyv)
