// The edit decision list (EDL) the editing agent writes, and the pure timing
// math behind it. The agent expresses the edit as data; render.ts turns it
// into ffmpeg calls. All paths are relative to tools/video/out.

export interface Crop {
  // In source pixels. Keep it 16:9 (w/h = 1.778) or the picture is padded.
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Segment {
  id: string;
  // A recorded shot (shots/<name>/video.webm) or a still (cards/<name>.png).
  source: string;
  // Source seconds to use. Video only.
  in?: number;
  out?: number;
  // Seconds on screen. Required for a still; ignored for video.
  duration?: number;
  // Playback speed for video: 2 plays twice as fast. Default 1.
  speed?: number;
  // Freeze the last frame for this many extra seconds.
  hold?: number;
  crop?: Crop;
  // Fade from/to black over this many seconds.
  fadeIn?: number;
  fadeOut?: number;
  note?: string;
}

// A point on the output timeline, either absolute or pinned to a moment in a
// segment's source ("26.1 s into shots/scam/video.webm, wherever that ends up").
export type Anchor = { at: number } | { segment: string; t: number };

export type AudioClip = Anchor & {
  // "vo" for the voiceover, or a file such as shots/scam/warning-1.mp3.
  source: string;
  // Part of the source to play, in source seconds. Default: all of it.
  in?: number;
  out?: number;
  // Linear gain. Default 1.
  gain?: number;
  // Voiceover only: subtitle this clip from the transcript. Default true.
  caption?: boolean;
  note?: string;
};

export type Caption = Anchor & { text: string; duration: number };

export interface Edl {
  // The voiceover file `vo` refers to, e.g. vo/voiceover.wav.
  voiceover: string;
  segments: Segment[];
  audio: AudioClip[];
  // Extra captions, e.g. the English for a Malay spoken warning.
  captions?: Caption[];
  // Transcript fixes applied to voiceover captions, e.g. {"Jeff": "Jev"}.
  captionFixes?: Record<string, string>;
}

export interface Placed {
  segment: Segment;
  start: number;
  end: number;
}

export function isStill(source: string): boolean {
  return /\.(png|jpe?g|webp)$/i.test(source);
}

// Seconds a segment occupies on the output timeline.
export function segmentLength(s: Segment): number {
  if (isStill(s.source)) return (s.duration ?? 0) + (s.hold ?? 0);
  return ((s.out ?? 0) - (s.in ?? 0)) / (s.speed ?? 1) + (s.hold ?? 0);
}

export function place(edl: Edl): Placed[] {
  let start = 0;
  return edl.segments.map((segment) => {
    const end = start + segmentLength(segment);
    const p = { segment, start, end };
    start = end;
    return p;
  });
}

export function resolve(anchor: Anchor, placed: Placed[]): number {
  if ('at' in anchor) return anchor.at;
  const p = placed.find((x) => x.segment.id === anchor.segment);
  if (!p) throw new Error(`no segment "${anchor.segment}"`);
  const s = p.segment;
  if (isStill(s.source)) return p.start + anchor.t;
  const from = s.in ?? 0;
  const played = (s.out ?? 0) - from;
  if (anchor.t < from - 1e-6 || anchor.t > (s.out ?? 0) + 1e-6) {
    throw new Error(`t=${anchor.t} is outside segment "${s.id}" (${from}-${s.out})`);
  }
  return p.start + Math.min(anchor.t - from, played) / (s.speed ?? 1);
}

// Every problem in an EDL, as human-readable lines. Empty means renderable.
export function validate(edl: Edl, sourceSeconds: (source: string) => number | undefined): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const s of edl.segments) {
    if (ids.has(s.id)) problems.push(`segment id "${s.id}" is used twice`);
    ids.add(s.id);
    const len = sourceSeconds(s.source);
    if (len === undefined) problems.push(`${s.id}: source ${s.source} not found`);
    if (isStill(s.source)) {
      if (!(s.duration && s.duration > 0)) problems.push(`${s.id}: a still needs a duration`);
    } else {
      if (s.in === undefined || s.out === undefined) problems.push(`${s.id}: video needs in and out`);
      else if (s.out <= s.in) problems.push(`${s.id}: out (${s.out}) must be after in (${s.in})`);
      else if (len !== undefined && s.out > len + 0.05) problems.push(`${s.id}: out ${s.out} is past the end of ${s.source} (${len.toFixed(2)}s)`);
      if (s.speed !== undefined && !(s.speed > 0)) problems.push(`${s.id}: speed must be positive`);
    }
    if (s.crop) {
      const ratio = s.crop.w / s.crop.h;
      if (Math.abs(ratio - 16 / 9) > 0.02) problems.push(`${s.id}: crop is ${ratio.toFixed(3)}:1, not 16:9; it will be padded`);
      if (s.crop.x < 0 || s.crop.y < 0 || s.crop.x + s.crop.w > 1920 || s.crop.y + s.crop.h > 1080) problems.push(`${s.id}: crop runs outside 1920x1080`);
    }
  }
  const placed = place(edl);
  const total = placed.at(-1)?.end ?? 0;
  const check = (what: string, anchor: Anchor, length: number) => {
    try {
      const at = resolve(anchor, placed);
      if (at < 0) problems.push(`${what} starts before 0`);
      if (at + length > total + 0.05) problems.push(`${what} runs to ${(at + length).toFixed(2)}s, past the end of the video (${total.toFixed(2)}s)`);
    } catch (err) {
      problems.push(`${what}: ${(err as Error).message}`);
    }
  };
  edl.audio.forEach((a, i) => {
    const src = a.source === 'vo' ? edl.voiceover : a.source;
    const len = sourceSeconds(src);
    if (len === undefined) return problems.push(`audio ${i}: source ${src} not found`);
    const from = a.in ?? 0;
    const to = a.out ?? len;
    if (to <= from) problems.push(`audio ${i}: out must be after in`);
    if (to > len + 0.05) problems.push(`audio ${i}: out ${to} is past the end of ${src} (${len.toFixed(2)}s)`);
    check(`audio ${i} (${a.source} ${from}-${to})`, a, to - from);
  });
  (edl.captions ?? []).forEach((c, i) => check(`caption ${i} "${c.text.slice(0, 30)}"`, c, c.duration));

  // Voiceover clips that overlap each other on the timeline talk over themselves.
  const vo = edl.audio
    .filter((a) => a.source === 'vo')
    .map((a) => {
      try {
        const at = resolve(a, placed);
        return { at, end: at + ((a.out ?? Infinity) - (a.in ?? 0)), a };
      } catch {
        return null;
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((x, y) => x.at - y.at);
  for (let i = 1; i < vo.length; i++) {
    if (vo[i]!.at < vo[i - 1]!.end - 0.05) problems.push(`voiceover clips ${vo[i - 1]!.a.in}-${vo[i - 1]!.a.out} and ${vo[i]!.a.in}-${vo[i]!.a.out} overlap`);
  }
  return problems;
}
