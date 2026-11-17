import BrandMark from '../ui/BrandMark/BrandMark';
import styles from './RouteFallback.module.css';

/** Branded route boot state that preserves the shape of the page to come. */
export default function RouteFallback() {
  return (
    <div className={styles.fallback} role="status" aria-live="polite" aria-label="Loading page">
      <div className={styles.shell}>
        <div className={styles.rail}>
          <BrandMark size={34} />
          <span className={styles.railLine} />
          <span className={styles.railLine} />
          <span className={styles.railLine} />
        </div>
        <div className={styles.workspace}>
          <div className={styles.progress} aria-hidden="true" />
          <div className={styles.heading}>
            <span className={styles.kicker} />
            <span className={styles.title} />
            <span className={styles.subtitle} />
          </div>
          <div className={styles.grid}>
            <span className={styles.blockLarge} />
            <span className={styles.block} />
            <span className={styles.block} />
          </div>
          <span className={styles.srOnly}>Loading page</span>
        </div>
      </div>
    </div>
  );
}
