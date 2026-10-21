import { Loader2 } from 'lucide-react';
import { cn } from '../cn';
import styles from './Spinner.module.css';

/** Inline spinner for short waits. Never used as a full-page loading state. */
export default function Spinner({ size = 16, label = 'Loading', className, ...rest }) {
  return (
    <span className={cn(styles.spinner, className)} role="status" aria-label={label} {...rest}>
      <Loader2 size={size} aria-hidden="true" />
    </span>
  );
}
