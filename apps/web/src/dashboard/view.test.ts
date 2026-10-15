import { describe, expect, it } from 'vitest';
import {
  buildChart,
  flagLabel,
  pickSelected,
  relativeTime,
  sortSessions,
  toHoldViews,
  toRiskPoints,
  toSessionView,
} from './view';

const base = { status: 'live', risk: 0.72, action: 'strong_warning', peakAction: 'hold_transfers', updatedAtMs: 100 };

describe('toSessionView', () => {
  it('maps a full document', () => {
    const v = toSessionView('a', {
      ...base,
      scriptId: 'malay-scam',
      language: 'ms',
      stage: 'isolation',
      scamType: 'fake_police',
      flagsSeen: ['claims_authority', 'bogus_flag'],
      holdStatus: 'held',
    });
    expect(v.title).toBe('malay-scam');
    expect(v.percent).toBe('72%');
    expect(v.peakLabel).toBe('Transfers held');
    expect(v.flagsSeen).toEqual(['claims_authority']);
    expect(v.flagLabels).toEqual(['Claims authority']);
    expect(v.holdText).toBe('Held');
    expect(v.scamTypeText).toBe('Fake police');
    expect(v.live).toBe(true);
  });

  it('survives an empty document', () => {
    const v = toSessionView('x', {});
    expect(v.title).toBe('Live call');
    expect(v.live).toBe(false);
    expect(v.percent).toBe('0%');
    expect(v.peakAction).toBe('none');
    expect(v.holdText).toBe('No hold');
    expect(v.scamTypeText).toBeUndefined();
    expect(v.flagLabels).toEqual([]);
  });

  it('never shows a peak below the current action', () => {
    expect(toSessionView('x', { action: 'strong_warning', peakAction: 'none' }).peakAction).toBe('strong_warning');
  });

  it('hides the scam type until the engine acts', () => {
    expect(toSessionView('x', { scamType: 'fake_police', peakAction: 'none' }).scamTypeText).toBeUndefined();
    expect(toSessionView('x', { scamType: 'fake_police', peakAction: 'soft_warning' }).scamTypeText).toBeDefined();
  });

  it('clamps risk', () => {
    expect(toSessionView('x', { risk: 3 }).percent).toBe('100%');
  });
});

describe('ordering and selection', () => {
  const s = (id: string, status: string, updatedAtMs: number) => toSessionView(id, { status, updatedAtMs });
  it('sorts newest first', () => {
    const sorted = sortSessions([s('a', 'ended', 1), s('b', 'live', 3), s('c', 'ended', 2)]);
    expect(sorted.map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });
  it('defaults to the newest live call', () => {
    expect(pickSelected([s('a', 'ended', 9), s('b', 'live', 3), s('c', 'live', 5)], null)).toBe('c');
  });
  it('falls back to the newest call when none is live', () => {
    expect(pickSelected([s('a', 'ended', 1), s('b', 'ended', 2)], null)).toBe('b');
  });
  it('keeps the user pick, but drops it if it vanished', () => {
    const list = [s('a', 'ended', 1), s('b', 'live', 2)];
    expect(pickSelected(list, 'a')).toBe('a');
    expect(pickSelected(list, 'gone')).toBe('b');
  });
  it('handles no sessions', () => {
    expect(pickSelected([], null)).toBeNull();
  });
});

describe('risk chart', () => {
  it('orders points by atSec and tolerates missing fields', () => {
    const pts = toRiskPoints([{ atSec: 20, risk: 0.5 }, { atSec: 5, risk: 0.1, action: 'soft_warning' }, {}]);
    expect(pts.map((p) => p.atSec)).toEqual([0, 5, 20]);
  });
  it('builds an empty chart without a path', () => {
    const c = buildChart([]);
    expect(c.path).toBe('');
    expect(c.bands).toHaveLength(3);
  });
  it('puts higher risk higher up', () => {
    const c = buildChart(
      toRiskPoints([
        { atSec: 0, risk: 0 },
        { atSec: 30, risk: 1 },
      ]),
    );
    expect(c.dots[1]!.y).toBeLessThan(c.dots[0]!.y);
    expect(c.path.startsWith('M')).toBe(true);
  });
});

describe('holds', () => {
  it('formats and orders holds, newest first', () => {
    const v = toHoldViews([
      { id: 'a', data: { status: 'released', amountRm: 10, toAccount: 'X', heldAtMs: 1 } },
      { id: 'b', data: { status: 'held', amountRm: 12500, toAccount: 'Y', heldAtMs: 2 } },
    ]);
    expect(v.map((h) => h.id)).toEqual(['b', 'a']);
    expect(v[0]!.amountText).toBe('RM 12,500.00');
    expect(v[1]!.held).toBe(false);
  });
  it('handles missing fields', () => {
    const [h] = toHoldViews([{ id: 'a', data: {} }]);
    expect(h!.account).toBe('Unknown account');
    expect(h!.amountText).toBe('RM 0.00');
  });
});

describe('formatting', () => {
  it('relative time', () => {
    expect(relativeTime(1000, 2000)).toBe('just now');
    expect(relativeTime(0, 30_000)).toBe('30s ago');
    expect(relativeTime(0, 5 * 60_000)).toBe('5 min ago');
    expect(relativeTime(0, 3 * 3600_000)).toBe('3 h ago');
  });
  it('flag label', () => {
    expect(flagLabel('call_transferred_between_agencies')).toBe('Call transferred between agencies');
  });
});
