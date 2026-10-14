import { CALL_SCRIPTS, type ServerMessage } from '@scamshield/shared';
import { describe, expect, it } from 'vitest';
import { callReducer, initialCallState, type CallAction, type CallState } from './state';

const script = CALL_SCRIPTS[0]!;

function run(actions: CallAction[], from: CallState = initialCallState): CallState {
  return actions.reduce(callReducer, from);
}
const server = (message: ServerMessage): CallAction => ({ type: 'server', message });

const risk: Extract<ServerMessage, { type: 'risk' }> = {
  type: 'risk',
  risk: 0.5,
  action: 'soft_warning',
  stage: 'authority_setup',
  scamType: 'fake_police',
  flags: {} as never,
  scorer: 'jev',
  latencyMs: 300,
  atSec: 5,
};

describe('callReducer', () => {
  it('moves idle -> connecting -> live', () => {
    const connecting = run([{ type: 'start', script }]);
    expect(connecting.status).toBe('connecting');
    expect(connecting.script).toBe(script);
    const live = callReducer(connecting, server({ type: 'session.started', sessionId: 's1' }));
    expect(live.status).toBe('live');
    expect(live.sessionId).toBe('s1');
  });

  it('pairs each transcript echo with the speaker of the line injected, in order', () => {
    const state = run([
      { type: 'start', script },
      { type: 'injected', speaker: 'caller' },
      { type: 'injected', speaker: 'user' },
      server({ type: 'transcript', text: 'a', language: 'ms-MY', atSec: 1 }),
      { type: 'injected', speaker: 'caller' },
      server({ type: 'transcript', text: 'b', language: 'ms-MY', atSec: 2 }),
      server({ type: 'transcript', text: 'c', language: 'ms-MY', atSec: 3 }),
    ]);
    expect(state.transcript).toEqual([
      { speaker: 'caller', text: 'a', atSec: 1 },
      { speaker: 'user', text: 'b', atSec: 2 },
      { speaker: 'caller', text: 'c', atSec: 3 },
    ]);
    expect(state.pendingSpeakers).toEqual([]);
  });

  it('defaults an unpaired echo to the caller', () => {
    const state = run([server({ type: 'transcript', text: 'x', language: 'ms-MY', atSec: 1 })]);
    expect(state.transcript[0]?.speaker).toBe('caller');
  });

  it('keeps the latest risk and the full history', () => {
    const second = { ...risk, risk: 0.9, atSec: 9 };
    const state = run([server(risk), server(second)]);
    expect(state.risk).toBe(second);
    expect(state.riskHistory).toEqual([risk, second]);
  });

  it('keeps warnings in arrival order', () => {
    const soft = { type: 'warning', action: 'soft_warning', text: 'a', language: 'ms-MY' } as const;
    const strong = { type: 'warning', action: 'strong_warning', text: 'b', language: 'ms-MY' } as const;
    expect(run([server(soft), server(strong)]).warnings).toEqual([soft, strong]);
  });

  it('keeps the latest message per transferId', () => {
    const held = {
      type: 'transfer', transferId: 't1', status: 'held', amountRm: 5000, toAccount: 'x', atSec: 10,
    } as const;
    const released = { ...held, status: 'released', atSec: 20 } as const;
    const other = { ...held, transferId: 't2', status: 'completed' } as const;
    const state = run([server(held), server(other), server(released)]);
    expect(state.transfers).toEqual({ t1: released, t2: other });
    expect(state.lastTransfer).toBe(released);
  });

  it('records pipeline errors without ending the call', () => {
    const state = run([
      { type: 'start', script },
      server({ type: 'session.started', sessionId: 's' }),
      server({ type: 'error', message: 'Scoring failed' }),
    ]);
    expect(state.status).toBe('live');
    expect(state.errors).toEqual(['Scoring failed']);
  });

  it('turns a connection error into the error status once', () => {
    const state = run([
      { type: 'start', script },
      { type: 'connection-error', message: 'first' },
      { type: 'connection-error', message: 'second' },
    ]);
    expect(state.status).toBe('error');
    expect(state.errors).toEqual(['first']);
  });

  it('ignores a late connection error after the call ended', () => {
    const state = run([
      { type: 'start', script },
      { type: 'end' },
      { type: 'connection-error', message: 'late' },
    ]);
    expect(state.status).toBe('ended');
    expect(state.errors).toEqual([]);
  });

  it('start and reset clear the previous call', () => {
    const dirty = run([{ type: 'start', script }, server(risk)]);
    expect(callReducer(dirty, { type: 'start', script }).riskHistory).toEqual([]);
    expect(callReducer(dirty, { type: 'reset' })).toEqual(initialCallState);
  });
});
