import { describe, expect, it } from 'vitest';
import type { ServerMessage } from '../packages/shared/src/events';
import { judge, median } from './health-judge';

const risk = (r: number, action: 'none' | 'warn' | 'hold_transfers', latencyMs = 100): ServerMessage =>
  ({ type: 'risk', risk: r, action, stage: 'none', scamType: 'none', flags: {}, scorer: 'gemini', latencyMs, atSec: 1 }) as unknown as ServerMessage;
const transfer = (status: 'held' | 'completed'): ServerMessage => ({
  type: 'transfer',
  transferId: 't',
  status,
  amountRm: 5000,
  toAccount: 'x',
  atSec: 2,
});
const warning = { type: 'warning', action: 'warn', text: 'careful', language: 'en-MY' } as unknown as ServerMessage;

describe('judge', () => {
  it('passes a held scam', () => {
    const v = judge('scam', [risk(0.2, 'none'), risk(0.9, 'hold_transfers'), transfer('held')]);
    expect(v.pass).toBe(true);
    expect(v.peakRisk).toBe(0.9);
  });
  it('fails a scam whose transfer completes', () => {
    expect(judge('scam', [risk(0.9, 'hold_transfers'), transfer('completed')]).pass).toBe(false);
  });
  it('passes a quiet innocent call', () => {
    expect(judge('innocent', [risk(0.05, 'none'), transfer('completed')]).pass).toBe(true);
  });
  it('fails an innocent call that warns or holds', () => {
    expect(judge('innocent', [risk(0.5, 'warn'), warning, transfer('completed')]).pass).toBe(false);
    expect(judge('innocent', [risk(0.9, 'hold_transfers'), transfer('held')]).pass).toBe(false);
  });
  it('fails on server error or silence', () => {
    expect(judge('scam', [{ type: 'error', message: 'boom' }]).pass).toBe(false);
  });
  it('computes a median', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});
