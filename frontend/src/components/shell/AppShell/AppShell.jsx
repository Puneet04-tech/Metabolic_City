import {
  BarChart3,
  BrainCircuit,
  Circle,
  ClipboardList,
  LogOut,
  Radar,
  Settings2,
  User,
} from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/DropdownMenu/DropdownMenu';
import BrandMark from '../../ui/BrandMark/BrandMark';
import ThemeToggle from '../../ui/ThemeToggle/ThemeToggle';
import { roleLabel } from '../../../lib/roles.js';
import { cn } from '../../ui/cn';
import styles from './AppShell.module.css';

const NAV_ICONS = {
  operator: Radar,
  field: ClipboardList,
  admin: Settings2,
  analytics: BarChart3,
  intelligence: BrainCircuit,
};

/**
 * Authenticated shell: an operational rail, a current-workspace marker and a
 * main landmark. The navigation is driven by the same route table that guards
 * the routes, so it can only ever show pages this role can open.
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

      <aside className={styles.rail}>
        <Link className={styles.brand} to="/" aria-label="Metabolic City home">
          <BrandMark size={34} />
          <span className={styles.brandText}>
            <span className={styles.wordmark}>Metabolic City</span>
            <span className={styles.brandMeta}>Urban risk operations</span>
          </span>
        </Link>

        <div className={styles.context}>
          <span className={styles.contextLabel}>Current workspace</span>
          <Title className={styles.pageTitle}>{title}</Title>
          {cityCode ? <span className={styles.cityCode}>{cityCode}</span> : null}
        </div>

        {navItems.length ? (
          <nav className={styles.nav} aria-label="Sections">
            <span className={styles.navLabel}>Navigate</span>
            <ul className={styles.navList}>
              {navItems.map((item) => {
                const Icon = NAV_ICONS[item.id] || Circle;
                return (
                  <li key={item.id}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        cn(styles.navLink, isActive && styles.navLinkActive)
                      }
                    >
                      <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
                      <span>{item.nav}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}

        <div className={styles.footer}>
          <div className={styles.utility}>
            <ThemeToggle compact />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={styles.userButton}
                  aria-label="Account menu"
                >
                  <span className={styles.avatar} aria-hidden="true">
                    <User size={14} />
                  </span>
                  <span className={styles.userText}>
                    <span className={styles.userName}>{user?.name || 'Account'}</span>
                    <span className={styles.userRole}>{roleLabel(user?.role)}</span>
                  </span>
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
          <p className={styles.footerNote}>Evidence first · human decisions</p>
        </div>
      </aside>

      <main className={styles.main} id="main-content">
        {children}
      </main>
    </div>
  );
}
