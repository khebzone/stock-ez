import React, { useState, useEffect } from 'react';
import { Table, Skeleton, Input, Button, Tooltip, Space, Select } from 'antd';
import { InboxOutlined, SearchOutlined, RollbackOutlined, DeleteOutlined, DownloadOutlined, EditOutlined } from '@ant-design/icons';
import { exportToXLSX } from '../../components/TableToolbar';
import dayjs from 'dayjs';
import { useGetAllBatchesQuery } from '../../store/api/purchaseApi';
import { useGetMastersQuery } from '../../store/api/productMasterApi';
import { hasPermission } from '../../utils/permissions';
import ReturnToSupplierModal from '../../components/ReturnToSupplierModal';
import WriteOffModal from '../../components/WriteOffModal';
import EditBatchRatesModal from '../../components/EditBatchRatesModal';

const STATUS_TABS = [
  { key: 'active',      label: 'Active' },
  { key: 'near-expiry', label: 'Near Expiry' },
  { key: 'expired',     label: 'Expired' },
];

const fmt = (v: any) => v != null ? `₹${Number(v).toFixed(2)}` : '—';
const fmtDate = (v: any) => v ? dayjs(v).format('DD MMM YYYY') : '—';

const StockBatchesPage: React.FC = () => {
  const [status, setStatus]       = useState('active');
  const [page, setPage]           = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]       = useState('');
  const [brand, setBrand]         = useState<string | undefined>();
  const [returnBatch, setReturnBatch]   = useState<any>(null);
  const [writeOffBatch, setWriteOffBatch] = useState<any>(null);
  const [ratesBatch, setRatesBatch]       = useState<any>(null);

  // Debounce search — fires API call 400ms after user stops typing
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(0); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: brandsData } = useGetMastersQuery('BRAND');
  const brands: string[] = (brandsData?.data || []).map((b: any) => b.name).sort();

  const { data, isLoading } = useGetAllBatchesQuery({ status, brand, search: search || undefined, page, size: 50 });
  const batches: any[] = data?.data?.content || [];
  const totalElements: number = data?.data?.totalElements || 0;
  const filtered = batches;

  const exportToExcel = async () => {
    const label = status === 'active' ? 'Active' : status === 'near-expiry' ? 'NearExpiry' : 'Expired';
    await exportToXLSX(filtered, [
      { title: 'Product', key: 'product', dataIndex: ['product', 'name'] },
      { title: 'Brand', key: 'brand', dataIndex: ['product', 'brand'] },
      { title: 'Unit', key: 'unit', dataIndex: ['product', 'unit'] },
      { title: 'Batch No.', key: 'batchNumber' },
      { title: 'Supplier', key: 'supplierName' },
      { title: 'Qty Available', key: 'quantityAvailable', type: 'number' },
      { title: 'MRP', key: 'mrp', type: 'currency' },
      { title: 'Purchase Rate', key: 'purchaseRate', type: 'currency' },
      { title: 'Min Sale Rate', key: 'minSaleRate', type: 'currency' },
      { title: 'Max Sale Rate', key: 'maxSaleRate', type: 'currency' },
      { title: 'Expiry Date', key: 'expiryDate', type: 'date' },
      { title: 'Status', key: 'status', transform: (_: any, b: any) => (b.expired ? 'Expired' : b.nearExpiry ? 'Near Expiry' : 'OK') },
      { title: 'Received Date', key: 'receivedDate', type: 'date' },
    ], `StockBatches_${label}_${new Date().toISOString().slice(0, 10)}`, 'Stock Batches', {
      title: 'Stock Batches',
      subtitle: `${label} · ${filtered.length} batch${filtered.length === 1 ? '' : 'es'}`,
    });
  };

  const columns = [
    {
      title: 'Product',
      dataIndex: ['product', 'name'],
      width: 240,
      render: (_: any, r: any) => (
        <div>
          <Tooltip title={r.product?.name}>
            <div style={{
              fontWeight: 600, fontSize: 14, color: '#0f172a', lineHeight: 1.3,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {r.product?.name}
            </div>
          </Tooltip>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.product?.brand} · {r.product?.unit}</div>
        </div>
      ),
    },
    {
      title: 'Batch No.',
      dataIndex: 'batchNumber',
      width: 180,
      render: (_: any, r: any) => (
        <div>
          <div style={{ whiteSpace: 'nowrap', fontSize: 13, color: '#334155' }}>{r.batchNumber}</div>
          {/* Always rendered, even when blank — keeps every row the same height */}
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.supplierName || ' '}</div>
        </div>
      ),
    },
    {
      title: 'Qty Avail.',
      dataIndex: 'quantityAvailable',
      align: 'right' as const,
      width: 120,
      render: (v: number, r: any) => (
        <span style={{ fontSize: 13, fontWeight: 700, color: v === 0 ? '#dc2626' : v <= 10 ? '#d97706' : '#0f172a' }}>
          {v} {r.product?.unit}
        </span>
      ),
    },
    {
      title: 'MRP',
      dataIndex: 'mrp',
      align: 'right' as const,
      render: (v: any) => <span style={{ fontSize: 13, color: '#334155' }}>{fmt(v)}</span>,
    },
    {
      title: 'Purch. Rate',
      dataIndex: 'purchaseRate',
      align: 'right' as const,
      render: (v: any) => <span style={{ fontSize: 13, color: '#334155' }}>{fmt(v)}</span>,
    },
    {
      title: 'Min Sale',
      dataIndex: 'minSaleRate',
      align: 'right' as const,
      render: (v: any) => <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{fmt(v)}</span>,
    },
    {
      title: 'Max Sale',
      dataIndex: 'maxSaleRate',
      align: 'right' as const,
      render: (v: any) => <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{fmt(v)}</span>,
    },
    {
      title: 'Expiry',
      dataIndex: 'expiryDate',
      render: (_: any, r: any) => (
        <span style={{
          fontSize: 13,
          color: r.expired ? '#dc2626' : r.nearExpiry ? '#d97706' : '#374151',
          fontWeight: r.expired || r.nearExpiry ? 600 : 400,
        }}>
          {fmtDate(r.expiryDate)}
        </span>
      ),
    },
    {
      title: 'Received',
      dataIndex: 'receivedDate',
      render: (v: string) => <span style={{ fontSize: 13, color: '#94a3b8' }}>{fmtDate(v)}</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      align: 'center' as const,
      render: (_: any, r: any) => {
        const canEditRates = hasPermission('STOCK_ADJUSTMENT_CREATE');
        const hasStock = r.quantityAvailable > 0;
        const canReturn = hasStock && hasPermission('RETURNS_CREATE');
        const canWriteOff = hasStock && hasPermission('RETURNS_DAMAGE');
        if (!canEditRates && !canReturn && !canWriteOff) return null;
        return (
          <Space size={4}>
            {canEditRates && (
              <Tooltip title="Edit sale rates">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => setRatesBatch(r)}
                />
              </Tooltip>
            )}
            {canReturn && r.supplierName && (
              <Tooltip title="Return to Supplier">
                <Button
                  type="text"
                  size="small"
                  icon={<RollbackOutlined style={{ color: '#1d4ed8' }} />}
                  onClick={() => setReturnBatch(r)}
                />
              </Tooltip>
            )}
            {canWriteOff && (
              <Tooltip title="Write Off / Damage">
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined style={{ color: '#dc2626' }} />}
                  onClick={() => setWriteOffBatch(r)}
                />
              </Tooltip>
            )}
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
        <Button
          icon={<DownloadOutlined />}
          onClick={exportToExcel}
          disabled={filtered.length === 0}
        >
          Export Excel
        </Button>
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
        <Select
          placeholder="All Brands"
          allowClear
          value={brand}
          onChange={v => { setBrand(v); setPage(0); }}
          style={{ minWidth: 160 }}
          showSearch
          optionFilterProp="children"
        >
          {brands.map(b => <Select.Option key={b} value={b}>{b}</Select.Option>)}
        </Select>
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Search product..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
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
            virtual
            scroll={{ x: 1020, y: 550 }}
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

      <EditBatchRatesModal batch={ratesBatch} onClose={() => setRatesBatch(null)} />

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
