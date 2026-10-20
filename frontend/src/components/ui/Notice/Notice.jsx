import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';
import { cn } from '../cn';
import styles from './Notice.module.css';

const TONE_META = {
  info: { Icon: Info, role: 'status' },
  success: { Icon: CheckCircle2, role: 'status' },
  warning: { Icon: AlertTriangle, role: 'alert' },
  error: { Icon: AlertCircle, role: 'alert' },
};

/**
 * Inline, in-page message. Errors are assertive, everything else is a
 * polite status region.
 */
export default function Notice({
  tone = 'info',
  title,
  dismissible = false,
  onDismiss,
  className,
  children,
  ...rest
}) {
  const meta = TONE_META[tone] ?? TONE_META.info;
  const { Icon } = meta;

  return (
    <div className={cn(styles.notice, className)} data-tone={tone} role={meta.role} {...rest}>
      <Icon className={styles.icon} size={16} aria-hidden="true" />
      <div className={styles.body}>
        {title ? <p className={styles.title}>{title}</p> : null}
        {children ? <div className={styles.content}>{children}</div> : null}
      </div>
      {dismissible ? (
        <button type="button" className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss message">
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
