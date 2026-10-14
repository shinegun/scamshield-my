import { RED_FLAGS, RED_FLAG_KEYS, type FlagScores, type RedFlag } from '@scamshield/shared';
import { scamTypeLabel } from '../call/labels';
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

const SEEN_AT = 0.5;
const MAX_PHRASES = 5;

// Flags at or above 0.5, strongest evidence (weight x score) first.
export function flagPhrases(flags: FlagScores, limit = MAX_PHRASES): string[] {
  return RED_FLAG_KEYS.filter((k) => flags[k] >= SEEN_AT)
    .sort((a, b) => RED_FLAGS[b].weight * flags[b] - RED_FLAGS[a].weight * flags[a])
    .slice(0, limit)
    .map((k) => FLAG_PHRASES[k]);
}

export interface HoldExplanation {
  // "Fake police", or undefined when the model has no scam type yet.
  scamLabel?: string;
  phrases: string[];
}

export function holdExplanation(risk: Pick<RiskMessage, 'scamType' | 'flags'> | undefined): HoldExplanation {
  if (!risk) return { phrases: [] };
  return {
    scamLabel: risk.scamType === 'none' ? undefined : scamTypeLabel(risk.scamType),
    phrases: flagPhrases(risk.flags),
  };
}
