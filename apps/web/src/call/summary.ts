import { SCAM_STAGE_KEYS, type Action, type ScamStage } from '@scamshield/shared';
import { formatRm } from '../bank/bankMachine';
import { formatClock, scamTypeLabel, type Lang } from './labels';
import type { CallState, RiskMessage, TransferMessage, WarningMessage } from './state';

// What the call summary shows when a call ends, from the call's messages.
// Every colour is a tone tied to an Action or to money kept (ADR 6).

export type Tone = 'plain' | 'soft' | 'strong' | 'safe';

export interface SummaryEvent {
  atSec: number;
  time: string;
  text: string;
  tone: Tone;
}

export interface CallSummary {
  // "2:04 · likely fake police"
  subtitle: string;
  peak: { value: string; tone: Tone };
  firstWarning: { value: string; label: string };
  kept: { value: string; label: string; tone: Tone };
  // True when nothing was warned and nothing held: the calm summary.
  calm: boolean;
  events: SummaryEvent[];
}

const ACTION_RANK: Record<Action, number> = { none: 0, soft_warning: 1, strong_warning: 2, hold_transfers: 3 };

const toneOf = (action: Action): Tone =>
  action === 'none' ? 'plain' : action === 'soft_warning' ? 'soft' : 'strong';

const STAGE_EVENTS: Record<Exclude<ScamStage, 'none'>, string> = {
  authority_setup: 'Caller claims to be an official',
  victim_framing: "Caller says you're caught up in a crime",
  family_pressure: 'Caller brings in your family',
  isolation: 'Told to stay on the line or keep it secret',
  identity_request: 'Asked for your IC or personal details',
  financial_request: 'Asked for money or bank details',
};

function warningText(w: WarningMessage): string {
  if (w.action === 'soft_warning') return 'Possible scam notice shown';
  if (w.action === 'strong_warning') return w.audioUrl ? 'Scam alert, read aloud' : 'Scam alert shown';
  return w.audioUrl ? 'Transfers paused, alert read aloud' : 'Transfers paused';
}

function transferEvent(t: TransferMessage): SummaryEvent {
  const amount = formatRm(t.amountRm);
  const byStatus = {
    held: { text: `${amount} transfer paused`, tone: 'safe' as Tone },
    released: { text: `${amount} transfer released by you`, tone: 'plain' as Tone },
    completed: { text: `${amount} sent to ${t.toAccount}`, tone: 'plain' as Tone },
  }[t.status];
  return { atSec: t.atSec, time: formatClock(t.atSec), ...byStatus };
}

// 50000 -> "RM50k", 5250 -> "RM5.3k", 750 -> "RM750": short enough for a
// third of the phone at 28 px.
export function shortRm(amountRm: number): string {
  if (amountRm >= 1000) {
    const k = Math.round(amountRm / 100) / 10;
    return `RM${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return `RM${Math.round(amountRm)}`;
}

// The time a warning was shown: the first tick that reached its action.
function warningAt(w: WarningMessage, history: readonly RiskMessage[]): number {
  const tick =
    history.find((t) => t.action === w.action) ?? history.find((t) => ACTION_RANK[t.action] >= ACTION_RANK[w.action]);
  return tick?.atSec ?? history[history.length - 1]?.atSec ?? 0;
}

export function summarize(
  call: Pick<CallState, 'transcript' | 'riskHistory' | 'warnings' | 'transfers' | 'risk'>,
  lang: Lang = 'en',
): CallSummary {
  const { riskHistory, warnings, transcript } = call;
  const transfers = Object.values(call.transfers);
  const durationSec = Math.max(
    0,
    ...transcript.map((l) => l.atSec),
    ...riskHistory.map((t) => t.atSec),
    ...transfers.map((t) => t.atSec),
  );

  // Peak: highest risk, coloured by the highest action the call reached.
  let peakRisk = 0;
  let topAction: Action = 'none';
  for (const t of riskHistory) {
    peakRisk = Math.max(peakRisk, t.risk);
    if (ACTION_RANK[t.action] > ACTION_RANK[topAction]) topAction = t.action;
  }

  const events: SummaryEvent[] = [];
  let stageIndex = 0;
  for (const t of riskHistory) {
    const i = SCAM_STAGE_KEYS.indexOf(t.stage);
    if (i > stageIndex) {
      stageIndex = i;
      const stage = SCAM_STAGE_KEYS[i] as Exclude<ScamStage, 'none'>;
      events.push({ atSec: t.atSec, time: formatClock(t.atSec), text: STAGE_EVENTS[stage], tone: 'plain' });
    }
  }
  const warningTimes = warnings.map((w) => warningAt(w, riskHistory));
  warnings.forEach((w, i) => {
    const atSec = warningTimes[i] ?? 0;
    events.push({ atSec, time: formatClock(atSec), text: warningText(w), tone: toneOf(w.action) });
  });
  transfers.forEach((t) => events.push(transferEvent(t)));
  // Stable sort keeps stage, then warning, then transfer at the same second.
  events.sort((a, b) => a.atSec - b.atSec);

  const heldRm = transfers.filter((t) => t.status === 'held').reduce((sum, t) => sum + t.amountRm, 0);
  const kept =
    heldRm > 0
      ? { value: shortRm(heldRm), label: 'kept safe', tone: 'safe' as Tone }
      : topAction === 'hold_transfers'
        ? { value: 'Paused', label: 'transfers', tone: 'strong' as Tone }
        : { value: 'None', label: 'held', tone: 'plain' as Tone };

  const firstAt = warningTimes.length > 0 ? Math.min(...warningTimes) : undefined;
  const calm = warnings.length === 0 && heldRm === 0;

  const lastRisk = call.risk;
  const scam = topAction !== 'none' && lastRisk && lastRisk.scamType !== 'none'
    ? `likely ${scamTypeLabel(lastRisk.scamType, lang).toLowerCase()}`
    : calm
      ? 'no scam signs'
      : undefined;

  return {
    subtitle: [formatClock(durationSec), scam].filter(Boolean).join(' · '),
    peak: { value: `${Math.round(peakRisk * 100)}%`, tone: toneOf(topAction) },
    firstWarning: firstAt === undefined ? { value: 'None', label: 'warnings' } : { value: formatClock(firstAt), label: 'first warning' },
    kept,
    calm,
    events,
  };
}
