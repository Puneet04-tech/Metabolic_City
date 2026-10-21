import { ArrowDown, ArrowUp } from 'lucide-react';
import DataTable from '../ui/DataTable/DataTable';
import EmptyState from '../ui/EmptyState/EmptyState';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/Tooltip/Tooltip';
import CopyableId from '../ui/CopyableId/CopyableId';
import {
  cellBandFor,
  cellRef,
  cellScore,
  compareCells,
  LENS_CODES,
  LENS_NAMES,
} from '../../lib/cells/index.js';
import styles from './CellList.module.css';

const SCORE_PARTS = [
  { key: 'mobility', short: 'M', name: 'Mobility' },
  { key: 'climate', short: 'C', name: 'Climate' },
  { key: 'vulnerability', short: 'V', name: 'Vulnerability' },
];

/**
 * The trend of a cell.
 *
 * The arrow follows the number, not the other way round, and a cell with no
 * movement says so rather than showing a zero.
 */
function Trend({ velocity }) {
  const value = Number(velocity);
  if (!Number.isFinite(value) || value === 0) {
    return <span className={styles.trendFlat}>—</span>;
  }
  const up = value > 0;
  return (
    <span className={styles.trend} data-direction={up ? 'up' : 'down'}>
      {up ? <ArrowUp size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" />}
      {up ? '+' : ''}
      {value}/h
    </span>
  );
}

/**
 * Three labelled mini bars: mobility, climate and vulnerability.
 *
 * Each bar has a visible track so the scale is readable, and a tooltip
 * that names the part and gives the number.
 */
function ScoreBars({ cell }) {
  return (
    <span className={styles.bars}>
      {SCORE_PARTS.map((part) => {
        const value = Number(cell.scores?.[part.key]) || 0;
        const ratio = Math.max(0, Math.min(1, value / 10));
        return (
          <Tooltip key={part.key}>
            <TooltipTrigger asChild>
              <span className={styles.barSlot} tabIndex={0}>
                <span className={styles.barLabel}>{part.short}</span>
                <span className={styles.barTrack}>
                  <span
                    className={styles.barFill}
                    style={{ height: `${Math.max(6, ratio * 100)}%` }}
                  />
                </span>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {part.name}: {value.toFixed(1)} of 10
            </TooltipContent>
          </Tooltip>
        );
      })}
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
      width: '36%',
      sortable: true,
      sortValue: (row) => row.h3Index ?? '',
      render: (row) => (
        <span className={styles.cell}>
          <span className={styles.cellName}>Cell</span>
          <CopyableId
            id={row.h3Index}
            short={cellRef(row.h3Index)}
            label="cell identifier"
            className={styles.cellId}
          />
        </span>
      ),
    },
    {
      key: 'score',
      header: LENS_CODES[mode] ?? 'Rc',
      width: '16%',
      sortable: true,
      align: 'right',
      sortValue: (row) => cellScore(row, mode),
      // The tie-break is the same one the list uses, so the order never
      // changes between two cells with the same score.
      compare: (a, b, direction) => compareCells(a, b, mode, direction),
      render: (row) => {
        const score = cellScore(row, mode);
        const band = cellBandFor(row, mode, threshold);
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
      width: '20%',
      sortable: true,
      sortValue: (row) => Number(row.riskVelocity) || 0,
      render: (row) => <Trend velocity={row.riskVelocity} />,
    },
    {
      key: 'scores',
      header: 'M / C / V',
      width: '28%',
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
        fixedLayout
        columns={columns}
        rows={cells}
        sort={sort}
        onSortChange={onSortChange}
        getRowId={(row) => row.h3Index}
        onRowClick={onSelect}
        onRowHover={onHover}
        isRowSelected={(row) => row.h3Index === selectedId}
        isRowHighlighted={(row) => row.h3Index === highlightId}
        caption={`Active cells ordered by ${LENS_NAMES[mode] ?? 'risk'}`}
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
