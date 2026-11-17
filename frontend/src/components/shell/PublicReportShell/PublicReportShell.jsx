import { Link } from 'react-router-dom';
import BrandMark from '../../ui/BrandMark/BrandMark';
import ThemeToggle from '../../ui/ThemeToggle/ThemeToggle';
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
          <Link className={styles.brand} to="/" aria-label="Metabolic City home">
            <BrandMark size={28} />
            <span className={styles.wordmark}>Metabolic City</span>
          </Link>
          <ThemeToggle compact />
        </div>
      </header>

      <main className={styles.main} id="main-content">
        <div className={styles.card}>
          <figure className={styles.banner}>
            <img src="/images/citizen-city.svg" alt="" />
            <figcaption>Report a place. The city receives the cell, not just the words.</figcaption>
          </figure>

          <header className={styles.heading}>
            <p className={styles.eyebrow}>Public report</p>
            <h1 className={styles.title}>{title}</h1>
            {description ? <p className={styles.description}>{description}</p> : null}
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
