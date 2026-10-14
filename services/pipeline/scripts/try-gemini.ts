// Runs the scripted calls through the Gemini scorer in Malay and in English and
// prints what it returned, to compare with try:jev.
//
//   pnpm --filter @scamshield/pipeline try:gemini
//
// Uses application default credentials (gcloud auth application-default login);
// no .env needed. Project, location and model come from GOOGLE_CLOUD_PROJECT,
// GEMINI_LOCATION and GEMINI_SCORER_MODEL, with defaults.

import { GeminiScorer } from '../src/scorers/gemini';
import { playCalls } from './play-calls';

await playCalls(new GeminiScorer());
