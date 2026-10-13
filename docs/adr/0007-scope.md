# 7. Malay and Manglish first; three must-have features; the rest is stretch

- Status: Accepted
- Date: 2026-10-12

## Context

Six days, two people, both full-stack. The plan lists Malay dialects, Manglish, Cantonese, Hokkien, Mandarin and Tamil. We have no native speakers of Chinese or Tamil to record clips or check transcripts and warnings.

## Decision

Must be in the video:

1. The full call flow in standard Malay and Manglish: warnings escalate and the transfer is held.
2. The fraud team dashboard, live from Supabase.
3. The Jev vs Gemini speed race on the same transcript chunk.
4. The warning spoken aloud, not just shown.

Stretch, cut first if we fall behind:

- Mandarin or Cantonese, and Tamil, through the live pipeline using generated voices. Label them as unverified by a native speaker.
- Kelantanese and other Malay dialects.
- An Android wrapper with real call-state detection (ADR 3).
- One-tap call to a trusted contact, and scam-advisory lookup.

## Consequences

- The multilingual claim in the pitch rests on the stretch items. If they are cut, the pitch says "designed for" those languages, not "works in".
- A native-speaking judge may spot odd phrasing in generated Chinese or Tamil. Finding one speaker of each to review is worth an hour if it can be arranged.
