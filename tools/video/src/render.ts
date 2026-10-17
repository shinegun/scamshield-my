import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { captionHtml, renderPngs } from './cards.js';
import { cuesFor, srt, type Cue, type Word } from './captions.js';
import { BUILD, ensureDir, fromOut, OUT } from './paths.js';
import { isStill, place, resolve, segmentLength, validate, type Edl, type Segment } from './timeline.js';

// pnpm render [edl.json] [--plan] [--final]
//   edl.json  under out/, default out/edl.json
//   --plan    check the EDL and print the timeline; render nothing
//   --final   slower, higher-quality encode (the draft is fine to review)
// Writes out/build/final.mp4, out/build/captions.srt and out/build/plan.md.

const args = process.argv.slice(2);
const edlPath = fromOut(args.find((a) => !a.startsWith('--')) ?? 'edl.json');
const planOnly = args.includes('--plan');
const final = args.includes('--final');
const W = 1920;
const H = 1080;
const FPS = 30;

const edl = JSON.parse(readFileSync(edlPath, 'utf8')) as Edl;
const durations = new Map<string, number | undefined>();
function seconds(source: string): number | undefined {
  if (durations.has(source)) return durations.get(source);
  const path = fromOut(source);
  let d: number | undefined;
  if (existsSync(path)) {
    d = isStill(source)
      ? 0
      : Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).toString().trim());
  }
  durations.set(source, d);
  return d;
}

