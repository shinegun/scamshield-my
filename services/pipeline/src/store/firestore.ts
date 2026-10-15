import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  COLLECTIONS,
  type HoldDoc,
  type RiskEntryDoc,
  type SessionDoc,
} from '@scamshield/shared';
import type { CallStore } from './types';

// Application default credentials; the project comes from GOOGLE_CLOUD_PROJECT
// (set on Cloud Run, or in the environment locally).
export class FirestoreCallStore implements CallStore {
  private readonly db: Firestore;

  constructor() {
    const app = getApps()[0] ?? initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
    this.db = getFirestore(app);
    try {
      this.db.settings({ ignoreUndefinedProperties: true });
    } catch {
      // Settings can only be applied once, before first use.
    }
  }

  private session(sessionId: string) {
    return this.db.collection(COLLECTIONS.sessions).doc(sessionId);
  }

  async createSession(sessionId: string, doc: SessionDoc): Promise<void> {
    await this.session(sessionId).set(doc);
  }

  async updateSession(sessionId: string, fields: Partial<SessionDoc>): Promise<void> {
    await this.session(sessionId).set(fields, { merge: true });
  }

  async addRisk(sessionId: string, tickId: string, doc: RiskEntryDoc): Promise<void> {
    await this.session(sessionId).collection(COLLECTIONS.risk).doc(tickId).set(doc);
  }

  async setHold(sessionId: string, transferId: string, doc: HoldDoc): Promise<void> {
    await this.session(sessionId).collection(COLLECTIONS.holds).doc(transferId).set(doc);
  }

  async updateHold(sessionId: string, transferId: string, fields: Partial<HoldDoc>): Promise<void> {
    await this.session(sessionId)
      .collection(COLLECTIONS.holds)
      .doc(transferId)
      .set(fields, { merge: true });
  }
}
