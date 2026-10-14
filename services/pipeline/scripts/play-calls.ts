// Shared by the try:* scripts: plays the scripted calls through a scorer and
// prints stage, flags, risk and latency for each line.

import {
  absorb,
  decideAction,
  emptySession,
  flagsSeen,
  RED_FLAG_KEYS,
  type CallState,
} from '@scamshield/shared';
import { NORMAL_CALLS, SCAM_CALL, type ScriptLine } from '../src/fixtures/reference-call';
import type { Scorer } from '../src/scorers/types';

// Roughly the 30-60 seconds of speech the live pipeline will send.
const WINDOW_LINES = 2;
const FLAG_SHOWN_AT = 0.5;

async function run(scorer: Scorer, name: string, lines: ScriptLine[], lang: 'ms' | 'en') {
  console.log(`\n=== ${name} (${lang})`);
  let session = emptySession();
  let stageHits = 0;

  for (const [i, line] of lines.entries()) {
    const window = lines.slice(Math.max(0, i - WINDOW_LINES + 1), i + 1);
    const state: CallState = {
      recentTranscript: window.map((l) => `${l.speaker}: ${l[lang]}`).join('\n'),
      flagsSeenSoFar: flagsSeen(session),
      stageReached: session.stageReached,
      handoffCount: 0,
      language: lang === 'ms' ? 'ms-MY' : 'en-MY',
      callerKnown: false,
      callerInternational: false,
      durationSec: (i + 1) * 30,
      bankAppOpen: false,
      transferScreenOpen: false,
    };

    const { decision, latencyMs, model } = await scorer.score(state);
    session = absorb(session, decision);
    const { risk, action } = decideAction(session, state);
    if (decision.scamStage === line.stage) stageHits++;

    const flags = RED_FLAG_KEYS.filter((k) => decision.flags[k] >= FLAG_SHOWN_AT)
      .map((k) => `${k} ${decision.flags[k].toFixed(2)}`)
      .join(', ');
    console.log(
      `${String(i + 1).padStart(2)}. want ${line.stage.padEnd(17)} got ${decision.scamStage.padEnd(17)} ` +
        `${decision.scamType.padEnd(18)} risk ${risk.toFixed(2)} -> ${action.padEnd(14)} ${latencyMs} ms  ${model}`,
    );
    console.log(`    flags: ${flags || '(none)'}`);
  }
  console.log(`    stage matched on ${stageHits}/${lines.length} lines`);
}

// Plays the scam call and the normal calls, in English and then Malay.
export async function playCalls(scorer: Scorer) {
  for (const lang of ['en', 'ms'] as const) {
    await run(scorer, 'scam call', SCAM_CALL, lang);
    for (const [name, lines] of Object.entries(NORMAL_CALLS)) await run(scorer, name, lines, lang);
  }
}
