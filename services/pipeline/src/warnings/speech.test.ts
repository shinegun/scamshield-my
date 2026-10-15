import { describe, expect, it } from 'vitest';
import { createWarningSpeech, NO_SPEECH, TtsWarningSpeech } from './speech';

const ok = (audio: string) => new Response(JSON.stringify({ audioContent: audio }), { status: 200 });

function make(fetchImpl: unknown) {
  const logs: string[] = [];
  const speech = new TtsWarningSpeech({
    fetch: fetchImpl as typeof fetch,
    getToken: async () => 'tok',
    project: 'proj',
    log: (l) => logs.push(l),
  });
  return { speech, logs };
}

describe('TtsWarningSpeech', () => {
  it('warm() records only the clips that are missing, once', async () => {
    let calls = 0;
    let fail = true;
    const { speech } = make(async () => {
      calls++;
      return fail ? new Response('', { status: 500 }) : ok('QUJD');
    });
    await speech.ready;
    expect(calls).toBe(4);
    expect(speech.audioFor('strong_warning', 'ms')).toBeUndefined();
    fail = false;
    const first = speech.warm();
    const second = speech.warm(); // already recording: starts nothing new
    await Promise.all([first, second]);
    expect(calls).toBe(8);
    expect(speech.audioFor('strong_warning', 'ms')).toBe('data:audio/mpeg;base64,QUJD');
    await speech.warm(); // all recorded: nothing to do
    expect(calls).toBe(8);
  });

  it('gives up on an access token that never comes', async () => {
    const logs: string[] = [];
    const speech = new TtsWarningSpeech({
      fetch: (async () => ok('QUJD')) as unknown as typeof fetch,
      getToken: () => new Promise<string>(() => {}),
      timeoutMs: 20,
      log: (l) => logs.push(l),
    });
    await speech.ready;
    expect(logs).toHaveLength(4);
    expect(logs[0]).toMatch(/failed \(access token timed out/);
  });

  it('has no audio before the clips are ready', () => {
    const { speech } = make(() => new Promise<Response>(() => {}));
    expect(speech.audioFor('strong_warning', 'ms-MY')).toBeUndefined();
  });

  it('returns data URLs per language and action once ready', async () => {
    const bodies: { voice: { languageCode: string } }[] = [];
    const headers: unknown[] = [];
    const { speech, logs } = make(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string));
      headers.push(init.headers);
      return ok('QUJD');
    });
    await speech.ready;
    expect(speech.audioFor('strong_warning', 'ms-MY')).toBe('data:audio/mpeg;base64,QUJD');
    expect(speech.audioFor('hold_transfers', 'en-MY')).toBe('data:audio/mpeg;base64,QUJD');
    expect(speech.audioFor('soft_warning', 'en')).toBeUndefined();
    expect(bodies.map((b) => b.voice.languageCode).sort()).toEqual(['en-US', 'en-US', 'ms-MY', 'ms-MY']);
    expect(headers[0]).toMatchObject({ authorization: 'Bearer tok', 'x-goog-user-project': 'proj' });
    expect(logs).toHaveLength(4);
  });

  it('leaves out clips that failed and keeps the others', async () => {
    const { speech, logs } = make(async (_url: string, init: RequestInit) =>
      JSON.parse(init.body as string).voice.languageCode === 'ms-MY'
        ? new Response('no', { status: 500 })
        : ok('QUJD'),
    );
    await speech.ready;
    expect(speech.audioFor('strong_warning', 'ms-MY')).toBeUndefined();
    expect(speech.audioFor('strong_warning', 'en-MY')).toBeDefined();
    expect(logs.filter((l) => l.includes('failed'))).toHaveLength(2);
  });

  it('survives a token failure', async () => {
    const speech = new TtsWarningSpeech({
      fetch: (async () => ok('QUJD')) as unknown as typeof fetch,
      getToken: async () => {
        throw new Error('no credentials');
      },
      log: () => {},
    });
    await speech.ready;
    expect(speech.audioFor('hold_transfers', 'en')).toBeUndefined();
  });
});

describe('createWarningSpeech', () => {
  it('is off without K_SERVICE or SPEECH=on', () => {
    expect(createWarningSpeech({})).toBe(NO_SPEECH);
  });
});
