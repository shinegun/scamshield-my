import type { TransferStatus, ScorerName } from './events';
import type { Action } from './risk';
import type { FlagScores, RedFlag, ScamStage, ScamType } from './schema';

// Firestore document shapes. The pipeline writes them with the Admin SDK; the
// dashboard reads them with realtime listeners and the public can read them,
// so they hold demo data only: no transcript text, names or phone numbers.
// Times are epoch milliseconds, so this package needs no Firebase types.
//
//   sessions/{sessionId}                   SessionDoc
//   sessions/{sessionId}/risk/{tickId}     RiskEntryDoc
//   sessions/{sessionId}/holds/{transferId} HoldDoc

export const COLLECTIONS = {
  sessions: 'sessions',
  risk: 'risk',
  holds: 'holds',
} as const;

// One per call. Updated on every tick so the dashboard's call list needs only
// this collection.
export interface SessionDoc {
  sessionId: string;
  status: 'live' | 'ended';
  startedAtMs: number;
  endedAtMs?: number;
  updatedAtMs: number;
  language: string;
  scriptId?: string;
  callerKnown: boolean;
  callerInternational: boolean;
  // Latest tick.
  risk: number;
  action: Action;
  stage: ScamStage;
  scamType: ScamType;
  // Monotonic over the call (ADR 6): the highest action and the flags seen.
  peakAction: Action;
  flagsSeen: RedFlag[];
  // The latest hold's status, if any transfer was held.
  holdStatus?: Extract<TransferStatus, 'held' | 'released'>;
}

// One per scoring tick: the risk-over-time chart.
export interface RiskEntryDoc {
  atSec: number;
  risk: number;
  action: Action;
  stage: ScamStage;
  scamType: ScamType;
  flags: FlagScores;
  scorer: ScorerName;
  latencyMs: number;
}

// One per held transfer. Transfers that complete without a hold are not stored.
export interface HoldDoc {
  transferId: string;
  status: Extract<TransferStatus, 'held' | 'released'>;
  amountRm: number;
  toAccount: string;
  heldAtSec: number;
  heldAtMs: number;
  releasedAtMs?: number;
  // What the session looked like when the transfer was held.
  risk: number;
  stage: ScamStage;
  scamType: ScamType;
  flagsSeen: RedFlag[];
}
