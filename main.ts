// Pencuri Senja — program penyerahan entry make.fun.
// Menyalin game/ dan screenshots/ dari repo ini ke direktori keluaran,
// lalu menulis /output/dossier.json memakai buildDossier dari
// vendor/makefun-game.ts (salinan kit yang tidak diubah).
// Node 22, stdlib saja. Di luar grader, MAKEFUN_OUTPUT_DIR menggantikan /output.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Batas gate untuk bounty ini (lihat competition.yaml / RULES.txt kit).
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
} as const;

const repoRoot = dirname(fileURLToPath(import.meta.url));

function outputDir(): string {
  const fromEnv = process.env.MAKEFUN_OUTPUT_DIR;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return '/output';
}

function mustExist(path: string, label: string): void {
  if (!existsSync(path)) throw new Error(`main.ts: ${label} tidak ditemukan: ${path}`);
  if (!statSync(path).isDirectory()) throw new Error(`main.ts: ${label} bukan direktori: ${path}`);
}

function main(): void {
  const out = outputDir();
  const gameSrc = join(repoRoot, 'game');
  const shotsSrc = join(repoRoot, 'screenshots');
  mustExist(gameSrc, 'game/');
  mustExist(shotsSrc, 'screenshots/');

  // Mulai dari keluaran bersih supaya tidak ada sisa run sebelumnya.
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  // Salin apa adanya: game/ lalu screenshots/.
  cpSync(gameSrc, join(out, 'game'), { recursive: true });
  cpSync(shotsSrc, join(out, 'screenshots'), { recursive: true });

  // Dossier ditulis dari hasil salinan, jadi isinya sama persis dengan
  // yang diperiksa gate dari /output.
  const dossier = buildDossier(out, CAPS);
  writeFileSync(join(out, 'dossier.json'), dossier);

  const shotCount = readFileSync(join(out, 'dossier.json'), 'utf8').includes('"images"')
    ? JSON.parse(readFileSync(join(out, 'dossier.json'), 'utf8')).images.length
    : 0;
  console.log(`Pencuri Senja: game/ + ${shotCount} screenshot disalin ke ${out}, dossier.json ${dossier.length} byte.`);
}

main();
