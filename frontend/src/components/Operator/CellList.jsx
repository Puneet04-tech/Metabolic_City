import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import DataTable from '../ui/DataTable/DataTable';
import EmptyState from '../ui/EmptyState/EmptyState';
import { cellScore, getCellLabel, shortenCellId } from '../../lib/cells/index.js';
import styles from './CellList.module.css';

const TREND_DIRECTION = { SURGING: 'up', RISING: 'up', STABLE: 'flat', 'DE-ESCALATING': 'down' };

const TrendIcon = ({ trend }) => {
  const direction = TREND_DIRECTION[trend] ?? 'flat';
  if (direction === 'up') return <ArrowUp size={13} aria-hidden="true" />;
  if (direction === 'down') return <ArrowDown size={13} aria-hidden="true" />;
  return <ArrowRight size={13} aria-hidden="true" />;
};

/** Three mini bars for mobility, climate and vulnerability. */
function ScoreBars({ cell }) {
  const values = [
    { key: 'M', value: Number(cell.scores?.mobility) || 0 },
    { key: 'C', value: Number(cell.scores?.climate) || 0 },
    { key: 'V', value: Number(cell.scores?.vulnerability) || 0 },
  ];

  return (
    <span className={styles.bars} aria-hidden="true">
      {values.map((item) => (
        <svg key={item.key} width={8} height={18} viewBox="0 0 8 18" className={styles.bar}>
          <rect x="0" y="0" width="8" height="18" rx="2" className={styles.barTrack} />
          <rect
            x="0"
            y={18 - Math.min(1, item.value / 10) * 18}
            width="8"
            height={Math.max(1, Math.min(1, item.value / 10) * 18)}
            rx="2"
            className={styles.barFill}
          />
        </svg>
      ))}
    </span>
  );
}

/**
 * The cell list — the only scroller in the operator panel.
 */
export default function CellList({
  cells,
  mode,
  threshold,
  sort,
  onSortChange,
  selectedId,
  highlightId,
  onSelect,
  onHover,
  filtered = false,
  total,
}) {
  const columns = [
    {
      key: 'label',
      header: 'Cell',
      sortable: true,
      sortValue: (row) => getCellLabel(row),
      render: (row) => (
        <span className={styles.cell}>
          <span className={styles.cellName}>{getCellLabel(row)}</span>
          <span className={styles.cellId}>{shortenCellId(row.h3Index)}</span>
        </span>
      ),
    },
    {
      key: 'score',
      header: 'Rc',
      sortable: true,
      align: 'right',
      sortValue: (row) => cellScore(row, mode),
      render: (row) => {
        const score = cellScore(row, mode);
        const band = score >= threshold ? 'critical' : score >= 4 ? 'caution' : 'normal';
        return (
          <span className={styles.score} data-band={band}>
            {score.toFixed(2)}
          </span>
        );
      },
    },
    {
      key: 'trend',
      header: 'Trend',
      sortable: true,
      sortValue: (row) => row.riskVelocity ?? 0,
      render: (row) => (
        <span className={styles.trend} data-direction={TREND_DIRECTION[row.trend] ?? 'flat'}>
          <TrendIcon trend={row.trend} />
          {row.riskVelocity != null ? `${row.riskVelocity > 0 ? '+' : ''}${row.riskVelocity}/h` : '—'}
        </span>
      ),
    },
    {
      key: 'scores',
      header: 'M / C / V',
      render: (row) => <ScoreBars cell={row} />,
    },
  ];

  return (
    <div className={styles.list}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Cells</h2>
        {filtered ? (
          <p className={styles.count}>
            Showing {cells.length} of {total} cells
          </p>
        ) : null}
      </div>

      <DataTable
        fill
        columns={columns}
        rows={cells}
        sort={sort}
        onSortChange={onSortChange}
        getRowId={(row) => row.h3Index}
        onRowClick={onSelect}
        onRowHover={onHover}
        isRowSelected={(row) => row.h3Index === selectedId}
        isRowHighlighted={(row) => row.h3Index === highlightId}
        caption="Active cells ordered by risk"
        empty={
          <EmptyState
            title="No cells match"
            description="Clear the search or the band filters to see the rest of the cells."
          />
        }
      />
    </div>
  );
}
