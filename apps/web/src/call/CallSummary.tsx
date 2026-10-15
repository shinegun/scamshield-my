import { useCall } from './CallProvider';
import { callerIdOf } from './callerId';
import { langOf } from './labels';
import { summarize, summaryStrings } from './summary';
import './summary.css';

// Shown in the phone once a call has ended (summary.dc.html).
export function CallSummary() {
  const call = useCall();
  const lang = langOf(call.script?.language);
  const summary = summarize(call, lang);
  const t = summaryStrings(lang);
  const number = callerIdOf(call.script)?.number;

  return (
    <div className="summary" lang={call.script?.language}>
      <div className="summary__scroll">
        <h1 className="summary__title">{t.title}</h1>
        <p className="summary__sub">{[number, summary.subtitle].filter(Boolean).join(' · ')}</p>

        <dl className="summary__stats">
          <div>
            <dt>{t.peakRisk}</dt>
            <dd data-tone={summary.peak.tone}>{summary.peak.value}</dd>
          </div>
          <div>
            <dt>{summary.firstWarning.label}</dt>
            <dd>{summary.firstWarning.value}</dd>
          </div>
          <div>
            <dt>{summary.kept.label}</dt>
            <dd data-tone={summary.kept.tone}>{summary.kept.value}</dd>
          </div>
        </dl>

        <h2 className="summary__section">{t.whatHappened}</h2>
        {summary.calm ? (
          <div className="summary__group summary__calm">
            <p className="summary__calm-title">{t.calmTitle}</p>
            <p className="summary__calm-text">{t.calmText}</p>
          </div>
        ) : (
          <ol className="summary__group">
            {summary.events.map((e, i) => (
              <li key={i} className="summary__row">
                <span className="summary__time">{e.time}</span>
                <span data-tone={e.tone}>{e.text}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="summary__actions">
        {!summary.calm && (
          <a className="summary__primary" href="tel:997">
            {t.report}
          </a>
        )}
        <button type="button" className={summary.calm ? 'summary__primary' : 'summary__link'} onClick={call.reset}>
          {t.tryAnother}
        </button>
      </div>
    </div>
  );
}
