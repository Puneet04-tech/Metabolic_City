import { LogOut, User } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/DropdownMenu/DropdownMenu';
import { roleLabel } from '../../../lib/roles.js';
import { cn } from '../../ui/cn';
import styles from './AppShell.module.css';

/**
 * Authenticated shell: sticky header, optional underline tab bar and a main
 * landmark. The tab bar is driven by the same route table that guards the
 * routes, so it can only ever show pages this role can open.
 *
 * `titleAs` decides whether the header name is the page's level-one heading.
 * Routes that render their own `<h1>` pass `titleAs="span"` so the document
 * keeps exactly one level-one heading.
 */
export default function AppShell({
  title,
  titleAs = 'h1',
  cityCode,
  user,
  navItems = [],
  onSignOut,
  viewport = false,
  children,
}) {
  const Title = titleAs;

  return (
    <div className={cn(styles.shell, viewport && styles.viewport)}>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>

      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            MC
          </span>
          <span className={styles.brandText}>
            <Title className={styles.brandName}>{title}</Title>
            {cityCode ? <span className={styles.cityCode}>{cityCode}</span> : null}
          </span>
        </div>

        <div className={styles.user}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={styles.userButton} aria-label="Account menu">
                <User size={14} aria-hidden="true" />
                <span className={styles.userName}>{user?.name || 'Account'}</span>
                <span className={styles.userRole}>{roleLabel(user?.role)}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <div className={styles.userCard}>
                <p className={styles.userCardName}>{user?.name || 'Account'}</p>
                <p className={styles.userCardRole}>{roleLabel(user?.role)}</p>
                {cityCode ? <p className={styles.userCardCity}>{cityCode}</p> : null}
              </div>
              <DropdownMenuItem onSelect={onSignOut}>
                <LogOut size={14} aria-hidden="true" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {navItems.length ? (
        <nav className={styles.nav} aria-label="Sections">
          <ul className={styles.navList}>
            {navItems.map((item) => (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) => cn(styles.navLink, isActive && styles.navLinkActive)}
                >
                  {item.nav}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <main className={cn(styles.main)} id="main-content">
        {children}
      </main>
    </div>
  );
}
