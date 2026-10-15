import { RED_FLAGS, RED_FLAG_KEYS, type FlagScores, type RedFlag } from '@scamshield/shared';
import { scamTypeLabel, type Lang } from '../call/labels';
import type { RiskMessage } from '../call/state';

// Plain-language phrases for the flags, shown on the "transfer held" screen.
// Raw flag keys are never shown to the user.
export const FLAG_PHRASES: Record<RedFlag, string> = {
  call_transferred_between_agencies: 'The caller passed you on to a different organisation',
  claims_authority: 'The caller says they are from the police, a bank or the government',
  victim_framing: 'The caller says your identity or account was misused',
  mentions_family_involvement: 'The caller said your family could be investigated',
  threatens_arrest_or_freeze: 'The caller threatened arrest or a frozen account',
  demands_secrecy: 'The caller told you not to tell anyone',
  keep_on_line_instruction: 'The caller told you not to hang up',
  creates_urgency: 'The caller is pressuring you to act right now',
  asks_for_ic_or_selfie: 'The caller asked for your IC or a selfie',
  asks_for_transfer: 'The caller asked you to move money to another account',
  asks_for_otp_or_tac: 'The caller asked for an OTP or TAC code',
  asks_to_install_app: 'The caller asked you to install an app or open a link',
  user_seems_compliant: 'You seemed to be agreeing to what the caller asked',
};

export const FLAG_PHRASES_MS: Record<RedFlag, string> = {
  call_transferred_between_agencies: 'Pemanggil menyambungkan anda kepada organisasi lain',
  claims_authority: 'Pemanggil mengaku daripada polis, bank atau pihak kerajaan',
  victim_framing: 'Pemanggil mendakwa identiti atau akaun anda telah disalahgunakan',
  mentions_family_involvement: 'Pemanggil berkata keluarga anda boleh disiasat',
  threatens_arrest_or_freeze: 'Pemanggil mengugut akan menangkap anda atau membekukan akaun anda',
  demands_secrecy: 'Pemanggil menyuruh anda merahsiakan perkara ini',
  keep_on_line_instruction: 'Pemanggil menyuruh anda jangan meletakkan telefon',
  creates_urgency: 'Pemanggil mendesak anda bertindak dengan segera',
  asks_for_ic_or_selfie: 'Pemanggil meminta IC atau swafoto anda',
  asks_for_transfer: 'Pemanggil meminta anda memindahkan wang ke akaun lain',
  asks_for_otp_or_tac: 'Pemanggil meminta kod OTP atau TAC',
  asks_to_install_app: 'Pemanggil menyuruh anda memasang aplikasi atau membuka pautan',
  user_seems_compliant: 'Anda kelihatan bersetuju dengan permintaan pemanggil',
};

const SEEN_AT = 0.5;
const MAX_PHRASES = 5;

// Flags at or above 0.5, strongest evidence (weight x score) first.
export function flagPhrases(flags: FlagScores, limit = MAX_PHRASES, lang: Lang = 'en'): string[] {
  const phrases = lang === 'ms' ? FLAG_PHRASES_MS : FLAG_PHRASES;
  return RED_FLAG_KEYS.filter((k) => flags[k] >= SEEN_AT)
    .sort((a, b) => RED_FLAGS[b].weight * flags[b] - RED_FLAGS[a].weight * flags[a])
    .slice(0, limit)
    .map((k) => phrases[k]);
}

export interface HoldExplanation {
  // "Fake police", or undefined when the model has no scam type yet.
  scamLabel?: string;
  phrases: string[];
}

export function holdExplanation(
  risk: Pick<RiskMessage, 'scamType' | 'flags'> | undefined,
  lang: Lang = 'en',
): HoldExplanation {
  if (!risk) return { phrases: [] };
  return {
    scamLabel: risk.scamType === 'none' ? undefined : scamTypeLabel(risk.scamType, lang),
    phrases: flagPhrases(risk.flags, MAX_PHRASES, lang),
  };
}

// Fixed text of the hold screen and the form notice. Amounts are passed in
// already formatted (RM stays as it is in both languages).
export interface HoldStrings {
  title: string;
  body(amount: string, toAccount: string, balance: string): string;
  // Held screen, iOS grouped layout.
  heldTitle: string;
  back: string;
  stillIn: string;
  // "You were on a call that looked like a fake police scam ...", scam label optional.
  because(scamLabel?: string): string;
  transferSection: string;
  to: string;
  reason: string;
  noticedSection: string;
  callCentre: string;
  cancel: string;
  reallyMe: string;
  pausedNotice: string;
}

const HOLD_STRINGS: Record<Lang, HoldStrings> = {
  en: {
    title: 'Transfer held to protect you',
    body: (amount, to, balance) =>
      `We stopped ${amount} to ${to} because this looks like it could be part of a scam. Your balance has not changed: ${balance}.`,
    heldTitle: 'Transfer paused',
    back: 'Accounts',
    stillIn: 'Still in your Savings',
    because: (label) =>
      `You were on a call that looked like a ${label ? `${label.toLowerCase()} ` : ''}scam when this transfer was made, so we didn't send it.`,
    transferSection: 'TRANSFER',
    to: 'To',
    reason: 'Reason',
    noticedSection: 'WHAT WE NOTICED',
    callCentre: 'Call Scam Response Centre (997)',
    cancel: 'Cancel Transfer',
    reallyMe: 'This was really me',
    pausedNotice: 'Transfers are paused during this call.',
  },
  ms: {
    title: 'Pindahan ditahan untuk melindungi anda',
    body: (amount, to, balance) =>
      `Kami menahan pindahan ${amount} ke ${to} kerana ia mungkin sebahagian daripada penipuan. Baki akaun anda tidak berubah: ${balance}.`,
    heldTitle: 'Pindahan ditahan',
    back: 'Akaun',
    stillIn: 'Masih dalam akaun Simpanan anda',
    because: (label) =>
      `Anda sedang membuat panggilan yang kelihatan seperti penipuan ${label ? `${label.toLowerCase()} ` : ''}semasa pindahan ini dibuat, jadi kami tidak menghantarnya.`,
    transferSection: 'PINDAHAN',
    to: 'Kepada',
    reason: 'Sebab',
    noticedSection: 'APA YANG KAMI PERHATIKAN',
    callCentre: 'Hubungi Pusat Respons Scam (997)',
    cancel: 'Batalkan Pindahan',
    reallyMe: 'Ini memang saya',
    pausedNotice: 'Pindahan wang ditahan sepanjang panggilan ini.',
  },
};

export const holdStrings = (lang: Lang = 'en'): HoldStrings => HOLD_STRINGS[lang];
