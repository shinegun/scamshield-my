// The questions we ask the decision model about a call. Jev and the Gemini
// fallback both answer this exact schema, so either can sit behind the scorer.

// Ordered: a call only moves forward through these.
export const SCAM_STAGES = [
  'none',
  'authority_setup',
  'victim_framing',
  'family_pressure',
  'isolation',
  'identity_request',
  'financial_request',
] as const;
export type ScamStage = (typeof SCAM_STAGES)[number];

export const SCAM_TYPES = [
  'none',
  'fake_police',
  'fake_bank_or_bnm',
  'fake_lhdn_or_gov',
  'fake_mcmc_or_telco',
  'macau_scam',
  'parcel_courier',
  'investment',
  'love_scam',
  'job_scam',
] as const;
export type ScamType = (typeof SCAM_TYPES)[number];

// `question` is sent to the model verbatim. `weight` is how much a certain
// "yes" contributes to combined risk; starting values, to be tuned on the
// test set.
export const RED_FLAGS = {
  call_transferred_between_agencies: {
    question:
      'The call was handed from one agency to another, e.g. "MCMC", a bank or a courier transferring to "police".',
    weight: 0.25,
  },
  claims_authority: {
    question: 'The caller claims to be MCMC, police, a bank, Bank Negara, LHDN or a court.',
    weight: 0.15,
  },
  victim_framing: {
    question: 'The caller says the user is a victim of identity theft and that they are helping.',
    weight: 0.15,
  },
  mentions_family_involvement: {
    question: "The caller says the user's parents or family could be investigated or affected.",
    weight: 0.3,
  },
  threatens_arrest_or_freeze: {
    question: 'The caller threatens arrest, a warrant or a frozen account.',
    weight: 0.35,
  },
  demands_secrecy: {
    question: 'The caller tells the user not to tell family, friends or the bank.',
    weight: 0.4,
  },
  keep_on_line_instruction: {
    question: 'The caller tells the user not to hang up or to stay on the call.',
    weight: 0.4,
  },
  creates_urgency: {
    question: 'The caller says the user must act now, today or within the hour.',
    weight: 0.2,
  },
  asks_for_ic_or_selfie: {
    question: 'The caller asks for an IC number, IC photo, selfie or phone number.',
    weight: 0.3,
  },
  asks_for_transfer: {
    question: 'The caller asks the user to move money or open a "safe account".',
    weight: 0.85,
  },
  asks_for_otp_or_tac: {
    question: 'The caller asks for an OTP, TAC, PIN or password.',
    weight: 0.85,
  },
  asks_to_install_app: {
    question: 'The caller asks the user to install an app or click a link.',
    weight: 0.6,
  },
  user_seems_compliant: {
    question: 'The user is agreeing with or following the caller\'s instructions.',
    weight: 0.15,
  },
} as const satisfies Record<string, { question: string; weight: number }>;

export type RedFlag = keyof typeof RED_FLAGS;
export const RED_FLAG_KEYS = Object.keys(RED_FLAGS) as RedFlag[];

// Probability in [0, 1] per red flag.
export type FlagScores = Record<RedFlag, number>;

// One answer from the decision model for one scoring tick.
export interface Decision {
  scamStage: ScamStage;
  scamType: ScamType;
  flags: FlagScores;
}

// What the decision model sees on each tick.
export interface CallState {
  // Last 30-60 seconds of transcript.
  recentTranscript: string;
  // Everything seen earlier in the call; a handoff at minute 5 still matters
  // at hour 3.
  flagsSeenSoFar: RedFlag[];
  stageReached: ScamStage;
  handoffCount: number;
  language: string;
  callerKnown: boolean;
  callerInternational: boolean;
  durationSec: number;
  bankAppOpen: boolean;
  transferScreenOpen: boolean;
}
