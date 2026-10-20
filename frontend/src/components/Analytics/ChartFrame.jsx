import { useState } from 'react';
import Button from '../ui/Button/Button';
import DataTable from '../ui/DataTable/DataTable';
import EmptyState from '../ui/EmptyState/EmptyState';
import { cn } from '../ui/cn';
import styles from './ChartFrame.module.css';

/**
 * The shared chart wrapper.
 *
 * Every chart states the question it answers, has an empty state that takes
 * no space when there is no data, and offers the same data as a table.
 */
export default function ChartFrame({
  title,
  question,
  columns,
  rows = [],
  size = 'md',
  emptyTitle = 'No data for this range',
  emptyDescription,
  children,
  className,
  ...rest
}) {
  const [asTable, setAsTable] = useState(false);
  const isEmpty = !rows.length;

  return (
    <section className={cn(styles.card, className)} {...rest}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h3 className={styles.title}>{title}</h3>
          {question ? <p className={styles.question}>{question}</p> : null}
        </div>

        {!isEmpty ? (
          <Button variant="ghost" size="sm" onClick={() => setAsTable((value) => !value)} aria-pressed={asTable}>
            {asTable ? 'View as chart' : 'View as table'}
          </Button>
        ) : null}
      </header>

      {isEmpty ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : asTable ? (
        <div className={styles.table}>
          <DataTable columns={columns} rows={rows} caption={title} />
        </div>
      ) : (
        <div className={styles.plot} data-size={size}>
          {children}
        </div>
      )}
    </section>
  );
}
