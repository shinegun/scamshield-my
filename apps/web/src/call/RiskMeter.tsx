import { actionLabel, langOf } from './labels';
import { useCall } from './CallProvider';

// One small status line under the caller. Colour comes from the action only
// (ADR 6). The detailed meter moves to a desktop panel later.
export function RiskMeter() {
  const { risk, script } = useCall();
  if (!risk) return null;
  const lang = langOf(script?.language);
  const label = lang === 'ms' ? 'Risiko penipuan' : 'Scam risk';
  return (
    <p className="risk-line" data-action={risk.action}>
      {label} {Math.round(risk.risk * 100)}% · {actionLabel(risk.action, lang)}
    </p>
  );
}
