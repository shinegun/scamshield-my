import type { CallScript } from './types';

// A real bank's fraud check. It claims authority and mentions a TAC, so it is
// the hardest innocent call: risk must stay low and a transfer must go through.
// Drafted with ILMU (ilmu-v3.1).
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
      text: "Hello, this is Aminah from Maybank Card Services. Am I speaking with Mr. Lim Wei Jie?",
    },
    {
      speaker: 'user',
      delaySec: 3,
      stage: 'none',
      text: "Yes, speaking. How can I help you?",
    },
    {
      speaker: 'caller',
      delaySec: 5,
      stage: 'none',
      text: "I'm calling regarding your Maybank credit card, ending in 8901. We have a pending online transaction for RM258.50 from Shopee.",
    },
    {
      speaker: 'caller',
      delaySec: 4,
      stage: 'none',
      text: "Did you just make this purchase?",
    },
    {
      speaker: 'user',
      delaySec: 7,
      stage: 'none',
      text: "Oh yes, I did! I just bought a new power bank for my phone. That was me, thanks for checking.",
    },
    {
      speaker: 'caller',
      delaySec: 5,
      stage: 'none',
      text: "Okay, thank you for confirming. The transaction is approved and will be processed as usual. Is there anything else I can assist you with today?",
    },
    {
      speaker: 'user',
      delaySec: 6,
      stage: 'none',
      text: "Actually, do you know roughly when my parcel will arrive?",
    },
    {
      speaker: 'caller',
      delaySec: 4,
      stage: 'none',
      text: "For delivery details, it's best to check your Shopee app. They will have the tracking information for you.",
    },
    {
      speaker: 'user',
      delaySec: 5,
      stage: 'none',
      text: "Ah, okay, I'll do that. Thanks for the call.",
    },
    {
      speaker: 'caller',
      delaySec: 7,
      stage: 'none',
      text: "You're welcome. Just a friendly reminder, we will never ask for your TAC or password over the phone. Have a good day, Mr. Lim.",
    },
    {
      speaker: 'user',
      delaySec: 3,
      stage: 'none',
      text: "Alright, thank you. Goodbye.",
    },
  ],
};
