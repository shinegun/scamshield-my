import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { chromium } from 'playwright';
import { ensureDir, FRAMES, fromOut } from './paths.js';

// pnpm frames <video> <times|--every N> [--sheet]
//   <video>  path relative to out/, e.g. shots/scam/video.webm or build/final.mp4
//   <times>  comma-separated seconds, e.g. 12.5,30,41
//   --every N  one frame every N seconds over the whole video
//   --sheet  also tile the frames, labelled with their time, into one image
// Frames are 1280 wide: enough to read the UI, cheap to look at.

const args = process.argv.slice(2);
const video = args[0];
if (!video || args.length < 2) {
  console.error('usage: pnpm frames <video under out/> <t1,t2,...|--every N> [--sheet]');
  process.exit(1);
}
const src = fromOut(video);
const duration = Number(
  execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).toString().trim(),
);
const everyAt = args.indexOf('--every');
const times =
  everyAt >= 0
    ? Array.from({ length: Math.floor(duration / Number(args[everyAt + 1])) + 1 }, (_, i) => i * Number(args[everyAt + 1]))
    : args[1]!.split(',').map(Number);

const stem = video.replace(/^shots\//, '').replace(/\//g, '-').replace(extname(video), '');
const dir = ensureDir(join(FRAMES, stem));
const files: Array<{ t: number; file: string }> = [];
for (const t of times) {
  const at = Math.min(Math.max(t, 0), Math.max(duration - 0.05, 0));
  const file = join(dir, `${at.toFixed(2)}.png`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(at), '-i', src, '-frames:v', '1', '-vf', 'scale=1280:-2', file]);
  files.push({ t: at, file });
}

if (args.includes('--sheet')) {
  const cols = files.length <= 4 ? 2 : 3;
  const html = `<!doctype html><style>
    body{margin:0;background:#111;color:#fff;font:600 22px system-ui;display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px;padding:8px}
    figure{margin:0}img{width:100%;display:block}figcaption{padding:4px 0}</style>
    ${files.map((f) => `<figure><img src="data:image/png;base64,${readFileSync(f.file).toString('base64')}"><figcaption>${f.t.toFixed(2)}s</figcaption></figure>`).join('')}`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: cols * 640, height: 400 } });
  await page.setContent(html);
  await page.waitForLoadState('load');
  const sheet = join(dir, `sheet-${basename(times.join('_')).slice(0, 40)}.png`);
  await page.screenshot({ path: sheet, fullPage: true });
  await browser.close();
  console.log(sheet);
} else {
  files.forEach((f) => console.log(f.file));
}
