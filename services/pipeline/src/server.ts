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
}

export async function createServer(
  opts: ServerOptions,
): Promise<{ port: number; close(): Promise<void> }> {
  const now = opts.now ?? Date.now;

  const http = createHttpServer((req, res) => {
    // Cloud Run health check.
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
    } else {
      res.writeHead(404).end();
    }
  });

  const wss = new WebSocketServer({ noServer: true });
  http.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (path !== '/call') {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws));
  });

  function onConnection(ws: WebSocket): void {
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
    ws.on('close', () => session.dispose());
    ws.on('error', () => session.dispose());
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
