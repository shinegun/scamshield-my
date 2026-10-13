import {
  RED_FLAGS,
  RED_FLAG_KEYS,
  SCAM_STAGES,
  type Decision,
  type FlagScores,
  type RedFlag,
  type ScamStage,
} from './schema';

// Ordered by severity.
export const ACTIONS = ['none', 'soft_warning', 'strong_warning', 'hold_transfers'] as const;
export type Action = (typeof ACTIONS)[number];

// Combined risk at or above each value triggers that action. Tunable per bank.
export interface Thresholds {
  soft: number;
  strong: number;
  hold: number;
}
export const DEFAULT_THRESHOLDS: Thresholds = { soft: 0.4, strong: 0.7, hold: 0.85 };

const LONG_CALL_SEC = 60 * 60;
// A flag counts as "seen" in the summary sent back to the model above this.
const FLAG_SEEN_AT = 0.5;

// What a call has accumulated so far. Flags keep their peak and the stage
// never moves backwards, so a calm minute late in a call can't reset it.
export interface SessionRisk {
  peakFlags: FlagScores;
  stageReached: ScamStage;
}

export interface CallContext {
  durationSec: number;
  callerKnown: boolean;
}

export function emptySession(): SessionRisk {
  const peakFlags = Object.fromEntries(RED_FLAG_KEYS.map((k) => [k, 0])) as FlagScores;
  return { peakFlags, stageReached: 'none' };
}

export function absorb(session: SessionRisk, decision: Decision): SessionRisk {
  const peakFlags = { ...session.peakFlags };
  for (const k of RED_FLAG_KEYS) {
    peakFlags[k] = Math.max(peakFlags[k], clamp01(decision.flags[k]));
  }
  const stageReached =
    stageRank(decision.scamStage) > stageRank(session.stageReached)
      ? decision.scamStage
      : session.stageReached;
  return { peakFlags, stageReached };
}

export function flagsSeen(session: SessionRisk): RedFlag[] {
  return RED_FLAG_KEYS.filter((k) => session.peakFlags[k] >= FLAG_SEEN_AT);
}

// Noisy-OR: each flag is an independent chance the call is a scam, so several
// weak flags add up while one weak flag alone stays low.
export function combinedRisk(flags: FlagScores): number {
  let pClean = 1;
  for (const k of RED_FLAG_KEYS) {
    pClean *= 1 - RED_FLAGS[k].weight * clamp01(flags[k]);
  }
  return 1 - pClean;
}

export function decideAction(
  session: SessionRisk,
  ctx: CallContext,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): { risk: number; action: Action } {
  const risk = combinedRisk(session.peakFlags);
  let action: Action = 'none';
  if (risk >= thresholds.hold) action = 'hold_transfers';
  else if (risk >= thresholds.strong) action = 'strong_warning';
  else if (risk >= thresholds.soft) action = 'soft_warning';

  // Floors: the stage reached and call length guarantee a minimum response
  // whatever the score says.
  if (session.stageReached === 'financial_request') action = atLeast(action, 'hold_transfers');
  if (session.stageReached === 'identity_request') action = atLeast(action, 'strong_warning');
  if (!ctx.callerKnown && ctx.durationSec > LONG_CALL_SEC) action = atLeast(action, 'soft_warning');

  return { risk, action };
}

function atLeast(action: Action, floor: Action): Action {
  return ACTIONS.indexOf(action) >= ACTIONS.indexOf(floor) ? action : floor;
}

function stageRank(stage: ScamStage): number {
  return SCAM_STAGES.indexOf(stage);
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}
