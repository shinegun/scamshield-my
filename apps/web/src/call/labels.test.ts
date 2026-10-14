import { describe, expect, it } from 'vitest';
import { formatClock, formatLatency, latestScored, scamTypeLabel, scorerTag, stageLabel } from './labels';
import type { RiskMessage } from './state';

describe('labels', () => {
  it('humanizes stage and scam type keys', () => {
    expect(stageLabel('authority_setup')).toBe('Authority setup');
    expect(stageLabel('none')).toBe('No scam signs');
    expect(scamTypeLabel('fake_lhdn_or_gov')).toBe('Fake LHDN or government');
    expect(scamTypeLabel('macau_scam')).toBe('Macau scam');
  });

  it('formats the call clock and latency', () => {
    expect(formatClock(75)).toBe('01:15');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatLatency(312)).toBe('312 ms');
    expect(formatLatency(1100)).toBe('1.1 s');
  });

  it('builds the scorer tag from the latest scoring tick, skipping clock.skip answers', () => {
    const risk = (scorer: 'jev' | 'gemini', latencyMs: number) =>
      ({ type: 'risk', scorer, latencyMs }) as RiskMessage;
    expect(scorerTag(risk('jev', 312))).toBe('Jev · 312 ms');
    expect(scorerTag(risk('gemini', 1100))).toBe('Gemini · 1.1 s');
    expect(latestScored([risk('jev', 312), risk('jev', 0)])?.latencyMs).toBe(312);
  });
});
