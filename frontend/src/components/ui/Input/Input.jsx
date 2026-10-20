import { forwardRef } from 'react';
import { cn } from '../cn';
import styles from './Input.module.css';

/**
 * The single text input implementation.
 * `invalid` drives both the visual state and the `aria-invalid` flag.
 */
const Input = forwardRef(function Input({ invalid = false, className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn(styles.input, className)}
      data-invalid={invalid ? 'true' : undefined}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});

export default Input;
