import { cn } from '../cn';
import styles from './EmptyState.module.css';

/** The shared "nothing here" pattern: icon, title, one sentence, optional action. */
export default function EmptyState({ icon: Icon, title, description, action, className, ...rest }) {
  return (
    <div className={cn(styles.empty, className)} {...rest}>
      {Icon ? <Icon className={styles.icon} size={20} aria-hidden="true" /> : null}
      <p className={styles.title}>{title}</p>
      {description ? <p className={styles.description}>{description}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
