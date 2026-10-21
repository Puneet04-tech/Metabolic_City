import { memo, useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartFrame from './ChartFrame';
import { getChartTheme } from '../../lib/chartTheme.js';
import { incidentStatusLabel } from '../../lib/taskStatus.js';
import styles from './AnalyticsCharts.module.css';

const DAY_FORMAT = { day: '2-digit', month: 'short' };

const dayKey = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const dayLabel = (key) =>
  new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { ...DAY_FORMAT, year: 'numeric' });

/** Incidents per day in the selected range. */
export const IncidentsPerDayChart = memo(function IncidentsPerDayChart({ incidents }) {
  const theme = getChartTheme();

  const data = useMemo(() => {
    const counts = new Map();
    for (const incident of incidents) {
      const key = dayKey(incident.detectedAt || incident.createdAt);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({ day, label: dayLabel(day), count }));
  }, [incidents]);

  return (
    <ChartFrame
      title="Incidents per day"
      question="How many incidents were raised each day in this range?"
      columns={[
        { key: 'label', header: 'Day' },
        { key: 'count', header: 'Incidents', align: 'right' },
      ]}
      rows={data}
      emptyTitle="No incidents in this range"
      emptyDescription="Widen the date range or clear the status filter."
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid.stroke} vertical={false} />
          <XAxis dataKey="label" stroke={theme.axis.stroke} tick={theme.axis.tick} tickLine={false} />
          <YAxis allowDecimals={false} stroke={theme.axis.stroke} tick={theme.axis.tick} tickLine={false} width={36}>
            <Label value="Incidents" position="insideLeft" angle={-90} style={theme.axis.tick} />
          </YAxis>
          <Tooltip {...theme.tooltip} cursor={theme.tooltip.cursor} />
          <Bar dataKey="count" name="Incidents" fill={theme.colors.accent} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
});

/**
 * The critical cell trend, moved here from the console.
 * It counts the incidents that were raised at or above the critical threshold.
 */
