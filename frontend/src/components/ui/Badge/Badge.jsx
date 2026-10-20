import { cn } from '../cn';
import styles from './Badge.module.css';

/**
 * A tag for metadata (role, source, status of a non-severity concept).
 * Severity uses SeverityBadge instead.
 */
export default function Badge({ tone = 'neutral', className, children, ...rest }) {
  return (
    <span className={cn(styles.badge, className)} data-tone={tone} {...rest}>
      {children}
    </span>
  );
}
