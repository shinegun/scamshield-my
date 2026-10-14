import type { Scorer } from './scorers/types';
import { FallbackScorer } from './scorers/fallback';
import { GeminiScorer } from './scorers/gemini';
import { JevScorer } from './scorers/jev';
import { createServer } from './server';

// The one place that picks the scorer (ADR 2): Jev first with Gemini as the
// fallback, or Gemini alone when there is no Jev key. The 800 ms limit is for
// Jev; Gemini takes about a second on the full prompt, so alone it gets 5 s.
const gemini = new GeminiScorer();
const scorer: Scorer = process.env.TYPESAFE_API_KEY
  ? new FallbackScorer(new JevScorer(), gemini)
  : new FallbackScorer(gemini, undefined, { timeoutMs: 5000 });

const { port } = await createServer({ scorer, port: Number(process.env.PORT ?? 8080) });
console.log(
  `pipeline listening on :${port} (scorer: ${process.env.TYPESAFE_API_KEY ? 'jev, gemini fallback' : 'gemini only'})`,
);
