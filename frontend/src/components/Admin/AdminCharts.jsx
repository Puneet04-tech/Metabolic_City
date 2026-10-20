import { memo, useMemo } from 'react';
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

// Admin Console Charts
function SystemActivityChart({ auditLogs }) {
  const data = useMemo(() => {
    const grouped = {};
    auditLogs.forEach(log => {
      const date = new Date(log.createdAt).toLocaleDateString();
      grouped[date] = (grouped[date] || 0) + 1;
    });

    const chartData = Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-7); // Last 7 days

    return chartData;
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
  const data = useMemo(() => {
    const grouped = {};
    auditLogs.forEach(log => {
      const user = log.userEmail || 'Unknown';
      grouped[user] = (grouped[user] || 0) + 1;
    });

    const chartData = Object.entries(grouped)
      .map(([user, count]) => ({ name: user, value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 users

    return chartData;
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

function ActionTypeDistributionChart({ auditLogs }) {
  const data = useMemo(() => {
    const grouped = {};
    auditLogs.forEach(log => {
      const action = log.action;
      grouped[action] = (grouped[action] || 0) + 1;
    });

    const chartData = Object.entries(grouped)
      .map(([action, count]) => ({ name: action, value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 actions

    return chartData;
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
        <Bar dataKey="value" fill="#F472B6" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RoleDistributionChart({ users }) {
  const data = useMemo(() => {
    const grouped = {};
    users.forEach(user => {
      grouped[user.role] = (grouped[user.role] || 0) + 1;
    });

    const chartData = Object.entries(grouped)
      .map(([role, count]) => ({ name: role, value: count, fill: COLORS[role] || '#64748B' }));

    return chartData;
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
          contentStyle={{ backgroundColor: 'rgba(14, 14, 22, 0.92)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '16px', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.95), 0 0 30px -12px rgba(139,92,246,0.7)', backdropFilter: 'blur(18px)' }}
          itemStyle={{ color: '#F4F5F9' }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

const MemoSystemActivityChart = memo(SystemActivityChart);
const MemoUserActivityChart = memo(UserActivityChart);
const MemoActionTypeDistributionChart = memo(ActionTypeDistributionChart);
const MemoRoleDistributionChart = memo(RoleDistributionChart);

export {
  MemoSystemActivityChart as SystemActivityChart,
  MemoUserActivityChart as UserActivityChart,
  MemoActionTypeDistributionChart as ActionTypeDistributionChart,
  MemoRoleDistributionChart as RoleDistributionChart,
};
