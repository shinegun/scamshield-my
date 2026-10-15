import { useState, type ReactNode } from 'react';
import { ACCOUNT_NAME, RELEASE_DELAY_SEC, formatRm, type BankScreen } from './bankMachine';
import { langOf } from '../call/labels';
import { useCall } from '../call/CallProvider';
import { holdExplanation, holdStrings } from './explain';
import type { BankSession } from './useBankSession';

const QUICK_RECIPIENTS = ['Mak', 'Landlord', 'Akaun selamat Bank Negara'];

const TITLES: Partial<Record<BankScreen, string>> = {
  home: 'DemoBank',
  form: 'Transfer money',
  pending: 'Sending transfer…',
  completed: 'Transfer sent',
  confirm: 'Before you continue',
  countdown: 'Releasing transfer',
  releasing: 'Releasing transfer…',
  released: 'Transfer released',
};

// The fake bank app, drawn over the call in the light iOS grouped style. Demo data only.
export function BankApp({ bank }: { bank: BankSession }) {
  const { state, dispatch } = bank;
  const { screen, transfer } = state;
  const lang = langOf(useCall().script?.language);
  const hold = holdStrings(lang);
  const canClose = screen !== 'pending' && screen !== 'releasing';

  // Top-left text button: steps back where the machine has a back step, else closes.
  const steps = screen === 'form' || screen === 'confirm' || screen === 'countdown';
  const navLabel = screen === 'held' ? hold.back : steps ? '‹ Back' : 'Close';
  const title = screen === 'held' ? hold.heldTitle : TITLES[screen];

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
            <div className="bank__section">Accounts</div>
            <Group>
              <Row label={ACCOUNT_NAME} value={formatRm(state.balanceRm)} />
              <Row label="Available balance" value={formatRm(state.balanceRm)} />
            </Group>
            {!bank.live && (
              <p className="bank__note">The call has ended. Start a new call to try a transfer.</p>
            )}
            <div className="bank__actions">
              <button
                type="button"
                className="bank__btn"
                disabled={!bank.live}
                onClick={() => dispatch({ type: 'openTransfer' })}
              >
                Transfer money
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
              ['To', transfer.toAccount],
              ['Amount', formatRm(transfer.amountRm)],
              ['New balance', formatRm(state.balanceRm)],
            ]}
            onDone={() => dispatch({ type: 'done' })}
          />
        )}

        {screen === 'held' && transfer && <HeldScreen bank={bank} />}

        {screen === 'confirm' && (
          <>
            <p className="bank__text">
              Scammers often tell you to say this. Only continue if nobody on a call asked you to make
              this transfer.
            </p>
            <div className="bank__actions">
              <button type="button" className="bank__btn" onClick={() => dispatch({ type: 'back' })}>
                Go back
              </button>
              <button
                type="button"
                className="bank__link"
                onClick={() => dispatch({ type: 'confirmRelease' })}
              >
                Nobody asked me to, continue
              </button>
            </div>
          </>
        )}

        {screen === 'countdown' && transfer && (
          <>
            <p className="bank__text">
              {formatRm(transfer.amountRm)} to {transfer.toAccount} will be released in
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
            <p className="bank__note">In production this cooling-off period would be 24 hours.</p>
            <div className="bank__actions">
              <button type="button" className="bank__destructive" onClick={() => dispatch({ type: 'back' })}>
                Cancel
              </button>
            </div>
          </>
        )}

        {screen === 'releasing' && <Status />}

        {screen === 'released' && transfer && (
          <Result
            rows={[
              ['To', transfer.toAccount],
              ['Amount', formatRm(transfer.amountRm)],
              ['New balance', formatRm(state.balanceRm)],
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

      <div className="bank__section">Transfer from {ACCOUNT_NAME}</div>
      <Group>
        <div className="bank__row">
          <label className="bank__row-label" htmlFor="bank-to">
            Recipient
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
        </div>
        <div className="bank__row">
          <label className="bank__row-label" htmlFor="bank-amount">
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
        </div>
      </Group>
      <p className="bank__note">Available balance {formatRm(state.balanceRm)}</p>

      <div className="bank__section">Suggested</div>
      <Group>
        {QUICK_RECIPIENTS.map((name) => (
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
          Send transfer
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
  return (
    <>
      <Group>
        {rows.map(([label, value]) => (
          <Row key={label} label={label} value={value} />
        ))}
      </Group>
      <div className="bank__actions">
        <button type="button" className="bank__btn" onClick={onDone}>
          Done
        </button>
      </div>
    </>
  );
}
