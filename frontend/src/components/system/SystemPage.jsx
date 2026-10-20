import { cn } from '../ui/cn';
import styles from './SystemPage.module.css';

/**
 * One pattern for every system page (404, 403, 500, offline): icon, short
 * title, one sentence, a primary action and an optional secondary link.
 */
export default function SystemPage({ icon: Icon, title, description, action, secondaryAction, className, ...rest }) {
  return (
    <div className={cn(styles.page, className)} {...rest}>
      {Icon ? <Icon className={styles.icon} size={24} aria-hidden="true" /> : null}
      <h1 className={styles.title}>{title}</h1>
      {description ? <p className={styles.description}>{description}</p> : null}
      {action ? <div className={styles.actions}>{action}</div> : null}
      {secondaryAction ? <div className={styles.secondary}>{secondaryAction}</div> : null}
    </div>
  );
}
