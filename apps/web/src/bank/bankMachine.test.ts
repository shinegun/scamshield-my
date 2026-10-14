import { describe, expect, it } from 'vitest';
import {
  OPENING_BALANCE_RM,
  RELEASE_DELAY_SEC,
  bankAppOpen,
  bankReducer,
  formatRm,
  initialBankState,
  parseAmount,
  transferScreenOpen,
  validateTransfer,
  type BankEvent,
  type BankState,
} from './bankMachine';

function run(events: BankEvent[], from: BankState = initialBankState): BankState {
  return events.reduce(bankReducer, from);
}

const toForm: BankEvent[] = [{ type: 'open' }, { type: 'openTransfer' }];
const submit: BankEvent = { type: 'submit', amountRm: 500, toAccount: 'Mak' };
const reply = (status: 'completed' | 'held' | 'released', transferId = 't1'): BankEvent => ({
  type: 'reply',
  transfer: { transferId, status, amountRm: 500, toAccount: 'Mak' },
});
const toHeld: BankEvent[] = [...toForm, submit, reply('held')];
const toCountdown: BankEvent[] = [...toHeld, { type: 'requestRelease' }, { type: 'confirmRelease' }];
const ticks = (n: number): BankEvent[] => Array.from({ length: n }, () => ({ type: 'tick' }));

describe('bank machine', () => {
  it('opens, goes to the form and back', () => {
    const open = run([{ type: 'open' }]);
    expect(open.screen).toBe('home');
    expect(run([{ type: 'open' }, { type: 'openTransfer' }]).screen).toBe('form');
    expect(run([...toForm, { type: 'back' }]).screen).toBe('home');
    expect(run([...toForm, { type: 'close' }]).screen).toBe('closed');
  });

  it('completed transfer reduces the balance', () => {
    const pending = run([...toForm, submit]);
    expect(pending.screen).toBe('pending');
    expect(pending.balanceRm).toBe(OPENING_BALANCE_RM);
    const done = bankReducer(pending, reply('completed'));
    expect(done.screen).toBe('completed');
    expect(done.balanceRm).toBe(11980.5);
    expect(bankReducer(done, { type: 'done' }).screen).toBe('home');
  });

  it('held transfer leaves the balance unchanged', () => {
    const held = run(toHeld);
    expect(held.screen).toBe('held');
    expect(held.balanceRm).toBe(OPENING_BALANCE_RM);
    expect(held.transfer?.transferId).toBe('t1');
  });

  it('cancelling a held transfer returns home without changing the balance', () => {
    const cancelled = run([...toHeld, { type: 'cancelTransfer' }]);
    expect(cancelled.screen).toBe('home');
    expect(cancelled.transfer).toBeUndefined();
    expect(cancelled.balanceRm).toBe(OPENING_BALANCE_RM);
  });

  it('release path: confirm, countdown, releasing, released reduces the balance', () => {
    expect(run([...toHeld, { type: 'requestRelease' }]).screen).toBe('confirm');
    const counting = run(toCountdown);
    expect(counting.screen).toBe('countdown');
    expect(counting.secondsLeft).toBe(RELEASE_DELAY_SEC);

    const almost = run(ticks(RELEASE_DELAY_SEC - 1), counting);
    expect(almost.screen).toBe('countdown');
    expect(almost.secondsLeft).toBe(1);

    const releasing = bankReducer(almost, { type: 'tick' });
    expect(releasing.screen).toBe('releasing');
    expect(releasing.balanceRm).toBe(OPENING_BALANCE_RM);

    const released = bankReducer(releasing, reply('released'));
    expect(released.screen).toBe('released');
    expect(released.balanceRm).toBe(11980.5);
  });

  it('ignores a released reply for a different transfer', () => {
    const releasing = run([...toCountdown, ...ticks(RELEASE_DELAY_SEC)]);
    expect(bankReducer(releasing, reply('released', 'other')).screen).toBe('releasing');
  });

  it('cancelling during the countdown goes back to held and never releases', () => {
    const mid = run([...toCountdown, ...ticks(4)]);
    const back = bankReducer(mid, { type: 'back' });
    expect(back.screen).toBe('held');
    expect(back.secondsLeft).toBe(RELEASE_DELAY_SEC);
    expect(bankReducer(back, { type: 'tick' }).screen).toBe('held');
    expect(back.balanceRm).toBe(OPENING_BALANCE_RM);
    // Going back from the confirm step also returns to held.
    expect(run([...toHeld, { type: 'requestRelease' }, { type: 'back' }]).screen).toBe('held');
  });

  it('cannot close while a request is in flight', () => {
    expect(run([...toForm, submit, { type: 'close' }]).screen).toBe('pending');
    const releasing = run([...toCountdown, ...ticks(RELEASE_DELAY_SEC), { type: 'close' }]);
    expect(releasing.screen).toBe('releasing');
  });

  it('a failed request returns to the form or the held screen with a notice', () => {
    const form = run([...toForm, submit, { type: 'fail', notice: 'lost' }]);
    expect(form.screen).toBe('form');
    expect(form.notice).toBe('lost');
    expect(form.transfer?.toAccount).toBe('Mak');
    const held = run([...toCountdown, ...ticks(RELEASE_DELAY_SEC), { type: 'fail', notice: 'no' }]);
    expect(held.screen).toBe('held');
    expect(held.transfer?.transferId).toBe('t1');
  });

  it('ignores events that do not fit the current screen', () => {
    expect(bankReducer(initialBankState, submit)).toBe(initialBankState);
    expect(bankReducer(initialBankState, reply('completed'))).toBe(initialBankState);
    const form = run(toForm);
    expect(bankReducer(form, { type: 'confirmRelease' })).toBe(form);
    expect(bankReducer(form, { type: 'tick' })).toBe(form);
  });

  it('reports bank and transfer screen state for app.state', () => {
    expect(bankAppOpen(initialBankState)).toBe(false);
    const home = run([{ type: 'open' }]);
    expect([bankAppOpen(home), transferScreenOpen(home)]).toEqual([true, false]);
    const form = run(toForm);
    expect([bankAppOpen(form), transferScreenOpen(form)]).toEqual([true, true]);
    expect(transferScreenOpen(run(toHeld))).toBe(true);
  });
});

describe('transfer input', () => {
  it('parses amounts', () => {
    expect(parseAmount('500')).toBe(500);
    expect(parseAmount('RM 1,250.50')).toBe(1250.5);
    expect(parseAmount('0')).toBeUndefined();
    expect(parseAmount('-5')).toBeUndefined();
    expect(parseAmount('1.234')).toBeUndefined();
    expect(parseAmount('abc')).toBeUndefined();
  });

  it('validates recipient and balance', () => {
    expect(validateTransfer(1000, ' Mak ', '200')).toEqual({ ok: true, amountRm: 200, toAccount: 'Mak' });
    expect(validateTransfer(1000, '', '200').ok).toBe(false);
    expect(validateTransfer(1000, 'Mak', '').ok).toBe(false);
    expect(validateTransfer(1000, 'Mak', '1000.01').ok).toBe(false);
  });

  it('formats ringgit', () => {
    expect(formatRm(12480.5)).toBe('RM 12,480.50');
    expect(formatRm(5)).toBe('RM 5.00');
  });
});
