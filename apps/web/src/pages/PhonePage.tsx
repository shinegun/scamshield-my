import { Link } from 'react-router-dom';
import { useCall } from '../call/CallProvider';
import { CallScreen } from '../call/CallScreen';
import { CallSummary } from '../call/CallSummary';
import { InspectorPanel } from '../call/InspectorPanel';
import { PhoneFrame } from '../phone/PhoneFrame';
import { ReplayFrontDoor } from '../replay/ReplayFrontDoor';
import { useMediaQuery } from '../useMediaQuery';
import './desktop.css';

// The phone: the replay front door until a call starts, then the call. On a
// wide screen a call also shows the "What ScamShield hears" panel.
export function PhonePage() {
  const { status, script, speed } = useCall();
  const wide = useMediaQuery('(min-width: 1100px)');
  const desk = wide && status !== 'idle';
  // One tree for both layouts: only the wrappers change, so resizing across
  // 1100 px mid-call never remounts the call screen. A remount would stop a
  // spoken warning, re-show dismissed alerts and reset the bank app.
  return (
    <div className={desk ? 'desk' : 'desk-off'}>
      {desk && (
        <nav className="desk__nav">
          <div className="desk__brand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
            </svg>
            ScamShield
          </div>
          <Link className="desk__link desk__link--current" to="/" aria-current="page">Live call</Link>
          <Link className="desk__link" to="/dashboard">Fraud desk</Link>
          <Link className="desk__link" to="/race">Jev vs Gemini</Link>
          {script && (
            <div className="desk__meta">
              {script.title} · {speed}×
            </div>
          )}
        </nav>
      )}
      <div className={desk ? 'desk__grid' : 'desk-off'}>
        <div className={desk ? 'desk__phone' : 'desk-off'}>
          <PhoneFrame>
            {status === 'idle' ? <ReplayFrontDoor /> : status === 'ended' ? <CallSummary /> : <CallScreen />}
          </PhoneFrame>
        </div>
        {desk && <InspectorPanel />}
      </div>
    </div>
  );
}
