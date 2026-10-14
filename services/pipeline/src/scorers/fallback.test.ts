import type { CallState } from '@scamshield/shared';
import { describe, expect, it } from 'vitest';
import { FallbackScorer } from './fallback';
import type { ScoreResult, Scorer } from './types';

const state = {} as CallState;

function result(scorer: 'jev' | 'gemini', latencyMs: number): ScoreResult {
  return {
    decision: {
      scamStage: 'none',
      scamType: 'none',
      flags: {} as ScoreResult['decision']['flags'],
    },
    scorer,
    model: `${scorer}-test`,
    latencyMs,
  };
}

// A scorer that answers (or fails) after delayMs and records whether it was aborted.
function fake(name: 'jev' | 'gemini', delayMs: number, opts: { fail?: boolean } = {}) {
  const scorer = {
    name,
    aborted: false,
    async score(_state: CallState, signal?: AbortSignal) {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, delayMs);
        signal?.addEventListener('abort', () => {
          scorer.aborted = true;
          clearTimeout(t);
          reject(new Error('aborted'));
        });
      });
      if (opts.fail) throw new Error(`${name} broke`);
      return result(name, delayMs);
    },
  };
  return scorer satisfies Scorer & { aborted: boolean };
}

describe('FallbackScorer', () => {
  it('returns the primary when it answers in time, and aborts the fallback', async () => {
    const primary = fake('jev', 10);
    const fallback = fake('gemini', 200);
    const scorer = new FallbackScorer(primary, fallback, { timeoutMs: 100 });
    const res = await scorer.score(state);
    expect(res.scorer).toBe('jev');
    expect(res.latencyMs).toBe(10);
    expect(scorer.name).toBe('jev');
    expect(fallback.aborted).toBe(true);
    expect(primary.aborted).toBe(false);
  });

  it('returns the fallback when the primary is slow, and aborts the primary', async () => {
    const primary = fake('jev', 300);
    const fallback = fake('gemini', 40);
    const res = await new FallbackScorer(primary, fallback, { timeoutMs: 80 }).score(state);
    expect(res.scorer).toBe('gemini');
    expect(res.latencyMs).toBe(40);
    expect(primary.aborted).toBe(true);
  });

  it('waits for a still-running fallback after the timeout', async () => {
    const res = await new FallbackScorer(fake('jev', 300), fake('gemini', 120), { timeoutMs: 40 }).score(state);
    expect(res.scorer).toBe('gemini');
  });

  it('returns the fallback when the primary fails', async () => {
    const res = await new FallbackScorer(fake('jev', 5, { fail: true }), fake('gemini', 20), {
      timeoutMs: 100,
    }).score(state);
    expect(res.scorer).toBe('gemini');
  });

  it('rejects when the primary is slow and there is no fallback', async () => {
    const primary = fake('jev', 300);
    await expect(new FallbackScorer(primary, undefined, { timeoutMs: 40 }).score(state)).rejects.toThrow(
      /timed out/,
    );
    expect(primary.aborted).toBe(true);
  });

  it('rejects with the primary error when it fails and there is no fallback', async () => {
    await expect(
      new FallbackScorer(fake('jev', 5, { fail: true }), undefined, { timeoutMs: 100 }).score(state),
    ).rejects.toThrow(/jev broke/);
  });

  it('rejects mentioning both when both fail', async () => {
    const err = await new FallbackScorer(fake('jev', 5, { fail: true }), fake('gemini', 10, { fail: true }), {
      timeoutMs: 100,
    })
      .score(state)
      .catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/jev broke/);
    expect((err as Error).message).toMatch(/gemini broke/);
  });

  it('aborts both scorers when the caller aborts', async () => {
    const primary = fake('jev', 300);
    const fallback = fake('gemini', 300);
    const ctl = new AbortController();
    const pending = new FallbackScorer(primary, fallback, { timeoutMs: 1000 }).score(state, ctl.signal);
    setTimeout(() => ctl.abort(), 10);
    await expect(pending).rejects.toThrow();
    expect(primary.aborted).toBe(true);
    expect(fallback.aborted).toBe(true);
  });
});
