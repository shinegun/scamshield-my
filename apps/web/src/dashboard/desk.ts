import { ACTIONS, RED_FLAG_KEYS, SCAM_STAGE_KEYS, type Action, type RedFlag, type CallScript, type ScamStage } from '@scamshield/shared';
import { callerIdOf } from '../call/callerId';
import { flagLabel } from '../call/flagLabels';
import { formatClock, type Lang } from '../call/labels';
import { FLAG_SEEN_AT } from '../call/signals';
import type { Raw, SessionView } from './view';

// Pure helpers for the fraud desk (call list filters, signal and stage
// timeline). Colour always comes from an Action, never from a risk number.

export type DeskFilter = 'live' | 'held' | 'warned' | 'all';

export function filterSessions(sessions: readonly SessionView[], f: DeskFilter): SessionView[] {
  switch (f) {
    case 'live':
      return sessions.filter((s) => s.live);
    case 'held':
      return sessions.filter((s) => s.holdStatus === 'held');
    case 'warned':
      return sessions.filter((s) => s.peakAction !== 'none');
    default:
      return [...sessions];
  }
}

export function filterCounts(sessions: readonly SessionView[]): Record<DeskFilter, number> {
  return {
    live: filterSessions(sessions, 'live').length,
    held: filterSessions(sessions, 'held').length,
    warned: filterSessions(sessions, 'warned').length,
    all: sessions.length,
  };
}

export interface Tick {
  atSec: number;
  risk: number;
  action: Action;
  stage: ScamStage;
  flags: Partial<Record<RedFlag, number>>;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function parseTicks(docs: readonly Raw[]): Tick[] {
  return docs
    .map((d): Tick => {
      const flags: Partial<Record<RedFlag, number>> = {};
      if (d.flags && typeof d.flags === 'object') {
        const raw = d.flags as Record<string, unknown>;
        for (const k of RED_FLAG_KEYS) if (typeof raw[k] === 'number' && Number.isFinite(raw[k])) flags[k] = raw[k] as number;
      }
      return {
        atSec: num(d.atSec),
        risk: Math.min(1, Math.max(0, num(d.risk))),
        action: (ACTIONS as readonly unknown[]).includes(d.action) ? (d.action as Action) : 'none',
        stage: (SCAM_STAGE_KEYS as readonly unknown[]).includes(d.stage) ? (d.stage as ScamStage) : 'none',
        flags,
      };
    })
    .sort((a, b) => a.atSec - b.atSec);
}

const STAGE_SHORT: Record<Exclude<ScamStage, 'none'>, string> = {
  authority_setup: 'Authority setup',
  victim_framing: 'Victim framing',
  family_pressure: 'Family pressure',
  isolation: 'Isolation',
  identity_request: 'IC request',
  financial_request: 'Money request',
};

export interface DeskSignal {
  flag: RedFlag;
  label: string;
  atSec: number;
  time: string;
  action: Action;
}

export interface DeskStage {
  stage: ScamStage;
  label: string;
  atSec: number;
  time: string;
  current: boolean;
}

export function deskTimeline(
  ticks: readonly Tick[],
  lang: Lang = 'en',
): { signals: DeskSignal[]; stages: DeskStage[] } {
  const signals: DeskSignal[] = [];
  const heard = new Set<RedFlag>();
  const stages: DeskStage[] = [];
  let furthest = 0;

  for (const t of ticks) {
    for (const flag of RED_FLAG_KEYS) {
      if (heard.has(flag) || (t.flags[flag] ?? 0) < FLAG_SEEN_AT) continue;
      heard.add(flag);
      signals.push({ flag, label: flagLabel(flag, lang), atSec: t.atSec, time: formatClock(t.atSec), action: t.action });
    }
    const rank = SCAM_STAGE_KEYS.indexOf(t.stage);
    if (t.stage !== 'none' && rank > furthest) {
      furthest = rank;
      stages.push({ stage: t.stage, label: STAGE_SHORT[t.stage], atSec: t.atSec, time: formatClock(t.atSec), current: false });
    }
  }
  const last = stages[stages.length - 1];
  if (last) last.current = true;
  return { signals: signals.reverse(), stages };
}

export function rowSubtitle(s: Pick<SessionView, 'peakAction' | 'holdStatus' | 'live' | 'scamTypeText'>): string {
  if (s.peakAction === 'none') return 'No scam signs';
  const type = s.scamTypeText ?? 'Possible scam';
  const state =
    s.holdStatus === 'held'
      ? 'transfer held'
      : s.holdStatus === 'released'
        ? 'transfer released'
        : s.live
          ? 'warned'
          : 'warned, ended';
  return `${type} · ${state}`;
}

export function callerNumber(s: Pick<SessionView, 'title'>): string {
  // `title` is the scriptId; callerIdOf only reads `id`, and is undefined for unknown ids.
  return callerIdOf({ id: s.title } as CallScript)?.number ?? 'Unknown number';
}
