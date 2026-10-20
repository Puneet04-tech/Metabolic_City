import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../cn';
import styles from './Select.module.css';

/** The single select implementation — a native select with a styled trigger. */
const Select = forwardRef(function Select({ className, children, ...rest }, ref) {
  return (
    <span className={cn(styles.wrap, className)}>
      <select ref={ref} className={styles.select} {...rest}>
        {children}
      </select>
      <ChevronDown className={styles.chevron} size={15} aria-hidden="true" />
    </span>
  );
});

export default Select;
