import { forwardRef } from 'react';
import { cn } from '../cn';
import styles from './Textarea.module.css';

/** The single textarea implementation. */
const Textarea = forwardRef(function Textarea({ className, rows = 4, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(styles.textarea, className)} {...rest} />;
});

export default Textarea;
