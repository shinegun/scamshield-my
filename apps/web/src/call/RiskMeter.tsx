import { DEFAULT_THRESHOLDS, SCAM_STAGE_KEYS, type Action } from '@scamshield/shared';
import { useCall } from './CallProvider';
import { actionLabel, langOf, latestScored, scamTypeLabel, scorerTag, stageDescription, stageLabel } from './labels';

const TICKS: Array<{ action: Action; at: number }> = [
  { action: 'soft_warning', at: DEFAULT_THRESHOLDS.soft },
  { action: 'strong_warning', at: DEFAULT_THRESHOLDS.strong },
  { action: 'hold_transfers', at: DEFAULT_THRESHOLDS.hold },
];

// Risk bar coloured by action, threshold ticks, scam stage, scam type and
// the scorer tag.
export function RiskMeter() {
  const { risk, riskHistory, script } = useCall();
  const lang = langOf(script?.language);
  const meterLabel = lang === 'ms' ? 'Risiko penipuan' : 'Scam risk';
  const value = risk?.risk ?? 0;
  const action = risk?.action ?? 'none';
  const stage = risk?.stage ?? 'none';
  const percent = Math.round(value * 100);
  const scored = latestScored(riskHistory);
  const stageIndex = SCAM_STAGE_KEYS.indexOf(stage);

  return (
    <section className="risk" aria-label={meterLabel}>
      <div className="risk__row">
        <span className="risk__percent" data-action={action}>
          {percent}%
        </span>
        <span className="risk__action" data-action={action}>
          {actionLabel(action, lang)}
        </span>
        {scored && <span className="risk__tag">{scorerTag(scored)}</span>}
      </div>

      <div
        className="risk__bar"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={meterLabel}
      >
        <div className="risk__fill" data-action={action} style={{ width: `${percent}%` }} />
        {TICKS.map((tick) => (
          <span
            key={tick.action}
            className="risk__tick"
            data-action={tick.action}
            style={{ left: `${tick.at * 100}%` }}
            title={`${actionLabel(tick.action, lang)} ${lang === 'ms' ? 'pada' : 'at'} ${Math.round(tick.at * 100)}%`}
          />
        ))}
      </div>

      <div className="risk__stage">
        <div className="risk__stage-head">
          <span className="risk__stage-name">{stageLabel(stage, lang)}</span>
          {/* Only once the engine acts, so an innocent call shows no scam label. */}
          {risk && risk.action !== 'none' && risk.scamType !== 'none' && (
            <span className="risk__type">{scamTypeLabel(risk.scamType, lang)}</span>
          )}
        </div>
        <p className="risk__stage-desc">{stageDescription(stage, lang)}</p>
        <ol className="risk__steps" aria-hidden="true">
          {SCAM_STAGE_KEYS.slice(1).map((key, i) => (
            <li key={key} className={i + 1 <= stageIndex ? 'is-reached' : undefined} />
          ))}
        </ol>
      </div>
    </section>
  );
}
