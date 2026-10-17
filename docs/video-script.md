# Video script

Target length is 3:00–3:20 (issue 26). The voiceover is about 420 words, plus about 10 s while the warning speaks, so read it at a calm pace, about 150 words a minute. Read it against a stopwatch before recording, and cut lines marked *(cut if long)* first.

Record from the live link (https://scamshield-my-511604.web.app) in a 1440×768 or larger browser window, with the address bar visible and sound on. Use 2× replay for the scam call: it still runs about 70 s, and it keeps the spoken warning audible. Run the "Before recording" checklist in `docs/handoff/handoff.md` first.

Add English subtitles for everything, including the Malay spoken warning.

To have an agent cut the video from your voiceover recording, see [`tools/video/BRIEF.md`](../tools/video/BRIEF.md).

---

## 0:00–0:25 · The real story (25 s)

**On screen:** black, then a short line of text per beat, then a newspaper headline screenshot with the source visible.

> **Verify before recording.** The case below is from The Sun ([source](https://thesun.my/local-news/retired-civil-servant-loses-rm276900-to-scammers-AN12866017)); the page doesn't make the year clear, so check it and say it only if confirmed. If it can't be confirmed, use the dated alternative: a retired bank manager in Johor Baru who lost RM936,000 in May 2026 to callers posing as a police officer and a deputy public prosecutor ([NST](https://www.nst.com.my/amp/news/regional/2026/05/1444000/retired-bank-manager-loses-rm936000-macau-scam)).

**Voiceover:**

> A retired civil servant in Pahang gets a call from "MCMC". Her number, they say, was used for money laundering. They put her through to a police officer. He tells her not to hang up, and not to tell anyone. By the end, RM276,900 of her savings is gone.
>
> Every step of that call is a warning sign. Nobody was listening for them.

## 0:25–1:45 · The scam call, uncut (80 s)

**On screen:** the live link. The front door is on screen with the phone ringing. Set 2×, then click **Accept** on the ringing Manglish call. Let the call play without cutting.

**Voiceover**, spoken over the call. Keep it sparse so the call itself can be heard:

> This is ScamShield. It listens to the call, in Malay or Manglish, and checks every line for thirteen warning signs.
>
> *(as "Claims to be police" appears under a caller line)* The caller says he's from MCMC, then hands over to "Inspector Vijay". ScamShield marks each sign as it hears it.
>
> *(as the notification card appears)* A quiet notice first: possible scam.
>
> *(pointing to the right panel)* On the right is what ScamShield hears: the risk, the stage of the scam, and every signal so far. Each line is scored in about a quarter of a second.
>
> *(as the red alert appears and is read aloud; pause the voiceover and let the warning speak)*
>
> *(after it)* When the caller asks for money, the warning is read aloud, and transfers are paused.
>
> *(click Continue call → Open bank app → "Akaun selamat Bank Negara" → RM 5,000 → Send transfer)* So let's do what the scammer says and move the money to the "safe account".
>
> *(hold on "Transfer paused")* The bank doesn't send it, and it explains why in plain words.

## 1:45–2:05 · The innocent call (20 s)

**On screen:** End the scam call. Hold the summary for a beat ("RM5k kept safe"), then **Try another call**, then **Play** the bank card check, then Accept. Speed through with a cut once the call is clearly calm, and end on the calm summary.

**Voiceover:**

> *(on the scam summary)* After the call, a summary: what happened and when, and what was kept safe.
>
> A real bank calling about your card is a different call. ScamShield listens the whole time and stays quiet. No warnings, nothing paused. That matters as much as catching the scam.

## 2:05–2:30 · The bank's fraud desk (25 s)

**On screen:** `/dashboard` in a second window, side by side with the phone, while a scam call plays. Show the call appearing in the list, the risk chart rising, the held transfer.

**Voiceover:**

> The bank sees the same call live, on its fraud desk: the risk over time, the signs heard, and the held transfer, so a person can call the customer while it's still happening.
>
> *(cut if long)* This is written to Firestore as the call happens and read with realtime listeners. No transcripts or names are stored.

## 2:30–2:55 · How it's built (25 s)

**On screen:** the architecture slide from the deck, then `/race` with **Run 5 times** finishing.

**Voiceover:**

> The call streams to a pipeline on Cloud Run. Each line goes to Jev, a fast decision model, with Gemini on Vertex AI taking over if Jev is slow. Gemini also writes the warning in the caller's language and speaks it.
>
> The model only answers questions. Our own code decides when to warn and when to hold, so the decision is always explainable.
>
> *(on /race)* On the same line of a Malay scam call, Jev answers in 235 milliseconds and Gemini in 895.

## 2:55–3:15 · The pitch (20 s)

**On screen:** back to the "Transfer paused" screen, then the title card with the live link and the repo link.

**Voiceover:**

> Phones can already tell you a call might be a scam. ScamShield stops the money leaving.
>
> Next: real calls on Android, more languages and dialects, and a direct line into the bank's own transfer system.
>
> ScamShield MY. Try it yourself at the link below.

---

## Shot list

| # | Time | Shot | Notes |
| --- | --- | --- | --- |
| 1 | 0:00 | Text cards + headline screenshot | Source visible on the headline |
| 2 | 0:25 | Front door → Accept Manglish call, 2× | One take, no cuts until the hold |
| 3 | ~1:05 | Critical alert read aloud | Let the audio play, then subtitle it |
| 4 | ~1:25 | Continue call → bank → RM 5,000 → paused | Hold 2 s on "Transfer paused" |
| 5 | 1:45 | Summary → innocent call → calm summary | Cut allowed mid-call |
| 6 | 2:05 | Dashboard and phone side by side | Second window; start a fresh scam call |
| 7 | 2:30 | Architecture slide → `/race`, Run 5 times | Numbers must be the real run |
| 8 | 2:55 | Hold screen → title card | Live link + repo link on screen |
