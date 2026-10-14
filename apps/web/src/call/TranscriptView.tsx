import { useEffect, useRef } from 'react';
import { useCall } from './CallProvider';
import { formatClock } from './labels';

export function TranscriptView() {
  const { transcript, status, script } = useCall();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [transcript.length]);

  return (
    <section className="transcript" aria-label="Live transcript" aria-live="polite">
      {transcript.length === 0 && (
        <p className="transcript__empty">
          {status === 'connecting' ? 'Connecting to ScamShield…' : 'Waiting for the first words…'}
        </p>
      )}
      {transcript.map((line, i) => (
        <div key={i} className={`bubble bubble--${line.speaker}`} lang={script?.language}>
          <span className="bubble__who">
            {line.speaker === 'caller' ? 'Caller' : 'You'} · {formatClock(line.atSec)}
          </span>
          <span className="bubble__text">{line.text}</span>
        </div>
      ))}
      <div ref={endRef} />
    </section>
  );
}
