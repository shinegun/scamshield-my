import type { Action } from './risk';
import type { FlagScores, ScamStage, ScamType } from './schema';

// Messages over the call WebSocket between the bank app and the pipeline.
// Audio travels as binary frames on the same socket; everything else is JSON.

export type ScorerName = 'jev' | 'gemini';

export type ClientMessage =
  | {
      type: 'session.start';
      callerKnown: boolean;
      callerInternational: boolean;
      // BCP-47 hint for speech-to-text and for the warning language.
      language: string;
    }
  // Replay mode: text straight into scoring, skipping speech-to-text.
  | { type: 'transcript.inject'; text: string; speaker: 'caller' | 'user' }
  | { type: 'app.state'; bankAppOpen: boolean; transferScreenOpen: boolean }
  // Demo only: jump the call timer forward to show the long-call floor.
  | { type: 'clock.skip'; seconds: number }
  | { type: 'session.end' };

export type ServerMessage =
  | { type: 'session.started'; sessionId: string }
  | { type: 'transcript'; text: string; language: string; atSec: number }
  | {
      type: 'risk';
      risk: number;
      action: Action;
      stage: ScamStage;
      scamType: ScamType;
      flags: FlagScores;
      scorer: ScorerName;
      latencyMs: number;
      atSec: number;
    }
  | {
      type: 'warning';
      action: Exclude<Action, 'none'>;
      text: string;
      language: string;
      // Spoken version of the warning, when text-to-speech is available.
      audioUrl?: string;
    }
  | { type: 'error'; message: string };
