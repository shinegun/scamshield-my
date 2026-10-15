import { RED_FLAG_KEYS, type Action, type FlagScores, type RedFlag, type ScamStage } from '@scamshield/shared';
import { describe, expect, it } from 'vitest';
import { inspect } from './inspector';
import type { RiskMessage } from './state';

function tick(
  atSec: number,
  on: Partial<Record<RedFlag, number>>,
  action: Action = 'none',
  stage: ScamStage = 'none',
  extra: Partial<RiskMessage> = {},
): RiskMessage {
  const flags = { ...Object.fromEntries(RED_FLAG_KEYS.map((k) => [k, 0])), ...on } as FlagScores;
  return {
    type: 'risk',
    risk: 0.3,
    action,
    stage,
    scamType: 'fake_police',
    flags,
    scorer: 'jev',
    latencyMs: 213,
    atSec,
    ...extra,
  };
}

describe('inspect', () => {
  it('is empty before the first risk message', () => {
    const view = inspect(undefined, []);
    expect(view.percent).toBeUndefined();
    expect(view.action).toBe('none');
    expect(view.scoredBy).toBeUndefined();
    expect(view.stages).toHaveLength(6);
    expect(view.stages.some((s) => s.reached)).toBe(false);
    expect(view.heard).toEqual([]);
    expect(view.notYet).toHaveLength(13);
  });

  it('lights the stage track up to the current stage', () => {
    const last = tick(4, {}, 'soft_warning', 'victim_framing');
    const view = inspect(last, [last]);
    expect(view.stages.map((s) => s.reached)).toEqual([true, true, false, false, false, false]);
    expect(view.stages.find((s) => s.current)?.key).toBe('victim_framing');
    expect(view.stages[0]?.label).toBe('Authority');
  });

  it('reports the scorer of the last real tick, skipping a clock.skip answer', () => {
    const real = tick(4, {}, 'soft_warning', 'none', { scorer: 'gemini', latencyMs: 1400 });
    const skip = tick(900, {}, 'strong_warning', 'none', { latencyMs: 0 });
    const view = inspect(skip, [real, skip]);
    expect(view.scoredBy).toBe('Scored by Gemini in 1.4 s');
    expect(view.percent).toBe(30);
  });

  it('shows the scam type only once the engine acts', () => {
    const calm = tick(1, {}, 'none');
    expect(inspect(calm, [calm]).scamType).toBeUndefined();
    const acting = tick(2, {}, 'soft_warning');
    expect(inspect(acting, [acting]).scamType).toBe('Fake police');
  });

  it('lists heard signals in the order heard, with the action that heard them, and the rest as not yet', () => {
    const history = [
      tick(2, { claims_authority: 0.9 }, 'soft_warning'),
      tick(5, { claims_authority: 0.9, keep_on_line_instruction: 0.6 }, 'strong_warning'),
    ];
    const view = inspect(history[1], history);
    expect(view.heard.map((h) => [h.flag, h.action, h.atSec])).toEqual([
      ['claims_authority', 'soft_warning', 2],
      ['keep_on_line_instruction', 'strong_warning', 5],
    ]);
    expect(view.notYet).toHaveLength(11);
    expect(view.notYet.map((n) => n.flag)).not.toContain('claims_authority');
  });

  it('marks the ticks where the action changed', () => {
    const history = [
      tick(1, {}, 'none'),
      tick(2, {}, 'soft_warning'),
      tick(3, {}, 'soft_warning'),
      tick(4, {}, 'hold_transfers'),
    ];
    const view = inspect(history[3], history);
    expect(view.actionChanges).toEqual([
      { atSec: 2, action: 'soft_warning' },
      { atSec: 4, action: 'hold_transfers' },
    ]);
    expect(view.points).toHaveLength(4);
  });
});
