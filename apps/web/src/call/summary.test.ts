import { RED_FLAG_KEYS, type Action, type FlagScores, type ScamStage } from '@scamshield/shared';
import { describe, expect, it } from 'vitest';
import { shortRm, summarize, summaryStrings } from './summary';
import type { CallState, RiskMessage, TransferMessage, WarningMessage } from './state';

const noFlags = Object.fromEntries(RED_FLAG_KEYS.map((k) => [k, 0])) as FlagScores;

function tick(atSec: number, risk: number, action: Action, stage: ScamStage = 'none'): RiskMessage {
  return { type: 'risk', risk, action, stage, scamType: action === 'none' ? 'none' : 'fake_police', flags: noFlags, scorer: 'jev', latencyMs: 200, atSec };
}
const warn = (action: WarningMessage['action'], audioUrl?: string): WarningMessage => ({
  type: 'warning', action, text: 'x', language: 'en-MY', audioUrl,
});
const transfer = (status: TransferMessage['status'], amountRm: number, atSec: number): TransferMessage => ({
  type: 'transfer', transferId: `t${atSec}`, status, amountRm, toAccount: 'Akaun selamat', atSec,
});

type Input = Pick<CallState, 'transcript' | 'riskHistory' | 'warnings' | 'transfers' | 'risk'>;
function call(riskHistory: RiskMessage[], warnings: WarningMessage[] = [], transfers: TransferMessage[] = []): Input {
  return {
    transcript: [{ speaker: 'caller', text: 'hi', atSec: 1 }],
    riskHistory,
    warnings,
    transfers: Object.fromEntries(transfers.map((t) => [t.transferId, t])),
    risk: riskHistory[riskHistory.length - 1],
  };
}

describe('summarize', () => {
  it('gives the innocent call a calm summary: no warnings, nothing held', () => {
    const s = summarize(call([tick(5, 0.04, 'none'), tick(40, 0.12, 'none')]));
    expect(s.calm).toBe(true);
    expect(s.peak).toEqual({ value: '12%', tone: 'plain' });
    expect(s.firstWarning).toEqual({ value: 'None', label: 'warnings' });
    expect(s.kept).toEqual({ value: 'None', label: 'held', tone: 'plain' });
    expect(s.events).toEqual([]);
    expect(s.subtitle).toBe('00:40 · no scam signs');
  });

  it('tells the scam call that ended held, in time order', () => {
    const history = [
      tick(8, 0.3, 'none', 'authority_setup'),
      tick(52, 0.5, 'soft_warning', 'victim_framing'),
      tick(91, 0.8, 'strong_warning', 'isolation'),
      tick(110, 0.92, 'hold_transfers', 'isolation'),
    ];
    const s = summarize(
      call(history, [warn('soft_warning'), warn('strong_warning', 'a.mp3'), warn('hold_transfers')], [transfer('held', 50000, 118)]),
    );
    expect(s.calm).toBe(false);
    expect(s.peak).toEqual({ value: '92%', tone: 'strong' });
    expect(s.firstWarning).toEqual({ value: '00:52', label: 'first warning' });
    expect(s.kept).toEqual({ value: 'RM50k', label: 'kept safe', tone: 'safe' });
    expect(s.subtitle).toBe('01:58 · likely fake police');
    expect(s.events.map((e) => [e.time, e.text, e.tone])).toEqual([
      ['00:08', 'Caller claims to be an official', 'plain'],
      ['00:52', "Caller says you're caught up in a crime", 'plain'],
      ['00:52', 'Possible scam notice shown', 'soft'],
      ['01:31', 'Told to stay on the line or keep it secret', 'plain'],
      ['01:31', 'Scam alert, read aloud', 'strong'],
      ['01:50', 'Transfers paused', 'strong'],
      ['01:58', 'RM 50,000.00 transfer paused', 'safe'],
    ]);
  });

  it('says transfers were paused when the call reached hold but no money was tried', () => {
    const s = summarize(call([tick(10, 0.9, 'hold_transfers', 'financial_request')], [warn('hold_transfers')]));
    expect(s.kept).toEqual({ value: 'Paused', label: 'transfers', tone: 'strong' });
  });

  it('does not count a released transfer as kept', () => {
    const s = summarize(call([tick(10, 0.9, 'hold_transfers')], [warn('hold_transfers')], [transfer('released', 500, 30)]));
    expect(s.kept.value).toBe('Paused');
    expect(s.events.at(-1)?.text).toBe('RM 500.00 transfer released by you');
  });

  it('times a warning by the first tick that reached its action', () => {
    const s = summarize(call([tick(3, 0.2, 'none'), tick(9, 0.7, 'strong_warning')], [warn('strong_warning')]));
    expect(s.firstWarning.value).toBe('00:09');
  });
});

describe('summarize in Malay', () => {
  it('writes the calm summary and the event lines in Malay', () => {
    const calm = summarize(call([tick(40, 0.1, 'none')]), 'ms');
    expect(calm.subtitle).toBe('00:40 · tiada tanda penipuan');
    expect(calm.kept).toEqual({ value: 'Tiada', label: 'ditahan', tone: 'plain' });
    expect(summaryStrings('ms').calmTitle).toBe('Tiada tanda penipuan dalam panggilan ini');

    const scam = summarize(
      call([tick(8, 0.6, 'soft_warning', 'authority_setup')], [warn('soft_warning')], [transfer('held', 5000, 20)]),
      'ms',
    );
    expect(scam.events.map((e) => e.text)).toEqual([
      'Pemanggil mengaku sebagai pegawai',
      'Notis kemungkinan penipuan dipaparkan',
      'Pindahan RM 5,000.00 ditahan',
    ]);
    expect(scam.kept.label).toBe('selamat');
    expect(scam.firstWarning.label).toBe('amaran pertama');
    expect(scam.subtitle).toBe('00:20 · mungkin polis palsu');
  });
});

describe('shortRm', () => {
  it('shortens thousands to k and keeps smaller amounts whole', () => {
    expect(shortRm(50000)).toBe('RM50k');
    expect(shortRm(5000)).toBe('RM5k');
    expect(shortRm(5250)).toBe('RM5.3k');
    expect(shortRm(12480.5)).toBe('RM12.5k');
    expect(shortRm(750.4)).toBe('RM750');
  });
});
