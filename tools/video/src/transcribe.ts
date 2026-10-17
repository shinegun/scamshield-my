import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { snapToSilence, tokensToWords, type Token, type Word } from './captions.js';
import { ensureDir, ROOT, VO } from './paths.js';

// pnpm transcribe <recording>   (any format ffmpeg reads: m4a, wav, mp3, mov)
// Writes out/vo/voiceover.wav (the clean copy the EDL uses), words.json
// (word-level timings) and transcript.md (what the editing agent reads:
// sentences with start/end times and the pauses between them).
// Runs whisper.cpp locally; nothing leaves the machine.

const MODEL = join(ROOT, 'models', 'ggml-small.en.bin');
// Words whisper would otherwise mishear in this script.
const PROMPT =
  'ScamShield, Jev, Gemini, Vertex AI, Cloud Run, Firestore, Firebase, MCMC, Manglish, Malay, Bank Negara, RM, Inspector Vijay, Pahang, ringgit.';

// Where the pauses really are, from ffmpeg's silencedetect.
function silences(file: string): Array<{ start: number; end: number }> {
  const log = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'silencedetect=noise=-38dB:d=0.3', '-f', 'null', '-'], {
    encoding: 'utf8',
  }).stderr;
  const out: Array<{ start: number; end: number }> = [];
  for (const m of log.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)) {
    out.push({ start: Number(m[1]), end: Number(m[2]) });
  }
  return out;
}

const input = process.argv[2];
if (!input) {
  console.error('usage: pnpm transcribe <voiceover recording>');
  process.exit(1);
}
const src = resolve(process.env.INIT_CWD ?? process.cwd(), input);
if (!existsSync(MODEL)) {
  console.error(`Missing ${MODEL}. Download it with:\n  curl -L -o ${MODEL} https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin`);
  process.exit(1);
}
const dir = ensureDir(VO);
const wav48 = join(dir, 'voiceover.wav');
const wav16 = join(dir, 'whisper-16k.wav');
// 48 kHz mono for the mix, 16 kHz for whisper. A gentle high-pass removes rumble.
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-af', 'highpass=f=70', '-ac', '1', '-ar', '48000', wav48]);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-ac', '1', '-ar', '16000', wav16]);

const base = join(dir, 'whisper');
execFileSync(
  'whisper-cli',
  ['-m', MODEL, '-f', wav16, '-l', 'en', '-dtw', 'small.en', '-nfa', '-ojf', '-of', base, '-np', '--prompt', PROMPT],
  { stdio: ['ignore', 'ignore', 'inherit'] },
);

interface WhisperJson {
  transcription: Array<{ tokens: Token[] }>;
}
const raw = JSON.parse(readFileSync(`${base}.json`, 'utf8')) as WhisperJson;
const words: Word[] = snapToSilence(tokensToWords(raw.transcription.flatMap((s) => s.tokens)), silences(wav48));
writeFileSync(join(dir, 'words.json'), JSON.stringify(words, null, 1));

// Sentences for the agent: break at sentence punctuation or a pause >= 0.6 s.
const lines: string[] = [];
let cur: Word[] = [];
const flush = () => {
  if (!cur.length) return;
  lines.push(`| ${cur[0]!.start.toFixed(2)} | ${cur.at(-1)!.end.toFixed(2)} | ${cur.map((w) => w.text).join(' ')} |`);
  cur = [];
};
words.forEach((w, i) => {
  const prev = words[i - 1];
  if (prev && w.start - prev.end >= 0.6) {
    flush();
    lines.push(`| | | *(pause ${(w.start - prev.end).toFixed(1)}s)* |`);
  }
  cur.push(w);
  if (/[.!?]["”']?$/.test(w.text)) flush();
});
flush();

const total = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav48]).toString().trim());
writeFileSync(
  join(dir, 'transcript.md'),
  [
    '# Voiceover transcript',
    '',
    `File: \`vo/voiceover.wav\`, ${total.toFixed(2)}s. Times are seconds into that file; use them as \`in\`/\`out\` for \`"source": "vo"\` clips.`,
    'Whisper can mishear names and repeat retakes. When a sentence appears twice, the speaker re-read it: keep the last clean take.',
    'Exact word timings are in `vo/words.json`.',
    '',
    '| start | end | text |',
    '| ---: | ---: | --- |',
    ...lines,
    '',
  ].join('\n'),
);
console.log(`Wrote vo/voiceover.wav (${total.toFixed(1)}s), vo/words.json (${words.length} words), vo/transcript.md`);
