# Brief: edit the ScamShield MY demo video

To start, open a new Claude Code session in this repo and paste:

> Read `tools/video/BRIEF.md` and make the submission video. The voiceover is at `<path to recording>`.

Everything below is for the editing agent.

---

You are editing the hackathon demo video for ScamShield MY. The script is [`docs/video-script.md`](../../docs/video-script.md). The person who wrote it has recorded the voiceover. You capture the footage from the live app, cut it to the voiceover, add captions and render an MP4. Change no app code. This is an editing job, so the repo's orchestrator skill and test checks don't apply.

**Done means:** `tools/video/out/build/final.mp4`, rendered with `--final`, 3:00 to 3:20 long (the hard limits are 3 to 4 minutes), every section of the script on screen in order, every frame and caption checked by you, plus a short report to the user (step 9).

## What you can and cannot perceive

You cannot watch video or hear audio. Each source is turned into something you can read:

| Source | What you read |
| --- | --- |
| Voiceover | `out/vo/transcript.md`: sentences with start and end seconds, and the pauses between them |
| A recorded shot | `out/shots/<shot>/timeline.md`: every call line, risk change, new signal, warning, spoken-warning clip and click, with its second in the video |
| Any video, including your render | Still frames you pull with `pnpm frames` and open with Read |

So **place by events, check with frames.** Every claim you make about what is on screen at a moment must come from a timeline row or a frame you looked at.

## Tools

Run these from `tools/video/`. Every path inside an EDL or given to a command is relative to `tools/video/out/`.

| Command | Does |
| --- | --- |
| `pnpm transcribe <file>` | Voiceover → `vo/voiceover.wav`, `vo/words.json`, `vo/transcript.md`. Runs locally with whisper.cpp in about 20 s |
| `pnpm capture <shot…\|all>` | Records shots against the live link → `shots/<shot>/video.webm`, `events.json`, `timeline.md`, `warning-N.mp3` |
| `pnpm card <name> --text "…" [--sub "…"] [--theme dark\|light]` | 1920×1080 text card → `cards/<name>.png` |
| `pnpm card <name> --html <file>` | Your own 1920×1080 HTML page → `cards/<name>.png` |
| `pnpm card <name> --url <url> [--wait 3] [--scroll 400]` | Screenshot of a web page → `cards/<name>.png` |
| `pnpm frames <video> <t1,t2,…\|--every N> [--sheet]` | Frames, 1280 wide, into `frames/`. `--sheet` tiles them into one labelled image, which is the cheap way to look |
| `pnpm render --plan` | Checks `edl.json` and writes `build/plan.md` (the timeline of every segment, audio clip and caption) without rendering |
| `pnpm render` | Draft render → `build/final.mp4`, `build/captions.srt`. About 10 s per minute of video; segments are cached |
| `pnpm render --final` | Same, at final quality |

Setup, if a command complains: `pnpm install` at the repo root, then `brew install whisper-cpp`, then download the model with `curl -L -o tools/video/models/ggml-small.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin`.

## The shots

`pnpm capture all` records four takes against https://scamshield-my-511604.web.app, at 1920×1080 and 2× replay. That takes about four minutes. Warning texts are written by Gemini on each run and timings shift by a second or so, so **always work from the timeline.md of the take you are using**, never from times in this brief.

| Shot | What it shows | Script section |
| --- | --- | --- |
| `scam` | Front door (phone ringing), 2×, accept the Manglish "MCMC" call, signals building, soft notice, strong warning with spoken audio (about 11 s), hold warning, Continue call, bank app, RM 5,000 to "Bank Negara safe account", **Transfer paused** held 5 s, then end the call and hold the summary ("RM5k kept safe") 6 s | 0:25–1:45, start of 1:45 |
| `innocent` | Front door, accept the innocent "Bank card check" call, no warnings, end the call, calm summary held 6 s | 1:45–2:05 |
| `desk` | Phone (left, 560 px) and fraud desk (right) side by side on a fresh scam call: the call appears in the list, the risk chart rises, then the held transfer appears | 2:05–2:30 |
| `race` | `/race`, "Run 5 times", Jev vs Gemini latencies, held 5 s | 2:30–2:55 |

The recordings have **no sound**. The only sound in the app is the spoken warning, saved as `warning-N.mp3` with its start time (the AUDIO row in timeline.md). Place it in the EDL at that moment.

The shots are 1920×1080 with no browser chrome, so the address bar the script mentions is not visible. Show the live link on the title card instead, and optionally as a caption when the demo first appears.

Cards you make yourself: the intro beats and headline (0:00–0:25), an architecture card (2:30), and the title card (2:55). See the script for each.

