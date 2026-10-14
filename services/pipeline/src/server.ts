import { createServer as createHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';
import type { ServerMessage } from '@scamshield/shared';
import type { Scorer } from './scorers/types';
import { CallSession } from './session';
import type { WarningWriter } from './warnings/writer';

export interface ServerOptions {
  scorer: Scorer;
  // Without a writer, warnings use the fixed fallback strings.
  writer?: WarningWriter;
  // 0 picks a free port (tests).
  port?: number;
  // Injected so tests control the call clock.
  now?: () => number;
  // Caps for a public link (#18): calls open at once, and how long one call
  // may last by the wall clock (clock.skip does not count towards it).
  maxCalls?: number;
  maxCallMs?: number;
}

export const DEFAULT_MAX_CALLS = 5;
export const DEFAULT_MAX_CALL_MS = 5 * 60 * 1000;
// A transcript line is a sentence or two; nothing legitimate comes near this.
const MAX_MESSAGE_BYTES = 16 * 1024;

export async function createServer(
  opts: ServerOptions,
): Promise<{ port: number; close(): Promise<void> }> {
  const now = opts.now ?? Date.now;
  const maxCalls = opts.maxCalls ?? DEFAULT_MAX_CALLS;
  const maxCallMs = opts.maxCallMs ?? DEFAULT_MAX_CALL_MS;
  let openCalls = 0;

  const http = createHttpServer((req, res) => {
    // Cloud Run health check.
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
    } else {
      res.writeHead(404).end();
    }
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  http.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (path !== '/call') {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws));
  });

  function refuse(ws: WebSocket, message: string): void {
    ws.send(JSON.stringify({ type: 'error', message } satisfies ServerMessage));
    ws.close(1013, 'limit');
  }

  function onConnection(ws: WebSocket): void {
    if (openCalls >= maxCalls) {
      refuse(ws, `Too many calls right now (limit ${maxCalls}). Please try again in a minute.`);
      return;
    }
    openCalls++;
    const limitTimer = setTimeout(() => {
      session.dispose();
      refuse(ws, `This demo call reached its ${Math.round(maxCallMs / 60000)}-minute limit and was ended.`);
    }, maxCallMs);
    let counted = true;
    const release = () => {
      clearTimeout(limitTimer);
      if (counted) openCalls--;
      counted = false;
      session.dispose();
    };

    const session = new CallSession({
      scorer: opts.scorer,
      writer: opts.writer,
      now,
      send: (message: ServerMessage) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
      },
      onEnd: () => ws.close(),
    });
    ws.on('message', (data, isBinary) => {
      // Audio frames arrive as binary; speech-to-text is not wired up here yet.
      if (isBinary) return;
      void session.receive(data.toString());
    });
    ws.on('close', release);
    ws.on('error', release);
  }

  await new Promise<void>((resolve, reject) => {
    http.once('error', reject);
    http.listen(opts.port ?? 8080, () => {
      http.off('error', reject);
      resolve();
    });
  });

  return {
    port: (http.address() as AddressInfo).port,
    close: async () => {
      for (const client of wss.clients) client.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => {
        http.close(() => resolve());
        http.closeAllConnections();
      });
    },
  };
}
