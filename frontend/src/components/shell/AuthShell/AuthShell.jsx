import { Link } from 'react-router-dom';
import BrandMark from '../../ui/BrandMark/BrandMark';
import ThemeToggle from '../../ui/ThemeToggle/ThemeToggle';
import styles from './AuthShell.module.css';

/**
 * Auth shell: a field-note plate on the left and the form on warm paper at the
 * right. On a phone the plate becomes a short masthead above the form.
 */
export default function AuthShell({ title, description, children, footer }) {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>

      <aside className={styles.plate} aria-hidden="true">
        <img className={`${styles.plateImage} ${styles.plateImageDark}`} src="/images/auth-signal.svg" alt="" />
        <img className={`${styles.plateImage} ${styles.plateImageLight}`} src="/images/auth-signal-light.svg" alt="" />
        <div className={styles.plateContent}>
          <Link className={styles.plateBrand} to="/" tabIndex={-1}>
            <BrandMark size={34} />
            <span>Metabolic City</span>
          </Link>
          <div className={styles.plateNote}>
            <p className={styles.plateKicker}>Field instrument / 01</p>
            <p className={styles.plateTitle}>
              The city is not one signal. It is a field of them.
            </p>
            <p className={styles.plateBody}>
              Weather, road speed, terrain and field reports become one evidence
              record per H3 cell.
            </p>
          </div>
          <p className={styles.plateFoot}>Bhopal · Indore · Sehore</p>
        </div>
      </aside>

      <main className={styles.main} id="main-content">
        <div className={styles.card}>
          <div className={styles.topline}>
            <Link className={styles.mobileBrand} to="/" aria-label="Metabolic City home">
              <BrandMark size={28} />
              <span>Metabolic City</span>
            </Link>
            <ThemeToggle />
          </div>

          <header className={styles.header}>
            <p className={styles.eyebrow}>Secure workspace</p>
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
