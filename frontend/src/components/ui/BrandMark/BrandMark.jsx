import { cn } from '../cn';
import styles from './BrandMark.module.css';

/** The Metabolic City mark: three offset cells sharing one operational field. */
export default function BrandMark({ className, size = 32, title }) {
  return (
    <svg
      className={cn(styles.mark, className)}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : 'true'}
    >
      <path
        d="M20 3.25 34.3 11.5v16.9L20 36.75 5.7 28.4V11.5L20 3.25Z"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity="0.85"
      />
      <path
        d="M20 10.15 28.6 15.1v9.9L20 29.95 11.4 25V15.1L20 10.15Z"
        fill="currentColor"
        opacity="0.14"
      />
      <path
        d="M20 10.15v19.8M11.4 15.1l17.2 9.9M28.6 15.1 11.4 25"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.55"
      />
      <circle cx="20" cy="20" r="2.4" fill="currentColor" />
    </svg>
  );
}
