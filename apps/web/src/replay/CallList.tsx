import { CALL_SCRIPTS, type CallScript } from '@scamshield/shared';
import { doorRow } from './doorRows';

// The three calls as a grouped list. Colours come from CSS variables set by
// the parent (dark in the phone, light on the desktop page).
export function CallList({ onPlay }: { onPlay: (script: CallScript) => void }) {
  return (
    <ul className="calls">
      {CALL_SCRIPTS.map((script) => {
        const { title, subtitle, scam } = doorRow(script);
        return (
          <li key={script.id} className="calls__row">
            <div>
              <div className="calls__title">{title}</div>
              <div className="calls__sub">{subtitle}</div>
            </div>
            <button
              type="button"
              className="calls__play"
              aria-label={`Play: ${script.title}`}
              onClick={() => onPlay(script)}
            >
              <span className={`calls__pill${scam ? '' : ' calls__pill--quiet'}`}>Play</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
