# UI plan: Native restyle

The ordered task list for restyling the web app to the Native design in [README.md](README.md). Work through it top to bottom, one pull request per task. Feature freeze is **Saturday 17 October 2026**, and the video is recorded from the live link that day, so tasks 1–7 must be merged by Friday night. Tasks 8–11 are cut in reverse order if time runs out.

## How to work

- **Use the `orchestrator` skill.** The main session plans each task, writes the briefs and reviews the diff. Sonnet subagents build the React screens from the mockup files. Haiku runs commands and searches. Do not ask a subagent to "make it look nice": give it the mockup file path and the tokens table.
- **One branch and one PR per task**, against `main`, named `ui/<task-number>-<slug>`. Do not merge or deploy. Ilham's local session reviews, merges, deploys and runs `pnpm health`. Open each PR as soon as its task is done, then start the next task from `main`. If the next task needs the previous one first, branch from it and say so in the PR.
- **Every PR must pass** `pnpm test`, `pnpm typecheck` and `pnpm --filter @scamshield/web build`. New pure logic (anything that derives data from `CallState`) lives in a `.ts` file with a vitest test next to it, like `warningView.ts` / `warningView.test.ts`.
- **Do not change** `packages/shared`, `services/pipeline`, risk weights, thresholds, floors or the scripted calls. If a screen needs data the messages don't carry, stop and say so in the PR rather than changing the contract.
- **The UI never decides an action (ADR 6).** Colours and warnings come from `risk.action`. Never compare `risk.risk` against a number.
- **Keep what works.** The replay player, `clock.skip`, speed toggle, spoken warnings (`speak.ts`), the bank state machine and the Firestore listeners keep their behaviour and tests. Restyle and recompose. Rewrite only where a task says so.
- **Check it in a browser if you can.** Run `pnpm --filter @scamshield/web dev`, play the Manglish scam at 2×, and check widths of 375 px and 1440 px. If you can't run a browser, say so in the PR.
- **PR description:** what changed, the mockup file it follows, check results, and anything you weren't sure about. Keep it short.

## Tasks

### 1. Tokens and base styles
Replace the variables in `apps/web/src/styles/global.css` with the token table from the README: dark phone tokens, light page tokens and the risk colours. Rename variables by role (`--surface-grouped`, `--text-secondary`, `--risk-soft`, …) and update every CSS file that uses the old names. The visual change is limited to colours. Layout stays as it is.
**Done when** the app looks the same apart from colours, and no old variable names are left (`grep` for them).

### 2. Call screen
Restyle `call/CallScreen.tsx`, `TranscriptView.tsx` and `RiskMeter.tsx` to `native/call.dc.html`:
- the number and timer centred
- the transcript as captions, with the newest caller line large and older lines faded
- the round call controls, with End in red
- the risk number moves out of the phone (it goes to the desktop panel in task 3); on a narrow screen a small one-line status may stay

Add **signal labels** under caller lines. Write `call/signals.ts`: given `riskHistory` and `transcript`, return for each caller line the flags whose score first reached 0.5 at the tick after that line. That is `FLAG_SEEN_AT` in `risk.ts`, which isn't exported, so copy the value and add a comment pointing to it. Test it. Put the plain-word labels for the 13 flags next to `labels.ts`.

### 3. Desktop live call
At 1100 px and wider, `/` becomes the two-column layout in `native/desktop-live-call.dc.html`: the phone in a plain frame on the left, and the "What ScamShield hears" panel on the right. The panel shows:
- risk percent coloured by action
- scorer and latency from the last `risk` message
- likely scam type
- the six-step **stage track** from `SCAM_STAGE_KEYS` (without `none`), lit up to the current stage
- the risk-over-time chart (reuse or restyle `dashboard/RiskChart.tsx`), with lines where the action changed
- "Heard" and "Not yet" signal lists

Below 1100 px nothing changes: the phone only. Derive the panel's data in a tested `call/inspector.ts`.

### 4. Warnings
Restyle `warnings/WarningLayer.tsx`:
- `soft_warning` is the notification card at the top of the call screen (`native/call.dc.html`)
- `strong_warning` and `hold_transfers` show the critical alert in `native/warning.dc.html`: dimmed call behind it, red shield, title, the warning text, a "Reading this aloud" indicator while the audio plays, End Call and "Why am I seeing this?". "Why" lists the signals heard.

Keep `warningView.ts` and `speak.ts` behaviour. Respect `prefers-reduced-motion` for any animation.

### 5. Transfer held
Restyle the bank app (`bank/`) to the light iOS grouped style. The held state follows `native/hold.dc.html`: "Transfer paused", the amount large as still in Savings, the reason in plain words, and buttons for "Call Scam Response Centre (997)" and "Cancel Transfer". Keep `bankMachine.ts` and `explain.ts` logic. Wire the buttons only to actions that already exist; a button with no action is plain styling.

### 6. Call summary
When a call ends, show `native/summary.dc.html`:
- three numbers: peak risk, time of first warning, money kept (the held amount, or none)
- a "What happened" timeline built from `riskHistory` (stage changes), `warnings` and `transfers`, with times
- "Report to 997" and "Try another call"

Write `call/summary.ts` with tests. The innocent call must produce a calm summary: no warnings, nothing held.

### 7. Incoming call
Before a scripted call starts, show `native/incoming.dc.html` with the script's number, the "ScamShield will listen to this call" capsule, and Decline and Accept. Accept starts the replay exactly as Play does today; Decline goes back. This must not change replay timing or `clock.skip`. If the scripts have no caller number, use a fixed display number per script in the web app; don't add one to `packages/shared`.

### 8. Front door
The idle `/` follows `native/front-door.dc.html`. On desktop: the headline "Hears the scam. Holds the money.", one paragraph, the three calls as a grouped list with Play, and the ringing phone. On a phone: the same list inside the phone. Keep the speed toggle. Make the "Fraud desk" and "Jev vs Gemini" links easy to find.

### 9. Fraud desk
Restyle `/dashboard` to `native/fraud-desk.dc.html`:
- a three-pane layout: sidebar, call list, detail
- the held-transfer banner
- the risk chart
- signals and stages with times

Replace "Connecting…" on an empty screen with a proper empty state: "Play a call on the phone to see it here", with a link to `/`. Keep `useFirestore.ts` and `view.ts` and their tests. Below 900 px, stack the panes.

### 10. Race
Restyle `/race` to `native/race.dc.html`: a black keynote page with the headline built from the measured median, one bar per scorer for the median, dots for single runs, the range and answered count, and the chunk picker as pills. Keep `view.ts`. The headline must use the measured numbers, never hard-coded ones.

### 11. Final pass
- Check every screen at 375 px and 1440 px, with keyboard focus, contrast and reduced motion.
- Delete CSS that nothing uses any more.
- Update README.md's "What exists" section to describe the new screens.
- Add screenshots of the main screens to the PR.
