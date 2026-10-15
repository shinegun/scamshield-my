# Handoff: finalizing the submission

For the next session, from the end of Thursday 15 October 2026. The build is finished; what's left is getting the repo public and making the submission material. Read this first, then `CLAUDE.md`. The full log of how we got here is in [2026-10-15.md](2026-10-15.md); you shouldn't need it.

**Deadline:** submit by **8 PM Sunday 18 October** Malaysia time (the form closes about 2:29 AM Monday 19 October; confirm on the hackathon dashboard). Feature freeze is **Saturday 17 October**.

**Who does what.** Aqil is away until submission. Ilham owns everything else and has asked Claude to open, review and merge PRs (one `gh` command per step; auto mode blocks chained push+approve+merge) and to own deploys. Use the `orchestrator` skill for multi-step work.

## Where things stand

| Thing | State |
| --- | --- |
| Live link | https://scamshield-my-511604.web.app — bank app with three scripted calls, `/dashboard`, `/race` |
| Pipeline | Cloud Run `pipeline`, `asia-southeast1`, revision `pipeline-00007-st2`, mode `on` (one warm instance) |
| Code | `main` is green: 173 tests and typecheck. All M1 and M2 code issues closed; issue 24 (live mic) cut on purpose |
| Secret scan | gitleaks 8.30.1 over the full history and the working tree: 0 findings; no real `.env` was ever committed |
| README | Opens with a judge-facing section: try it, how it uses Gemini / Cloud Run / Firestore / Firebase, how it decides |
| Open issues | 25 (repo public), 26–31 (M3: script, rough cut, final video, deck, description, submit) |

What the demo shows, all checked live on 15 October:
- **Malay and Manglish scam calls:** soft banner, then a full-screen warning that is spoken aloud, then "Transfers held". A transfer to the "safe account" is held with an explanation in the call's language.
- **Innocent call:** peaks at 26% risk with no warning.
- **Dashboard:** the call appears live, with the risk chart, flags, stage, scam type ("Fake police") and the held transfer, within about a second.
- **Race panel:** Malay money-request chunk, 5 runs. Jev median **235 ms** (225–253), Gemini median **895 ms** (802 ms–1.5 s), 5/5 answered each. Jev is about 4x faster.
- **Health check:** connect 152 ms, Jev about 222 ms per line, scam held, innocent quiet.

## Blocker: the repo must be public (issue 25)

`shinegun/scamshield-my` is private. Ilham has push but not admin, so **only Aqil can make it public** (Settings → General → Danger zone → Change visibility) or give Ilham admin. The rules ask for a "GitHub Public Repository". Do it by Saturday.

**Fallback if Aqil can't by Saturday:** create a public repo on Ilham's account and push `main` there with history (`git push <new-remote> main`). The secret scan covered the full history, so this is safe. Then use that link in the deck and the form, and update the links in `README.md`.

## What's left, in order

| When | Task | Issue | Who | Notes |
| --- | --- | --- | --- | --- |
| Fri | Video script | 26 | Claude drafts in `docs/video-script.md`, Ilham reads it against a stopwatch | 3:00–3:20. The issue has the structure: real story 25 s, Manglish scam uncut ending on the held transfer 80 s, innocent call 20 s, dashboard 25 s, architecture and latency 25 s, pitch line 20 s |
| Fri | Brief description | 30 | Claude drafts in `docs/submission-description.md` | One concrete sentence each for Firebase, Firestore, Cloud Run and Gemini; name Jev as the one outside model. Facts are in the README's "How it uses Google Cloud" |
| Fri | Deck content | 29 | Claude drafts slide text and diagrams in `docs/`; Ilham fills the organisers' template | The template is mandatory. Slides: team, idea, USP, features, process flow, architecture, technologies, snapshots, benchmarking (the race numbers above), future work, links. Architecture and technologies must show Firebase, Firestore, Cloud Run and Gemini |
| Fri | Listen to the spoken warning on a phone | — | Ilham | Audio delivery was checked; nobody has listened yet. Play the Malay scam on a phone with sound on |
| Sat | Repo public | 25 | Aqil (or the fallback above) | Then open it in a logged-out browser |
| Sat | Rough cut from the live link, URL visible | 27 | Ilham | Use the pre-recording checklist below |
| Sun | Final video with English subtitles, unlisted YouTube, link added to README | 28 | Ilham; Claude adds the link | Length 3:00–3:20 |
| Sun | Final check and submit by 8 PM | 31 | Ilham | Use the submission checklist below; save the confirmation |

### Before recording

1. `services/pipeline/power.sh on` (it's `on` now; check with `status`).
2. `pnpm health` → exit 0.
3. Delete the test session `tmp-firestore-check` from Firestore (Firebase console → Firestore → `sessions`) so it isn't on the dashboard in the video. Old test calls (`audio-probe`, health-check runs) can be deleted too.
4. Bank app and dashboard side by side in two windows; play at 1x for the recording.
5. Sound on, so the spoken warning is recorded.

### Before submitting

1. `power.sh on`, `pnpm health` → exit 0. Leave the pipeline `on` until results are announced.
2. Open each in a logged-out browser: live link, repo, video, and the deck's last-slide links.
3. Deck exported as PPTX on the organisers' template.
4. Description names all four technologies.

## Decisions not to remake

- **Guided replay is the demo; live mic is cut** (ADR 5, issue 24 closed): judges press Play, and replay runs the same scoring, warnings and hold.
- **The model never picks the action** (ADR 6); thresholds are tuned against the scripted calls. Don't retune before submission.
- **Spoken warnings use fixed lines**, recorded with Gemini 2.5 Flash TTS (Cloud Text-to-Speech, voice Kore). Speaking Gemini's warning text live would take 5–6 s.
- **The scam type shown is the call's dominant type** (most ticks), so the warning and the hold screen agree.

## Gotchas

- **The `gcloud` default project on Ilham's machine is the old `psyched-cab-511515-q0`.** Always pass `--project scamshield-my-511604`, or set it with `gcloud config set project scamshield-my-511604`.
- **No Jev key locally** (no `.env`). Production reads it from Secret Manager; local pipeline runs score with Gemini alone.
- **Cloud Run throttles CPU outside requests.** The spoken clips are recorded at boot (helped by `--cpu-boost`) and again on any call start if missing. After a deploy, check that warnings carry audio, or look for `spoken warning ...: ok` in the Cloud Run logs.
- **Cost:** `on` keeps one instance warm, which will pass the RM10/month budget alert. That's expected for judging. `power.sh idle` saves money until recording; switch back with `on` before recording and leave it on.
- **Deploys:** `services/pipeline/deploy.sh` (leaves the pipeline `on`), then `apps/web/deploy.sh`, then `pnpm health`. Firestore rules deploy with `firebase deploy --only firestore:rules --project scamshield-my-511604`.

## Optional, only if time is spare

- Make `pnpm test` and `pnpm typecheck` cover `scripts/` (health-check tests currently run with `services/pipeline/node_modules/.bin/vitest run scripts`).
- A language toggle on the dashboard.
- The health check's "off" (403) path has never been tested against a switched-off service.
