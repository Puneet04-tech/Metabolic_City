import { ArrowLeft, Lock } from 'lucide-react';
import Button from '../ui/Button/Button';
import CopyableId from '../ui/CopyableId/CopyableId';
import Notice from '../ui/Notice/Notice';
import SeverityBadge from '../ui/SeverityBadge/SeverityBadge';
import Skeleton from '../ui/Skeleton/Skeleton';
import { Dialog, DialogContent } from '../ui/Dialog/Dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/Tooltip/Tooltip';
import { CAUTION_THRESHOLD, cellBandFor, cellScore, getCellLabel } from '../../lib/cells/index.js';
import { priorityLabel } from '../../lib/taskStatus.js';
import { useState } from 'react';
import styles from './CellDetail.module.css';

const LENS_LABELS = {
  composite: 'Composite risk',
  mobility: 'Mobility',
  climate: 'Climate',
  vulnerability: 'Vulnerability',
};

/** The real sources that can back a cell, and what each one means. */
const SOURCE_LABELS = {
  WEATHER_API: { label: 'Weather readings', hint: 'Observed rainfall, visibility, wind and temperature' },
  GTFS_TRANSIT: { label: 'Road speed readings', hint: 'Measured travel time against free flow' },
  GIS_STATIC: { label: 'Terrain', hint: 'Elevation, slope and distance to a watercourse' },
  CITIZEN_311: { label: 'Citizen reports', hint: 'Reports from residents and field crew' },
  IOT_SENSOR: { label: 'Sensor readings', hint: 'Readings from a device on the ground' },
};

const DEGRADATION_LABELS = {
  NO_MOBILITY_DATA: 'No road speed readings for this cell',
  NO_CLIMATE_DATA: 'No weather readings for this cell',
  NO_VULNERABILITY_DATA: 'No terrain or survey data for this cell',
  SPARSE_MOBILITY: 'Only a few road speed readings',
  SPARSE_CLIMATE: 'Only a few weather readings',
};

/**
 * What this cell's score is actually made of.
 *
 * A score without its sources is not trustworthy, and the operator has to be
 * able to see which real readings back the number in front of them.
 */
function ProvenancePanel({ cell }) {
  const stats = cell.telemetryStats || {};
  const sources = Array.isArray(stats.sources) ? stats.sources : [];
  const degradation = cell.degradationStatus;

  if (!sources.length && !degradation) return null;

  return (
    <section className={styles.section} aria-label="Data provenance">
      <h3 className={styles.sectionTitle}>What this score is made of</h3>

      {degradation && degradation !== 'HEALTHY' ? (
        <p className={styles.degraded} data-tone={degradation.startsWith('NO_') ? 'missing' : 'sparse'}>
          {DEGRADATION_LABELS[degradation] || degradation.replace(/_/g, ' ').toLowerCase()}
        </p>
      ) : null}

      {sources.length ? (
        <ul className={styles.sources}>
          {sources.map((source) => {
            const count =
              source === 'WEATHER_API'
                ? stats.weatherEventsCount
                : source === 'GTFS_TRANSIT'
                  ? stats.transitEventsCount
                  : source === 'CITIZEN_311'
                    ? stats.citizenEventsCount
                    : source === 'GIS_STATIC'
                      ? stats.gisEventsCount
                      : stats.eventCount;
            const meta = SOURCE_LABELS[source] || { label: source, hint: '' };
            return (
              <li key={source} className={styles.source}>
                <span className={styles.sourceCount}>{count ?? 0}</span>
                <span className={styles.sourceText}>
                  <span className={styles.sourceLabel}>{meta.label}</span>
                  <span className={styles.sourceHint}>{meta.hint}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {stats.lastObservedAt ? (
        <p className={styles.observed}>
          Last observed {new Date(stats.lastObservedAt).toLocaleString()}
        </p>
      ) : null}
    </section>
  );
}

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

function ScoreRow({ label, code, value, threshold, max = 10 }) {
  return (
    <div className={styles.scoreRow}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className={styles.scoreLabel}>
            {label}
            <span className={styles.scoreCode}>{code}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {label} score, {value.toFixed(1)} of {max}
        </TooltipContent>
      </Tooltip>
      <span className={styles.scoreTrack} aria-hidden="true">
        <span
          className={styles.scoreFill}
          data-level={value >= threshold ? 'high' : value >= CAUTION_THRESHOLD ? 'medium' : 'low'}
          style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
        />
      </span>
      <span className={styles.scoreValue}>{value.toFixed(1)}</span>
    </div>
  );
}

/**
 * Where this cell actually is.
 *
 * The streets it holds and the watercourse it sits near come from the real
 * map, so an operator can see that the cell is a real place and not a
 * grid square.
 */
function CellContext({ cell }) {
  const context = cell.context;
  if (!context) return null;

  const streets = Array.isArray(context.streets) ? context.streets.filter(Boolean) : [];
  const hasWater = Boolean(context.waterway) || Number.isFinite(context.waterDistanceM);
  if (!streets.length && !hasWater) return null;

  return (
    <p className={styles.context}>
      {streets.length ? <span className={styles.contextStreet}>{streets.join(' · ')}</span> : null}
      {streets.length && hasWater ? <span className={styles.contextDivider}>—</span> : null}
      {hasWater ? (
        <span className={styles.contextWater}>
          {context.waterway || 'Watercourse'}
          {Number.isFinite(context.waterDistanceM) ? ` ${context.waterDistanceM} m away` : ''}
        </span>
      ) : null}
    </p>
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
  const band = cellBandFor(cell, mode, threshold);
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

      <CellContext cell={cell} />

      {notice ? (
        <Notice tone="success">{notice}</Notice>
      ) : null}
      {error ? (
        <Notice tone="error">{error}</Notice>
      ) : null}

      <section className={styles.section} aria-label="Risk breakdown">
        <ScoreRow label="Composite risk" code="Rc" value={cell.compositeRisk ?? 0} threshold={threshold} />
        <ScoreRow label="Mobility" code="Sm" value={Number(cell.scores?.mobility) || 0} threshold={threshold} />
        <ScoreRow label="Climate" code="Sc" value={Number(cell.scores?.climate) || 0} threshold={threshold} />
        <ScoreRow label="Vulnerability" code="Sv" value={Number(cell.scores?.vulnerability) || 0} threshold={threshold} />
      </section>

      {history.length ? (
        <section className={styles.section} aria-label="Trend">
          <h3 className={styles.sectionTitle}>Trend over the last readings</h3>
          <TrendChart values={history} />
        </section>
      ) : null}

      <ProvenancePanel cell={cell} />

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
                <dd>{priorityLabel(action.action?.priority)}</dd>
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
