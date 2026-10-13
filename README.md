# ScamShield MY

Warns Malaysians during a scam call, in the language they speak, and holds the bank transfer before the money leaves. Built for the Google AI hackathon by Aqil and Ilham.

- **The pitch:** Google tells you it might be a scam. We stop the money leaving.
- **The bar:** "Build a working prototype on Google Cloud and submit it for evaluation."
- **Submission:** recorded video, due about 19 October 2026 (Aqil to confirm the exact time).
- **Original plan:** [ScamShield MY — Hackathon Plan](https://claude.ai/artifact/CY158QGGMa3HBGx8WZ4mfF). Where the plan and the ADRs below disagree, the ADRs win.

## How it fits together

```
Bank app (web, phone-styled)  ──WebSocket──▶  Pipeline (Cloud Run)
  Cloudflare Pages                             ├─ speech-to-text (Chirp 3 or Gemini, see ADR 4)
                                               ├─ scorer: Jev, Gemini as fallback
                                               ├─ risk engine (packages/shared)
                                               └─ warning writer + text-to-speech (Gemini)
Fraud dashboard (web)  ◀──realtime──  Supabase  ◀── sessions, risk history, holds
```

## Decisions

| # | Decision | Status |
| --- | --- | --- |
| [1](docs/adr/0001-hosting-split.md) | Cloud Run for the pipeline, Supabase for data, Cloudflare Pages for the frontend | Accepted |
| [2](docs/adr/0002-scorer.md) | Jev is the primary scorer; Gemini answers the same schema as fallback | Accepted |
| [3](docs/adr/0003-web-client.md) | The bank app is a web app styled as a phone, with a simulated call | Accepted |
| [4](docs/adr/0004-speech-to-text.md) | Speech-to-text is picked by a day-1 bake-off | Open |
| [5](docs/adr/0005-demo-audio.md) | Demo audio is live mic, with transcript replay as fallback | Accepted |
| [6](docs/adr/0006-risk-engine.md) | Code, not the model, turns flags into actions | Accepted |
| [7](docs/adr/0007-scope.md) | Malay and Manglish first; three must-have features; the rest is stretch | Accepted |

## What exists

| Path | State |
| --- | --- |
| `packages/shared/src/schema.ts` | Done. Scam stages, scam types and the 13 red-flag questions sent to the scorer. |
| `packages/shared/src/risk.ts` | Done, 8 tests. Combines flags into a risk score and an action. |
| `packages/shared/src/events.ts` | Done. WebSocket messages between the bank app and the pipeline. |
| `services/pipeline` | Empty. Cloud Run service. |
| `apps/web` | Empty. Bank app, caller simulator and fraud dashboard. |

## Run it

Needs Node 22 and pnpm 11.

```bash
pnpm install
pnpm test
pnpm typecheck
```

## Next up

1. Pipeline in replay mode: accept `transcript.inject`, score with Gemini, emit `risk` and `warning`.
2. Web bank app against that socket: call screen, risk bar, warning banner, transfer hold.
3. Speech-to-text bake-off (ADR 4), then wire live mic audio.
4. Jev scorer behind the same interface, then the Jev vs Gemini speed race.
5. Supabase tables and the fraud dashboard.
6. Spoken warnings, deploy, record the video.

## Blocked on

- **Jev docs URL** (Aqil): needed for the Jev scorer's request and response shapes.
- **Google Cloud project with billing** (Aqil): none exists yet, and `gcloud` is not installed on Aqil's machine.
- **Supabase project** (either): not created yet.
- **Permission to use the real scam story** in the video (Aqil to ask his friend).
