import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatClock } from '../call/labels';
import { RiskChart } from './RiskChart';
import { useHolds, useRisk, useSessions } from './useFirestore';
import { pickSelected, relativeTime, sortSessions, type HoldView, type SessionView } from './view';
import './dashboard.css';

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function Dashboard() {
  const sessions = useSessions();
  const now = useNow();
  const [picked, setPicked] = useState<string | null>(null);

  const list = useMemo(() => sortSessions(sessions.data), [sessions.data]);
  const selectedId = pickSelected(list, picked);
  const selected = list.find((s) => s.id === selectedId);

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

  return (
    <div className="dash">
      <header className="dash__head">
        <h1>Fraud dashboard</h1>
        <Link to="/" className="dash__back">
          ← Back to the phone
        </Link>
      </header>

      {sessions.status === 'error' && (
        <p className="dash__error" role="alert">
          Could not read Firestore: {sessions.error}
        </p>
      )}

      {sessions.status === 'loading' && <p className="dash__muted">Connecting…</p>}

      {sessions.status === 'ready' && list.length === 0 && (
        <div className="dash__empty">
          <p>No calls yet — play a scripted call on the phone page</p>
          <Link to="/">Open the phone page</Link>
        </div>
      )}

      {list.length > 0 && (
        <div className="dash__body">
          <ul className="dash__list" aria-label="Calls">
            {list.map((s) => (
              <li key={s.id}>
                <CallRow
                  session={s}
                  now={now}
                  selected={s.id === selectedId}
                  onSelect={() => setPicked(s.id)}
                />
              </li>
            ))}
          </ul>
          {selected && <Detail session={selected} now={now} />}
        </div>
      )}
    </div>
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
    <button
      type="button"
      className="dash-row"
      aria-pressed={selected}
      data-selected={selected}
      onClick={onSelect}
    >
      <span className="dash-row__top">
        <span className="dash-badge" data-live={s.live}>
          {s.live ? 'Live' : 'Ended'}
        </span>
        <span className="dash-row__title">{s.title}</span>
        <span className="dash-row__percent" data-action={s.action}>
          {s.percent}
        </span>
      </span>
      <span className="dash-row__meta">
        <span>{s.language}</span>
        <span data-action={s.peakAction} className="dash-row__peak">
          {s.peakLabel}
        </span>
        <span>{s.holdText}</span>
        <span className="dash-row__time">{relativeTime(s.updatedAtMs, now)}</span>
      </span>
    </button>
  );
}

function Detail({ session: s, now }: { session: SessionView; now: number }) {
  const risk = useRisk(s.id);
  const holds = useHolds(s.id);

  return (
    <section className="dash-detail" aria-label="Call detail">
      <div className="dash-card">
        <div className="dash-detail__head">
          <span className="dash-detail__percent" data-action={s.action}>
            {s.percent}
          </span>
          <span className="dash-detail__action" data-action={s.action}>
            {s.peakLabel}
          </span>
          <span className="dash-detail__time">
            {s.live ? 'Updated ' : 'Ended '}
            {relativeTime(s.updatedAtMs, now)}
          </span>
        </div>
        <dl className="dash-facts">
          <div>
            <dt>Stage</dt>
            <dd>{s.stageText}</dd>
          </div>
          <div>
            <dt>Scam type</dt>
            <dd>{s.scamTypeText ?? '—'}</dd>
          </div>
          <div>
            <dt>Language</dt>
            <dd>{s.language}</dd>
          </div>
          <div>
            <dt>Call length</dt>
            <dd>{formatClock(Math.max(0, (s.updatedAtMs - s.startedAtMs) / 1000))}</dd>
          </div>
        </dl>
      </div>

      <div className="dash-card">
        <h2>Risk over time</h2>
        {risk.status === 'error' && <p className="dash__error">{risk.error}</p>}
        <RiskChart points={risk.data} />
      </div>

      <div className="dash-card">
        <h2>Flags raised</h2>
        {s.flagLabels.length === 0 ? (
          <p className="dash__muted">None yet</p>
        ) : (
          <ul className="dash-flags">
            {s.flagLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="dash-card">
        <h2>Transfer hold</h2>
        {holds.status === 'error' && <p className="dash__error">{holds.error}</p>}
        {holds.data.length === 0 ? (
          <p className="dash__muted">No transfer held on this call</p>
        ) : (
          holds.data.map((h) => <HoldCard key={h.id} hold={h} />)
        )}
      </div>
    </section>
  );
}

function HoldCard({ hold }: { hold: HoldView }) {
  return (
    <div className="dash-hold" data-held={hold.held}>
      <span className="dash-hold__amount">{hold.amountText}</span>
      <span className="dash-hold__status">{hold.statusText}</span>
      <span className="dash-hold__meta">
        to {hold.account} · {formatClock(hold.atSec)} into the call
      </span>
    </div>
  );
}
