import { DEFAULT_THRESHOLDS, type Action } from '@scamshield/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatClock } from '../call/labels';
import {
  callerNumber,
  deskTimeline,
  filterCounts,
  filterSessions,
  rowSubtitle,
  type DeskFilter,
  type Tick,
} from './desk';
import { useHolds, useRiskTicks, useSessions, type Loadable } from './useFirestore';
import { buildChart, relativeTime, sortSessions, type HoldView, type SessionView } from './view';
import './dashboard.css';

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

const FILTERS: Array<{ key: DeskFilter; label: string }> = [
  { key: 'live', label: 'Live calls' },
  { key: 'held', label: 'Held transfers' },
  { key: 'warned', label: 'Warned' },
  { key: 'all', label: 'All calls' },
];

const callLength = (s: SessionView) => formatClock(Math.max(0, (s.updatedAtMs - s.startedAtMs) / 1000));

export function Dashboard() {
  const sessions = useSessions();
  const now = useNow();
  const [filter, setFilter] = useState<DeskFilter>('all');
  const [picked, setPicked] = useState<string | null>(null);

  const list = useMemo(() => sortSessions(sessions.data), [sessions.data]);
  const counts = useMemo(() => filterCounts(list), [list]);
  const visible = useMemo(() => filterSessions(list, filter), [list, filter]);
  // The user's pick if it is in this filter, else the newest live call, else the first.
  const selected =
    visible.find((s) => s.id === picked) ?? visible.find((s) => s.live) ?? visible[0];

  // Follow a newly started call unless the user chose one themselves.
  const knownIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (sessions.status !== 'ready') return;
    const prev = knownIds.current;
    knownIds.current = new Set(list.map((s) => s.id));
    if (!prev) return;
    const fresh = list.find((s) => !prev.has(s.id) && s.live);
    if (fresh) setPicked(null);
  }, [list, sessions.status]);

  const title = FILTERS.find((f) => f.key === filter)?.label ?? 'Calls';

  return (
    <div className="fd">
      <aside className="fd__side">
        <div className="fd__brand">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
          </svg>
          Fraud desk
        </div>
        <nav className="fd__filters" aria-label="Filter calls">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className="fd__filter"
              aria-pressed={f.key === filter}
              onClick={() => setFilter(f.key)}
            >
              <span>{f.label}</span>
              <span className="fd__count">{counts[f.key]}</span>
            </button>
          ))}
        </nav>
        <div className="fd__foot">
          <Link to="/" className="fd__link">
            ‹ Phone
          </Link>
          <Link to="/race" className="fd__link">
            Jev vs Gemini
          </Link>
          <SyncStatus sessions={sessions} />
        </div>
      </aside>

      <section className="fd__list" aria-label="Calls">
        <h1 className="fd__title">{title}</h1>
        <div className="fd__rows">
          {sessions.status === 'loading' && <p className="fd__muted">Loading calls…</p>}
          {sessions.status === 'ready' && visible.length === 0 && <p className="fd__muted">No calls</p>}
          {visible.map((s) => (
            <CallRow key={s.id} session={s} now={now} selected={s.id === selected?.id} onSelect={() => setPicked(s.id)} />
          ))}
        </div>
      </section>

      <main className="fd__detail">
        {sessions.status === 'error' && (
          <p className="fd__error" role="alert">
            Could not read Firestore: {sessions.error}
          </p>
        )}
        {selected ? (
          <Detail key={selected.id} session={selected} now={now} />
        ) : (
          <div className="fd__empty">
            <p>Play a call on the phone to see it here</p>
            <Link to="/" className="fd__link">
              Open the phone
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

function SyncStatus({ sessions }: { sessions: Loadable<SessionView[]> }) {
  if (sessions.status === 'error') return <p className="fd__sync fd__sync--error">Could not reach Firestore</p>;
  const ready = sessions.status === 'ready';
  return (
    <p className="fd__sync">
      <span className="fd__sync-dot" data-ready={ready} aria-hidden="true" />
      {ready ? 'Synced with Firestore' : 'Connecting to Firestore…'}
    </p>
  );
}

function CallRow({
  session: s,
  now,
  selected,
  onSelect,
}: {
  session: SessionView;
  now: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" className="fd-row" aria-pressed={selected} onClick={onSelect}>
      <span className="fd-row__dot" data-action={s.peakAction} aria-hidden="true" />
      <span className="fd-row__main">
        <span className="fd-row__number">{callerNumber(s)}</span>
        <span className="fd-row__sub">{rowSubtitle(s)}</span>
      </span>
      <span className="fd-row__time">{s.live ? callLength(s) : relativeTime(s.updatedAtMs, now)}</span>
    </button>
  );
}

function Detail({ session: s, now }: { session: SessionView; now: number }) {
  const ticks = useRiskTicks(s.id);
  const holds = useHolds(s.id);
  const { signals, stages } = useMemo(() => deskTimeline(ticks.data), [ticks.data]);
  const hold = holds.data.find((h) => h.held) ?? holds.data[0];

  return (
    <section className="fd-detail" aria-label="Call detail">
      <div className="fd-detail__head">
        <div>
          <div className="fd__small">
            {s.live ? `Live · ${callLength(s)} · ${s.language}` : `Ended · ${relativeTime(s.updatedAtMs, now)}`}
          </div>
          <h2 className="fd-detail__number">{callerNumber(s)}</h2>
        </div>
        <div className="fd-detail__risk">
          <div className="fd-detail__percent" data-action={s.action}>
            {s.percent}
          </div>
          <div className="fd__small">scam risk{s.scamTypeText ? ` · ${s.scamTypeText.toLowerCase()}` : ''}</div>
        </div>
      </div>

      {hold && <HoldBanner hold={hold} />}
      {(ticks.status === 'error' || holds.status === 'error') && (
        <p className="fd__error" role="alert">
          {ticks.status === 'error' ? ticks.error : holds.status === 'error' ? holds.error : ''}
        </p>
      )}

      <div>
        <h3 className="fd__h">Risk over the call</h3>
        <Chart ticks={ticks.data} action={s.action} />
      </div>

      <div className="fd-detail__cols">
        <div>
          <h3 className="fd__h">Signals heard · {signals.length} of 13</h3>
          {signals.length === 0 && <p className="fd__muted fd__muted--flush">None yet</p>}
          {signals.map((g) => (
            <div className="fd__r" key={g.flag}>
              <span>{g.label}</span>
              <span className="fd__t" data-action={g.action}>
                {g.time}
              </span>
            </div>
          ))}
        </div>
        <div>
          <h3 className="fd__h">Stage reached</h3>
          {stages.length === 0 && <p className="fd__muted fd__muted--flush">No scam stage yet</p>}
          {stages.map((g) => (
            <div className="fd__r" key={g.stage} data-current={g.current}>
              <span>{g.label}</span>
              <span className="fd__t">{g.time}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HoldBanner({ hold }: { hold: HoldView }) {
  return (
    <div className="fd-hold" data-held={hold.held}>
      <div className="fd-hold__title">
        {hold.amountText} to "{hold.account}" {hold.held ? 'is on hold' : 'was released by the customer'}
      </div>
      {hold.held && <div className="fd__small">Paused automatically at {formatClock(hold.atSec)}.</div>}
    </div>
  );
}

const W = 900;
const H = 170;
const LINE: Record<Action, string> = {
  none: 'var(--light-text-primary)',
  soft_warning: 'var(--light-risk-soft-text)',
  strong_warning: 'var(--light-risk-strong-text)',
  hold_transfers: 'var(--light-risk-strong-text)',
};

function Chart({ ticks, action }: { ticks: readonly Tick[]; action: Action }) {
  const chart = useMemo(() => buildChart(ticks, W, H), [ticks]);
  const last = chart.dots[chart.dots.length - 1];
  const { soft, strong, hold } = DEFAULT_THRESHOLDS;
  return (
    <svg
      className="fd-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={last ? `Risk over the call, now ${Math.round(last.risk * 100)} percent` : 'Risk over the call, no reading yet'}
    >
      <line x1="0" x2={W} y1={chart.yAt(soft)} y2={chart.yAt(soft)} stroke="var(--light-risk-soft)" strokeDasharray="3 5" />
      <line x1="0" x2={W} y1={chart.yAt(strong)} y2={chart.yAt(strong)} stroke="var(--light-risk-strong)" strokeDasharray="3 5" />
      {/* Hold is red like strong; longer dashes tell the two apart. */}
      <line x1="0" x2={W} y1={chart.yAt(hold)} y2={chart.yAt(hold)} stroke="var(--light-risk-strong)" strokeDasharray="10 4" />
      {last ? (
        <>
          <path d={chart.path} fill="none" stroke="var(--light-text-primary)" strokeWidth="2.5" />
          <circle cx={last.x} cy={last.y} r="5" fill={LINE[action]} />
        </>
      ) : (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="14" fill="var(--light-text-secondary)">
          Waiting for the first reading
        </text>
      )}
    </svg>
  );
}
