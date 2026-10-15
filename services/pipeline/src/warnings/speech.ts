import { applicationDefault } from 'firebase-admin/app';
import { FALLBACK_WARNINGS, warningLanguage, type WarningLanguage } from './fallbacks';
import type { WarningAction } from './writer';

// The spoken warning (#23). Gemini's warning text is too slow to speak live
// (several seconds of synthesis), so the pipeline records the fixed lines from
// FALLBACK_WARNINGS once at startup and attaches the clip to the matching
// `warning` message. Soft warnings stay silent.

export type SpokenAction = Extract<WarningAction, 'strong_warning' | 'hold_transfers'>;

export interface WarningSpeech {
  // A `data:audio/mpeg;base64,...` URL, or undefined when the clip is not
  // ready, failed, or the action is not spoken.
  audioFor(action: WarningAction, language: string): string | undefined;
}

export const NO_SPEECH: WarningSpeech = { audioFor: () => undefined };

const ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const PROMPT = "Say urgently but calmly, like a bank's fraud alert";
const LANGUAGE_CODE: Record<WarningLanguage, string> = { ms: 'ms-MY', en: 'en-US' };
const SPOKEN: SpokenAction[] = ['strong_warning', 'hold_transfers'];
const TIMEOUT_MS = 20_000;

export interface TtsSpeechOptions {
  fetch?: typeof fetch;
  getToken?: () => Promise<string>;
  project?: string;
  timeoutMs?: number;
  log?: (line: string) => void;
}

async function adcToken(): Promise<string> {
  const token = await applicationDefault().getAccessToken();
  return token.access_token;
}

export class TtsWarningSpeech implements WarningSpeech {
  private readonly clips = new Map<string, string>();
  // Resolves when all four requests have finished, successfully or not. Never rejects.
  readonly ready: Promise<void>;
  private readonly fetchFn: typeof fetch;
  private readonly getToken: () => Promise<string>;
  private readonly project?: string;
  private readonly timeoutMs: number;
  private readonly log: (line: string) => void;

  constructor(opts: TtsSpeechOptions = {}) {
    this.fetchFn = opts.fetch ?? fetch;
    this.getToken = opts.getToken ?? adcToken;
    this.project = opts.project ?? process.env.GOOGLE_CLOUD_PROJECT;
    this.timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
    this.log = opts.log ?? ((line) => console.log(line));
    const jobs: Promise<void>[] = [];
    for (const language of ['ms', 'en'] as const) {
      for (const action of SPOKEN) jobs.push(this.record(language, action));
    }
    this.ready = Promise.all(jobs).then(() => undefined);
  }

  audioFor(action: WarningAction, language: string): string | undefined {
    return this.clips.get(`${warningLanguage(language)}:${action}`);
  }

  private async record(language: WarningLanguage, action: SpokenAction): Promise<void> {
    const name = `${language}:${action}`;
    try {
      const audio = await this.synthesize(language, FALLBACK_WARNINGS[language][action]);
      this.clips.set(name, `data:audio/mpeg;base64,${audio}`);
      this.log(`spoken warning ${name}: ok (${Math.round((audio.length * 3) / 4)} bytes)`);
    } catch (err) {
      this.log(`spoken warning ${name}: failed (${err instanceof Error ? err.message : String(err)})`);
    }
  }

  private async synthesize(language: WarningLanguage, text: string): Promise<string> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    };
    if (this.project) headers['x-goog-user-project'] = this.project;
    const res = await this.fetchFn(ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        input: { prompt: PROMPT, text },
        voice: { languageCode: LANGUAGE_CODE[language], name: 'Kore', modelName: 'gemini-2.5-flash-tts' },
        audioConfig: { audioEncoding: 'MP3' },
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { audioContent?: unknown };
    if (typeof body.audioContent !== 'string' || body.audioContent === '') throw new Error('no audioContent');
    return body.audioContent;
  }
}

// On Cloud Run (K_SERVICE) or with SPEECH=on; otherwise off, so tests and
// local runs never call the API.
export function createWarningSpeech(env: NodeJS.ProcessEnv = process.env): WarningSpeech {
  const on = Boolean(env.K_SERVICE) || env.SPEECH === 'on';
  return on ? new TtsWarningSpeech() : NO_SPEECH;
}
