import { useCall } from '../call/CallProvider';

export function SpeedToggle() {
  const { speed, setSpeed } = useCall();
  return (
    <div className="speed" role="group" aria-label="Replay speed">
      {([1, 2] as const).map((value) => (
        <button
          key={value}
          type="button"
          className="speed__option"
          aria-pressed={speed === value}
          onClick={() => setSpeed(value)}
        >
          {value}×
        </button>
      ))}
    </div>
  );
}
