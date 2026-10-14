// The questions we ask the decision model about a call. Jev and the Gemini
// fallback both answer this exact schema, so either can sit behind the scorer.

// Option -> description, sent to the model as the criteria for each option.
// Ordered: a call only moves forward through these.
export const SCAM_STAGES = {
  none: 'An ordinary call, or nothing below has happened.',
  authority_setup:
    'The caller introduces themselves as an official body or company, or hands the call to another agency.',
  victim_framing:
    "The caller says the user's identity, number or account was misused and that they are helping.",
  family_pressure: "The caller brings the user's parents or family into the case.",
  isolation: 'The caller tells the user to stay on the line or to keep the call secret.',
  identity_request: 'The caller asks for an IC number, IC photo, selfie or other personal details.',
  financial_request:
    'The caller asks for bank details, an OTP or TAC, a transfer, or an app install.',
} as const;
export type ScamStage = keyof typeof SCAM_STAGES;
export const SCAM_STAGE_KEYS = Object.keys(SCAM_STAGES) as ScamStage[];

export const SCAM_TYPES = {
  none: 'An ordinary call with no sign of a scam.',
  fake_police: 'Caller poses as police (PDRM, "Inspektor", "Sarjan", Bukit Aman).',
  fake_bank_or_bnm: 'Caller poses as a bank or Bank Negara Malaysia.',
  fake_lhdn_or_gov: 'Caller poses as LHDN (tax), a court, customs or another government office.',
  fake_mcmc_or_telco: 'Caller poses as MCMC or a telco such as Maxis, Celcom, Digi or TM.',
  macau_scam:
    'Several fake agencies in sequence, usually ending in a transfer to a "safe account".',
  parcel_courier: 'Caller says a parcel in the user\'s name was held, often by Pos Laju, J&T or customs.',
  investment: 'Caller offers an investment, crypto or forex scheme with high returns.',
  love_scam: 'Caller is a romantic contact asking for money.',
  job_scam: 'Caller offers a job or paid tasks that need an upfront payment.',
} as const;
export type ScamType = keyof typeof SCAM_TYPES;

// The scorer is given the call as a state object; the questions below point
// at its `recent_transcript` field by name.
//
// `question` and `yes` are sent to the model verbatim. Jev reads questions
// literally, so each one states the exact condition and `yes` lists the Malay
// and English phrasings that count. `weight` is how much a certain "yes"
// contributes to combined risk; starting values, to be tuned on the test set.
export const RED_FLAGS = {
  call_transferred_between_agencies: {
    question:
      'In `recent_transcript`, does the caller hand the call from one organisation to a different one?',
    yes: 'For example "MCMC", a bank or a courier saying "saya sambungkan anda ke pihak polis" or "I will transfer you to the police".',
    weight: 0.25,
  },
  claims_authority: {
    question:
      'In `recent_transcript`, does the caller say they are from MCMC, the police, a bank, Bank Negara, LHDN or a court?',
    yes: 'For example "saya dari PDRM", "Inspektor", "pegawai Bank Negara", "this is Maybank security".',
    weight: 0.15,
  },
  victim_framing: {
    question:
      "In `recent_transcript`, does the caller say the user's identity, phone number or account was misused by someone else?",
    yes: 'For example "identiti anda telah dicuri", "nombor anda digunakan untuk pengubahan wang haram", "we are here to help you clear your name".',
    weight: 0.15,
  },
  mentions_family_involvement: {
    question:
      "In `recent_transcript`, does the caller say the user's parents or family could be investigated or affected?",
    yes: 'For example "ibu bapa anda pun akan disiasat", "your family will be involved".',
    weight: 0.3,
  },
  threatens_arrest_or_freeze: {
    question:
      'In `recent_transcript`, does the caller threaten arrest, a warrant or a frozen account?',
    yes: 'For example "waran tangkap", "anda akan ditahan", "akaun anda akan dibekukan".',
    weight: 0.35,
  },
  demands_secrecy: {
    question:
      'In `recent_transcript`, does the caller tell the user not to tell family, friends or the bank about the call?',
    yes: 'For example "jangan beritahu sesiapa", "ini siasatan sulit", "do not tell the bank staff".',
    weight: 0.4,
  },
  keep_on_line_instruction: {
    question:
      'In `recent_transcript`, does the caller tell the user not to hang up or to stay on the call?',
    yes: 'For example "jangan letak telefon", "terus dalam talian", "stay on the line until we finish".',
    weight: 0.4,
  },
  creates_urgency: {
    question:
      'In `recent_transcript`, does the caller say the user must act immediately or before a short deadline?',
    yes: 'For example "sekarang juga", "dalam masa satu jam", "before 5pm today".',
    weight: 0.2,
  },
  asks_for_ic_or_selfie: {
    question:
      'In `recent_transcript`, does the caller ask the user to give or send an IC number, a photo of their IC, or a selfie?',
    yes: 'For example "hantar gambar kad pengenalan", "nombor IC anda", "send a selfie holding your IC".',
    weight: 0.3,
  },
  asks_for_transfer: {
    question:
      'In `recent_transcript`, does the caller ask the user to move money to another account?',
    yes: 'For example "pindahkan duit ke akaun selamat", "transfer to a Bank Negara holding account".',
    weight: 0.85,
  },
  asks_for_otp_or_tac: {
    question:
      'In `recent_transcript`, does the caller ask the user to tell them an OTP, TAC, PIN or password?',
    yes: 'For example "berikan nombor TAC", "read me the code you received".',
    weight: 0.85,
  },
  asks_to_install_app: {
    question:
      'In `recent_transcript`, does the caller ask the user to install an app or open a link?',
    yes: 'For example "muat turun aplikasi ini", "tekan link yang saya hantar", an APK file.',
    weight: 0.6,
  },
  user_seems_compliant: {
    question:
      "In `recent_transcript`, is the user agreeing to do what the caller asks?",
    yes: 'For example "baik tuan", "okay saya buat sekarang", "saya hantar".',
    weight: 0.15,
  },
} as const satisfies Record<string, { question: string; yes: string; weight: number }>;

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
