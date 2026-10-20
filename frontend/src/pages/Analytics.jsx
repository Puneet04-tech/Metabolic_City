import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import AppShell from '../components/shell/AppShell/AppShell';
import {
  CellRiskBandsChart,
  CriticalIncidentsPerDayChart,
  IncidentsPerDayChart,
  ResponsePipelineChart,
  TelemetryByHourChart,
} from '../components/analytics/AnalyticsCharts';
import Button from '../components/ui/Button/Button';
import DataTable from '../components/ui/DataTable/DataTable';
import ErrorState from '../components/ui/ErrorState/ErrorState';
import FormField from '../components/ui/FormField/FormField';
import Input from '../components/ui/Input/Input';
import Select from '../components/ui/Select/Select';
import SeverityBadge from '../components/ui/SeverityBadge/SeverityBadge';
import Skeleton from '../components/ui/Skeleton/Skeleton';
import StatBlock from '../components/ui/StatBlock/StatBlock';
import { apiRequest, clearSession, getStoredUser } from '../api.js';
import { downloadCsv } from '../lib/csv.js';
import { getNavItems } from '../lib/routes.js';
import styles from './Analytics.module.css';

const DAY_MS = 24 * 60 * 60 * 1000;

const isoDay = (date) => date.toISOString().slice(0, 10);

const defaultRange = () => {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * DAY_MS);
  return { from: isoDay(from), to: isoDay(to) };
};

const STATUSES = [
  { value: 'all', label: 'All statuses' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'ACKNOWLEDGED', label: 'Accepted' },
  { value: 'ARRIVED', label: 'On site' },
  { value: 'RESOLVED', label: 'Resolved' },
];

const inRange = (value, from, to) => {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= new Date(`${from}T00:00:00`).getTime() && time <= new Date(`${to}T23:59:59`).getTime();
};

/** Counts for a window, used for the deltas against the previous period. */
const periodStats = (incidents, from, to, threshold) => {
  const length = new Date(`${to}T23:59:59`).getTime() - new Date(`${from}T00:00:00`).getTime();
  const previousFrom = new Date(`${from}T00:00:00`).getTime() - length - 1;
  const previousTo = new Date(`${from}T00:00:00`).getTime() - 1;

  const current = { total: 0, critical: 0, resolved: 0, approveMs: [] };
  const previous = { total: 0, critical: 0, resolved: 0, approveMs: [] };

  for (const incident of incidents) {
    const time = new Date(incident.detectedAt || incident.createdAt).getTime();
    const bucket =
      time >= new Date(`${from}T00:00:00`).getTime() && time <= new Date(`${to}T23:59:59`).getTime()
        ? current
        : time >= previousFrom && time <= previousTo
          ? previous
          : null;
    if (!bucket) continue;

    bucket.total += 1;
    if (Number(incident.riskScore) >= threshold) bucket.critical += 1;
    if (incident.resolvedAt) bucket.resolved += 1;
    if (incident.createdAt && incident.operatorDecisionAt) {
      bucket.approveMs.push(
        Math.abs(new Date(incident.operatorDecisionAt).getTime() - new Date(incident.createdAt).getTime())
      );
    }
  }

  const rate = (bucket) => (bucket.total ? Math.round((bucket.resolved / bucket.total) * 100) : 0);
  const approve = (bucket) =>
    bucket.approveMs.length ? Math.round(bucket.approveMs.reduce((sum, value) => sum + value, 0) / bucket.approveMs.length / 60000) : 0;

  return {
    current: { total: current.total, critical: current.critical, rate: rate(current), approveMinutes: approve(current) },
    previous: { total: previous.total, critical: previous.critical, rate: rate(previous), approveMinutes: approve(previous) },
  };
};

const delta = (current, previous) => {
  if (previous === 0 || previous === null || previous === undefined) return null;
  return Math.round(((current - previous) / previous) * 100);
};

