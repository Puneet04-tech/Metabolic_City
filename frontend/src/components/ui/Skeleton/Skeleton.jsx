import { cn } from '../cn';
import styles from './Skeleton.module.css';

/** Loading placeholder sized to the content it replaces. */
export default function Skeleton({ width, height = 16, radius, className, ...rest }) {
  return (
    <span
      className={cn(styles.skeleton, className)}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
      {...rest}
    />
  );
}
