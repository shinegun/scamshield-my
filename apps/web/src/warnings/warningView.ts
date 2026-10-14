import type { WarningMessage } from '../call/state';

// What the warning UI shows, as pure functions of the warnings that arrived
// and what the user has dismissed. The pipeline decides the warnings (ADR 6);
// this only decides how to display them.

export type OverlayWarning = WarningMessage & { action: 'strong_warning' | 'hold_transfers' };

export interface WarningUiState {
  // How many strong/hold warnings the user has already seen and dismissed.
  overlaysSeen: number;
  // The user tapped the pill to reopen the latest overlay.
  reopened: boolean;
  bannerDismissed: boolean;
}

export const initialWarningUi: WarningUiState = {
  overlaysSeen: 0,
  reopened: false,
  bannerDismissed: false,
};

export interface WarningStrings {
  header: string;
  dismiss: string;
  pill: string;
  // Only the hold overlay has a secondary line.
  secondary?: string;
}

export interface WarningView {
  banner?: WarningMessage;
  overlay?: OverlayWarning;
  pill?: { warning: OverlayWarning; label: string };
}

export const NSRC_LINE = 'National Scam Response Centre (NSRC): 997';

export function isOverlay(warning: WarningMessage): warning is OverlayWarning {
  return warning.action === 'strong_warning' || warning.action === 'hold_transfers';
}

export function isMalay(language: string): boolean {
  return language.toLowerCase().startsWith('ms');
}

export function warningStrings(action: OverlayWarning['action'], language: string): WarningStrings {
  const ms = isMalay(language);
  const hold = action === 'hold_transfers';
  return {
    header: hold
      ? ms
        ? 'Pemindahan wang ditahan sementara'
        : 'Transfers paused'
      : ms
        ? 'Amaran: kemungkinan penipuan'
        : 'Warning: this looks like a scam',
    dismiss: ms ? 'Saya faham' : 'I understand',
    pill: ms ? 'Amaran penipuan' : 'Scam warning',
    secondary: hold ? NSRC_LINE : undefined,
  };
}

export function deriveWarningView(warnings: WarningMessage[], ui: WarningUiState): WarningView {
  const overlays = warnings.filter(isOverlay);
  const latestOverlay = overlays[overlays.length - 1];
  const latestSoft = [...warnings].reverse().find((w) => w.action === 'soft_warning');

  const view: WarningView = {};
  if (latestSoft && !ui.bannerDismissed) view.banner = latestSoft;

  if (latestOverlay) {
    // Each overlay shows once on arrival; the pill reopens the latest one.
    const unseen = overlays.length > Math.min(ui.overlaysSeen, overlays.length);
    if (unseen || ui.reopened) {
      view.overlay = latestOverlay;
    } else {
      view.pill = { warning: latestOverlay, label: warningStrings(latestOverlay.action, latestOverlay.language).pill };
    }
  }
  return view;
}

export function dismissOverlay(ui: WarningUiState, warnings: WarningMessage[]): WarningUiState {
  return { ...ui, overlaysSeen: warnings.filter(isOverlay).length, reopened: false };
}

export function reopenOverlay(ui: WarningUiState): WarningUiState {
  return { ...ui, reopened: true };
}

export function dismissBanner(ui: WarningUiState): WarningUiState {
  return { ...ui, bannerDismissed: true };
}
