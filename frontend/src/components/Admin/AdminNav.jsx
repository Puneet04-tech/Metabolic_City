import { NavLink } from 'react-router-dom';
import { cn } from '../ui/cn';
import styles from './AdminNav.module.css';

/** The left sub-navigation of the administration area. */
export default function AdminNav({ sections, activeId, onSelect }) {
  return (
    <nav className={styles.nav} aria-label="Administration sections">
      <ul className={styles.list}>
        {sections.map((section) => (
          <li key={section.id}>
            <NavLink
              to={`/admin?section=${section.id}`}
              onClick={() => onSelect?.(section.id)}
              className={({ isActive }) => cn(styles.item, (isActive || activeId === section.id) && styles.active)}
            >
              {section.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
