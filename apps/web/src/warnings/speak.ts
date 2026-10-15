import type { WarningMessage } from '../call/state';
import { isOverlay } from './warningView';

// Which warning to read aloud, as a pure function of the warnings that have
// arrived and how many of them were already considered. Only strong and hold
// warnings carry audio (the pipeline leaves soft ones silent); each is played
// once, and when several arrive together only the newest is played.
export interface SpeakDecision {
  // Clip to play now, if any.
  play?: string;
  // Pass this back in as `handled` next time.
  handled: number;
}

export function nextSpoken(warnings: WarningMessage[], handled: number): SpeakDecision {
  const fresh = warnings.slice(Math.min(handled, warnings.length));
  const speakable = fresh.filter((w) => isOverlay(w) && w.audioUrl);
  const latest = speakable[speakable.length - 1];
  return { play: latest?.audioUrl, handled: warnings.length };
}

export function muteLabel(muted: boolean, language: string): string {
  const ms = language.toLowerCase().startsWith('ms');
  if (muted) return ms ? 'Suarakan' : 'Unmute';
  return ms ? 'Senyap' : 'Mute';
}
