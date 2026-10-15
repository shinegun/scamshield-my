import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RaceEntry } from '@scamshield/shared';
import { connectCallSocket, type CallSocket } from '../call/socket';
import { PIPELINE_URL } from '../config';
import {
  RUNS,
  axisTicks,
  buildPresets,
  deckLine,
  laneViews,
  raceHeadline,
  raceSubline,
  scaleMaxFor,
  summarizeRuns,
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
  const [ranLabel, setRanLabel] = useState('');

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
      setRanLabel(presets.find((p) => p.id === presetId)?.label ?? '');
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
    [busy, text, language, raceOnce, presets, presetId],
  );

  const choose = (id: string) => {
    const p = presets.find((x) => x.id === id);
    setPresetId(id);
    if (p) {
      setText(p.text);
      setLanguage(p.language);
    }
  };

  const stats = runs.length > 0 ? summarizeRuns(runs) : null;
  const headline = raceHeadline(stats);
  const lanes = laneViews(runs);
  const ticks = axisTicks(scaleMaxFor(runs));
  const disabled = busy !== null || link === 'down' || !text.trim();

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
      <nav className="race__nav">
        <h1 className="race__brand">Jev vs Gemini</h1>
        <Link to="/dashboard" className="race__link race__link--first">
          Fraud desk
        </Link>
        <Link to="/" className="race__link">
          Back to the phone
        </Link>
      </nav>

      <header className="race__top">
        <p className="race__sub">
          {runs.length > 0
            ? raceSubline(ranLabel, runs.length)
            : 'Pick a line from a scripted call and race the two scorers.'}
        </p>
        <p className="race__headline" aria-live="polite">
          {headline.lead}
          {headline.value && <span className="race__value">{headline.value}</span>}
          {headline.value && '.'}
        </p>
      </header>

      <div className="race__presets" role="group" aria-label="Scripted lines">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            className="race__chip"
            aria-pressed={p.id === presetId}
            onClick={() => choose(p.id)}
            disabled={busy !== null}
          >
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      <section className="race__lanes" aria-label="Latency by scorer">
        {lanes.map((l) => {
          const won = headline.winner === l.scorer;
          return (
            <div key={l.scorer} className="race__lane">
              <div className="race__name">{l.title}</div>
              <div className="race__track">
                {l.dots.length > 0 && (
                  <div
                    className={`race__bar${won ? ' race__bar--win' : ''}`}
                    style={{ width: `${l.medianPercent}%` }}
                  />
                )}
                {l.dots.map((d, i) => (
                  <span key={i} className="race__dot" style={{ left: `${d}%` }} />
                ))}
              </div>
              <div className="race__figures">
                <div className={`race__median${won ? ' race__median--win' : ''}`}>{l.medianText}</div>
                <div className="race__meta">{l.rangeText || '\u00a0'}</div>
                <div className="race__meta">{l.error ?? l.verdict ?? '\u00a0'}</div>
              </div>
            </div>
          );
        })}
        <div className="race__lane race__lane--axis" aria-hidden="true">
          <div />
          <div className="race__ticks">
            {ticks.map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>
          <div />
        </div>
      </section>

      <footer className="race__bottom">
        <div className="race__actions">
          <button type="button" className="race__go" onClick={() => void run(1)} disabled={disabled}>
            Race again
          </button>
          <button type="button" className="race__go race__go--alt" onClick={() => void run(RUNS)} disabled={disabled}>
            Run {RUNS} times
          </button>
          {busy && (
            <span className="race__meta" role="status">
              Run {busy.run} of {busy.of}…
            </span>
          )}
          {error && (
            <span className="race__error" role="alert">
              {error}
            </span>
          )}
        </div>
        <div className="race__note">
          <span>Bars show the median. Dots are single runs.</span>
          {runs.length >= 2 && !busy && (
            <button type="button" className="race__copy" onClick={() => void copy()}>
              {copied ? 'Copied' : 'Copy summary'}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
