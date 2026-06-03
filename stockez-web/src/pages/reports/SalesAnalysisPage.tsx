import React, { useState } from 'react';
import { DatePicker, Select, Skeleton, Button } from 'antd';
import { FileExcelOutlined } from '@ant-design/icons';
import { exportToXLSX } from '../../components/TableToolbar';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import dayjs from 'dayjs';
import { useGetSalesAnalysisQuery } from '../../store/api/reportApi';

const { RangePicker } = DatePicker;

const COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#ea580c', '#0f172a'];
const fmt = (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
const fmtShort = (v: number) => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(1)}K` : `₹${v}`;

const KpiCard: React.FC<{ label: string; value: string; sub?: string; color: string; bg: string }> = ({ label, value, sub, color, bg }) => (
  <div style={{ background: bg, borderRadius: 14, border: `1px solid ${color}25`, padding: '18px 20px' }}>
    <div style={{ fontSize: 11, color: color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginTop: 6, letterSpacing: -0.5 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{sub}</div>}
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6, fontSize: 13 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ fontSize: 13, color: p.color }}>
          {p.name}: <strong>{fmtShort(p.value)}</strong>
        </div>
      ))}
    </div>
  );
};

const SalesAnalysisPage: React.FC = () => {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs()]);
  const [groupBy, setGroupBy] = useState('SALESMAN');

  const { data, isLoading } = useGetSalesAnalysisQuery({
    from: range[0].format('YYYY-MM-DD'),
    to: range[1].format('YYYY-MM-DD'),
    groupBy,
  });

  const report: any = data?.data || {};
  const groups: any[] = report.groups || [];
  const trend: any[] = report.dailyTrend || [];
  const kpi: any = report.kpi || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>Sales Analysis</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>Performance breakdown by salesman, product & category</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <RangePicker
            value={range}
            onChange={v => v && setRange(v as [dayjs.Dayjs, dayjs.Dayjs])}
            style={{ borderRadius: 10 }}
            allowClear={false}
          />
          <Select
            value={groupBy} onChange={setGroupBy}
            style={{ width: 160, borderRadius: 10 }}
            options={[
              { value: 'SALESMAN',  label: 'By Salesman'  },
              { value: 'PRODUCT',   label: 'By Product'   },
              { value: 'CATEGORY',  label: 'By Category'  },
            ]}
          />
          <Button
            icon={<FileExcelOutlined />}
            disabled={groups.length === 0}
            onClick={() => exportToXLSX(
              groups.map((g: any) => ({
                name: g.name,
                orders: g.orderCount || g.qtySold || 0,
                revenue: g.totalSales,
                avgOrder: g.orderCount ? ((g.totalSales || 0) / g.orderCount).toFixed(2) : '—',
              })),
              [
                { title: 'Name',      key: 'name',     dataIndex: 'name' },
                { title: 'Orders/Qty',key: 'orders',   dataIndex: 'orders' },
                { title: 'Revenue',   key: 'revenue',  dataIndex: 'revenue' },
                { title: 'Avg Order', key: 'avgOrder', dataIndex: 'avgOrder' },
              ],
              `sales-analysis-${range[0].format('YYYY-MM-DD')}-to-${range[1].format('YYYY-MM-DD')}`
            )}
            style={{ borderRadius: 8 }}
          >
            Export Excel
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? <Skeleton active paragraph={{ rows: 2 }} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <KpiCard label="Total Sales"     value={fmtShort(kpi.totalSales || 0)}   sub={`${kpi.totalOrders || 0} orders`}           color="#2563eb" bg="#eff6ff" />
          <KpiCard label="Avg Order Value" value={fmtShort(kpi.avgOrderValue || 0)} sub="per order"                                  color="#059669" bg="#ecfdf5" />
          <KpiCard label="Top Performer"   value={kpi.topPerformer || '—'}          sub={fmtShort(kpi.topPerformerSales || 0)}       color="#7c3aed" bg="#f5f3ff" />
          <KpiCard label="Total GST"       value={fmtShort(kpi.totalGst || 0)}      sub="collected"                                  color="#d97706" bg="#fffbeb" />
        </div>
      )}

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>

        {/* Bar chart */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15, marginBottom: 16 }}>
            Sales by {groupBy === 'SALESMAN' ? 'Salesman' : groupBy === 'PRODUCT' ? 'Product' : 'Category'}
          </div>
          {isLoading ? <Skeleton active paragraph={{ rows: 5 }} /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={groups.slice(0, 10)} margin={{ top: 0, right: 0, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#64748b' }} width={60} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="totalSales" name="Sales" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15, marginBottom: 16 }}>Share %</div>
          {isLoading ? <Skeleton active paragraph={{ rows: 5 }} /> : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={groups.slice(0, 8)} dataKey="totalSales" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                    {groups.slice(0, 8).map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmtShort(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                {groups.slice(0, 5).map((g: any, i: number) => (
                  <div key={g.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'inline-block' }} />
                      <span style={{ color: '#475569', fontWeight: 500 }}>{g.name}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{fmtShort(g.totalSales)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Daily trend */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15, marginBottom: 16 }}>Daily Sales Trend</div>
        {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend} margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#64748b' }} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="totalSales" name="Sales" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3, fill: '#2563eb' }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Data table */}
      {!isLoading && groups.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', background: '#f8fafc' }}>
            {['Name', 'Orders', 'Revenue', 'Avg Order'].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
            ))}
          </div>
          {groups.map((g: any, i: number) => (
            <div key={g.name} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '13px 20px', borderBottom: i < groups.length - 1 ? '1px solid #f1f5f9' : 'none', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: COLORS[i % COLORS.length] + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: COLORS[i % COLORS.length], fontSize: 13 }}>
                  {g.name?.[0]}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{g.name}</div>
                  {g.sub && <div style={{ fontSize: 11, color: '#94a3b8' }}>{g.sub}</div>}
                </div>
              </div>
              <div style={{ fontWeight: 600, color: '#475569' }}>{g.orderCount || g.qtySold || 0}</div>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 14 }}>{fmt(g.totalSales)}</div>
              <div style={{ color: '#64748b' }}>{g.orderCount ? fmtShort((g.totalSales || 0) / g.orderCount) : '—'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SalesAnalysisPage;
