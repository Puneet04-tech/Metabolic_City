import { forwardRef, useId } from 'react';
import { cn } from '../cn';
import styles from './Checkbox.module.css';

/** A native checkbox with a styled box. */
const Checkbox = forwardRef(function Checkbox({ label, description, className, ...rest }, ref) {
  const id = useId();
  const inputId = rest.id ?? id;

  return (
    <span className={cn(styles.field, className)}>
      <input ref={ref} id={inputId} type="checkbox" className={styles.input} {...rest} />
      <span className={styles.box} aria-hidden="true" />
      <span className={styles.text}>
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
        {description ? <span className={styles.description}>{description}</span> : null}
      </span>
    </span>
  );
});

export default Checkbox;
