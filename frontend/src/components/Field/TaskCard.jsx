import { MapPin } from 'lucide-react';
import SeverityBadge from '../ui/SeverityBadge/SeverityBadge';
import { prioritySeverity, TASK_STATUSES } from '../../lib/taskStatus.js';
import { absoluteTime, relativeTime } from '../../lib/useRelativeTime.js';
import { cn } from '../ui/cn';
import styles from './TaskCard.module.css';

/**
 * One task in the field list: severity, cell, instruction, status and age.
 */
export default function TaskCard({ task, distance, onOpen, className, ...rest }) {
  const status = TASK_STATUSES[task.status] ?? { label: task.status };
  const severity = prioritySeverity(task.priority);
  const age = relativeTime(task.detectedAt);

  return (
    <button type="button" className={cn(styles.card, className)} onClick={() => onOpen(task)} {...rest}>
      <div className={styles.top}>
        <SeverityBadge severity={severity} label={task.priority || 'Unset'} />
        <span className={styles.status} data-status={task.status}>
          {status.label}
        </span>
      </div>

      <p className={styles.cell}>Cell {task.h3Index}</p>

      <p className={styles.instruction}>{task.dispatchText || 'No instruction was attached to this task.'}</p>

      <div className={styles.meta}>
        {age ? (
          <span className={styles.metaItem} title={absoluteTime(task.detectedAt)}>
            Reported {age}
          </span>
        ) : null}
        {distance != null ? (
          <span className={styles.metaItem}>
            <MapPin size={11} aria-hidden="true" />
            {distance < 1000 ? `${Math.round(distance)} m` : `${(distance / 1000).toFixed(1)} km`}
          </span>
        ) : null}
        {task.riskScore != null ? <span className={styles.metaItem}>Risk {Number(task.riskScore).toFixed(1)}</span> : null}
      </div>
    </button>
  );
}
