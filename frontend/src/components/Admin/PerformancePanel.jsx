import { useCallback, useEffect, useMemo, useState } from 'react';
import { IncidentsPerDayChart, ResponsePipelineChart } from '../Analytics/AnalyticsCharts';
import ErrorState from '../ui/ErrorState/ErrorState';
import Skeleton from '../ui/Skeleton/Skeleton';
import StatBlock from '../ui/StatBlock/StatBlock';
import StatusDot from '../ui/StatusDot/StatusDot';
import { apiRequest } from '../../api.js';
import styles from './PerformancePanel.module.css';

const averageMinutes = (values) => {
  const present = values.filter((value) => Number.isFinite(value));
  if (!present.length) return 0;
  return Math.round(present.reduce((sum, value) => sum + value, 0) / present.length / 60000);
};

export default function PerformancePanel() {
  const [summary, setSummary] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [analytics, field] = await Promise.all([
        apiRequest('/v1/analytics/summary'),
        apiRequest('/v1/field/tasks').catch(() => ({ incidents: [] })),
      ]);
      setSummary(analytics);
      setTasks(field.incidents || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    if (!summary) return null;
    const incidents = summary.incidents || [];
    const open = incidents.filter((incident) => incident.status !== 'RESOLVED');
    const critical = open.filter((incident) => Number(incident.riskScore) >= (summary.threshold ?? 7));
    const approveMinutes = averageMinutes(
      incidents
        .filter((incident) => incident.createdAt && incident.operatorDecisionAt)
        .map(
          (incident) =>
            Math.abs(new Date(incident.operatorDecisionAt).getTime() - new Date(incident.createdAt).getTime())
        )
    );

    return {
      open: open.length,
      critical: critical.length,
      resolutionRate: summary.metrics?.resolutionRate ?? 0,
      approveMinutes,
      tasks: tasks.length,
      state: critical.length > 0 ? 'critical' : open.length > 0 ? 'attention' : 'healthy',
      stateLabel:
        critical.length > 0
          ? `${critical.length} critical incident${critical.length === 1 ? '' : 's'} open`
          : open.length > 0
            ? `${open.length} open incident${open.length === 1 ? '' : 's'}, none critical`
            : 'All incidents are closed',
    };
  }, [summary, tasks]);

  if (error) {
    return <ErrorState title="System performance could not be loaded" description={error} onRetry={load} />;
  }

  if (loading || !stats) {
    return (
      <div className={styles.loading}>
        <Skeleton height={96} />
        <Skeleton height={240} />
      </div>
    );
  }

  return (
    <section className={styles.panel} aria-label="System performance">
      <header className={styles.header}>
        <h2 className={styles.title}>System performance</h2>
        <p className={styles.description}>How the response pipeline is moving right now.</p>
        <StatusDot status={stats.state} label={stats.stateLabel} />
      </header>

      <div className={styles.statGrid}>
        <StatBlock label="Open incidents" value={stats.open} unit="incidents" period="Not yet resolved" />
        <StatBlock label="Resolution rate" value={stats.resolutionRate} unit="%" period="Across all incidents" />
        <StatBlock label="Time to approve" value={stats.approveMinutes} unit="min" period="Mean from detection" />
        <StatBlock label="Open field tasks" value={stats.tasks} unit="tasks" period="Assigned to crews" />
      </div>

      <div className={styles.charts}>
        <ResponsePipelineChart statusCounts={summary.statusCounts} />
        <IncidentsPerDayChart incidents={summary.incidents || []} />
      </div>
    </section>
  );
}
