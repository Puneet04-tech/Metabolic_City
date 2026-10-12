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
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="date" stroke="#94a3b8" />
        <YAxis stroke="#94a3b8" />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
          itemStyle={{ color: '#f8fafc' }}
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
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis type="number" stroke="#94a3b8" />
        <YAxis type="category" dataKey="name" width={150} stroke="#94a3b8" />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
          itemStyle={{ color: '#f8fafc' }}
        />
        <Legend />
        <Bar dataKey="value" fill="#6366F1" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ActionTypeDistributionChart({ auditLogs }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    const grouped = {};
    auditLogs.forEach(log => {
      const action = log.action;
      grouped[action] = (grouped[action] || 0) + 1;
    });

    const chartData = Object.entries(grouped)
      .map(([action, count]) => ({ name: action, value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 actions

    setData(chartData);
  }, [auditLogs]);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis type="number" stroke="#94a3b8" />
        <YAxis type="category" dataKey="name" width={150} stroke="#94a3b8" />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
          itemStyle={{ color: '#f8fafc' }}
        />
        <Legend />
        <Bar dataKey="value" fill="#EC4899" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RoleDistributionChart({ users }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    const grouped = {};
    users.forEach(user => {
      grouped[user.role] = (grouped[user.role] || 0) + 1;
    });

    const chartData = Object.entries(grouped)
      .map(([role, count]) => ({ name: role, value: count, fill: COLORS[role] || '#6B7280' }));

    setData(chartData);
  }, [users]);

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
  SystemActivityChart,
  UserActivityChart,
  ActionTypeDistributionChart,
  RoleDistributionChart,
};
