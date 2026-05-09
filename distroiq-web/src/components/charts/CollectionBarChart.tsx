import React from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';

interface DayData {
  date: string;
  cashAmount?: number;
  upiAmount?: number;
  bankTransferAmount?: number;
  chequeAmount?: number;
}

interface Props {
  data: DayData[];
  height?: number;
}

const formatINR = (v: number) => v >= 100000
  ? `₹${(v / 100000).toFixed(1)}L`
  : v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
  return (
    <div style={{
      background: '#fff', border: '1px solid #e8ecf0', borderRadius: 8,
      padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontWeight: 600, fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 12, marginBottom: 2 }}>
          <span style={{ color: p.fill }}>{p.name}</span>
          <span style={{ fontWeight: 600 }}>₹{Number(p.value).toLocaleString('en-IN')}</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 6, paddingTop: 6, fontWeight: 700, fontSize: 13 }}>
        Total: ₹{total.toLocaleString('en-IN')}
      </div>
    </div>
  );
};

const CollectionBarChart: React.FC<Props> = ({ data, height = 240 }) => {
  const chartData = data.map(d => ({
    label: d.date ? new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : d.date,
    Cash: d.cashAmount || 0,
    UPI: d.upiAmount || 0,
    Bank: d.bankTransferAmount || 0,
    Cheque: d.chequeAmount || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }} barSize={14}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatINR} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={52} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Cash"   stackId="a" fill="#10b981" radius={[0,0,0,0]} />
        <Bar dataKey="UPI"    stackId="a" fill="#8b5cf6" radius={[0,0,0,0]} />
        <Bar dataKey="Bank"   stackId="a" fill="#059669" radius={[0,0,0,0]} />
        <Bar dataKey="Cheque" stackId="a" fill="#f59e0b" radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default CollectionBarChart;
