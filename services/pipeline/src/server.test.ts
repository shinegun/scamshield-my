import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import {
  ACTIONS,
  emptySession,
  type ClientMessage,
  type Decision,
  type FlagScores,
  type ScamStage,
  type ServerMessage,
} from '@scamshield/shared';
import { createServer } from './server';
import type { Scorer } from './scorers/types';
import { FALLBACK_WARNINGS } from './warnings/fallbacks';
import type { WarningInput, WarningWriter } from './warnings/writer';
import type { WarningSpeech } from './warnings/speech';

function decision(scamStage: ScamStage, flags: Partial<FlagScores> = {}): Decision {
  return { scamStage, scamType: 'fake_police', flags: { ...emptySession().peakFlags, ...flags } };
}

// The ticks from the "MCMC-to-police call" test in packages/shared, with the
// action that test expects after each.
const MCMC_CALL: [Decision, string][] = [
  [decision('authority_setup', { claims_authority: 0.8, call_transferred_between_agencies: 0.8 }), 'none'],
  [decision('victim_framing', { victim_framing: 0.8 }), 'none'],
  [decision('family_pressure', { mentions_family_involvement: 0.8, demands_secrecy: 0.8 }), 'soft_warning'],
  [decision('isolation', { keep_on_line_instruction: 0.8 }), 'strong_warning'],
  [decision('identity_request', { asks_for_ic_or_selfie: 0.8 }), 'strong_warning'],
  [decision('financial_request', { asks_for_transfer: 0.8 }), 'hold_transfers'],
];

// Answers each call to score() with the next decision, then repeats the last.
function fakeScorer(decisions: (Decision | Error)[]): Scorer & { calls: number } {
  const scorer = {
    name: 'jev' as const,
    calls: 0,
    async score() {
      const next = decisions[Math.min(scorer.calls++, decisions.length - 1)]!;
      if (next instanceof Error) throw next;
      return { decision: next, scorer: 'jev' as const, model: 'fake', latencyMs: 12 };
    },
  };
  return scorer;
}

class Client {
  private queue: ServerMessage[] = [];
  private waiters: (() => void)[] = [];
  private constructor(private ws: WebSocket) {
    ws.on('message', (data) => {
      this.queue.push(JSON.parse(data.toString()));
      this.waiters.splice(0).forEach((w) => w());
    });
  }

  static async connect(port: number, path = '/call'): Promise<Client> {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    // Listen before the socket opens: the server may send (and close) at once.
    const client = new Client(ws);
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });
    return client;
  }

  send(message: ClientMessage | string): void {
    this.ws.send(typeof message === 'string' ? message : JSON.stringify(message));
  }

  // The next message of this type; others before it are discarded.
  async next<T extends ServerMessage['type']>(type: T): Promise<Extract<ServerMessage, { type: T }>> {
    for (;;) {
      while (this.queue.length > 0) {
        const message = this.queue.shift()!;
        if (message.type === type) return message as Extract<ServerMessage, { type: T }>;
      }
      await Promise.race([
        new Promise<void>((resolve) => this.waiters.push(resolve)),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error(`timed out waiting for ${type}`)), 2000),
        ),
      ]);
    }
  }

  close(): void {
    this.ws.close();
  }

  // Resolves with the close code once the server closes the socket.
  closed(): Promise<number> {
    if (this.ws.readyState === WebSocket.CLOSED) return Promise.resolve(-1);
    return new Promise((resolve) => this.ws.once('close', (code) => resolve(code)));
  }

  get isOpen(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }
}

let closers: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function setup(scorer: Scorer, now: () => number = () => 1_000_000, writer?: WarningWriter) {
  const server = await createServer({ scorer, writer, port: 0, now });
  closers.push(() => server.close());
  const client = await Client.connect(server.port);
  closers.unshift(() => client.close());
  return { server, client };
}

const START: ClientMessage = {
  type: 'session.start',
  callerKnown: false,
  callerInternational: false,
  language: 'ms-MY',
  scriptId: 'test',
};
const say = (text: string): ClientMessage => ({ type: 'transcript.inject', text, speaker: 'caller' });