export const CriticalIncidentsPerDayChart = memo(function CriticalIncidentsPerDayChart({ incidents, threshold }) {
  const theme = getChartTheme();

  const data = useMemo(() => {
    const counts = new Map();
    for (const incident of incidents) {
      if (Number(incident.riskScore) < threshold) continue;
      const key = dayKey(incident.detectedAt || incident.createdAt);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({ day, label: dayLabel(day), count }));
  }, [incidents, threshold]);

  return (
    <ChartFrame
      title="Critical incidents per day"
      question={`How many incidents at or above the critical threshold (${threshold}) were raised each day?`}
      columns={[
        { key: 'label', header: 'Day' },
        { key: 'count', header: 'Critical incidents', align: 'right' },
      ]}
      rows={data}
      emptyTitle="No critical incidents in this range"
      emptyDescription="Nothing in this period reached the critical threshold."
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid.stroke} vertical={false} />
          <XAxis dataKey="label" stroke={theme.axis.stroke} tick={theme.axis.tick} tickLine={false} />
          <YAxis allowDecimals={false} stroke={theme.axis.stroke} tick={theme.axis.tick} tickLine={false} width={36}>
            <Label value="Incidents" position="insideLeft" angle={-90} style={theme.axis.tick} />
          </YAxis>
          <Tooltip {...theme.tooltip} cursor={theme.tooltip.cursor} />
          <Line
            type="monotone"
            dataKey="count"
            name="Critical incidents"
            stroke={theme.colors.critical}
            strokeWidth={2}
            dot={{ fill: theme.colors.critical, r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
});

const PIPELINE_ORDER = ['APPROVED', 'DISPATCHED', 'ACKNOWLEDGED', 'ARRIVED', 'RESOLVED'];

/** Where the incidents sit in the response pipeline — a stacked proportion bar. */
export const ResponsePipelineChart = memo(function ResponsePipelineChart({ statusCounts }) {
  const rows = useMemo(() => {
    const counts = new Map((statusCounts || []).map((entry) => [entry._id, entry.count]));
    const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
    return PIPELINE_ORDER.filter((status) => counts.get(status)).map((status) => ({
      status,
      label: incidentStatusLabel(status),
      count: counts.get(status),
      share: total ? Math.round((counts.get(status) / total) * 100) : 0,
    }));
  }, [statusCounts]);

  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <ChartFrame
      title="Response pipeline"
      question="Where do the incidents sit in the response pipeline?"
      columns={[
        { key: 'label', header: 'Stage' },
        { key: 'count', header: 'Incidents', align: 'right' },
        { key: 'share', header: 'Share', align: 'right' },
      ]}
      rows={rows}
      emptyTitle="No incidents in this range"
      emptyDescription="Nothing has reached the response pipeline yet."
    >
      <div className={styles.pipeline}>
        <div className={styles.pipelineBar} role="img" aria-label={`${total} incidents across ${rows.length} stages`}>
          {rows.map((row, index) => (
            <span
              key={row.status}
              className={styles.pipelineSegment}
              data-tone={index % 3}
              style={{ flexGrow: row.count / total }}
              title={`${row.label}: ${row.count} (${row.share}%)`}
            />
          ))}
        </div>
        <ul className={styles.pipelineLegend}>
          {rows.map((row) => (
            <li key={row.status}>
              <span className={styles.pipelineLabel}>{row.label}</span>
              <span className={styles.pipelineValue}>{row.count}</span>
              <span className={styles.pipelineShare}>{row.share}%</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartFrame>
  );
});

/** Telemetry readings per hour, split by source. */
export const TelemetryByHourChart = memo(function TelemetryByHourChart({ telemetryData }) {
  const theme = getChartTheme();

  const { rows, sources } = useMemo(() => {
    const byHour = new Map();
    const sourceNames = new Set();

    for (const entry of telemetryData?.data || []) {
      const hour = entry._id?.hour;
      const source = entry._id?.sourceType || 'OTHER';
      sourceNames.add(source);
      if (!byHour.has(hour)) byHour.set(hour, { hour, total: 0 });
      const bucket = byHour.get(hour);
      bucket[source] = (bucket[source] || 0) + entry.count;
      bucket.total += entry.count;
    }

    return {
      rows: [...byHour.values()].sort((a, b) => a.hour - b.hour).map((bucket) => ({
        hour: `${String(bucket.hour).padStart(2, '0')}:00`,
        ...bucket,
      })),
      sources: [...sourceNames].sort(),
    };
  }, [telemetryData]);

  const palette = [
    theme.colors.accent,
    theme.colors.normal,
    theme.colors.caution,
    theme.colors.critical,
    theme.colors.neutral,
  ];

  return (
    <ChartFrame
      title="Telemetry per hour"
      question="How many readings arrived each hour, and from which source?"
      columns={[
        { key: 'hour', header: 'Hour' },
        ...sources.map((source) => ({ key: source, header: source, align: 'right' })),
        { key: 'total', header: 'Total', align: 'right' },
      ]}
      rows={rows}
      emptyTitle="No telemetry in the last 24 hours"
      emptyDescription="The ingest pipeline has not reported any readings."
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid.stroke} vertical={false} />
          <XAxis dataKey="hour" stroke={theme.axis.stroke} tick={theme.axis.tick} tickLine={false} />
          <YAxis allowDecimals={false} stroke={theme.axis.stroke} tick={theme.axis.tick} tickLine={false} width={36}>
            <Label value="Readings" position="insideLeft" angle={-90} style={theme.axis.tick} />
          </YAxis>
          <Tooltip {...theme.tooltip} cursor={theme.tooltip.cursor} />
          <Legend wrapperStyle={{ fontSize: 12, color: theme.colors.neutral }} />
          {sources.map((source, index) => (
            <Bar
              key={source}
              dataKey={source}
              stackId="telemetry"
              name={source}
              fill={palette[index % palette.length]}
              maxBarSize={28}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
});

/** The risk band of every cell that reported in the last day. */
export const CellRiskBandsChart = memo(function CellRiskBandsChart({ cells }) {
  const theme = getChartTheme();

  const rows = useMemo(() => {
    const counts = { critical: 0, caution: 0, normal: 0 };
    for (const cell of cells || []) {
      if (cell.riskLevel === 'CRITICAL') counts.critical += 1;
      else if (cell.riskLevel === 'HIGH') counts.caution += 1;
      else counts.normal += 1;
    }
    return [
      { band: 'critical', label: 'Critical', count: counts.critical, color: theme.colors.critical },
      { band: 'caution', label: 'Caution', count: counts.caution, color: theme.colors.caution },
      { band: 'normal', label: 'Normal', count: counts.normal, color: theme.colors.normal },
    ].filter((row) => row.count > 0);
  }, [cells, theme.colors]);

  return (
    <ChartFrame
      title="Cells by risk band"
      question="How many cells that reported in the last day are in each risk band?"
      columns={[
        { key: 'label', header: 'Band' },
        { key: 'count', header: 'Cells', align: 'right' },
      ]}
      rows={rows}
      emptyTitle="No cells reported in the last day"
      emptyDescription="The risk engine has not scored a cell in the last 24 hours."
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid.stroke} horizontal={false} />
          <XAxis type="number" allowDecimals={false} stroke={theme.axis.stroke} tick={theme.axis.tick} tickLine={false} />
          <YAxis type="category" dataKey="label" stroke={theme.axis.stroke} tick={theme.axis.tick} tickLine={false} width={80}>
            <Label value="Cells" position="insideLeft" angle={-90} style={theme.axis.tick} />
          </YAxis>
          <Tooltip {...theme.tooltip} cursor={theme.tooltip.cursor} />
          <Bar dataKey="count" name="Cells" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {rows.map((row) => (
              <Cell key={row.band} fill={row.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
});
