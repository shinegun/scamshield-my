import type { TransferMessage } from '../call/state';

// The bank app's screen flow as a pure state machine (#11). It never decides
// whether a transfer is held: it only follows what the pipeline's `transfer`
// reply says (ADR 6). Sending messages and timers live in useBankSession.

export const OPENING_BALANCE_RM = 12480.5;
export const ACCOUNT_NAME = 'Akaun Simpanan';
// Demo cooling-off period. In production this would be 24 hours.
export const RELEASE_DELAY_SEC = 10;

export type BankScreen =
  | 'closed'
  | 'home'
  | 'form'
  | 'pending' // transfer.attempt sent, waiting for the reply
  | 'completed'
  | 'held'
  | 'confirm' // "This was really me": are you sure?
  | 'countdown' // visible delay before the release is sent
  | 'releasing' // transfer.release sent, waiting for the reply
  | 'released';

export interface TransferDraft {
  amountRm: number;
  toAccount: string;
  // Known once the pipeline has answered.
  transferId?: string;
}

export interface BankState {
  screen: BankScreen;
  balanceRm: number;
  transfer?: TransferDraft;
  secondsLeft: number;
  // A short message for the user, e.g. after a failed release.
  notice?: string;
}

export const initialBankState: BankState = {
  screen: 'closed',
  balanceRm: OPENING_BALANCE_RM,
  secondsLeft: RELEASE_DELAY_SEC,
};

export type BankEvent =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'openTransfer' }
  // form -> home, confirm -> held, countdown -> held (cancels the countdown)
  | { type: 'back' }
  | { type: 'submit'; amountRm: number; toAccount: string }
  | { type: 'reply'; transfer: Pick<TransferMessage, 'transferId' | 'status' | 'amountRm' | 'toAccount'> }
  // held -> home: "Cancel transfer". Nothing is sent.
  | { type: 'cancelTransfer' }
  | { type: 'requestRelease' }
  | { type: 'confirmRelease' }
  | { type: 'tick' }
  // done with a completed / released transfer
  | { type: 'done' }
  // The pipeline did not answer or the connection dropped.
  | { type: 'fail'; notice: string };

export function bankReducer(state: BankState, event: BankEvent): BankState {
  const { screen } = state;
  switch (event.type) {
    case 'open':
      return screen === 'closed' ? { ...state, screen: 'home', notice: undefined } : state;

    case 'close':
      // Leaving while a request is in flight would lose the answer.
      if (screen === 'pending' || screen === 'releasing') return state;
      return { ...state, screen: 'closed', transfer: undefined, secondsLeft: RELEASE_DELAY_SEC, notice: undefined };

    case 'openTransfer':
      return screen === 'home' ? { ...state, screen: 'form', transfer: undefined, notice: undefined } : state;

    case 'back':
      if (screen === 'form') return { ...state, screen: 'home', transfer: undefined, notice: undefined };
      if (screen === 'confirm' || screen === 'countdown') {
        return { ...state, screen: 'held', secondsLeft: RELEASE_DELAY_SEC, notice: undefined };
      }
      return state;

    case 'submit':
      if (screen !== 'form') return state;
      return {
        ...state,
        screen: 'pending',
        transfer: { amountRm: event.amountRm, toAccount: event.toAccount },
        notice: undefined,
      };

    case 'reply': {
      const { transfer } = state;
      const reply = event.transfer;
      if (screen === 'pending' && transfer) {
        if (reply.status === 'completed') {
          return {
            ...state,
            screen: 'completed',
            balanceRm: subtract(state.balanceRm, reply.amountRm),
            transfer: { ...transfer, transferId: reply.transferId },
          };
        }
        if (reply.status === 'held') {
          return { ...state, screen: 'held', transfer: { ...transfer, transferId: reply.transferId } };
        }
        return state;
      }
      if (screen === 'releasing' && transfer?.transferId === reply.transferId && reply.status === 'released') {
        return { ...state, screen: 'released', balanceRm: subtract(state.balanceRm, reply.amountRm) };
      }
      return state;
    }

    case 'cancelTransfer':
      return screen === 'held'
        ? { ...state, screen: 'home', transfer: undefined, secondsLeft: RELEASE_DELAY_SEC, notice: undefined }
        : state;

    case 'requestRelease':
      return screen === 'held' ? { ...state, screen: 'confirm' } : state;

    case 'confirmRelease':
      return screen === 'confirm' ? { ...state, screen: 'countdown', secondsLeft: RELEASE_DELAY_SEC } : state;

    case 'tick': {
      if (screen !== 'countdown') return state;
      const secondsLeft = state.secondsLeft - 1;
      return secondsLeft <= 0 ? { ...state, screen: 'releasing', secondsLeft: 0 } : { ...state, secondsLeft };
    }

    case 'done':
      return screen === 'completed' || screen === 'released'
        ? { ...state, screen: 'home', transfer: undefined, secondsLeft: RELEASE_DELAY_SEC }
        : state;

    case 'fail':
      if (screen === 'pending') return { ...state, screen: 'form', notice: event.notice };
      if (screen === 'releasing') {
        return { ...state, screen: 'held', secondsLeft: RELEASE_DELAY_SEC, notice: event.notice };
      }
      return state;
  }
}

// Told to the pipeline in `app.state`.
export function bankAppOpen(state: BankState): boolean {
  return state.screen !== 'closed';
}

export function transferScreenOpen(state: BankState): boolean {
  return state.screen !== 'closed' && state.screen !== 'home';
}

export type TransferInput =
  | { ok: true; amountRm: number; toAccount: string }
  | { ok: false; error: string };

export function validateTransfer(balanceRm: number, accountText: string, amountText: string): TransferInput {
  const toAccount = accountText.trim();
  if (!toAccount) return { ok: false, error: 'Enter a recipient account.' };
  const amountRm = parseAmount(amountText);
  if (amountRm === undefined) return { ok: false, error: 'Enter an amount in RM, for example 500 or 1,250.50.' };
  if (amountRm > balanceRm) return { ok: false, error: 'The amount is more than your balance.' };
  return { ok: true, amountRm, toAccount };
}

// "1,250.50", "RM 500" -> number; anything else (zero, negatives, 3 decimals) -> undefined.
export function parseAmount(text: string): number | undefined {
  const cleaned = text.replace(/^\s*RM\s*/i, '').replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return undefined;
  const value = Number(cleaned);
  return value > 0 ? value : undefined;
}

export function formatRm(amountRm: number): string {
  const [whole = '0', sen = '00'] = Math.abs(amountRm).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${amountRm < 0 ? '-' : ''}RM ${grouped}.${sen}`;
}

function subtract(balanceRm: number, amountRm: number): number {
  return Math.round((balanceRm - amountRm) * 100) / 100;
}
