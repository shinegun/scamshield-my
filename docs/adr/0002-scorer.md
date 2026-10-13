# 2. Jev is the primary scorer; Gemini answers the same schema as fallback

- Status: Accepted
- Date: 2026-10-12

## Context

The plan's decision engine is Jev, a hosted model that returns typed answers with calibrated confidence in 70–500 ms. It is not a Google model, and this is a Google AI hackathon. Aqil has Jev access now and wants to keep it. Jev cannot be trained; our Malaysian scam knowledge goes into the questions we ask it.

## Decision

- Jev is the primary scorer.
- Gemini Flash-Lite with structured output answers the exact same schema (`packages/shared/src/schema.ts`). It is the fallback if Jev is slow or down, and the opponent in the speed race shown in the video.
- Both sit behind one scorer interface that takes a `CallState` and returns a `Decision`.
- Gemini Flash writes the warning text. Jev only decides.

## Alternatives considered

- **Gemini-first, Jev pluggable.** Safer if Jev access had not arrived. It has.
- **Drop Jev.** A cleaner all-Google story, but loses the speed comparison.

## Consequences

- The pipeline is built against Gemini first, because the Jev request and response shapes are not known yet. The Jev scorer waits on the docs URL.
- Every tick asks Jev first with a hard timeout of about 800 ms; on a timeout or error, Gemini's answer is used, so a call never stalls. The `risk` message says which scorer answered and how long it took, and the bank app shows it.
- Cutoff: if the Jev scorer is not working by end of Thursday 15 October, the prototype ships Gemini-only and the pitch mentions Jev as planned.
- The speed race is a should-have (ADR 7). It also supplies the deck's benchmarking slide.
- Jev runs in the US. Expect roughly 150–250 ms of extra latency from Malaysia; we score every few seconds, so this is acceptable.