const problems = validate(edl, seconds);
const warnings = problems.filter((p) => p.includes('will be padded'));
const errors = problems.filter((p) => !warnings.includes(p));
warnings.forEach((w) => console.warn(`warning: ${w}`));
if (errors.length) {
  console.error(`The EDL has ${errors.length} problem(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

const placed = place(edl);
const total = placed.at(-1)?.end ?? 0;
const words: Word[] = existsSync(join(OUT, 'vo', 'words.json')) ? JSON.parse(readFileSync(join(OUT, 'vo', 'words.json'), 'utf8')) : [];

const cues: Cue[] = [];
for (const a of edl.audio) {
  if (a.source !== 'vo' || a.caption === false) continue;
  const at = resolve(a, placed);
  cues.push(...cuesFor(words, a.in ?? 0, a.out ?? Infinity, at, edl.captionFixes));
}
for (const c of edl.captions ?? []) {
  const at = resolve(c, placed);
  cues.push({ start: at, end: at + c.duration, text: c.text });
}
cues.sort((a, b) => a.start - b.start);

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
const plan = [
  '# Render plan',
  '',
  `Total ${fmt(total)} (${total.toFixed(2)}s), ${placed.length} segments, ${edl.audio.length} audio clips, ${cues.length} captions.`,
  '',
  '| segment | output | source | note |',
  '| --- | --- | --- | --- |',
  ...placed.map(({ segment: s, start, end }) => {
    const src = isStill(s.source) ? s.source : `${s.source} ${s.in}-${s.out}${s.speed && s.speed !== 1 ? ` at ${s.speed}x` : ''}${s.hold ? ` +${s.hold}s hold` : ''}`;
    return `| ${s.id} | ${fmt(start)}-${fmt(end)} | ${src} | ${s.note ?? ''} |`;
  }),
  '',
  '| audio | output | source |',
  '| --- | --- | --- |',
  ...edl.audio.map((a) => {
    const at = resolve(a, placed);
    const len = (a.out ?? seconds(a.source === 'vo' ? edl.voiceover : a.source) ?? 0) - (a.in ?? 0);
    return `| ${a.note ?? a.source} | ${fmt(at)}-${fmt(at + len)} | ${a.source} ${a.in ?? 0}-${a.out ?? 'end'} |`;
  }),
  '',
  '| caption | output |',
  '| --- | --- |',
  ...cues.map((c) => `| ${c.text} | ${fmt(c.start)}-${fmt(c.end)} |`),
  '',
].join('\n');
const build = ensureDir(BUILD);
writeFileSync(join(build, 'plan.md'), plan);
writeFileSync(join(build, 'captions.srt'), srt(cues));
console.log(`EDL ok: ${fmt(total)}, ${placed.length} segments, ${cues.length} captions. Timeline in build/plan.md.`);
if (planOnly) process.exit(0);

const run = (args: string[]) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
const x264 = final ? ['-c:v', 'libx264', '-preset', 'slow', '-crf', '17'] : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20'];

// 1. Each segment to its own clip, cached by its spec so re-renders are quick.
function segmentClip(s: Segment): string {
  const src = fromOut(s.source);
  const key = createHash('sha1')
    .update(JSON.stringify({ s: { ...s, note: undefined, id: undefined }, final, mtime: statSync(src).mtimeMs }))
    .digest('hex')
    .slice(0, 12);
  const out = join(build, `seg-${key}.mp4`);
  if (existsSync(out)) return out;
  const len = segmentLength(s);
  const vf: string[] = [];
  const input: string[] = [];
  if (isStill(s.source)) {
    input.push('-loop', '1', '-t', String(len), '-i', src);
  } else {
    input.push('-ss', String(s.in), '-t', String((s.out ?? 0) - (s.in ?? 0)), '-i', src);
    vf.push(`setpts=(PTS-STARTPTS)/${s.speed ?? 1}`);
  }
  if (s.crop) vf.push(`crop=${s.crop.w}:${s.crop.h}:${s.crop.x}:${s.crop.y}`);
  vf.push(`scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos`, `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black`, `fps=${FPS}`);
  if (!isStill(s.source)) vf.push(`tpad=stop_mode=clone:stop_duration=${(s.hold ?? 0) + 0.5}`);
  if (s.fadeIn) vf.push(`fade=t=in:st=0:d=${s.fadeIn}`);
  if (s.fadeOut) vf.push(`fade=t=out:st=${Math.max(len - s.fadeOut, 0)}:d=${s.fadeOut}`);
  vf.push('format=yuv420p');
  run([...input, '-vf', vf.join(','), '-t', String(len), '-an', ...x264, '-r', String(FPS), out]);
  return out;
}
const clips = placed.map(({ segment }, i) => {
  process.stdout.write(`segment ${i + 1}/${placed.length} ${segment.id}\r`);
  return segmentClip(segment);
});
const list = join(build, 'concat.txt');
writeFileSync(list, clips.map((c) => `file '${c}'`).join('\n'));
const video = join(build, 'video.mp4');
run(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video]);

// 2. Captions as transparent PNGs (this ffmpeg has no libass/drawtext).
const capDir = join(build, 'captions');
rmSync(capDir, { recursive: true, force: true });
ensureDir(capDir);
const capFiles = cues.map((_, i) => join(capDir, `${String(i).padStart(3, '0')}.png`));
await renderPngs(cues.map((c, i) => ({ html: captionHtml(c.text), out: capFiles[i]!, transparent: true })));

// 3. One pass: overlay captions, mix audio, normalise loudness.
const inputs: string[] = ['-i', video];
capFiles.forEach((f) => inputs.push('-i', f));
const graph: string[] = [];
let v = '0:v';
cues.forEach((c, i) => {
  const next = `v${i}`;
  graph.push(`[${v}][${i + 1}:v]overlay=0:0:enable='between(t,${c.start.toFixed(3)},${c.end.toFixed(3)})'[${next}]`);
  v = next;
});
const audioBase = 1 + capFiles.length;
const mixed: string[] = [];
edl.audio.forEach((a, i) => {
  inputs.push('-i', fromOut(a.source === 'vo' ? edl.voiceover : a.source));
  const at = resolve(a, placed);
  const trim = `atrim=start=${a.in ?? 0}${a.out !== undefined ? `:end=${a.out}` : ''}`;
  const ms = Math.round(at * 1000);
  graph.push(
    `[${audioBase + i}:a]aformat=sample_rates=48000:channel_layouts=stereo,${trim},asetpts=PTS-STARTPTS,volume=${a.gain ?? 1},adelay=${ms}|${ms}[a${i}]`,
  );
  mixed.push(`[a${i}]`);
});
if (mixed.length) {
  graph.push(`${mixed.join('')}amix=inputs=${mixed.length}:normalize=0:duration=longest,apad,atrim=end=${total.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[aout]`);
} else {
  graph.push(`anullsrc=r=48000:cl=stereo,atrim=end=${total.toFixed(3)}[aout]`);
}
const finalOut = join(build, 'final.mp4');
const graphFile = join(build, 'graph.txt');
writeFileSync(graphFile, graph.join(';\n'));
run([
  ...inputs,
  // ffmpeg 7+ reads an option's value from a file with a leading "/".
  '-/filter_complex',
  graphFile,
  '-map',
  v === '0:v' ? '0:v' : `[${v}]`,
  '-map',
  '[aout]',
  '-t',
  total.toFixed(3),
  ...x264,
  '-pix_fmt',
  'yuv420p',
  '-c:a',
  'aac',
  '-b:a',
  '192k',
  '-movflags',
  '+faststart',
  finalOut,
]);
console.log(`\nWrote build/final.mp4 (${fmt(total)}), build/captions.srt, build/plan.md`);
