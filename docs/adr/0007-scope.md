# 7. Malay and Manglish first; three must-have features; the rest is stretch

- Status: Accepted
- Date: 2026-10-12, revised 2026-10-14

## Context

Six days, two people, both full-stack. The plan lists Malay dialects, Manglish, Cantonese, Hokkien, Mandarin and Tamil. We have no native speakers of Chinese or Tamil to record clips or check transcripts and warnings.

## Decision

Must ship, in the deployed prototype and the video:

1. Two scripted scam calls, one in standard Malay and one in Manglish, and one scripted innocent call (ADR 5).
2. The call screen: live transcript, risk bar, scam stage and which scorer answered.
3. Warnings that escalate in the call's language: a soft banner, then a strong full-screen warning.
4. The transfer hold: transfers work before the hold and are blocked after it, with a deliberate, delayed release path.
5. The fraud team dashboard, live from Firestore (ADR 8).

Should ship, cut in this order if we fall behind:

1. The warning spoken aloud. Demoted from must-have on 14 October: the banner already proves the function.
2. The Jev vs Gemini speed race panel. Depends on the Jev cutoff in ADR 2.
3. Live microphone through Chirp 3.

Not building:

- Login or accounts. The demo opens straight into a fake bank account.
- Pub/Sub (ADR 8).

Stretch, only if everything above is done:

- Mandarin or Cantonese, and Tamil, through the live pipeline using generated voices. Label them as unverified by a native speaker.
- Kelantanese and other Malay dialects.
- An Android wrapper with real call-state detection (ADR 3).
- One-tap call to a trusted contact, and scam-advisory lookup.

## Consequences

- The multilingual claim in the pitch rests on the stretch items. If they are cut, the pitch says "designed for" those languages, not "works in".
- A native-speaking judge may spot odd phrasing in generated Chinese or Tamil. Finding one speaker of each to review is worth an hour if it can be arranged.
