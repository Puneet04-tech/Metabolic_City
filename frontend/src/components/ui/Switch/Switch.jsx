import { forwardRef, useId } from 'react';
import { cn } from '../cn';
import styles from './Switch.module.css';

/** A native checkbox styled as a switch. */
const Switch = forwardRef(function Switch({ label, description, className, ...rest }, ref) {
  const id = useId();
  const inputId = rest.id ?? id;

  return (
    <span className={cn(styles.field, className)}>
      <input ref={ref} id={inputId} type="checkbox" role="switch" className={styles.input} {...rest} />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      <span className={styles.text}>
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
        {description ? <span className={styles.description}>{description}</span> : null}
      </span>
    </span>
  );
});

export default Switch;
