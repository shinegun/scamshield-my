import { RED_FLAG_KEYS, type Action, type FlagScores, type RedFlag } from '@scamshield/shared';
import { describe, expect, it } from 'vitest';
import { callerSignals } from './signals';
import type { RiskMessage, TranscriptLine } from './state';

function flags(on: Partial<Record<RedFlag, number>>): FlagScores {
  const scores = Object.fromEntries(RED_FLAG_KEYS.map((k) => [k, 0])) as FlagScores;
  return { ...scores, ...on };
}

function tick(atSec: number, on: Partial<Record<RedFlag, number>>, action: Action = 'none'): RiskMessage {
  return {
    type: 'risk',
    risk: 0,
    action,
    stage: 'none',
    scamType: 'none',
    flags: flags(on),
    scorer: 'gemini',
    latencyMs: 300,
    atSec,
  };
}

const caller = (atSec: number): TranscriptLine => ({ speaker: 'caller', text: 'c', atSec });
const user = (atSec: number): TranscriptLine => ({ speaker: 'user', text: 'u', atSec });

describe('callerSignals', () => {
  it('puts a flag under the caller line before the tick that first heard it', () => {
    const transcript = [caller(2), user(4), caller(6)];
    const history = [
      tick(2, { claims_authority: 0.9 }, 'soft_warning'),
      tick(4, { claims_authority: 0.9 }, 'soft_warning'),
      tick(6, { claims_authority: 0.9, victim_framing: 0.7 }, 'strong_warning'),
    ];
    const signals = callerSignals(transcript, history);
    expect(signals.get(0)).toEqual({ flags: ['claims_authority'], action: 'soft_warning' });
    expect(signals.has(1)).toBe(false);
    expect(signals.get(2)).toEqual({ flags: ['victim_framing'], action: 'strong_warning' });
  });

  it('counts a flag at exactly 0.5 and ignores one below', () => {
    const signals = callerSignals([caller(1)], [tick(1, { creates_urgency: 0.5, demands_secrecy: 0.49 })]);
    expect(signals.get(0)?.flags).toEqual(['creates_urgency']);
  });

  it('labels each flag once, even if it dips and comes back', () => {
    const transcript = [caller(1), caller(3), caller(5)];
    const history = [
      tick(1, { asks_for_transfer: 0.8 }),
      tick(3, { asks_for_transfer: 0.2 }),
      tick(5, { asks_for_transfer: 0.9 }),
    ];
    const signals = callerSignals(transcript, history);
    expect([...signals.keys()]).toEqual([0]);
  });

  it('gives a user line\'s tick to the caller line before it', () => {
    const signals = callerSignals([caller(1), user(3)], [tick(3, { user_seems_compliant: 0.8 }, 'soft_warning')]);
    expect(signals.get(0)?.flags).toEqual(['user_seems_compliant']);
  });

  it('merges two ticks after one caller line, in RED_FLAGS order, with the later action', () => {
    const history = [
      tick(1, { asks_for_otp_or_tac: 0.9 }, 'strong_warning'),
      tick(2, { asks_for_otp_or_tac: 0.9, claims_authority: 0.9 }, 'hold_transfers'),
    ];
    expect(callerSignals([caller(1)], history).get(0)).toEqual({
      flags: ['claims_authority', 'asks_for_otp_or_tac'],
      action: 'hold_transfers',
    });
  });

  it('drops flags heard before any caller line, and an innocent call has none', () => {
    expect(callerSignals([user(1)], [tick(1, { creates_urgency: 0.9 })]).size).toBe(0);
    expect(callerSignals([caller(1), user(2)], [tick(1, {}), tick(2, { creates_urgency: 0.2 })]).size).toBe(0);
  });
});
