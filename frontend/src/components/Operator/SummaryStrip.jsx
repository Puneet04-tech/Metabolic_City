import { cn } from '../ui/cn';
import styles from './SummaryStrip.module.css';

const BANDS = [
  { key: 'critical', label: 'Critical' },
  { key: 'caution', label: 'Caution' },
  { key: 'normal', label: 'Normal' },
];

/**
 * The summary strip: the three risk bands as filter toggles plus a single
 * proportion bar. It replaces the donut and the stat tiles, and it never
 * takes space when there is nothing to say.
 */
export default function SummaryStrip({ counts, total, activeFilters, onToggle, className }) {
  const filters = activeFilters ?? new Set();
  const safeTotal = Math.max(1, total || 0);

  return (
    <section className={cn(styles.strip, className)} aria-label="Risk summary">
      <div
        className={styles.bar}
        role="img"
        aria-label={`${total} cells: ${counts.critical} critical, ${counts.caution} caution, ${counts.normal} normal`}
      >
        {BANDS.map((band) => {
          const value = counts[band.key] ?? 0;
          if (!value) return null;
          return (
            <span
              key={band.key}
              className={cn(styles.segment, styles[`segment${band.key[0].toUpperCase()}${band.key.slice(1)}`])}
              style={{ flexGrow: value / safeTotal }}
            />
          );
        })}
      </div>

      <div className={styles.toggles}>
        {BANDS.map((band) => {
          const value = counts[band.key] ?? 0;
          const active = filters.size === 0 || filters.has(band.key);
          return (
            <button
              key={band.key}
              type="button"
              className={styles.toggle}
              data-band={band.key}
              data-active={active ? 'true' : undefined}
              aria-pressed={active}
              onClick={() => onToggle(band.key)}
            >
              <span className={cn(styles.swatch, styles[`swatch${band.key[0].toUpperCase()}${band.key.slice(1)}`])} />
              <span className={styles.count}>{value}</span>
              <span className={styles.label}>{band.label}</span>
            </button>
          );
        })}
      </div>

      {counts.critical === 0 ? <p className={styles.note}>No critical cells in the last hour.</p> : null}
    </section>
  );
}
