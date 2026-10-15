# Submission description

For the submission form (issue 30). About 260 words; trim the last paragraph first if the form has a limit.

---

**ScamShield MY** listens to a phone call, warns the person in Malay or Manglish as the signs of a scam build up, and pauses their bank transfer before the money leaves. It targets Malaysia's most common phone scam: a fake MCMC officer hands the victim to a fake police inspector, who asks for their savings to be moved to a "safe account". Each line of the call is checked against 13 warning signs. Our own risk engine, not the model, decides when to warn and when to hold, so every decision can be explained. An innocent bank call stays silent.

- **Gemini:** Gemini 2.5 Flash on Vertex AI answers the 13 warning-sign questions when the primary scorer is slow, writes each warning in the caller's language, and, through Gemini 2.5 Flash TTS, speaks the strongest warning aloud.
- **Cloud Run:** the pipeline is a WebSocket service on Cloud Run in asia-southeast1. It receives the call, scores it line by line, decides the action and holds transfers.
- **Firestore:** every call is written as it happens: the session, a risk entry per line and each held transfer. The bank's fraud desk reads them through realtime listeners. No transcripts or names are stored.
- **Firebase:** Firebase Hosting serves the web app (the phone, the bank app, the fraud desk and the scorer race), and the Firebase SDK powers the live dashboard.

The one model outside Google Cloud is **Jev** from TypeSafe, the primary scorer. It answers the same questions in about 235 ms, against Gemini's 895 ms on the same Malay line.

Try it: https://scamshield-my-511604.web.app
