import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptySession, type CallState, type Decision, type ScorerName, type ServerMessage } from '@scamshield/shared';
import { CallSession } from './session';
import type { Scorer } from './scorers/types';

const decision = (flags: Partial<Decision['flags']> = {}): Decision => ({
  scamStage: 'financial_request',
  scamType: 'fake_police',
  flags: { ...emptySession().peakFlags, ...flags },
});

function racer(
  name: ScorerName,
  run: (state: CallState, signal?: AbortSignal) => Promise<Decision>,
  latencyMs = 10,
): Scorer & { states: CallState[] } {
  const states: CallState[] = [];
  return {
    name,
    states,
    async score(state, signal) {
      states.push(state);
      return { decision: await run(state, signal), scorer: name, model: `${name}-fake`, latencyMs };
    },
  };
}

function setup(racers: Scorer[], scorer: Scorer = racer('jev', async () => decision())) {
  const sent: ServerMessage[] = [];
  const session = new CallSession({ scorer, racers, now: () => 0, send: (m) => sent.push(m) });
  return { session, sent };
}
const run = (text: string) => JSON.stringify({ type: 'race.run', text, language: 'ms-MY' });

afterEach(() => vi.useRealTimers());

describe('race.run', () => {
  it('works before session.start, with entries in jev, gemini order', async () => {
    // Registered gemini first on purpose: the reply order is fixed.
    const gemini = racer('gemini', async () => decision({ asks_for_transfer: 0.9 }));
    const jev = racer('jev', async () => decision());
    const { session, sent } = setup([gemini, jev]);
    await session.receive(run('Pindahkan wang sekarang'));

    expect(sent).toHaveLength(1);
    const msg = sent[0]!;
    if (msg.type !== 'race.result') throw new Error('expected race.result');
    expect(msg.text).toBe('Pindahkan wang sekarang');
    expect(msg.entries.map((e) => e.scorer)).toEqual(['jev', 'gemini']);
    const g = msg.entries[1]!;
    expect(g.ok && g.risk).toBeGreaterThan(0.5);
    expect(g.ok && g.model).toBe('gemini-fake');
    // Scored as a fresh, empty call.
    expect(gemini.states[0]).toMatchObject({
      recentTranscript: 'Pindahkan wang sekarang',
      flagsSeenSoFar: [],
      stageReached: 'none',
      callerKnown: false,
      durationSec: 0,
      bankAppOpen: false,
    });
  });

  it('turns a failing racer into a failed entry without hiding the other', async () => {
    const { session, sent } = setup([
      racer('jev', async () => {
        throw new Error('boom');
      }),
      racer('gemini', async () => decision()),
    ]);
    await session.receive(run('hello'));
    const msg = sent[0]!;
    if (msg.type !== 'race.result') throw new Error('expected race.result');
    expect(msg.entries[0]).toMatchObject({ scorer: 'jev', ok: false, error: 'boom' });
    expect(msg.entries[1]).toMatchObject({ scorer: 'gemini', ok: true });
  });

  it('gives up on a racer after 10 s and aborts it', async () => {
    vi.useFakeTimers();
    let aborted = false;
    const slow = racer('jev', (_s, signal) => {
      signal?.addEventListener('abort', () => (aborted = true));
      return new Promise(() => {});
    });
    const { session, sent } = setup([slow, racer('gemini', async () => decision())]);
    const done = session.receive(run('hello'));
    await vi.advanceTimersByTimeAsync(10_000);
    await done;
    const msg = sent[0]!;
    if (msg.type !== 'race.result') throw new Error('expected race.result');
    expect(msg.entries[0]).toMatchObject({ scorer: 'jev', ok: false, error: expect.stringContaining('timed out') });
    expect(aborted).toBe(true);
  });

  it('rejects text over 2000 characters', async () => {
    const jev = racer('jev', async () => decision());
    const { session, sent } = setup([jev]);
    await session.receive(run('x'.repeat(2001)));
    expect(sent).toEqual([{ type: 'error', message: expect.stringContaining('2000') }]);
    expect(jev.states).toHaveLength(0);
    await session.receive(run('x'.repeat(2000)));
    expect(sent[1]!.type).toBe('race.result');
  });

  it('allows one race at a time', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { session, sent } = setup([
      racer('jev', async () => {
        await gate;
        return decision();
      }),
    ]);
    const first = session.receive(run('one'));
    await session.receive(run('two'));
    expect(sent).toEqual([{ type: 'error', message: expect.stringContaining('already running') }]);
    release();
    await first;
    expect(sent[1]!.type).toBe('race.result');
    await session.receive(run('three'));
    expect(sent[2]!.type).toBe('race.result');
  });

  it('leaves the call untouched', async () => {
    const callScorer = racer('jev', async () => decision());
    const { session, sent } = setup([racer('jev', async () => decision({ asks_for_transfer: 1 }))], callScorer);
    await session.receive(
      JSON.stringify({ type: 'session.start', callerKnown: true, callerInternational: false, language: 'en' }),
    );
    await session.receive(run('Transfer money now'));
    await session.receive(JSON.stringify({ type: 'transfer.attempt', amountRm: 100, toAccount: 'x' }));

    expect(callScorer.states).toHaveLength(0);
    expect(sent.map((m) => m.type)).toEqual(['session.started', 'race.result', 'transfer']);
    expect(sent[2]).toMatchObject({ status: 'completed' });
  });
});
