import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useCall } from '../call/CallProvider';
import {
  bankAppOpen,
  bankReducer,
  initialBankState,
  transferScreenOpen,
  validateTransfer,
  type TransferInput,
} from './bankMachine';

// Connects the pure bank machine to the call: sends app.state, transfer.attempt
// and transfer.release, and feeds the pipeline's `transfer` replies back in.
// Mounted under a key of the session id, so a new call starts from a fresh bank.
export function useBankSession() {
  const call = useCall();
  const { status, send, lastTransfer, errors } = call;
  const [state, dispatch] = useReducer(bankReducer, initialBankState);

  // app.state, only while the call is live and only when it changed.
  const lastSent = useRef({ bankAppOpen: false, transferScreenOpen: false });
  const open = bankAppOpen(state);
  const transferOpen = transferScreenOpen(state);
  useEffect(() => {
    if (status !== 'live') return;
    const prev = lastSent.current;
    if (prev.bankAppOpen === open && prev.transferScreenOpen === transferOpen) return;
    lastSent.current = { bankAppOpen: open, transferScreenOpen: transferOpen };
    send({ type: 'app.state', bankAppOpen: open, transferScreenOpen: transferOpen });
  }, [status, open, transferOpen, send]);

  // Replies. The server answers in order, so each new `transfer` message is the
  // answer to the request in flight; the machine ignores it otherwise.
  const handled = useRef(lastTransfer);
  useEffect(() => {
    if (!lastTransfer || lastTransfer === handled.current) return;
    handled.current = lastTransfer;
    dispatch({ type: 'reply', transfer: lastTransfer });
  }, [lastTransfer]);

  // Countdown before the release is sent.
  const counting = state.screen === 'countdown';
  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => dispatch({ type: 'tick' }), 1000);
    return () => clearInterval(timer);
  }, [counting]);

  // Send the release once when the countdown has run out.
  const releaseSent = useRef<string | null>(null);
  const releaseId = state.screen === 'releasing' ? state.transfer?.transferId : undefined;
  useEffect(() => {
    if (!releaseId) {
      releaseSent.current = null;
      return;
    }
    if (releaseSent.current === releaseId) return;
    releaseSent.current = releaseId;
    send({ type: 'transfer.release', transferId: releaseId });
  }, [releaseId, send]);

  // An error while a release is in flight (e.g. "No held transfer").
  const seenErrors = useRef(errors);
  useEffect(() => {
    if (errors === seenErrors.current) return;
    seenErrors.current = errors;
    if (state.screen === 'releasing') {
      dispatch({ type: 'fail', notice: 'The transfer could not be released. Please try again.' });
    }
  }, [errors, state.screen]);

  // The call dropped while waiting for an answer.
  const waiting = state.screen === 'pending' || state.screen === 'releasing';
  useEffect(() => {
    if (waiting && status !== 'live') {
      dispatch({ type: 'fail', notice: 'The call connection was lost. Please try again.' });
    }
  }, [waiting, status]);

  const submit = useCallback(
    (accountText: string, amountText: string): TransferInput => {
      const input = validateTransfer(state.balanceRm, accountText, amountText);
      if (input.ok && status === 'live') {
        dispatch({ type: 'submit', amountRm: input.amountRm, toAccount: input.toAccount });
        send({ type: 'transfer.attempt', amountRm: input.amountRm, toAccount: input.toAccount });
      }
      return input;
    },
    [state.balanceRm, status, send],
  );

  return { state, dispatch, submit, live: status === 'live', risk: call.risk };
}

export type BankSession = ReturnType<typeof useBankSession>;
