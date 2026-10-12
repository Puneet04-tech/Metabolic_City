import { LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { useState, useEffect } from 'react';
import { apiRequest } from '../../api.js';

const COLORS = {
  CRITICAL: '#EF4444',
  HIGH: '#F59E0B',
  MODERATE: '#10B981',
  LOW: '#3B82F6',
  APPROVED: '#10B981',
  RESOLVED: '#059669',
  DISPATCHED: '#8B5CF6',
  ACKNOWLEDGED: '#6366F1',
  ARRIVED: '#EC4899',
  DETECTED: '#6B7280',
};

function IncidentTrendChart({ incidents }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    // Group incidents by date
    const grouped = {};
    incidents.forEach(incident => {
      const date = new Date(incident.detectedAt).toLocaleDateString();
      grouped[date] = (grouped[date] || 0) + 1;
    });

    const chartData = Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    setData(chartData);
  }, [incidents]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="date" stroke="#94a3b8" />
        <YAxis stroke="#94a3b8" />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
          itemStyle={{ color: '#f8fafc' }}
        />
        <Legend />
        <Line type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2} dot={{ fill: '#2563EB' }} name="Incidents" />
      </LineChart>
    </ResponsiveContainer>
  );
}

function RiskDistributionChart({ incidents }) {
  const [data, setData] = useState([]);

  useEffect(() => {
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

    setData(chartData);
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
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
          itemStyle={{ color: '#f8fafc' }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

function StatusBreakdownChart({ incidents }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    // Group by status
    const grouped = {};
    incidents.forEach(incident => {
      grouped[incident.status] = (grouped[incident.status] || 0) + 1;
    });

    const chartData = Object.entries(grouped)
      .map(([status, count]) => ({ 
        name: status, 
        value: count, 
        fill: COLORS[status] || '#6B7280' 
      }));

    setData(chartData);
  }, [incidents]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis type="number" stroke="#94a3b8" />
        <YAxis type="category" dataKey="name" width={100} stroke="#94a3b8" />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
          itemStyle={{ color: '#f8fafc' }}
        />
        <Legend />
        <Bar dataKey="value" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RiskLevelAreaChart({ incidents }) {
  const [data, setData] = useState([]);

  useEffect(() => {
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

    setData(chartData);
  }, [incidents]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="date" stroke="#94a3b8" />
        <YAxis stroke="#94a3b8" />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
          itemStyle={{ color: '#f8fafc' }}
        />
        <Legend />
        <Area type="monotone" dataKey="avgRisk" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} name="Average Risk" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TelemetryVolumeChart({ telemetryData }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    if (!telemetryData || !telemetryData.data) return;

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

    setData(chartData);
  }, [telemetryData]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="hour" stroke="#94a3b8" />
        <YAxis stroke="#94a3b8" />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
          itemStyle={{ color: '#f8fafc' }}
        />
        <Legend />
        <Bar dataKey="count" fill="#8B5CF6" name="Telemetry Events" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ResolutionTimeChart({ incidents }) {
  const [data, setData] = useState([]);

  useEffect(() => {
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

    setData(chartData);
  }, [incidents]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="name" stroke="#94a3b8" />
        <YAxis stroke="#94a3b8" />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
          itemStyle={{ color: '#f8fafc' }}
        />
        <Legend />
        <Bar dataKey="value" fill="#10B981" name="Incidents" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export {
  IncidentTrendChart,
  RiskDistributionChart,
  StatusBreakdownChart,
  RiskLevelAreaChart,
  TelemetryVolumeChart,
  ResolutionTimeChart,
};
