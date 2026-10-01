const cellScore = (cell, mode) =>
  mode === 'composite' ? cell.compositeRisk : Number(cell.scores?.[mode]) || 0;

const cellBand = (value, threshold) => (value >= threshold ? 'critical' : value >= 4 ? 'warning' : 'normal');

function LiveCells({ cells, mode, threshold, onSelect }) {
  return (
    <div className="cell-grid">
      {cells.map((cell) => (
        <button type="button" key={cell.h3Index} onClick={() => onSelect(cell)} className={`cell-card ${cellBand(cellScore(cell, mode), threshold)}`}>
          <strong>{cell.h3Index}</strong>
          <span>{cellScore(cell, mode).toFixed(2)}</span>
          <small>Rc {cell.compositeRisk.toFixed(2)} · M {cell.scores.mobility.toFixed(1)} / C {cell.scores.climate.toFixed(1)} / V {cell.scores.vulnerability.toFixed(1)}{cell.isDegraded ? ' / DEGRADED' : ''}</small>
        </button>
      ))}
    </div>
  );
}

export default LiveCells;
