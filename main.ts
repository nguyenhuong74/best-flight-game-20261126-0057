// Skyline Courier — entry program (make.fun program/v1).
// Copies game/ and screenshots/ into the output directory and writes
// dossier.json with buildDossier from the kit's vendor/makefun-game.ts.
// Standard library only; runs on Node 22 with no install step.

import { buildDossier } from './vendor/makefun-game.ts';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function copyTree(src, dst) {
  mkdirSync(dst, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  for (const entry of entries) {
    const from = join(src, entry.name);
    const to = join(dst, entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to);
    } else if (entry.isFile()) {
      cpSync(from, to);
    }
    // Anything else (symlinks, sockets) is left out of the hand-in.
  }
}

function main() {
  for (const dir of ['game', 'screenshots']) {
    if (!existsSync(join(repoRoot, dir))) {
      throw new Error(`skyline-courier: missing ${dir}/ in the repository — nothing to hand in`);
    }
  }
  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  copyTree(join(repoRoot, 'game'), join(outDir, 'game'));
  copyTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));

  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 48 * 1024 * 1024,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);

  const gameFiles = readdirSync(join(outDir, 'game'), { recursive: true }).length;
  const shotFiles = readdirSync(join(outDir, 'screenshots')).length;
  const size = statSync(join(outDir, 'dossier.json')).size;
  console.log(`skyline-courier: wrote ${outDir} (game: ${gameFiles} entries, screenshots: ${shotFiles}, dossier.json: ${size} bytes)`);
}

main();
