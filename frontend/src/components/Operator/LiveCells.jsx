import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cellBand, cellScore, getCellLabel, sortCells } from '../../lib/cells/index.js';

const MiniSpark = memo(function MiniSpark({ values, color }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(0.001, max - min);
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 100 - ((v - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg viewBox="0 0 100 30" className="spark" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
});

/**
 * Telemetry card — carries the full cell detail (readable zone name, risk
 * breakdown, confidence, trend, history sparkline). The `compact` modifier
 * keeps the dense two-column sidebar layout intact.
 */
const CellCard = memo(
  function CellCard({ cell, mode, threshold, onSelect, onHover, compact = false, selected = false }) {
    const score = cellScore(cell, mode);
    const band = cellBand(score, threshold);
    const trend = cell.trend || 'STABLE';
    const trendColor =
      trend === 'SURGING' || trend === 'RISING'
        ? 'var(--error)'
        : trend === 'DE-ESCALATING'
          ? 'var(--success)'
          : 'var(--text-muted)';

    const historyValues = useMemo(() => {
      const history = Array.isArray(cell.history) ? cell.history.slice(-6) : [];
      return history.map((h) => Number(h.compositeRisk) || 0);
    }, [cell.history]);

    const confidence = Math.round((cell.confidence || 1) * 100);
    const confidenceColor = confidence >= 80 ? 'var(--success)' : confidence >= 50 ? 'var(--warning)' : 'var(--error)';

    const telemetryStats = cell.telemetryStats || {};
    const hasTransit = telemetryStats.transitEventsCount > 0;
    const hasWeather = telemetryStats.weatherEventsCount > 0;
    const hasCitizen = telemetryStats.citizenEventsCount > 0;

    const handleClick = useCallback(() => onSelect(cell), [cell, onSelect]);
    const handleEnter = useCallback(() => onHover && onHover(cell), [cell, onHover]);
    const handleLeave = useCallback(() => onHover && onHover(null), [onHover]);

    const label = getCellLabel(cell);

    // Compact chip — name + score only, the full detail lives in the drawer
    if (compact) {
      return (
        <button
          type="button"
          onClick={handleClick}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          className={`cell-card compact ${band}${selected ? ' is-selected' : ''}`}
          data-h3={cell.h3Index}
          title={`${label} · ${cell.h3Index} · Rc ${cell.compositeRisk.toFixed(2)}`}
          aria-label={`Select ${label}, cell ${cell.h3Index}, risk ${score.toFixed(2)}`}
          aria-pressed={selected}
        >
          <span className="cell-label">
            <i className="cell-severity-dot" aria-hidden="true" />
            <span className="cell-label-text">{zone}</span>
          </span>
          <span className="cell-score">{score.toFixed(2)}</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className={`cell-card ${band}${selected ? ' is-selected' : ''}`}
        data-h3={cell.h3Index}
        aria-label={`Select ${label}, cell ${cell.h3Index}, risk ${score.toFixed(2)}`}
        aria-pressed={selected}
      >
        <div className="cell-card-head">
          <span className="cell-label">
            <i className="cell-severity-dot" aria-hidden="true" />
            <span className="cell-label-text">{zone}</span>
          </span>
          <span className="cell-score">{score.toFixed(2)}</span>
        </div>
        <small className="cell-id">{cell.h3Index}</small>
        <MiniSpark
          values={historyValues}
          color={band === 'critical' ? 'var(--error)' : band === 'warning' ? 'var(--warning)' : 'var(--success)'}
        />
        <small className="cell-breakdown">
          Rc {cell.compositeRisk.toFixed(2)} · M {cell.scores?.mobility?.toFixed(1) ?? '0.0'} / C{' '}
          {cell.scores?.climate?.toFixed(1) ?? '0.0'} / V {cell.scores?.vulnerability?.toFixed(1) ?? '0.0'}
          {cell.isDegraded ? ` / ${cell.degradationStatus || 'INSUFFICIENT_DATA'}` : ''}
        </small>
        <small className="data-quality">
          <span style={{ color: confidenceColor }}>Confidence: {confidence}%</span>
          {hasTransit && <span> · Transit: ✓</span>}
          {hasWeather && <span> · Weather: ✓</span>}
          {hasCitizen && <span> · Citizen: ✓</span>}
          {!hasTransit && !hasWeather && !hasCitizen && <span> · No data sources</span>}
        </small>
        <small className="data-quality">Updated: {new Date(cell.lastUpdated).toLocaleTimeString()}</small>
        <div className="cell-card-foot">
          <span className="pill" style={{ borderColor: trendColor, color: trendColor }}>
            {cell.trendDisplay || trend}
          </span>
          {cell.riskVelocity != null && (
            <span className="cell-velocity">
              {cell.riskVelocity > 0 ? '+' : ''}
              {cell.riskVelocity}/h
            </span>
          )}
        </div>
      </button>
    );
  },
  (prev, next) =>
    prev.cell.h3Index === next.cell.h3Index &&
    prev.cell.lastUpdated === next.cell.lastUpdated &&
    prev.mode === next.mode &&
    prev.threshold === next.threshold &&
    prev.compact === next.compact &&
    prev.selected === next.selected
);

/**
 * Windowed list: only the rows near the viewport are mounted, so a large
 * telemetry set never materialises thousands of DOM nodes.
 */
function LiveCells({ cells, mode, threshold, onSelect, onHover, selectedIndex, compact = false }) {
  const sorted = useMemo(() => sortCells(cells, mode), [cells, mode]);

  const listRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(compact ? 24 : 40);

  // Grow the window when the operator scrolls near the end of the list
  useEffect(() => {
    const node = listRef.current;
    if (!node) return undefined;

    const onScroll = () => {
      if (node.scrollHeight - node.scrollTop - node.clientHeight < 240) {
        setVisibleCount((current) => (current >= sorted.length ? current : current + 24));
      }
    };

    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, [sorted.length, compact]);

  // Keep the selected cell visible in the list
  useEffect(() => {
    if (!selectedIndex || !listRef.current) return;
    const node = listRef.current.querySelector(`[data-h3="${selectedIndex}"]`);
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  if (!cells.length) {
    return (
      <div className="empty-state-card">
        <h4>No active cells</h4>
        <p>No H3 cells with recent telemetry activity.</p>
      </div>
    );
  }

  const window = sorted.slice(0, visibleCount);

  if (compact) {
    return (
      <div className="cell-grid cell-grid-compact scroll-thin" ref={listRef}>
        {window.map((cell) => (
          <CellCard
            key={cell.h3Index}
            cell={cell}
            mode={mode}
            threshold={threshold}
            onSelect={onSelect}
            onHover={onHover}
            selected={cell.h3Index === selectedIndex}
            compact
          />
        ))}
      </div>
    );
  }

  return (
    <div className="cell-grid" ref={listRef}>
      {window.map((cell) => (
        <CellCard
          key={cell.h3Index}
          cell={cell}
          mode={mode}
          threshold={threshold}
          onSelect={onSelect}
          onHover={onHover}
          selected={cell.h3Index === selectedIndex}
        />
      ))}
    </div>
  );
}

export default memo(LiveCells);
