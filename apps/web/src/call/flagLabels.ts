import type { RedFlag } from '@scamshield/shared';
import type { Lang } from './labels';

// Plain words for the 13 red flags, shown under the caller line that raised
// them and in the "Heard" lists. The one place this wording lives.
const FLAG_LABELS: Record<RedFlag, string> = {
  call_transferred_between_agencies: 'Call was handed over',
  claims_authority: 'Claims to be police or an official',
  victim_framing: "Says you're a victim",
  mentions_family_involvement: 'Brings in your family',
  threatens_arrest_or_freeze: 'Threatens arrest or a frozen account',
  demands_secrecy: 'Tells you to keep it secret',
  keep_on_line_instruction: 'Tells you to stay on the line',
  creates_urgency: 'Rushes you',
  asks_for_ic_or_selfie: 'Asks for your IC or a selfie',
  asks_for_transfer: 'Asks you to move money',
  asks_for_otp_or_tac: 'Asks for an OTP or TAC',
  asks_to_install_app: 'Asks you to install an app',
  user_seems_compliant: "You're going along with it",
};

const FLAG_LABELS_MS: Record<RedFlag, string> = {
  call_transferred_between_agencies: 'Panggilan disambung ke pihak lain',
  claims_authority: 'Mengaku polis atau pegawai',
  victim_framing: 'Kata anda mangsa',
  mentions_family_involvement: 'Libatkan keluarga anda',
  threatens_arrest_or_freeze: 'Ugut tangkap atau beku akaun',
  demands_secrecy: 'Suruh rahsiakan',
  keep_on_line_instruction: 'Suruh jangan letak telefon',
  creates_urgency: 'Desak anda cepat',
  asks_for_ic_or_selfie: 'Minta IC atau swafoto',
  asks_for_transfer: 'Minta pindah wang',
  asks_for_otp_or_tac: 'Minta OTP atau TAC',
  asks_to_install_app: 'Suruh pasang aplikasi',
  user_seems_compliant: 'Anda sedang ikut arahan',
};

export const flagLabel = (flag: RedFlag, lang: Lang = 'en'): string =>
  lang === 'ms' ? FLAG_LABELS_MS[flag] : FLAG_LABELS[flag];
