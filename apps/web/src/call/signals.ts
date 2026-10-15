import { RED_FLAG_KEYS, type Action, type RedFlag } from '@scamshield/shared';
import type { RiskMessage, TranscriptLine } from './state';

// Copy of FLAG_SEEN_AT in packages/shared/src/risk.ts, which isn't exported:
// the score at which a flag counts as heard. Keep the two in step.
export const FLAG_SEEN_AT = 0.5;

export interface LineSignals {
  // Flags first heard at a tick after this line, in RED_FLAGS order.
  flags: RedFlag[];
  // The action at the tick that first heard them, for colour (ADR 6).
  action: Action;
}

// For each caller line, the flags whose score first reached FLAG_SEEN_AT at a
// tick after it. A tick belongs to the latest caller line said at or before
// it; flags from ticks before any caller line are dropped. Keyed by index
// into `transcript`.
export function callerSignals(
  transcript: readonly TranscriptLine[],
  riskHistory: readonly RiskMessage[],
): Map<number, LineSignals> {
  const result = new Map<number, LineSignals>();
  const heard = new Set<RedFlag>();

  for (const tick of riskHistory) {
    const fresh = RED_FLAG_KEYS.filter((k) => !heard.has(k) && tick.flags[k] >= FLAG_SEEN_AT);
    if (fresh.length === 0) continue;
    fresh.forEach((k) => heard.add(k));

    const line = lastCallerLineAt(transcript, tick.atSec);
    if (line < 0) continue;
    const prev = result.get(line);
    result.set(line, {
      flags: prev ? RED_FLAG_KEYS.filter((k) => prev.flags.includes(k) || fresh.includes(k)) : fresh,
      action: tick.action,
    });
  }
  return result;
}

function lastCallerLineAt(transcript: readonly TranscriptLine[], atSec: number): number {
  for (let i = transcript.length - 1; i >= 0; i--) {
    const line = transcript[i];
    if (line && line.speaker === 'caller' && line.atSec <= atSec) return i;
  }
  return -1;
}
