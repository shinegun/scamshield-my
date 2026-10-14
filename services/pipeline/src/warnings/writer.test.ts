import { describe, expect, it, vi } from 'vitest';
import { RED_FLAGS } from '@scamshield/shared';
import { FALLBACK_WARNINGS, fallbackWarning } from './fallbacks';
import { GeminiWarningWriter, writeWarning, type WarningInput, type WarningWriter } from './writer';

const input: WarningInput = {
  action: 'strong_warning',
  language: 'ms-MY',
  scamType: 'fake_police',
  stage: 'family_pressure',
  flagsSeen: ['claims_authority', 'mentions_family_involvement', 'demands_secrecy'],
};

function mockClient(impl: (params: unknown) => Promise<{ text?: string }>) {
  const generateContent = vi.fn(impl as never) as unknown as ReturnType<typeof vi.fn>;
  return { client: { models: { generateContent } } as never, generateContent };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('GeminiWarningWriter', () => {
  it('returns the cleaned model text', async () => {
    const { client } = mockClient(async () => ({ text: '  "Panggilan ini nampak seperti penipuan."\n' }));
    expect(await new GeminiWarningWriter({ client }).write(input)).toBe('Panggilan ini nampak seperti penipuan.');
  });

  it('puts the action, language and detected flags in the prompt, and no transcript', async () => {
    const { client, generateContent } = mockClient(async () => ({ text: 'ok' }));
    await new GeminiWarningWriter({ client, model: 'my-model' }).write(input);

    expect(generateContent).toHaveBeenCalledOnce();
    const params = generateContent.mock.calls[0]![0] as {
      model: string;
      contents: { parts: { text: string }[] }[];
      config: { thinkingConfig: unknown; abortSignal: AbortSignal };
    };
    expect(params.model).toBe('my-model');
    expect(params.config.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(params.config.abortSignal).toBeInstanceOf(AbortSignal);

    const prompt = params.contents[0]!.parts[0]!.text;
    expect(prompt).toContain('strong_warning');
    expect(prompt).toContain('Malay');
    expect(prompt).toContain('ms-MY');
    expect(prompt).toContain('fake_police');
    for (const flag of input.flagsSeen) expect(prompt).toContain(flag);
    // Flags not detected are not mentioned.
    expect(prompt).not.toContain('asks_for_transfer');
    expect(prompt).not.toMatch(/transcript/i);
    expect(prompt).toContain(RED_FLAGS.demands_secrecy.question.replace(/^In `recent_transcript`, /, ''));
  });

  it('asks for Malaysian English for non-Malay calls', async () => {
    const { client, generateContent } = mockClient(async () => ({ text: 'ok' }));
    await new GeminiWarningWriter({ client }).write({ ...input, language: 'en-MY', action: 'hold_transfers' });
    const prompt = (generateContent.mock.calls[0]![0] as { contents: { parts: { text: string }[] }[] }).contents[0]!
      .parts[0]!.text;
    expect(prompt).toContain('Malaysian English');
    expect(prompt).toContain('hold_transfers');
  });

  it('uses the fallback when the model is slower than the limit, and aborts the call', async () => {
    let signal: AbortSignal | undefined;
    const { client } = mockClient(async (params) => {
      signal = (params as { config: { abortSignal: AbortSignal } }).config.abortSignal;
      await sleep(200);
      return { text: 'too late' };
    });
    const text = await new GeminiWarningWriter({ client, timeoutMs: 20 }).write(input);
    expect(text).toBe(FALLBACK_WARNINGS.ms.strong_warning);
    expect(signal?.aborted).toBe(true);
  });

  it('uses the fallback when the model throws or returns nothing', async () => {
    const boom = mockClient(async () => {
      throw new Error('boom');
    });
    expect(await new GeminiWarningWriter({ client: boom.client }).write({ ...input, language: 'en-MY' })).toBe(
      FALLBACK_WARNINGS.en.strong_warning,
    );
    for (const text of [undefined, '', '   ']) {
      const empty = mockClient(async () => ({ text }));
      expect(await new GeminiWarningWriter({ client: empty.client }).write({ ...input, action: 'soft_warning' })).toBe(
        FALLBACK_WARNINGS.ms.soft_warning,
      );
    }
  });
});

describe('fallback strings', () => {
  it('has Malay for ms* languages and Malaysian English otherwise', () => {
    for (const action of ['soft_warning', 'strong_warning', 'hold_transfers'] as const) {
      expect(fallbackWarning(action, 'ms-MY')).toBe(FALLBACK_WARNINGS.ms[action]);
      expect(fallbackWarning(action, 'ms')).toBe(FALLBACK_WARNINGS.ms[action]);
      expect(fallbackWarning(action, 'en-MY')).toBe(FALLBACK_WARNINGS.en[action]);
      expect(fallbackWarning(action, 'zh-CN')).toBe(FALLBACK_WARNINGS.en[action]);
      expect(FALLBACK_WARNINGS.ms[action]).not.toBe(FALLBACK_WARNINGS.en[action]);
    }
  });

  it('mentions no phone number other than 997', () => {
    for (const lang of Object.values(FALLBACK_WARNINGS)) {
      for (const text of Object.values(lang)) {
        expect([...text.matchAll(/\d+/g)].every((m) => m[0] === '997')).toBe(true);
      }
    }
  });
});

describe('writeWarning', () => {
  it('uses the fallback with no writer, and when any writer rejects, hangs or returns nothing', async () => {
    expect(await writeWarning(undefined, input)).toBe(FALLBACK_WARNINGS.ms.strong_warning);
    const rejecting: WarningWriter = { write: () => Promise.reject(new Error('x')) };
    const hanging: WarningWriter = { write: () => new Promise(() => {}) };
    const empty: WarningWriter = { write: async () => '' };
    expect(await writeWarning(rejecting, input)).toBe(FALLBACK_WARNINGS.ms.strong_warning);
    expect(await writeWarning(hanging, input, 20)).toBe(FALLBACK_WARNINGS.ms.strong_warning);
    expect(await writeWarning(empty, input)).toBe(FALLBACK_WARNINGS.ms.strong_warning);
  });

  it('passes through the writer text', async () => {
    expect(await writeWarning({ write: async () => 'hello' }, input)).toBe('hello');
  });
});
