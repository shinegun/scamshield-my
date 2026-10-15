import { useEffect, useRef } from 'react';
import type { CallScript } from '@scamshield/shared';
import { callerIdOf } from './callerId';
import './incoming.css';

// The scripted call ringing, before the replay starts (incoming.dc.html).
export function IncomingCall({
  script,
  onAccept,
  onDecline,
}: {
  script: CallScript;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const callerId = callerIdOf(script);
  const acceptRef = useRef<HTMLButtonElement>(null);
  useEffect(() => acceptRef.current?.focus(), []);

  return (
    <div className="incoming" role="dialog" aria-label={`Incoming call from ${callerId?.number ?? 'unknown number'}`}>
      <p className="incoming__kind">mobile</p>
      <h1 className="incoming__number">{callerId?.number ?? 'Unknown number'}</h1>
      {callerId && <p className="incoming__place">{callerId.place}</p>}

      <p className="incoming__capsule">
        <span className="incoming__tile" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.6">
            <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
          </svg>
        </span>
        ScamShield will listen to this call
      </p>

      <div className="incoming__actions">
        <div className="incoming__ctl">
          <button type="button" className="incoming__btn incoming__btn--decline" aria-label="Decline" onClick={onDecline}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
              <path d="M3 15c5-5 13-5 18 0l-2 3-4-1v-3a10 10 0 00-6 0v3l-4 1z" />
            </svg>
          </button>
          <span aria-hidden="true">Decline</span>
        </div>
        <div className="incoming__ctl">
          <button
            ref={acceptRef}
            type="button"
            className="incoming__btn incoming__btn--accept"
            aria-label="Accept"
            onClick={onAccept}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
            </svg>
          </button>
          <span aria-hidden="true">Accept</span>
        </div>
      </div>
    </div>
  );
}
