import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../cn';
import styles from './Button.module.css';

/**
 * The single button implementation for the whole product.
 * Variants: primary | secondary | ghost | destructive
 * Sizes:    sm | md
 * Renders an anchor when `href` is set, so navigation uses the same style.
 */
const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    type = 'button',
    href,
    className,
    children,
    ...rest
  },
  ref
) {
  const classNames = cn(styles.button, className);
  const content = (
    <>
      {loading ? <Loader2 className={styles.spinner} size={14} aria-hidden="true" /> : null}
      <span className={styles.label}>{children}</span>
    </>
  );

  if (href) {
    return (
      <a
        ref={ref}
        href={href}
        className={classNames}
        data-variant={variant}
        data-size={size}
        data-loading={loading ? 'true' : undefined}
        aria-disabled={disabled || undefined}
        {...rest}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classNames}
      data-variant={variant}
      data-size={size}
      data-loading={loading ? 'true' : undefined}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </button>
  );
});

export default Button;
