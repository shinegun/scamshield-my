import type { CallScript } from '@scamshield/shared';
import { CallList } from './CallList';
import { SpeedToggle } from './SpeedToggle';
import './replay.css';

// Left column of the idle desktop page (front-door.dc.html).
export function DesktopFrontDoor({ onPlay }: { onPlay: (script: CallScript) => void }) {
  return (
    <main className="dfd">
      <h1 className="dfd__title">
        Hears the scam.
        <br />
        Holds the money.
      </h1>
      <p className="dfd__lead">
        ScamShield listens to a phone call, warns you in Malay or Manglish as the scam builds, and
        pauses the transfer before money leaves your account.
      </p>
      <div className="dfd__section">
        <span>Play a call · about 2 minutes</span>
        <SpeedToggle light />
      </div>
      <CallList onPlay={onPlay} />
      <p className="dfd__stack">Runs on Gemini, Cloud Run, Firestore and Firebase.</p>
      <p className="dfd__note">Call detection is simulated. Scoring, warnings and the transfer hold are real.</p>
    </main>
  );
}
