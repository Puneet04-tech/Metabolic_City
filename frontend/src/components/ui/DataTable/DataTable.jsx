import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../cn';
import Skeleton from '../Skeleton/Skeleton';
import styles from './DataTable.module.css';

function sortValueFor(column, row) {
  if (typeof column.sortValue === 'function') return column.sortValue(row);
  return row[column.key];
}

/**
 * The single table implementation: sticky header, sortable columns, row
 * states, keyboard-operable rows and pagination.
 */
export default function DataTable({
  columns,
  rows = [],
  getRowId = (row, index) => row.id ?? index,
  sort,
  onSortChange,
  loading = false,
  empty,
  pageSize,
  fill = false,
  onRowClick,
  onRowHover,
  isRowSelected,
  isRowHighlighted,
  caption,
  className,
  fixedLayout = false,
}) {
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort?.key) return rows;
    const column = columns.find((item) => item.key === sort.key);
    if (!column) return rows;
    const direction = sort.direction === 'desc' ? -1 : 1;
    const directionName = sort.direction === 'desc' ? 'desc' : 'asc';
    return [...rows].sort((a, b) => {
      // A column can carry its own comparison, which is how a column keeps a
      // stable order when two rows hold the same value. It is given the
      // direction by name, so it decides what to do with it.
      if (typeof column.compare === 'function') return column.compare(a, b, directionName);
      const left = sortValueFor(column, a);
      const right = sortValueFor(column, b);
      if (left === right) return 0;
      if (left === null || left === undefined) return 1;
      if (right === null || right === undefined) return -1;
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * direction;
      return String(left).localeCompare(String(right), undefined, { numeric: true }) * direction;
    });
  }, [rows, columns, sort]);

  const totalPages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const currentPage = Math.min(page, totalPages - 1);
  const visible = pageSize ? sorted.slice(currentPage * pageSize, currentPage * pageSize + pageSize) : sorted;

  const toggleSort = (column) => {
    if (!column.sortable || !onSortChange) return;
    const isSame = sort?.key === column.key;
    onSortChange({ key: column.key, direction: isSame && sort.direction === 'asc' ? 'desc' : 'asc' });
  };

  const handleRowKeyDown = (event, row) => {
    if (!onRowClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick(row);
    }
  };

  if (loading) {
    return (
      <div className={cn(styles.wrapper, fill && styles.wrapperFill, className)}>
        <div className={styles.skeletonTable}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} height={40} />
          ))}
        </div>
      </div>
    );
  }

  if (!rows.length) {
    return <div className={cn(styles.wrapper, fill && styles.wrapperFill, className)}>{empty}</div>;
  }

  return (
    <div className={cn(styles.wrapper, fill && styles.wrapperFill, className)}>
      <div className={cn(styles.scroll, fill && styles.scrollFill, fixedLayout && styles.scrollFixed)}>
        <table className={cn(styles.table, fixedLayout && styles.tableFixed)}>
          {caption ? <caption className={styles.caption}>{caption}</caption> : null}
          <thead className={styles.head}>
            <tr>
              {columns.map((column) => {
                const isSorted = sort?.key === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    style={column.width ? { width: column.width } : undefined}
                    aria-sort={isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {column.sortable ? (
                      <button type="button" className={styles.sortButton} onClick={() => toggleSort(column)}>
                        <span>{column.header}</span>
                        {isSorted ? (
                          sort.direction === 'asc' ? (
                            <ArrowUp size={13} aria-hidden="true" />
                          ) : (
                            <ArrowDown size={13} aria-hidden="true" />
                          )
                        ) : null}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => {
              const selected = isRowSelected ? isRowSelected(row) : false;
              const highlighted = isRowHighlighted ? isRowHighlighted(row) : false;
              return (
                <tr
                  key={getRowId(row, index)}
                  className={cn(styles.row, onRowClick && styles.interactive)}
                  data-selected={selected ? 'true' : undefined}
                  data-highlighted={highlighted ? 'true' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (event) => handleRowKeyDown(event, row) : undefined}
                  onMouseEnter={onRowHover ? () => onRowHover(row) : undefined}
                  onMouseLeave={onRowHover ? () => onRowHover(null) : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.key} className={styles.cell} data-align={column.align ?? 'left'}>
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pageSize && totalPages > 1 ? (
        <div className={styles.pagination}>
          <p className={styles.paginationLabel}>
            Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, sorted.length)} of {sorted.length}
          </p>
          <div className={styles.paginationControls}>
            <button
              type="button"
              className={styles.pageButton}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={currentPage === 0}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} aria-hidden="true" />
            </button>
            <span className={styles.pageLabel}>
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              type="button"
              className={styles.pageButton}
              onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
              disabled={currentPage >= totalPages - 1}
              aria-label="Next page"
            >
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
