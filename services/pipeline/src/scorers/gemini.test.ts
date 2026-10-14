import { RED_FLAGS, RED_FLAG_KEYS, SCAM_STAGE_KEYS, type CallState } from '@scamshield/shared';
import { describe, expect, it, vi } from 'vitest';
import { GeminiScorer } from './gemini';

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

function mockClient(text: string | undefined, modelVersion?: string) {
  const generateContent = vi.fn(async (_params: unknown) => ({ text, modelVersion }) as never);
  return { client: { models: { generateContent } }, generateContent };
}

function answer(overrides: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = { scam_stage: 'isolation', scam_type: 'fake_police' };
  for (const k of RED_FLAG_KEYS) base[k] = 0.1;
  base.keep_on_line_instruction = 0.97;
  return JSON.stringify({ ...base, ...overrides });
}

describe('GeminiScorer', () => {
  it('maps a JSON response to a Decision', async () => {
    const { client } = mockClient(answer(), 'gemini-2.5-flash-002');
    const result = await new GeminiScorer({ client }).score(state);

    expect(result.scorer).toBe('gemini');
    expect(result.model).toBe('gemini-2.5-flash-002');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.decision.scamStage).toBe('isolation');
    expect(result.decision.scamType).toBe('fake_police');
    expect(result.decision.flags.keep_on_line_instruction).toBe(0.97);
    expect(result.decision.flags.asks_for_transfer).toBe(0.1);
    expect(Object.keys(result.decision.flags).sort()).toEqual([...RED_FLAG_KEYS].sort());
  });

  it('falls back to the configured model when the response has no modelVersion', async () => {
    const { client } = mockClient(answer());
    const result = await new GeminiScorer({ client, model: 'my-model' }).score(state);
    expect(result.model).toBe('my-model');
  });

  it('clamps out-of-range values and defaults missing or non-numeric ones to 0', async () => {
    const { client } = mockClient(
      answer({ asks_for_transfer: 1.7, demands_secrecy: -0.4, creates_urgency: 'high', claims_authority: undefined }),
    );
    const { decision } = await new GeminiScorer({ client }).score(state);
    expect(decision.flags.asks_for_transfer).toBe(1);
    expect(decision.flags.demands_secrecy).toBe(0);
    expect(decision.flags.creates_urgency).toBe(0);
    expect(decision.flags.claims_authority).toBe(0);
  });

  it('maps unknown stage and type to none', async () => {
    const { client } = mockClient(answer({ scam_stage: 'panic', scam_type: 'alien_invasion' }));
    const { decision } = await new GeminiScorer({ client }).score(state);
    expect(decision.scamStage).toBe('none');
    expect(decision.scamType).toBe('none');
  });

  it('throws when the response is not JSON', async () => {
    await expect(new GeminiScorer({ client: mockClient('not json').client }).score(state)).rejects.toThrow(/JSON/);
    await expect(new GeminiScorer({ client: mockClient(undefined).client }).score(state)).rejects.toThrow(/JSON/);
  });

  it('sends every question verbatim with a schema covering all 15 answers', async () => {
    const { client, generateContent } = mockClient(answer());
    const controller = new AbortController();
    await new GeminiScorer({ client }).score(state, controller.signal);

    expect(generateContent).toHaveBeenCalledOnce();
    const params = generateContent.mock.calls[0]![0] as {
      model: string;
      contents: { parts: { text: string }[] }[];
      config: Record<string, any>;
    };
    const prompt = params.contents.flatMap((c) => c.parts.map((p) => p.text)).join('\n');

    for (const k of RED_FLAG_KEYS) {
      expect(prompt).toContain(RED_FLAGS[k].question);
      expect(prompt).toContain(RED_FLAGS[k].yes);
    }
    expect(prompt).toContain('recent_transcript');
    expect(prompt).toContain('isolation:');
    expect(prompt).toContain('fake_police:');
    // Numbers stay in code.
    expect(prompt).not.toContain('4000');

    const { config } = params;
    expect(Object.keys(config.responseSchema.properties)).toHaveLength(15);
    expect(config.responseSchema.required).toHaveLength(15);
    expect(config.responseSchema.properties.scam_stage.enum).toEqual(SCAM_STAGE_KEYS);
    expect(config.responseMimeType).toBe('application/json');
    expect(config.temperature).toBe(0);
    expect(config.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(config.abortSignal).toBe(controller.signal);
    expect(params.model).toBe('gemini-2.5-flash');
  });
});
