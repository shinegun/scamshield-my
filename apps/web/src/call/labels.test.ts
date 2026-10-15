import { describe, expect, it } from 'vitest';
import { ACTION_LABELS, actionLabel, formatClock, formatLatency, langOf, latestScored, scamTypeLabel, stageDescription, scorerTag, stageLabel } from './labels';
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

  it('selects Malay for ms and ms-MY, English otherwise', () => {
    expect(langOf('ms')).toBe('ms');
    expect(langOf('ms-MY')).toBe('ms');
    expect(langOf('en')).toBe('en');
    expect(langOf('en-MY')).toBe('en');
    expect(langOf(undefined)).toBe('en');
  });

  it('labels in Malay when asked and keeps English as the default', () => {
    expect(actionLabel('hold_transfers', 'ms')).toBe('Pindahan ditahan');
    expect(actionLabel('strong_warning', 'ms')).toBe('Amaran penipuan');
    expect(actionLabel('soft_warning')).toBe(ACTION_LABELS.soft_warning);
    expect(actionLabel('soft_warning', 'en')).toBe('Soft warning');
    expect(stageLabel('isolation', 'ms')).toBe('Mengasingkan anda');
    expect(stageLabel('isolation')).toBe('Isolation');
    expect(scamTypeLabel('fake_police', 'ms')).toBe('Polis palsu');
    expect(stageDescription('none', 'ms')).toContain('penipuan');
    expect(stageDescription('none')).toMatch(/^An ordinary call/);
  });
});
