import { useState, useEffect } from 'react';
import { apiRequest } from '../../api.js';
import ProductShell from '../Shared/ProductShell.jsx';

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
  if (ms === null || ms === undefined) return 'n/a';
  if (ms < 1000) return `${ms} ms`;
  const minutes = ms / 60000;
  if (minutes < 60) return `${minutes.toFixed(1)} min`;
  return `${(minutes / 60).toFixed(1)} h`;
};

function Analytics() {
  const [data, setData] = useState({ statusCounts: [], incidents: [], auditLogs: [], metrics: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const load = () => {
    setLoading(true);
    setError('');
    apiRequest('/v1/analytics/summary')
      .then((responseData) => {
        setData(responseData);
        setLastUpdated(new Date());
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const withinRange = (iso) => {
    const time = new Date(iso).getTime();
    if (fromDate && time < new Date(`${fromDate}T00:00:00`).getTime()) return false;
    if (toDate && time > new Date(`${toDate}T23:59:59`).getTime()) return true;
    return true;
  };

  const filteredIncidents = (data.incidents || []).filter(
    (incident) => (!statusFilter || incident.status === statusFilter) && withinRange(incident.detectedAt)
  );
  const filteredAudits = (data.auditLogs || []).filter((log) => withinRange(log.createdAt));

  const perDay = (() => {
    const counts = new Map();
    filteredIncidents.forEach((incident) => {
      const day = new Date(incident.detectedAt).toLocaleDateString();
      counts.set(day, (counts.get(day) || 0) + 1);
    });
    return [...counts.entries()].map(([day, count]) => ({ day, count }));
  })();
  const maxDay = Math.max(1, ...perDay.map((row) => row.count));

  const exportIncidents = () => {
    downloadCsv('incidents.csv', [
      ['h3Index', 'status', 'riskScore', 'detectedAt', 'resolvedAt', 'dispatchText'],
      ...filteredIncidents.map((incident) => [incident.h3Index, incident.status, incident.riskScore, new Date(incident.detectedAt).toISOString(), new Date(incident.resolvedAt || '').toISOString(), incident.action?.dispatchText || '']),
    ]);
  };

  const exportAudits = () => {
    downloadCsv('audit-trail.csv', [
      ['action', 'entityType', 'entityId', 'createdAt'],
      ...filteredAudits.map((log) => [log.action, log.entityType, log.entityId, new Date(log.createdAt).toISOString()]),
    ]);
  };

  const totalIncidents = filteredIncidents.length;
  const statusBreakdown = (() => {
    const counts = new Map();
    filteredIncidents.forEach((incident) => counts.set(incident.status, (counts.get(incident.status) || 0) + 1));
    return [...counts.entries()].map(([status, count]) => ({ status, count }));
  })();
  const avgRisk = filteredIncidents.length
    ? (filteredIncidents.reduce((acc, incident) => acc + Number(incident.riskScore) || acc, 0) / filteredIncidents.length).toFixed(2)
    : '0.00';

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
          </>
        )}
      </section>
    </ProductShell>
  );
}

export default Analytics;