export default function Analytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = getStoredUser();
  const navItems = useMemo(() => getNavItems(user.role), [user.role]);

  const fallback = defaultRange();
  const from = searchParams.get('from') || fallback.from;
  const to = searchParams.get('to') || fallback.to;
  const status = searchParams.get('status') || 'all';

  const [data, setData] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [cells, setCells] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const setFilter = useCallback(
    (key, value) => {
      const next = new URLSearchParams(searchParams);
      if (!value || value === 'all') next.delete(key);
      else next.set(key, value);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summary, volume, heatmap] = await Promise.all([
        apiRequest('/v1/analytics/summary'),
        apiRequest('/v1/analytics/telemetry-volume').catch(() => null),
        apiRequest('/v1/analytics/risk-heatmap').catch(() => null),
      ]);
      setData(summary);
      setTelemetry(volume);
      setCells(heatmap);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const threshold = data?.threshold ?? 7;

  const incidents = useMemo(() => {
    const all = data?.incidents || [];
    return all.filter((incident) => {
      if (status !== 'all' && incident.status !== status) return false;
      return inRange(incident.detectedAt || incident.createdAt, from, to);
    });
  }, [data, from, to, status]);

  const stats = useMemo(
    () => periodStats(data?.incidents || [], from, to, threshold),
    [data, from, to, threshold]
  );

  const auditLogs = useMemo(
    () => (data?.auditLogs || []).filter((log) => inRange(log.createdAt, from, to)),
    [data, from, to]
  );

  const exportIncidents = useCallback(() => {
    downloadCsv('incidents.csv', [
      ['h3Index', 'status', 'riskScore', 'detectedAt', 'resolvedAt', 'dispatchText'],
      ...incidents.map((incident) => [
        incident.h3Index,
        incident.status,
        incident.riskScore,
        new Date(incident.detectedAt || incident.createdAt).toISOString(),
        incident.resolvedAt ? new Date(incident.resolvedAt).toISOString() : '',
        incident.dispatchText || incident.action?.dispatchText || '',
      ]),
    ]);
  }, [incidents]);

  const exportAudits = useCallback(() => {
    downloadCsv('audit-trail.csv', [
      ['action', 'entityType', 'entityId', 'createdAt'],
      ...auditLogs.map((log) => [log.action, log.entityType, log.entityId, new Date(log.createdAt).toISOString()]),
    ]);
  }, [auditLogs]);

  const handleSignOut = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      /* the local session is cleared either way */
    }
    clearSession();
    window.location.assign('/');
  }, []);

  const incidentColumns = [
    { key: 'h3Index', header: 'Cell' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <SeverityBadge
          severity={row.status === 'RESOLVED' ? 'normal' : row.status === 'ARRIVED' ? 'info' : 'caution'}
          label={row.status}
        />
      ),
    },
    { key: 'riskScore', header: 'Risk', align: 'right' },
    {
      key: 'detectedAt',
      header: 'Detected',
      render: (row) => new Date(row.detectedAt || row.createdAt).toLocaleDateString(),
    },
    { key: 'dispatchText', header: 'Instruction' },
  ];

  const auditColumns = [
    { key: 'action', header: 'Action' },
    { key: 'entityType', header: 'Entity' },
    { key: 'entityId', header: 'Id' },
    { key: 'createdAt', header: 'When', render: (row) => new Date(row.createdAt).toLocaleString() },
  ];

  return (
    <AppShell
      title="Analytics"
      cityCode={user.cityCode}
      user={user}
      navItems={navItems}
      activeId="analytics"
      onSignOut={handleSignOut}
    >
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h1 className={styles.title}>Analytics</h1>
            <p className={styles.description}>
              What the city did in the selected range. The filters are part of the address, so a view can be shared.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={exportIncidents} disabled={!incidents.length}>
            <Download size={13} aria-hidden="true" />
            Export incidents
          </Button>
        </header>

        <section className={styles.filters} aria-label="Filters">
          <FormField label="From">
            {(props) => (
              <Input {...props} type="date" value={from} onChange={(event) => setFilter('from', event.target.value)} />
            )}
          </FormField>
          <FormField label="To">
            {(props) => (
              <Input {...props} type="date" value={to} onChange={(event) => setFilter('to', event.target.value)} />
            )}
          </FormField>
          <FormField label="Status">
            {(props) => (
              <Select {...props} value={status} onChange={(event) => setFilter('status', event.target.value)}>
                {STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </section>

        {error ? <ErrorState title="Analytics could not be loaded" description={error} onRetry={load} /> : null}

        {loading && !data ? (
          <div className={styles.statGrid}>
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} height={96} />
            ))}
          </div>
        ) : null}

        {data ? (
          <section className={styles.statGrid} aria-label="Key numbers">
            <StatBlock
              label="Incidents"
              value={stats.current.total}
              unit="incidents"
              period={`${from} to ${to}`}
              delta={delta(stats.current.total, stats.previous.total)}
              deltaLabel="vs previous period"
            />
            <StatBlock
              label="Resolution rate"
              value={stats.current.rate}
              unit="%"
              period={`${from} to ${to}`}
              delta={delta(stats.current.rate, stats.previous.rate)}
              deltaLabel="vs previous period"
            />
            <StatBlock
              label="Time to approve"
              value={stats.current.approveMinutes}
              unit="min"
              period="Median of approved incidents"
              delta={delta(stats.current.approveMinutes, stats.previous.approveMinutes)}
              deltaLabel="vs previous period"
            />
            <StatBlock
              label="Critical share"
              value={stats.current.total ? Math.round((stats.current.critical / stats.current.total) * 100) : 0}
              unit="%"
              period={`at or above ${threshold}`}
              delta={
                stats.previous.total
                  ? delta(
                      Math.round((stats.current.critical / stats.current.total) * 100) || 0,
                      Math.round((stats.previous.critical / stats.previous.total) * 100) || 0
                    )
                  : null
              }
              deltaLabel="vs previous period"
            />
          </section>
        ) : null}

        {loading && !data ? (
          <div className={styles.chartGrid}>
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} height={280} />
            ))}
          </div>
        ) : null}

        {data ? (
          <>
            <section className={styles.chartGrid} aria-label="Charts">
              <IncidentsPerDayChart incidents={incidents} />
              <CriticalIncidentsPerDayChart incidents={incidents} threshold={threshold} />
              <ResponsePipelineChart statusCounts={data.statusCounts} />
              <TelemetryByHourChart telemetryData={telemetry} />
              <CellRiskBandsChart cells={cells?.cells} />
            </section>

            <section className={styles.tables} aria-label="Tables">
              <div className={styles.tableCard}>
                <header className={styles.tableHeader}>
                  <h2 className={styles.tableTitle}>Incidents in range</h2>
                  <Button variant="ghost" size="sm" onClick={exportIncidents} disabled={!incidents.length}>
                    <Download size={13} aria-hidden="true" />
                    Export CSV
                  </Button>
                </header>
                <DataTable
                  columns={incidentColumns}
                  rows={incidents}
                  getRowId={(row) => row._id}
                  pageSize={10}
                  caption="Incidents raised in the selected range"
                  empty={<p className={styles.emptyNote}>No incidents in this range.</p>}
                />
              </div>

              <div className={styles.tableCard}>
                <header className={styles.tableHeader}>
                  <h2 className={styles.tableTitle}>Audit trail</h2>
                  <Button variant="ghost" size="sm" onClick={exportAudits} disabled={!auditLogs.length}>
                    <Download size={13} aria-hidden="true" />
                    Export CSV
                  </Button>
                </header>
                <DataTable
                  columns={auditColumns}
                  rows={auditLogs}
                  getRowId={(row) => row._id}
                  pageSize={10}
                  caption="Audit entries recorded in the selected range"
                  empty={<p className={styles.emptyNote}>No audit entries in this range.</p>}
                />
              </div>
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
