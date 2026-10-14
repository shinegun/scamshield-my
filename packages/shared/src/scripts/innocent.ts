import type { CallScript } from './types';

// A real bank's fraud check. It claims authority and mentions a TAC, so it is
// the hardest innocent call: risk must stay low and a transfer must go through.
export const INNOCENT: CallScript = {
  id: 'innocent',
  title: 'Bank card check (innocent)',
  summary: 'Your bank calls to confirm a Shopee purchase. Nothing is asked of you, so nothing should be flagged.',
  language: 'en-MY',
  callerKnown: false,
  callerInternational: false,
  expectedAction: 'none',
  lines: [
    {
      speaker: 'caller',
      delaySec: 1,
      stage: 'none',
      text: 'Hi, good afternoon. This is Farah from Maybank card services. Am I speaking to the cardholder?',
    },
    {
      speaker: 'user',
      delaySec: 6,
      stage: 'none',
      text: 'Yes, speaking.',
    },
    {
      speaker: 'caller',
      delaySec: 3,
      stage: 'none',
      text: 'We are calling to confirm a card transaction at Shopee for RM120 last night. Did you make this purchase?',
    },
    {
      speaker: 'user',
      delaySec: 7,
      stage: 'none',
      text: 'Oh yes, that one is mine. I bought a rice cooker.',
    },
    {
      speaker: 'caller',
      delaySec: 5,
      stage: 'none',
      text: 'Okay, thank you for confirming. No further action is needed. Just a reminder, Maybank will never ask for your TAC or password over the phone.',
    },
    {
      speaker: 'user',
      delaySec: 8,
      stage: 'none',
      text: 'Okay, noted. Thanks.',
    },
    {
      speaker: 'caller',
      delaySec: 3,
      stage: 'none',
      text: 'Thank you, have a nice day.',
    },
  ],
};
