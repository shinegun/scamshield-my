import type { CallScript } from './types';

// The MCMC-to-police call, in Manglish: the Malay script line for line, with
// the same stages and timing. Localised with ILMU (ilmu-v3.1).
export const SCAM_MANGLISH: CallScript = {
  id: 'scam-manglish',
  title: '\"MCMC\" call (Manglish)',
  summary: 'The same scam in Malaysian English: \"MCMC\" hands you to a \"police inspector\" who wants your IC and your balance.',
  language: 'en-MY',
  callerKnown: false,
  callerInternational: false,
  expectedAction: 'hold_transfers',
  lines: [
    {
      speaker: 'caller',
      delaySec: 2,
      stage: 'authority_setup',
      text: "Salam, sir. Speaking to Azman bin Haji Ismail ah?",
    },
    {
      speaker: 'user',
      delaySec: 3,
      stage: 'authority_setup',
      text: "Ya, that's me. Who's this?",
    },
    {
      speaker: 'caller',
      delaySec: 5,
      stage: 'authority_setup',
      text: "I'm Puan Aina, an officer from the Malaysian Communications and Multimedia Commission. One phone number under your name is registered in Sabah and was used to send over 30,000 scam messages. This is a very serious case. Now, I will connect your line to the Sabah Contingent Police Headquarters for the next procedure. Please wait.",
    },
    {
      speaker: 'caller',
      delaySec: 12,
      stage: 'victim_framing',
      text: "Salam sir, I'm Inspector Vijay a/l Kumar from the Kota Kinabalu Police Station. My case reference number is: KK-2026-0608-0541. The MCMC officer has already informed you, right?",
    },
    {
      speaker: 'user',
      delaySec: 4,
      stage: 'victim_framing',
      text: "What... scam messages? I've never even been to Sabah. There must be some mistake.",
    },
    {
      speaker: 'caller',
      delaySec: 6,
      stage: 'victim_framing',
      text: "Sir, your IC details may have been stolen. We also found a bank account in your name involved in money laundering activities amounting to RM287,000. I want to help you, but you have to cooperate fully to clear your name.",
    },
    {
      speaker: 'caller',
      delaySec: 8,
      stage: 'family_pressure',
      text: "Sir, there's one more critical thing. Our investigation also involves your parents. If you don't give us your cooperation, they might be called in as joint suspects for questioning.",
    },
    {
      speaker: 'user',
      delaySec: 5,
      stage: 'family_pressure',
      text: "What? My parents? They have nothing to do with this! Sir, please lah.",
    },
    {
      speaker: 'caller',
      delaySec: 7,
      stage: 'family_pressure',
      text: "That's why you have to follow my instructions. This is a secret and classified investigation. You are strictly forbidden from telling anyone, including your family or friends. Leaking this secret is an offence.",
    },
    {
      speaker: 'caller',
      delaySec: 9,
      stage: 'isolation',
      text: "Sir, now I need you to find a quiet and private place. Don't tell anyone where you are. Don't hang up the phone, and make sure your phone battery is fully charged.",
    },
    {
      speaker: 'user',
      delaySec: 4,
      stage: 'isolation',
      text: "Okay, okay... I'm in my room now, alone. Please don't arrest me.",
    },
    {
      speaker: 'caller',
      delaySec: 10,
      stage: 'isolation',
      text: "Sir, if you don't cooperate, I will have to issue an arrest warrant for you right now. The police will go to your house immediately. We don't want it to come to that, right?",
    },
    {
      speaker: 'caller',
      delaySec: 7,
      stage: 'identity_request',
      text: "Alright, for identity verification purposes, I now need you to take a photo of the front and back of your IC and send it to my official WhatsApp, the number I SMS-ed you just now. Quickly, our time is limited.",
    },
    {
      speaker: 'user',
      delaySec: 8,
      stage: 'identity_request',
      text: "I... I'm sending it now. The photo has been sent.",
    },
    {
      speaker: 'caller',
      delaySec: 6,
      stage: 'identity_request',
      text: "Received. Now take a selfie while holding your IC next to your face. Make sure your face and the IC number are clearly visible. This is for biometric verification.",
    },
    {
      speaker: 'caller',
      delaySec: 9,
      stage: 'financial_request',
      text: "Okay sir, verification is complete. Now we're entering the most important stage. To clear your name, all money in your bank account must be immediately transferred to a 'safe' account designated by Bank Negara Malaysia for auditing purposes.",
    },
    {
      speaker: 'user',
      delaySec: 5,
      stage: 'financial_request',
      text: "Transfer all my money to a Bank Negara account? I have about RM50,000 in the bank now. That's all my savings.",
    },
    {
      speaker: 'caller',
      delaySec: 7,
      stage: 'financial_request',
      text: "Yes, the whole RM50,000! This is a mandatory procedure, sir. The safe account is 123-456-7890-0, under the name 'Akaun Amanah Khas-BNM'. The money will be returned after the investigation is complete. Go to your banking app now and make the transfer immediately.",
    },
    {
      speaker: 'user',
      delaySec: 12,
      stage: 'financial_request',
      text: "Okay... okay... I'm opening my bank app now.",
    },
    {
      speaker: 'caller',
      delaySec: 4,
      stage: 'financial_request',
      text: "Good. After you press transfer, the bank will SMS you a TAC. Read me the TAC number straight away, to confirm the transfer.",
    },
    {
      speaker: 'user',
      delaySec: 6,
      stage: 'financial_request',
      text: "Okay sir, I'm waiting for the TAC SMS...",
    },
    {
      speaker: 'caller',
      delaySec: 3,
      stage: 'financial_request',
      text: "Faster ah, sir. Don't hang up and don't tell anybody. I'm waiting on the line.",
    },
  ],
};
