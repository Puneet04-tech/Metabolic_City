import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { cn } from '../cn';
import styles from './SeverityBadge.module.css';

const SEVERITY_META = {
  critical: { label: 'Critical', Icon: ShieldAlert },
  caution: { label: 'Caution', Icon: AlertTriangle },
  normal: { label: 'Normal', Icon: CheckCircle2 },
  info: { label: 'Info', Icon: Info },
};

/**
 * Severity is never colour-only: every badge carries an icon and a word.
 */
export default function SeverityBadge({ severity = 'normal', label, className, ...rest }) {
  const meta = SEVERITY_META[severity] ?? SEVERITY_META.normal;
  const { Icon } = meta;

  return (
    <span className={cn(styles.badge, className)} data-severity={severity} {...rest}>
      <Icon className={styles.icon} size={12} aria-hidden="true" />
      {label ?? meta.label}
    </span>
  );
}
