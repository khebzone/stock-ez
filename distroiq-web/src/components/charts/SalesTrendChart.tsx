import React from 'react';
import {
  ResponsiveContainer, XAxis, YAxis,
  CartesianGrid, Tooltip, Area, AreaChart,
} from 'recharts';

interface Props {
  data: { date: string; totalAmount?: number; amount?: number }[];
  height?: number;
}

const formatINR = (v: number) => v >= 100000
  ? `₹${(v / 100000).toFixed(1)}L`
  : v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff', border: '1px solid #e8ecf0', borderRadius: 8,
      padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontWeight: 600, fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ fontSize: 14, fontWeight: 700, color: p.color }}>
          ₹{Number(p.value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      ))}
    </div>
  );
};

const SalesTrendChart: React.FC<Props> = ({ data, height = 240 }) => {
  const chartData = data.map(d => ({
    ...d,
    value: d.totalAmount ?? d.amount ?? 0,
    label: d.date ? new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : d.date,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#059669" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#059669" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatINR} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={56} />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone" dataKey="value" name="Revenue"
          stroke="#059669" strokeWidth={2.5}
          fill="url(#salesGrad)"
          dot={false} activeDot={{ r: 5, fill: '#059669', stroke: '#fff', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default SalesTrendChart;
