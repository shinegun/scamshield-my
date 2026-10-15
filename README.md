# ScamShield MY

ScamShield listens to a phone call, warns you in your own language as the signs of a scam build up, and holds your bank transfer before the money leaves. It is built for Malaysia's most common phone scams, where a fake MCMC officer hands the victim to a fake police inspector who asks for their savings to be moved to a "safe account". Built by Aqil and Ilham for the AI Builder Cup 2026 (BFSI track).

> Google tells you it might be a scam. We stop the money leaving.

## Try it

**https://scamshield-my-511604.web.app** works in any browser, on a phone or a laptop. It takes about two minutes:

1. Pick a scripted call: the Malay scam, the same scam in Manglish, or an innocent call from a bank. Use 2x to go faster.
2. Watch the risk bar and the scam stage move as the caller talks. A banner warns early; a full-screen warning (spoken aloud) follows when the call turns dangerous.
3. Press **Open bank app** and try to send money to the "safe account". The transfer is held, and the app explains why in plain words.
4. Open the **Fraud dashboard** (link at the bottom) in a second tab or window. The bank's fraud team sees the same call live: risk over time, the red flags raised, and the held transfer.
5. On the dashboard, **Jev vs Gemini** sends the same piece of a call to both scorers and compares their answers and response times.

The innocent call should stay quiet all the way through. That is the other half of the job.

**What is simulated:** the incoming call and the bank. Calls play from scripts (ADR 5) so anyone can try them without a phone line; the pipeline scores them exactly as it would a live transcript.

## How it uses Google Cloud

| Required | How ScamShield uses it |
| --- | --- |
| **Gemini** | Gemini 2.5 Flash on Vertex AI (Singapore) answers the 13 red-flag questions about each part of the call when the primary scorer is slow, and writes every warning in the caller's language (Malay or English). Gemini 2.5 Flash TTS, through Cloud Text-to-Speech, speaks the strong warning aloud. The service account calls Vertex AI; there is no API key. |
| **Cloud Run** | The pipeline: a WebSocket server that receives the call, scores it line by line, decides the action and answers the bank app's transfer requests. One always-on instance in `asia-southeast1` keeps each call's state in memory. Calls are capped at 5 at once and 5 minutes each. |
| **Firestore** | Every call is written as it happens: a session document, a risk entry per scoring tick and a record of each held transfer. The fraud dashboard reads them with realtime listeners. Security rules let anyone read this demo data and refuse every write from a browser; no transcript text, names or numbers are stored. |
| **Firebase** | Firebase Hosting serves the web app (bank app, dashboard and race panel); the dashboard uses the Firebase JS SDK, configured from Hosting at runtime. |

The primary scorer is Jev from TypeSafe, which answers the same 13 questions in about 230 ms; Gemini takes over if Jev doesn't answer within 800 ms (ADR 2). Everything else runs on Google Cloud (ADR 8).

## How it decides

- **The model never picks the action** (ADR 6). Scorers only answer yes/no-style questions ("did the caller tell you not to hang up?") and name the scam stage and type. Code in `packages/shared/src/risk.ts` combines the answers into a risk score and turns that into an action: none, soft warning, strong warning, or hold transfers. The same code runs in the pipeline and the web app.
- **A call's memory only goes up** (ADR 6). A red flag keeps its highest score and the stage never goes backwards, so a calm minute late in a scam call can't reset it.
- **Weights and thresholds are hand-tuned** against scripted calls modelled on reported Malaysian cases (drafted with ILMU, a Malaysian language model), and checked against an innocent bank call that must stay silent. `pnpm health` replays both against the live pipeline.

