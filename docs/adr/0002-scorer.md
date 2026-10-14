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

## What the Jev docs changed (2026-10-13)

Read from [docs.typesafe.ai](https://docs.typesafe.ai/llms.txt); the agent skill is installed in `.claude/skills/typesafe-ai`.

- **Malay is the open risk.** Jev's primary training language is English. Other languages "are handled but not equally well", and TypeSafe says to test before relying on it. Our transcripts are Malay and Manglish.
- **Red flags map to Noul questions** (probability of yes) and stage and type map to Choice questions. All 15 go in one request and are answered in parallel.
- **Jev reads questions literally.** Each red flag is now an exact yes/no question, with the Malay and English phrasings that count listed in its criteria. This is where our Malaysian scam knowledge lives.
- **Jev cannot compare numbers or dates, and unrelated state lowers accuracy.** Call length and bank-app state stay in code; the model sees only the recent transcript, the flags and stage seen so far, and the caller type.
- **Choice leans toward the first option.** `none` is first in both lists, so the bias is toward staying quiet.
- **Cost is negligible:** $0.042 per million input tokens, output free.

## Consequences

- `services/pipeline/src/jev.ts` is the Jev scorer, built against the docs above.
- Every tick asks Jev first with a hard timeout of about 800 ms and no retries; on a timeout or error, Gemini's answer is used, so a call never stalls. The `risk` message says which scorer answered and how long it took, and the bank app shows it.
- **First thing to run with a key:** `pnpm --filter @scamshield/pipeline try:jev`. It plays the scripted calls in English and in Malay and prints stage, flags, risk and latency for each line. It uses a long timeout so it measures Jev's real latency.
- If Malay scores clearly worse than English, the options are: have Gemini translate each chunk to English before Jev (adds latency and weakens the speed story), or make Gemini primary for Malay and keep Jev for the speed race only. Decide from the `try:jev` output, then update this ADR.
- Cutoff: if the Jev scorer is not working by end of Thursday 15 October, the prototype ships Gemini-only and the pitch mentions Jev as planned.
- The Gemini scorer is still to be built. It answers the same questions from `packages/shared/src/schema.ts`.
- The speed race is a should-have (ADR 7). It also supplies the deck's benchmarking slide.
- Jev runs in the US. Expect roughly 150–250 ms of extra latency from Malaysia; we score every few seconds, so this is acceptable.
