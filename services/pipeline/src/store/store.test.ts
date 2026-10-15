import { describe, expect, it, vi } from 'vitest';
import {
  emptySession,
  type ClientMessage,
  type Decision,
  type FlagScores,
  type HoldDoc,
  type RiskEntryDoc,
  type ScamStage,
  type ScamType,
  type ServerMessage,
  type SessionDoc,
} from '@scamshield/shared';
import { CallSession } from '../session';
import type { Scorer } from '../scorers/types';
import type { CallStore } from './types';

function decision(
  scamStage: ScamStage,
  flags: Partial<FlagScores> = {},
  scamType: ScamType = 'fake_police',
): Decision {
  return { scamStage, scamType, flags: { ...emptySession().peakFlags, ...flags } };
}

function fakeScorer(decisions: Decision[]): Scorer {
  let i = 0;
  return {
    name: 'jev',
    async score() {
      const d = decisions[Math.min(i++, decisions.length - 1)]!;
      return { decision: d, scorer: 'jev', model: 'fake', latencyMs: 12 };
    },
  };
}

// Applies the same merges Firestore would, so tests read the final documents.
class FakeStore implements CallStore {
  sessions = new Map<string, SessionDoc>();
  risk = new Map<string, Map<string, RiskEntryDoc>>();
  holds = new Map<string, Map<string, HoldDoc>>();
  async createSession(id: string, doc: SessionDoc) {
    this.sessions.set(id, { ...doc });
  }
  async updateSession(id: string, fields: Partial<SessionDoc>) {
    this.sessions.set(id, { ...this.sessions.get(id)!, ...fields });
  }
  async addRisk(id: string, tickId: string, doc: RiskEntryDoc) {
    if (!this.risk.has(id)) this.risk.set(id, new Map());
    this.risk.get(id)!.set(tickId, doc);
  }
  async setHold(id: string, transferId: string, doc: HoldDoc) {
    if (!this.holds.has(id)) this.holds.set(id, new Map());
    this.holds.get(id)!.set(transferId, doc);
  }
  async updateHold(id: string, transferId: string, fields: Partial<HoldDoc>) {
    const holds = this.holds.get(id)!;
    holds.set(transferId, { ...holds.get(transferId)!, ...fields });
  }
}

const START: ClientMessage = {
  type: 'session.start',
  callerKnown: false,
  callerInternational: true,
  language: 'ms-MY',
  scriptId: 'test',
};
const say = (text: string): string =>
  JSON.stringify({ type: 'transcript.inject', text, speaker: 'caller' } satisfies ClientMessage);

function setup(decisions: Decision[], store: CallStore = new FakeStore()) {
  const sent: ServerMessage[] = [];
  let clock = 1_000_000;
  const session = new CallSession({
    scorer: fakeScorer(decisions),
    store,
    now: () => clock,
    send: (m) => sent.push(m),
  });
  const send = (m: ClientMessage | string) =>
    session.receive(typeof m === 'string' ? m : JSON.stringify(m));
  const sessionId = async () => {
    await send(START);
    return (sent.find((m) => m.type === 'session.started') as { sessionId: string }).sessionId;
  };
  return { session, sent, send, sessionId, advance: (ms: number) => (clock += ms), store: store as FakeStore };
}

const ESCALATING = [
  decision('authority_setup', { claims_authority: 0.8, call_transferred_between_agencies: 0.8 }),
  decision('victim_framing', { victim_framing: 0.8 }),
  decision('family_pressure', { mentions_family_involvement: 0.8, demands_secrecy: 0.8 }),
  decision('isolation', { keep_on_line_instruction: 0.8 }),
  decision('identity_request', { asks_for_ic_or_selfie: 0.8 }),
  decision('financial_request', { asks_for_transfer: 0.8 }),
];

