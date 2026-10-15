import { describe, expect, it } from 'vitest';
import { emptySession, type Decision, type RaceEntry } from '@scamshield/shared';
import {
  axisTicks,
  buildPresets,
  deckLine,
  excerpt,
  fasterNote,
  laneViews,
  median,
  raceHeadline,
  raceSubline,
  summarizeRuns,
  toColumns,
} from './view';

const ok = (scorer: 'jev' | 'gemini', latencyMs: number, flags: Partial<Decision['flags']> = {}): RaceEntry => ({
  scorer,
  model: `${scorer}-m`,
  ok: true,
  latencyMs,
  risk: 0.9,
  decision: { scamStage: 'financial_request', scamType: 'fake_police', flags: { ...emptySession().peakFlags, ...flags } },
});
const fail = (scorer: 'jev' | 'gemini', latencyMs = 10000): RaceEntry => ({
  scorer,
  ok: false,
  latencyMs,
  error: 'timed out',
});

describe('median', () => {
  it('handles odd, even and empty', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNaN();
  });
});

describe('summarizeRuns', () => {
  it('gives median, min and max per scorer and skips failures', () => {
    const runs = [
      [ok('jev', 300), ok('gemini', 1000)],
      [ok('jev', 100), ok('gemini', 1400)],
      [ok('jev', 200), fail('gemini')],
      [ok('jev', 500), ok('gemini', 1200)],
      [ok('jev', 400), ok('gemini', 900)],
    ];
    const [jev, gem] = summarizeRuns(runs);
    expect(jev).toMatchObject({ scorer: 'jev', ok: 5, runs: 5, medianMs: 300, minMs: 100, maxMs: 500 });
    expect(gem).toMatchObject({ scorer: 'gemini', ok: 4, runs: 5, medianMs: 1100, minMs: 900, maxMs: 1400 });
  });

  it('reports NaN when a scorer never answered', () => {
    const [jev] = summarizeRuns([[fail('jev'), ok('gemini', 900)]]);
    expect(jev!.ok).toBe(0);
    expect(jev!.medianMs).toBeNaN();
  });
});

describe('fasterNote and deckLine', () => {
  it('names the faster scorer', () => {
    expect(fasterNote(300, 1200)).toBe('Jev 4.0x faster');
    expect(fasterNote(1500, 500)).toBe('Gemini 3.0x faster');
    expect(fasterNote(500, 510)).toBe('about the same');
    expect(fasterNote(0, 500)).toBe('');
  });

  it('writes a one-line summary', () => {
    const stats = summarizeRuns([[ok('jev', 300), ok('gemini', 1200)]]);
    expect(deckLine(stats)).toBe('Jev 300 ms vs Gemini 1.2 s (median of 1): Jev 4.0x faster');
  });

  it('copes with a scorer that did not answer', () => {
    const stats = summarizeRuns([[fail('jev'), ok('gemini', 1200)]]);
    expect(deckLine(stats)).toBe('Jev no answer vs Gemini 1.2 s (median of 1)');
  });
});

describe('toColumns', () => {
  it('scales bars to the slower answer and lists raised flags', () => {
    const [jev, gem] = toColumns([
      ok('jev', 250, { asks_for_otp_or_tac: 0.9, claims_authority: 0.4, asks_for_transfer: 0.6 }),
      ok('gemini', 1000),
    ]);
    expect(jev).toMatchObject({ title: 'Jev', ok: true, barPercent: 25, percent: '90%', latencyText: '250 ms' });
    expect(jev!.flags.map((f) => f.label)).toEqual(['Asks for OTP or TAC', 'Asks for transfer']);
    expect(gem).toMatchObject({ title: 'Gemini', barPercent: 100, latencyText: '1.0 s', scamTypeText: 'Fake police' });
  });

  it('keeps jev first and shows a failure', () => {
    const cols = toColumns([ok('gemini', 800), fail('jev', 10000)]);
    expect(cols.map((c) => c.scorer)).toEqual(['jev', 'gemini']);
    expect(cols[0]).toMatchObject({ ok: false, error: 'timed out', barPercent: 100, flags: [] });
  });
});

