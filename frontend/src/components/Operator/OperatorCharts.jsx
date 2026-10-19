import { useState, useEffect } from 'react';
import { PieChart, Pie, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

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
};

// Operator Console Charts
function CellRiskDistributionChart({ cells }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    const grouped = { CRITICAL: 0, HIGH: 0, MODERATE: 0, LOW: 0 };
    cells.forEach(cell => {
      if (cell.compositeRisk >= 7) grouped.CRITICAL++;
      else if (cell.compositeRisk >= 5) grouped.HIGH++;
      else if (cell.compositeRisk >= 3) grouped.MODERATE++;
      else grouped.LOW++;
    });

    const chartData = Object.entries(grouped)
      .filter(([_, count]) => count > 0)
      .map(([level, count]) => ({ name: level, value: count, fill: COLORS[level] }));

    setData(chartData);
  }, [cells]);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={70} label>
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

function CriticalCellTrendChart({ cells }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    const criticalCells = cells.filter(c => c.compositeRisk >= 7);
    const grouped = {};
    criticalCells.forEach(cell => {
      const date = new Date(cell.lastUpdated).toLocaleDateString();
      grouped[date] = (grouped[date] || 0) + 1;
    });

    const chartData = Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    setData(chartData);
  }, [cells]);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="date" stroke="#8A8FA3" />
        <YAxis stroke="#8A8FA3" />
        <Tooltip 
          contentStyle={{ backgroundColor: 'rgba(14, 14, 22, 0.92)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '16px', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.95), 0 0 30px -12px rgba(139,92,246,0.7)', backdropFilter: 'blur(18px)' }}
          itemStyle={{ color: '#F4F5F9' }}
        />
        <Legend />
        <Line type="monotone" dataKey="count" stroke="#FF5C5C" strokeWidth={2} dot={{ fill: '#FF5C5C' }} name="Critical Cells" />
      </LineChart>
    </ResponsiveContainer>
  );
}

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
        fill: COLORS[status] || '#64748B' 
      }));

    setData(chartData);
  }, [tasks]);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis type="number" stroke="#8A8FA3" />
        <YAxis type="category" dataKey="name" width={120} stroke="#8A8FA3" />
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
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="name" stroke="#8A8FA3" />
        <YAxis stroke="#8A8FA3" />
        <Tooltip 
          contentStyle={{ backgroundColor: 'rgba(14, 14, 22, 0.92)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '16px', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.95), 0 0 30px -12px rgba(139,92,246,0.7)', backdropFilter: 'blur(18px)' }}
          itemStyle={{ color: '#F4F5F9' }}
        />
        <Legend />
        <Bar dataKey="value" fill="#2DD4A7" name="Tasks" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Admin Console Charts
function SystemActivityChart({ auditLogs }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    const grouped = {};
    auditLogs.forEach(log => {
      const date = new Date(log.createdAt).toLocaleDateString();
      grouped[date] = (grouped[date] || 0) + 1;
    });

    const chartData = Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-7); // Last 7 days

    setData(chartData);
  }, [auditLogs]);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="date" stroke="#8A8FA3" />
        <YAxis stroke="#8A8FA3" />
        <Tooltip 
          contentStyle={{ backgroundColor: 'rgba(14, 14, 22, 0.92)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '16px', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.95), 0 0 30px -12px rgba(139,92,246,0.7)', backdropFilter: 'blur(18px)' }}
          itemStyle={{ color: '#F4F5F9' }}
        />
        <Legend />
        <Line type="monotone" dataKey="count" stroke="#8B5CF6" strokeWidth={2} dot={{ fill: '#8B5CF6' }} name="System Actions" />
      </LineChart>
    </ResponsiveContainer>
  );
}

function UserActivityChart({ auditLogs }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    const grouped = {};
    auditLogs.forEach(log => {
      const user = log.userEmail || 'Unknown';
      grouped[user] = (grouped[user] || 0) + 1;
    });

    const chartData = Object.entries(grouped)
      .map(([user, count]) => ({ name: user, value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 users

    setData(chartData);
  }, [auditLogs]);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis type="number" stroke="#8A8FA3" />
        <YAxis type="category" dataKey="name" width={150} stroke="#8A8FA3" />
        <Tooltip 
          contentStyle={{ backgroundColor: 'rgba(14, 14, 22, 0.92)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '16px', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.95), 0 0 30px -12px rgba(139,92,246,0.7)', backdropFilter: 'blur(18px)' }}
          itemStyle={{ color: '#F4F5F9' }}
        />
        <Legend />
        <Bar dataKey="value" fill="#818CF8" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function IncidentTypeDistributionChart({ incidents }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    const grouped = {};
    incidents.forEach(incident => {
      const type = incident.type || 'UNKNOWN';
      grouped[type] = (grouped[type] || 0) + 1;
    });

    const chartData = Object.entries(grouped)
      .map(([type, count]) => ({ name: type, value: count }));

    setData(chartData);
  }, [incidents]);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={70} label>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill="#60A5FA" />
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

export {
  CellRiskDistributionChart,
  CriticalCellTrendChart,
  TaskStatusDistributionChart,
  TaskResolutionTimeChart,
  SystemActivityChart,
  UserActivityChart,
  IncidentTypeDistributionChart,
};
