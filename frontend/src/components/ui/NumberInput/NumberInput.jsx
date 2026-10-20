import { forwardRef, useId } from 'react';
import { cn } from '../cn';
import styles from './NumberInput.module.css';

/**
 * A number input with its unit. Used for thresholds and weights, where the
 * unit and the allowed range have to be visible next to the value.
 */
const NumberInput = forwardRef(function NumberInput(
  { label, unit, min, max, step, hint, error, className, id, ...rest },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={cn(styles.field, className)}>
      {label ? (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <span className={styles.control} data-invalid={error ? 'true' : undefined}>
        <input
          ref={ref}
          id={inputId}
          type="number"
          className={styles.input}
          min={min}
          max={max}
          step={step}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint ? `${inputId}-hint` : undefined}
          {...rest}
        />
        {unit ? <span className={styles.unit}>{unit}</span> : null}
      </span>
      {hint ? (
        <p className={styles.hint} id={`${inputId}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
});

export default NumberInput;
