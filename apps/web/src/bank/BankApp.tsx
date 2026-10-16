import { useState, type ReactNode } from 'react';
import { RELEASE_DELAY_SEC, formatRm } from './bankMachine';
import { bankStrings } from './strings';
import { langOf } from '../call/labels';
import { useCall } from '../call/CallProvider';
import { holdExplanation, holdStrings } from './explain';
import type { BankSession } from './useBankSession';

// The fake bank app, drawn over the call in the light iOS grouped style. Demo data only.
export function BankApp({ bank }: { bank: BankSession }) {
  const { state, dispatch } = bank;
  const { screen, transfer } = state;
  const lang = langOf(useCall().script?.language);
  const hold = holdStrings(lang);
  const b = bankStrings(lang);
  const canClose = screen !== 'pending' && screen !== 'releasing';

  // Top-left text button: steps back where the machine has a back step, else closes.
  const steps = screen === 'form' || screen === 'confirm' || screen === 'countdown';
  const navLabel = screen === 'held' ? hold.back : steps ? b.back : b.close;
  const title = screen === 'held' ? hold.heldTitle : screen === 'closed' ? undefined : b.titles[screen];

  return (
    <section className="bank" aria-label="Bank app">
      <button
        type="button"
        className="bank__nav"
        onClick={() => dispatch({ type: steps ? 'back' : 'close' })}
        disabled={!canClose}
      >
        {navLabel}
      </button>
      <h2 className="bank__title">{title}</h2>

      <div className="bank__body">
        {screen === 'home' && (
          <>
            <div className="bank__section">{b.accounts}</div>
            <Group>
              <Row label={b.accountName} value={formatRm(state.balanceRm)} />
              <Row label={b.availableBalance} value={formatRm(state.balanceRm)} />
            </Group>
            {!bank.live && (
              <p className="bank__note">{b.callEnded}</p>
            )}
            <div className="bank__actions">
              <button
                type="button"
                className="bank__btn"
                disabled={!bank.live}
                onClick={() => dispatch({ type: 'openTransfer' })}
              >
                {b.transferMoney}
              </button>
            </div>
          </>
        )}

        {screen === 'form' && <TransferForm bank={bank} />}

        {screen === 'pending' && (
          <Status detail={transfer && `${formatRm(transfer.amountRm)} to ${transfer.toAccount}`} />
        )}

        {screen === 'completed' && transfer && (
          <Result
            rows={[
              [b.to, transfer.toAccount],
              [b.amount.replace(' (RM)', ''), formatRm(transfer.amountRm)],
              [b.newBalance, formatRm(state.balanceRm)],
            ]}
            onDone={() => dispatch({ type: 'done' })}
          />
        )}

        {screen === 'held' && transfer && <HeldScreen bank={bank} />}

        {screen === 'confirm' && (
          <>
            <p className="bank__text">
              {b.confirmText}
            </p>
            <div className="bank__actions">
              <button type="button" className="bank__btn" onClick={() => dispatch({ type: 'back' })}>
                {b.goBack}
              </button>
              <button
                type="button"
                className="bank__link"
                onClick={() => dispatch({ type: 'confirmRelease' })}
              >
                {b.nobodyAsked}
              </button>
            </div>
          </>
        )}

        {screen === 'countdown' && transfer && (
          <>
            <p className="bank__text">
              {b.releasedIn(formatRm(transfer.amountRm), transfer.toAccount)}
            </p>
            <div className="bank__count-card">
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
            </div>
            <p className="bank__note">{b.coolingOff}</p>
            <div className="bank__actions">
              <button type="button" className="bank__destructive" onClick={() => dispatch({ type: 'back' })}>
                {b.cancel}
              </button>
            </div>
          </>
        )}

        {screen === 'releasing' && <Status />}

        {screen === 'released' && transfer && (
          <Result
            rows={[
              [b.to, transfer.toAccount],
              [b.amount.replace(' (RM)', ''), formatRm(transfer.amountRm)],
              [b.newBalance, formatRm(state.balanceRm)],
            ]}
            onDone={() => dispatch({ type: 'done' })}
          />
        )}
      </div>
    </section>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <div className="bank__group">{children}</div>;
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'alert' }) {
  return (
    <div className="bank__row">
      <span className="bank__row-label">{label}</span>
      <span className={tone === 'alert' ? 'bank__row-value bank__row-value--alert' : 'bank__row-value'}>
        {value}
      </span>
    </div>
  );
}

