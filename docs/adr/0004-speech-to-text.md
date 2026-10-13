# 4. Speech-to-text is Chirp 3, with Gemini audio chunks as the fallback

- Status: Accepted
- Date: 2026-10-13 (opened 2026-10-12 as a bake-off)

## Context

Transcription is the weakest link in the plan. Manglish switches language inside a sentence, and neither of us can judge a Tamil or Cantonese transcript. Scam detection only needs the intent to survive, not a perfect transcript.

This was first left open, to be settled by running 8 to 10 clips through both candidates. With five days left and a decision to use the track's suggested Google tools where we can (ADR 8), the half-day bake-off is no longer worth it.

## Decision

Use Chirp 3 on Speech-to-Text. It streams, and it is a named Google Cloud speech product.

Check it once on a few Manglish clips when live audio is wired. The test is one question: would the scorer still raise the right red flags from the transcript? If not, switch to Gemini Flash audio in 5-second chunks through Vertex AI.

| Candidate | For | Against |
| --- | --- | --- |
| Chirp 3 on Speech-to-Text (chosen) | True streaming; a named Google Cloud speech product | Code-switching inside one sentence is its expected weak spot |
| Gemini Flash audio, 5-second chunks (fallback) | Expected to handle code-switching; one fewer service | Not true streaming; chunk boundaries can cut words |

## Alternatives considered

- **The full bake-off.** Better evidence, but half a day we do not have.
- **Mesolitica's Malaysian speech models.** Best odds on Malay dialects, but self-hosted, not Google, and weak on Cantonese and Tamil. Kept as a note for the pitch, not for the build.

## Consequences

- The pipeline still needs a speech-to-text interface so the fallback can slot in.
- Replay mode (`transcript.inject`) lets everything else be built before audio works.
- Chirp 3 has not been tested on our audio yet. Record the result of the Manglish check here.
