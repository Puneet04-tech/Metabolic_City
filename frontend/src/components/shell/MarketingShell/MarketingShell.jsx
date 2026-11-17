import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../ui/Button/Button';
import BrandMark from '../../ui/BrandMark/BrandMark';
import ThemeToggle from '../../ui/ThemeToggle/ThemeToggle';
import { cn } from '../../ui/cn';
import styles from './MarketingShell.module.css';

/**
 * Public shell: sticky paper header, an editorial content column and a quiet
 * footer. The only decoration is the coordinate grid in the page background.
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
          <Link className={styles.brand} to="/" aria-label="Metabolic City home">
            <BrandMark size={32} />
            <span className={styles.wordmark}>Metabolic City</span>
          </Link>

          <nav className={cn(styles.nav, menuOpen && styles.navOpen)} aria-label="Main">
            {nav.map((item) => (
              <a key={item.href} className={styles.navLink} href={item.href} onClick={() => setMenuOpen(false)}>
                {item.label}
              </a>
            ))}
            <div className={styles.navActions}>
              <ThemeToggle />
              <Button variant="ghost" size="sm" href="/login">
                Log in
              </Button>
              <Button variant="primary" size="sm" href="/signup">
                Sign up
              </Button>
            </div>
          </nav>

          <div className={styles.mobileUtilities}>
            <ThemeToggle compact />
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
        </div>
      </header>

      <main className={styles.main} id="main-content">
        {children}
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <BrandMark size={24} />
            <p className={styles.copyright}>© {year} Metabolic City</p>
          </div>
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
