import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import Button from '../../ui/Button/Button';
import { cn } from '../../ui/cn';
import styles from './MarketingShell.module.css';

/**
 * Public shell: sticky solid header, content column, quiet footer.
 * No gradients, no floating decoration.
 */
export default function MarketingShell({ nav = [], children, footerLinks = [] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const year = new Date().getFullYear();

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a className={styles.brand} href="/">
            <span className={styles.mark} aria-hidden="true">
              MC
            </span>
            <span className={styles.wordmark}>Metabolic City</span>
          </a>

          <nav className={cn(styles.nav, menuOpen && styles.navOpen)} aria-label="Main">
            {nav.map((item) => (
              <a key={item.href} className={styles.navLink} href={item.href} onClick={() => setMenuOpen(false)}>
                {item.label}
              </a>
            ))}
            <div className={styles.navActions}>
              <Button variant="ghost" size="sm" href="/login">
                Log in
              </Button>
              <Button variant="primary" size="sm" href="/signup">
                Sign up
              </Button>
            </div>
          </nav>

          <button
            type="button"
            className={styles.menuButton}
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <main className={styles.main} id="main-content">
        {children}
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p className={styles.copyright}>© {year} Metabolic City</p>
          {footerLinks.length ? (
            <nav className={styles.footerLinks} aria-label="Footer">
              {footerLinks.map((item) => (
                <a key={item.href} className={styles.footerLink} href={item.href}>
                  {item.label}
                </a>
              ))}
            </nav>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
