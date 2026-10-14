import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { CallScript, ClientMessage } from '@scamshield/shared';
import { PIPELINE_URL } from '../config';
import { ReplayPlayer } from '../replay/player';
import { connectCallSocket, type CallSocket } from './socket';
import {
  callReducer,
  initialCallState,
  type CallStatus,
  type RiskMessage,
  type TransferMessage,
  type TranscriptLine,
  type WarningMessage,
} from './state';

export type { RiskMessage, TransferMessage, TranscriptLine, WarningMessage };

export interface CallApi {
  status: CallStatus;
  script?: CallScript;
  sessionId?: string;
  transcript: TranscriptLine[];
  risk?: RiskMessage; // latest
  riskHistory: RiskMessage[];
  warnings: WarningMessage[]; // in arrival order
  transfers: Record<string, TransferMessage>; // latest message per transferId
  lastTransfer?: TransferMessage;
  errors: string[];
  playing: boolean; // replay still sending lines
  speed: 1 | 2;
  setSpeed(speed: 1 | 2): void;
  // Open the socket, send session.start, then play the script's lines.
  start(script: CallScript): void;
  // Stop the replay, send session.end and close the socket. The call stays
  // on screen with status 'ended'.
  end(): void;
  send(message: ClientMessage): void;
  // Added: end the call if one is open and go back to the replay front door.
  reset(): void;
}

const CallContext = createContext<CallApi | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(callReducer, initialCallState);
  const [speed, setSpeedState] = useState<1 | 2>(1);
  const speedRef = useRef<1 | 2>(1);
  const socketRef = useRef<CallSocket | null>(null);
  const playerRef = useRef<ReplayPlayer | null>(null);

  const teardown = useCallback((sendEnd: boolean) => {
    playerRef.current?.cancel();
    playerRef.current = null;
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket) {
      if (sendEnd) socket.send({ type: 'session.end' });
      socket.close();
    }
  }, []);

  useEffect(() => () => teardown(false), [teardown]);

  const setSpeed = useCallback((next: 1 | 2) => {
    speedRef.current = next;
    setSpeedState(next);
  }, []);

  const send = useCallback((message: ClientMessage) => {
    socketRef.current?.send(message);
  }, []);

  const start = useCallback(
    (script: CallScript) => {
      teardown(true);
      dispatch({ type: 'start', script });

      const socket: CallSocket = connectCallSocket(PIPELINE_URL, {
        onMessage(message) {
          if (socketRef.current !== socket) return;
          dispatch({ type: 'server', message });
          if (message.type === 'session.started') {
            const player = new ReplayPlayer(script.lines, {
              getSpeed: () => speedRef.current,
              send(line) {
                dispatch({ type: 'injected', speaker: line.speaker });
                socket.send({ type: 'transcript.inject', text: line.text, speaker: line.speaker });
              },
              onDone() {
                dispatch({ type: 'playing', playing: false });
              },
            });
            playerRef.current = player;
            dispatch({ type: 'playing', playing: true });
            player.start();
          }
        },
        onError(message) {
          if (socketRef.current !== socket) return;
          playerRef.current?.cancel();
          dispatch({ type: 'connection-error', message });
        },
        onClose() {
          if (socketRef.current !== socket) return;
          playerRef.current?.cancel();
          dispatch({ type: 'connection-error', message: 'The connection to the pipeline closed' });
        },
      });
      socketRef.current = socket;
      socket.send({
        type: 'session.start',
        language: script.language,
        callerKnown: script.callerKnown,
        callerInternational: script.callerInternational,
        scriptId: script.id,
      });
    },
    [teardown],
  );

  const end = useCallback(() => {
    teardown(true);
    dispatch({ type: 'end' });
  }, [teardown]);

  const reset = useCallback(() => {
    teardown(true);
    dispatch({ type: 'reset' });
  }, [teardown]);

  const api = useMemo<CallApi>(
    () => ({
      status: state.status,
      script: state.script,
      sessionId: state.sessionId,
      transcript: state.transcript,
      risk: state.risk,
      riskHistory: state.riskHistory,
      warnings: state.warnings,
      transfers: state.transfers,
      lastTransfer: state.lastTransfer,
      errors: state.errors,
      playing: state.playing,
      speed,
      setSpeed,
      start,
      end,
      send,
      reset,
    }),
    [state, speed, setSpeed, start, end, send, reset],
  );

  return <CallContext.Provider value={api}>{children}</CallContext.Provider>;
}

export function useCall(): CallApi {
  const api = useContext(CallContext);
  if (!api) throw new Error('useCall must be used inside <CallProvider>');
  return api;
}
