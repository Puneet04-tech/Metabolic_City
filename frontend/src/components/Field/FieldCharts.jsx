import { useState, useEffect } from 'react';
import { PieChart, Pie, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

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
};

// Field Console Charts
function TaskStatusDistributionChart({ tasks }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    const grouped = {};
    tasks.forEach(task => {
      grouped[task.status] = (grouped[task.status] || 0) + 1;
    });

    const chartData = Object.entries(grouped)
      .map(([status, count]) => ({ 
        name: status, 
        value: count, 
        fill: COLORS[status] || '#6B7280' 
      }));

    setData(chartData);
  }, [tasks]);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis type="number" stroke="#94a3b8" />
        <YAxis type="category" dataKey="name" width={120} stroke="#94a3b8" />
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

function TaskResolutionTimeChart({ tasks }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    const resolvedTasks = tasks.filter(t => t.resolvedAt && t.dispatchedAt);
    const grouped = {};
    resolvedTasks.forEach(task => {
      const hours = (new Date(task.resolvedAt) - new Date(task.dispatchedAt)) / (1000 * 60 * 60);
      const bucket = hours < 1 ? '< 1h' : hours < 6 ? '1-6h' : hours < 24 ? '6-24h' : '> 24h';
      grouped[bucket] = (grouped[bucket] || 0) + 1;
    });

    const chartData = Object.entries(grouped)
      .map(([bucket, count]) => ({ name: bucket, value: count }));

    setData(chartData);
  }, [tasks]);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="name" stroke="#94a3b8" />
        <YAxis stroke="#94a3b8" />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
          itemStyle={{ color: '#f8fafc' }}
        />
        <Legend />
        <Bar dataKey="value" fill="#10B981" name="Tasks" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RiskLevelByTaskChart({ tasks }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    const grouped = { CRITICAL: 0, HIGH: 0, MODERATE: 0, LOW: 0 };
    tasks.forEach(task => {
      const risk = task.riskScore || 0;
      if (risk >= 7) grouped.CRITICAL++;
      else if (risk >= 5) grouped.HIGH++;
      else if (risk >= 3) grouped.MODERATE++;
      else grouped.LOW++;
    });

    const chartData = Object.entries(grouped)
      .filter(([_, count]) => count > 0)
      .map(([level, count]) => ({ name: level, value: count, fill: COLORS[level] }));

    setData(chartData);
  }, [tasks]);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={70} label>
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

export {
  TaskStatusDistributionChart,
  TaskResolutionTimeChart,
  RiskLevelByTaskChart,
};
