import type { CallScript, ServerMessage } from '@scamshield/shared';

export type RiskMessage = Extract<ServerMessage, { type: 'risk' }>;
export type WarningMessage = Extract<ServerMessage, { type: 'warning' }>;
export type TransferMessage = Extract<ServerMessage, { type: 'transfer' }>;

export interface TranscriptLine {
  speaker: 'caller' | 'user';
  text: string;
  atSec: number;
}

export type CallStatus = 'idle' | 'connecting' | 'live' | 'ended' | 'error';

const MAX_ERRORS = 20;

export interface CallState {
  status: CallStatus;
  script?: CallScript;
  sessionId?: string;
  transcript: TranscriptLine[];
  // Speakers of lines we injected whose `transcript` echo has not arrived yet.
  // The echo carries no speaker, so each one is paired with the next in order.
  pendingSpeakers: Array<'caller' | 'user'>;
  risk?: RiskMessage;
  riskHistory: RiskMessage[];
  warnings: WarningMessage[];
  transfers: Record<string, TransferMessage>;
  lastTransfer?: TransferMessage;
  errors: string[];
  playing: boolean;
}

export const initialCallState: CallState = {
  status: 'idle',
  transcript: [],
  pendingSpeakers: [],
  riskHistory: [],
  warnings: [],
  transfers: {},
  errors: [],
  playing: false,
};

export type CallAction =
  | { type: 'start'; script: CallScript }
  // A line was sent to the pipeline.
  | { type: 'injected'; speaker: 'caller' | 'user' }
  | { type: 'server'; message: ServerMessage }
  | { type: 'playing'; playing: boolean }
  // The socket failed to open or broke.
  | { type: 'connection-error'; message: string }
  | { type: 'end' }
  | { type: 'reset' };

export function callReducer(state: CallState, action: CallAction): CallState {
  switch (action.type) {
    case 'start':
      return { ...initialCallState, status: 'connecting', script: action.script };

    case 'injected':
      return { ...state, pendingSpeakers: [...state.pendingSpeakers, action.speaker] };

    case 'playing':
      return { ...state, playing: action.playing };

    case 'connection-error':
      // The browser reports a failed open as an error and then a close; the
      // first message is the useful one.
      if (state.status === 'error' || state.status === 'ended' || state.status === 'idle') {
        return state;
      }
      return {
        ...state,
        status: 'error',
        playing: false,
        errors: pushError(state.errors, action.message),
      };

    case 'end':
      if (state.status === 'idle') return state;
      return { ...state, status: 'ended', playing: false };

    case 'reset':
      return initialCallState;

    case 'server':
      return applyServerMessage(state, action.message);
  }
}

function applyServerMessage(state: CallState, message: ServerMessage): CallState {
  switch (message.type) {
    case 'session.started':
      return { ...state, status: 'live', sessionId: message.sessionId };

    case 'transcript': {
      const [speaker = 'caller', ...pendingSpeakers] = state.pendingSpeakers;
      return {
        ...state,
        pendingSpeakers,
        transcript: [...state.transcript, { speaker, text: message.text, atSec: message.atSec }],
      };
    }

    case 'risk':
      return { ...state, risk: message, riskHistory: [...state.riskHistory, message] };

    case 'warning':
      return { ...state, warnings: [...state.warnings, message] };

    case 'transfer':
      return {
        ...state,
        transfers: { ...state.transfers, [message.transferId]: message },
        lastTransfer: message,
      };

    case 'error':
      return { ...state, errors: pushError(state.errors, message.message) };

    // Race panel answers belong to the race panel's own socket, not the call.
    case 'race.result':
      return state;
  }
}

function pushError(errors: string[], message: string): string[] {
  return [...errors, message].slice(-MAX_ERRORS);
}
