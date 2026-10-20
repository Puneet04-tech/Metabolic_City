import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '../cn';
import styles from './StatBlock.module.css';

/**
 * One metric: label, value with unit, and a delta against a stated period.
 * The delta always says what it is compared with.
 */
export default function StatBlock({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  period,
  tone = 'neutral',
  className,
  ...rest
}) {
  const hasDelta = delta !== undefined && delta !== null;
  const direction = hasDelta ? (delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat') : 'flat';
  const DeltaIcon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;

  return (
    <div className={cn(styles.block, className)} data-tone={tone} {...rest}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>
        {value}
        {unit ? <span className={styles.unit}>{unit}</span> : null}
      </p>
      {hasDelta ? (
        <p className={styles.delta} data-direction={direction}>
          <DeltaIcon size={13} aria-hidden="true" />
          <span className={styles.deltaValue}>
            {delta > 0 ? '+' : ''}
            {delta}
          </span>
          {deltaLabel ? <span className={styles.deltaLabel}>{deltaLabel}</span> : null}
        </p>
      ) : null}
      {period ? <p className={styles.period}>{period}</p> : null}
    </div>
  );
}
