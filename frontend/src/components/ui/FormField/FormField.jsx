import { useId } from 'react';
import { cn } from '../cn';
import styles from './FormField.module.css';

/**
 * Label + control + hint/error wrapper.
 * The child is rendered as a function so the control receives the generated
 * id and the correct `aria-describedby` / `aria-invalid` wiring.
 */
export default function FormField({
  label,
  hint,
  error,
  required = false,
  className,
  children,
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn(styles.field, className)}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {required ? (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      {typeof children === 'function'
        ? children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })
        : children}

      {hint ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}

      {error ? (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
