import { BankActionBar } from '../bank/BankActionBar';
import { SpeedToggle } from '../replay/SpeedToggle';
import { WarningLayer } from '../warnings/WarningLayer';
import { useCall } from './CallProvider';
import { formatClock } from './labels';
import { RiskMeter } from './RiskMeter';
import { TranscriptView } from './TranscriptView';
import './call.css';

export function CallScreen() {
  const call = useCall();
  const { status, script, transcript, risk, errors } = call;

  const elapsedSec = Math.max(risk?.atSec ?? 0, transcript[transcript.length - 1]?.atSec ?? 0);
  const lastError = errors[errors.length - 1];
  const open = status === 'connecting' || status === 'live';

  return (
    <div className="call">
      <header className="call__head">
        <div className="call__avatar" aria-hidden="true">
          ?
        </div>
        <div className="call__who">
          <h1 className="call__name">Unknown number</h1>
          <p className="call__sub" data-status={status}>
            {statusText(status, elapsedSec)}
          </p>
        </div>
        <SpeedToggle />
      </header>

      <div className="call__toolbar">
        <button type="button" className="chip" onClick={call.reset}>
          ← Back to calls
        </button>
        {script && (
          <button type="button" className="chip" onClick={() => call.start(script)}>
            ↻ Restart
          </button>
        )}
        {open && (
          <button type="button" className="chip chip--end" onClick={call.end}>
            End call
          </button>
        )}
      </div>

      <RiskMeter />
      <TranscriptView />

      {lastError && (
        <p className="call__error" role="status" title={errors.join('\n')}>
          {lastError}
        </p>
      )}

      <BankActionBar />
      <WarningLayer />
    </div>
  );
}

function statusText(status: ReturnType<typeof useCall>['status'], elapsedSec: number): string {
  switch (status) {
    case 'connecting':
      return 'Connecting…';
    case 'live':
      return formatClock(elapsedSec);
    case 'ended':
      return `Call ended · ${formatClock(elapsedSec)}`;
    case 'error':
      return 'Connection problem';
    default:
      return '';
  }
}
