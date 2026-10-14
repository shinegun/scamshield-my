# 2. Jev is the primary scorer; Gemini answers the same schema as fallback

- Status: Accepted
- Date: 2026-10-12

## Context

The plan's decision engine is Jev, a hosted model that returns typed answers with calibrated confidence in 70–500 ms. It is not a Google model, and this is a Google AI hackathon. Aqil has Jev access now and wants to keep it. Jev cannot be trained; our Malaysian scam knowledge goes into the questions we ask it.

## Decision

- Jev is the primary scorer.
- Gemini 2.5 Flash on Vertex AI in `asia-southeast1`, with structured output and thinking off, answers the exact same schema (`packages/shared/src/schema.ts`). It is the fallback if Jev is slow or down, and the opponent in the speed race shown in the video.
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

## What `try:jev` showed (2026-10-14)

The scripted scam call and three innocent calls, run once in English and once in Malay against `jev-1.13.0`:

- **Malay scores as well as English.** The scam call's stage matched on 6 of 7 lines in both, both reach `hold_transfers` on line 4, and all three innocent calls end at `none` in both. Malay flag probabilities were the same or slightly higher. Jev stays primary for Malay; no translation step.
- **Latency is 227–364 ms per tick from Malaysia,** well inside the 800 ms timeout.
- **Two weak spots, the same in both languages.** Line 3 (family pressure) is read as `victim_framing`, though `mentions_family_involvement` is still 0.98. The innocent bank callback gets `claims_authority` at 0.97 and `authority_setup`, but the risk engine keeps it at `none` (risk 0.26), which is the point of ADR 6.
- **Not yet covered:** Manglish, the Manglish scam script, and more than one innocent line per call. Recheck when the three scripted calls (ADR 5) exist.

## Which Gemini model (2026-10-14)

The plan said Flash-Lite. On our project, `gemini-2.5-flash-lite` returns 404 in `asia-southeast1` and answers only on the `global` endpoint, where a short prompt took 2.1–2.6 s (3.1 Flash-Lite: 1.1–1.5 s). `gemini-2.5-flash` in `asia-southeast1` took 0.5–0.6 s on the same short prompt and 0.8–2.6 s per tick on the full scorer prompt. So the scorer uses `gemini-2.5-flash` in Singapore; `GEMINI_SCORER_MODEL` and `GEMINI_LOCATION` override it.

## Consequences

- `services/pipeline/src/jev.ts` is the Jev scorer, built against the docs above.
- Every tick asks Jev and Gemini at the same time (`src/scorers/fallback.ts`). Jev's answer is used if it arrives within 800 ms; otherwise Gemini's, so a call never stalls. With no Jev key the pipeline runs Gemini alone with a 5 s limit. The `risk` message says which scorer answered and how long it took, and the bank app shows it.
- **First thing to run with a key:** `pnpm --filter @scamshield/pipeline try:jev`. It plays the scripted calls in English and in Malay and prints stage, flags, risk and latency for each line. It uses a long timeout so it measures Jev's real latency.
- If Malay scores clearly worse than English, the options are: have Gemini translate each chunk to English before Jev (adds latency and weakens the speed story), or make Gemini primary for Malay and keep Jev for the speed race only. Decide from the `try:jev` output, then update this ADR.
- Cutoff: if the Jev scorer is not working by end of Thursday 15 October, the prototype ships Gemini-only and the pitch mentions Jev as planned.
- The Gemini scorer is still to be built. It answers the same questions from `packages/shared/src/schema.ts`.
- The speed race is a should-have (ADR 7). It also supplies the deck's benchmarking slide.
- Each tick the scorer sees the latest lines back to about 600 characters (30–45 s of speech), never fewer than 2. Checked on 14 October by chopping the scripted calls into 94–96 short back-and-forth pieces: Jev and Gemini still caught all 12 red flags and held transfers with any window, but a 2-line window let the chopped innocent call reach a soft warning (Jev, 0.44), where 600 characters kept it at none (0.25).
- Jev runs in the US. Expect roughly 150–250 ms of extra latency from Malaysia; we score every few seconds, so this is acceptable.
