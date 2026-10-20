import { cn } from '../cn';
import styles from './SegmentedControl.module.css';

/**
 * A single-choice control rendered as a radio group.
 * Each option can carry a secondary hint (for example the score code).
 */
export default function SegmentedControl({ options, value, onChange, ariaLabel, className, ...rest }) {
  return (
    <div className={cn(styles.group, className)} role="radiogroup" aria-label={ariaLabel} {...rest}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={styles.option}
            data-active={active ? 'true' : undefined}
            onClick={() => onChange(option.value)}
          >
            <span className={styles.label}>{option.label}</span>
            {option.hint ? <span className={styles.hint}>{option.hint}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
