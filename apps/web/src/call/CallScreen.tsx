import { BankActionBar } from '../bank/BankActionBar';
import { SpeedToggle } from '../replay/SpeedToggle';
import { WarningLayer } from '../warnings/WarningLayer';
import { useCall } from './CallProvider';
import { callerIdOf } from './callerId';
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

  const callerId = callerIdOf(script);

  return (
    <div className="call">
      <div className="call__top">
        <button type="button" className="call__link" onClick={call.reset}>
          ‹ Calls
        </button>
        <div className="call__top-right">
          {script && (
            <button type="button" className="call__link" onClick={() => call.start(script)}>
              Restart
            </button>
          )}
          <SpeedToggle />
        </div>
      </div>

      {/* Banner and pill sit in the flow here; the full-screen overlay is absolute. */}
      <WarningLayer />

      <div className="call__who" data-status={status}>
        <p className="call__time">{statusText(status, elapsedSec)}</p>
        <h1 className="call__number">{callerId?.number ?? 'Unknown number'}</h1>
        {callerId && <p className="call__place">{callerId.place}</p>}
      </div>

      <RiskMeter />
      <TranscriptView />

      {lastError && (
        <p className="call__error" role="status" title={errors.join('\n')}>
          {lastError}
        </p>
      )}

      <BankActionBar />

      <div className="controls">
        <div className="ctl" aria-hidden="true">
          <span className="ctl__btn">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
              <path d="M4 9v6h4l5 4V5L8 9z" />
              <path d="M16 9a4 4 0 010 6" />
            </svg>
          </span>
          speaker
        </div>
        <div className="ctl" aria-hidden="true">
          <span className="ctl__btn">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0014 0M12 18v3" />
            </svg>
          </span>
          mute
        </div>
        <div className="ctl" aria-hidden="true">
          <span className="ctl__btn">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff">
              {[5, 11, 17].flatMap((cy) => [6, 12, 18].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.6" />))}
            </svg>
          </span>
          keypad
        </div>
        <div />
        <div className="ctl">
          <button type="button" className="ctl__btn ctl__btn--end" aria-label="End call" disabled={!open} onClick={call.end}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
              <path d="M3 15c5-5 13-5 18 0l-2 3-4-1v-3a10 10 0 00-6 0v3l-4 1z" />
            </svg>
          </button>
          end
        </div>
        <div />
      </div>
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
