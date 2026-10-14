import type { CallState, Decision, ScorerName } from '@scamshield/shared';

export interface ScoreResult {
  decision: Decision;
  scorer: ScorerName;
  // The versioned model that answered, for logging next to tuned thresholds.
  model: string;
  latencyMs: number;
}

export interface Scorer {
  readonly name: ScorerName;
  score(state: CallState, signal?: AbortSignal): Promise<ScoreResult>;
}

export const STAGE_QUESTION =
  'Which option best describes what the caller is doing in `recent_transcript`?';
export const TYPE_QUESTION =
  'Which kind of scam, if any, is this call? Use `recent_transcript` and `earlier_in_call`.';

// The state every scorer sees. Only what the questions need: Jev loses
// accuracy on unrelated detail and can't compare numbers, so call length and
// bank-app state stay in code (see decideAction).
export function toScorerState(state: CallState) {
  return {
    recent_transcript: state.recentTranscript,
    earlier_in_call: {
      red_flags_seen: state.flagsSeenSoFar,
      furthest_stage: state.stageReached,
    },
    caller: [
      state.callerKnown ? 'saved contact' : 'unknown number',
      state.callerInternational ? 'international' : 'local',
    ].join(', '),
  };
}
