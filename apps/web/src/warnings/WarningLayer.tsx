import { useEffect, useReducer, useRef } from 'react';
import { useCall, type WarningMessage } from '../call/CallProvider';
import {
  bannerTone,
  deriveWarningView,
  dismissBanner,
  dismissOverlay,
  initialWarningUi,
  reopenOverlay,
  warningStrings,
  type WarningUiState,
} from './warningView';
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

  // Move focus to the dismiss button whenever an overlay opens (or changes).
  useEffect(() => {
    if (overlay) dismissRef.current?.focus();
  }, [overlay]);

  const strings = overlay ? warningStrings(overlay.action, overlay.language) : undefined;
  const headingId = 'warning-overlay-heading';

  return (
    <>
      <div className="warn-top">
        <div role="status" aria-live="polite">
          {banner && (
            <div className="warn-banner" data-tone={bannerTone(banner.action)} lang={banner.language}>
              <span className="warn-banner__icon" aria-hidden="true">
                !
              </span>
              <p className="warn-banner__text">{banner.text}</p>
              <button
                type="button"
                className="warn-banner__close"
                aria-label={banner.language.toLowerCase().startsWith('ms') ? 'Tutup' : 'Dismiss'}
                onClick={() => dispatch({ type: 'dismiss-banner', warnings })}
              >
                ×
              </button>
            </div>
          )}
        </div>
        {pill && (
          <button type="button" className="warn-pill" data-action={pill.warning.action} onClick={() => dispatch({ type: 'reopen' })}>
            {pill.label}
          </button>
        )}
      </div>

      {overlay && strings && (
        <div
          className="warn-overlay"
          data-action={overlay.action}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={headingId}
          lang={overlay.language}
        >
          <div className="warn-overlay__body">
            <div className="warn-overlay__icon" aria-hidden="true">
              !
            </div>
            <h2 id={headingId} className="warn-overlay__title">
              {strings.header}
            </h2>
            <p className="warn-overlay__text">{overlay.text}</p>
            {strings.secondary && <p className="warn-overlay__secondary">{strings.secondary}</p>}
          </div>
          <button
            ref={dismissRef}
            type="button"
            className="warn-overlay__dismiss"
            onClick={() => dispatch({ type: 'dismiss-overlay', warnings })}
          >
            {strings.dismiss}
          </button>
        </div>
      )}
    </>
  );
}
