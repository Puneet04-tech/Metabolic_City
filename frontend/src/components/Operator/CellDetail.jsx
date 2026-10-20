import { ArrowLeft, Lock } from 'lucide-react';
import Button from '../ui/Button/Button';
import CopyableId from '../ui/CopyableId/CopyableId';
import Notice from '../ui/Notice/Notice';
import SeverityBadge from '../ui/SeverityBadge/SeverityBadge';
import Skeleton from '../ui/Skeleton/Skeleton';
import { Dialog, DialogContent } from '../ui/Dialog/Dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/Tooltip/Tooltip';
import { cellScore, getCellLabel } from '../../lib/cells/index.js';
import { useState } from 'react';
import styles from './CellDetail.module.css';

const LENS_LABELS = {
  composite: 'Composite risk',
  mobility: 'Mobility',
  climate: 'Climate',
  vulnerability: 'Vulnerability',
};

/** A small history chart for the cell's composite risk. */
function TrendChart({ values }) {
  if (!values || values.length < 2) return null;

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(0.001, max - min);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 30 - ((value - min) / range) * 28;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 30" className={styles.trendChart} preserveAspectRatio="none" role="img" aria-label="Composite risk over the last readings">
      <polyline points={points} className={styles.trendLine} />
    </svg>
  );
}

function ScoreRow({ label, code, value, max = 10 }) {
  return (
    <div className={styles.scoreRow}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={styles.scoreLabel}>
            {label}
            <span className={styles.scoreCode}>{code}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {label} score, {value.toFixed(1)} of {max}
        </TooltipContent>
      </Tooltip>
      <span className={styles.scoreTrack} aria-hidden="true">
        <span className={styles.scoreFill} data-level={value >= 7 ? 'high' : value >= 4 ? 'medium' : 'low'} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </span>
      <span className={styles.scoreValue}>{value.toFixed(1)}</span>
    </div>
  );
}

/**
 * The cell detail view. It replaces the list in the panel when a cell is
 * selected, and it is where the response directive and the actions live.
 */
export default function CellDetail({ cell, mode, threshold, action, loading, error, notice, onBack, onLock, onDecide }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!cell) return null;

  const score = cellScore(cell, mode);
  const band = score >= threshold ? 'critical' : score >= 4 ? 'caution' : 'normal';
  const history = Array.isArray(cell.history) ? cell.history.slice(-12).map((entry) => Number(entry.compositeRisk) || 0) : [];

  return (
    <div className={styles.detail}>
      <div className={styles.header}>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={14} aria-hidden="true" />
          Cells
        </Button>
        <CopyableId id={cell.h3Index} label="cell" />
      </div>

      <div className={styles.title}>
        <h2 className={styles.cellName}>{getCellLabel(cell)}</h2>
        <SeverityBadge severity={band} label={`${score.toFixed(2)} ${LENS_LABELS[mode] ?? ''}`} />
      </div>

      {notice ? (
        <Notice tone="success">{notice}</Notice>
      ) : null}
      {error ? (
        <Notice tone="error">{error}</Notice>
      ) : null}

      <section className={styles.section} aria-label="Risk breakdown">
        <ScoreRow label="Composite risk" code="Rc" value={cell.compositeRisk ?? 0} />
        <ScoreRow label="Mobility" code="Sm" value={Number(cell.scores?.mobility) || 0} />
        <ScoreRow label="Climate" code="Sc" value={Number(cell.scores?.climate) || 0} />
        <ScoreRow label="Vulnerability" code="Sv" value={Number(cell.scores?.vulnerability) || 0} />
      </section>

      {history.length ? (
        <section className={styles.section} aria-label="Trend">
          <h3 className={styles.sectionTitle}>Trend over the last readings</h3>
          <TrendChart values={history} />
        </section>
      ) : null}

      <section className={styles.section} aria-label="Response directive">
        <h3 className={styles.sectionTitle}>Response directive</h3>
        {loading ? (
          <div className={styles.loading}>
            <Skeleton height={14} width="90%" />
            <Skeleton height={14} width="70%" />
            <Skeleton height={14} width="80%" />
          </div>
        ) : action ? (
          <>
            <p className={styles.directive}>{action.action?.actionNarrative}</p>
            <dl className={styles.facts}>
              <div className={styles.fact}>
                <dt>Priority</dt>
                <dd>{action.action?.priority}</dd>
              </div>
              <div className={styles.fact}>
                <dt>Resources</dt>
                <dd>{action.action?.recommendedResources?.join(', ') || 'None listed'}</dd>
              </div>
              <div className={styles.fact}>
                <dt>Dispatch</dt>
                <dd>{action.action?.dispatchText}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className={styles.empty}>No response directive is attached to this cell.</p>
        )}
      </section>

      <div className={styles.actions}>
        {!action?.lock ? (
          <Button variant="secondary" onClick={onLock}>
            <Lock size={14} aria-hidden="true" />
            Claim 60-second lock
          </Button>
        ) : (
          <>
            <Button variant="primary" onClick={() => onDecide('approve')}>
              Approve and dispatch
            </Button>
            <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
              Override alert
            </Button>
          </>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          title="Override this alert?"
          description="Overriding marks the alert as a false positive and writes the decision to the audit trail. The crew is not dispatched."
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                Keep alert
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmOpen(false);
                  onDecide('override');
                }}
              >
                Override alert
              </Button>
            </>
          }
        >
          <p className={styles.confirmText}>This action cannot be undone from the console.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
