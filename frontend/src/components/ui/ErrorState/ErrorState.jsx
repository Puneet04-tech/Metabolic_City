import { AlertCircle } from 'lucide-react';
import Button from '../Button/Button';
import { cn } from '../cn';
import styles from './ErrorState.module.css';

/** The shared failure pattern. Never leaks a stack trace; shows a support id. */
export default function ErrorState({ title = 'Something went wrong', description, errorId, onRetry, className, ...rest }) {
  return (
    <div className={cn(styles.error, className)} role="alert" {...rest}>
      <AlertCircle className={styles.icon} size={20} aria-hidden="true" />
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        {description ? <p className={styles.description}>{description}</p> : null}
        {errorId ? <p className={styles.errorId}>Error id: {errorId}</p> : null}
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
