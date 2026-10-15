import { describe, expect, it } from 'vitest';
import { callerNumber, deskTimeline, filterCounts, filterSessions, parseTicks, rowSubtitle } from './desk';
import { toSessionView } from './view';

const mk = (id: string, o: Record<string, unknown>) =>
  toSessionView(id, { status: 'ended', risk: 0, action: 'none', peakAction: 'none', updatedAtMs: 1, ...o });

const held = mk('a', { status: 'live', action: 'hold_transfers', peakAction: 'hold_transfers', scamType: 'fake_police', holdStatus: 'held', scriptId: 'scam-ms' });
const warned = mk('b', { action: 'soft_warning', peakAction: 'soft_warning', scamType: 'fake_police' });
const innocent = mk('c', { scriptId: 'innocent' });
const all = [held, warned, innocent];

describe('filters', () => {
  it('filters and counts', () => {
    expect(filterSessions(all, 'live')).toEqual([held]);
    expect(filterSessions(all, 'held')).toEqual([held]);
    expect(filterSessions(all, 'warned')).toEqual([held, warned]);
    expect(filterSessions(all, 'all')).toHaveLength(3);
    expect(filterCounts(all)).toEqual({ live: 1, held: 1, warned: 2, all: 3 });
  });
});

describe('parseTicks', () => {
  it('is defensive and sorted', () => {
    const t = parseTicks([
      { atSec: 20, risk: 5, action: 'bogus', stage: 'isolation', flags: { demands_secrecy: 0.9, nope: 1, creates_urgency: 'x' } },
      { atSec: 'x' },
    ]);
    expect(t[0]).toEqual({ atSec: 0, risk: 0, action: 'none', stage: 'none', flags: {} });
    expect(t[1]).toEqual({ atSec: 20, risk: 1, action: 'none', stage: 'isolation', flags: { demands_secrecy: 0.9 } });
  });
});

describe('deskTimeline', () => {
  const ticks = parseTicks([
    { atSec: 10, risk: 0.1, action: 'none', stage: 'none', flags: { claims_authority: 0.4 } },
    { atSec: 31, risk: 0.3, action: 'soft_warning', stage: 'authority_setup', flags: { claims_authority: 0.8 } },
    { atSec: 70, risk: 0.6, action: 'strong_warning', stage: 'isolation', flags: { claims_authority: 0.9, demands_secrecy: 0.7 } },
    { atSec: 90, risk: 0.9, action: 'hold_transfers', stage: 'authority_setup', flags: { asks_for_transfer: 0.6 } },
    { atSec: 118, risk: 0.92, action: 'hold_transfers', stage: 'financial_request', flags: {} },
  ]);
  it('lists signals newest first with the tick action', () => {
    const { signals } = deskTimeline(ticks);
    expect(signals.map((s) => [s.flag, s.time, s.action])).toEqual([
      ['asks_for_transfer', '01:30', 'hold_transfers'],
      ['demands_secrecy', '01:10', 'strong_warning'],
      ['claims_authority', '00:31', 'soft_warning'],
    ]);
  });
  it('lists stages oldest first and never backwards', () => {
    const { stages } = deskTimeline(ticks);
    expect(stages.map((s) => [s.label, s.time, s.current])).toEqual([
      ['Authority setup', '00:31', false],
      ['Isolation', '01:10', false],
      ['Money request', '01:58', true],
    ]);
  });
  it('is empty for an innocent call', () => {
    const r = deskTimeline(parseTicks([{ atSec: 5, risk: 0, action: 'none', stage: 'none', flags: { creates_urgency: 0.1 } }]));
    expect(r).toEqual({ signals: [], stages: [] });
  });
});

describe('rowSubtitle and callerNumber', () => {
  it('describes sessions', () => {
    expect(rowSubtitle(held)).toBe('Fake police · transfer held');
    expect(rowSubtitle(warned)).toBe('Fake police · warned, ended');
    expect(rowSubtitle(innocent)).toBe('No scam signs');
    expect(rowSubtitle({ peakAction: 'soft_warning', holdStatus: undefined, live: true, scamTypeText: undefined })).toBe('Possible scam · warned');
  });
  it('maps scripts to numbers', () => {
    expect(callerNumber(held)).toBe('+60 3-2611 4402');
    expect(callerNumber({ title: 'Live call' })).toBe('Unknown number');
  });
});
