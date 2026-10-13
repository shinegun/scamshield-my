# 5. Guided transcript replay is the main demo path; live mic is an optional extra

- Status: Accepted
- Date: 2026-10-12, revised 2026-10-14

## Context

Apps cannot capture call audio on Android 10+ or iOS, so the demo cannot listen to a real call.

This ADR first made live mic the primary path with replay as the fallback, on the assumption that we only had to record a video. The submission rules add a deployed prototype that judges open themselves, with no retries. A judge arrives with no microphone set up and nobody to play the scammer, so the path they take has to work with one click.

## Decision

- The web app opens on a guided replay: the judge picks a scripted call and plays it. The web app sends the script's lines as `transcript.inject` at a realistic pace.
- There are three scripts: a scam call in standard Malay, a scam call in Manglish, and an innocent call where the risk stays low and the transfer goes through.
- Scoring, the risk engine, warnings and the transfer hold are all real in replay. Only speech-to-text is skipped.
- "Use my microphone" (Chirp 3, ADR 4) is a labelled extra. It ships only if it is solid by the Saturday 17 October freeze; otherwise the control is removed.
- The video is recorded from the deployed link.

## Alternatives considered

- **Live mic as the main path.** The original decision. Fails for a judge without a mic, and one bad take from network or noise costs a full retake.
- **Pre-recorded audio played through speech-to-text.** Shows transcription working, but adds the weakest link in the pipeline to the path that must never fail.

## Consequences

- Speech-to-text is the first thing cut. If it is cut, the video shows replay only and the pitch says so.
- The innocent call is what shows the detection is not a canned animation, so it is a must-have.
- The scripts live in `packages/shared` so tests and the deployed-link health check use the same lines.
- The video opens with the real MCMC-to-police story (permission given on 14 October), compressed from three hours to under half a minute.
- The pitch must explain the three levels from the plan: call signals today, user-started listening in the demo, a telco risk signal in production.
