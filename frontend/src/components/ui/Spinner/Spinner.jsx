import { cn } from '../cn';
import styles from './Spinner.module.css';

/** Inline spinner for short waits. Never used as a full-page loading state. */
export default function Spinner({ size = 16, label = 'Loading', className, ...rest }) {
  return (
    <span className={cn(styles.spinner, className)} role="status" aria-label={label} {...rest}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}
