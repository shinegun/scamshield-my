# 3. The bank app is a web app styled as a phone, with a simulated call

- Status: Accepted
- Date: 2026-10-12

## Context

In production, the bank app detects that a call is live through the phone's call state, which only a native app can read. A native app would cost two or more of our six days. Submission is a recorded video.

## Decision

One React web codebase holds three screens: the mock bank app in a phone frame, a caller simulator, and the fraud dashboard. The call is simulated inside the app. The mic stands in for the phone call, with the "scammer" on speaker.

## Alternatives considered

- **Flutter or React Native app.** Real call-state detection on a real phone is a stronger demo, but too expensive for the time we have.
- **Web first, thin Android wrapper later.** Still open as a day-5 stretch if everything else is solid.

## Consequences

- The video must say plainly that call detection is simulated and explain how it works on a real phone (Android call state, iOS CallKit).
- The plan's "long call" signal needs a way to fast-forward the call timer. `clock.skip` in `packages/shared/src/events.ts` does this.
