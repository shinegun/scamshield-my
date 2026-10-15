import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CALL_SCRIPTS, type CallScript } from '@scamshield/shared';
import { useCall } from '../call/CallProvider';
import { CallScreen } from '../call/CallScreen';
import { CallSummary } from '../call/CallSummary';
import { IncomingCall } from '../call/IncomingCall';
import { InspectorPanel } from '../call/InspectorPanel';
import { PhoneFrame } from '../phone/PhoneFrame';
import { DesktopFrontDoor } from '../replay/DesktopFrontDoor';
import { ReplayFrontDoor } from '../replay/ReplayFrontDoor';
import { useMediaQuery } from '../useMediaQuery';
import './desktop.css';

// The phone: the replay front door until a call starts, then the call. On a
// wide screen a call also shows the "What ScamShield hears" panel.
export function PhonePage() {
  const { status, script, speed, start } = useCall();
  // A picked script rings first; Accept starts the replay exactly as Play did.
  const [ringing, setRinging] = useState<CallScript | null>(null);
  const wide = useMediaQuery('(min-width: 1100px)');
  // Idle on a wide screen: the front door page with a ringing phone beside it.
  // The default preview rings the Manglish call until it is declined.
  const [previewDeclined, setPreviewDeclined] = useState(false);
  const idleDesk = wide && status === 'idle';
  const desk = wide && status !== 'idle';
  const preview = CALL_SCRIPTS.find((s) => s.id === 'scam-manglish');
  // One tree for both layouts: only the wrappers change, so resizing across
  // 1100 px mid-call never remounts the call screen. A remount would stop a
  // spoken warning, re-show dismissed alerts and reset the bank app.
  const accept = (s: CallScript) => {
    setRinging(null);
    start(s);
  };
  const ringingScript = ringing ?? (idleDesk && !previewDeclined ? preview : undefined);
  const decline = () => {
    if (ringing) setRinging(null);
    else setPreviewDeclined(true);
  };
  return (
    <div className={desk ? 'desk' : idleDesk ? 'desk desk--idle' : 'desk-off'}>
      {(desk || idleDesk) && (
        <nav className="desk__nav">
          <div className="desk__brand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
            </svg>
            ScamShield
          </div>
          {desk && (
            <Link className="desk__link desk__link--current" to="/" aria-current="page">Live call</Link>
          )}
          <Link className={idleDesk ? 'desk__link desk__link--right' : 'desk__link'} to="/dashboard">Fraud desk</Link>
          <Link className="desk__link" to="/race">Jev vs Gemini</Link>
          {desk && script && (
            <div className="desk__meta">
              {script.title} · {speed}×
            </div>
          )}
        </nav>
      )}
      <div className={desk ? 'desk__grid' : idleDesk ? 'desk__grid desk__grid--idle' : 'desk-off'}>
        {idleDesk && <DesktopFrontDoor onPlay={setRinging} />}
        <div className={desk ? 'desk__phone' : idleDesk ? 'desk__phone' : 'desk-off'}>
          <PhoneFrame link={status !== 'idle'}>
            {status === 'idle' ? (
              ringingScript ? (
                <IncomingCall
                  script={ringingScript}
                  onDecline={decline}
                  onAccept={() => accept(ringingScript)}
                />
              ) : idleDesk ? (
                <p className="desk__quiet">Pick a call to ring this phone</p>
              ) : (
                <ReplayFrontDoor onPlay={setRinging} />
              )
            ) : status === 'ended' ? (
              <CallSummary />
            ) : (
              <CallScreen />
            )}
          </PhoneFrame>
        </div>
        {desk && <InspectorPanel />}
      </div>
    </div>
  );
}