## Team notes

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
| `packages/shared/src/events.ts` | Done. WebSocket messages between the bank app and the pipeline, including transfer attempt, hold and release. |
| `packages/shared/src/store.ts` | Done. Firestore document shapes: session, risk entry per tick, transfer hold. |
| `packages/shared/src/scripts` | Done, 4 tests. The three replay calls, drafted with ILMU (`packages/shared/tools/draft-calls.ts`): Malay and Manglish scam calls of 142 s each (22 lines, line for line), and a 50 s innocent bank check. |
| `services/pipeline/src/scorers/jev.ts` | Done, 2 tests against a faked API. Run against the real Jev on 14 October: Malay as good as English, 227–364 ms per tick (ADR 2). |
| `services/pipeline/src/fixtures` | Done. Scripted scam call and normal calls, in Malay and English. |
| `services/pipeline/src/server.ts`, `session.ts` | Done, tested. WebSocket server on `/call`: session state, a scoring tick per injected line, `risk` messages, transfer hold and release, `clock.skip`. Reports the call's dominant scam type (most ticks), not the last one. |
| `services/pipeline/Dockerfile`, `deploy.sh` | Done. Builds with Cloud Build and deploys to Cloud Run (see "Deployed pipeline"). |
| `services/pipeline/src/warnings` | Done, tested. One warning per new action level, written by Gemini 2.5 Flash in Malay or English, with fixed fallback text if Gemini takes over 2.5 s. |
| `services/pipeline/src/warnings/speech.ts` | Done, tested. The strong and hold warnings are spoken: fixed lines per language recorded with Gemini 2.5 Flash TTS (Cloud Text-to-Speech, voice Kore) and sent as `audioUrl`. Recorded at boot and again on any call start while a clip is missing; the web app plays each new one once, with a Mute button. |
| `services/pipeline` race (`race.run`) and `apps/web/src/race` | Done, tested. `/race` sends one transcript chunk to Jev and Gemini at once and shows both answers and times; "Run 5 times" gives medians. 15 Oct, Malay money-request chunk: Jev 235 ms median, Gemini 895 ms (5/5 each). |
| `services/pipeline/src/scorers` | Done, tested. Jev, Gemini 2.5 Flash on Vertex AI, and the fallback wrapper (Jev first, Gemini after 800 ms). |
| `services/pipeline/src/store` | Done, tested. Writes each call to Firestore as it happens (session, a risk entry per tick, holds) in the `store.ts` shapes, without waiting on the writes. On when `K_SERVICE` (Cloud Run) or `STORE=firestore` is set; local runs write nothing. |
| `apps/web` | Done, 69 tests. Phone-styled bank app: pick a scripted call, live transcript and risk bar, a banner that follows the latest warning, full-screen warnings, transfer hold with a 10 s "this was really me" release. Labels and the hold screen are in Malay on Malay calls. Run with `pnpm --filter @scamshield/web dev` next to the pipeline. |
| `apps/web/src/dashboard` | Done, tested. Fraud dashboard at `/dashboard`: live call list, risk over time, flags, stage, type and holds, read from Firestore with realtime listeners. Firebase config comes from Hosting's `/__/firebase/init.json` (or `VITE_FIREBASE_*` locally, see `apps/web/.env.example`). |
| `firebase.json`, `apps/web/deploy.sh` | Done. Firebase Hosting for the web app (see "Live demo"). |
| `firestore.rules` | Done, deployed. Anyone can read `sessions/**`; every client write is refused. The pipeline writes through the Admin SDK. Deploy with `firebase deploy --only firestore:rules --project scamshield-my-511604`. |
| `scripts/health-check.ts` | Done. `pnpm health` plays the Manglish scam and the innocent call against the live pipeline: exit 0 when the scam is held and the innocent call isn't, 1 on a wrong result, 2 when unreachable or switched off. Run before recording and submitting. |

## Run it

Needs Node 22 and pnpm 11.

```bash
pnpm install
pnpm test
pnpm typecheck
```

## Set up your machine

