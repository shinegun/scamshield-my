import type { ClientMessage, ServerMessage } from '@scamshield/shared';

export interface CallSocketHandlers {
  onMessage(message: ServerMessage): void;
  // The socket failed to open or broke; `onClose` follows.
  onError(message: string): void;
  // Not called after our own `close()`.
  onClose(): void;
}

export interface CallSocket {
  // Messages sent before the socket has opened are queued and flushed on open.
  send(message: ClientMessage): void;
  close(): void;
}

// A small typed wrapper over WebSocket: JSON text frames both ways.
export function connectCallSocket(
  url: string,
  handlers: CallSocketHandlers,
  WebSocketImpl: typeof WebSocket = WebSocket,
): CallSocket {
  const ws = new WebSocketImpl(url);
  const queue: string[] = [];
  let closedByUs = false;

  ws.onopen = () => {
    for (const frame of queue.splice(0)) ws.send(frame);
  };
  ws.onmessage = (event) => {
    if (typeof event.data !== 'string') return;
    try {
      handlers.onMessage(JSON.parse(event.data) as ServerMessage);
    } catch {
      handlers.onError('Received an unreadable message from the pipeline');
    }
  };
  ws.onerror = () => {
    if (!closedByUs) handlers.onError(`Could not reach the pipeline at ${url}`);
  };
  ws.onclose = () => {
    if (!closedByUs) handlers.onClose();
  };

  return {
    send(message) {
      const frame = JSON.stringify(message);
      if (ws.readyState === WebSocketImpl.OPEN) ws.send(frame);
      else if (ws.readyState === WebSocketImpl.CONNECTING) queue.push(frame);
    },
    close() {
      closedByUs = true;
      queue.length = 0;
      if (ws.readyState === WebSocketImpl.OPEN || ws.readyState === WebSocketImpl.CONNECTING) {
        ws.close();
      }
    },
  };
}
