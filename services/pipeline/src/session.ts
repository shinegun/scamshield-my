import { randomUUID } from 'node:crypto';
import {
  ACTIONS,
  absorb,
  decideAction,
  emptySession,
  flagsSeen,
  type Action,
  type CallState,
  type ClientMessage,
  type ScamType,
  type ScorerName,
  type ServerMessage,
  type SessionRisk,
  type TransferStatus,
} from '@scamshield/shared';
import type { Scorer } from './scorers/types';
import { writeWarning, type WarningWriter } from './warnings/writer';

// Roughly the 30-60 seconds of speech the live pipeline will send; the same
// window try-jev.ts used when we tested against Jev.
const WINDOW_LINES = 2;

export interface SessionOptions {
  scorer: Scorer;
  // Writes the warning text; without one the fixed fallback strings are used.
  writer?: WarningWriter;
  now: () => number;
  send: (message: ServerMessage) => void;
  // Called once when the client sends session.end.
  onEnd?: () => void;
}

interface Line {
  speaker: 'caller' | 'user';
  text: string;
}

interface Transfer {
  amountRm: number;
  toAccount: string;
  status: TransferStatus;
}

interface Started {
  sessionId: string;
  startedAt: number;
  language: string;
  callerKnown: boolean;
  callerInternational: boolean;
  scriptId?: string;
}

