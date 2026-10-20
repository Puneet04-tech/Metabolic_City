import { useEffect, useState } from 'react';
import { cn } from '../ui/cn';
import styles from './TelemetryStatus.module.css';

const STALE_AFTER_MS = 60 * 1000;

/** "Updated 12s ago" — relative for recent readings. */
export function useRelativeTime(timestamp) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!timestamp) return null;

  const seconds = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} h ago`;
}

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
