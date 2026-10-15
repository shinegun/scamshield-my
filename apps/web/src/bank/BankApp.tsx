import { useState, type ReactNode } from 'react';
import { ACCOUNT_NAME, RELEASE_DELAY_SEC, formatRm } from './bankMachine';
import { langOf } from '../call/labels';
import { useCall } from '../call/CallProvider';
import { holdExplanation, holdStrings } from './explain';
import type { BankSession } from './useBankSession';

const QUICK_RECIPIENTS = ['Mak', 'Landlord', 'Akaun selamat Bank Negara'];

// The fake bank app, drawn over the call. Demo data only.
export function BankApp({ bank }: { bank: BankSession }) {
  const { state, dispatch } = bank;
  const { screen, transfer } = state;
  const canClose = screen !== 'pending' && screen !== 'releasing';

  return (
    <section className="bank" aria-label="Bank app">
      <header className="bank__head">
        <h2 className="bank__title">DemoBank</h2>
        <button
          type="button"
          className="chip"
          onClick={() => dispatch({ type: 'close' })}
          disabled={!canClose}
        >
          Close
        </button>
      </header>

      <div className="bank__body">
        {screen === 'home' && (
          <>
            <Balance balanceRm={state.balanceRm} />
            {!bank.live && (
              <p className="bank__note">The call has ended. Start a new call to try a transfer.</p>
            )}
            <button
              type="button"
              className="bank__btn bank__btn--primary"
              disabled={!bank.live}
              onClick={() => dispatch({ type: 'openTransfer' })}
            >
              Transfer money
            </button>
          </>
        )}

        {screen === 'form' && <TransferForm bank={bank} />}

        {screen === 'pending' && (
          <Status title="Sending transfer…" detail={transfer && `${formatRm(transfer.amountRm)} to ${transfer.toAccount}`} />
        )}

        {screen === 'completed' && transfer && (
          <Result
            tone="ok"
            title="Transfer sent"
            lines={[
              `${formatRm(transfer.amountRm)} to ${transfer.toAccount}`,
              `New balance: ${formatRm(state.balanceRm)}`,
            ]}
            onDone={() => dispatch({ type: 'done' })}
          />
        )}

        {screen === 'held' && transfer && <HeldScreen bank={bank} />}

        {screen === 'confirm' && (
          <>
            <h3 className="bank__h">Before you continue</h3>
            <p className="bank__text">
              Scammers often tell you to say this. Only continue if nobody on a call asked you to make
              this transfer.
            </p>
            <div className="bank__actions">
              <button
                type="button"
                className="bank__btn bank__btn--primary"
                onClick={() => dispatch({ type: 'back' })}
              >
                Go back
              </button>
              <button
                type="button"
                className="bank__btn bank__btn--ghost"
                onClick={() => dispatch({ type: 'confirmRelease' })}
              >
                Nobody asked me to, continue
              </button>
            </div>
          </>
        )}

        {screen === 'countdown' && transfer && (
          <>
            <h3 className="bank__h">Releasing your transfer</h3>
            <p className="bank__text">
              {formatRm(transfer.amountRm)} to {transfer.toAccount} will be released in
            </p>
            <div className="bank__count" role="timer" aria-live="polite">
              {state.secondsLeft}
              <span className="bank__count-unit">s</span>
            </div>
            <progress
              className="bank__progress"
              max={RELEASE_DELAY_SEC}
              value={RELEASE_DELAY_SEC - state.secondsLeft}
              aria-hidden="true"
            />
            <p className="bank__note">In production this cooling-off period would be 24 hours.</p>
            <div className="bank__actions">
              <button
                type="button"
                className="bank__btn bank__btn--primary"
                onClick={() => dispatch({ type: 'back' })}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {screen === 'releasing' && <Status title="Releasing transfer…" />}

        {screen === 'released' && transfer && (
          <Result
            tone="ok"
            title="Transfer released"
            lines={[
              `${formatRm(transfer.amountRm)} to ${transfer.toAccount}`,
              `New balance: ${formatRm(state.balanceRm)}`,
            ]}
            onDone={() => dispatch({ type: 'done' })}
          />
        )}
      </div>
    </section>
  );
}

function Balance({ balanceRm }: { balanceRm: number }) {
  return (
    <div className="bank__card">
      <div className="bank__card-label">{ACCOUNT_NAME}</div>
      <div className="bank__card-balance">{formatRm(balanceRm)}</div>
      <div className="bank__card-sub">Available balance</div>
    </div>
  );
}

function TransferForm({ bank }: { bank: BankSession }) {
  const { state, dispatch } = bank;
  const [account, setAccount] = useState(state.transfer?.toAccount ?? '');
  const [amount, setAmount] = useState(state.transfer ? String(state.transfer.amountRm) : '');
  const [error, setError] = useState<string>();
  const paused = bank.risk?.action === 'hold_transfers';
  const t = holdStrings(langOf(useCall().script?.language));

  return (
    <form
      className="bank__form"
      onSubmit={(e) => {
        e.preventDefault();
        const result = bank.submit(account, amount);
        setError(result.ok ? undefined : result.error);
      }}
    >
      <Balance balanceRm={state.balanceRm} />
      <h3 className="bank__h">Transfer money</h3>

      {paused && (
        <p className="bank__banner" role="status">
          {t.pausedNotice}
        </p>
      )}
      {state.notice && (
        <p className="bank__error" role="alert">
          {state.notice}
        </p>
      )}

      <label className="bank__label" htmlFor="bank-to">
        Recipient account
      </label>
      <input
        id="bank-to"
        className="bank__input"
        type="text"
        placeholder="Akaun penerima"
        autoComplete="off"
        value={account}
        onChange={(e) => setAccount(e.target.value)}
      />
      <div className="bank__quick">
        {QUICK_RECIPIENTS.map((name) => (
          <button key={name} type="button" className="chip" onClick={() => setAccount(name)}>
            {name}
          </button>
        ))}
      </div>

      <label className="bank__label" htmlFor="bank-amount">
        Amount (RM)
      </label>
      <input
        id="bank-amount"
        className="bank__input"
        type="text"
        inputMode="decimal"
        placeholder="0.00"
        autoComplete="off"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      {error && (
        <p className="bank__error" role="alert">
          {error}
        </p>
      )}

      <div className="bank__actions">
        <button type="submit" className="bank__btn bank__btn--primary" disabled={!bank.live}>
          Send transfer
        </button>
        <button type="button" className="bank__btn bank__btn--ghost" onClick={() => dispatch({ type: 'back' })}>
          Back
        </button>
      </div>
    </form>
  );
}

function HeldScreen({ bank }: { bank: BankSession }) {
  const { state, dispatch } = bank;
  const { transfer } = state;
  if (!transfer) return null;
  const lang = langOf(useCall().script?.language);
  const t = holdStrings(lang);
  const why = holdExplanation(bank.risk, lang);

  return (
    <>
      <div className="bank__block" aria-hidden="true">
        !
      </div>
      <h3 className="bank__h bank__h--hold">{t.title}</h3>
      <p className="bank__text">
        {t.body(formatRm(transfer.amountRm), transfer.toAccount, formatRm(state.balanceRm))}
      </p>

      {why.scamLabel && (
        <p className="bank__text">
          {t.looksLike} <strong>{why.scamLabel}</strong>
        </p>
      )}
      {why.phrases.length > 0 ? (
        <>
          <p className="bank__text bank__text--tight">{t.noticed}</p>
          <ul className="bank__reasons">
            {why.phrases.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="bank__text">{t.pausedWhileRisky}</p>
      )}

      {state.notice && (
        <p className="bank__error" role="alert">
          {state.notice}
        </p>
      )}

      <div className="bank__actions">
        <button
          type="button"
          className="bank__btn bank__btn--primary"
          onClick={() => dispatch({ type: 'cancelTransfer' })}
        >
          {t.cancel}
        </button>
        <button
          type="button"
          className="bank__btn bank__btn--ghost"
          onClick={() => dispatch({ type: 'requestRelease' })}
        >
          {t.reallyMe}
        </button>
      </div>
    </>
  );
}

function Status({ title, detail }: { title: string; detail?: ReactNode }) {
  return (
    <div className="bank__status" role="status">
      <div className="bank__spinner" aria-hidden="true" />
      <h3 className="bank__h">{title}</h3>
      {detail && <p className="bank__text">{detail}</p>}
    </div>
  );
}

function Result({
  title,
  lines,
  onDone,
}: {
  tone: 'ok';
  title: string;
  lines: string[];
  onDone(): void;
}) {
  return (
    <>
      <div className="bank__tick" aria-hidden="true">
        ✓
      </div>
      <h3 className="bank__h">{title}</h3>
      {lines.map((l) => (
        <p key={l} className="bank__text">
          {l}
        </p>
      ))}
      <div className="bank__actions">
        <button type="button" className="bank__btn bank__btn--primary" onClick={onDone}>
          Done
        </button>
      </div>
    </>
  );
}
