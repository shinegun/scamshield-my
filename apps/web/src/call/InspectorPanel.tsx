import { DEFAULT_THRESHOLDS, type Action } from '@scamshield/shared';
import { buildChart } from '../dashboard/view';
import { useCall } from './CallProvider';
import { inspect } from './inspector';
import { langOf } from './labels';
import './inspector.css';

const MAX_NOT_YET = 3;

// Colour comes from an Action only (ADR 6), never from a number.
const textClass = (a: Action) => `insp__text--${a}`;
const FILL: Record<Action, string> = {
  none: 'var(--light-text-tertiary)',
  soft_warning: 'var(--light-risk-soft)',
  strong_warning: 'var(--light-risk-strong)',
  hold_transfers: 'var(--light-risk-strong)',
};
const DOT_TEXT: Record<Action, string> = {
  none: 'var(--light-text-primary)',
  soft_warning: 'var(--light-risk-soft-text)',
  strong_warning: 'var(--light-risk-strong-text)',
  hold_transfers: 'var(--light-risk-strong-text)',
};

export function InspectorPanel() {
  const { risk, riskHistory, script } = useCall();
  const view = inspect(risk, riskHistory, langOf(script?.language));
  const chart = buildChart(view.points, 860, 140);
  const last = chart.dots[chart.dots.length - 1];
  const shownMore = view.notYet.length - MAX_NOT_YET;
  const percentText = view.percent === undefined ? '—' : `${view.percent}%`;

  return (
    <div className="insp">
      <div className="insp__head">
        <div>
          <div className="insp__kicker">What ScamShield hears</div>
          <div className="insp__big">
            <span className={textClass(view.action)}>{percentText}</span> scam risk
          </div>
        </div>
        <div className="insp__meta">
          {view.scoredBy && <div>{view.scoredBy}</div>}
          {view.scamType && <div>Likely type: {view.scamType}</div>}
        </div>
      </div>

      <div className="insp__card">
        <ol className="insp__bars" aria-label="Scam stages reached">
          {view.stages.map((s) => (
            <li
              key={s.key}
              className="insp__stage"
              aria-current={s.current ? 'step' : undefined}
              data-reached={s.reached}
              data-current={s.current}
            >
              <span
                className="insp__bar"
                style={{ background: s.reached ? FILL[view.action] : undefined }}
              />
              <span className="insp__stage-label">{s.label}</span>
            </li>
          ))}
        </ol>

        <svg
          className="insp__chart"
          viewBox="0 0 860 140"
          role="img"
          aria-label={
            view.percent === undefined
              ? 'Risk over the call, no reading yet'
              : `Risk over the call, now ${view.percent} percent`
          }
        >
          <line x1="0" x2="860" y1={chart.yAt(DEFAULT_THRESHOLDS.soft)} y2={chart.yAt(DEFAULT_THRESHOLDS.soft)} stroke="var(--light-risk-soft)" strokeWidth="1" strokeDasharray="3 5" />
          <line x1="0" x2="860" y1={chart.yAt(DEFAULT_THRESHOLDS.strong)} y2={chart.yAt(DEFAULT_THRESHOLDS.strong)} stroke="var(--light-risk-strong)" strokeWidth="1" strokeDasharray="3 5" />
          {/* Hold is red like strong; longer dashes tell the two apart. */}
          <line x1="0" x2="860" y1={chart.yAt(DEFAULT_THRESHOLDS.hold)} y2={chart.yAt(DEFAULT_THRESHOLDS.hold)} stroke="var(--light-risk-strong)" strokeWidth="1" strokeDasharray="10 4" />
          {view.actionChanges.map((c) => (
            <line
              key={`${c.atSec}-${c.action}`}
              x1={chart.xAt(c.atSec)}
              x2={chart.xAt(c.atSec)}
              y1="0"
              y2="140"
              stroke={FILL[c.action]}
              strokeWidth="1"
              opacity="0.5"
            />
          ))}
          {last ? (
            <>
              <path d={chart.path} fill="none" stroke="var(--light-text-primary)" strokeWidth="2.5" />
              <circle cx={last.x} cy={last.y} r="5" fill={DOT_TEXT[view.action]} />
            </>
          ) : (
            <text x="430" y="76" textAnchor="middle" fontSize="14" fill="var(--light-text-tertiary)">
              Waiting for the first reading
            </text>
          )}
        </svg>
      </div>

      <div className="insp__cols">
        <section>
          <h3 className="insp__h">Heard</h3>
          <ul className="insp__group">
            {view.heard.length === 0 && (
              <li className="insp__row insp__row--muted">
                <span>Nothing yet</span>
              </li>
            )}
            {view.heard.map((h) => (
              <li key={h.flag} className="insp__row">
                <span>{h.label}</span>
                <span className="insp__dot" style={{ background: FILL[h.action] }} />
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="insp__h">Not yet</h3>
          <ul className="insp__group insp__group--muted">
            {view.notYet.slice(0, MAX_NOT_YET).map((n) => (
              <li key={n.flag} className="insp__row">
                <span>{n.label}</span>
              </li>
            ))}
            {shownMore > 0 && (
              <li className="insp__row">
                <span>+ {shownMore} more</span>
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
