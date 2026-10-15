import type { HoldDoc, RiskEntryDoc, SessionDoc } from '@scamshield/shared';

// Where a call is recorded as it happens (Firestore in production). Every
// method may return a rejected promise; the session catches and logs it, so a
// store failure never reaches the call.
export interface CallStore {
  createSession(sessionId: string, doc: SessionDoc): Promise<void>;
  updateSession(sessionId: string, fields: Partial<SessionDoc>): Promise<void>;
  addRisk(sessionId: string, tickId: string, doc: RiskEntryDoc): Promise<void>;
  setHold(sessionId: string, transferId: string, doc: HoldDoc): Promise<void>;
  updateHold(sessionId: string, transferId: string, fields: Partial<HoldDoc>): Promise<void>;
}
