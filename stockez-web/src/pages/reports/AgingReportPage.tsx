import React, { useState } from 'react';
import { Input, Skeleton, Button, Grid, DatePicker, Select } from 'antd';
import { SearchOutlined, WarningOutlined, ExclamationCircleOutlined, FileExcelOutlined } from '@ant-design/icons';
import { exportToXLSX } from '../../components/TableToolbar';
import { useGetAgingReportQuery } from '../../store/api/reportApi';
import dayjs, { Dayjs } from 'dayjs';

const fmt = (v: number) => v > 0 ? `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';

const BUCKETS = [
  { key: 'bucket0to7',   label: '0–7 Days',   color: '#059669', bg: '#ecfdf5' },
  { key: 'bucket8to15',  label: '8–15 Days',  color: '#16a34a', bg: '#f0fdf4' },
  { key: 'bucket16to30', label: '16–30 Days', color: '#ca8a04', bg: '#fefce8' },
  { key: 'bucket31to45', label: '31–45 Days', color: '#d97706', bg: '#fffbeb' },
  { key: 'bucket46to60', label: '46–60 Days', color: '#ea580c', bg: '#fff7ed' },
  { key: 'bucket60plus', label: '>60 Days',   color: '#dc2626', bg: '#fef2f2' },
];

const AgingReportPage: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'totalOutstanding', dir: 'desc' });
  const [asOfDate, setAsOfDate] = useState<Dayjs>(dayjs());
  const [bucketFilter, setBucketFilter] = useState<string | null>(null);

  const { data, isLoading } = useGetAgingReportQuery(asOfDate.format('YYYY-MM-DD'));
  const rows: any[] = data?.data?.rows || [];
  const summary: any = data?.data?.summary || {};

  const filtered = rows
    .filter(r => !search || r.businessName?.toLowerCase().includes(search.toLowerCase()) || r.phone?.includes(search))
    .filter(r => !bucketFilter || Number(r[bucketFilter] || 0) > 0)
    .sort((a, b) => {
      const va = Number(a[sort.key] || 0), vb = Number(b[sort.key] || 0);
      return sort.dir === 'desc' ? vb - va : va - vb;
    });

  const toggleSort = (key: string) => setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));
  const SortIcon = ({ k }: { k: string }) => <span style={{ marginLeft: 4, color: sort.key === k ? '#2563eb' : '#cbd5e1', fontSize: 10 }}>{sort.key === k && sort.dir === 'asc' ? '▲' : '▼'}</span>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>Aging Report</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>
          Outstanding balances bucketed by overdue period &nbsp;·&nbsp; As of {asOfDate.format('DD MMM YYYY')}
        </div>
      </div>

      {/* Summary cards */}
      {isLoading ? <Skeleton active paragraph={{ rows: 2 }} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(7, 1fr)', gap: 12 }}>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>Total Outstanding</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginTop: 6 }}>₹{Number(summary.totalOutstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{summary.customerCount || 0} customers</div>
          </div>
          {BUCKETS.map(b => (
            <div key={b.key} style={{ background: b.bg, borderRadius: 14, border: `1px solid ${b.color}30`, padding: '16px 18px' }}>
              <div style={{ fontSize: 11, color: b.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>{b.label}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: b.color, marginTop: 6 }}>₹{Number(summary[b.key] || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                {summary.totalOutstanding > 0 ? Math.round((summary[b.key] / summary.totalOutstanding) * 100) : 0}% of total
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search + Export */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Search customer name or phone..."
          value={search} onChange={e => setSearch(e.target.value)}
          allowClear style={{ borderRadius: 10, maxWidth: 380 }}
        />
        <DatePicker
          value={asOfDate}
          onChange={(d) => d && setAsOfDate(d)}
          format="DD MMM YYYY"
          allowClear={false}
          style={{ borderRadius: 8 }}
          disabledDate={(d) => d.isAfter(dayjs())}
        />
        <Select
          value={bucketFilter}
          onChange={setBucketFilter}
          allowClear
          placeholder="All ranges"
          style={{ width: 160, borderRadius: 8 }}
          options={[
            { label: '0–7 Days',   value: 'bucket0to7' },
            { label: '8–15 Days',  value: 'bucket8to15' },
            { label: '16–30 Days', value: 'bucket16to30' },
            { label: '31–45 Days', value: 'bucket31to45' },
            { label: '46–60 Days', value: 'bucket46to60' },
            { label: '>60 Days',   value: 'bucket60plus' },
          ]}
        />
        <Button
          icon={<FileExcelOutlined />}
          disabled={filtered.length === 0}
          onClick={() => {
            const activeBucket = BUCKETS.find(b => b.key === bucketFilter);
            const bucketCols = activeBucket
              ? [{ title: activeBucket.label, key: 'bucketAmt', dataIndex: 'bucketAmt' }]
              : [
                  { title: '0-7 Days',   key: 'd0_7',   dataIndex: 'd0_7' },
                  { title: '8-15 Days',  key: 'd8_15',  dataIndex: 'd8_15' },
                  { title: '16-30 Days', key: 'd16_30', dataIndex: 'd16_30' },
                  { title: '31-45 Days', key: 'd31_45', dataIndex: 'd31_45' },
                  { title: '46-60 Days', key: 'd46_60', dataIndex: 'd46_60' },
                  { title: '>60 Days',   key: 'd60p',   dataIndex: 'd60p' },
                ];
            exportToXLSX(
              filtered.map((r: any) => ({
                customer:  r.businessName,
                phone:     r.phone,
                total:     r.totalOutstanding,
                ...(activeBucket
                  ? { bucketAmt: r[activeBucket.key] }
                  : { d0_7: r.bucket0to7, d8_15: r.bucket8to15, d16_30: r.bucket16to30, d31_45: r.bucket31to45, d46_60: r.bucket46to60, d60p: r.bucket60plus }),
              })),
              [
                { title: 'Customer', key: 'customer', dataIndex: 'customer' },
                { title: 'Phone',    key: 'phone',    dataIndex: 'phone' },
                { title: 'Total',    key: 'total',    dataIndex: 'total' },
                ...bucketCols,
              ],
              `aging-report-${activeBucket ? activeBucket.label.replace(/[^a-z0-9]/gi, '-').toLowerCase() : 'all'}-${asOfDate.format('YYYY-MM-DD')}`
            );
          }}
          style={{ borderRadius: 8 }}
        >
          Export Excel
        </Button>
      </div>

      {/* Table */}
      {isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflowX: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 20px', minWidth: 820 }}>
            {[
              { label: 'Customer', key: 'businessName' },
              { label: 'Total Outstanding', key: 'totalOutstanding' },
              { label: '0–7 Days', key: 'bucket0to7' },
              { label: '8–15 Days', key: 'bucket8to15' },
              { label: '16–30 Days', key: 'bucket16to30' },
              { label: '31–45 Days', key: 'bucket31to45' },
              { label: '46–60 Days', key: 'bucket46to60' },
              { label: '>60 Days', key: 'bucket60plus' },
            ].map(col => (
              <div key={col.key} onClick={() => toggleSort(col.key)} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, cursor: 'pointer', userSelect: 'none' }}>
                {col.label}<SortIcon k={col.key} />
              </div>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>
              {search ? 'No customers match your search' : 'No outstanding balances'}
            </div>
          ) : (
            filtered.map((row: any, i: number) => {
              const isHighRisk = Number(row.bucket60plus || 0) > 0;
              const isMedRisk  = !isHighRisk && Number(row.bucket46to60 || 0) > 0;
              return (
                <div key={row.customerId} style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr',
                  padding: '14px 20px', alignItems: 'center', minWidth: 820,
                  borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none',
                  background: isHighRisk ? '#fff5f5' : isMedRisk ? '#fffbf0' : '#fff',
                  transition: 'background 0.15s',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isHighRisk && <ExclamationCircleOutlined style={{ color: '#dc2626', fontSize: 13 }} />}
                      {isMedRisk  && <WarningOutlined style={{ color: '#d97706', fontSize: 13 }} />}
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{row.businessName}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{row.phone}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 15 }}>{fmt(row.totalOutstanding)}</div>
                  {BUCKETS.map(b => (
                    <div key={b.key} style={{ fontWeight: Number(row[b.key]) > 0 ? 700 : 400, color: Number(row[b.key]) > 0 ? b.color : '#94a3b8', fontSize: 14 }}>
                      {fmt(row[b.key])}
                    </div>
                  ))}
                </div>
              );
            })
          )}

          {/* Footer totals */}
          {filtered.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr', padding: '14px 20px', borderTop: '2px solid #e2e8f0', background: '#f8fafc', minWidth: 820 }}>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>Total ({filtered.length} customers)</div>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 15 }}>
                ₹{filtered.reduce((s, r) => s + Number(r.totalOutstanding || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              {BUCKETS.map(b => (
                <div key={b.key} style={{ fontWeight: 700, color: b.color, fontSize: 14 }}>
                  ₹{filtered.reduce((s, r) => s + Number(r[b.key] || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgingReportPage;
