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

export interface SummaryStrings {
  title: string;
  whatHappened: string;
  peakRisk: string;
  firstWarning: string;
  warnings: string;
  keptSafe: string;
  transfers: string;
  held: string;
  none: string;
  paused: string;
  noScamSigns: string;
  likely(type: string): string;
  calmTitle: string;
  calmText: string;
  report: string;
  tryAnother: string;
  stages: Record<Exclude<ScamStage, 'none'>, string>;
  softShown: string;
  alertShown: string;
  alertRead: string;
  holdShown: string;
  holdRead: string;
  transferHeld(amount: string): string;
  transferReleased(amount: string): string;
  transferSent(amount: string, to: string): string;
}

const STRINGS: Record<Lang, SummaryStrings> = {
  en: {
    title: 'Call summary',
    whatHappened: 'What happened',
    peakRisk: 'peak risk',
    firstWarning: 'first warning',
    warnings: 'warnings',
    keptSafe: 'kept safe',
    transfers: 'transfers',
    held: 'held',
    none: 'None',
    paused: 'Paused',
    noScamSigns: 'no scam signs',
    likely: (type) => `likely ${type}`,
    calmTitle: 'No scam signs on this call',
    calmText: 'ScamShield listened the whole time and stayed quiet. Your transfers were never paused.',
    report: 'Report to 997',
    tryAnother: 'Try another call',
    stages: {
      authority_setup: 'Caller claims to be an official',
      victim_framing: "Caller says you're caught up in a crime",
      family_pressure: 'Caller brings in your family',
      isolation: 'Told to stay on the line or keep it secret',
      identity_request: 'Asked for your IC or personal details',
      financial_request: 'Asked for money or bank details',
    },
    softShown: 'Possible scam notice shown',
    alertShown: 'Scam alert shown',
    alertRead: 'Scam alert, read aloud',
    holdShown: 'Transfers paused',
    holdRead: 'Transfers paused, alert read aloud',
    transferHeld: (amount) => `${amount} transfer paused`,
    transferReleased: (amount) => `${amount} transfer released by you`,
    transferSent: (amount, to) => `${amount} sent to ${to}`,
  },
  ms: {
    title: 'Ringkasan panggilan',
    whatHappened: 'Apa yang berlaku',
    peakRisk: 'risiko tertinggi',
    firstWarning: 'amaran pertama',
    warnings: 'amaran',
    keptSafe: 'selamat',
    transfers: 'pindahan',
    held: 'ditahan',
    none: 'Tiada',
    paused: 'Ditahan',
    noScamSigns: 'tiada tanda penipuan',
    likely: (type) => `mungkin ${type}`,
    calmTitle: 'Tiada tanda penipuan dalam panggilan ini',
    calmText: 'ScamShield mendengar sepanjang panggilan dan tidak memberi amaran. Pindahan anda tidak pernah ditahan.',
    report: 'Lapor kepada 997',
    tryAnother: 'Cuba panggilan lain',
    stages: {
      authority_setup: 'Pemanggil mengaku sebagai pegawai',
      victim_framing: 'Pemanggil kata anda terlibat dalam jenayah',
      family_pressure: 'Pemanggil melibatkan keluarga anda',
      isolation: 'Disuruh jangan letak telefon atau rahsiakan',
      identity_request: 'Diminta IC atau butiran peribadi',
      financial_request: 'Diminta wang atau butiran bank',
    },
    softShown: 'Notis kemungkinan penipuan dipaparkan',
    alertShown: 'Amaran penipuan dipaparkan',
    alertRead: 'Amaran penipuan, dibacakan',
    holdShown: 'Pindahan ditahan',
    holdRead: 'Pindahan ditahan, amaran dibacakan',
    transferHeld: (amount) => `Pindahan ${amount} ditahan`,
    transferReleased: (amount) => `Pindahan ${amount} dilepaskan oleh anda`,
    transferSent: (amount, to) => `${amount} dihantar ke ${to}`,
  },
};

