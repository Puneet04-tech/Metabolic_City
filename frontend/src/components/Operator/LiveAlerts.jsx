import { cellRef } from '../../lib/cells/index.js';
import styles from './LiveAlerts.module.css';

const VERIFICATION_LABELS = {
  UNVERIFIED: 'Unverified',
  PROVIDER_REPORTED: 'Provider reported',
  OBSERVED: 'Observed',
  CORROBORATED: 'Corroborated',
  VERIFIED: 'Field verified',
};

const STATUS_LABELS = {
  OPEN: 'Open',
  ACKNOWLEDGED: 'Acknowledged',
};

/**
 * The live alert feed.
 *
 * It is driven by the alert lifecycle stream, not by the selected cell, so an
 * operator sees an alert arrive and clear without refreshing or opening that
 * cell. Clicking an alert opens the cell it belongs to.
 */
export default function LiveAlerts({ alerts = [], threshold = 7, onSelect }) {
  if (!alerts.length) return null;

  return (
    <section className={styles.feed} aria-label="Live alerts" aria-live="polite">
      <header className={styles.header}>
        <span className={styles.liveDot} aria-hidden="true" />
        <strong className={styles.title}>
          {alerts.length} active alert{alerts.length === 1 ? '' : 's'}
        </strong>
        <span className={styles.hint}>Live incident lifecycle</span>
      </header>

      <ul className={styles.list}>
        {alerts.slice(0, 4).map((alert) => {
          const severity = Number(alert.severity) || 0;
          const critical = severity >= threshold;
          const content = (
            <>
              <span className={styles.score} data-severity={critical ? 'critical' : 'warning'}>
                {severity.toFixed(1)}
              </span>
              <span className={styles.text}>
                <span className={styles.alertTitle}>{alert.title}</span>
                <span className={styles.meta}>
                  Cell {cellRef(alert.h3Index)} · {STATUS_LABELS[alert.status] || alert.status} ·{' '}
                  {VERIFICATION_LABELS[alert.verification] || alert.verification}
                </span>
              </span>
            </>
          );

          return (
            <li key={alert.alertKey} className={styles.item}>
              {onSelect ? (
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => onSelect(alert)}
                  aria-label={`Open ${alert.title} in cell ${cellRef(alert.h3Index)}`}
                >
                  {content}
                </button>
              ) : (
                <div className={styles.button}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
