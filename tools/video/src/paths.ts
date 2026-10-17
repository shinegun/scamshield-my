import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Everything the pipeline writes lives under tools/video/out (gitignored).
// Paths inside an EDL are relative to OUT, so the EDL stays portable.
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = join(ROOT, 'out');
export const SHOTS = join(OUT, 'shots');
export const CARDS = join(OUT, 'cards');
export const VO = join(OUT, 'vo');
export const FRAMES = join(OUT, 'frames');
export const BUILD = join(OUT, 'build');

export const LIVE_URL = process.env.SCAMSHIELD_URL ?? 'https://scamshield-my-511604.web.app';

export function ensureDir(path: string): string {
  mkdirSync(path, { recursive: true });
  return path;
}

export function fromOut(path: string): string {
  return resolve(OUT, path);
}