function TransferForm({ bank }: { bank: BankSession }) {
  const { state, dispatch } = bank;
  const [account, setAccount] = useState(state.transfer?.toAccount ?? '');
  const [amount, setAmount] = useState(state.transfer ? String(state.transfer.amountRm) : '');
  const [error, setError] = useState<string>();
  const paused = bank.risk?.action === 'hold_transfers';
  const lang = langOf(useCall().script?.language);
  const t = holdStrings(lang);
  const b = bankStrings(lang);

  return (
    <form
      className="bank__form"
      onSubmit={(e) => {
        e.preventDefault();
        const result = bank.submit(account, amount);
        setError(result.ok ? undefined : result.error);
      }}
    >
      {paused && (
        <p className="bank__alert" role="status">
          {t.pausedNotice}
        </p>
      )}
      {state.notice && (
        <p className="bank__alert" role="alert">
          {state.notice}
        </p>
      )}

      <div className="bank__section">{b.transferFrom} {b.accountName}</div>
      <Group>
        <div className="bank__row">
          <label className="bank__row-label" htmlFor="bank-to">
            {b.recipient}
          </label>
          <input
            id="bank-to"
            className="bank__input"
            type="text"
            placeholder={b.recipientPlaceholder}
            autoComplete="off"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          />
        </div>
        <div className="bank__row">
          <label className="bank__row-label" htmlFor="bank-amount">
            {b.amount}
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
        </div>
      </Group>
      <p className="bank__note">{b.availableBalance} {formatRm(state.balanceRm)}</p>

      <div className="bank__section">{b.suggested}</div>
      <Group>
        {b.quickRecipients.map((name) => (
          <button key={name} type="button" className="bank__row bank__row--button" onClick={() => setAccount(name)}>
            {name}
          </button>
        ))}
      </Group>

      {error && (
        <p className="bank__alert" role="alert">
          {error}
        </p>
      )}

      <div className="bank__actions">
        <button type="submit" className="bank__btn" disabled={!bank.live}>
          {b.sendTransfer}
        </button>
      </div>
    </form>
  );
}

function HeldScreen({ bank }: { bank: BankSession }) {
  const { state, dispatch } = bank;
  const { transfer } = state;
  const lang = langOf(useCall().script?.language);
  if (!transfer) return null;
  const t = holdStrings(lang);
  const why = holdExplanation(bank.risk, lang);
  const [reason, ...rest] = why.phrases;

  return (
    <>
      <div className="bank__hero">
        <div className="bank__hero-label">{t.stillIn}</div>
        <div className="bank__hero-amount">{formatRm(transfer.amountRm)}</div>
        <p className="bank__hero-text">{t.because(why.scamLabel)}</p>
      </div>

      <div className="bank__section">{t.transferSection}</div>
      <Group>
        <Row label={t.to} value={transfer.toAccount} />
        {reason && <Row label={t.reason} value={reason} tone="alert" />}
      </Group>

      {rest.length > 0 && (
        <>
          <div className="bank__section">{t.noticedSection}</div>
          <Group>
            {rest.map((p) => (
              <div key={p} className="bank__row">
                <span className="bank__row-label">{p}</span>
              </div>
            ))}
          </Group>
        </>
      )}

      {state.notice && (
        <p className="bank__alert" role="alert">
          {state.notice}
        </p>
      )}

      <div className="bank__actions">
        <a className="bank__btn" href="tel:997">
          {t.callCentre}
        </a>
        <button type="button" className="bank__destructive" onClick={() => dispatch({ type: 'cancelTransfer' })}>
          {t.cancel}
        </button>
        <button type="button" className="bank__link bank__link--small" onClick={() => dispatch({ type: 'requestRelease' })}>
          {t.reallyMe}
        </button>
      </div>
    </>
  );
}

function Status({ detail }: { detail?: ReactNode }) {
  return (
    <div className="bank__status" role="status">
      <div className="bank__spinner" aria-hidden="true" />
      {detail && <p className="bank__text">{detail}</p>}
    </div>
  );
}

function Result({ rows, onDone }: { rows: [string, string][]; onDone(): void }) {
  const b = bankStrings(langOf(useCall().script?.language));
  return (
    <>
      <Group>
        {rows.map(([label, value]) => (
          <Row key={label} label={label} value={value} />
        ))}
      </Group>
      <div className="bank__actions">
        <button type="button" className="bank__btn" onClick={onDone}>
          {b.done}
        </button>
      </div>
    </>
  );
}
