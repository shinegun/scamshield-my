import { RED_FLAG_KEYS, SCAM_STAGE_KEYS, type Action, type RedFlag, type ScamStage, type ScamType } from '@scamshield/shared';
import type { RiskPoint } from '../dashboard/view';
import { flagLabel } from './flagLabels';
import { formatLatency, latestScored, scamTypeLabel, type Lang } from './labels';
import { FLAG_SEEN_AT } from './signals';
import type { RiskMessage } from './state';

// Short names for the stage track on the desktop panel, in SCAM_STAGES order.
const STAGE_SHORT: Record<Exclude<ScamStage, 'none'>, string> = {
  authority_setup: 'Authority',
  victim_framing: 'Victim framing',
  family_pressure: 'Family',
  isolation: 'Isolation',
  identity_request: 'IC request',
  financial_request: 'Money',
};

export interface StageStep {
  key: ScamStage;
  label: string;
  reached: boolean;
  current: boolean;
}

export interface HeardSignal {
  flag: RedFlag;
  label: string;
  atSec: number;
  // The action at the tick that first heard it; colours the dot (ADR 6).
  action: Action;
}

export interface Inspector {
  // Undefined until the first risk message.
  percent?: number;
  action: Action;
  // "Scored by Jev in 213 ms"
  scoredBy?: string;
  // Only once the engine acts, so an innocent call shows no scam type.
  scamType?: string;
  stages: StageStep[];
  points: RiskPoint[];
  // Ticks where the action differs from the tick before (the first tick
  // counts when it isn't 'none').
  actionChanges: Array<{ atSec: number; action: Action }>;
  // In the order they were first heard.
  heard: HeardSignal[];
  // The rest, in RED_FLAGS order.
  notYet: Array<{ flag: RedFlag; label: string }>;
}

const SCORER_NAMES = { jev: 'Jev', gemini: 'Gemini' } as const;

// Everything the "What ScamShield hears" panel shows, from the call's risk
// messages. Every colour comes from an Action that risk.ts chose.
export function inspect(
  risk: RiskMessage | undefined,
  riskHistory: readonly RiskMessage[],
  lang: Lang = 'en',
): Inspector {
  const action = risk?.action ?? 'none';
  const stageIndex = SCAM_STAGE_KEYS.indexOf(risk?.stage ?? 'none');
  const scored = latestScored(riskHistory);

  const stages = SCAM_STAGE_KEYS.slice(1).map((key, i) => ({
    key,
    label: STAGE_SHORT[key as Exclude<ScamStage, 'none'>],
    reached: i + 1 <= stageIndex,
    current: i + 1 === stageIndex,
  }));

  const heard: HeardSignal[] = [];
  const seen = new Set<RedFlag>();
  const actionChanges: Inspector['actionChanges'] = [];
  let prev: Action = 'none';
  for (const tick of riskHistory) {
    for (const flag of RED_FLAG_KEYS) {
      if (!seen.has(flag) && tick.flags[flag] >= FLAG_SEEN_AT) {
        seen.add(flag);
        heard.push({ flag, label: flagLabel(flag, lang), atSec: tick.atSec, action: tick.action });
      }
    }
    if (tick.action !== prev) actionChanges.push({ atSec: tick.atSec, action: tick.action });
    prev = tick.action;
  }

  return {
    percent: risk ? Math.round(risk.risk * 100) : undefined,
    action,
    scoredBy: scored
      ? `Scored by ${SCORER_NAMES[scored.scorer]} in ${formatLatency(scored.latencyMs)}`
      : undefined,
    scamType: showScamType(risk) ? scamTypeLabel(risk.scamType, lang) : undefined,
    stages,
    points: riskHistory.map((t) => ({ atSec: t.atSec, risk: t.risk, action: t.action })),
    actionChanges,
    heard,
    notYet: RED_FLAG_KEYS.filter((f) => !seen.has(f)).map((flag) => ({ flag, label: flagLabel(flag, lang) })),
  };
}

function showScamType(risk: RiskMessage | undefined): risk is RiskMessage & { scamType: Exclude<ScamType, 'none'> } {
  return !!risk && risk.action !== 'none' && risk.scamType !== 'none';
}
