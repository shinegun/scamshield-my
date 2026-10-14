import { describe, expect, it } from 'vitest';
import type { ScamStage } from '../schema';
import { CALL_SCRIPTS, INNOCENT, SCAM_MANGLISH, SCAM_MS, scriptDurationSec } from './index';

// Spelled out so this test does not depend on how schema.ts stores the stages.
const STAGE_ORDER: ScamStage[] = [
  'none',
  'authority_setup',
  'victim_framing',
  'family_pressure',
  'isolation',
  'identity_request',
  'financial_request',
];

describe('scripted calls', () => {
  it('have unique ids and positive delays', () => {
    expect(new Set(CALL_SCRIPTS.map((s) => s.id)).size).toBe(CALL_SCRIPTS.length);
    for (const s of CALL_SCRIPTS) {
      for (const line of s.lines) expect(line.delaySec, `${s.id}: ${line.text}`).toBeGreaterThan(0);
    }
  });

  it.each([SCAM_MS, SCAM_MANGLISH])('$id walks every stage in order and fits the video', (script) => {
    const ranks = script.lines.map((l) => STAGE_ORDER.indexOf(l.stage));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(script.lines.map((l) => l.stage))).toEqual(new Set(STAGE_ORDER.filter((s) => s !== 'none')));
    expect(scriptDurationSec(script)).toBeGreaterThanOrEqual(70);
    expect(scriptDurationSec(script)).toBeLessThanOrEqual(90);
  });

  it('keeps the two scam calls line for line, so they score alike', () => {
    expect(SCAM_MANGLISH.lines.map((l) => [l.speaker, l.stage, l.delaySec])).toEqual(
      SCAM_MS.lines.map((l) => [l.speaker, l.stage, l.delaySec]),
    );
  });

  it('has an innocent call that never leaves stage none', () => {
    expect(INNOCENT.lines.every((l) => l.stage === 'none')).toBe(true);
  });
});
