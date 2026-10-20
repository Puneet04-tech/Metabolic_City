import { Check } from 'lucide-react';
import { TASK_STEPS, TASK_STATUSES } from '../../lib/taskStatus.js';
import { cn } from '../ui/cn';
import styles from './StatusStepper.module.css';

/**
 * The task progress. The server statuses are shown with plain labels and
 * never change the values that are sent to the API.
 */
export default function StatusStepper({ status, className }) {
  const current = TASK_STATUSES[status]?.step ?? 0;

  return (
    <ol className={cn(styles.stepper, className)} aria-label="Task progress">
      {TASK_STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={step.key}
            className={styles.step}
            data-state={done ? 'done' : active ? 'active' : 'todo'}
            aria-current={active ? 'step' : undefined}
          >
            <span className={styles.marker} aria-hidden="true">
              {done ? <Check size={12} /> : index + 1}
            </span>
            <span className={styles.label}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
