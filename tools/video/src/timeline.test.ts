import { describe, expect, it } from 'vitest';
import { cuesFor, fix, snapToSilence, srt, tokensToWords, type Word } from './captions';
import { place, resolve, segmentLength, validate, type Edl } from './timeline';

const edl: Edl = {
  voiceover: 'vo/voiceover.wav',
  segments: [
    { id: 'title', source: 'cards/title.png', duration: 4 },
    { id: 'call', source: 'shots/scam/video.webm', in: 10, out: 30, speed: 2, hold: 1 },
    { id: 'race', source: 'shots/race/video.webm', in: 0, out: 6 },
  ],
  audio: [
    { source: 'vo', in: 0, out: 4, at: 0 },
    { source: 'shots/scam/warning-1.mp3', segment: 'call', t: 20 },
  ],
};
const lengths: Record<string, number> = {
  'cards/title.png': 0,
  'shots/scam/video.webm': 59,
  'shots/race/video.webm': 20,
  'vo/voiceover.wav': 120,
  'shots/scam/warning-1.mp3': 5,
};

describe('timeline', () => {
  it('lays segments end to end, counting speed and hold', () => {
    expect(segmentLength(edl.segments[1]!)).toBe(11);
    expect(place(edl).map((p) => [p.start, p.end])).toEqual([
      [0, 4],
      [4, 15],
      [15, 21],
    ]);
  });

  it('pins a source moment to the output timeline', () => {
    // 20 s into the scam shot is 10 s after `in`, played at 2x: 5 s into the segment.
    expect(resolve({ segment: 'call', t: 20 }, place(edl))).toBe(9);
    expect(resolve({ at: 3 }, place(edl))).toBe(3);
    expect(() => resolve({ segment: 'call', t: 40 }, place(edl))).toThrow(/outside/);
  });

  it('accepts a sound EDL', () => {
    expect(validate(edl, (s) => lengths[s])).toEqual([]);
  });

  it('reports clips past the end, overlapping voiceover and missing files', () => {
    const bad: Edl = {
      ...edl,
      segments: [...edl.segments, { id: 'race', source: 'shots/race/video.webm', in: 5, out: 25 }],
      audio: [
        { source: 'vo', in: 0, out: 10, at: 0 },
        { source: 'vo', in: 20, out: 25, at: 8 },
        { source: 'nope.mp3', at: 0 },
      ],
    };
    const problems = validate(bad, (s) => lengths[s]).join('\n');
    expect(problems).toMatch(/used twice/);
    expect(problems).toMatch(/past the end of shots\/race/);
    expect(problems).toMatch(/overlap/);
    expect(problems).toMatch(/nope.mp3 not found/);
  });
});

describe('captions', () => {
  const words: Word[] = [
    { text: 'This', start: 10.0, end: 10.2 },
    { text: 'is', start: 10.25, end: 10.4 },
    { text: 'ScamShield.', start: 10.45, end: 11.0 },
    { text: 'It', start: 11.8, end: 11.9 },
    { text: 'listens', start: 11.95, end: 12.3 },
    { text: 'to', start: 12.35, end: 12.45 },
    { text: 'Jeff', start: 12.5, end: 12.8 },
  ];

  it('splits at pauses, shifts to the output time and applies fixes', () => {
    const cues = cuesFor(words, 10, 13, 100, { Jeff: 'Jev' });
    expect(cues.map((c) => c.text)).toEqual(['This is ScamShield.', 'It listens to Jev']);
    expect(cues[0]!.start).toBeCloseTo(100);
    expect(cues[1]!.start).toBeCloseTo(101.8);
    expect(cues[0]!.end).toBeLessThan(cues[1]!.start);
  });

  it('only takes words inside the clip', () => {
    expect(cuesFor(words, 11.5, 13, 0).map((c) => c.text)).toEqual(['It listens to Jeff']);
  });

  it('tidies spacing before punctuation', () => {
    expect(fix('Hello , world .', {})).toBe('Hello, world.');
  });

  it('writes SRT', () => {
    expect(srt([{ start: 61.5, end: 63.25, text: 'Hi' }])).toBe('1\n00:01:01,500 --> 00:01:03,250\nHi\n');
  });
});

describe('word timings', () => {
  it('joins sub-word tokens and punctuation, timed from DTW onsets', () => {
    const words = tokensToWords([
      { text: '[_BEG_]', offsets: { from: 0, to: 0 }, t_dtw: -1 },
      { text: ' P', offsets: { from: 1470, to: 1490 }, t_dtw: 150 },
      { text: 'ahang', offsets: { from: 1490, to: 1900 }, t_dtw: 160 },
      { text: '.', offsets: { from: 1900, to: 1950 }, t_dtw: 190 },
      { text: ' Next', offsets: { from: 4000, to: 4300 }, t_dtw: 410 },
    ]);
    expect(words).toEqual([
      { text: 'Pahang.', start: 1.5, end: 4.1 },
      { text: 'Next', start: 4.1, end: 4.3 },
    ]);
  });

  it('ends a word at a pause, and keeps a sentence end before it', () => {
    const gaps = [{ start: 2.0, end: 4.0 }];
    const snapped = snapToSilence(
      [
        { text: 'Pahang', start: 1.5, end: 4.1 },
        { text: 'it.', start: 2.5, end: 4.2 },
        { text: 'Next', start: 3.8, end: 4.5 },
      ],
      gaps,
    );
    expect(snapped[0]).toEqual({ text: 'Pahang', start: 1.5, end: 2.0 });
    expect(snapped[1]).toMatchObject({ text: 'it.', end: 2.0 });
    expect(snapped[2]).toEqual({ text: 'Next', start: 4.0, end: 4.5 });
  });
});
