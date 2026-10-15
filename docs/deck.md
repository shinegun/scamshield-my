# Deck text

Slide content for the organisers' template (issue 29). Paste each section into the matching slide. Keep the template's layout and only replace text and images. The architecture and technologies slides must show Firebase, Firestore, Cloud Run and Gemini. Items in [brackets] are for Ilham to fill in.

---

## 1. Team

- **Team name:** [team name as registered]
- **Aqil** [surname, role, institution or company]
- **Ilham Kassim** [role, institution or company]
- **Track:** BFSI: Intelligent Risk, Fraud & Financial Experiences

## 2. The idea

**ScamShield listens to the call, warns you as the scam builds, and holds the transfer before the money leaves.**

Malaysia's most common phone scam follows a script. A fake MCMC officer says your number was used for money laundering, then hands you to a fake police inspector, who tells you to stay on the line, keep it secret, and move your savings to a "safe account". Every step is a warning sign, and today nobody is listening for them.

ScamShield hears those steps in Malay or Manglish, warns the person in their own language, and tells the bank to pause any transfer while the call is still going.

## 3. How it's different (USP)

- **It stops the money, not just the call.** Phones can already flag a call as a possible scam. ScamShield is wired into the bank, so a transfer made during a scam call is paused and explained.
- **It's built for Malaysian scams in Malaysian languages:** Malay and Manglish first, and the scam stages that police reports describe.
- **The model never makes the decision.** It answers 13 yes/no questions. Our own risk engine turns those answers into an action, so every warning and every hold can be explained line by line.
- **It stays quiet on real calls.** A genuine bank call peaks at 26% risk and shows nothing.

## 4. Features

1. **Live call scoring:** each line of the call is checked against 13 warning signs and placed in one of six scam stages.
2. **Warnings that build up:** a quiet notice first, then a critical alert, read aloud in Malay or English.
3. **Transfer hold:** a transfer made during a scam call is paused, with the reason in plain words and a call button for the National Scam Response Centre (997).
4. **Call summary:** what happened and when, and how much was kept safe.
5. **Bank fraud desk:** the bank's team sees the same call live, with the risk over time, signals heard and held transfers.
6. **Scorer race:** the same line of a call goes to Jev and Gemini side by side, with their answers and times.

## 5. Process flow

```
Incoming call → ScamShield listens
      │
      ▼
Each line → scorer answers 13 questions (Jev, or Gemini if Jev is slow)
      │
      ▼
Risk engine (our code): combines answers, tracks the furthest scam stage
      │
      ├─ risk low ──────────▶ stay quiet
      ├─ soft warning ──────▶ quiet notice on the call screen
      ├─ strong warning ────▶ critical alert, written and spoken by Gemini
      └─ hold transfers ────▶ bank pauses any transfer and explains why
      │
      ▼
Every step written to Firestore → bank fraud desk updates live
      │
      ▼
Call ends → summary for the customer
```

## 6. Architecture

```
 Web app (phone + bank app + fraud desk)          Google Cloud
 served by Firebase Hosting                       ─────────────────────────────────────
 ┌───────────────────────┐   WebSocket   ┌───────────────────────────────────────────┐
 │ Phone: call, warnings │ ───────────▶  │ Pipeline on Cloud Run (asia-southeast1)   │
 │ Bank app: transfers   │ ◀───────────  │  ├ scorer: Jev → Gemini 2.5 Flash fallback │
 └───────────────────────┘   risk,       │  │   (Vertex AI, after 800 ms)             │
                             warnings,   │  ├ risk engine (shared TypeScript)         │
                             holds       │  ├ warning writer: Gemini 2.5 Flash        │
 ┌───────────────────────┐               │  └ spoken warning: Gemini 2.5 Flash TTS    │
 │ Fraud desk            │ ◀─ realtime ─ │         │                                 │
 │ (Firebase SDK)        │   listeners   │         ▼                                 │
 └───────────────────────┘               │ Firestore: sessions, risk per line, holds │
                                         └───────────────────────────────────────────┘
```

Draw this cleanly on the template. Use one colour for Google Cloud and Firebase boxes and a different one for Jev, the only outside service.

## 7. Technologies

| Technology | What it does in ScamShield |
| --- | --- |
| **Gemini 2.5 Flash** (Vertex AI) | Fallback scorer for the 13 questions; writes every warning in the caller's language |
| **Gemini 2.5 Flash TTS** (Cloud Text-to-Speech) | Speaks the strong warning aloud |
| **Cloud Run** | The pipeline: WebSocket server, scoring, risk engine, transfer holds |
| **Firestore** | Live record of each call: session, risk per line, holds |
| **Firebase Hosting + SDK** | Serves the web app; realtime listeners for the fraud desk |
| **Jev** (TypeSafe) | Primary scorer, about 4× faster than Gemini on our test line |
| React + Vite, TypeScript, Node 22 | Web app and pipeline, one shared risk engine for both |

## 8. Prototype snapshots

Screenshots from the live link at 1440×768 (take them after the restyle is final):

1. Front door: "Hears the scam. Holds the money." with the phone ringing
2. Live call: captions with signal labels, and the "What ScamShield hears" panel
3. Critical alert: "Transfers paused", reading aloud
4. Bank app: "Transfer paused", RM 5,000 still in Savings
5. Call summary: "100% · RM5k kept safe" with the timeline
6. Fraud desk with the live call and the held transfer

## 9. Performance and benchmarking

| Measure | Result |
| --- | --- |
| Jev, one line of a Malay scam call | **235 ms** median (225–253 ms), 5/5 answered |
| Gemini 2.5 Flash, same line | **895 ms** median (802 ms–1.5 s), 5/5 answered |
| Per-line scoring on the live pipeline | about 230 ms (health check, 15 Oct) |
| Manglish scam call | warned early, transfers held, peak risk 100% |
| Innocent bank call | peak risk 26%, no warning, nothing held |
| Fraud desk update | call appears within about a second |
| Tests | 197 automated tests across the risk engine, pipeline and web app |

Measured on the deployed system with `/race` ("Run 5 times") and `pnpm health`. Re-run both on the day and update the numbers if they move.

## 10. Future development

- **Real calls:** live audio through Chirp 3 speech-to-text (already designed in), then an Android call-screening app.
- **More languages:** Tamil, Mandarin, Cantonese and Malay dialects.
- **Bank integration:** an API for the bank's own transfer system, so holds apply to real transfers, plus a cooling-off period that the bank sets.
- **Reporting:** one tap to send the call summary to the National Scam Response Centre (997) and to check the account in CCID's Semak Mule.
- **Tuning on real data:** thresholds tuned per bank, and decaying false positives over a long call.

## 11. Links

- **Live prototype:** https://scamshield-my-511604.web.app
- **GitHub repository:** [public repo link: https://github.com/shinegun/scamshield-my once it's public, or the fallback repo]
- **Demo video:** [unlisted YouTube link]

Open all three in a logged-out browser before submitting.
