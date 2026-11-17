import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../../lib/theme.jsx';
import { cn } from '../cn';
import styles from './ThemeToggle.module.css';

export default function ThemeToggle({ className, compact = false }) {
  const { theme, toggleTheme } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className={cn(styles.toggle, compact && styles.compact, className)}
      onClick={toggleTheme}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      <span className={styles.iconWrap} aria-hidden="true">
        {theme === 'dark' ? <Moon size={15} /> : <Sun size={16} />}
      </span>
      {compact ? null : <span className={styles.label}>{theme === 'dark' ? 'Dark' : 'Light'}</span>}
    </button>
  );
}