// One phone call. Holds everything in memory and talks to the client only
// through `send`, so it can be driven without a socket.
export class CallSession {
  private started?: Started;
  private ended = false;
  private skippedSec = 0;
  private lines: Line[] = [];
  private risk: SessionRisk = emptySession();
  private action: Action = 'none';
  private lastScamType: ScamType = 'none';
  private lastScorer?: ScorerName;
  private bankAppOpen = false;
  private transferScreenOpen = false;
  private transfers = new Map<string, Transfer>();
  // Highest action already warned about, so each level is warned once per call.
  private warnedRank = 0;
  // Warnings are written in parallel but sent in the order they were raised.
  private warnChain: Promise<unknown> = Promise.resolve();
  // Every message after session.start runs through this chain, so scoring
  // ticks go one at a time in arrival order (session memory stays monotonic,
  // ADR 6) and a transfer sees the result of the lines sent before it.
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly opts: SessionOptions) {}

  // Resolves once the message, and any scoring it queued, has been handled.
  receive(raw: string): Promise<void> {
    if (this.ended) return Promise.resolve();

    let message: ClientMessage;
    try {
      message = parseClientMessage(JSON.parse(raw));
    } catch (err) {
      this.error(err instanceof SyntaxError ? 'Message is not valid JSON' : errorText(err));
      return Promise.resolve();
    }

    if (message.type === 'session.start') {
      if (this.started) this.error('Session already started');
      else this.start(message);
      return Promise.resolve();
    }
    if (!this.started) {
      this.error('Send session.start first');
      return Promise.resolve();
    }
    if (message.type === 'session.end') {
      this.end();
      return Promise.resolve();
    }

    const started = this.started;
    if (message.type === 'transcript.inject') {
      // Echo and record the line now; its scoring tick waits its turn.
      this.lines.push({ speaker: message.speaker, text: message.text });
      this.opts.send({
        type: 'transcript',
        text: message.text,
        language: started.language,
        atSec: this.atSec(started),
      });
      const recent = this.lines.slice(-WINDOW_LINES);
      return this.enqueue(() => this.tick(started, recent));
    }
    return this.enqueue(() => this.handleOther(started, message));
  }

  // The socket went away without session.end.
  dispose(): void {
    this.ended = true;
  }

  private start(message: Extract<ClientMessage, { type: 'session.start' }>): void {
    this.started = {
      sessionId: randomUUID(),
      startedAt: this.opts.now(),
      language: message.language,
      callerKnown: message.callerKnown,
      callerInternational: message.callerInternational,
      scriptId: message.scriptId,
    };
    this.opts.send({ type: 'session.started', sessionId: this.started.sessionId });
  }

  private end(): void {
    if (this.ended) return;
    this.ended = true;
    this.opts.onEnd?.();
  }

  private enqueue(task: () => Promise<void> | void): Promise<void> {
    this.chain = this.chain.then(async () => {
      if (this.ended) return;
      try {
        await task();
      } catch (err) {
        this.error(errorText(err));
      }
    });
    return this.chain;
  }

  private async tick(started: Started, recent: Line[]): Promise<void> {
    const atSec = this.atSec(started);
    const state: CallState = {
      recentTranscript: recent.map((l) => `${l.speaker}: ${l.text}`).join('\n'),
      flagsSeenSoFar: flagsSeen(this.risk),
      stageReached: this.risk.stageReached,
      handoffCount: 0,
      language: started.language,
      callerKnown: started.callerKnown,
      callerInternational: started.callerInternational,
      durationSec: atSec,
      bankAppOpen: this.bankAppOpen,
      transferScreenOpen: this.transferScreenOpen,
    };

    let result;
    try {
      result = await this.opts.scorer.score(state);
    } catch (err) {
      this.error(`Scoring failed: ${errorText(err)}`);
      return;
    }
    if (this.ended) return;

    this.risk = absorb(this.risk, result.decision);
    if (result.decision.scamType !== 'none') this.lastScamType = result.decision.scamType;
    this.lastScorer = result.scorer;
    this.sendRisk(started, result.scorer, result.latencyMs);
  }

  private handleOther(started: Started, message: ClientMessage): void {
    switch (message.type) {
      case 'app.state':
        this.bankAppOpen = message.bankAppOpen;
        this.transferScreenOpen = message.transferScreenOpen;
        break;

      case 'clock.skip':
        this.skippedSec += message.seconds;
        // No scorer call: only the long-call floor can change.
        this.sendRisk(started, this.lastScorer ?? this.opts.scorer.name, 0);
        break;

      case 'transfer.attempt': {
        const transferId = randomUUID();
        const status: TransferStatus = this.action === 'hold_transfers' ? 'held' : 'completed';
        this.transfers.set(transferId, {
          amountRm: message.amountRm,
          toAccount: message.toAccount,
          status,
        });
        this.opts.send({
          type: 'transfer',
          transferId,
          status,
          amountRm: message.amountRm,
          toAccount: message.toAccount,
          atSec: this.atSec(started),
        });
        break;
      }

      case 'transfer.release': {
        const transfer = this.transfers.get(message.transferId);
        if (transfer?.status !== 'held') {
          this.error(`No held transfer with id ${message.transferId}`);
          break;
        }
        transfer.status = 'released';
        this.opts.send({
          type: 'transfer',
          transferId: message.transferId,
          status: 'released',
          amountRm: transfer.amountRm,
          toAccount: transfer.toAccount,
          atSec: this.atSec(started),
        });
        break;
      }

      default:
        break;
    }
  }

  private sendRisk(started: Started, scorer: ScorerName, latencyMs: number): void {
    const atSec = this.atSec(started);
    const { risk, action } = decideAction(this.risk, {
      durationSec: atSec,
      callerKnown: started.callerKnown,
    });
    this.action = action;
    this.opts.send({
      type: 'risk',
      risk,
      action,
      stage: this.risk.stageReached,
      scamType: this.lastScamType,
      flags: this.risk.peakFlags,
      scorer,
      latencyMs,
      atSec,
    });
    this.warnIfRaised(started, action);
  }

  // Called right after the `risk` message, and never waited on: the warning is
  // sent whenever its text is ready (the fallback string if the writer is slow).
  private warnIfRaised(started: Started, action: Action): void {
    const rank = ACTIONS.indexOf(action);
    if (rank <= this.warnedRank) return;
    this.warnedRank = rank;
    if (action === 'none') return;

    const pending = writeWarning(this.opts.writer, {
      action,
      language: started.language,
      scamType: this.lastScamType,
      stage: this.risk.stageReached,
      flagsSeen: flagsSeen(this.risk),
    });
    this.warnChain = Promise.all([this.warnChain, pending]).then(([, text]) => {
      if (this.ended) return;
      this.opts.send({ type: 'warning', action, text, language: started.language });
    });
  }

  private atSec(started: Started): number {
    return Math.round((this.opts.now() - started.startedAt) / 1000) + this.skippedSec;
  }

  private error(message: string): void {
    this.opts.send({ type: 'error', message });
  }
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Checks the JSON has the shape of a ClientMessage; throws a short message if not.
function parseClientMessage(value: unknown): ClientMessage {
  if (typeof value !== 'object' || value === null) throw new Error('Message must be a JSON object');
  const m = value as Record<string, unknown>;
  const bad = (field: string) => new Error(`${String(m.type)}: invalid ${field}`);

  switch (m.type) {
    case 'session.start':
      if (typeof m.callerKnown !== 'boolean') throw bad('callerKnown');
      if (typeof m.callerInternational !== 'boolean') throw bad('callerInternational');
      if (typeof m.language !== 'string') throw bad('language');
      if (m.scriptId !== undefined && typeof m.scriptId !== 'string') throw bad('scriptId');
      break;
    case 'transcript.inject':
      if (typeof m.text !== 'string') throw bad('text');
      if (m.speaker !== 'caller' && m.speaker !== 'user') throw bad('speaker');
      break;
    case 'app.state':
      if (typeof m.bankAppOpen !== 'boolean') throw bad('bankAppOpen');
      if (typeof m.transferScreenOpen !== 'boolean') throw bad('transferScreenOpen');
      break;
    case 'transfer.attempt':
      if (typeof m.amountRm !== 'number' || !Number.isFinite(m.amountRm)) throw bad('amountRm');
      if (typeof m.toAccount !== 'string') throw bad('toAccount');
      break;
    case 'transfer.release':
      if (typeof m.transferId !== 'string') throw bad('transferId');
      break;
    case 'clock.skip':
      if (typeof m.seconds !== 'number' || !Number.isFinite(m.seconds) || m.seconds < 0) {
        throw bad('seconds');
      }
      break;
    case 'session.end':
      break;
    default:
      throw new Error(`Unknown message type: ${String(m.type)}`);
  }
  return m as unknown as ClientMessage;
}
