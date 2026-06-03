import React, { useState } from 'react';
import { Input, Skeleton, Button, Grid } from 'antd';
import { SearchOutlined, WarningOutlined, ExclamationCircleOutlined, FileExcelOutlined } from '@ant-design/icons';
import { exportToXLSX } from '../../components/TableToolbar';
import { useGetAgingReportQuery } from '../../store/api/reportApi';

const fmt = (v: number) => v > 0 ? `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';

const BUCKETS = [
  { key: 'bucket0to30',  label: '0–30 Days',  color: '#059669', bg: '#ecfdf5' },
  { key: 'bucket31to60', label: '31–60 Days', color: '#d97706', bg: '#fffbeb' },
  { key: 'bucket61to90', label: '61–90 Days', color: '#ea580c', bg: '#fff7ed' },
  { key: 'bucket90plus', label: '>90 Days',   color: '#dc2626', bg: '#fef2f2' },
];

const AgingReportPage: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'totalOutstanding', dir: 'desc' });

  const { data, isLoading } = useGetAgingReportQuery();
  const rows: any[] = data?.data?.rows || [];
  const summary: any = data?.data?.summary || {};

  const filtered = rows
    .filter(r => !search || r.businessName?.toLowerCase().includes(search.toLowerCase()) || r.phone?.includes(search))
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
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>Outstanding balances bucketed by overdue period</div>
      </div>

      {/* Summary cards */}
      {isLoading ? <Skeleton active paragraph={{ rows: 2 }} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: 12 }}>
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
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Search customer name or phone..."
          value={search} onChange={e => setSearch(e.target.value)}
          allowClear style={{ borderRadius: 10, maxWidth: 380 }}
        />
        <Button
          icon={<FileExcelOutlined />}
          disabled={filtered.length === 0}
          onClick={() => exportToXLSX(
            filtered.map((r: any) => ({
              customer: r.businessName,
              phone: r.phone,
              total: r.totalOutstanding,
              d0_30:  r.bucket0to30,
              d31_60: r.bucket31to60,
              d61_90: r.bucket61to90,
              d90p:   r.bucket90plus,
            })),
            [
              { title: 'Customer',    key: 'customer', dataIndex: 'customer' },
              { title: 'Phone',       key: 'phone',    dataIndex: 'phone' },
              { title: 'Total',       key: 'total',    dataIndex: 'total' },
              { title: '0-30 Days',   key: 'd0_30',    dataIndex: 'd0_30' },
              { title: '31-60 Days',  key: 'd31_60',   dataIndex: 'd31_60' },
              { title: '61-90 Days',  key: 'd61_90',   dataIndex: 'd61_90' },
              { title: '>90 Days',    key: 'd90p',     dataIndex: 'd90p' },
            ],
            `aging-report-${new Date().toISOString().split('T')[0]}`
          )}
          style={{ borderRadius: 8 }}
        >
          Export Excel
        </Button>
      </div>

      {/* Table */}
      {isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflowX: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 20px', minWidth: 560 }}>
            {[
              { label: 'Customer', key: 'businessName' },
              { label: 'Total Outstanding', key: 'totalOutstanding' },
              { label: '0–30 Days', key: 'bucket0to30' },
              { label: '31–60 Days', key: 'bucket31to60' },
              { label: '61–90 Days', key: 'bucket61to90' },
              { label: '>90 Days', key: 'bucket90plus' },
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
              const isHighRisk = Number(row.bucket90plus || 0) > 0;
              const isMedRisk  = !isHighRisk && Number(row.bucket61to90 || 0) > 0;
              return (
                <div key={row.customerId} style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
                  padding: '14px 20px', alignItems: 'center', minWidth: 560,
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
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', padding: '14px 20px', borderTop: '2px solid #e2e8f0', background: '#f8fafc', minWidth: 560 }}>
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
