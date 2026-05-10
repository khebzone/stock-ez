import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

interface Props {
  data: Record<string, number>;
  height?: number;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:      '#94a3b8',
  SUBMITTED:  '#f59e0b',
  APPROVED:   '#059669',
  PREPARING:  '#0891b2',
  PREPARED:   '#06b6d4',
  DISPATCHED: '#8b5cf6',
  DELIVERED:  '#10b981',
  CANCELLED:  '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT:      'Draft',
  SUBMITTED:  'Submitted',
  APPROVED:   'Approved',
  PREPARING:  'Preparing',
  PREPARED:   'Prepared',
  DISPATCHED: 'Dispatched',
  DELIVERED:  'Delivered',
  CANCELLED:  'Cancelled',
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff', border: '1px solid #e8ecf0', borderRadius: 8,
      padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: '#1a1d2e' }}>{payload[0].name}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: payload[0].payload.fill }}>{payload[0].value}</div>
    </div>
  );
};

const renderLegend = (props: any) => {
  const { payload } = props;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 }}>
      {payload.map((entry: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
          <span style={{ color: '#6b7280' }}>{entry.value}</span>
          <span style={{ fontWeight: 700, color: '#1a1d2e' }}>{entry.payload.value}</span>
        </div>
      ))}
    </div>
  );
};

const OrderStatusChart: React.FC<Props> = ({ data, height = 260 }) => {
  const chartData = Object.entries(data || {})
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: STATUS_LABELS[key] || key,
      value,
      fill: STATUS_COLORS[key] || '#9ca3af',
    }));

  if (chartData.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
        No order data
      </div>
    );
  }

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={chartData}
          innerRadius={65}
          outerRadius={95}
          paddingAngle={3}
          dataKey="value"
          startAngle={90}
          endAngle={-270}
        >
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} stroke="none" />
          ))}
          {/* Center label */}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend content={renderLegend} />
        {/* Render center total using foreignObject hack */}
        <text x="50%" y="44%" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: 'Inter, sans-serif' }}>
          <tspan x="50%" dy="0" style={{ fontSize: 22, fontWeight: 800, fill: '#1a1d2e' }}>{total}</tspan>
          <tspan x="50%" dy="18" style={{ fontSize: 11, fill: '#9ca3af' }}>Orders</tspan>
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
};

export default OrderStatusChart;