export const summaryStrings = (lang: Lang = 'en'): SummaryStrings => STRINGS[lang];

function warningText(w: WarningMessage, t: SummaryStrings): string {
  if (w.action === 'soft_warning') return t.softShown;
  if (w.action === 'strong_warning') return w.audioUrl ? t.alertRead : t.alertShown;
  return w.audioUrl ? t.holdRead : t.holdShown;
}

function transferEvent(tr: TransferMessage, t: SummaryStrings): SummaryEvent {
  const amount = formatRm(tr.amountRm);
  const byStatus = {
    held: { text: t.transferHeld(amount), tone: 'safe' as Tone },
    released: { text: t.transferReleased(amount), tone: 'plain' as Tone },
    completed: { text: t.transferSent(amount, tr.toAccount), tone: 'plain' as Tone },
  }[tr.status];
  return { atSec: tr.atSec, time: formatClock(tr.atSec), ...byStatus };
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
  const t = STRINGS[lang];
  const transfers = Object.values(call.transfers);
  const durationSec = Math.max(
    0,
    ...transcript.map((l) => l.atSec),
    ...riskHistory.map((r) => r.atSec),
    ...transfers.map((tr) => tr.atSec),
  );

  // Peak: highest risk, coloured by the highest action the call reached.
  let peakRisk = 0;
  let topAction: Action = 'none';
  for (const tick of riskHistory) {
    peakRisk = Math.max(peakRisk, tick.risk);
    if (ACTION_RANK[tick.action] > ACTION_RANK[topAction]) topAction = tick.action;
  }

  const events: SummaryEvent[] = [];
  let stageIndex = 0;
  for (const tick of riskHistory) {
    const i = SCAM_STAGE_KEYS.indexOf(tick.stage);
    if (i > stageIndex) {
      stageIndex = i;
      const stage = SCAM_STAGE_KEYS[i] as Exclude<ScamStage, 'none'>;
      events.push({ atSec: tick.atSec, time: formatClock(tick.atSec), text: t.stages[stage], tone: 'plain' });
    }
  }
  const warningTimes = warnings.map((w) => warningAt(w, riskHistory));
  warnings.forEach((w, i) => {
    const atSec = warningTimes[i] ?? 0;
    events.push({ atSec, time: formatClock(atSec), text: warningText(w, t), tone: toneOf(w.action) });
  });
  transfers.forEach((tr) => events.push(transferEvent(tr, t)));
  // Stable sort keeps stage, then warning, then transfer at the same second.
  events.sort((a, b) => a.atSec - b.atSec);

  const heldRm = transfers.filter((tr) => tr.status === 'held').reduce((sum, tr) => sum + tr.amountRm, 0);
  const kept =
    heldRm > 0
      ? { value: shortRm(heldRm), label: t.keptSafe, tone: 'safe' as Tone }
      : topAction === 'hold_transfers'
        ? { value: t.paused, label: t.transfers, tone: 'strong' as Tone }
        : { value: t.none, label: t.held, tone: 'plain' as Tone };

  const firstAt = warningTimes.length > 0 ? Math.min(...warningTimes) : undefined;
  const calm = warnings.length === 0 && heldRm === 0;

  const lastRisk = call.risk;
  const scam = topAction !== 'none' && lastRisk && lastRisk.scamType !== 'none'
    ? t.likely(scamTypeLabel(lastRisk.scamType, lang).toLowerCase())
    : calm
      ? t.noScamSigns
      : undefined;

  return {
    subtitle: [formatClock(durationSec), scam].filter(Boolean).join(' · '),
    peak: { value: `${Math.round(peakRisk * 100)}%`, tone: toneOf(topAction) },
    firstWarning: firstAt === undefined ? { value: t.none, label: t.warnings } : { value: formatClock(firstAt), label: t.firstWarning },
    kept,
    calm,
    events,
  };
}
