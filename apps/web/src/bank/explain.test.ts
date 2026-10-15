import { RED_FLAG_KEYS, emptySession, type FlagScores } from '@scamshield/shared';
import { describe, expect, it } from 'vitest';
import { FLAG_PHRASES, FLAG_PHRASES_MS, flagPhrases, holdExplanation, holdStrings } from './explain';

function flags(overrides: Partial<FlagScores>): FlagScores {
  return { ...emptySession().peakFlags, ...overrides };
}

describe('flag phrases', () => {
  it('has a plain phrase for every red flag', () => {
    for (const key of RED_FLAG_KEYS) {
      const phrase = FLAG_PHRASES[key];
      expect(phrase, key).toBeTruthy();
      expect(phrase).not.toContain('_');
    }
    expect(Object.keys(FLAG_PHRASES).sort()).toEqual([...RED_FLAG_KEYS].sort());
  });

  it('lists only flags at 0.5 or above, strongest first', () => {
    const phrases = flagPhrases(flags({ claims_authority: 0.5, asks_for_transfer: 0.9, creates_urgency: 0.49 }));
    expect(phrases).toEqual([FLAG_PHRASES.asks_for_transfer, FLAG_PHRASES.claims_authority]);
  });

  it('builds the explanation from the latest risk', () => {
    expect(holdExplanation(undefined)).toEqual({ phrases: [] });
    const scam = holdExplanation({ scamType: 'fake_police', flags: flags({ demands_secrecy: 1 }) });
    expect(scam.scamLabel).toBe('Fake police');
    expect(scam.phrases).toEqual([FLAG_PHRASES.demands_secrecy]);
    expect(holdExplanation({ scamType: 'none', flags: flags({}) }).scamLabel).toBeUndefined();
  });

  it('explains in Malay when asked', () => {
    expect(Object.keys(FLAG_PHRASES_MS).sort()).toEqual([...RED_FLAG_KEYS].sort());
    const ms = holdExplanation({ scamType: 'fake_police', flags: flags({ demands_secrecy: 1 }) }, 'ms');
    expect(ms.scamLabel).toBe('Polis palsu');
    expect(ms.phrases).toEqual([FLAG_PHRASES_MS.demands_secrecy]);
    expect(holdStrings('ms').title).toBe('Pindahan ditahan untuk melindungi anda');
    expect(holdStrings('ms').body('RM500.00', 'Ali', 'RM1,000.00')).toContain('RM500.00');
    expect(holdStrings().title).toBe('Transfer held to protect you');
  });

  it('writes the held-screen sentence with and without a scam label', () => {
    expect(holdStrings().because('Fake police')).toBe(
      "You were on a call that looked like a fake police scam when this transfer was made, so we didn't send it.",
    );
    expect(holdStrings().because()).toBe(
      "You were on a call that looked like a scam when this transfer was made, so we didn't send it.",
    );
    expect(holdStrings('ms').because('Polis palsu')).toBe(
      'Anda sedang membuat panggilan yang kelihatan seperti penipuan polis palsu semasa pindahan ini dibuat, jadi kami tidak menghantarnya.',
    );
    expect(holdStrings('ms').because()).toContain('penipuan semasa');
    expect(holdStrings('ms').heldTitle).toBe('Pindahan ditahan');
    expect(holdStrings().stillIn).toBe('Still in your Savings');
    expect(holdStrings('ms').stillIn).toBe('Masih dalam akaun Simpanan anda');
  });
});
