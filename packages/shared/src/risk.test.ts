import { describe, expect, it } from 'vitest';
import { absorb, combinedRisk, decideAction, emptySession, flagsSeen, type SessionRisk } from './risk';
import type { Decision, FlagScores, ScamStage } from './schema';

const unknownCaller = { durationSec: 120, callerKnown: false };

function decision(scamStage: ScamStage, flags: Partial<FlagScores>): Decision {
  return { scamStage, scamType: 'fake_police', flags: { ...emptySession().peakFlags, ...flags } };
}

describe('the MCMC-to-police call from the plan', () => {
  // One tick per stage, each flag at 0.8, in the order the real call ran.
  const ticks: [Decision, string][] = [
    [decision('authority_setup', { claims_authority: 0.8, call_transferred_between_agencies: 0.8 }), 'none'],
    [decision('victim_framing', { victim_framing: 0.8 }), 'none'],
    [decision('family_pressure', { mentions_family_involvement: 0.8, demands_secrecy: 0.8 }), 'soft_warning'],
    [decision('isolation', { keep_on_line_instruction: 0.8 }), 'strong_warning'],
    [decision('identity_request', { asks_for_ic_or_selfie: 0.8 }), 'strong_warning'],
    [decision('financial_request', { asks_for_transfer: 0.8 }), 'hold_transfers'],
  ];

  it('escalates stage by stage', () => {
    let session = emptySession();
    for (const [tick, expected] of ticks) {
      session = absorb(session, tick);
      expect(decideAction(session, unknownCaller).action, tick.scamStage).toBe(expected);
    }
  });
});

describe('normal calls stay quiet', () => {
  it('ignores a real bank callback that only claims authority', () => {
    const session = absorb(emptySession(), decision('none', { claims_authority: 0.95 }));
    expect(decideAction(session, { durationSec: 90, callerKnown: false }).action).toBe('none');
  });

  it('ignores a long bank call where only noise adds up', () => {
    // Peak flags Jev gave the innocent script's card check on 14 October.
    const session = absorb(
      emptySession(),
      decision('none', {
        claims_authority: 0.95,
        user_seems_compliant: 0.9,
        asks_to_install_app: 0.22,
        victim_framing: 0.18,
      }),
    );
    expect(decideAction(session, unknownCaller).action).toBe('none');
  });

  it('ignores a long call with a saved contact', () => {
    expect(decideAction(emptySession(), { durationSec: 3 * 3600, callerKnown: true }).action).toBe('none');
  });
});

describe('session memory', () => {
  it('keeps peak flags and the furthest stage through a calm stretch', () => {
    let session = absorb(emptySession(), decision('isolation', { demands_secrecy: 0.9 }));
    session = absorb(session, decision('none', { demands_secrecy: 0.1 }));
    expect(session.peakFlags.demands_secrecy).toBe(0.9);
    expect(session.stageReached).toBe('isolation');
    expect(flagsSeen(session)).toEqual(['demands_secrecy']);
  });
});

describe('floors', () => {
  const at = (stageReached: ScamStage): SessionRisk => ({ ...emptySession(), stageReached });

  it('gives at least a strong warning once identity is requested', () => {
    expect(decideAction(at('identity_request'), unknownCaller).action).toBe('strong_warning');
  });

  it('holds transfers once money is requested', () => {
    expect(decideAction(at('financial_request'), unknownCaller).action).toBe('hold_transfers');
  });

  it('gives at least a soft warning after an hour with an unknown number', () => {
    expect(decideAction(emptySession(), { durationSec: 3601, callerKnown: false }).action).toBe('soft_warning');
  });
});

describe('combinedRisk', () => {
  it('is 0 with no flags and tolerates out-of-range model output', () => {
    expect(combinedRisk(emptySession().peakFlags)).toBe(0);
    const junk = { ...emptySession().peakFlags, asks_for_transfer: 7, asks_for_otp_or_tac: Number.NaN };
    expect(combinedRisk(junk)).toBeCloseTo(0.85);
  });
});
