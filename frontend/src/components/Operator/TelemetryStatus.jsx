import { cn } from '../ui/cn';
import { useRelativeTime } from '../../lib/useRelativeTime.js';
import styles from './TelemetryStatus.module.css';

/**
 * The shortest a feed can be before it is called stale.
 *
 * The pipeline refreshes every ten minutes, so anything shorter would call
 * perfectly fresh readings stale. Until the cadence has been observed this
 * is the threshold in force.
 */
const MIN_STALE_AFTER_MS = 12 * 60 * 1000;

/** The longest it can be before the staleness is meaningless anyway. */
const MAX_STALE_AFTER_MS = 30 * 60 * 1000;

/**
 * When a feed counts as stale.
 *
 * The server publishes cells when the pipeline runs, so the gap between two
 * payloads is the refresh cadence. A fixed threshold of a minute would call
 * a feed that refreshes every ten minutes stale for nine minutes out of ten,
 * so the threshold follows the cadence that was actually observed.
 */
export const staleAfterMs = (cadence) => {
  if (!Number.isFinite(cadence) || cadence <= 0) return MIN_STALE_AFTER_MS;
  return Math.min(MAX_STALE_AFTER_MS, Math.max(MIN_STALE_AFTER_MS, cadence * 1.5));
};

/**
 * Telemetry state: a live or stale indicator plus how old the last reading
 * is. The age shown is the age of the data the server produced, not the age
 * of the message that carried it.
 */
export default function TelemetryStatus({
  connection = 'connecting',
  lastUpdated,
  serverUpdated,
  cadence,
  className,
}) {
  const relative = useRelativeTime(serverUpdated || lastUpdated);
  const threshold = staleAfterMs(cadence);
  // The age that matters is the age of the data, not the age of the message
  // that carried it: a single recalculated cell arrives straight away, but
  // the readings behind it are only as fresh as the last pipeline run.
  const stamp = serverUpdated || lastUpdated;
  const stale = stamp ? Date.now() - new Date(stamp).getTime() > threshold : false;

  const state =
    connection === 'live' && !stale
      ? 'live'
      : stale
        ? 'stale'
        : connection === 'degraded'
          ? 'degraded'
          : 'connecting';

  const label =
    state === 'live'
      ? 'Live'
      : state === 'stale'
        ? 'Stale'
        : state === 'degraded'
          ? 'Degraded'
          : 'Connecting';

  return (
    <div className={cn(styles.status, className)} data-state={state} role="status" aria-live="polite">
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
      {relative ? <span className={styles.time}>Updated {relative}</span> : null}
    </div>
  );
}
