import { RED_FLAG_KEYS, SCAM_STAGE_KEYS, type CallState } from '@scamshield/shared';
import { describe, expect, it, vi } from 'vitest';
import { JevScorer } from './jev';

const state: CallState = {
  recentTranscript: 'Caller: Saya Inspektor Azman dari PDRM. Jangan letak telefon.',
  flagsSeenSoFar: ['call_transferred_between_agencies'],
  stageReached: 'authority_setup',
  handoffCount: 1,
  language: 'ms-MY',
  callerKnown: false,
  callerInternational: false,
  durationSec: 4000,
  bankAppOpen: true,
  transferScreenOpen: false,
};

// Answers in the shape the API reference documents.
function apiResponse() {
  const answers: Record<string, unknown> = {
    scam_stage: { type: 'choice', choice: 'isolation', probabilities: {}, confidence: 0.8 },
    scam_type: { type: 'choice', choice: 'fake_police', probabilities: {}, confidence: 0.9 },
  };
  for (const k of RED_FLAG_KEYS) answers[k] = { type: 'noul', noul: 0.1 };
  answers.keep_on_line_instruction = { type: 'noul', noul: 0.97 };
  return { model: 'jev-1.13.0', answers, usage: { input_tokens: 900, output_tokens: 40 } };
}

describe('JevScorer', () => {
  it('asks every schema question in one request and maps the answers', async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => Response.json(apiResponse()));
    const result = await new JevScorer({ apiKey: 'test-key', fetch }).score(state);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://api.typesafe.ai/v1/systemone');
    const body = JSON.parse(init!.body as string);

    expect(Object.keys(body.questions).sort()).toEqual(
      ['scam_stage', 'scam_type', ...RED_FLAG_KEYS].sort(),
    );
    expect(body.questions.scam_stage.type).toBe('choice');
    expect(Object.keys(body.questions.scam_stage.criteria)).toEqual(SCAM_STAGE_KEYS);
    expect(body.questions.demands_secrecy.type).toBe('noul');
    expect(body.questions.demands_secrecy.criteria.true).toContain('jangan beritahu sesiapa');

    expect(body.state.recent_transcript).toBe(state.recentTranscript);
    expect(body.state.earlier_in_call.furthest_stage).toBe('authority_setup');
    expect(body.state.caller).toBe('unknown number, local');
    // Numbers stay in code.
    expect(JSON.stringify(body.state)).not.toContain('4000');

    expect(result.scorer).toBe('jev');
    expect(result.model).toBe('jev-1.13.0');
    expect(result.decision.scamStage).toBe('isolation');
    expect(result.decision.scamType).toBe('fake_police');
    expect(result.decision.flags.keep_on_line_instruction).toBe(0.97);
    expect(result.decision.flags.asks_for_transfer).toBe(0.1);
  });

  it('does not retry a failed tick', async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{}', { status: 529 }));
    await expect(new JevScorer({ apiKey: 'test-key', fetch }).score(state)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledOnce();
  });
});
