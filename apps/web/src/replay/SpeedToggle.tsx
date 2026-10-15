import { useCall } from '../call/CallProvider';

export function SpeedToggle({ light = false }: { light?: boolean }) {
  const { speed, setSpeed } = useCall();
  return (
    <div className={light ? 'speed speed--light' : 'speed'} role="group" aria-label="Replay speed">
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
