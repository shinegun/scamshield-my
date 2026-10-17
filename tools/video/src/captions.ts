// Voiceover words -> caption cues on the output timeline.

export interface Word {
  text: string;
  // Seconds in the voiceover file.
  start: number;
  end: number;
}

export interface Cue {
  start: number;
  end: number;
  text: string;
}

const MAX_CHARS = 72; // about two lines at the caption size
const PAUSE = 0.5; // a gap this long always starts a new cue

// Words inside [from, to) of the voiceover, shifted to start at `at` on the
// output timeline, grouped into cues at pauses, sentence ends and length.
export function cuesFor(words: Word[], from: number, to: number, at: number, fixes: Record<string, string> = {}): Cue[] {
  const inside = words.filter((w) => w.start >= from - 0.05 && w.end <= to + 0.05);
  const cues: Cue[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length === 0) return;
    const text = fix(cur.map((w) => w.text).join(' '), fixes);
    cues.push({ start: at + cur[0]!.start - from, end: at + cur.at(-1)!.end - from, text });
    cur = [];
  };
  for (const w of inside) {
    const prev = cur.at(-1);
    const length = cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length;
    const sentenceEnd = prev && /[.!?]["”']?$/.test(prev.text) && length > 24;
    // A clause break once the cue is already a line long reads better than a
    // split mid-phrase at the length limit.
    const clauseEnd = prev && /[,;:]$/.test(prev.text) && length > 40;
    if (prev && (w.start - prev.end >= PAUSE || length > MAX_CHARS || sentenceEnd || clauseEnd)) flush();
    cur.push(w);
  }
  flush();
  // Let each cue stay up a little after its last word, without overlapping
  // the next, and never flash for less than a second.
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i]!;
    const next = cues[i + 1]?.start ?? Infinity;
    c.end = Math.min(Math.max(c.end + 0.3, c.start + 1), next - 0.05);
  }
  return cues;
}

export function fix(text: string, fixes: Record<string, string>): string {
  let out = text.replace(/\s+([,.!?;:])/g, '$1').trim();
  for (const [from, to] of Object.entries(fixes)) {
    out = out.replace(new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), to);
  }
  return out;
}

export function srt(cues: Cue[]): string {
  const ts = (s: number) => {
    const ms = Math.round(s * 1000);
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const sec = Math.floor((ms % 60_000) / 1000);
    const pad = (n: number, w = 2) => String(n).padStart(w, '0');
    return `${pad(h)}:${pad(m)}:${pad(sec)},${pad(ms % 1000, 3)}`;
  };
  return cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join('\n');
}

// Word timings. Whisper's own word splitting (-ml 1) smears words across
// pauses, and its token offsets drift with the prompt. The DTW onset of each
// token (t_dtw, needs flash attention off) is the steadiest signal, so a word
// starts at its first token's onset and runs until the next word starts;
// snapToSilence then cuts it at any pause in between. A token starting with a
// space starts a word; others (suffixes, punctuation) join the word before.
export type Token = { text: string; offsets: { from: number; to: number }; t_dtw?: number };
export function tokensToWords(tokens: Token[]): Word[] {
  const words: Word[] = [];
  for (const t of tokens) {
    if (/^\[_.*\]$/.test(t.text.trim()) || t.text.trim() === '') continue;
    const last = words.at(-1);
    if (last && !t.text.startsWith(' ')) {
      last.text += t.text;
    } else {
      const onset = t.t_dtw !== undefined && t.t_dtw >= 0 ? t.t_dtw / 100 : t.offsets.from / 1000;
      words.push({ text: t.text.trim(), start: onset, end: onset });
    }
  }
  const lastEnd = tokens.reduce((m, t) => Math.max(m, t.offsets.to / 1000), 0);
  words.forEach((w, i) => {
    w.end = Math.max(words[i + 1]?.start ?? lastEnd, w.start + 0.05);
  });
  return words;
}

// Whisper stretches a word over the pause that follows it, which would put
// cuts in the silence's wrong half. ffmpeg's silencedetect knows where the
// pauses really are, so words are trimmed to stop where a pause starts.
export function snapToSilence(words: Word[], gaps: Array<{ start: number; end: number }>): Word[] {
  return words.map((w) => {
    let { start, end } = w;
    for (const g of gaps) {
      // A pause that begins inside the word ends the word there.
      if (g.start > start + 0.05 && g.start < end) end = g.start;
      // A word whose onset lands inside a pause belongs to one side of it:
      // a sentence end before it, anything else after it.
      if (g.start <= start && g.end > start) {
        if (/[.!?]["”']?$/.test(w.text)) {
          end = g.start;
          start = Math.max(g.start - 0.3, 0);
        } else if (g.end < end) {
          start = g.end;
        }
      }
    }
    return { ...w, start, end: Math.max(end, start + 0.05) };
  });
}
