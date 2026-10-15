import { INNOCENT, SCAM_MANGLISH } from '../packages/shared/src/scripts';
import type { CallScript } from '../packages/shared/src/scripts';
import type { ClientMessage, ServerMessage } from '../packages/shared/src/events';
import { judge } from './health-judge';

// `pnpm health`: plays the Manglish scam and the innocent script against the
// deployed pipeline. Exit 0 = healthy, 1 = a check failed, 2 = unreachable/off.

const DEFAULT_URL = 'wss://pipeline-842845286251.asia-southeast1.run.app/call';
const LINE_TIMEOUT_MS = 15_000;
const OVERALL_TIMEOUT_MS = 4 * 60_000;
const COLD_START_MS = 3_000;

class Unreachable extends Error {}

function urlFromArgs(): string {
  const i = process.argv.indexOf('--url');
  if (i >= 0) {
    const v = process.argv[i + 1];
    if (!v) throw new Unreachable('--url needs a value');
    return v;
  }
  return process.env.HEALTH_URL || DEFAULT_URL;
}

interface Conn {
  send(m: ClientMessage): void;
  next(type: ServerMessage['type'], timeoutMs: number): Promise<ServerMessage>;
  close(): void;
  messages: ServerMessage[];
  connectMs: number;
}

interface Waiter {
  type: string;
  resolve(m: ServerMessage): void;
  reject(e: Error): void;
}

function connect(url: string): Promise<Conn> {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      reject(new Unreachable(`Bad URL ${url}: ${(e as Error).message}`));
      return;
    }
    const messages: ServerMessage[] = [];
    const waiters: Waiter[] = [];
    const unread: ServerMessage[] = [];
    let opened = false;
    let closed = false;

    ws.addEventListener('open', () => {
      opened = true;
      resolve({
        messages,
        connectMs: Date.now() - t0,
        send: (m) => ws.send(JSON.stringify(m)),
        close: () => ws.close(),
        next(type, timeoutMs) {
          const idx = unread.findIndex((m) => m.type === type || m.type === 'error');
          if (idx >= 0) {
            const m = unread.splice(idx, 1)[0]!;
            return m.type === 'error' && type !== 'error'
              ? Promise.reject(new Error(`server error: ${m.message}`))
              : Promise.resolve(m);
          }
          if (closed) return Promise.reject(new Error('socket closed'));
          return new Promise((res, rej) => {
            const timer = setTimeout(() => {
              waiters.splice(waiters.indexOf(w), 1);
              rej(new Error(`timed out after ${timeoutMs / 1000}s waiting for ${type}`));
            }, timeoutMs);
            const w: Waiter = {
              type,
              resolve: (m) => (clearTimeout(timer), res(m)),
              reject: (e) => (clearTimeout(timer), rej(e)),
            };
            waiters.push(w);
          });
        },
      });
    });
    ws.addEventListener('message', (ev) => {
      if (typeof ev.data !== 'string') return;
      let m: ServerMessage;
      try {
        m = JSON.parse(ev.data) as ServerMessage;
      } catch {
        return;
      }
      messages.push(m);
      const wi = waiters.findIndex((w) => w.type === m.type || m.type === 'error');
      if (wi >= 0) {
        const w = waiters.splice(wi, 1)[0]!;
        if (m.type === 'error' && w.type !== 'error') w.reject(new Error(`server error: ${m.message}`));
        else w.resolve(m);
      } else unread.push(m);
    });
    ws.addEventListener('error', (ev) => {
      if (opened) return;
      const detail = (ev as { message?: string }).message ?? '';
      // Node does not expose the upgrade status, so probe the same host over HTTP.
      fetch(url.replace(/^ws/, 'http'), { signal: AbortSignal.timeout(8000) })
        .then(
          (r) =>
            reject(
              new Unreachable(
                r.status === 403
                  ? `${url} answered 403: the pipeline is "off". Switch it on with services/pipeline/power.sh on.`
                  : `Could not open a WebSocket to ${url} (HTTP ${r.status}${detail ? `, ${detail}` : ''}). Check the URL path.`,
              ),
            ),
          () => reject(new Unreachable(`Could not reach ${url}${detail ? ` (${detail})` : ''}. Check the URL and that the service is deployed.`)),
        );
    });
    ws.addEventListener('close', (ev) => {
      closed = true;
      // Before open, the error handler above explains and rejects.
      void ev;
      waiters.splice(0).forEach((w) => w.reject(new Error('socket closed')));
    });
  });
}

async function runScript(url: string, script: CallScript, kind: 'scam' | 'innocent') {
  const conn = await connect(url);
  try {
    conn.send({
      type: 'session.start',
      language: script.language,
      callerKnown: script.callerKnown,
      callerInternational: script.callerInternational,
      scriptId: script.id,
    });
    await conn.next('session.started', LINE_TIMEOUT_MS);
    for (const line of script.lines) {
      conn.send({ type: 'transcript.inject', text: line.text, speaker: line.speaker });
      await conn.next('risk', LINE_TIMEOUT_MS);
    }
    conn.send({ type: 'transfer.attempt', amountRm: 5000, toAccount: 'Akaun selamat Bank Negara' });
    await conn.next('transfer', LINE_TIMEOUT_MS);
    conn.send({ type: 'session.end' });
    return { conn, verdict: judge(kind, conn.messages) };
  } catch (e) {
    const verdict = judge(kind, conn.messages);
    verdict.pass = false;
    verdict.problems.push((e as Error).message);
    return { conn, verdict };
  } finally {
    setTimeout(() => conn.close(), 200);
  }
}

async function main(): Promise<number> {
  const url = urlFromArgs();
  console.log(`Health check against ${url}`);
  let failed = false;
  let first = true;
  for (const [script, kind] of [
    [SCAM_MANGLISH, 'scam'],
    [INNOCENT, 'innocent'],
  ] as const) {
    const { conn, verdict } = await runScript(url, script, kind);
    if (first) {
      first = false;
      const cold = conn.connectMs > COLD_START_MS ? ' (slow: the service was probably idle, a cold start, not a failure)' : '';
      console.log(`connect: ${conn.connectMs} ms${cold}`);
    }
    console.log(
      `${verdict.pass ? 'PASS' : 'FAIL'} ${script.id}: peak risk ${verdict.peakRisk.toFixed(2)}, final action ${verdict.finalAction}, scorer ${verdict.scorer}, median latency ${verdict.medianLatencyMs} ms`,
    );
    for (const p of verdict.problems) console.log(`  - ${p}`);
    if (!verdict.pass) failed = true;
  }
  return failed ? 1 : 0;
}

const overall = setTimeout(() => {
  console.error('Health check timed out after 4 minutes.');
  process.exit(1);
}, OVERALL_TIMEOUT_MS);

main()
  .then((code) => {
    clearTimeout(overall);
    process.exit(code);
  })
  .catch((e) => {
    clearTimeout(overall);
    if (e instanceof Unreachable) {
      console.error(`UNREACHABLE: ${e.message}`);
      console.error('If the URL is right, the pipeline may be switched off (403): see services/pipeline/power.sh and run it with "on".');
      process.exit(2);
    }
    console.error(`Health check error: ${(e as Error).message}`);
    process.exit(1);
  });
