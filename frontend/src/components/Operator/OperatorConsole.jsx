import { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../../api.js';
import { fetchStream } from '../../api.js';
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

const cellScore = (cell, mode) =>
  mode === 'composite' ? cell.compositeRisk : Number(cell.scores?.[mode]) || 0;

const cellBand = (value, threshold) => (value >= threshold ? 'critical' : value >= 4 ? 'warning' : 'normal');

function useLiveCells(threshold = 7) {
  const [cells, setCells] = useState([]);
  const [connection, setConnection] = useState('connecting');
  const pollIntervalRef = useRef(null);

  // Production-ready: fetch initial cell data from API, not just stream
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await apiRequest('/v1/spatial-cells');
        if (mounted && resp && resp.cells && resp.cells.length > 0) {
          console.log('Initial cells loaded from API:', resp.cells.length);
          setCells(resp.cells);
        }
      } catch (e) {
        console.error('Initial cells fetch failed:', e.message);
        // Don't set degraded state on initial fetch failure
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Poll API as fallback if SSE fails
  const pollCells = async () => {
    try {
      const resp = await apiRequest('/v1/spatial-cells');
      if (resp && resp.cells) {
        setCells(resp.cells);
        setConnection('live (polling)');
      }
    } catch (e) {
      console.error('Poll failed:', e.message);
      setConnection('degraded');
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setConnection('connecting');

    (async () => {
      try {
        console.log('Starting SSE connection to /v1/stream/h3');
        await fetchStream('/v1/stream/h3', {
          signal: controller.signal,
          onMessage: (data) => {
            console.log('SSE message received:', data);
            if (data.cells) {
              console.log('Setting cells:', data.cells.length, 'cells');
              console.log('Cell data sample:', data.cells[0]);
              setCells(data.cells);
              setConnection('live');
              // Clear polling interval if SSE is working
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
            } else {
              console.log('No cells in payload');
            }
          },
        });
      } catch (e) {
        console.error('SSE connection error:', e);
        if (!controller.signal.aborted) {
          setConnection('degraded (polling)');
          // Start polling as fallback
          if (!pollIntervalRef.current) {
            console.log('Starting API polling as fallback');
            pollCells(); // Immediate poll
            pollIntervalRef.current = setInterval(pollCells, 30000); // Poll every 30 seconds
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
  }, [threshold]);

  return { cells, connection };
}

function LensBars({ cell }) {
  const lensData = [
    { label: 'S_m - Mobility', value: cell.scores?.mobility || 0 },
    { label: 'S_c - Climate', value: cell.scores?.climate || 0 },
    { label: 'S_v - Vulnerability', value: cell.scores?.vulnerability || 0 },
  ];

  return (
    <div className="lens-bars">
      {lensData.map((row) => (
        <div key={row.label} className="lens-row">
          <span className="lens-label">{row.label}</span>
          <span className="lens-track"><span className="lens-fill" style={{ width: `${(row.value / 10) * 100}%` }} /></span>
          <span className="lens-value">{row.value.toFixed(1)}</span>
        </div>
      ))}
      <p className="lens-formula">Rc = (Wm × Sm) + (Wc × Sc) + (Wv × Sv)</p>
    </div>
  );
}

function LockTimer({ lock }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.round((new Date(lock.expiresAt) - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lock]);
  return <span className="lock-timer">Lock held · {remaining}s</span>;
}

function OperatorConsole() {
  const { cells, connection } = useLiveCells();
  
  // Use localStorage to persist the last known cells state across refreshes
  const [persistedCells, setPersistedCells] = useState(() => {
    const saved = localStorage.getItem('last-known-cells');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    if (cells.length > 0) {
      setPersistedCells(cells);
      localStorage.setItem('last-known-cells', JSON.stringify(cells));
    }
  }, [cells]);

  // Use persisted cells for initial render
  const displayCells = cells.length > 0 ? cells : persistedCells;
  const cellsRef = useRef(displayCells);
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState('composite');
  const threshold = 7;

  useEffect(() => {
    cellsRef.current = displayCells;
  }, [displayCells]);

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

  const select = async (cell) => {
    setError('');
    setSelected(cell);
    setAction(null); // Reset action first
    
    // Show warning if below threshold but still allow dispatch
    const riskValue = cellScore(cell, 'composite');
    if (riskValue < threshold) {
      setNotice(`Note: This cell has risk ${riskValue.toFixed(2)} which is below the critical threshold (${threshold}). Dispatch is still available.`);
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
  };

  const lock = async () => {
    try {
      const lockData = await apiRequest(`/v1/incidents/${selected.h3Index}/lock`, { method: 'POST' });
      setAction({ ...action, lock: lockData.lock });
    } catch (e) {
      setError(e.message);
    }
  };

  const decide = async (decision) => {
    try {
      await apiRequest(`/v1/incidents/${selected.h3Index}/decision`, {
        method: 'POST',
        body: { decision, crewId: decision === 'approve' ? null : undefined },
      });
      setNotice(decision === 'approve' ? 'Alert approved. Field crew notified (task created for dispatch).' : 'Alert overridden and audited.');
      closeDrawer();
    } catch (e) {
      setError(e.message);
    }
  };

  const closeDrawer = () => {
    setSelected(null);
    setAction(null);
    setError('');
    setNotice('');
  };

  const criticalCells = cells.filter((cell) => cell.compositeRisk >= threshold);

  return (
    <ProductShell title="Operator Command Console">
      <section className="console-layout">
        <div className="console-header">
          <div className="status-strip">
            <span className={`status-dot ${connection}`} /> Telemetry {connection}
            <span>{cells.length} active H3 cells</span>
            <span>{criticalCells.length} critical</span>
          </div>

          <div className="lens-toggle">
            <span className="lens-toggle-label">Lens filter</span>
            {Object.entries(lensLabels).map(([key, label]) => (
              <button key={key} type="button" className={mode === key ? 'lens-btn active' : 'lens-btn'} onClick={() => setMode(key)}>{label}</button>
            ))}
          </div>

          <div className="legend">
            <span className="legend-swatch critical" /> Critical (Rc &#8805; {threshold})
            <span className="legend-swatch warning" /> Caution (Rc &#8805; 4)
            <span className="legend-swatch normal" /> Normal (Rc &lt; 4)
          </div>
        </div>

        <div className="console-main">
          <div className="map-section">
            <H3Map cells={displayCells} mode={mode} threshold={threshold} onSelect={select} />

            {cells.length === 0 && (
              <div className="map-empty-overlay">
                <h4>No active cells</h4>
                <p>Telemetry data is being loaded. Check the SSE connection.</p>
              </div>
            )}

            {criticalCells.length > 0 && (
              <div className="ticker" aria-label="Live critical alerts">
                <span className="ticker-label">PULSE</span>
                <div className="ticker-track">
                  {criticalCells.map((cell) => (
                    <span key={cell.h3Index} className="ticker-item" onClick={() => select(cell)}>
                      {cell.h3Index} · Rc {cell.compositeRisk.toFixed(2)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {notice && <div className="alert-banner success">{notice}</div>}
          </div>

          <div className="console-sidebar">
            <div className="sidebar-section">
              <h3>Live Cells</h3>
              <LiveCells cells={displayCells} mode={mode} threshold={threshold} onSelect={select} compact={true} />
            </div>

            <div className="sidebar-section">
              <h3>Cell Risk Distribution</h3>
              <div className="chart-container compact">
                <CellRiskDistributionChart cells={cells} />
              </div>
            </div>

            <div className="sidebar-section">
              <h3>Critical Cell Trend</h3>
              <div className="chart-container compact">
                <CriticalCellTrendChart cells={cells} />
              </div>
            </div>
          </div>
        </div>

        <aside className="side-panel">
          <h2>Action drawer</h2>
          {!selected && <p>Select a cell to review its risk breakdown and response directive.</p>}
          {selected && (
            <div key={selected.h3Index} className="selected-content">
              <div className="cell-header">
                <h3>{selected.h3Index}</h3>
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
                  <p><strong>Priority</strong><br />{action.action.priority}</p>
                  <p><strong>Resources</strong><br />{action.action.recommendedResources.join(', ')}</p>
                  <p><strong>Dispatch</strong><br />{action.action.dispatchText}</p>
                  {!action.lock ? (
                    <button className="btn-submit" type="button" onClick={lock}>Claim 60-second lock</button>
                  ) : (
                    <>
                      <div className="button-stack">
                        <button className="btn-submit" type="button" onClick={() => decide('approve')}>Approve &amp; Dispatch</button>
                        <button className="btn-secondary" type="button" onClick={() => decide('override')}>Override Alert</button>
                      </div>
                      <button className="link-btn" type="button" onClick={closeDrawer}>Close drawer</button>
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
                  <button className="link-btn" type="button" onClick={closeDrawer}>Close drawer</button>
                </div>
              )}
            </div>
          )}
        </aside>
      </section>
    </ProductShell>
  );
}

export default OperatorConsole;
