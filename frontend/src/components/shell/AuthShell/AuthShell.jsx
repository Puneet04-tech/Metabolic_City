import styles from './AuthShell.module.css';

/**
 * Auth shell: one centred card, no decoration around it.
 */
export default function AuthShell({ title, description, children, footer }) {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>

      <main className={styles.main} id="main-content">
        <div className={styles.card}>
          <div className={styles.brand}>
            <span className={styles.mark} aria-hidden="true">
              MC
            </span>
            <span className={styles.wordmark}>Metabolic City</span>
          </div>

          <header className={styles.header}>
            <h1 className={styles.title}>{title}</h1>
            {description ? <p className={styles.description}>{description}</p> : null}
          </header>

          {children}

          {footer ? <div className={styles.footer}>{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}
