import type { Action } from '../risk';
import type { ScamStage } from '../schema';

// A scripted call for guided replay (ADR 5). The web app sends each line as
// `transcript.inject` after its delay; tests and the deployed-link health check
// play the same lines. Every name, number and amount is invented.

export interface CallScriptLine {
  speaker: 'caller' | 'user';
  text: string;
  // Seconds to wait after the previous line (or the start) before sending.
  delaySec: number;
  // The stage this line shows: roughly what a scorer should return.
  stage: ScamStage;
}

export interface CallScript {
  id: 'scam-ms' | 'scam-manglish' | 'innocent';
  // Shown on the replay screen.
  title: string;
  summary: string;
  // BCP-47, sent with `session.start`; also the warning language.
  language: string;
  callerKnown: boolean;
  callerInternational: boolean;
  // The action the call should end on.
  expectedAction: Action;
  lines: CallScriptLine[];
}
