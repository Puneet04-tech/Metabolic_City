import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../cn';
import styles from './Input.module.css';

/**
 * The single text input implementation.
 * `invalid` drives both the visual state and the `aria-invalid` flag.
 * `reveal` turns it into a password field with a show/hide control.
 */
const Input = forwardRef(function Input({ invalid = false, reveal = false, className, ...rest }, ref) {
  const [revealed, setRevealed] = useState(false);

  const input = (
    <input
      ref={ref}
      type={reveal ? (revealed ? 'text' : 'password') : rest.type}
      className={cn(styles.input, reveal && styles.revealable, className)}
      data-invalid={invalid ? 'true' : undefined}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );

  if (!reveal) return input;

  return (
    <span className={styles.revealWrap}>
      {input}
      <button
        type="button"
        className={styles.revealButton}
        onClick={() => setRevealed((value) => !value)}
        aria-label={revealed ? 'Hide password' : 'Show password'}
        aria-pressed={revealed}
      >
        {revealed ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
      </button>
    </span>
  );
});

export default Input;
