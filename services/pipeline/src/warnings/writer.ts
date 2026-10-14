import {
  RED_FLAGS,
  SCAM_TYPES,
  SCAM_STAGES,
  type RedFlag,
  type ScamStage,
  type ScamType,
} from '@scamshield/shared';
import { GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from '@google/genai';
import { fallbackWarning, warningLanguage } from './fallbacks';

export type WarningAction = 'soft_warning' | 'strong_warning' | 'hold_transfers';

// Only what was detected; transcript text never goes to the writer.
export interface WarningInput {
  action: WarningAction;
  language: string;
  scamType: ScamType;
  stage: ScamStage;
  flagsSeen: RedFlag[];
}

export interface WarningWriter {
  write(input: WarningInput, signal?: AbortSignal): Promise<string>;
}

export const WARNING_TIMEOUT_MS = 2500;

// Just the part of the SDK client the writer uses, so tests can pass a mock.
export interface GeminiWarningClient {
  models: {
    generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>;
  };
}

export interface GeminiWarningWriterOptions {
  client?: GeminiWarningClient;
  project?: string;
  location?: string;
  model?: string;
  timeoutMs?: number;
}

const WHAT_TO_DO: Record<WarningAction, string> = {
  soft_warning: 'Tell them to be careful and not to share personal details.',
  strong_warning:
    'Tell them this looks like a scam and to hang up and call their bank or the police on the official number, for example the National Scam Response Centre (NSRC) on 997.',
  hold_transfers:
    "Tell them transfers from this account are paused for the user's protection and they should hang up.",
};

const SYSTEM_PROMPT = [
  'You write a warning that is shown on a phone during a call to a Malaysian bank customer.',
  'Write at most 2 short sentences, about 30 words in total.',
  'Say what the caller has done that matches a scam, using the detected signs given, then what the customer should do.',
  'Never claim certainty: say the call "looks like" or "shows signs of" a scam.',
  'Never include a phone number other than 997. Never name the caller or any organisation they claimed to be from.',
  'Plain text only: no quotes, no markdown, no emoji, no preamble.',
].join('\n');

// The red-flag questions were written for the scorer and point at its
// `recent_transcript` field; drop that framing so they read as plain facts.
function describeFlag(flag: RedFlag): string {
  return `- ${flag}: ${RED_FLAGS[flag].question.replace(/^In `recent_transcript`, /, '')}`;
}

export function buildWarningPrompt(input: WarningInput): string {
  const language =
    warningLanguage(input.language) === 'ms'
      ? 'standard Malay (Bahasa Malaysia)'
      : 'plain Malaysian English (no slang)';
  const signs = input.flagsSeen.length
    ? input.flagsSeen.map(describeFlag).join('\n')
    : '- none in particular; the call has been unusually long with an unknown caller';
  return [
    `Warning level: ${input.action}`,
    `Language to write in: ${language} (call language tag: ${input.language})`,
    `Scam type: ${input.scamType} (${SCAM_TYPES[input.scamType]})`,
    `How far the call has gone: ${input.stage} (${SCAM_STAGES[input.stage]})`,
    `Signs detected so far, each a question that was answered yes:\n${signs}`,
    `What to do: ${WHAT_TO_DO[input.action]}`,
    // Malay wording a native reader preferred for the hold; only for Malay.
    ...(input.action === 'hold_transfers' && warningLanguage(input.language) === 'ms'
      ? ['Say the transfers are "ditahan sementara".']
      : []),
    'Write the warning now.',
  ].join('\n');
}

function clean(text: string | undefined): string {
  return (text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'“”*]+|["'“”*]+$/g, '')
    .trim();
}

export class GeminiWarningWriter implements WarningWriter {
  private readonly client: GeminiWarningClient;
  private readonly model: string;
  private readonly timeoutMs: number;

  // Uses Vertex AI with application default credentials; never an API key (ADR 8).
  constructor(opts: GeminiWarningWriterOptions = {}) {
    this.model = opts.model ?? process.env.GEMINI_WARNING_MODEL ?? 'gemini-2.5-flash';
    this.timeoutMs = opts.timeoutMs ?? WARNING_TIMEOUT_MS;
    this.client =
      opts.client ??
      new GoogleGenAI({
        vertexai: true,
        project: opts.project ?? process.env.GOOGLE_CLOUD_PROJECT ?? 'scamshield-my-511604',
        location: opts.location ?? process.env.GEMINI_LOCATION ?? 'asia-southeast1',
      });
  }

  // Never rejects: on timeout, error or empty text it returns the fixed string.
  write(input: WarningInput, signal?: AbortSignal): Promise<string> {
    return withFallback(
      (s) => this.generate(input, s),
      input,
      this.timeoutMs,
      signal,
    );
  }

  private async generate(input: WarningInput, signal: AbortSignal): Promise<string> {
    const res = await this.client.models.generateContent({
      model: this.model,
      contents: [{ role: 'user', parts: [{ text: buildWarningPrompt(input) }] }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.3,
        maxOutputTokens: 200,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'text/plain',
        abortSignal: signal,
      },
    });
    return clean(res.text);
  }
}

// Runs `produce` with an abort signal and a time limit; any failure, timeout or
// empty result gives the fixed string for that level and language.
async function withFallback(
  produce: (signal: AbortSignal) => Promise<string>,
  input: WarningInput,
  timeoutMs: number,
  outer?: AbortSignal,
): Promise<string> {
  const ctl = new AbortController();
  const abort = () => ctl.abort();
  if (outer?.aborted) ctl.abort();
  else outer?.addEventListener('abort', abort, { once: true });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ctl.abort();
      reject(new Error(`warning writer timed out after ${timeoutMs} ms`));
    }, timeoutMs);
  });
  const run = produce(ctl.signal);
  run.catch(() => {});
  try {
    const text = clean(await Promise.race([run, timedOut]));
    return text || fallbackWarning(input.action, input.language);
  } catch {
    return fallbackWarning(input.action, input.language);
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', abort);
  }
}

// What the session calls: works with any WarningWriter (a writer of our own
// that never rejects, or a test double that might), and with none at all.
export function writeWarning(
  writer: WarningWriter | undefined,
  input: WarningInput,
  timeoutMs = WARNING_TIMEOUT_MS,
): Promise<string> {
  if (!writer) return Promise.resolve(fallbackWarning(input.action, input.language));
  return withFallback((signal) => writer.write(input, signal), input, timeoutMs);
}
