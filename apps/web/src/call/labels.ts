import { SCAM_STAGES, type Action, type ScamStage, type ScamType } from '@scamshield/shared';
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

export type Lang = 'ms' | 'en';

// "ms", "ms-MY" -> 'ms'; anything else -> 'en'.
export function langOf(bcp47: string | undefined): Lang {
  return bcp47?.toLowerCase().startsWith('ms') ? 'ms' : 'en';
}

const STAGE_LABELS_MS: Record<ScamStage, string> = {
  none: 'Tiada tanda penipuan',
  authority_setup: 'Menyamar sebagai pihak berkuasa',
  victim_framing: 'Mendakwa anda terlibat',
  family_pressure: 'Menekan melalui keluarga',
  isolation: 'Mengasingkan anda',
  identity_request: 'Meminta maklumat peribadi',
  financial_request: 'Meminta wang atau butiran bank',
};

const STAGE_DESCRIPTIONS_MS: Record<ScamStage, string> = {
  none: 'Panggilan biasa, atau belum ada tanda penipuan.',
  authority_setup: 'Pemanggil mengaku daripada badan rasmi atau syarikat, atau menyambungkan panggilan ke agensi lain.',
  victim_framing: 'Pemanggil mendakwa identiti, nombor atau akaun anda disalahgunakan dan kononnya mahu membantu.',
  family_pressure: 'Pemanggil membabitkan ibu bapa atau keluarga anda dalam kes ini.',
  isolation: 'Pemanggil menyuruh anda kekal dalam talian atau merahsiakan panggilan ini.',
  identity_request: 'Pemanggil meminta nombor IC, gambar IC, swafoto atau butiran peribadi lain.',
  financial_request: 'Pemanggil meminta butiran bank, kod OTP atau TAC, pindahan wang atau pemasangan aplikasi.',
};

const SCAM_TYPE_LABELS_MS: Record<ScamType, string> = {
  none: 'Tiada tanda penipuan',
  fake_police: 'Polis palsu',
  fake_bank_or_bnm: 'Bank atau BNM palsu',
  fake_lhdn_or_gov: 'LHDN atau agensi kerajaan palsu',
  fake_mcmc_or_telco: 'MCMC atau telco palsu',
  macau_scam: 'Scam Macau',
  parcel_courier: 'Penipuan bungkusan kurier',
  investment: 'Penipuan pelaburan',
  love_scam: 'Scam cinta',
  job_scam: 'Penipuan kerja',
};

export const stageLabel = (stage: ScamStage, lang: Lang = 'en'): string =>
  lang === 'ms' ? STAGE_LABELS_MS[stage] : humanize(stage === 'none' ? 'no_scam_signs' : stage);
export const stageDescription = (stage: ScamStage, lang: Lang = 'en'): string =>
  lang === 'ms' ? STAGE_DESCRIPTIONS_MS[stage] : SCAM_STAGES[stage];
export const scamTypeLabel = (type: ScamType, lang: Lang = 'en'): string =>
  lang === 'ms' ? SCAM_TYPE_LABELS_MS[type] : humanize(type);

export const ACTION_LABELS: Record<Action, string> = {
  none: 'No warning',
  soft_warning: 'Soft warning',
  strong_warning: 'Strong warning',
  hold_transfers: 'Transfers held',
};

export const ACTION_LABELS_MS: Record<Action, string> = {
  none: 'Tiada amaran',
  soft_warning: 'Amaran awal',
  strong_warning: 'Amaran penipuan',
  hold_transfers: 'Pindahan ditahan',
};

export const actionLabel = (action: Action, lang: Lang = 'en'): string =>
  lang === 'ms' ? ACTION_LABELS_MS[action] : ACTION_LABELS[action];

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
