import type { Action } from '@scamshield/shared';
import { useEffect, useMemo, useRef } from 'react';
import { useCall } from './CallProvider';
import { flagLabel } from './flagLabels';
import { langOf } from './labels';
import { callerSignals } from './signals';

const SIGNAL_TONE: Record<Action, string> = {
  none: 'secondary',
  soft_warning: 'soft',
  strong_warning: 'strong',
  hold_transfers: 'strong',
};

// Live captions: the newest caller line is large, earlier lines fade.
export function TranscriptView() {
  const { transcript, riskHistory, status, script } = useCall();
  const endRef = useRef<HTMLDivElement>(null);
  const lang = langOf(script?.language);
  // Signals only label a call that has reached a warning, so an innocent call's
  // low-score flags (ADR 6 keeps them in the risk) never show as accusations.
  const flagged = useMemo(() => riskHistory.some((r) => r.action !== 'none'), [riskHistory]);
  const signals = useMemo(() => callerSignals(transcript, riskHistory), [transcript, riskHistory]);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    endRef.current?.scrollIntoView({ block: 'end', behavior: reduced ? 'auto' : 'smooth' });
  }, [transcript.length]);

  let newest = -1;
  for (let i = transcript.length - 1; i >= 0; i--) {
    if (transcript[i]?.speaker === 'caller') {
      newest = i;
      break;
    }
  }

  return (
    <section className="transcript" aria-label="Live transcript" aria-live="polite">
      {transcript.length === 0 && (
        <p className="transcript__empty">
          {status === 'connecting' ? 'Connecting to ScamShield…' : 'Waiting for the first words…'}
        </p>
      )}
      {transcript.map((line, i) => {
        const tone = i === newest ? 'newest' : i > newest ? 'secondary' : newest - i <= 2 ? 'secondary' : 'tertiary';
        const sig = line.speaker === 'caller' && flagged ? signals.get(i) : undefined;
        return (
          <div key={i} className="caption" data-tone={tone} lang={script?.language}>
            {line.speaker === 'user' ? `You: ${line.text}` : line.text}
            {sig && sig.flags.length > 0 && (
              <div className="caption__signals" data-tone={SIGNAL_TONE[sig.action]}>
                {sig.flags.map((f) => flagLabel(f, lang)).join(' · ')}
              </div>
            )}
          </div>
        );
      })}
      <div ref={endRef} />
    </section>
  );
}
