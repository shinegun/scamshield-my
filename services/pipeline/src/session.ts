import { randomUUID } from 'node:crypto';
import {
  ACTIONS,
  absorb,
  decideAction,
  emptySession,
  flagsSeen,
  type Action,
  type CallState,
  type HoldDoc,
  type RiskEntryDoc,
  type SessionDoc,
  type ClientMessage,
  type ScamType,
  type ScorerName,
  type ServerMessage,
  type SessionRisk,
  type TransferStatus,
} from '@scamshield/shared';
import type { CallStore } from './store/types';
import type { Scorer } from './scorers/types';
import { writeWarning, type WarningWriter } from './warnings/writer';
import type { WarningSpeech } from './warnings/speech';

// What the scorer sees each tick: the latest lines back to about 600
// characters (30-45 s of speech), and never fewer than 2 lines. A real call
// goes back and forth in short pieces; with a fixed 2-line window a piece like
// "Did you just make this purchase?" lost its context and an innocent call
// reached a soft warning, while a 600-character window kept it at none and
// still caught every red flag in the scam calls (14 October, Jev and Gemini).
const WINDOW_CHARS = 600;
const WINDOW_MIN_LINES = 2;

export function recentWindow<T extends { text: string }>(lines: readonly T[]): T[] {
  let start = lines.length;
  let chars = 0;
  while (start > 0 && (chars < WINDOW_CHARS || lines.length - start < WINDOW_MIN_LINES)) {
    start--;
    chars += lines[start]!.text.length;
  }
  return lines.slice(start);
}

