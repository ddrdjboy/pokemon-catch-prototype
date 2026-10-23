/**
 * Generate 64×64 nearest-neighbor thumbs for UI slots.
 * Run: npm run gen:thumbs
 *
 * Prefers ffmpeg (scale=flags=neighbor); falls back to macOS sips.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'assets/pokemon');
const OUT = path.join(root, 'assets/pokemon/thumbs');
const SIZE = 64;

function hasFfmpeg() {
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  return !r.error && r.status === 0;
}

function hasSips() {
  const r = spawnSync('sips', ['--help'], { encoding: 'utf8' });
  return !r.error && (r.status === 0 || r.status === 1 || r.status === 2);
}

function resizeFfmpeg(src, dest) {
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-i', src, '-vf', `scale=${SIZE}:${SIZE}:flags=neighbor`, dest],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) {
    throw new Error(`ffmpeg failed for ${src}: ${r.stderr || r.stdout}`);
  }
}

function resizeSips(src, dest) {
  // sips resamples; copy first then resize in place at dest
  fs.copyFileSync(src, dest);
  const r = spawnSync(
    'sips',
    ['-z', String(SIZE), String(SIZE), dest],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) {
    throw new Error(`sips failed for ${src}: ${r.stderr || r.stdout}`);
  }
}

fs.mkdirSync(OUT, { recursive: true });

const files = fs
  .readdirSync(SRC)
  .filter((f) => f.endsWith('.png') && fs.statSync(path.join(SRC, f)).isFile());

if (!files.length) {
  console.error('No PNG files in', SRC);
  process.exit(1);
}

const useFfmpeg = hasFfmpeg();
const useSips = !useFfmpeg && hasSips();
if (!useFfmpeg && !useSips) {
  console.error('Need ffmpeg or sips to generate thumbs');
  process.exit(1);
}

console.log(`Generating ${files.length} thumbs (${SIZE}×${SIZE}) via ${useFfmpeg ? 'ffmpeg' : 'sips'}…`);

let ok = 0;
for (const name of files) {
  const src = path.join(SRC, name);
  const dest = path.join(OUT, name);
  if (useFfmpeg) resizeFfmpeg(src, dest);
  else resizeSips(src, dest);
  ok += 1;
}

console.log(`Wrote ${ok} thumbs → ${path.relative(root, OUT)}/`);
