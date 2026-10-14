import {
  RED_FLAGS,
  RED_FLAG_KEYS,
  SCAM_STAGES,
  SCAM_STAGE_KEYS,
  SCAM_TYPES,
  type CallState,
  type Decision,
  type FlagScores,
  type ScamStage,
  type ScamType,
} from '@scamshield/shared';
import { GoogleGenAI, Type, type GenerateContentParameters, type GenerateContentResponse } from '@google/genai';
import { STAGE_QUESTION, TYPE_QUESTION, toScorerState, type ScoreResult, type Scorer } from './types';

// Just the part of the SDK client the scorer uses, so tests can pass a mock.
export interface GeminiClient {
  models: {
    generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>;
  };
}

export interface GeminiScorerOptions {
  client?: GeminiClient;
  project?: string;
  location?: string;
  model?: string;
}

const SCAM_TYPE_KEYS = Object.keys(SCAM_TYPES) as ScamType[];

const describeOptions = (options: Record<string, string>) =>
  Object.entries(options)
    .map(([key, description]) => `- ${key}: ${description}`)
    .join('\n');

// The questions are sent verbatim (they are written for a model that reads
// them literally); only the framing around them is ours.
const QUESTIONS_PROMPT = [
  'Answer every question below about the call state above, using the exact answer keys.',
  `scam_stage: ${STAGE_QUESTION}\n${describeOptions(SCAM_STAGES)}`,
  `scam_type: ${TYPE_QUESTION}\n${describeOptions(SCAM_TYPES)}`,
  ...RED_FLAG_KEYS.map(
    (k) =>
      `${k}: ${RED_FLAGS[k].question}\nWhat counts as yes: ${RED_FLAGS[k].yes}\n` +
      `Answer with the probability from 0 to 1 that the answer is yes.`,
  ),
].join('\n\n');

export const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    scam_stage: { type: Type.STRING, enum: [...SCAM_STAGE_KEYS] },
    scam_type: { type: Type.STRING, enum: [...SCAM_TYPE_KEYS] },
    ...Object.fromEntries(
      RED_FLAG_KEYS.map((k) => [
        k,
        { type: Type.NUMBER, description: `Probability from 0 to 1 that the answer to ${k} is yes.` },
      ]),
    ),
  },
  required: ['scam_stage', 'scam_type', ...RED_FLAG_KEYS],
};

const clamp01 = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export class GeminiScorer implements Scorer {
  readonly name = 'gemini';
  private readonly client: GeminiClient;
  private readonly model: string;

  // Uses Vertex AI with application default credentials; never an API key (ADR 8).
  constructor(opts: GeminiScorerOptions = {}) {
    this.model = opts.model ?? process.env.GEMINI_SCORER_MODEL ?? 'gemini-2.5-flash';
    this.client =
      opts.client ??
      new GoogleGenAI({
        vertexai: true,
        project: opts.project ?? process.env.GOOGLE_CLOUD_PROJECT ?? 'scamshield-my-511604',
        location: opts.location ?? process.env.GEMINI_LOCATION ?? 'asia-southeast1',
      });
  }

  async score(state: CallState, signal?: AbortSignal): Promise<ScoreResult> {
    const started = performance.now();
    const res = await this.client.models.generateContent({
      model: this.model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: `Call state:\n${JSON.stringify(toScorerState(state), null, 2)}` },
            { text: QUESTIONS_PROMPT },
          ],
        },
      ],
      config: {
        temperature: 0,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        abortSignal: signal,
      },
    });
    const latencyMs = Math.round(performance.now() - started);

    return {
      decision: parseDecision(res.text),
      scorer: this.name,
      model: res.modelVersion ?? this.model,
      latencyMs,
    };
  }
}

function parseDecision(text: string | undefined): Decision {
  let raw: unknown;
  try {
    raw = JSON.parse(text ?? '');
  } catch {
    throw new Error(`Gemini returned unparseable JSON: ${(text ?? '').slice(0, 200)}`);
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`Gemini returned JSON that is not an object: ${(text ?? '').slice(0, 200)}`);
  }
  const obj = raw as Record<string, unknown>;
  const flags = Object.fromEntries(RED_FLAG_KEYS.map((k) => [k, clamp01(obj[k])])) as FlagScores;
  return {
    scamStage: pick<ScamStage>(obj.scam_stage, SCAM_STAGE_KEYS, 'none'),
    scamType: pick<ScamType>(obj.scam_type, SCAM_TYPE_KEYS, 'none'),
    flags,
  };
}