We share one Google Cloud project, `scamshield-my-511604`. It is on Aqil's Google account and billing, and both of us are Owners. Firebase is added to it and Firestore has a `(default)` database. Anyone new needs to be added first; the Editor role can be granted from the command line, while Owner has to be an invitation from the console's IAM page.

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
gcloud config set project scamshield-my-511604
gcloud auth application-default set-quota-project scamshield-my-511604
firebase login
```

Check that Gemini on Vertex AI answers. This should print a JSON reply with a `candidates` field:

```bash
curl -s -X POST \
  "https://asia-southeast1-aiplatform.googleapis.com/v1/projects/scamshield-my-511604/locations/asia-southeast1/publishers/google/models/gemini-2.5-flash:generateContent" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"role":"user","parts":[{"text":"Reply with the single word: ok"}]}]}'
```

Where things run:

| Service | Location | Why |
| --- | --- | --- |
| Firestore (native mode, `(default)` database), Cloud Run | `asia-southeast1` (Singapore) | Closest region to Malaysia. The Firestore location cannot be changed. |
| Gemini 2.5 Flash on Vertex AI | `asia-southeast1` (Singapore) | Checked on 14 October: the only Gemini model we tried that answers here. |
| Gemini 2.5 Flash-Lite, 2.5 Pro, 3 Flash (preview), 3.1 Flash-Lite | `global` | Checked on 14 October: these return 404 in `asia-southeast1` but answer on the global endpoint. |
| Speech-to-Text Chirp 3 | `us` or `eu` multi-region | Chirp 3 is not offered in `asia-southeast1`. |
| Gemini text-to-speech | `global` | The current preview models are only served from the global endpoint. |

## Run the pipeline

```bash
pnpm --filter @scamshield/pipeline start
```

It listens on `PORT` (default 8080), WebSocket path `/call`. With `TYPESAFE_API_KEY` in `.env` it scores with Jev and falls back to Gemini; without it, Gemini alone. Gemini needs `gcloud auth application-default login` (see "Set up your machine"). `pnpm --filter @scamshield/pipeline try:gemini` plays the scripted calls through Gemini the way `try:jev` does for Jev.

## Live demo

**https://scamshield-my-511604.web.app** — the web app on Firebase Hosting, talking to the pipeline on Cloud Run. To publish a new version of the web app, from the repo root:

```bash
apps/web/deploy.sh
```

It reads the live pipeline URL from Cloud Run, builds the app against it and runs `firebase deploy --only hosting`.

## Deployed pipeline

The pipeline runs on Cloud Run in `asia-southeast1`: **https://pipeline-842845286251.asia-southeast1.run.app** (WebSocket `wss://pipeline-842845286251.asia-southeast1.run.app/call`). One instance, always on, because call state lives in memory (ADR 8). It runs as the `scamshield-pipeline` service account (Vertex AI and Firestore), and reads the Jev key from Secret Manager (`typesafe-api-key`).

To redeploy after a change, from the repo root:

```bash
services/pipeline/deploy.sh
```

To control cost, switch it between modes (`deploy.sh` always leaves it `on`):

```bash
services/pipeline/power.sh status
```

| Mode | When | Idle cost | Visitors |
| --- | --- | --- | --- |
| `on` | recording, judging, until results are announced | one warm instance | instant |
| `idle` | day to day | none | first call waits a few seconds for a cold start |
| `off` | nobody should use it | none | refused (403) |

Calls cost Jev and Gemini usage in any mode that accepts them; the caps (#18) bound that.

To run the local web app against it:

```bash
VITE_PIPELINE_URL=wss://pipeline-842845286251.asia-southeast1.run.app/call pnpm --filter @scamshield/web dev
```

## Try Jev

Copy `.env.example` to `.env`, set `TYPESAFE_API_KEY`, then:

```bash
pnpm --filter @scamshield/pipeline try:jev
```

It plays the scripted calls through Jev in English and in Malay and prints the stage, flags, risk and latency per line. The first run's results are in ADR 2.

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

- **Public repo** (Aqil): the repository is private and only its owner can make it public, which the submission needs. Ilham has push but not admin.
- **Old project to ignore or delete** (Ilham): `psyched-cab-511515-q0` ("Google AI Builder Cup") was set up on 14 October with Firestore and four APIs but never got billing. Nothing depends on it. It is still the default `gcloud` project on Ilham's machine, so pass `--project scamshield-my-511604`.
