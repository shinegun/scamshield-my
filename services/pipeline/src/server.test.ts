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
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });
    return new Client(ws);
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
}

let closers: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function setup(scorer: Scorer, now: () => number = () => 1_000_000) {
  const server = await createServer({ scorer, port: 0, now });
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
    expect(seen).toEqual(['caller: a', 'caller: a\ncaller: b', 'caller: b\ncaller: c']);
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
