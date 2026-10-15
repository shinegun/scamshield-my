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
  // Highest action level (see LEVEL) whose banner the user closed; a higher
  // one brings the banner back.
  bannerDismissedLevel: number;
}

export const initialWarningUi: WarningUiState = {
  overlaysSeen: 0,
  reopened: false,
  bannerDismissedLevel: 0,
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

const LEVEL: Record<WarningMessage['action'], number> = { soft_warning: 1, strong_warning: 2, hold_transfers: 3 };

export type BannerTone = 'soft' | 'strong';

// Soft is yellow; strong and hold are red.
export function bannerTone(action: WarningMessage['action']): BannerTone {
  return action === 'soft_warning' ? 'soft' : 'strong';
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
    dismiss: ms ? 'Teruskan panggilan' : 'Continue call',
    pill: ms ? 'Amaran penipuan' : 'Scam warning',
    secondary: hold ? NSRC_LINE : undefined,
  };
}

export function deriveWarningView(warnings: WarningMessage[], ui: WarningUiState): WarningView {
  const overlays = warnings.filter(isOverlay);
  const latestOverlay = overlays[overlays.length - 1];
  const latest = warnings[warnings.length - 1];

  const view: WarningView = {};
  // The banner always carries the latest warning's text.
  if (latest && LEVEL[latest.action] > ui.bannerDismissedLevel) view.banner = latest;

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

export function dismissBanner(ui: WarningUiState, warnings: WarningMessage[]): WarningUiState {
  const latest = warnings[warnings.length - 1];
  return { ...ui, bannerDismissedLevel: latest ? LEVEL[latest.action] : ui.bannerDismissedLevel };
}

export interface NativeStrings {
  cardTitle: string;
  endCall: string;
  why: string;
  speaking: string;
  noSignals: string;
}

// Labels for the native notification card and critical alert.
export function nativeStrings(action: WarningMessage['action'], language: string): NativeStrings {
  const ms = isMalay(language);
  const soft = action === 'soft_warning';
  return {
    cardTitle: soft ? (ms ? 'Mungkin penipuan' : 'Possible scam') : ms ? 'Kemungkinan besar penipuan' : 'Likely scam',
    endCall: ms ? 'Tamatkan Panggilan' : 'End Call',
    why: ms ? 'Kenapa saya nampak ini?' : 'Why am I seeing this?',
    speaking: ms ? 'Sedang dibacakan' : 'Reading this aloud',
    noSignals: ms ? 'Tiada isyarat direkodkan lagi' : 'No signals recorded yet',
  };
}
