# 4. Speech-to-text is picked by a day-1 bake-off

- Status: Open
- Date: 2026-10-12

## Context

Transcription is the weakest link in the plan. Manglish switches language inside a sentence, and neither of us can judge a Tamil or Cantonese transcript. Scam detection only needs the intent to survive, not a perfect transcript.

## Decision

Run the same 8 to 10 short clips through both candidates and pick the winner by reading the transcripts. Budget: half a day.

| Candidate | For | Against |
| --- | --- | --- |
| Chirp 3 on Speech-to-Text | True streaming; a named Google Cloud speech product | Code-switching inside one sentence is its expected weak spot |
| Gemini Flash audio, 5-second chunks | Expected to handle code-switching; one fewer service | Not true streaming; chunk boundaries can cut words |

Judge each transcript on one question: would the scorer still raise the right red flags from it?

## Alternatives considered

- **Mesolitica's Malaysian speech models.** Best odds on Malay dialects, but self-hosted, not Google, and weak on Cantonese and Tamil. Kept as a note for the pitch, not for the build.

## Consequences

- The pipeline needs a speech-to-text interface so either candidate can slot in.
- Replay mode (`transcript.inject`) lets everything else be built before this is decided.
- Update this ADR with the result and the clips used.