export interface SessionOptions {
  scorer: Scorer;
  // Writes the warning text; without one the fixed fallback strings are used.
  writer?: WarningWriter;
  // Spoken clips for strong and hold warnings; without one warnings are silent.
  speech?: WarningSpeech;
  // Records the call as it happens. Writes are never waited on and their
  // errors are only logged. Without one, nothing is stored.
  store?: CallStore;
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
  private endRecorded = false;
  private skippedSec = 0;
  private lines: Line[] = [];
  private risk: SessionRisk = emptySession();
  private action: Action = 'none';
  // Ticks per scam type; the call's type is the most frequent (ties go to the latest).
  private typeCounts = new Map<ScamType, number>();
  private latestType: ScamType = 'none';
  private peakRank = 0;
  private tickCount = 0;
  private lastRisk = 0;
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
      const recent = recentWindow(this.lines);
      return this.enqueue(() => this.tick(started, recent));
    }
    return this.enqueue(() => this.handleOther(started, message));
  }

  // The socket went away without session.end.
  dispose(): void {
    this.markEnded();
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
    const started = this.started;
    const now = started.startedAt;
    this.store(() =>
      this.opts.store!.createSession(started.sessionId, {
        sessionId: started.sessionId,
        status: 'live',
        startedAtMs: now,
        updatedAtMs: now,
        language: started.language,
        scriptId: started.scriptId,
        callerKnown: started.callerKnown,
        callerInternational: started.callerInternational,
        risk: 0,
        action: 'none',
        stage: this.risk.stageReached,
        scamType: 'none',
        peakAction: 'none',
        flagsSeen: [],
      }),
    );
  }

  private end(): void {
    if (this.ended) return;
    this.markEnded();
    this.opts.onEnd?.();
  }

  // Whatever the reason the call stopped, the session document says so once.
  private markEnded(): void {
    this.ended = true;
    if (this.endRecorded || !this.started) return;
    this.endRecorded = true;
    const sessionId = this.started.sessionId;
    const now = this.opts.now();
    this.store(() =>
      this.opts.store!.updateSession(sessionId, { status: 'ended', endedAtMs: now, updatedAtMs: now }),
    );
  }

  // Runs a store write without waiting for it; failures are logged, never thrown.
  private store(write: () => Promise<void>): void {
    if (!this.opts.store) return;
    try {
      write().catch((err) => console.error(`store write failed: ${errorText(err)}`));
    } catch (err) {
      console.error(`store write failed: ${errorText(err)}`);
    }
  }

  // The call's dominant scam type: the one with the most ticks, ties to the latest.
  private scamType(): ScamType {
    let best: ScamType = 'none';
    let bestCount = 0;
    for (const [type, count] of this.typeCounts) {
      if (count > bestCount || (count === bestCount && type === this.latestType)) {
        best = type;
        bestCount = count;
      }
    }
    return best;
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
    const type = result.decision.scamType;
    if (type !== 'none') {
      this.typeCounts.set(type, (this.typeCounts.get(type) ?? 0) + 1);
      this.latestType = type;
    }
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
        const atSec = this.atSec(started);
        this.opts.send({
          type: 'transfer',
          transferId,
          status,
          amountRm: message.amountRm,
          toAccount: message.toAccount,
          atSec,
        });
        if (status === 'held') {
          const now = this.opts.now();
          const hold: HoldDoc = {
            transferId,
            status: 'held',
            amountRm: message.amountRm,
            toAccount: message.toAccount,
            heldAtSec: atSec,
            heldAtMs: now,
            risk: this.lastRisk,
            stage: this.risk.stageReached,
            scamType: this.scamType(),
            flagsSeen: flagsSeen(this.risk),
          };
          this.store(() => this.opts.store!.setHold(started.sessionId, transferId, hold));
          this.store(() =>
            this.opts.store!.updateSession(started.sessionId, { holdStatus: 'held', updatedAtMs: now }),
          );
        }
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
        const now = this.opts.now();
        this.store(() =>
          this.opts.store!.updateHold(started.sessionId, message.transferId, {
            status: 'released',
            releasedAtMs: now,
          }),
        );
        this.store(() =>
          this.opts.store!.updateSession(started.sessionId, { holdStatus: 'released', updatedAtMs: now }),
        );
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
    this.lastRisk = risk;
    const scamType = this.scamType();
    this.opts.send({
      type: 'risk',
      risk,
      action,
      stage: this.risk.stageReached,
      scamType,
      flags: this.risk.peakFlags,
      scorer,
      latencyMs,
      atSec,
    });
    this.recordRisk(started, { risk, action, scamType, scorer, latencyMs, atSec });
    this.warnIfRaised(started, action);
  }

  private recordRisk(
    started: Started,
    t: { risk: number; action: Action; scamType: ScamType; scorer: ScorerName; latencyMs: number; atSec: number },
  ): void {
    if (!this.opts.store) return;
    this.peakRank = Math.max(this.peakRank, ACTIONS.indexOf(t.action));
    const tickId = String(++this.tickCount).padStart(4, '0');
    const entry: RiskEntryDoc = {
      atSec: t.atSec,
      risk: t.risk,
      action: t.action,
      stage: this.risk.stageReached,
      scamType: t.scamType,
      flags: this.risk.peakFlags,
      scorer: t.scorer,
      latencyMs: t.latencyMs,
    };
    const fields: Partial<SessionDoc> = {
      risk: t.risk,
      action: t.action,
      stage: this.risk.stageReached,
      scamType: t.scamType,
      peakAction: ACTIONS[this.peakRank]!,
      flagsSeen: flagsSeen(this.risk),
      updatedAtMs: this.opts.now(),
    };
    this.store(() => this.opts.store!.addRisk(started.sessionId, tickId, entry));
    this.store(() => this.opts.store!.updateSession(started.sessionId, fields));
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
      scamType: this.scamType(),
      stage: this.risk.stageReached,
      flagsSeen: flagsSeen(this.risk),
    });
    this.warnChain = Promise.all([this.warnChain, pending]).then(([, text]) => {
      if (this.ended) return;
      const audioUrl =
        action === 'soft_warning' ? undefined : this.opts.speech?.audioFor(action, started.language);
      this.opts.send({
        type: 'warning',
        action,
        text,
        language: started.language,
        ...(audioUrl ? { audioUrl } : {}),
      });
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
