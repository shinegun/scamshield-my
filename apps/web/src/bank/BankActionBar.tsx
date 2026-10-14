import { useCall } from '../call/CallProvider';
import { BankApp } from './BankApp';
import { useBankSession } from './useBankSession';
import './bank.css';

// Bottom action bar of the call screen. "Open bank app" is available once a
// call has started; the bank screen is an overlay over the call (#11).
export function BankActionBar() {
  const { status, sessionId } = useCall();
  const started = status === 'live' || status === 'ended';
  // A new call gets a new session id, which remounts the bank with fresh state.
  return <BankSession key={sessionId ?? 'no-call'} enabled={started} />;
}

function BankSession({ enabled }: { enabled: boolean }) {
  const bank = useBankSession();
  return (
    <>
      <div className="bank-bar">
        <button
          type="button"
          className="bank-bar__open"
          disabled={!enabled}
          onClick={() => bank.dispatch({ type: 'open' })}
        >
          Open bank app
        </button>
      </div>
      {bank.state.screen !== 'closed' && <BankApp bank={bank} />}
    </>
  );
}
