import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../api.js';
import { fetchStream } from '../../api.js';
import { cellBand, cellScore, countByBand, getCellLabel, sortCells } from '../../lib/cells/index.js';
import H3Map from './H3Map.jsx';
import LiveCells from './LiveCells.jsx';
import ProductShell from '../Shared/ProductShell.jsx';
import { CellRiskDistributionChart, CriticalCellTrendChart } from './OperatorCharts.jsx';

const lensLabels = {
  composite: 'Composite (Rc)',
  mobility: 'Mobility (Sm)',
  climate: 'Climate (Sc)',
  vulnerability: 'Vulnerability (Sv)',
};

/* cellScore / cellBand / getCellLabel / sortCells come from lib/cells */

/**
 * Batches high-frequency telemetry into at most one state update per window,
 * so a burst of SSE frames can never flood the main thread.
 */
function useBatchedState(setter, delay = 600) {
  const latest = useRef(null);
  const timer = useRef(null);

  const flush = useCallback(() => {
    timer.current = null;
    if (latest.current !== null) {
      setter(latest.current);
      latest.current = null;
    }
  }, [setter]);

  const push = useCallback(
    (value) => {
      latest.current = value;
      if (timer.current === null) {
        timer.current = setTimeout(flush, delay);
      }
    },
    [flush, delay]
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return push;
}

function useLiveCells(threshold = 7) {
  const [cells, setCells] = useState([]);
  const [connection, setConnection] = useState('connecting');
  const pollIntervalRef = useRef(null);
  const signatureRef = useRef('');

  // Telemetry arrives far faster than the UI can use — batch it.
  const pushCells = useBatchedState(setCells, 600);

  const acceptCells = useCallback(
    (incoming) => {
      if (!Array.isArray(incoming) || incoming.length === 0) return;
      const signature = incoming.map((cell) => `${cell.h3Index}:${cell.compositeRisk}`).join('|');
      if (signature === signatureRef.current) return; // nothing actually changed
      signatureRef.current = signature;
      pushCells(incoming);
    },
    [pushCells]
  );

  // Production-ready: fetch initial cell data from API, not just stream
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await apiRequest('/v1/spatial-cells');
        if (mounted && resp && resp.cells && resp.cells.length > 0) {
          acceptCells(resp.cells);
        }
      } catch (e) {
        console.error('Initial cells fetch failed:', e.message);
        // Don't set degraded state on initial fetch failure
      }
    })();
    return () => {
      mounted = false;
    };
  }, [acceptCells]);

  // Poll API as fallback if SSE fails
  const pollCells = useCallback(async () => {
    try {
      const resp = await apiRequest('/v1/spatial-cells');
      if (resp && resp.cells) {
        acceptCells(resp.cells);
        setConnection('live (polling)');
      }
    } catch (e) {
      console.error('Poll failed:', e.message);
      setConnection('degraded');
    }
  }, [acceptCells]);

  useEffect(() => {
    const controller = new AbortController();
    setConnection('connecting');

    (async () => {
      try {
        await fetchStream('/v1/stream/h3', {
          signal: controller.signal,
          onMessage: (data) => {
            if (data && data.cells) {
              acceptCells(data.cells);
              setConnection((current) => (current === 'live' ? current : 'live'));
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
            }
          },
        });
      } catch (e) {
        if (!controller.signal.aborted) {
          setConnection('degraded (polling)');
          if (!pollIntervalRef.current) {
            pollCells();
            pollIntervalRef.current = setInterval(pollCells, 30000);
          }
        }
      }
    })();

    return () => {
      controller.abort();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [threshold, acceptCells, pollCells]);

  return { cells, connection };
}

const LensBars = memo(function LensBars({ cell }) {
  const lensData = useMemo(
    () => [
      { label: 'S_m - Mobility', value: cell.scores?.mobility || 0 },
      { label: 'S_c - Climate', value: cell.scores?.climate || 0 },
      { label: 'S_v - Vulnerability', value: cell.scores?.vulnerability || 0 },
    ],
    [cell.scores]
  );

  return (
    <div className="lens-bars">
      {lensData.map((row) => (
        <div key={row.label} className="lens-row">
          <span className="lens-label">{row.label}</span>
          <span className="lens-track">
            <span className="lens-fill" style={{ width: `${(row.value / 10) * 100}%` }} />
          </span>
          <span className="lens-value">{row.value.toFixed(1)}</span>
        </div>
      ))}
      <p className="lens-formula">Rc = (Wm × Sm) + (Wc × Sc) + (Wv × Sv)</p>
    </div>
  );
});

const LockTimer = memo(function LockTimer({ lock }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.round((new Date(lock.expiresAt) - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lock]);
  return <span className="lock-timer">Lock held · {remaining}s</span>;
});

const LensFilter = memo(function LensFilter({ mode, onModeChange }) {
  return (
    <div className="lens-toggle">
      <span className="lens-toggle-label">Lens filter</span>
      {Object.entries(lensLabels).map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={mode === key ? 'lens-btn active' : 'lens-btn'}
          onClick={() => onModeChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
});

const RiskLegend = memo(function RiskLegend({ threshold }) {
  return (
    <div className="legend">
      <span className="legend-item">
        <span className="legend-swatch critical" /> Critical (Rc &#8805; {threshold})
      </span>
      <span className="legend-item">
        <span className="legend-swatch warning" /> Caution (Rc &#8805; 4)
      </span>
      <span className="legend-item">
        <span className="legend-swatch normal" /> Normal (Rc &lt; 4)
      </span>
    </div>
  );
});

const CriticalTicker = memo(function CriticalTicker({ cells, onSelect }) {
  if (!cells.length) return null;
  return (
    <div className="ticker" aria-label="Live critical alerts">
      <span className="ticker-label">PULSE</span>
      <div className="ticker-track">
        {cells.map((cell) => (
          <span key={cell.h3Index} className="ticker-item" onClick={() => onSelect(cell)}>
            {cell.h3Index} · Rc {cell.compositeRisk.toFixed(2)}
          </span>
        ))}
      </div>
    </div>
  );
});

function OperatorConsole() {
  const { cells, connection } = useLiveCells();

  // Use localStorage to persist the last known cells state across refreshes
  const [persistedCells] = useState(() => {
    try {
      const saved = localStorage.getItem('last-known-cells');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist on a slow cadence instead of on every telemetry batch
  const persistTimer = useRef(null);
  useEffect(() => {
    if (!cells.length) return undefined;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      try {
        localStorage.setItem('last-known-cells', JSON.stringify(cells));
      } catch {
        /* storage full or unavailable — persistence is best effort */
      }
    }, 3000);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [cells]);

  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState('composite');
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const threshold = 7;

  const displayCells = cells.length > 0 ? cells : persistedCells;

  const topAlerts = useMemo(() => sortCells(displayCells, mode).slice(0, 5), [displayCells, mode]);
  const bandCounts = useMemo(() => countByBand(displayCells, mode, threshold), [displayCells, mode, threshold]);

  const closeDrawer = useCallback(() => {
    setSelected(null);
    setAction(null);
    setError('');
    setNotice('');
  }, []);

  const select = useCallback(async (cell) => {
    if (!cell) {
      closeDrawer();
      return;
    }
    setError('');
    setSelected(cell);
    setAction(null);

    const riskValue = cellScore(cell, 'composite');
    if (riskValue < threshold) {
      setNotice(
        `Note: This cell has risk ${riskValue.toFixed(2)} which is below the critical threshold (${threshold}). Dispatch is still available.`
      );
    } else {
      setNotice('');
    }

    try {
      const actionData = await apiRequest(`/v1/incidents/${cell.h3Index}/action`);
      setAction(actionData);
    } catch (e) {
      if (e.status === 404) {
        setNotice('No incident data available for this cell yet. You can dispatch this cell to field crew.');
      } else {
        setError(e.message);
      }
    }
  }, [closeDrawer, threshold]);

  const lock = useCallback(async () => {
    try {
      const lockData = await apiRequest(`/v1/incidents/${selected.h3Index}/lock`, { method: 'POST' });
      setAction((current) => ({ ...current, lock: lockData.lock }));
    } catch (e) {
      setError(e.message);
    }
  }, [selected]);

  const decide = useCallback(
    async (decision) => {
      try {
        await apiRequest(`/v1/incidents/${selected.h3Index}/decision`, {
          method: 'POST',
          body: { decision, crewId: decision === 'approve' ? null : undefined },
        });
        setNotice(
          decision === 'approve'
            ? 'Alert approved. Field crew notified (task created for dispatch).'
            : 'Alert overridden and audited.'
        );
        closeDrawer();
      } catch (e) {
        setError(e.message);
      }
    },
    [selected, closeDrawer]
  );

  const criticalCells = useMemo(() => cells.filter((cell) => cell.compositeRisk >= threshold), [cells, threshold]);
  const handleModeChange = useCallback((next) => setMode(next), []);

  // If still connecting and no persisted data, show loading state
  if (connection === 'connecting' && displayCells.length === 0) {
    return (
      <ProductShell title="Operator Command Console">
        <div className="console-loading">
          <div className="spinner"></div>
          <p>Connecting to live city telemetry...</p>
        </div>
      </ProductShell>
    );
  }

  return (
    <ProductShell title="Operator Command Console" shellClassName="console-shell">
      <section className="console-layout">
        <div className="console-header">
          <div className="status-strip">
            <span className={`status-dot ${connection}`} /> Telemetry {connection}
            <span>{cells.length} active H3 cells</span>
            <span>{criticalCells.length} critical</span>
          </div>

          <LensFilter mode={mode} onModeChange={handleModeChange} />

          <RiskLegend threshold={threshold} />
        </div>

        <div className="map-section">
          <H3Map
            cells={displayCells}
            mode={mode}
            threshold={threshold}
            onSelect={select}
            highlightIndex={hoveredIndex}
            focusIndex={selected ? selected.h3Index : null}
          />

          <CriticalTicker cells={criticalCells} onSelect={select} />

          {notice && <div className="alert-banner success">{notice}</div>}
        </div>

        <div className="console-sidebar scroll-thin">
          <div className="sidebar-section grow">
            <h3>
              Live Cells
              <span className="section-count">{displayCells.length}</span>
            </h3>
            <LiveCells
              cells={displayCells}
              mode={mode}
              threshold={threshold}
              onSelect={select}
              onHover={setHoveredIndex}
              selectedIndex={selected ? selected.h3Index : null}
              compact={true}
            />          </div>

          <div className="sidebar-section">
            <h3>Cell Risk Distribution</h3>
            <div className="chart-frame donut-holo">
              <div className="chart-fill">
                <CellRiskDistributionChart cells={cells} height="100%" />
              </div>
              <div className="chart-center">
                <div className="chart-total">
                  <strong>{displayCells.length}</strong>
                  <span>cells</span>
                </div>
              </div>
            </div>
            <div className="mini-legend">
              <span className="mini-legend-item">
                <i className="legend-swatch critical" /> {bandCounts.critical} critical
              </span>
              <span className="mini-legend-item">
                <i className="legend-swatch warning" /> {bandCounts.warning} caution
              </span>
              <span className="mini-legend-item">
                <i className="legend-swatch normal" /> {bandCounts.normal} normal
              </span>
            </div>
          </div>

          <div className="sidebar-section">
            <h3>Critical Cell Trend</h3>
            <div className="chart-frame trend">
              <div className="chart-fill">
                <CriticalCellTrendChart cells={cells} height="100%" />
              </div>
            </div>
          </div>
        </div>

        <aside className="side-panel">
          <h2>Action drawer</h2>
          {!selected && (
            <div className="drawer-summary">
              <p className="drawer-hint">
                Select a cell on the map or in the list to review its risk breakdown and response directive.
              </p>

              <div className="drawer-stats">
                <div className="drawer-stat critical">
                  <strong>{bandCounts.critical}</strong>
                  <span>Critical</span>
                </div>
                <div className="drawer-stat warning">
                  <strong>{bandCounts.warning}</strong>
                  <span>Caution</span>
                </div>
                <div className="drawer-stat normal">
                  <strong>{bandCounts.normal}</strong>
                  <span>Normal</span>
                </div>
              </div>

              <h3 className="drawer-subtitle">Top alerts</h3>
              <div className="top-alerts scroll-thin">
                {topAlerts.length === 0 && <p className="panel-sub">No telemetry received yet.</p>}
                {topAlerts.map((cell) => {
                  const band = cellBand(cellScore(cell, mode), threshold);
                  return (
                    <button key={cell.h3Index} type="button" className={`top-alert ${band}`} onClick={() => select(cell)}>
                      <span className="top-alert-row">
                        <span className="top-alert-name">
                          <i className="cell-severity-dot" aria-hidden="true" />
                          {getCellLabel(cell)}
                        </span>
                        <span className="top-alert-score">{cellScore(cell, mode).toFixed(2)}</span>
                      </span>
                      <small className="top-alert-meta">
                        {cell.trendDisplay || cell.trend} · M {cell.scores?.mobility?.toFixed(1) ?? '0.0'} / C{' '}
                        {cell.scores?.climate?.toFixed(1) ?? '0.0'} / V{' '}
                        {cell.scores?.vulnerability?.toFixed(1) ?? '0.0'}
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {selected && (
            <div key={selected.h3Index} className="selected-content">
              <div className="cell-header">
                <h3>
                  <span className="cell-label-text">{getCellLabel(selected)}</span>
                  <small className="cell-id">{selected.h3Index}</small>
                </h3>
                <div className="score-pill">
                  <span>{lensLabels[mode]}</span>
                  <strong>{cellScore(selected, mode).toFixed(2)}</strong>
                </div>
              </div>
              <LensBars key={selected.h3Index} cell={selected} />

              {notice && <div className="alert-banner success">{notice}</div>}
              {error && <div className="alert-banner error">{error}</div>}

              {action ? (
                <>
                  <div className="action-narrative">{action.action.actionNarrative}</div>
                  <p>
                    <strong>Priority</strong>
                    <br />
                    {action.action.priority}
                  </p>
                  <p>
                    <strong>Resources</strong>
                    <br />
                    {action.action.recommendedResources.join(', ')}
                  </p>
                  <p>
                    <strong>Dispatch</strong>
                    <br />
                    {action.action.dispatchText}
                  </p>
                  {!action.lock ? (
                    <button className="btn-submit" type="button" onClick={lock}>
                      Claim 60-second lock
                    </button>
                  ) : (
                    <>
                      <div className="button-stack">
                        <button className="btn-submit" type="button" onClick={() => decide('approve')}>
                          Approve &amp; Dispatch
                        </button>
                        <button className="btn-secondary" type="button" onClick={() => decide('override')}>
                          Override Alert
                        </button>
                      </div>
                      <button className="link-btn" type="button" onClick={closeDrawer}>
                        Close drawer
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="info-message">
                  <p className="info-text">This cell does not have an active incident response directive.</p>
                  <p className="status-badge">Status: {selected.riskLevel}</p>
                  <p className="trend-badge">Trend: {selected.trend}</p>
                  <p className="confidence-badge">Confidence: {(selected.confidence * 100).toFixed(0)}%</p>
                  {selected.isDegraded && <p className="degraded-badge">⚠️ Data Quality: Degraded</p>}
                  <button className="link-btn" type="button" onClick={closeDrawer}>
                    Close drawer
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
      </section>
    </ProductShell>
  );
}

export default memo(OperatorConsole);
