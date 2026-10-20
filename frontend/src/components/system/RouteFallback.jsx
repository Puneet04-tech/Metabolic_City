import Spinner from '../ui/Spinner/Spinner';
import styles from './RouteFallback.module.css';

/** Transient state while a lazily loaded route is fetched. */
export default function RouteFallback() {
  return (
    <div className={styles.fallback}>
      <Spinner size={20} label="Loading page" />
    </div>
  );
}
