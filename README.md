# ScamShield MY

Warns Malaysians during a scam call, in the language they speak, and holds the bank transfer before the money leaves. Built for the Google AI hackathon by Aqil and Ilham.

- **The pitch:** Google tells you it might be a scam. We stop the money leaving.
- **The bar:** "Build a working prototype on Google Cloud and submit it for evaluation."
- **Track:** BFSI: Intelligent Risk, Fraud & Financial Experiences (AI Builder Cup 2026).
- **Submission:** pitch deck on the organisers' template, a 3 to 4 minute demo video, a live prototype link, a public GitHub repo and a brief description covering Firebase, Firestore, Cloud Run and Gemini. The dashboard countdown on 13 October put the close at about 2:29 AM on Monday 19 October Malaysia time (11:59 PM IST on the 18th); treat Sunday 18 October evening as the deadline.
- **Original plan:** [ScamShield MY — Hackathon Plan](https://claude.ai/artifact/CY158QGGMa3HBGx8WZ4mfF). Where the plan and the ADRs below disagree, the ADRs win.

## How it fits together

```
Bank app (web, phone-styled)  ──WebSocket──▶  Pipeline (Cloud Run)
  Firebase Hosting
                                               ├─ speech-to-text (Chirp 3)
                                               ├─ scorer: Jev, Gemini on Vertex AI as fallback
                                               ├─ risk engine (packages/shared)
                                               └─ warning writer + text-to-speech (Gemini on Vertex AI)
Fraud dashboard (web)  ◀──realtime──  Firestore  ◀── sessions, risk history, holds
```

## Decisions

| # | Decision | Status |
| --- | --- | --- |
| [1](docs/adr/0001-hosting-split.md) | Cloud Run for the pipeline, Supabase for data, Cloudflare Pages for the frontend | Superseded by 8 |
| [2](docs/adr/0002-scorer.md) | Jev is the primary scorer; Gemini answers the same schema as fallback | Accepted |
| [3](docs/adr/0003-web-client.md) | The bank app is a web app styled as a phone, with a simulated call | Accepted |
| [4](docs/adr/0004-speech-to-text.md) | Speech-to-text is Chirp 3, with Gemini audio chunks as the fallback | Accepted |
| [5](docs/adr/0005-demo-audio.md) | Guided transcript replay is the main demo path; live mic is an optional extra | Accepted |
| [6](docs/adr/0006-risk-engine.md) | Code, not the model, turns flags into actions | Accepted |
| [7](docs/adr/0007-scope.md) | Malay and Manglish first; five must-have features; the rest is should-have or stretch | Accepted |
| [8](docs/adr/0008-google-stack.md) | Everything runs on Google Cloud and Firebase except the Jev scorer | Accepted |

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

## Set up your machine

We share one Google Cloud project, `psyched-cab-511515-q0` ("Google AI Builder Cup"). Ilham owns it; ask him to add your Google account before you start. The Editor role can be granted from the command line, while Owner has to be an invitation from the console's IAM page.

Install the two command-line tools (macOS, Homebrew):

```bash
brew install --cask gcloud-cli
brew install firebase-cli
```

`firebase-cli` brings its own newer Node. If `node -v` no longer says 22 afterwards, run `brew unlink node`.

Sign in and point everything at the project:

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project psyched-cab-511515-q0
gcloud auth application-default set-quota-project psyched-cab-511515-q0
firebase login
```

Check that Gemini on Vertex AI answers. This should print a JSON reply with a `candidates` field:

```bash
curl -s -X POST \
  "https://asia-southeast1-aiplatform.googleapis.com/v1/projects/psyched-cab-511515-q0/locations/asia-southeast1/publishers/google/models/gemini-2.5-flash-lite:generateContent" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"role":"user","parts":[{"text":"Reply with the single word: ok"}]}]}'
```

Where things run:

| Service | Location | Why |
| --- | --- | --- |
| Firestore (native mode), Cloud Run, Gemini on Vertex AI | `asia-southeast1` (Singapore) | Closest region to Malaysia. The Firestore location cannot be changed. |
| Speech-to-Text Chirp 3 | `us` or `eu` multi-region | Chirp 3 is not offered in `asia-southeast1`. |
| Gemini text-to-speech | `global` | The current preview models are only served from the global endpoint. |

## Next up

The work from here to submission is tracked as [GitHub issues](https://github.com/shinegun/scamshield-my/issues), grouped into three milestones:

| Milestone | Date | Means |
| --- | --- | --- |
| M1: Replay works locally | Thu 15 Oct | A scripted call runs end to end on a laptop: transcript, risk, warnings, hold |
| M2: Live and judge-ready | Sat 17 Oct | Deployed on Cloud Run and Firebase Hosting, dashboard live, repo public. Feature freeze |
| M3: Submitted | Sun 18 Oct, 8 PM | Video, deck, description and links submitted |

How we use them:

- Assign yourself when you start an issue, and only then. One issue each at a time.
- Do `must` issues before `should` issues.
- Work on a branch and open a pull request; the other person merges it.

## Blocked on

- **Billing on the Google Cloud project** (Ilham): the project `psyched-cab-511515-q0` exists with Firestore created in `asia-southeast1` and the Vertex AI, Firestore and Firebase Hosting APIs enabled, but no open billing account is linked. A billing account named "Maybank" was created and shows as closed; its payment method needs fixing in the console before it can be reopened and linked. Until then Gemini calls return `BILLING_DISABLED` and the Speech-to-Text, Secret Manager, Cloud Run, Cloud Build and Artifact Registry APIs cannot be enabled. This blocks the Gemini scorer as well as the deploy.
- **Firebase not yet added to the project** (Ilham): `firebase projects:addfirebase` returns 403 for the project owner. Add it from the [Firebase console](https://console.firebase.google.com) instead ("Add project", pick the existing Google Cloud project, accept the terms).
- **Aqil's access and machine** (Ilham, then Aqil): Aqil's Google account is not on the project yet. Once added, Aqil follows "Set up your machine". Issue 1 is done when the Gemini check there works on both machines.
- **Jev docs URL** (Aqil): needed for the Jev scorer's request and response shapes. Cutoff is end of Thursday 15 October (ADR 2).
