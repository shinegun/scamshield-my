// Runs the scripted calls through Jev in Malay and in English and prints what
// it returned, so we can see how much accuracy Malay costs.
//
//   pnpm --filter @scamshield/pipeline try:jev
//
// Needs TYPESAFE_API_KEY in .env at the repo root.

import { JevScorer } from '../src/scorers/jev';
import { playCalls } from './play-calls';

// Long timeout: this measures Jev's latency instead of cutting it off at the
// pipeline's 800 ms.
await playCalls(new JevScorer({ timeout: 10_000 }));
