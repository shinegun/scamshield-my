import { Link } from 'react-router-dom';
import type { CallScript } from '@scamshield/shared';
import { CallList } from './CallList';
import { SpeedToggle } from './SpeedToggle';
import './replay.css';

// The front door inside the phone (narrow screens): three calls, one tap to ring.
export function ReplayFrontDoor({ onPlay }: { onPlay: (script: CallScript) => void }) {
  return (
    <main className="door">
      <h1 className="door__title">ScamShield</h1>
      <p className="door__lead">Hears the scam. Holds the money.</p>

      <div className="door__section">
        <span>Play a call · about 2 minutes</span>
        <SpeedToggle />
      </div>
      <CallList onPlay={onPlay} />

      <div className="door__notes">
        <p>Runs on Gemini, Cloud Run, Firestore and Firebase.</p>
        <p>Call detection is simulated. Scoring, warnings and the transfer hold are real.</p>
      </div>

      <ul className="door__links">
        <li>
          <Link to="/dashboard">
            Fraud desk <Chevron />
          </Link>
        </li>
        <li>
          <Link to="/race">
            Jev vs Gemini <Chevron />
          </Link>
        </li>
      </ul>
    </main>
  );
}

function Chevron() {
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M1 1l6 6-6 6" />
    </svg>
  );
}
