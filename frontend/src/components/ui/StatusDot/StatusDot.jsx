import { cn } from '../cn';
import styles from './StatusDot.module.css';

/**
 * A status indicator that never relies on colour alone: the dot is paired
 * with a label.
 */
export default function StatusDot({ status = 'neutral', label, className, ...rest }) {
  return (
    <span className={cn(styles.status, className)} data-status={status} role="status" {...rest}>
      <span className={styles.dot} aria-hidden="true" />
      {label ? <span className={styles.label}>{label}</span> : null}
    </span>
  );
}
