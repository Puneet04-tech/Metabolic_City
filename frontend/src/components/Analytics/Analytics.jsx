import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../api.js';
import ProductShell from '../Shared/ProductShell.jsx';
import {
  IncidentTrendChart,
  RiskDistributionChart,
  StatusBreakdownChart,
  RiskLevelAreaChart,
  TelemetryVolumeChart,
  ResolutionTimeChart,
} from './AnalyticsCharts.jsx';

function downloadCsv(filename, rows) {
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((row) => row.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const formatDuration = (ms) => {
  if (ms === null || ms === undefined) return '--';
  if (ms < 1000) return `${ms} ms`;
  const minutes = ms / 60000;
  if (minutes < 60) return `${minutes.toFixed(1)} min`;
  return `${(minutes / 60).toFixed(1)} h`;
};

function Analytics() {
  const [data, setData] = useState({ statusCounts: [], incidents: [], auditLogs: [], metrics: {} });
  const [telemetryData, setTelemetryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const load = useCallback(() => {
    setLoading(true);
    setError('');

    Promise.all([
      apiRequest('/v1/analytics/summary'),
      apiRequest('/v1/analytics/telemetry-volume').catch(() => null),
    ])
      .then(([analyticsData, telemetryVolumeData]) => {
        setData(analyticsData);
        setTelemetryData(telemetryVolumeData);
        setLastUpdated(new Date());
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const withinRange = useCallback(
    (iso) => {
      const time = new Date(iso).getTime();
      if (fromDate && time < new Date(`${fromDate}T00:00:00`).getTime()) return false;
      if (toDate && time > new Date(`${toDate}T23:59:59`).getTime()) return false;
      return true;
    },
    [fromDate, toDate]
  );

  // Stable array identities keep the memoized charts from re-rendering
  const incidents = useMemo(() => data.incidents || [], [data.incidents]);
  const auditLogs = useMemo(() => data.auditLogs || [], [data.auditLogs]);

  const filteredIncidents = useMemo(
    () => incidents.filter((incident) => (!statusFilter || incident.status === statusFilter) && withinRange(incident.detectedAt)),
    [incidents, statusFilter, withinRange]
  );
  const filteredAudits = useMemo(() => auditLogs.filter((log) => withinRange(log.createdAt)), [auditLogs, withinRange]);

  const exportIncidents = useCallback(() => {
    downloadCsv('incidents.csv', [
      ['h3Index', 'status', 'riskScore', 'detectedAt', 'resolvedAt', 'dispatchText'],
      ...filteredIncidents.map((incident) => [incident.h3Index, incident.status, incident.riskScore, new Date(incident.detectedAt).toISOString(), new Date(incident.resolvedAt || '').toISOString(), incident.action?.dispatchText || '']),
    ]);
  }, [filteredIncidents]);

  const exportAudits = useCallback(() => {
    downloadCsv('audit-trail.csv', [
      ['action', 'entityType', 'entityId', 'createdAt'],
      ...filteredAudits.map((log) => [log.action, log.entityType, log.entityId, new Date(log.createdAt).toISOString()]),
    ]);
  }, [filteredAudits]);

  const totalIncidents = incidents.length;
  const statusBreakdown = useMemo(() => {
    const counts = new Map();
    incidents.forEach((incident) => counts.set(incident.status, (counts.get(incident.status) || 0) + 1));
    return [...counts.entries()].map(([status, count]) => ({ status, count }));
  }, [incidents]);
  const avgRisk = useMemo(
    () =>
      incidents.length
        ? (incidents.reduce((acc, incident) => acc + Number(incident.riskScore) || acc, 0) / incidents.length).toFixed(2)
        : '0.00',
    [incidents]
  );

  return (
    <ProductShell title="Incident Analytics">
      <section className="analytics-grid">
        <div className="analytics-header">
          <span className="last-updated">Last updated: {lastUpdated.toLocaleTimeString()}</span>
          <button className="refresh-btn" onClick={load} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </div>
        {loading && <div className="empty-state">Loading analytics...</div>}
        {error && <div className="alert-banner error">{error} <button className="link-btn" type="button" onClick={load}>Retry</button></div>}

        {!loading && !error && (
          <>
            <div className="analytics-toolbar">
              <label>Status filter</label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                {statusBreakdown.map((row) => (
                  <option key={row.status} value={row.status}>{row.status}</option>
                ))}
              </select>
              <label>From</label>
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
              <label>To</label>
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </div>

            <div className="metrics-grid">
              <div className="metric-card">
                <span className="metric-label">Total incidents</span>
                <strong className="metric-value">{totalIncidents}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Filtered incidents</span>
                <strong className="metric-value">{filteredIncidents.length}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Average risk</span>
                <strong className="metric-value">{avgRisk}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Resolution rate</span>
                <strong className="metric-value">{data.metrics?.resolutionRate || 0}%</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Avg detection to approval</span>
                <strong className="metric-value">{formatDuration(data.metrics?.avgDetectionToApprovalMs)}</strong>
              </div>
            </div>

            {/* Real-time Charts Section - Grid Layout */}
            <div className="charts-grid">
              <div className="chart-card">
                <h3>Incident Trends (Real-Time)</h3>
                <div className="chart-container">
                  <IncidentTrendChart incidents={incidents} />
                </div>
              </div>

              <div className="chart-card">
                <h3>Risk Distribution</h3>
                <div className="chart-container">
                  <RiskDistributionChart incidents={incidents} />
                </div>
              </div>

              <div className="chart-card">
                <h3>Status Breakdown</h3>
                <div className="chart-container">
                  <StatusBreakdownChart incidents={incidents} />
                </div>
              </div>

              <div className="chart-card">
                <h3>Average Risk Over Time</h3>
                <div className="chart-container">
                  <RiskLevelAreaChart incidents={incidents} />
                </div>
              </div>

              {telemetryData && (
                <div className="chart-card">
                  <h3>Telemetry Volume (Last 24h)</h3>
                  <div className="chart-container">
                    <TelemetryVolumeChart telemetryData={telemetryData} />
                  </div>
                </div>
              )}

              <div className="chart-card">
                <h3>Resolution Time Distribution</h3>
                <div className="chart-container">
                  <ResolutionTimeChart incidents={incidents} />
                </div>
              </div>
            </div>

            {/* Data Tables - Side by Side */}
            <div className="data-tables-grid">
              <article className="panel">
                <h2>Incidents (FILTERED)</h2>
                <div className="panel-controls">
                  <button className="btn-secondary" type="button" onClick={exportIncidents}>Export CSV</button>
                </div>
                <div className="table-list">
                  {filteredIncidents.length === 0 ? <p className="panel-sub">No incidents match the current filter.</p> : filteredIncidents.map((incident) => (
                    <div className="table-row" key={incident._id}>
                      <strong>{incident.h3Index}</strong>
                      <span className={`status-badge ${incident.status.toLowerCase()}`}>{incident.status}</span>
                      <span>Risk {incident.riskScore?.toFixed(1) || 'N/A'}</span>
                      <time>{new Date(incident.detectedAt).toLocaleString()}</time>
                    </div>
                  ))}
                </div>
              </article>

              <article className="panel">
                <h2>Audit trail</h2>
                <div className="panel-controls">
                  <button className="btn-secondary" type="button" onClick={exportAudits}>Export CSV</button>
                </div>
                <div className="table-list">
                  {filteredAudits.length === 0 ? <p className="panel-sub">No audit events match the current filter.</p> : filteredAudits.map((log) => (
                    <div className="table-row" key={log._id}>
                      <strong>{log.action}</strong>
                      <span>{log.entityType}</span>
                      <time>{new Date(log.createdAt).toLocaleString()}</time>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </>
        )}
      </section>
    </ProductShell>
  );
}

export default memo(Analytics);
