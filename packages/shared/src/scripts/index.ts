import { INNOCENT } from './innocent';
import { SCAM_MANGLISH } from './scam-manglish';
import { SCAM_MS } from './scam-ms';
import type { CallScript } from './types';

export type { CallScript, CallScriptLine } from './types';
export { INNOCENT, SCAM_MANGLISH, SCAM_MS };

// In the order the replay screen lists them.
export const CALL_SCRIPTS: CallScript[] = [SCAM_MS, SCAM_MANGLISH, INNOCENT];

export function scriptDurationSec(script: CallScript): number {
  return script.lines.reduce((sum, line) => sum + line.delaySec, 0);
}
