import { cn } from '../ui/cn';
import styles from './SystemPage.module.css';

/**
 * One pattern for every system page (404, 403, 500, offline): a quiet atlas
 * plate, short title, one sentence, a primary action and an optional secondary.
 */
export default function SystemPage({ icon: Icon, title, description, action, secondaryAction, className, ...rest }) {
  return (
    <main className={cn(styles.page, className)} id="main-content" {...rest}>
      <div className={styles.art}>
        <img src="/images/empty-atlas.svg" alt="" />
      </div>
      <div className={styles.copy}>
        <p className={styles.kicker}>Metabolic City / Atlas</p>
        {Icon ? <Icon className={styles.icon} size={20} aria-hidden="true" /> : null}
        <h1 className={styles.title}>{title}</h1>
        {description ? <p className={styles.description}>{description}</p> : null}
        {action ? <div className={styles.actions}>{action}</div> : null}
        {secondaryAction ? <div className={styles.secondary}>{secondaryAction}</div> : null}
      </div>
    </main>
  );
}
