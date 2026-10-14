import type { WarningAction } from './writer';

// The two languages warnings are written in: standard Malay, and Malaysian
// English for everything else.
export type WarningLanguage = 'ms' | 'en';

export function warningLanguage(language: string): WarningLanguage {
  return language.toLowerCase().startsWith('ms') ? 'ms' : 'en';
}

// Fixed text used when Gemini is slow or fails, or when no writer is
// configured. Nothing here claims certainty, names the caller or gives a
// number other than 997.
export const FALLBACK_WARNINGS: Record<WarningLanguage, Record<WarningAction, string>> = {
  ms: {
    soft_warning:
      'Berhati-hati, panggilan ini ada tanda-tanda penipuan. Jangan kongsi maklumat peribadi atau perbankan anda dengan pemanggil.',
    strong_warning:
      'Panggilan ini nampak seperti penipuan. Letakkan telefon dan hubungi bank atau polis melalui nombor rasmi, seperti Pusat Respons Scam Kebangsaan (NSRC) di 997.',
    hold_transfers:
      'Pemindahan wang dari akaun ini ditahan sementara untuk melindungi anda. Sila letakkan telefon dan hubungi bank anda atau 997.',
  },
  en: {
    soft_warning:
      'Be careful, this call shows signs of a scam. Do not share personal or banking details with the caller.',
    strong_warning:
      'This call looks like a scam. Hang up and call your bank or the police on their official number, such as the National Scam Response Centre (NSRC) at 997.',
    hold_transfers:
      'Transfers from this account are paused to protect you. Please hang up and call your bank or the National Scam Response Centre (NSRC) at 997.',
  },
};

export function fallbackWarning(action: WarningAction, language: string): string {
  return FALLBACK_WARNINGS[warningLanguage(language)][action];
}
