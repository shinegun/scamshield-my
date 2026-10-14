import { RED_FLAG_KEYS, emptySession, type FlagScores } from '@scamshield/shared';
import { describe, expect, it } from 'vitest';
import { FLAG_PHRASES, flagPhrases, holdExplanation } from './explain';

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
});
