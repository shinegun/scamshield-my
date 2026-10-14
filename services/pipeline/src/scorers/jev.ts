import {
  RED_FLAGS,
  RED_FLAG_KEYS,
  SCAM_STAGES,
  SCAM_TYPES,
  type CallState,
  type FlagScores,
  type RedFlag,
} from '@scamshield/shared';
import {
  choice,
  noul,
  TypeSafeClient,
  type NoulQuestion,
  type TypeSafeClientConfig,
} from '@typesafe-ai/sdk';
import { STAGE_QUESTION, TYPE_QUESTION, toScorerState, type ScoreResult, type Scorer } from './types';

const flagQuestions = Object.fromEntries(
  RED_FLAG_KEYS.map((k) => [k, noul(RED_FLAGS[k].question, { true: RED_FLAGS[k].yes })]),
) as Record<RedFlag, NoulQuestion>;

// One request: Jev reads the state once and answers every question in parallel.
const QUESTIONS = {
  scam_stage: choice(STAGE_QUESTION, SCAM_STAGES),
  scam_type: choice(TYPE_QUESTION, SCAM_TYPES),
  ...flagQuestions,
};

export class JevScorer implements Scorer {
  readonly name = 'jev';
  private readonly client: TypeSafeClient;

  // Reads TYPESAFE_API_KEY from the environment unless config.apiKey is given.
  constructor(config: TypeSafeClientConfig = {}) {
    // A tick is stale after a few seconds, so fail fast and let the caller
    // fall back to Gemini rather than retry (ADR 2).
    this.client = new TypeSafeClient({ timeout: 800, retry: { maxRetries: 0 }, ...config });
  }

  async score(state: CallState, signal?: AbortSignal): Promise<ScoreResult> {
    const started = performance.now();
    const res = await this.client.systemOne(
      { state: toScorerState(state), questions: QUESTIONS },
      { signal },
    );
    const latencyMs = Math.round(performance.now() - started);

    const flags = Object.fromEntries(
      RED_FLAG_KEYS.map((k) => [k, res.answers[k].noul]),
    ) as FlagScores;
    return {
      decision: {
        scamStage: res.answers.scam_stage.choice,
        scamType: res.answers.scam_type.choice,
        flags,
      },
      scorer: this.name,
      model: res.model,
      latencyMs,
    };
  }
}
