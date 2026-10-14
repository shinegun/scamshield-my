import type { Action, ScamStage, ScamType } from '@scamshield/shared';
import type { RiskMessage } from './state';

const ACRONYMS: Record<string, string> = {
  lhdn: 'LHDN',
  bnm: 'BNM',
  mcmc: 'MCMC',
  gov: 'government',
  ic: 'IC',
  otp: 'OTP',
  tac: 'TAC',
};

// "fake_lhdn_or_gov" -> "Fake LHDN or government"
function humanize(key: string): string {
  const words = key.split('_').map((w) => ACRONYMS[w] ?? w);
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const stageLabel = (stage: ScamStage): string => humanize(stage === 'none' ? 'no_scam_signs' : stage);
export const scamTypeLabel = (type: ScamType): string => humanize(type);

export const ACTION_LABELS: Record<Action, string> = {
  none: 'No warning',
  soft_warning: 'Soft warning',
  strong_warning: 'Strong warning',
  hold_transfers: 'Transfers held',
};

export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatLatency(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

const SCORER_NAMES = { jev: 'Jev', gemini: 'Gemini' } as const;

// "Jev · 312 ms"
export function scorerTag(risk: Pick<RiskMessage, 'scorer' | 'latencyMs'>): string {
  return `${SCORER_NAMES[risk.scorer]} · ${formatLatency(risk.latencyMs)}`;
}

// A `clock.skip` answer repeats the last scorer with 0 ms; that is not a
// scoring tick, so the tag looks back for the last real one.
export function latestScored(history: readonly RiskMessage[]): RiskMessage | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    const risk = history[i];
    if (risk && risk.latencyMs > 0) return risk;
  }
  return history[history.length - 1];
}
