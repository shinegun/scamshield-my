# Native design

The web app is being restyled to the "Native" direction: ScamShield looks like a feature of the phone itself, in the style of iOS system UI and the in-call scam alerts phones already ship. Ilham picked it on 15 October 2026 from three directions mocked up on a Claude design canvas. The ordered build plan is [ui-plan.md](ui-plan.md).

## The mockups

`native/` holds one file per screen. Each is a self-contained HTML mockup with inline styles. The files load a canvas runtime (`support.js`) that is not in this repo, so read them as specs rather than opening them. Copy values such as sizes, colours and radii from them exactly.

| File | Screen | Where it goes |
| --- | --- | --- |
| `incoming.dc.html` | Incoming call, before the replay starts | `/`, phone |
| `call.dc.html` | In call: notification card, number, caption-style transcript, signal labels, call controls | `/`, phone (`call/`) |
| `warning.dc.html` | Strong warning as a critical alert over the call | `/`, phone (`warnings/`) |
| `hold.dc.html` | Bank app after the transfer is held | `/`, phone (`bank/`) |
| `summary.dc.html` | Call summary when the call ends | `/`, phone (new) |
| `front-door.dc.html` | Desktop front door: headline, the three calls, ringing phone | `/` at desktop width, idle |
| `desktop-live-call.dc.html` | Desktop during a call: phone left, "What ScamShield hears" panel right | `/` at desktop width, in call |
| `fraud-desk.dc.html` | Bank's fraud desk, three panes | `/dashboard` |
| `race.dc.html` | Jev vs Gemini, keynote style | `/race` |

## Tokens

The font is the system stack already in `global.css`: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif`. No webfonts.

The phone is dark. The desktop page, fraud desk and bank app are light. The race page is black.

| Role | Dark (phone, race) | Light (desktop, desk, bank) |
| --- | --- | --- |
| Background | `#000000` | `#F5F5F7` (desk content `#FFFFFF`, desk sidebar `#F2F2F7`) |
| Grouped surface | `#1C1C1E` | `#FFFFFF` |
| Round control fill | `rgba(120,120,128,.32)` | — |
| Text | `#FFFFFF` | `#1D1D1F` (bank `#000000`) |
| Secondary text | `rgba(235,235,245,.6)` | `#6E6E73` |
| Tertiary text | `rgba(235,235,245,.38)` | `#86868B` |
| Separator | `rgba(84,84,88,.6)` | `#E5E5EA` (bank `#C6C6C8`) |
| Action blue | `#0A84FF` | `#007AFF`, filled buttons `#0071E3`, links `#0066CC` |
| Soft warning (orange) | `#FF9F0A` | dots and bars `#FF9500`, text `#C93400` |
| Strong warning / hold (red) | `#FF453A`, end-call fill `#FF3B30` | dots and bars `#FF3B30`, text `#D70015`, banner fill `#FFF2F2` |
| Safe / kept (green) | `#30D158` | `#34C759` |

Type scale: large title 34/700, number on the call screen 34/600, desktop headline 56–72/700 with −0.02 to −0.035em tracking, body 17, subhead 15, footnote 13, section headers 13 uppercase secondary.

Radii: grouped lists 12, notification card 22, critical alert 30, round controls 50%, phone frame 56 outer / 46 inner, pill buttons 999.

## Rules

- **Colour carries risk and nothing else.** Orange is `soft_warning`, red is `strong_warning` and `hold_transfers`, green is money kept. Everything else is greyscale plus system blue for actions. Colour always comes from the `Action` that `risk.ts` returns; the UI never compares risk numbers against thresholds itself (ADR 6).
- **No boxes around everything.** Use grouped lists with inset separators, not bordered cards. No gradients, glows or coloured chips.
- **No fake phone chrome.** No painted status bar or keyboard. The phone frame on desktop is a plain rounded rectangle.
- **The transcript reads like live captions, not chat.** No bubbles. The newest caller line is large and white, and older lines fade to secondary and tertiary. Signal labels sit under the caller line that raised them, in footnote size, coloured by severity.
- **Plain words for signals.** Use "Claims to be police", not `claims_authority`. Put the wording in one place next to `call/labels.ts`.
- **Tap targets are at least 44 px.** Text contrast is at least 4.5:1, which is why orange and red text on light backgrounds use the darker values in the table.
