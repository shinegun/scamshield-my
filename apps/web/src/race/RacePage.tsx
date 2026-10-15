import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RaceEntry } from '@scamshield/shared';
import { connectCallSocket, type CallSocket } from '../call/socket';
import { PIPELINE_URL } from '../config';
import { formatLatency } from '../call/labels';
import {
  MAX_CHARS,
  RUNS,
  SCORER_LABELS,
  buildPresets,
  deckLine,
  fasterNote,
  summarizeRuns,
  toColumns,
  type ColumnView,
} from './view';
import './race.css';

type Link_ = 'connecting' | 'open' | 'down';

interface Pending {
  resolve(entries: RaceEntry[]): void;
  reject(message: string): void;
}

// Jev vs Gemini: the same transcript chunk goes to both scorers through the
// pipeline; the page shows how long each took and what each said.
export function RacePage() {
  const presets = useMemo(() => buildPresets(), []);
  const [text, setText] = useState(presets[0]?.text ?? '');
  const [language, setLanguage] = useState(presets[0]?.language ?? 'en-MY');
  const [presetId, setPresetId] = useState(presets[0]?.id ?? '');
  const [link, setLink] = useState<Link_>('connecting');
  const [busy, setBusy] = useState<null | { run: number; of: number }>(null);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<RaceEntry[][]>([]);
  const [copied, setCopied] = useState(false);

  const socketRef = useRef<CallSocket | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  useEffect(() => {
    const socket = connectCallSocket(PIPELINE_URL, {
      onMessage(m) {
        if (m.type === 'race.result') {
          pendingRef.current?.resolve(m.entries);
          pendingRef.current = null;
        } else if (m.type === 'error') {
          if (pendingRef.current) pendingRef.current.reject(m.message);
          else setError(m.message);
          pendingRef.current = null;
        }
      },
      onError(message) {
        setLink('down');
        setError(message);
      },
      onClose() {
        setLink('down');
        pendingRef.current?.reject('The pipeline closed the connection');
        pendingRef.current = null;
      },
    });
    socketRef.current = socket;
    setLink('open');
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, []);

  const raceOnce = useCallback(
    (chunk: string, lang: string) =>
      new Promise<RaceEntry[]>((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket) return reject(new Error('Not connected'));
        pendingRef.current = { resolve, reject: (m) => reject(new Error(m)) };
        socket.send({ type: 'race.run', text: chunk, language: lang });
      }),
    [],
  );

  const run = useCallback(
    async (times: number) => {
      if (busy || !text.trim()) return;
      setError(null);
      setCopied(false);
      setRuns([]);
      const done: RaceEntry[][] = [];
      try {
        for (let i = 1; i <= times; i++) {
          setBusy({ run: i, of: times });
          done.push(await raceOnce(text, language));
          setRuns([...done]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    },
    [busy, text, language, raceOnce],
  );

  const choose = (id: string) => {
    const p = presets.find((x) => x.id === id);
    setPresetId(id);
    if (p) {
      setText(p.text);
      setLanguage(p.language);
    }
  };

  const latest = runs[runs.length - 1];
  const columns = latest ? toColumns(latest) : [];
  const jev = columns.find((c) => c.scorer === 'jev');
  const gem = columns.find((c) => c.scorer === 'gemini');
  const note = jev?.ok && gem?.ok ? fasterNote(jev.latencyMs, gem.latencyMs) : '';
  const stats = runs.length > 1 ? summarizeRuns(runs) : null;

  const copy = async () => {
    if (!stats) return;
    try {
      await navigator.clipboard.writeText(deckLine(stats));
      setCopied(true);
    } catch {
      setError('Could not copy to the clipboard');
    }
  };

  return (
    <div className="race">
      <header className="race__head">
        <h1>Jev vs Gemini</h1>
        <Link to="/dashboard" className="race__back">
          ← Back to the dashboard
        </Link>
      </header>
      <p className="race__lede">
        The same transcript chunk goes to both scorers at once. Each gets the chunk as a fresh call, with no earlier
        context.
      </p>

      <section className="race__input">
        <div className="race__presets" role="group" aria-label="Preset chunks">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`race__chip${p.id === presetId ? ' race__chip--on' : ''}`}
              onClick={() => choose(p.id)}
              disabled={busy !== null}
            >
              {p.label}
            </button>
          ))}
        </div>
        <textarea
          className="race__text"
          value={text}
          maxLength={MAX_CHARS}
          rows={8}
          aria-label="Transcript chunk"
          onChange={(e) => {
            setText(e.target.value);
            setPresetId('');
          }}
        />
        <div className="race__row">
          <label className="race__lang">
            Language
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="ms-MY">Malay</option>
              <option value="en-MY">English / Manglish</option>
            </select>
          </label>
          <span className="race__count">
            {text.length} / {MAX_CHARS}
          </span>
          <button
            type="button"
            className="race__go"
            onClick={() => void run(1)}
            disabled={busy !== null || link === 'down' || !text.trim()}
          >
            Race once
          </button>
          <button
            type="button"
            className="race__go race__go--alt"
            onClick={() => void run(RUNS)}
            disabled={busy !== null || link === 'down' || !text.trim()}
          >
            Run {RUNS} times
          </button>
        </div>
        {busy && (
          <p className="race__muted" role="status">
            Running {busy.run} of {busy.of}…
          </p>
        )}
        {error && (
          <p className="race__error" role="alert">
            {error}
          </p>
        )}
      </section>

      {columns.length > 0 && (
        <section aria-label="Result">
          {note && <p className="race__note">{note}</p>}
          <div className="race__cols">
            {columns.map((c) => (
              <Column key={c.scorer} c={c} />
            ))}
          </div>
        </section>
      )}

      {stats && !busy && (
        <section className="race__stats" aria-label="Latency over runs">
          <h2>
            Median of {RUNS} runs
          </h2>
          <table>
            <thead>
              <tr>
                <th />
                <th>Median</th>
                <th>Min</th>
                <th>Max</th>
                <th>Answered</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.scorer}>
                  <th scope="row">{SCORER_LABELS[s.scorer]}</th>
                  <td>{s.ok ? formatLatency(s.medianMs) : '-'}</td>
                  <td>{s.ok ? formatLatency(s.minMs) : '-'}</td>
                  <td>{s.ok ? formatLatency(s.maxMs) : '-'}</td>
                  <td>
                    {s.ok} / {s.runs}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="race__go race__go--alt" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy for deck'}
          </button>
          <p className="race__muted">{deckLine(stats)}</p>
        </section>
      )}
    </div>
  );
}

function Column({ c }: { c: ColumnView }) {
  return (
    <article className={`race__col race__col--${c.scorer}`}>
      <h2>{c.title}</h2>
      {c.model && <p className="race__model">{c.model}</p>}
      <p className="race__latency">{c.latencyText}</p>
      <div className="race__bar" aria-hidden="true">
        <div className="race__bar-fill" style={{ width: `${c.barPercent}%` }} />
      </div>
      {c.ok ? (
        <dl className="race__facts">
          <dt>Risk</dt>
          <dd>{c.percent}</dd>
          <dt>Stage</dt>
          <dd>{c.stageText}</dd>
          <dt>Scam type</dt>
          <dd>{c.scamTypeText}</dd>
          <dt>Flags</dt>
          <dd>
            {c.flags.length === 0 ? (
              <span className="race__muted">None raised</span>
            ) : (
              <ul className="race__flags">
                {c.flags.map((f) => (
                  <li key={f.key}>
                    {f.label} <span className="race__muted">{Math.round(f.score * 100)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </dl>
      ) : (
        <p className="race__error">{c.error}</p>
      )}
    </article>
  );
}
