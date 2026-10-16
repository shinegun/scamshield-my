import { useEffect, useReducer, useRef, useState } from 'react';
import { muteLabel, nextSpoken } from './speak';
import { useCall, type WarningMessage } from '../call/CallProvider';
import {
  deriveWarningView,
  dismissBanner,
  dismissOverlay,
  initialWarningUi,
  isOverlay,
  isMalay,
  nativeStrings,
  reopenOverlay,
  warningStrings,
  type WarningUiState,
} from './warningView';
import { inspect } from '../call/inspector';
import { langOf } from '../call/labels';
import './warnings.css';

// Warning UI (#10): a soft banner, a full-screen overlay for strong and hold,
// and a pill that reopens the overlay. Only displays what the pipeline sends.
export function WarningLayer() {
  const { sessionId, warnings } = useCall();
  // A new call has a new session id: remount to reset all dismissed state.
  return <WarningLayerInner key={sessionId ?? 'no-session'} warnings={warnings} />;
}

type UiAction = { type: 'dismiss-banner'; warnings: WarningMessage[] } | { type: 'dismiss-overlay'; warnings: WarningMessage[] } | { type: 'reopen' };

function uiReducer(state: WarningUiState, action: UiAction): WarningUiState {
  switch (action.type) {
    case 'dismiss-banner':
      return dismissBanner(state, action.warnings);
    case 'dismiss-overlay':
      return dismissOverlay(state, action.warnings);
    case 'reopen':
      return reopenOverlay(state);
  }
}

function WarningLayerInner({ warnings }: { warnings: WarningMessage[] }) {
  const [ui, dispatch] = useReducer(uiReducer, initialWarningUi);
  const { banner, overlay, pill } = deriveWarningView(warnings, ui);
  const dismissRef = useRef<HTMLButtonElement>(null);
  const { status, end, script, risk, riskHistory } = useCall();
  const [whyOpen, setWhyOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  // Spoken warning: each new strong/hold clip plays once; a newer one stops
  // the one still playing. Warnings already present at mount are not replayed.
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const handledRef = useRef(warnings.length);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const { play, handled } = nextSpoken(warnings, handledRef.current);
    handledRef.current = handled;
    if (!play || mutedRef.current) return;
    audioRef.current?.pause();
    try {
      const audio = new Audio(play);
      audioRef.current = audio;
      const on = () => setSpeaking(true);
      const off = () => setSpeaking(false);
      audio.addEventListener('playing', on);
      audio.addEventListener('pause', off);
      audio.addEventListener('ended', off);
      audio.play().catch(() => {});
    } catch {
      // No audio support: the warning is still shown.
    }
  }, [warnings]);
  useEffect(() => () => audioRef.current?.pause(), []);
  const toggleMute = () => {
    const next = !muted;
    mutedRef.current = next;
    setMuted(next);
    if (next) audioRef.current?.pause();
  };
  const hasAudio = warnings.some((w) => isOverlay(w) && w.audioUrl);
  const latestLanguage = warnings[warnings.length - 1]?.language ?? 'en';
  const muteButton = hasAudio && (
    <button type="button" className="warn-mute" aria-pressed={muted} lang={latestLanguage} onClick={toggleMute}>
      {muteLabel(muted, latestLanguage)}
    </button>
  );

  // Move focus to the dismiss button whenever an overlay opens (or changes).
  useEffect(() => {
    if (overlay) dismissRef.current?.focus();
  }, [overlay]);

  const strings = overlay ? warningStrings(overlay.action, overlay.language) : undefined;
  const headingId = 'warning-overlay-heading';
  const heard = whyOpen ? inspect(risk, riskHistory, langOf(script?.language)).heard : [];
  const ns = overlay ? nativeStrings(overlay.action, overlay.language) : undefined;
  const bannerNs = banner ? nativeStrings(banner.action, banner.language) : undefined;
  const dotColor = (action: string) =>
    action === 'soft_warning' ? 'var(--risk-soft)' : action === 'none' ? 'var(--text-tertiary)' : 'var(--risk-strong)';

  return (
    <>
      <div className="warn-top">
        <div role="status" aria-live="polite">
          {banner && bannerNs && (
            <div className="warn-card" lang={banner.language}>
              <div className="warn-card__tile" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.2">
                  <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
                </svg>
              </div>
              <div className="warn-card__main">
                <div className="warn-card__head">
                  <span>SCAMSHIELD</span>
                  <span>{isMalay(banner.language) ? 'sekarang' : 'now'}</span>
                </div>
                <div
                  className="warn-card__title"
                  style={{ color: banner.action === 'soft_warning' ? 'var(--risk-soft)' : 'var(--risk-strong)' }}
                >
                  {bannerNs.cardTitle}
                </div>
                <div
                  className="warn-card__text"
                  data-open={cardOpen || undefined}
                  onClick={() => setCardOpen((o) => !o)}
                >
                  {banner.text}
                </div>
              </div>
              <button
                type="button"
                className="warn-card__close"
                aria-label={isMalay(banner.language) ? 'Tutup' : 'Dismiss'}
                onClick={() => dispatch({ type: 'dismiss-banner', warnings })}
              >
                ×
              </button>
            </div>
          )}
        </div>
        {!overlay && muteButton}
        {pill && (
          <button type="button" className="warn-pill" data-action={pill.warning.action} onClick={() => dispatch({ type: 'reopen' })}>
            {pill.label}
          </button>
        )}
      </div>

      {overlay && strings && ns && (
        <div
          className="warn-overlay"
          data-action={overlay.action}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={headingId}
          lang={overlay.language}
        >
          <div className="warn-alert">
            <div className="warn-alert__icon" aria-hidden="true">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--risk-strong)" strokeWidth="2">
                <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
                <path d="M12 8v5M12 16.5h.01" />
              </svg>
            </div>
            <h2 id={headingId} className="warn-alert__title">
              {strings.header}
            </h2>
            <p className="warn-alert__text">{overlay.text}</p>
            {strings.secondary && <p className="warn-alert__text">{strings.secondary}</p>}
            {(speaking || muteButton) && (
              <div className="warn-alert__audio">
                {speaking && (
                  <div className="warn-alert__speaking">
                    <span className="warn-alert__bars" aria-hidden="true">
                      {[6, 14, 20, 10, 16, 8].map((h, i) => (
                        <i key={i} style={{ height: h, animationDelay: `${i * 90}ms` }} />
                      ))}
                    </span>
                    <span>{ns.speaking}</span>
                  </div>
                )}
                {muteButton}
              </div>
            )}
            <div className="warn-alert__buttons">
              <button
                type="button"
                className="warn-alert__end"
                disabled={status !== 'connecting' && status !== 'live'}
                onClick={() => {
                  end();
                  dispatch({ type: 'dismiss-overlay', warnings });
                }}
              >
                {ns.endCall}
              </button>
              <button
                ref={dismissRef}
                type="button"
                className="warn-alert__dismiss"
                onClick={() => dispatch({ type: 'dismiss-overlay', warnings })}
              >
                {strings.dismiss}
              </button>
              <button
                type="button"
                className="warn-alert__why"
                aria-expanded={whyOpen}
                onClick={() => setWhyOpen((o) => !o)}
              >
                {ns.why}
              </button>
              {whyOpen && (
                <ul className="warn-alert__signals">
                  {heard.length === 0 ? (
                    <li className="warn-alert__empty">{ns.noSignals}</li>
                  ) : (
                    heard.map((h) => (
                      <li key={h.flag}>
                        <span className="warn-alert__dot" style={{ background: dotColor(h.action) }} aria-hidden="true" />
                        {h.label}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
