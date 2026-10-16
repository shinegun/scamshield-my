# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ScamShield MY: a hackathon prototype (two people, submission closes about 2:29 AM on 19 October 2026 Malaysia time; we aim for the evening of 18 October) that listens to a phone call, warns the user in their language as scam signals build up, and holds bank transfers before money leaves. The one hard rule is that the prototype must run on Google Cloud.

Most of the repo is not built yet. `packages/shared` is the only package with code; `services/pipeline` and `apps/web` are empty placeholders. README.md tracks what exists and what is blocked — keep its "What exists" section current when that changes. The remaining work is tracked as GitHub issues under three milestones; check `gh issue list` before starting something, and assign the issue to whoever is working on it.

## How we work

For any task with more than one step or more than a couple of files, use the `orchestrator` skill: one conversation, cheap layers first (`grep`, `git`, `gh`), the advisor at three set moments, and at most two read-only helpers for large reads. The main session makes the changes. One-file edits and quick questions are done inline.

## Commands

Node 22, pnpm 11 workspace (`packages/*`, `services/*`, `apps/*`).

```bash
pnpm install
pnpm test          # vitest in every package
pnpm typecheck     # tsc in every package
```

Single test file or test name:

```bash
pnpm --filter @scamshield/shared exec vitest run src/risk.test.ts
pnpm --filter @scamshield/shared exec vitest run -t "floors"
```

There is no build step and no linter. `tsconfig.base.json` sets `noEmit`; `@scamshield/shared` is consumed as TypeScript source (`main` points at `src/index.ts`), so new packages need a bundler or runtime that handles TS directly. `noUncheckedIndexedAccess` is on.

## Architecture

```
Bank app (web, phone-styled)  ──WebSocket──▶  Pipeline (Cloud Run)
  Firebase Hosting
                                               ├─ speech-to-text (Chirp 3, ADR 4)
                                               ├─ scorer: Jev, Gemini on Vertex AI as fallback
                                               ├─ risk engine (packages/shared)
                                               └─ warning writer + text-to-speech (Gemini on Vertex AI)
Fraud dashboard (web)  ◀──realtime──  Firestore  ◀── sessions, risk history, holds
```

`packages/shared` is the contract every other part is built against:

- `schema.ts` — what the scorer is asked and what it returns. `RED_FLAGS` holds the 13 questions (sent to the model verbatim) and their weights; `SCAM_STAGES` is ordered and that order is load-bearing. A scorer takes a `CallState` and returns a `Decision`. Jev and Gemini must answer this exact schema so either can sit behind the same interface.
- `risk.ts` — turns `Decision`s into an `Action`. `absorb` folds each tick into `SessionRisk` (per-flag peak, furthest stage), `combinedRisk` is a noisy-OR over weighted flags, `decideAction` applies thresholds and then floors.
- `events.ts` — `ClientMessage` / `ServerMessage` JSON over the call WebSocket. Audio travels as binary frames on the same socket.

### Rules that come from the ADRs

`docs/adr/` records the decisions. Where the original hackathon plan and the ADRs disagree, the ADRs win. The ones that constrain code:

- **The model never picks an action (ADR 6).** Scorers return flags, stage and type only; every action comes from `risk.ts`. The same module is meant to run in both the pipeline and the web app so they always agree.
- **Session memory is monotonic (ADR 6).** Flags keep their peak and the stage never moves backwards. A false-positive tick therefore sticks for the whole call; decay is the noted remedy if that shows up in testing.
- **Weights and thresholds are hand-tuned against one reference call.** The "MCMC-to-police call" test in `risk.test.ts` asserts the expected action at each stage. Any change to a weight, threshold or floor should keep that test passing or update it deliberately.
- **Scorer and speech-to-text each sit behind an interface (ADR 2, ADR 4).** Build against Gemini first; the Jev scorer is blocked on its docs. Speech-to-text is Chirp 3, with Gemini audio chunks as the fallback.
- **Guided replay is the main demo path (ADR 5).** Judges open the deployed link themselves, so the web app opens on scripted calls (Malay scam, Manglish scam, innocent) and sends their lines as `transcript.inject`, skipping speech-to-text. The scripts live in `packages/shared`. Live mic is an optional extra and the first thing cut. `clock.skip` fast-forwards the call timer to show the long-call floor.
- **Everything runs on Google Cloud and Firebase except Jev (ADR 8, supersedes ADR 1).** The submission rules require Firebase, Firestore, Cloud Run and Gemini. One Cloud Run instance holds live call state in memory; Firestore holds sessions, risk history and holds, and the dashboard reads it through realtime listeners; Firebase Hosting serves the web app. Gemini is called through Vertex AI with the service account, never an API key. No Supabase, Cloudflare, BigQuery or Cloud SQL; Pub/Sub is stretch.
- **The bank app, caller simulator and fraud dashboard are one React web codebase (ADR 3).** Call detection is simulated; there is no native app.
- **Scope (ADR 7).** Standard Malay and Manglish are the must-have languages. Other languages, Malay dialects and an Android wrapper are stretch and cut first.

New architectural decisions get a numbered ADR in `docs/adr/` in the existing format (Status, Date, Context, Decision, Alternatives considered, Consequences) and a row in the README's decisions table.
