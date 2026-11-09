import { cellRef } from '../../lib/cells/index.js';
import styles from './ReportVerificationPanel.module.css';

const STATES = [
  {
    value: 'UNVERIFIED',
    label: 'Unverified',
    hint: 'One report, awaiting independent evidence',
  },
  {
    value: 'CORROBORATED',
    label: 'Corroborated',
    hint: 'Two or more distinct reporters',
  },
  {
    value: 'VERIFIED',
    label: 'Field verified',
    hint: 'Confirmed by a field crew',
  },
];

const STATUS_LABELS = {
  OPEN: 'Open',
  ACKNOWLEDGED: 'Acknowledged',
};

const stateFor = (alert) =>
  STATES.some((state) => state.value === alert.verification)
    ? alert.verification
    : 'UNVERIFIED';

/**
 * The evidence level of citizen and field reports.
 *
 * A report is not automatically true. One resident is unverified, two
 * independent residents corroborate it, and a field crew verifies it. Keeping
 * those states visible is what lets an operator decide how much weight to give
 * a report before dispatching anyone.
 */
export default function ReportVerificationPanel({ alerts = [], onSelect }) {
  const reports = alerts.filter((alert) => alert.type === 'REPORT');
  const counts = Object.fromEntries(STATES.map((state) => [state.value, 0]));
  for (const report of reports) counts[stateFor(report)] += 1;

  return (
    <section
      className={styles.panel}
      aria-label="Citizen and field report verification"
      aria-live="polite"
    >
      <header className={styles.header}>
        <h3 className={styles.title}>Citizen &amp; field reports</h3>
        <span className={styles.count}>
          {reports.length} in the current alert window
        </span>
      </header>

      <dl className={styles.states}>
        {STATES.map((state) => (
          <div key={state.value} className={styles.state} data-state={state.value}>
            <dt className={styles.stateLabel}>{state.label}</dt>
            <dd className={styles.stateValue}>
              {counts[state.value]}
              <span className={styles.stateHint}>{state.hint}</span>
            </dd>
          </div>
        ))}
      </dl>

      {reports.length ? (
        <>
          <ul className={styles.list}>
            {reports.slice(0, 3).map((report) => {
              const state = stateFor(report);
              const stateLabel = STATES.find((item) => item.value === state)?.label;
              const evidence = Number(report.evidenceCount) || 1;
              const content = (
                <>
                  <span className={styles.reportText}>
                    <span className={styles.reportTitle}>{report.title}</span>
                    <span className={styles.reportMeta}>
                      Cell {cellRef(report.h3Index)} ·{' '}
                      {STATUS_LABELS[report.status] || report.status} · {evidence}{' '}
                      {evidence === 1 ? 'report' : 'reports'}
                    </span>
                  </span>
                  <span className={styles.badge} data-state={state}>
                    {stateLabel}
                  </span>
                </>
              );

              return (
                <li key={report.alertKey || report._id || report.h3Index} className={styles.item}>
                  {onSelect ? (
                    <button
                      type="button"
                      className={styles.report}
                      onClick={() => onSelect(report)}
                      aria-label={`Open ${report.title} in cell ${cellRef(report.h3Index)}`}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className={styles.report}>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
          {reports.length > 3 ? (
            <p className={styles.more}>
              +{reports.length - 3} more in the live alert feed
            </p>
          ) : null}
        </>
      ) : (
        <p className={styles.empty}>
          No citizen or field reports in the current alert window. A resident report starts
          unverified, two independent reporters corroborate it, and a field crew report is
          field verified.
        </p>
      )}
    </section>
  );
}
