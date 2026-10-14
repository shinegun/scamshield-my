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
      // Which scripted call is playing, in replay mode. Shown on the dashboard.
      scriptId?: string;
    }
  // Replay mode: text straight into scoring, skipping speech-to-text.
  | { type: 'transcript.inject'; text: string; speaker: 'caller' | 'user' }
  | { type: 'app.state'; bankAppOpen: boolean; transferScreenOpen: boolean }
  // The user submits a transfer in the bank app. Demo money and a demo
  // account label only. The pipeline decides whether it goes through.
  | { type: 'transfer.attempt'; amountRm: number; toAccount: string }
  // "This was really me": releases a held transfer after the app's delay.
  | { type: 'transfer.release'; transferId: string }
  // Demo only: jump the call timer forward to show the long-call floor.
  | { type: 'clock.skip'; seconds: number }
  | { type: 'session.end' };

// A transfer is held while the session's action is `hold_transfers`;
// otherwise it completes. A held transfer completes once released.
export type TransferStatus = 'completed' | 'held' | 'released';

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
  // Answer to `transfer.attempt` and `transfer.release`.
  | {
      type: 'transfer';
      transferId: string;
      status: TransferStatus;
      amountRm: number;
      toAccount: string;
      atSec: number;
    }
  | { type: 'error'; message: string };
