import { useMemo } from 'react';

const cellScore = (cell, mode) =>
  mode === 'composite' ? cell.compositeRisk : Number(cell.scores?.[mode]) || 0;

const cellBand = (value, threshold) => (value >= threshold ? 'critical' : value >= 4 ? 'warning' : 'normal');

function MiniSpark({ values, color }) {
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
}

function LiveCells({ cells, mode, threshold, onSelect, compact = false }) {
  const sorted = useMemo(
    () => [...cells].sort((a, b) => cellScore(b, mode) - cellScore(a, mode)),
    [cells, mode]
  );

  if (!cells.length) {
    return (
      <div className="empty-state-card">
        <h4>No active cells</h4>
        <p>No H3 cells with recent telemetry activity.</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="cell-grid cell-grid-compact">
        {sorted.slice(0, 6).map((cell) => (
          <button key={cell.h3Index} type="button" onClick={() => onSelect(cell)} className={`cell-card compact ${cellBand(cellScore(cell, mode), threshold)}`}>
            <strong>{cell.h3Index}</strong>
            <span>{cellScore(cell, mode).toFixed(2)}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="cell-grid">
      {sorted.map((cell) => {
        const score = cellScore(cell, mode);
        const band = cellBand(score, threshold);
        const trend = cell.trend || 'STABLE';
        const trendColor = trend === 'SURGING' || trend === 'RISING' ? 'var(--error)' : trend === 'DE-ESCALATING' ? 'var(--success)' : 'var(--text-muted)';
        const history = Array.isArray(cell.history) ? cell.history.slice(-6) : [];
        const historyValues = history.map((h) => Number(h.compositeRisk) || 0);

        return (
          <button
            key={cell.h3Index}
            type="button"
            onClick={() => onSelect(cell)}
            className={`cell-card ${band}`}
            aria-label={`Select cell ${cell.h3Index}, risk ${score.toFixed(2)}`}
          >
            <div className="cell-card-head">
              <strong>{cell.h3Index}</strong>
              <span>{score.toFixed(2)}</span>
            </div>
            <MiniSpark values={historyValues} color={band === 'critical' ? 'var(--error)' : band === 'warning' ? 'var(--warning)' : 'var(--success)'} />
            <small>
              Rc {cell.compositeRisk.toFixed(2)} · M {cell.scores?.mobility?.toFixed(1) ?? '0.0'} / C {cell.scores?.climate?.toFixed(1) ?? '0.0'} / V {cell.scores?.vulnerability?.toFixed(1) ?? '0.0'}
              {cell.isDegraded ? ' / DEGRADED' : ''}
            </small>
            <div className="cell-card-foot">
              <span className="pill" style={{ borderColor: trendColor, color: trendColor }}>{trend}</span>
              {cell.riskVelocity != null && (
                <span className="cell-velocity">
                  {cell.riskVelocity > 0 ? '+' : ''}{cell.riskVelocity}/h
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default LiveCells;