describe('call socket', () => {
  it('starts a session and echoes injected lines', async () => {
    const { client } = await setup(fakeScorer([decision('none')]));
    client.send(START);
    expect((await client.next('session.started')).sessionId).toMatch(/^[0-9a-f-]{36}$/);

    for (const text of ['Helo', 'Saya dari MCMC', 'Tolong tunggu']) {
      client.send(say(text));
      expect(await client.next('transcript')).toEqual({
        type: 'transcript',
        text,
        language: 'ms-MY',
        atSec: 0,
      });
    }
  });

  it('answers health checks and refuses other paths', async () => {
    const server = await createServer({ scorer: fakeScorer([decision('none')]), port: 0 });
    closers.push(() => server.close());
    const res = await fetch(`http://127.0.0.1:${server.port}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
    await expect(Client.connect(server.port, '/other')).rejects.toThrow();
  });

  it('reports bad input and keeps the socket open', async () => {
    const { client } = await setup(fakeScorer([decision('none')]));
    client.send(say('too early'));
    expect((await client.next('error')).message).toMatch(/session\.start/);
    client.send('not json');
    expect((await client.next('error')).message).toMatch(/JSON/);
    client.send(START);
    await client.next('session.started');
  });

  it('closes the socket on session.end', async () => {
    const { client } = await setup(fakeScorer([decision('none')]));
    const closed = new Promise<void>((resolve) => (client as unknown as { ws: WebSocket }).ws.once('close', () => resolve()));
    client.send(START);
    await client.next('session.started');
    client.send({ type: 'session.end' });
    await closed;
  });
});

describe('risk loop', () => {
  it('escalates through the MCMC-to-police call in the expected order', async () => {
    const { client } = await setup(fakeScorer(MCMC_CALL.map(([d]) => d)));
    client.send(START);
    await client.next('session.started');

    const actions: string[] = [];
    let last;
    for (const [i] of MCMC_CALL.entries()) {
      client.send(say(`line ${i}`));
      last = await client.next('risk');
      actions.push(last.action);
    }
    expect(actions).toEqual(MCMC_CALL.map(([, action]) => action));
    expect(last).toMatchObject({ stage: 'financial_request', scamType: 'fake_police', scorer: 'jev', latencyMs: 12 });
    expect(last?.flags.asks_for_transfer).toBe(0.8);
  });

  it('scores lines one at a time in arrival order', async () => {
    const seen: string[] = [];
    const scorer: Scorer = {
      name: 'jev',
      async score(state) {
        seen.push(state.recentTranscript);
        await new Promise((r) => setTimeout(r, 20));
        return { decision: decision('none'), scorer: 'jev', model: 'fake', latencyMs: 20 };
      },
    };
    const { client } = await setup(scorer);
    client.send(START);
    await client.next('session.started');
    client.send(say('a'));
    client.send(say('b'));
    client.send(say('c'));
    await client.next('risk');
    await client.next('risk');
    await client.next('risk');
    // Short lines all fit in the scoring window (see recentWindow).
    expect(seen).toEqual(['caller: a', 'caller: a\ncaller: b', 'caller: a\ncaller: b\ncaller: c']);
  });

  it('applies the long-call floor after clock.skip', async () => {
    const { client } = await setup(fakeScorer([decision('none')]));
    client.send(START);
    await client.next('session.started');
    client.send(say('Helo, boleh saya bercakap dengan Ali?'));
    expect((await client.next('risk')).action).toBe('none');

    client.send({ type: 'clock.skip', seconds: 3601 });
    const skipped = await client.next('risk');
    expect(ACTIONS.indexOf(skipped.action)).toBeGreaterThanOrEqual(ACTIONS.indexOf('soft_warning'));
    expect(skipped).toMatchObject({ latencyMs: 0, scorer: 'jev', atSec: 3601 });
  });
});

describe('transfers', () => {
  it('completes before a hold, holds after, and releases on request', async () => {
    const { client } = await setup(fakeScorer([decision('none'), ...MCMC_CALL.map(([d]) => d)]));
    client.send(START);
    await client.next('session.started');
    client.send(say('Helo'));
    await client.next('risk');

    client.send({ type: 'transfer.attempt', amountRm: 100, toAccount: 'Demo A' });
    expect(await client.next('transfer')).toMatchObject({ status: 'completed', amountRm: 100, toAccount: 'Demo A' });

    for (let i = 0; i < MCMC_CALL.length; i++) {
      client.send(say(`line ${i}`));
      await client.next('risk');
    }
    client.send({ type: 'transfer.attempt', amountRm: 9000, toAccount: 'Demo B' });
    const held = await client.next('transfer');
    expect(held).toMatchObject({ status: 'held', amountRm: 9000, toAccount: 'Demo B' });

    client.send({ type: 'transfer.release', transferId: held.transferId });
    expect(await client.next('transfer')).toMatchObject({
      transferId: held.transferId,
      status: 'released',
      amountRm: 9000,
    });

    client.send({ type: 'transfer.release', transferId: 'nope' });
    expect((await client.next('error')).message).toMatch(/nope/);
  });
});

describe('scorer failure', () => {
  it('sends an error and scores the next line', async () => {
    const scorer = fakeScorer([new Error('boom'), decision('authority_setup', { claims_authority: 0.8 })]);
    const { client } = await setup(scorer);
    client.send(START);
    await client.next('session.started');

    client.send(say('first'));
    expect((await client.next('error')).message).toMatch(/boom/);
    client.send(say('second'));
    expect(await client.next('risk')).toMatchObject({ stage: 'authority_setup' });
  });
});

describe('warnings', () => {
  // Next `n` messages of any kind, in arrival order, after a short settle.
  async function collect(client: Client): Promise<ServerMessage[]> {
    await new Promise((r) => setTimeout(r, 50));
    return (client as unknown as { queue: ServerMessage[] }).queue.splice(0);
  }

  it('sends one warning per level, each after the risk that raised it', async () => {
    const { client } = await setup(fakeScorer(MCMC_CALL.map(([d]) => d)));
    client.send(START);
    await client.next('session.started');
    for (const [i] of MCMC_CALL.entries()) client.send(say(`line ${i}`));
    const messages = (await collect(client)).filter((m) => m.type === 'risk' || m.type === 'warning');

    const warnings = messages.filter((m) => m.type === 'warning');
    expect(warnings.map((w) => w.action)).toEqual(['soft_warning', 'strong_warning', 'hold_transfers']);
    expect(warnings[0]).toMatchObject({ language: 'ms-MY', text: FALLBACK_WARNINGS.ms.soft_warning });
    expect(warnings[0]).not.toHaveProperty('audioUrl');

    // Each warning comes after the first risk carrying its action and before the next risk.
    const order = messages.map((m) => (m.type === 'risk' ? `risk:${m.action}` : `warning:${m.action}`));
    expect(order).toEqual([
      'risk:none',
      'risk:none',
      'risk:soft_warning',
      'warning:soft_warning',
      'risk:strong_warning',
      'warning:strong_warning',
      'risk:strong_warning',
      'risk:hold_transfers',
      'warning:hold_transfers',
    ]);
  });

  it('sends only the hold warning when a call jumps from none to hold', async () => {
    const { client } = await setup(
      fakeScorer([decision('none'), decision('financial_request', { asks_for_transfer: 0.9 })]),
    );
    client.send(START);
    await client.next('session.started');
    client.send(say('Helo'));
    client.send(say('Pindahkan duit sekarang'));
    const warnings = (await collect(client)).filter((m) => m.type === 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ action: 'hold_transfers' });
  });

  it('sends no warning for an innocent call', async () => {
    const { client } = await setup(fakeScorer([decision('none')]));
    client.send(START);
    await client.next('session.started');
    for (const t of ['Helo', 'Boleh saya cakap dengan Ali?', 'Terima kasih']) client.send(say(t));
    const messages = await collect(client);
    expect(messages.filter((m) => m.type === 'risk')).toHaveLength(3);
    expect(messages.filter((m) => m.type === 'warning')).toHaveLength(0);
  });

  it('warns once for an action raised by clock.skip', async () => {
    const { client } = await setup(fakeScorer([decision('none')]));
    client.send(START);
    await client.next('session.started');
    client.send(say('Helo'));
    client.send({ type: 'clock.skip', seconds: 3601 });
    client.send({ type: 'clock.skip', seconds: 10 });
    const warnings = (await collect(client)).filter((m) => m.type === 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ action: 'soft_warning' });
  });

  it('sends the writer text, in the call language, without waiting before the risk', async () => {
    const seen: WarningInput[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const writer: WarningWriter = {
      async write(input) {
        seen.push(input);
        await gate;
        return `written ${input.action}`;
      },
    };
    const { client } = await setup(fakeScorer(MCMC_CALL.map(([d]) => d)), undefined, writer);
    client.send({ ...START, language: 'en-MY' });
    await client.next('session.started');
    for (const [i] of MCMC_CALL.entries()) client.send(say(`line ${i}`));
    // All six risks arrive while the first warning is still being written.
    for (let i = 0; i < MCMC_CALL.length; i++) await client.next('risk');
    expect(seen.map((s) => s.action)).toEqual(['soft_warning', 'strong_warning', 'hold_transfers']);
    expect(seen[0]).toMatchObject({
      language: 'en-MY',
      scamType: 'fake_police',
      stage: 'family_pressure',
      flagsSeen: [
        'call_transferred_between_agencies',
        'claims_authority',
        'victim_framing',
        'mentions_family_involvement',
        'demands_secrecy',
      ],
    });
    release();
    expect((await client.next('warning')).text).toBe('written soft_warning');
    expect((await client.next('warning')).text).toBe('written strong_warning');
    expect(await client.next('warning')).toMatchObject({
      action: 'hold_transfers',
      language: 'en-MY',
      text: 'written hold_transfers',
    });
  });

  it('falls back to the fixed string when the writer fails', async () => {
    const writer: WarningWriter = { write: () => Promise.reject(new Error('down')) };
    const { client } = await setup(fakeScorer([decision('financial_request', { asks_for_transfer: 0.9 })]), undefined, writer);
    client.send({ ...START, language: 'en-MY' });
    await client.next('session.started');
    client.send(say('Transfer now'));
    expect(await client.next('warning')).toMatchObject({
      action: 'hold_transfers',
      text: FALLBACK_WARNINGS.en.hold_transfers,
    });
  });
});

describe('caps for a public link (#18)', () => {
  async function capped(maxCalls: number, maxCallMs: number) {
    const server = await createServer({ scorer: fakeScorer([decision('none')]), port: 0, maxCalls, maxCallMs });
    closers.push(() => server.close());
    const open = async () => {
      const client = await Client.connect(server.port);
      closers.unshift(() => client.close());
      return client;
    };
    return { server, open };
  }

  it('refuses a call beyond the concurrent limit, and accepts one again after a call ends', async () => {
    const { open } = await capped(2, 60_000);
    const a = await open();
    const b = await open();
    a.send(START);
    b.send(START);
    await a.next('session.started');
    await b.next('session.started');

    const c = await open();
    expect((await c.next('error')).message).toMatch(/Too many calls/);
    expect(await c.closed()).toBe(1013);
    expect(a.isOpen && b.isOpen).toBe(true);

    a.send({ type: 'session.end' });
    await a.closed();
    await new Promise((r) => setTimeout(r, 20));
    const d = await open();
    d.send(START);
    await d.next('session.started');
  });

  it('ends a call that runs past the time limit, and frees its place', async () => {
    const { open } = await capped(1, 150);
    const a = await open();
    a.send(START);
    await a.next('session.started');
    expect((await a.next('error')).message).toMatch(/limit/);
    expect(await a.closed()).toBe(1013);

    await new Promise((r) => setTimeout(r, 20));
    const b = await open();
    b.send(START);
    await b.next('session.started');
  });

  it('does not count clock.skip towards the time limit', async () => {
    const { open } = await capped(1, 400);
    const a = await open();
    a.send(START);
    await a.next('session.started');
    a.send({ type: 'clock.skip', seconds: 3601 });
    expect((await a.next('risk')).action).toBe('soft_warning');
    expect(a.isOpen).toBe(true);
  });

  it('closes the socket on an oversized message', async () => {
    const { open } = await capped(1, 60_000);
    const a = await open();
    a.send(say('x'.repeat(20_000)));
    expect(await a.closed()).toBe(1009);
  });
});

describe('spoken warnings', () => {
  it('attaches audioUrl to strong and hold warnings only', async () => {
    const speech: WarningSpeech = { audioFor: (action, lang) => `data:audio/mpeg;base64,${action}-${lang}` };
    const server = await createServer({
      scorer: fakeScorer(MCMC_CALL.map(([d]) => d)),
      speech,
      port: 0,
      now: () => 1_000_000,
    });
    closers.push(() => server.close());
    const client = await Client.connect(server.port);
    closers.unshift(() => client.close());
    client.send({ ...START, language: 'en-MY' });
    await client.next('session.started');
    for (const [i] of MCMC_CALL.entries()) client.send(say(`line ${i}`));
    const soft = await client.next('warning');
    const strong = await client.next('warning');
    const hold = await client.next('warning');
    expect(soft.action).toBe('soft_warning');
    expect(soft.audioUrl).toBeUndefined();
    expect(strong.audioUrl).toBe('data:audio/mpeg;base64,strong_warning-en-MY');
    expect(hold.audioUrl).toBe('data:audio/mpeg;base64,hold_transfers-en-MY');
  });

  it('sends no audioUrl without a speech source', async () => {
    const { client } = await setup(fakeScorer(MCMC_CALL.map(([d]) => d)));
    client.send(START);
    await client.next('session.started');
    for (const [i] of MCMC_CALL.entries()) client.send(say(`line ${i}`));
    await client.next('warning');
    expect((await client.next('warning')).audioUrl).toBeUndefined();
  });
});
