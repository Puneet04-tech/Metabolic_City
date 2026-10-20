import { LogOut } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '../ui/cn';
import styles from './MobileNav.module.css';

/**
 * The bottom navigation for the field app. It is the primary navigation on
 * a phone and is hidden on larger screens, where the header tabs take over.
 */
export default function MobileNav({ navItems = [], onSignOut, className }) {
  if (!navItems.length && !onSignOut) return null;

  return (
    <nav className={cn(styles.nav, className)} aria-label="Sections">
      <div className={styles.items}>
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) => cn(styles.item, isActive && styles.active)}
          >
            {item.nav}
          </NavLink>
        ))}
      </div>

      {onSignOut ? (
        <button type="button" className={cn(styles.item, styles.signOut)} onClick={onSignOut}>
          <LogOut size={16} aria-hidden="true" />
          Sign out
        </button>
      ) : null}
    </nav>
  );
}
