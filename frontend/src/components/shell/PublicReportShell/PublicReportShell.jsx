import styles from './PublicReportShell.module.css';

/**
 * Shell for the public, QR-scoped citizen report.
 * Deliberately minimal: no app bar, no account menu, no sign-out.
 */
export default function PublicReportShell({ title, description, children }) {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span className={styles.mark} aria-hidden="true">
            MC
          </span>
          <span className={styles.wordmark}>Metabolic City</span>
        </div>
      </header>

      <main className={styles.main} id="main-content">
        <div className={styles.card}>
          <header className={styles.heading}>
            <h1 className={styles.title}>{title}</h1>
            {description ? <p className={styles.description}>{description}</p> : null}
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
