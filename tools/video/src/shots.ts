import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BUILD, ensureDir, LIVE_URL } from './paths.js';
import type { Recorder } from './recorder.js';

// The scripted shots from docs/video-script.md, driven against the live
// link. Each one records a single uncut take; the editing agent trims them.
// Holds at the end of a shot are deliberate: they give the edit room to sit
// on a screen while the voiceover finishes.

export interface Shot {
  description: string;
  viewport?: { width: number; height: number };
  run: (r: Recorder) => Promise<void>;
}

const END_CALL = /^(End call|End Call|Tamatkan Panggilan)$/;
// The bank app follows the call's language: English for Manglish, Malay for Malay.
const TRANSFER_MONEY = /^(Transfer money|Pindah wang)$/;
const SAFE_ACCOUNT = /^(Bank Negara safe account|Akaun selamat Bank Negara)$/;
const SEND_TRANSFER = /^(Send transfer|Hantar pindahan)$/;
const CLOSE_BANK = /^(Close|Tutup)$/;
const ACCOUNTS = /^(Accounts|Akaun)$/;

async function frontDoor(r: Recorder): Promise<void> {
  await r.page.goto(LIVE_URL, { waitUntil: 'networkidle' });
  r.mark('front door loaded, phone ringing');
  await r.wait(2);
}

// Wait until no new call line has arrived for `quietSec`.
async function untilCallQuiet(r: Recorder, quietSec: number, maxSec = 150): Promise<void> {
  const started = r.t();
  for (;;) {
    const last = [...r.events].reverse().find((e) => e.type === 'transcript');
    if (last && r.t() - last.t >= quietSec) return;
    if (r.t() - started > maxSec) throw new Error('call never went quiet');
    await r.wait(0.5);
  }
}

async function endCall(r: Recorder): Promise<void> {
  await r.click(r.page.getByRole('button', { name: END_CALL }).last(), 'click End call');
}