describe('presets', () => {
  const presets = buildPresets();

  it('builds the scam and innocent chunks within the size limit', () => {
    expect(presets.map((p) => p.id)).toEqual(['ms-money', 'ms-start', 'manglish-money', 'innocent']);
    for (const p of presets) {
      expect(p.text.length).toBeGreaterThan(0);
      expect(p.text.length).toBeLessThanOrEqual(600);
      expect(p.language).toMatch(/-MY$/);
    }
    expect(presets.find((p) => p.id === 'innocent')!.text).toContain('Maybank');
  });

  it('excerpt keeps whole lines and cuts a single long one', () => {
    const lines = [
      { speaker: 'caller', text: 'a'.repeat(10) },
      { speaker: 'user', text: 'b'.repeat(10) },
    ];
    expect(excerpt(lines, 40)).toBe(`caller: ${'a'.repeat(10)}\nuser: ${'b'.repeat(10)}`);
    expect(excerpt(lines, 25)).toBe(`caller: ${'a'.repeat(10)}`);
    expect(excerpt([{ speaker: 'caller', text: 'x'.repeat(100) }], 30)).toHaveLength(30);
  });
});

describe('raceHeadline', () => {
  it('asks before any answer', () => {
    expect(raceHeadline(null)).toEqual({ lead: 'Who decides first?' });
    expect(raceHeadline(summarizeRuns([[fail('jev'), fail('gemini')]]))).toEqual({ lead: 'Who decides first?' });
  });

  it('names the scorer with the lower median', () => {
    expect(raceHeadline(summarizeRuns([[ok('jev', 235), ok('gemini', 895)]]))).toEqual({
      winner: 'jev',
      lead: 'Jev decides in ',
      value: '235 ms',
    });
    expect(raceHeadline(summarizeRuns([[ok('jev', 1500), ok('gemini', 900)]]))).toMatchObject({
      winner: 'gemini',
      value: '900 ms',
    });
  });

  it('lets the only answering scorer win', () => {
    expect(raceHeadline(summarizeRuns([[fail('jev'), ok('gemini', 1200)]]))).toMatchObject({ winner: 'gemini' });
  });
});

describe('raceSubline', () => {
  it('says once or n times', () => {
    expect(raceSubline('Malay scam: asks for money', 5)).toBe(
      'Malay scam: asks for money, sent to both scorers 5 times.',
    );
    expect(raceSubline('Innocent bank call', 1)).toBe('Innocent bank call, sent to both scorers once.');
  });
});

describe('laneViews', () => {
  it('is empty before any run', () => {
    const [jev, gem] = laneViews([]);
    expect(jev).toMatchObject({ scorer: 'jev', medianText: '—', rangeText: '', medianPercent: 0, dots: [] });
    expect(gem!.verdict).toBeUndefined();
  });

  it('scales to the slowest answer and describes the range', () => {
    const runs = [
      [ok('jev', 225), ok('gemini', 802)],
      [ok('jev', 253), ok('gemini', 1500)],
      [ok('jev', 235), ok('gemini', 895)],
    ];
    const [jev, gem] = laneViews(runs);
    expect(jev).toMatchObject({ title: 'Jev', medianText: '235 ms', rangeText: '225–253 ms · 3/3 answered' });
    expect(jev!.medianPercent).toBeCloseTo((235 / 1600) * 100);
    expect(jev!.dots).toHaveLength(3);
    expect(gem).toMatchObject({ medianText: '895 ms', rangeText: '802 ms–1.5 s · 3/3 answered' });
    expect(gem!.verdict).toBe('90% · Fake police');
  });

  it('uses a larger scale when a run is slow and shows a single run plainly', () => {
    const [jev, gem] = laneViews([[ok('jev', 300), ok('gemini', 2500)]]);
    expect(jev!.medianPercent).toBeCloseTo((300 / 3200) * 100);
    expect(gem!.dots[0]).toBeCloseTo((2500 / 3200) * 100);
    expect(jev!.rangeText).toBe('1/1 answered');
  });

  it('reports a failed latest answer and no-scam verdicts', () => {
    const calm: RaceEntry = {
      scorer: 'jev',
      model: 'jev-m',
      ok: true,
      latencyMs: 200,
      risk: 0.05,
      decision: { scamStage: 'none', scamType: 'none', flags: emptySession().peakFlags },
    };
    const [jev, gem] = laneViews([[calm, fail('gemini')]]);
    expect(jev!.verdict).toMatch(/· No scam$/);
    expect(gem).toMatchObject({ error: 'timed out', medianText: '—', rangeText: '0/1 answered', dots: [] });
  });
});

describe('axisTicks', () => {
  it('labels five points', () => {
    expect(axisTicks(1600)).toEqual(['0', '0.4 s', '0.8 s', '1.2 s', '1.6 s']);
    expect(axisTicks(400)).toEqual(['0', '100 ms', '200 ms', '300 ms', '400 ms']);
    expect(axisTicks(12800)).toEqual(['0', '3.2 s', '6.4 s', '9.6 s', '12.8 s']);
  });
});
