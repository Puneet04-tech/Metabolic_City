import { cn } from '../ui/cn';
import { useRelativeTime } from '../../lib/useRelativeTime.js';
import styles from './TelemetryStatus.module.css';

const STALE_AFTER_MS = 60 * 1000;

/**
 * Telemetry state: a live or stale indicator plus how old the last reading is.
 */
export default function TelemetryStatus({ connection = 'connecting', lastUpdated, className }) {
  const relative = useRelativeTime(lastUpdated);
  const stale = lastUpdated ? Date.now() - new Date(lastUpdated).getTime() > STALE_AFTER_MS : false;

  const state = connection === 'live' && !stale ? 'live' : stale ? 'stale' : connection === 'degraded' ? 'degraded' : 'connecting';

  const label =
    state === 'live' ? 'Live' : state === 'stale' ? 'Stale' : state === 'degraded' ? 'Degraded' : 'Connecting';

  return (
    <div className={cn(styles.status, className)} data-state={state} role="status" aria-live="polite">
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
      {relative ? <span className={styles.time}>Updated {relative}</span> : null}
    </div>
  );
}
