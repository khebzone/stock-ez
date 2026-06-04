import React, { useState } from 'react';
import { Table, Tag, Skeleton, Input, Button, Tooltip, Space } from 'antd';
import { InboxOutlined, WarningOutlined, SearchOutlined, RollbackOutlined, DeleteOutlined } from '@ant-design/icons';
import { useGetAllBatchesQuery } from '../../store/api/purchaseApi';
import ReturnToSupplierModal from '../../components/ReturnToSupplierModal';
import WriteOffModal from '../../components/WriteOffModal';

const STATUS_TABS = [
  { key: 'active',      label: 'Active' },
  { key: 'near-expiry', label: 'Near Expiry' },
  { key: 'expired',     label: 'Expired' },
];

const fmt = (v: any) => v != null ? `₹${Number(v).toFixed(2)}` : '—';

const ExpiryTag: React.FC<{ batch: any }> = ({ batch }) => {
  if (!batch.expiryDate) return <span style={{ color: '#94a3b8' }}>—</span>;
  if (batch.expired)    return <Tag color="error">Expired</Tag>;
  if (batch.nearExpiry) return <Tag color="warning">Near Expiry</Tag>;
  return <Tag color="success">OK</Tag>;
};

const StockBatchesPage: React.FC = () => {
  const [status, setStatus] = useState('active');
  const [page, setPage]     = useState(0);
  const [search, setSearch] = useState('');
  const [returnBatch, setReturnBatch] = useState<any>(null);
  const [writeOffBatch, setWriteOffBatch] = useState<any>(null);

  const { data, isLoading } = useGetAllBatchesQuery({ status, page, size: 50 });
  const batches: any[] = data?.data?.content || [];
  const totalElements: number = data?.data?.totalElements || 0;

  const filtered = search.trim()
    ? batches.filter(b => b.product?.name?.toLowerCase().includes(search.toLowerCase()))
    : batches;

  const columns = [
    {
      title: 'Product',
      dataIndex: ['product', 'name'],
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{r.product?.name}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.product?.brand} · {r.product?.unit}</div>
        </div>
      ),
    },
    {
      title: 'Batch No.',
      dataIndex: 'batchNumber',
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#374151' }}>{v}</span>,
    },
    {
      title: 'Supplier',
      dataIndex: 'supplierName',
      render: (v: string) => <span style={{ fontSize: 12, color: '#374151' }}>{v || '—'}</span>,
    },
    {
      title: 'Qty Available',
      dataIndex: 'quantityAvailable',
      align: 'right' as const,
      render: (v: number, r: any) => (
        <span style={{ fontWeight: 700, color: v === 0 ? '#dc2626' : v <= 10 ? '#d97706' : '#059669' }}>
          {v} {r.product?.unit}
        </span>
      ),
    },
    {
      title: 'MRP',
      dataIndex: 'mrp',
      align: 'right' as const,
      render: (v: any) => <span style={{ fontSize: 13 }}>{fmt(v)}</span>,
    },
    {
      title: 'Purch. Rate',
      dataIndex: 'purchaseRate',
      align: 'right' as const,
      render: (v: any) => <span style={{ fontSize: 13 }}>{fmt(v)}</span>,
    },
    {
      title: 'Min Sale',
      dataIndex: 'minSaleRate',
      align: 'right' as const,
      render: (v: any) => <span style={{ fontSize: 13, color: '#059669' }}>{fmt(v)}</span>,
    },
    {
      title: 'Max Sale',
      dataIndex: 'maxSaleRate',
      align: 'right' as const,
      render: (v: any) => <span style={{ fontSize: 13, color: '#374151' }}>{fmt(v)}</span>,
    },
    {
      title: 'Expiry',
      dataIndex: 'expiryDate',
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontSize: 12, color: r.expired ? '#dc2626' : r.nearExpiry ? '#d97706' : '#374151', fontWeight: r.expired || r.nearExpiry ? 600 : 400 }}>
            {r.expiryDate || '—'}
          </div>
          <ExpiryTag batch={r} />
        </div>
      ),
    },
    {
      title: 'Received',
      dataIndex: 'receivedDate',
      render: (v: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{v || '—'}</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      align: 'center' as const,
      render: (_: any, r: any) => {
        if (r.quantityAvailable <= 0) return null;
        return (
          <Space size={4}>
            {r.supplierName && (
              <Tooltip title="Return to Supplier">
                <Button
                  type="text"
                  size="small"
                  icon={<RollbackOutlined style={{ color: '#1d4ed8' }} />}
                  onClick={() => setReturnBatch(r)}
                />
              </Tooltip>
            )}
            <Tooltip title="Write Off / Damage">
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined style={{ color: '#dc2626' }} />}
                onClick={() => setWriteOffBatch(r)}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>Stock Batches</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>All inventory batches with expiry and pricing</div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setStatus(t.key); setPage(0); }}
              style={{
                padding: '5px 14px', borderRadius: 8, border: '1px solid',
                borderColor: status === t.key ? '#059669' : '#e2e8f0',
                background: status === t.key ? '#ecfdf5' : '#fff',
                color: status === t.key ? '#059669' : '#64748b',
                fontWeight: status === t.key ? 700 : 500, fontSize: 13, cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Search product..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 150 }}
          allowClear
        />
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 24 }}><Skeleton active paragraph={{ rows: 6 }} /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <InboxOutlined style={{ fontSize: 32, color: '#cbd5e1' }} />
            <div style={{ fontWeight: 600, color: '#64748b', marginTop: 12 }}>No batches found</div>
          </div>
        ) : (
          <Table
            dataSource={filtered}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={{
              current: page + 1,
              pageSize: 50,
              total: totalElements,
              onChange: p => setPage(p - 1),
              showTotal: (total) => `${total} batches`,
            }}
            rowClassName={(r) => r.expired ? 'batch-expired' : r.nearExpiry ? 'batch-near' : ''}
          />
        )}
      </div>

      {returnBatch && (
        <ReturnToSupplierModal
          batch={returnBatch}
          open={!!returnBatch}
          onClose={() => setReturnBatch(null)}
        />
      )}

      {writeOffBatch && (
        <WriteOffModal
          batch={writeOffBatch}
          open={!!writeOffBatch}
          onClose={() => setWriteOffBatch(null)}
        />
      )}

    </div>
  );
};

export default StockBatchesPage;
