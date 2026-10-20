import { CloudOff, RefreshCw } from 'lucide-react';
import Button from '../ui/Button/Button';
import { cn } from '../ui/cn';
import styles from './OfflineBanner.module.css';

/**
 * Shown whenever the device is offline or updates are waiting to sync.
 * Nothing in the field console fails silently.
 */
export default function OfflineBanner({ offline = false, pending = 0, onSync, className, ...rest }) {
  if (!offline && !pending) return null;

  return (
    <div className={cn(styles.banner, className)} role="status" aria-live="polite" {...rest}>
      <CloudOff className={styles.icon} size={15} aria-hidden="true" />
      <div className={styles.body}>
        {offline ? (
          <p className={styles.title}>You are offline</p>
        ) : (
          <p className={styles.title}>
            {pending} update{pending === 1 ? '' : 's'} waiting to sync
          </p>
        )}
        <p className={styles.text}>
          {offline
            ? 'Updates you make now are saved on this device and sent when the connection returns.'
            : 'Your updates are saved on this device and will be sent on the next connection.'}
        </p>
      </div>
      {onSync && !offline ? (
        <Button variant="secondary" size="sm" onClick={onSync}>
          <RefreshCw size={13} aria-hidden="true" />
          Sync now
        </Button>
      ) : null}
    </div>
  );
}
