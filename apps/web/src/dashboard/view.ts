import {
  ACTIONS,
  DEFAULT_THRESHOLDS,
  RED_FLAG_KEYS,
  SCAM_STAGE_KEYS,
  type Action,
  type RedFlag,
  type ScamStage,
  type ScamType,
} from '@scamshield/shared';
import { ACTION_LABELS, scamTypeLabel, stageLabel } from '../call/labels';

// Firestore -> view mapping, kept pure so it can be tested without Firebase.
// Documents are read defensively: the pipeline may be mid-write or older.

export type Raw = Record<string, unknown>;

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
const toAction = (v: unknown): Action => ((ACTIONS as readonly unknown[]).includes(v) ? (v as Action) : 'none');
const toStage = (v: unknown): ScamStage =>
  (SCAM_STAGE_KEYS as readonly unknown[]).includes(v) ? (v as ScamStage) : 'none';
const toFlags = (v: unknown): RedFlag[] =>
  Array.isArray(v) ? v.filter((f): f is RedFlag => (RED_FLAG_KEYS as readonly unknown[]).includes(f)) : [];
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function flagLabel(flag: string): string {
  const text = flag.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function actionRank(a: Action): number {
  return ACTIONS.indexOf(a);
}

export function formatPercent(risk: number): string {
  return `${Math.round(clamp01(risk) * 100)}%`;
}

export function relativeTime(thenMs: number, nowMs: number): string {
  const sec = Math.max(0, Math.round((nowMs - thenMs) / 1000));
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

export interface SessionView {
  id: string;
  live: boolean;
  title: string;
  language: string;
  risk: number;
  percent: string;
  action: Action;
  peakAction: Action;
  peakLabel: string;
  stage: ScamStage;
  stageText: string;
  scamTypeText: string | undefined;
  flagsSeen: RedFlag[];
  flagLabels: string[];
  holdStatus: 'held' | 'released' | undefined;
  holdText: string;
  startedAtMs: number;
  updatedAtMs: number;
}

export function toSessionView(id: string, data: Raw): SessionView {
  const risk = clamp01(num(data.risk));
  const current = toAction(data.action);
  const recordedPeak = toAction(data.peakAction);
  // The peak is monotonic (ADR 6), so it is never below the current action.
  const peak = actionRank(recordedPeak) >= actionRank(current) ? recordedPeak : current;
  const type = typeof data.scamType === 'string' ? (data.scamType as ScamType) : undefined;
  const seen = toFlags(data.flagsSeen);
  const hold = data.holdStatus === 'held' || data.holdStatus === 'released' ? data.holdStatus : undefined;
  const stage = toStage(data.stage);
  return {
    id,
    live: data.status === 'live',
    title: str(data.scriptId) ?? 'Live call',
    language: str(data.language) ?? '—',
    risk,
    percent: formatPercent(risk),
    action: current,
    peakAction: peak,
    peakLabel: ACTION_LABELS[peak],
    stage,
    stageText: stageLabel(stage),
    // Like the phone's meter, show no scam label until the engine acts.
    scamTypeText: type && type !== 'none' && peak !== 'none' ? scamTypeLabel(type) : undefined,
    flagsSeen: seen,
    flagLabels: seen.map(flagLabel),
    holdStatus: hold,
    holdText: hold === 'held' ? 'Held' : hold === 'released' ? 'Released' : 'No hold',
    startedAtMs: num(data.startedAtMs),
    updatedAtMs: num(data.updatedAtMs),
  };
}

// Newest update first.
export function sortSessions(sessions: readonly SessionView[]): SessionView[] {
  return [...sessions].sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

// Which call the detail shows: the user's pick if it still exists, else the
// newest live call, else the newest call.
export function pickSelected(sessions: readonly SessionView[], picked: string | null): string | null {
  if (picked && sessions.some((s) => s.id === picked)) return picked;
  const sorted = sortSessions(sessions);
  return (sorted.find((s) => s.live) ?? sorted[0])?.id ?? null;
}

export interface RiskPoint {
  atSec: number;
  risk: number;
  action: Action;
}

export function toRiskPoints(docs: readonly Raw[]): RiskPoint[] {
  return docs
    .map((d) => ({ atSec: num(d.atSec), risk: clamp01(num(d.risk)), action: toAction(d.action) }))
    .sort((a, b) => a.atSec - b.atSec);
}

export interface Chart {
  width: number;
  height: number;
  maxSec: number;
  path: string;
  dots: Array<{ x: number; y: number; action: Action; atSec: number; risk: number }>;
  bands: Array<{ action: Action; y: number; height: number }>;
  plot: { left: number; right: number; top: number; bottom: number };
  yAt: (risk: number) => number;
  xAt: (sec: number) => number;
}

const PAD = { l: 34, r: 10, t: 10, b: 22 };

export function buildChart(points: readonly RiskPoint[], width = 520, height = 200): Chart {
  const plotW = width - PAD.l - PAD.r;
  const plotH = height - PAD.t - PAD.b;
  const maxSec = Math.max(60, ...points.map((p) => p.atSec));
  const xAt = (sec: number) => PAD.l + (sec / maxSec) * plotW;
  const yAt = (risk: number) => PAD.t + (1 - risk) * plotH;
  const dots = points.map((p) => ({ x: xAt(p.atSec), y: yAt(p.risk), action: p.action, atSec: p.atSec, risk: p.risk }));
  const path = dots.map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x.toFixed(1)} ${d.y.toFixed(1)}`).join(' ');
  const { soft, strong, hold } = DEFAULT_THRESHOLDS;
  const edges: Array<[Action, number, number]> = [
    ['soft_warning', soft, strong],
    ['strong_warning', strong, hold],
    ['hold_transfers', hold, 1],
  ];
  const bands = edges.map(([action, lo, hi]) => ({ action, y: yAt(hi), height: yAt(lo) - yAt(hi) }));
  return {
    width,
    height,
    maxSec,
    path,
    dots,
    bands,
    plot: { left: PAD.l, right: width - PAD.r, top: PAD.t, bottom: height - PAD.b },
    yAt,
    xAt,
  };
}

export interface HoldView {
  id: string;
  held: boolean;
  statusText: string;
  amountText: string;
  account: string;
  heldAtMs: number;
  atSec: number;
}

export function toHoldViews(docs: ReadonlyArray<{ id: string; data: Raw }>): HoldView[] {
  return docs
    .map(({ id, data }) => {
      const held = data.status !== 'released';
      const amount = num(data.amountRm).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return {
        id,
        held,
        statusText: held ? 'Held' : 'Released',
        amountText: `RM ${amount}`,
        account: str(data.toAccount) ?? 'Unknown account',
        heldAtMs: num(data.heldAtMs),
        atSec: num(data.heldAtSec),
      };
    })
    .sort((a, b) => b.heldAtMs - a.heldAtMs);
}
