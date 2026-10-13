# 5. Demo audio is live mic, with transcript replay as fallback

- Status: Accepted
- Date: 2026-10-12

## Context

Apps cannot capture call audio on Android 10+ or iOS, so the demo cannot listen to a real call. Submission is a recorded video, so we can retake.

## Decision

- One of us plays the scammer on speaker; the web app listens through the mic and streams audio to the pipeline.
- A replay mode sends saved transcript lines straight into scoring, skipping speech-to-text.

## Alternatives considered

- **Live mic only.** One bad take from network or noise costs a full retake with no way to isolate the fault.
- **Pre-recorded audio or transcript only.** Repeatable, but weakens the claim that it works on live speech.

## Consequences

- Replay mode is built first. It unblocks the web app and the scorer before speech-to-text is chosen (ADR 4).
- The video script replays the real MCMC-to-police call, compressed from three hours to about three minutes.
- The pitch must explain the three levels from the plan: call signals today, user-started listening in the demo, a telco risk signal in production.
