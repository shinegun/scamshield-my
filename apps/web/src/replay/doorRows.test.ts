import { describe, expect, it } from 'vitest';
import { CALL_SCRIPTS } from '@scamshield/shared';
import { doorRow } from './doorRows';

const row = (id: string) => {
  const script = CALL_SCRIPTS.find((s) => s.id === id);
  if (!script) throw new Error(`no script ${id}`);
  return doorRow(script);
};

describe('doorRow', () => {
  it('describes the Malay scam call', () => {
    expect(row('scam-ms')).toEqual({
      title: 'Panggilan "MCMC"',
      subtitle: 'Scam · Bahasa Melayu',
      scam: true,
    });
  });

  it('describes the Manglish scam call', () => {
    expect(row('scam-manglish')).toEqual({
      title: '"MCMC" call',
      subtitle: 'Scam · Manglish',
      scam: true,
    });
  });

  it('describes the innocent call', () => {
    expect(row('innocent')).toEqual({
      title: 'Bank card check',
      subtitle: 'Innocent · should stay quiet',
      scam: false,
    });
  });
});
