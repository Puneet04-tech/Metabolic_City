import { LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { memo, useMemo } from 'react';
import { apiRequest } from '../../api.js';

const COLORS = {
  CRITICAL: '#FF5C5C',
  HIGH: '#FFB020',
  MODERATE: '#22D3EE',
  LOW: '#60A5FA',
  APPROVED: '#2DD4A7',
  RESOLVED: '#34D399',
  DISPATCHED: '#8B5CF6',
  ACKNOWLEDGED: '#A78BFA',
  ARRIVED: '#F472B6',
  DETECTED: '#64748B',
};

function IncidentTrendChart({ incidents }) {
  const data = useMemo(() => {
    // Group incidents by date
    const grouped = {};
    incidents.forEach(incident => {
      const date = new Date(incident.detectedAt).toLocaleDateString();
      grouped[date] = (grouped[date] || 0) + 1;
    });

    const chartData = Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return chartData;
  }, [incidents]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="date" stroke="#8A8FA3" />
        <YAxis stroke="#8A8FA3" />
        <Tooltip 
          contentStyle={{ backgroundColor: 'rgba(14, 14, 22, 0.92)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '16px', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.95), 0 0 30px -12px rgba(139,92,246,0.7)', backdropFilter: 'blur(18px)' }}
          itemStyle={{ color: '#F4F5F9' }}
        />
        <Legend />
        <Line type="monotone" dataKey="count" stroke="#60A5FA" strokeWidth={2} dot={{ fill: '#60A5FA' }} name="Incidents" />
      </LineChart>
    </ResponsiveContainer>
  );
}

function RiskDistributionChart({ incidents }) {
  const data = useMemo(() => {
    // Group by risk level
    const grouped = { CRITICAL: 0, HIGH: 0, MODERATE: 0, LOW: 0 };
    incidents.forEach(incident => {
      const risk = incident.riskScore || 0;
      if (risk >= 7) grouped.CRITICAL++;
      else if (risk >= 5) grouped.HIGH++;
      else if (risk >= 3) grouped.MODERATE++;
      else grouped.LOW++;
    });

    const chartData = Object.entries(grouped)
      .filter(([_, count]) => count > 0)
      .map(([level, count]) => ({ name: level, value: count, fill: COLORS[level] }));

    return chartData;
  }, [incidents]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} label>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ backgroundColor: 'rgba(14, 14, 22, 0.92)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '16px', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.95), 0 0 30px -12px rgba(139,92,246,0.7)', backdropFilter: 'blur(18px)' }}
          itemStyle={{ color: '#F4F5F9' }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

function StatusBreakdownChart({ incidents }) {
  const data = useMemo(() => {
    // Group by status
    const grouped = {};
    incidents.forEach(incident => {
      grouped[incident.status] = (grouped[incident.status] || 0) + 1;
    });

    const chartData = Object.entries(grouped)
      .map(([status, count]) => ({ 
        name: status, 
        value: count, 
        fill: COLORS[status] || '#64748B' 
      }));

    return chartData;
  }, [incidents]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis type="number" stroke="#8A8FA3" />
        <YAxis type="category" dataKey="name" width={100} stroke="#8A8FA3" />
        <Tooltip 
          contentStyle={{ backgroundColor: 'rgba(14, 14, 22, 0.92)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '16px', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.95), 0 0 30px -12px rgba(139,92,246,0.7)', backdropFilter: 'blur(18px)' }}
          itemStyle={{ color: '#F4F5F9' }}
        />
        <Legend />
        <Bar dataKey="value" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RiskLevelAreaChart({ incidents }) {
  const data = useMemo(() => {
    // Group by date and average risk
    const grouped = {};
    incidents.forEach(incident => {
      const date = new Date(incident.detectedAt).toLocaleDateString();
      if (!grouped[date]) {
        grouped[date] = { totalRisk: 0, count: 0 };
      }
      grouped[date].totalRisk += incident.riskScore || 0;
      grouped[date].count += 1;
    });

    const chartData = Object.entries(grouped)
      .map(([date, data]) => ({
        date,
        avgRisk: data.count > 0 ? data.totalRisk / data.count : 0,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return chartData;
  }, [incidents]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="date" stroke="#8A8FA3" />
        <YAxis stroke="#8A8FA3" />
        <Tooltip 
          contentStyle={{ backgroundColor: 'rgba(14, 14, 22, 0.92)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '16px', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.95), 0 0 30px -12px rgba(139,92,246,0.7)', backdropFilter: 'blur(18px)' }}
          itemStyle={{ color: '#F4F5F9' }}
        />
        <Legend />
        <Area type="monotone" dataKey="avgRisk" stroke="#FFB020" fill="#FFB020" fillOpacity={0.16} name="Average Risk" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TelemetryVolumeChart({ telemetryData }) {
  const data = useMemo(() => {
    if (!telemetryData || !telemetryData.data) return [];

    // Group by hour
    const grouped = {};
    telemetryData.data.forEach(item => {
      const hour = item._id.hour;
      const source = item._id.sourceType;
      if (!grouped[hour]) {
        grouped[hour] = 0;
      }
      grouped[hour] += item.count;
    });

    const chartData = Object.entries(grouped)
      .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

    return chartData;
  }, [telemetryData]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="hour" stroke="#8A8FA3" />
        <YAxis stroke="#8A8FA3" />
        <Tooltip 
          contentStyle={{ backgroundColor: 'rgba(14, 14, 22, 0.92)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '16px', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.95), 0 0 30px -12px rgba(139,92,246,0.7)', backdropFilter: 'blur(18px)' }}
          itemStyle={{ color: '#F4F5F9' }}
        />
        <Legend />
        <Bar dataKey="count" fill="#8B5CF6" name="Telemetry Events" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ResolutionTimeChart({ incidents }) {
  const data = useMemo(() => {
    // Calculate resolution time by status
    const grouped = {};
    incidents.forEach(incident => {
      if (incident.resolvedAt && incident.detectedAt) {
        const hours = (new Date(incident.resolvedAt) - new Date(incident.detectedAt)) / (1000 * 60 * 60);
        const bucket = hours < 1 ? '< 1h' : hours < 6 ? '1-6h' : hours < 24 ? '6-24h' : '> 24h';
        grouped[bucket] = (grouped[bucket] || 0) + 1;
      }
    });

    const chartData = Object.entries(grouped)
      .map(([bucket, count]) => ({ name: bucket, value: count }));

    return chartData;
  }, [incidents]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="name" stroke="#8A8FA3" />
        <YAxis stroke="#8A8FA3" />
        <Tooltip 
          contentStyle={{ backgroundColor: 'rgba(14, 14, 22, 0.92)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '16px', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.95), 0 0 30px -12px rgba(139,92,246,0.7)', backdropFilter: 'blur(18px)' }}
          itemStyle={{ color: '#F4F5F9' }}
        />
        <Legend />
        <Bar dataKey="value" fill="#2DD4A7" name="Incidents" />
      </BarChart>
    </ResponsiveContainer>
  );
}

const MemoIncidentTrendChart = memo(IncidentTrendChart);
const MemoRiskDistributionChart = memo(RiskDistributionChart);
const MemoStatusBreakdownChart = memo(StatusBreakdownChart);
const MemoRiskLevelAreaChart = memo(RiskLevelAreaChart);
const MemoTelemetryVolumeChart = memo(TelemetryVolumeChart);
const MemoResolutionTimeChart = memo(ResolutionTimeChart);

export {
  MemoIncidentTrendChart as IncidentTrendChart,
  MemoRiskDistributionChart as RiskDistributionChart,
  MemoStatusBreakdownChart as StatusBreakdownChart,
  MemoRiskLevelAreaChart as RiskLevelAreaChart,
  MemoTelemetryVolumeChart as TelemetryVolumeChart,
  MemoResolutionTimeChart as ResolutionTimeChart,
};
