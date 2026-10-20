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

// Field Console Charts
function TaskStatusDistributionChart({ tasks }) {
  const data = useMemo(() => {
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

    return chartData;
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
  const data = useMemo(() => {
    const resolvedTasks = tasks.filter(t => t.resolvedAt && t.dispatchedAt);
    const grouped = {};
    resolvedTasks.forEach(task => {
      const hours = (new Date(task.resolvedAt) - new Date(task.dispatchedAt)) / (1000 * 60 * 60);
      const bucket = hours < 1 ? '< 1h' : hours < 6 ? '1-6h' : hours < 24 ? '6-24h' : '> 24h';
      grouped[bucket] = (grouped[bucket] || 0) + 1;
    });

    const chartData = Object.entries(grouped)
      .map(([bucket, count]) => ({ name: bucket, value: count }));

    return chartData;
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

function RiskLevelByTaskChart({ tasks }) {
  const data = useMemo(() => {
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

    return chartData;
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
          contentStyle={{ backgroundColor: 'rgba(14, 14, 22, 0.92)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '16px', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.95), 0 0 30px -12px rgba(139,92,246,0.7)', backdropFilter: 'blur(18px)' }}
          itemStyle={{ color: '#F4F5F9' }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

const MemoTaskStatusDistributionChart = memo(TaskStatusDistributionChart);
const MemoTaskResolutionTimeChart = memo(TaskResolutionTimeChart);
const MemoRiskLevelByTaskChart = memo(RiskLevelByTaskChart);

export {
  MemoTaskStatusDistributionChart as TaskStatusDistributionChart,
  MemoTaskResolutionTimeChart as TaskResolutionTimeChart,
  MemoRiskLevelByTaskChart as RiskLevelByTaskChart,
};
