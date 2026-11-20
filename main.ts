// Sunset Cover Maker — entry program, Node 22 standard library only.
//
// Hands the entry in: it copies this repository's app/ and screenshots/
// into the output folder and writes /output/dossier.json, the summary the
// judge reads, using the vendored make.fun library. The program runs twice
// in the grader and both runs must write identical bytes, so nothing here
// depends on the clock, on randomness or on the network.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// This file's own folder is the repository root.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

// The app first, then the screenshots beside it.
copyTree(join(repoRoot, 'app'), join(outputDir, 'app'));
if (existsSync(join(repoRoot, 'screenshots'))) {
  copyTree(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));
}

// The scorer's own caps: only text_max_bytes shapes the dossier's bytes;
// the rest refuse an entry the scorer would refuse anyway (more than 4
// screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB
// of app files in all; a path under app/ over 1000 bytes).
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
