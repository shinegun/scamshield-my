import { Link } from 'react-router-dom';
import { CALL_SCRIPTS, scriptDurationSec, type CallScript } from '@scamshield/shared';
import { useCall } from '../call/CallProvider';
import { ACTION_LABELS } from '../call/labels';
import { SpeedToggle } from './SpeedToggle';
import './replay.css';

// What a first-time visitor sees: three calls, one tap to start.
export function ReplayFrontDoor() {
  const { start } = useCall();

  return (
    <main className="door">
      <header className="door__head">
        <h1 className="door__title">ScamShield MY</h1>
        <p className="door__lead">
          Pick a call and watch ScamShield listen. It warns you as the scam builds, and holds the
          transfer before money leaves.
        </p>
      </header>

      <div className="door__speed">
        <span>Replay speed</span>
        <SpeedToggle />
      </div>

      <ul className="door__cards">
        {CALL_SCRIPTS.map((script) => (
          <li key={script.id}>
            <ScriptCard script={script} onPlay={() => start(script)} />
          </li>
        ))}
      </ul>

      <footer className="door__foot">
        <p>Call detection is simulated. Scoring, warnings and the transfer hold are real.</p>
        <Link className="door__dash" to="/dashboard">
          Fraud dashboard
        </Link>
      </footer>
    </main>
  );
}

function ScriptCard({ script, onPlay }: { script: CallScript; onPlay: () => void }) {
  const scam = script.expectedAction !== 'none';
  return (
    <button
      type="button"
      className="card"
      aria-label={`Play: ${script.title}`}
      onClick={onPlay}
    >
      <span className="card__top">
        <span className={`card__kind card__kind--${scam ? 'scam' : 'safe'}`}>
          {scam ? 'Scam call' : 'Innocent call'}
        </span>
        <span className="card__len">about {Math.max(1, Math.round(scriptDurationSec(script) / 60))} min</span>
      </span>
      <span className="card__title">{script.title}</span>
      <span className="card__summary">{script.summary}</span>
      <span className="card__bottom">
        <span className="card__expect">Expected: {ACTION_LABELS[script.expectedAction]}</span>
        <span className="card__play">▶ Play</span>
      </span>
    </button>
  );
}
