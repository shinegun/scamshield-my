// Runs the scripted calls through Jev in Malay and in English and prints what
// it returned, so we can see how much accuracy Malay costs.
//
//   pnpm --filter @scamshield/pipeline try:jev
//
// Needs TYPESAFE_API_KEY in .env at the repo root.

import {
  absorb,
  decideAction,
  emptySession,
  flagsSeen,
  RED_FLAG_KEYS,
  type CallState,
} from '@scamshield/shared';
import { NORMAL_CALLS, SCAM_CALL, type ScriptLine } from '../src/fixtures/reference-call';
import { JevScorer } from '../src/jev';

// Roughly the 30-60 seconds of speech the live pipeline will send.
const WINDOW_LINES = 2;
const FLAG_SHOWN_AT = 0.5;

// Long timeout: this measures Jev's latency instead of cutting it off at the
// pipeline's 800 ms.
const scorer = new JevScorer({ timeout: 10_000 });

async function run(name: string, lines: ScriptLine[], lang: 'ms' | 'en') {
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

for (const lang of ['en', 'ms'] as const) {
  await run('scam call', SCAM_CALL, lang);
  for (const [name, lines] of Object.entries(NORMAL_CALLS)) await run(name, lines, lang);
}