## The EDL

You express the edit as `out/edl.json`. `tools/video/edl.example.json` is a worked example that renders. The types and their comments are in `src/timeline.ts`.

- **segments** play back to back. A video segment has `source`, `in`, `out` (source seconds) and optionally `speed`, `hold` (freeze the last frame for N seconds), `crop` (16:9 rectangle in source pixels, to punch in), `fadeIn` and `fadeOut`. A still has `source` and `duration`.
- **audio** clips are placed by an anchor: `"at": <output second>`, or `"segment": "<id>", "t": <second in that segment's source>`. **Use segment anchors** for anything tied to the picture: the clip then stays with its moment when you re-trim. `"source": "vo"` means the voiceover, with `in` and `out` taken from transcript.md.
- **captions**: voiceover clips are captioned automatically from the transcript. Add `captions` entries for anything else spoken, such as the warning. Fix whisper's spelling with `captionFixes` (for example `{"Jeff": "Jev"}`); check the transcript against the script to find them. Set `"caption": false` on a voiceover clip only when a card already shows the same words.

## Editing rules

1. **Follow the script's order and section timings.** The voiceover is the spine. Lay out the voiceover first, then fit the picture under it.
2. **A line about something on screen starts when that thing is visible.** "As 'Claims to be police' appears" means the RISK row whose new signals include `claims_authority`. Place the clip 0.3 to 1.0 s after the event with a segment anchor.
3. **Never talk over the spoken warning.** Leave the voiceover silent for the whole `warning-N.mp3`, as the script says. Caption the warning with its text from the WARNING row, prefixed `Spoken warning:`. If the warning is in Malay, write an English translation and say so: `Spoken warning (translated): …`.
4. **The scam call stays uncut** from Accept to "Transfer paused" (script shot 2), at the recorded 2×. Don't speed it up further. If the voiceover runs long there, tighten the pauses between voiceover clips first. After that, use `hold` on a meaningful frame.
5. **Never speed up, slow down or reorder words within the voiceover.** You may drop retakes, fluffs and long pauses, cutting only at pauses. When a sentence appears twice, the speaker re-read it, so keep the last complete take. Leave 0.2 to 0.4 s of air between clips.
6. **Numbers you say must match numbers you show.** The race voiceover quotes milliseconds; compare them with the RACE rows and the frame. If they differ, don't edit the audio. Tell the user and offer: re-record that one sentence, or caption the on-screen figures and cut the numbers out of the voiceover.
7. **Facts in the intro come only from the script.** The script asks for the case's year to be verified before it is said. If the source page doesn't make the year clear, leave it out and tell the user. Show the headline screenshot with the source visible (`pnpm card headline --url …`), and check the frame for cookie banners.
8. **Punch in where the UI is small.** The desktop layout puts the phone at roughly x 75–465, y 84–864 of 1920×1080. Crop on the phone for the notification card, the red alert, "Transfer paused" and the summary. Frames come out 1280 wide, so multiply frame coordinates by 1.5.
9. **Cut on events.** Prefer cuts just after a click or just before a new screen, and never mid-animation (check the frame 0.2 s either side).

## Workflow

1. Transcribe the voiceover and read `vo/transcript.md`. Map every script paragraph to a time range. List any paragraph that is missing or fluffed beyond use.
2. `pnpm capture all`, then read every `timeline.md`. Pull `pnpm frames shots/<shot>/video.webm --every 4 --sheet` for each and look.
3. If a shot failed or shows an error state (the app is down, or there is an ERROR row), re-run that shot once. If it fails again, stop and report.
4. Make the cards.
5. Write `edl.json` section by section and run `pnpm render --plan` after each section. Fix every reported problem, then read `build/plan.md`: is the total 3:00 to 3:20, and does each section land near its script time?
6. `pnpm render`.
7. **Review your render. This step is not optional.** Pull frames from `build/final.mp4` at every segment boundary (−0.3 s and +0.3 s), at the start of every caption, at every warning clip, and at each moment a voiceover line refers to. Check that the picture matches the words, the captions are readable and not covering what the line is about, and there are no black or frozen frames you didn't intend. Then fix and render again.
8. `pnpm render --final`.
9. Report to the user in a few lines: the path, the length, anything cut or changed from the script and why, and every open question (rule 6, rule 7, missing lines). Don't call it done while a question is open; name it.

## When to stop and ask

- The voiceover is missing a section, or a key line is unusable.
- The live app fails a capture twice.
- After tightening, the cut can't fit 3:00 to 4:00 without breaking rule 4.
- Rule 6 or rule 7 applies.