export const SHOTS: Record<string, Shot> = {
  scam: {
    description:
      'Manglish "MCMC" scam call at 2x from the front door: accept, signals build, strong warning (spoken), hold warning, ' +
      'continue the call, open the bank app, send RM 5,000 to "Bank Negara safe account", transfer paused, end the call, summary.',
    async run(r) {
      await frontDoor(r);
      await r.click('2×', 'set replay speed 2x');
      await r.click('Play: "MCMC" call (Manglish)', 'choose the Manglish scam call');
      await r.wait(1.5);
      await r.click('Accept', 'accept the call');

      await r.waitFor('strong warning', (m) => m.type === 'warning' && m.action === 'strong_warning');
      await r.waitFor('hold warning', (m) => m.type === 'warning' && m.action === 'hold_transfers');
      // Let any spoken warning finish, then a beat on the red screen.
      const audio = [...r.events].reverse().find((e) => e.kind === 'audio');
      if (audio) {
        const ends = audio.t + r.lastAudioSeconds();
        if (ends > r.t()) await r.wait(ends - r.t());
      }
      await r.wait(2);
      r.mark('hold warning on screen, audio finished');

      await r.click('Continue call');
      await r.wait(1.5);
      await r.click('Open bank app');
      await r.wait(1.5);
      await r.click(r.page.getByRole('button', { name: TRANSFER_MONEY }), 'click Transfer money');
      await r.wait(1);
      await r.click(r.page.getByRole('button', { name: SAFE_ACCOUNT }), 'choose recipient Bank Negara safe account');
      await r.wait(0.5);
      await r.fill('#bank-amount', '5000', 'type amount 5000');
      await r.wait(1);
      await r.click(r.page.getByRole('button', { name: SEND_TRANSFER }), 'click Send transfer');
      await r.waitFor('transfer answer', (m) => m.type === 'transfer', 30);
      await r.wait(5);
      r.mark('held on "transfer paused" for 5s');

      // Back to the call and end it, to show the summary: the bank screen
      // covers the call. "Accounts" closes it; Close is there on some screens.
      await r.click(r.page.getByRole('button', { name: ACCOUNTS }), 'close the bank app (Accounts)');
      await r.wait(1);
      const close = r.page.getByRole('button', { name: CLOSE_BANK }).first();
      if (await close.isVisible().catch(() => false)) await r.click(close, 'close the bank app');
      await r.wait(1);
      await endCall(r);
      await r.wait(6);
      r.mark('held on the call summary for 6s');
    },
  },

  innocent: {
    description: 'Innocent "Bank card check" call at 2x: accept, no warnings, end the call, calm summary.',
    async run(r) {
      await frontDoor(r);
      await r.click('2×', 'set replay speed 2x');
      await r.click('Play: Bank card check (innocent)', 'choose the innocent bank call');
      await r.wait(1.5);
      await r.click('Accept', 'accept the call');
      await r.waitFor('first line', (m) => m.type === 'transcript');
      await untilCallQuiet(r, 5);
      r.mark('last call line done');
      await endCall(r);
      await r.wait(6);
      r.mark('held on the calm summary for 6s');
    },
  },

  desk: {
    description:
      'Side by side: the phone (left) plays the Manglish scam call while the fraud desk (/dashboard, right) shows it live: ' +
      'the call in the list, the risk chart rising, then the held transfer.',
    async run(r) {
      const html = join(ensureDir(BUILD), 'desk.html');
      writeFileSync(
        html,
        `<!doctype html><meta charset="utf-8"><style>
          html,body{margin:0;height:100%;background:#f2f2f4;overflow:hidden}
          .row{display:flex;height:100%;gap:0}
          iframe{border:0;height:100%}
          #phone{width:560px;border-right:1px solid #ddd}
          #desk{flex:1}
        </style><div class="row">
          <iframe id="phone" src="${LIVE_URL}/" allow="autoplay"></iframe>
          <iframe id="desk" src="${LIVE_URL}/dashboard"></iframe>
        </div>`,
      );
      await r.page.goto(`file://${html}`, { waitUntil: 'load' });
      r.mark('phone (left) and fraud desk (right) loaded');
      await r.wait(3);
      const phone = r.page.frameLocator('#phone');
      const desk = r.page.frameLocator('#desk');
      await r.click(phone.getByRole('button', { name: '2×' }), 'set replay speed 2x');
      await r.click(phone.getByRole('button', { name: 'Play: "MCMC" call (Manglish)' }), 'choose the Manglish scam call');
      await r.wait(1);
      await r.click(phone.getByRole('button', { name: 'Accept' }), 'accept the call');
      await r.wait(3);
      // Open the live call on the desk if it lists calls rather than opening one.
      const row = desk.getByRole('button', { name: /MCMC|Live|Azman|\+60/ }).first();
      if (await row.isVisible().catch(() => false)) await r.click(row, 'open the live call on the fraud desk');
      await r.waitFor('hold warning', (m) => m.type === 'warning' && m.action === 'hold_transfers');
      await r.wait(3);
      await r.click(phone.getByRole('button', { name: 'Continue call' }), 'click Continue call');
      await r.wait(1);
      await r.click(phone.getByRole('button', { name: 'Open bank app' }), 'click Open bank app');
      await r.wait(1);
      await r.click(phone.getByRole('button', { name: TRANSFER_MONEY }), 'click Transfer money');
      await r.click(phone.getByRole('button', { name: SAFE_ACCOUNT }), 'choose recipient');
      await phone.locator('#bank-amount').pressSequentially('5000', { delay: 90 });
      r.mark('type amount 5000');
      await r.click(phone.getByRole('button', { name: SEND_TRANSFER }), 'click Send transfer');
      await r.waitFor('transfer answer', (m) => m.type === 'transfer', 30);
      await r.wait(8);
      r.mark('held transfer visible on the desk for 8s');
    },
  },

  race: {
    description: '/race: Jev vs Gemini on the same Malay scam line, "Run 5 times" to completion.',
    async run(r) {
      await r.page.goto(`${LIVE_URL}/race`, { waitUntil: 'networkidle' });
      r.mark('race page loaded');
      await r.wait(2);
      await r.click('Run 5 times');
      const started = r.t();
      while (r.events.filter((e) => e.type === 'race.result').length < 5) {
        if (r.t() - started > 120) throw new Error('race did not finish 5 runs');
        await r.wait(0.5);
      }
      await r.wait(5);
      r.mark('held on the finished race for 5s');
    },
  },
};
