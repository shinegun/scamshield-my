import {
  CALL_SCRIPTS,
  RED_FLAG_KEYS,
  type CallScript,
  type RaceEntry,
  type ScamStage,
  type ScorerName,
} from '@scamshield/shared';
import { scamTypeLabel, stageLabel, formatLatency } from '../call/labels';
import { flagLabel, formatPercent } from '../dashboard/view';

// Pure helpers for the race page: presets, statistics and the mapping from a
// pipeline answer to what the page shows. No React, no socket.

export const SCORERS: ScorerName[] = ['jev', 'gemini'];
export const SCORER_LABELS: Record<ScorerName, string> = { jev: 'Jev', gemini: 'Gemini' };
export const RUNS = 5;
// The pipeline refuses more than this; the page stops typing there too.
export const MAX_CHARS = 2000;
const PRESET_CHARS = 600;
// A flag counts as raised on the page from here, matching the dashboard.
export const FLAG_SHOWN_AT = 0.5;

export interface Preset {
  id: string;
  label: string;
  language: string;
  text: string;
}

const speakerLine = (l: { speaker: string; text: string }) => `${l.speaker}: ${l.text}`;

// Whole lines joined until the next one would pass the limit (at least one
// line, cut at the limit if it is longer than that).
export function excerpt(lines: readonly { speaker: string; text: string }[], maxChars = PRESET_CHARS): string {
  const out: string[] = [];
  let len = 0;
  for (const line of lines) {
    const text = speakerLine(line);
    const added = text.length + (out.length ? 1 : 0);
    if (out.length > 0 && len + added > maxChars) break;
    out.push(text);
    len += added;
  }
  return out.join('\n').slice(0, maxChars);
}

export function buildPresets(scripts: readonly CallScript[] = CALL_SCRIPTS): Preset[] {
  const byId = (id: CallScript['id']) => scripts.find((s) => s.id === id);
  const stageLines = (s: CallScript, stage: ScamStage) => s.lines.filter((l) => l.stage === stage);
  const presets: Preset[] = [];

  const ms = byId('scam-ms');
  if (ms) {
    presets.push({
      id: 'ms-money',
      label: 'Malay scam: asks for money',
      language: ms.language,
      text: excerpt(stageLines(ms, 'financial_request')),
    });
    presets.push({
      id: 'ms-start',
      label: 'Malay scam: opening',
      language: ms.language,
      text: excerpt(stageLines(ms, 'authority_setup')),
    });
  }
  const mg = byId('scam-manglish');
  if (mg) {
    presets.push({
      id: 'manglish-money',
      label: 'Manglish scam: asks for money',
      language: mg.language,
      text: excerpt(stageLines(mg, 'financial_request')),
    });
  }
  const ok = byId('innocent');
  if (ok) {
    presets.push({
      id: 'innocent',
      label: 'Innocent bank call',
      language: ok.language,
      text: excerpt(ok.lines),
    });
  }
  return presets.filter((p) => p.text.length > 0);
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export interface LatencyStats {
  scorer: ScorerName;
  // Runs that came back with an answer, and how many were made in all.
  ok: number;
  runs: number;
  medianMs: number;
  minMs: number;
  maxMs: number;
}

// Latency over the runs where the scorer answered; failures only count in `runs`.
export function summarizeRuns(runs: readonly (readonly RaceEntry[])[]): LatencyStats[] {
  return SCORERS.map((scorer) => {
    const entries = runs.map((r) => r.find((e) => e.scorer === scorer));
    const ok = entries.flatMap((e) => (e?.ok ? [e.latencyMs] : []));
    return {
      scorer,
      ok: ok.length,
      runs: runs.length,
      medianMs: ok.length ? Math.round(median(ok)) : NaN,
      minMs: ok.length ? Math.min(...ok) : NaN,
      maxMs: ok.length ? Math.max(...ok) : NaN,
    };
  });
}

// "Jev 320 ms vs Gemini 1.1 s (median of 5): Jev 3.4x faster"
export function deckLine(stats: readonly LatencyStats[]): string {
  const jev = stats.find((s) => s.scorer === 'jev');
  const gem = stats.find((s) => s.scorer === 'gemini');
  const part = (s: LatencyStats | undefined, name: string) =>
    s && s.ok > 0 ? `${name} ${formatLatency(s.medianMs)}` : `${name} no answer`;
  const n = Math.max(0, ...stats.map((s) => s.ok));
  let line = `${part(jev, 'Jev')} vs ${part(gem, 'Gemini')} (median of ${n})`;
  if (jev && gem && jev.ok > 0 && gem.ok > 0) line += `: ${fasterNote(jev.medianMs, gem.medianMs)}`;
  return line;
}

// "Jev 3.4x faster", "Gemini 1.2x faster", or "about the same".
export function fasterNote(jevMs: number, geminiMs: number): string {
  if (!(jevMs > 0) || !(geminiMs > 0)) return '';
  const [fast, slow, name] = jevMs <= geminiMs ? [jevMs, geminiMs, 'Jev'] : [geminiMs, jevMs, 'Gemini'];
  const ratio = slow / fast;
  return ratio < 1.05 ? 'about the same' : `${name} ${ratio.toFixed(1)}x faster`;
}

export interface ColumnView {
  scorer: ScorerName;
  title: string;
  ok: boolean;
  error?: string;
  model?: string;
  latencyMs: number;
  latencyText: string;
  // 0-100, scaled to the slower of the answers in the same race.
  barPercent: number;
  percent?: string;
  risk?: number;
  stageText?: string;
  scamTypeText?: string;
  flags: { key: string; label: string; score: number }[];
}

// The answers of one race as columns, in jev, gemini order; a scorer the
// pipeline did not run is left out.
export function toColumns(entries: readonly RaceEntry[]): ColumnView[] {
  const slowest = Math.max(1, ...entries.map((e) => e.latencyMs));
  return SCORERS.flatMap((scorer): ColumnView[] => {
    const e = entries.find((x) => x.scorer === scorer);
    if (!e) return [];
    const base = {
      scorer,
      title: SCORER_LABELS[scorer],
      latencyMs: e.latencyMs,
      latencyText: formatLatency(e.latencyMs),
      barPercent: Math.max(2, Math.round((e.latencyMs / slowest) * 100)),
    };
    if (!e.ok) return [{ ...base, ok: false, error: e.error, flags: [] }];
    return [
      {
        ...base,
        ok: true,
        model: e.model,
        risk: e.risk,
        percent: formatPercent(e.risk),
        stageText: stageLabel(e.decision.scamStage),
        scamTypeText: e.decision.scamType === 'none' ? 'None' : scamTypeLabel(e.decision.scamType),
        flags: RED_FLAG_KEYS.filter((k) => e.decision.flags[k] >= FLAG_SHOWN_AT)
          .map((k) => ({ key: k, label: flagLabel(k), score: e.decision.flags[k] }))
          .sort((a, b) => b.score - a.score),
      },
    ];
  });
}
