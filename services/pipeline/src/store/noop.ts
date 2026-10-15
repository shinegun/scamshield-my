import type { CallStore } from './types';

// Used locally and in tests when nothing should be written.
export class NoopCallStore implements CallStore {
  async createSession(): Promise<void> {}
  async updateSession(): Promise<void> {}
  async addRisk(): Promise<void> {}
  async setHold(): Promise<void> {}
  async updateHold(): Promise<void> {}
}
