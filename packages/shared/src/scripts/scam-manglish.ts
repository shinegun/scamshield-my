import type { CallScript } from './types';

// The MCMC-to-police call, in Manglish.
export const SCAM_MANGLISH: CallScript = {
  id: 'scam-manglish',
  title: '"MCMC" call (Manglish)',
  summary: 'The same scam in Malaysian English: "MCMC" hands you to a "police inspector" who wants your IC and your balance.',
  language: 'en-MY',
  callerKnown: false,
  callerInternational: false,
  expectedAction: 'hold_transfers',
  lines: [
    {
      speaker: 'caller',
      delaySec: 1,
      stage: 'authority_setup',
      text: "Hello, good morning ah. I'm calling from MCMC, the Communications Commission. We found one phone number under your IC registered in Sabah, and it's been sending scam messages.",
    },
    {
      speaker: 'user',
      delaySec: 8,
      stage: 'authority_setup',
      text: 'Sabah? Eh, I never go Sabah also.',
    },
    {
      speaker: 'caller',
      delaySec: 4,
      stage: 'authority_setup',
      text: 'Okay, then this one must report to police. Hold on ah, I transfer you to the police officer in charge now.',
    },
    {
      speaker: 'caller',
      delaySec: 7,
      stage: 'victim_framing',
      text: 'Hello, this is Inspector Hafiz from Bukit Aman, commercial crime. Your IC is linked to a bank account used for money laundering. Case number KS/2026/04417.',
    },
    {
      speaker: 'user',
      delaySec: 8,
      stage: 'victim_framing',
      text: "Wah, but not me lah, sir. I don't know anything about this.",
    },
    {
      speaker: 'caller',
      delaySec: 4,
      stage: 'victim_framing',
      text: 'I know, I know. We think your identity kena stolen by a syndicate. We want to help you clear your name.',
    },
    {
      speaker: 'caller',
      delaySec: 7,
      stage: 'family_pressure',
      text: "But if you don't cooperate, your parents also will kena called in for investigation. Don't tell anybody, including family. This one is a confidential investigation.",
    },
    {
      speaker: 'caller',
      delaySec: 8,
      stage: 'isolation',
      text: "Don't hang up the phone ah. You must stay on the line until we finish. If not, we have to issue an arrest warrant.",
    },
    {
      speaker: 'caller',
      delaySec: 7,
      stage: 'identity_request',
      text: 'Now send me your IC photo, front and back, plus one selfie holding your IC, through WhatsApp.',
    },
    {
      speaker: 'user',
      delaySec: 6,
      stage: 'identity_request',
      text: 'Okay sir, I send now.',
    },
    {
      speaker: 'caller',
      delaySec: 8,
      stage: 'financial_request',
      text: 'To protect your money during the investigation, you transfer all your balance to the Bank Negara safe account. I give you the account number.',
    },
    {
      speaker: 'caller',
      delaySec: 7,
      stage: 'financial_request',
      text: 'After you transfer, read me the TAC number you receive, okay?',
    },
  ],
};
