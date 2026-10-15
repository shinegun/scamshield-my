import type { ServerMessage } from '../packages/shared/src/events';

// Pure judging of one scripted run, kept apart from the socket code so it can be tested.

export interface Verdict {
  pass: boolean;
  problems: string[];
  peakRisk: number;
  finalAction: string;
  scorer: string;
  medianLatencyMs: number;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function judge(kind: 'scam' | 'innocent', messages: ServerMessage[]): Verdict {
  const risks = messages.filter((m): m is Extract<ServerMessage, { type: 'risk' }> => m.type === 'risk');
  const transfer = messages.find((m): m is Extract<ServerMessage, { type: 'transfer' }> => m.type === 'transfer');
  const warnings = messages.filter((m) => m.type === 'warning');
  const errors = messages.filter((m): m is Extract<ServerMessage, { type: 'error' }> => m.type === 'error');
  const last = risks[risks.length - 1];
  const finalAction = last?.action ?? 'none';
  const problems: string[] = [];

  for (const e of errors) problems.push(`server error: ${e.message}`);
  if (risks.length === 0) problems.push('no risk messages received');
  if (!transfer) problems.push('no transfer reply received');

  if (kind === 'scam') {
    if (finalAction !== 'hold_transfers') problems.push(`final action was ${finalAction}, expected hold_transfers`);
    if (transfer && transfer.status !== 'held') problems.push(`transfer was ${transfer.status}, expected held`);
  } else {
    if (warnings.length > 0) problems.push(`${warnings.length} warning(s) sent on an innocent call`);
    if (finalAction !== 'none') problems.push(`final action was ${finalAction}, expected none`);
    if (transfer && transfer.status !== 'completed') problems.push(`transfer was ${transfer.status}, expected completed`);
  }

  return {
    pass: problems.length === 0,
    problems,
    peakRisk: Math.max(0, ...risks.map((r) => r.risk)),
    finalAction,
    scorer: [...new Set(risks.map((r) => r.scorer))].join('+') || 'none',
    medianLatencyMs: Math.round(median(risks.map((r) => r.latencyMs))),
  };
}