describe('call store', () => {
  it('creates the session document on session.start', async () => {
    const t = setup(ESCALATING);
    const id = await t.sessionId();
    expect(t.store.sessions.get(id)).toMatchObject({
      sessionId: id,
      status: 'live',
      startedAtMs: 1_000_000,
      language: 'ms-MY',
      scriptId: 'test',
      callerKnown: false,
      callerInternational: true,
      action: 'none',
      peakAction: 'none',
      flagsSeen: [],
    });
  });

  it('updates the session each tick with a monotonic peakAction, and writes sorted risk entries', async () => {
    const t = setup(ESCALATING);
    const id = await t.sessionId();
    const peaks: string[] = [];
    for (let i = 0; i < ESCALATING.length; i++) {
      await t.send(say(`line ${i}`));
      peaks.push(t.store.sessions.get(id)!.peakAction);
    }
    expect(peaks).toEqual([
      'none',
      'none',
      'soft_warning',
      'strong_warning',
      'strong_warning',
      'hold_transfers',
    ]);
    const doc = t.store.sessions.get(id)!;
    expect(doc).toMatchObject({ action: 'hold_transfers', stage: 'financial_request', scamType: 'fake_police' });
    expect(doc.flagsSeen).toContain('asks_for_transfer');

    const ids = [...t.store.risk.get(id)!.keys()];
    expect(ids).toEqual(['0001', '0002', '0003', '0004', '0005', '0006']);
    expect([...ids].sort()).toEqual(ids);
    expect(t.store.risk.get(id)!.get('0006')).toMatchObject({
      action: 'hold_transfers',
      scorer: 'jev',
      latencyMs: 12,
    });
  });

  it('keeps peakAction after the latest action falls back, and records clock.skip ticks', async () => {
    const t = setup(ESCALATING);
    const id = await t.sessionId();
    for (let i = 0; i < ESCALATING.length; i++) await t.send(say(`line ${i}`));
    await t.send({ type: 'clock.skip', seconds: 60 });
    expect(t.store.risk.get(id)!.size).toBe(7);
    expect(t.store.sessions.get(id)!.peakAction).toBe('hold_transfers');
  });

  it('stores a hold for a held transfer, then marks it released', async () => {
    const t = setup(ESCALATING);
    const id = await t.sessionId();
    for (let i = 0; i < ESCALATING.length; i++) await t.send(say(`line ${i}`));
    t.advance(5000);
    await t.send({ type: 'transfer.attempt', amountRm: 4500, toAccount: 'Acc 1234' });
    const transfer = t.sent.find((m) => m.type === 'transfer') as Extract<ServerMessage, { type: 'transfer' }>;
    expect(transfer.status).toBe('held');
    expect(t.store.holds.get(id)!.get(transfer.transferId)).toMatchObject({
      status: 'held',
      amountRm: 4500,
      toAccount: 'Acc 1234',
      heldAtMs: 1_005_000,
      stage: 'financial_request',
      scamType: 'fake_police',
    });
    expect(t.store.sessions.get(id)!.holdStatus).toBe('held');

    t.advance(1000);
    await t.send({ type: 'transfer.release', transferId: transfer.transferId });
    expect(t.store.holds.get(id)!.get(transfer.transferId)).toMatchObject({
      status: 'released',
      releasedAtMs: 1_006_000,
    });
    expect(t.store.sessions.get(id)!.holdStatus).toBe('released');
  });

  it('does not store completed transfers', async () => {
    const t = setup([decision('none')]);
    const id = await t.sessionId();
    await t.send({ type: 'transfer.attempt', amountRm: 10, toAccount: 'Acc 1' });
    expect((t.sent.find((m) => m.type === 'transfer') as { status: string }).status).toBe('completed');
    expect(t.store.holds.get(id)).toBeUndefined();
  });

  it('marks the session ended on session.end and on dispose, once', async () => {
    const a = setup([decision('none')]);
    const idA = await a.sessionId();
    await a.send({ type: 'session.end' });
    expect(a.store.sessions.get(idA)).toMatchObject({ status: 'ended', endedAtMs: 1_000_000 });

    const b = setup([decision('none')]);
    const idB = await b.sessionId();
    b.advance(3000);
    b.session.dispose();
    expect(b.store.sessions.get(idB)).toMatchObject({ status: 'ended', endedAtMs: 1_003_000 });
    const spy = vi.spyOn(b.store, 'updateSession');
    b.session.dispose();
    expect(spy).not.toHaveBeenCalled();
  });

  it('keeps the call working when the store throws or rejects', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken: CallStore = {
      createSession: () => Promise.reject(new Error('down')),
      updateSession: () => {
        throw new Error('sync throw');
      },
      addRisk: () => Promise.reject(new Error('down')),
      setHold: () => Promise.reject(new Error('down')),
      updateHold: () => Promise.reject(new Error('down')),
    };
    const t = setup(ESCALATING, broken);
    await t.sessionId();
    for (let i = 0; i < ESCALATING.length; i++) await t.send(say(`line ${i}`));
    await t.send({ type: 'transfer.attempt', amountRm: 1, toAccount: 'x' });
    await t.send({ type: 'session.end' });
    await new Promise((r) => setTimeout(r, 0));

    expect(t.sent.filter((m) => m.type === 'risk')).toHaveLength(6);
    expect(t.sent.some((m) => m.type === 'error')).toBe(false);
    expect((t.sent.find((m) => m.type === 'transfer') as { status: string }).status).toBe('held');
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('dominant scam type', () => {
  const run = async (types: ScamType[]) => {
    const t = setup(types.map((type) => decision('authority_setup', {}, type)));
    await t.sessionId();
    for (let i = 0; i < types.length; i++) await t.send(say(`line ${i}`));
    return t.sent.filter((m) => m.type === 'risk').map((m) => (m as { scamType: ScamType }).scamType);
  };

  it('reports the most frequent type, not the last', async () => {
    const reported = await run(['fake_police', 'fake_police', 'fake_bank_or_bnm']);
    expect(reported).toEqual(['fake_police', 'fake_police', 'fake_police']);
  });

  it('breaks ties toward the most recent type and ignores none', async () => {
    const reported = await run(['fake_police', 'fake_bank_or_bnm', 'none', 'fake_police']);
    expect(reported).toEqual(['fake_police', 'fake_bank_or_bnm', 'fake_bank_or_bnm', 'fake_police']);
  });

  it('stores the dominant type on the session', async () => {
    const t = setup([
      decision('authority_setup', {}, 'fake_police'),
      decision('authority_setup', {}, 'fake_police'),
      decision('authority_setup', {}, 'fake_bank_or_bnm'),
    ]);
    const id = await t.sessionId();
    for (let i = 0; i < 3; i++) await t.send(say(`line ${i}`));
    expect(t.store.sessions.get(id)!.scamType).toBe('fake_police');
  });
});
