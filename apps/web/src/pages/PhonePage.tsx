import { Link } from 'react-router-dom';
import { useCall } from '../call/CallProvider';
import { CallScreen } from '../call/CallScreen';
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
  if (!wide || status === 'idle') {
    return <PhoneFrame>{status === 'idle' ? <ReplayFrontDoor /> : <CallScreen />}</PhoneFrame>;
  }
  return (
    <div className="desk">
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
      <div className="desk__grid">
        <div className="desk__phone">
          <PhoneFrame>
            <CallScreen />
          </PhoneFrame>
        </div>
        <InspectorPanel />
      </div>
    </div>
  );
}
