import React, { useState, useMemo } from 'react';
import { Button, Select, Table, Skeleton, InputNumber, Tabs } from 'antd';
import { FileExcelOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetDeadStockQuery, useGetSalesmanDeadStockQuery } from '../../store/api/reportApi';
import PageHeader from '../../components/PageHeader';
import { exportToXLSX } from '../../components/TableToolbar';

const daysIdleRender = (v: number) => {
  if (v >= 9999) return <span style={{ fontWeight: 700, color: '#dc2626' }}>—</span>;
  const color = v > 60 ? '#dc2626' : v > 30 ? '#d97706' : '#64748b';
  return <span style={{ fontWeight: 700, color }}>{v}d</span>;
};

const lastBilledRender = (v: string) => v
  ? <span style={{ fontSize: 12, color: '#475569' }}>{dayjs(v).format('DD MMM YYYY')}</span>
  : <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>Never billed</span>;

// ── By Product tab ────────────────────────────────────────────────────────────

const ByProductTab: React.FC<{ days: number }> = ({ days }) => {
  const [brandFilter, setBrandFilter] = useState<string | undefined>();
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();

  const { data, isLoading, refetch } = useGetDeadStockQuery({ days });
  const items: any[] = data?.data || [];

  const brands = useMemo(() => [...new Set(items.map((i: any) => i.brand).filter(Boolean))].sort() as string[], [items]);
  const categories = useMemo(() => [...new Set(items.map((i: any) => i.category).filter(Boolean))].sort() as string[], [items]);

  const filtered = items.filter((i: any) => {
    if (brandFilter && i.brand !== brandFilter) return false;
    if (categoryFilter && i.category !== categoryFilter) return false;
    return true;
  });

  const neverBilled = filtered.filter((i: any) => !i.lastBilledDate).length;
  const withStock = filtered.filter((i: any) => i.stockQty > 0).length;

  const columns = [
    {
      title: 'Product',
      key: 'product',
      render: (_: any, r: any) => (
        <span style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{r.productName}</span>
      ),
    },
    {
      title: 'Brand',
      dataIndex: 'brand',
      key: 'brand',
      render: (v: string) => <span style={{ fontSize: 12, color: '#475569' }}>{v || '—'}</span>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (v: string) => <span style={{ fontSize: 12, color: '#475569' }}>{v || '—'}</span>,
    },
    {
      title: 'Stock Qty',
      dataIndex: 'stockQty',
      key: 'stockQty',
      align: 'right' as const,
      sorter: (a: any, b: any) => b.stockQty - a.stockQty,
      render: (v: number, r: any) => (
        <span style={{ fontWeight: 700, color: v === 0 ? '#dc2626' : '#0f172a' }}>
          {v} {r.unit}
        </span>
      ),
    },
    {
      title: 'Last Billed',
      dataIndex: 'lastBilledDate',
      key: 'lastBilledDate',
      render: lastBilledRender,
    },
    {
      title: 'Days Idle',
      dataIndex: 'daysIdle',
      key: 'daysIdle',
      align: 'right' as const,
      defaultSortOrder: 'descend' as const,
      sorter: (a: any, b: any) => b.daysIdle - a.daysIdle,
      render: daysIdleRender,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Select
            placeholder="All Brands"
            allowClear
            value={brandFilter}
            onChange={setBrandFilter}
            style={{ width: 160 }}
            options={brands.map(b => ({ label: b, value: b }))}
          />
          <Select
            placeholder="All Categories"
            allowClear
            value={categoryFilter}
            onChange={setCategoryFilter}
            style={{ width: 180 }}
            options={categories.map(c => ({ label: c, value: c }))}
          />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button onClick={() => refetch()} style={{ height: 36 }}>Refresh</Button>
          <Button
            type="primary"
            icon={<FileExcelOutlined />}
            disabled={filtered.length === 0}
            onClick={() => exportToXLSX(
              filtered.map((i: any) => ({
                product: i.productName,
                brand: i.brand || '',
                category: i.category || '',
                unit: i.unit || '',
                stockQty: i.stockQty,
                lastBilledDate: i.lastBilledDate ? dayjs(i.lastBilledDate).format('DD MMM YYYY') : 'Never',
                daysIdle: i.daysIdle >= 9999 ? '—' : `${i.daysIdle}d`,
              })),
              [
                { title: 'Product', key: 'product', dataIndex: 'product' },
                { title: 'Brand', key: 'brand', dataIndex: 'brand' },
                { title: 'Category', key: 'category', dataIndex: 'category' },
                { title: 'Unit', key: 'unit', dataIndex: 'unit' },
                { title: 'Stock Qty', key: 'stockQty', dataIndex: 'stockQty' },
                { title: 'Last Billed', key: 'lastBilledDate', dataIndex: 'lastBilledDate' },
                { title: 'Days Idle', key: 'daysIdle', dataIndex: 'daysIdle' },
              ],
              `dead-stock-by-product-${days}days-${dayjs().format('YYYY-MM-DD')}`
            )}
            style={{ height: 36, fontWeight: 700, background: '#059669' }}
          >
            Export
          </Button>
        </div>
      </div>

      {!isLoading && filtered.length > 0 && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Dead Stock Products', value: `${filtered.length}`, color: '#dc2626' },
            { label: 'Never Billed', value: `${neverBilled}`, color: '#d97706' },
            { label: 'Have Stock', value: `${withStock}`, color: '#0f172a' },
          ].map(stat => (
            <div key={stat.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>{stat.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="productId"
          pagination={{ pageSize: 50, showSizeChanger: false, showTotal: (total) => `${total} products` }}
          size="middle"
          locale={{ emptyText: `No products idle for ${days}+ days` }}
          style={{ background: '#fff', borderRadius: 12, overflow: 'hidden' }}
        />
      )}
    </div>
  );
};

// ── By Salesman tab ───────────────────────────────────────────────────────────

const BySalesmanTab: React.FC<{ days: number }> = ({ days }) => {
  const [salesPersonId, setSalesPersonId] = useState<string | undefined>();

  const { data, isLoading, refetch } = useGetSalesmanDeadStockQuery({ days, salesPersonId });
  const items: any[] = data?.data || [];

  const salesmen = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((i: any) => map.set(i.salesPersonId, i.salesPersonName));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const columns = [
    {
      title: 'Salesman',
      dataIndex: 'salesPersonName',
      key: 'salesPersonName',
      render: (v: string) => <span style={{ fontWeight: 600, color: '#0f172a' }}>{v}</span>,
    },
    {
      title: 'Product',
      dataIndex: 'productName',
      key: 'productName',
      render: (v: string) => <span style={{ fontSize: 13, color: '#0f172a' }}>{v}</span>,
    },
    {
      title: 'Brand',
      dataIndex: 'brand',
      key: 'brand',
      render: (v: string) => <span style={{ fontSize: 12, color: '#475569' }}>{v || '—'}</span>,
    },
    {
      title: 'Stock Qty',
      dataIndex: 'stockQty',
      key: 'stockQty',
      align: 'right' as const,
      render: (v: number, r: any) => (
        <span style={{ fontWeight: 700 }}>{v} {r.unit}</span>
      ),
    },
    {
      title: 'Last Billed by Them',
      dataIndex: 'lastBilledDate',
      key: 'lastBilledDate',
      render: lastBilledRender,
    },
    {
      title: 'Days Idle',
      dataIndex: 'daysIdle',
      key: 'daysIdle',
      align: 'right' as const,
      defaultSortOrder: 'descend' as const,
      sorter: (a: any, b: any) => b.daysIdle - a.daysIdle,
      render: daysIdleRender,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Select
          placeholder="All Salesmen"
          allowClear
          value={salesPersonId}
          onChange={setSalesPersonId}
          style={{ width: 220 }}
          options={salesmen.map(([id, name]) => ({ label: name, value: id }))}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <Button onClick={() => refetch()} style={{ height: 36 }}>Refresh</Button>
          <Button
            type="primary"
            icon={<FileExcelOutlined />}
            disabled={items.length === 0}
            onClick={() => exportToXLSX(
              items.map((i: any) => ({
                salesman: i.salesPersonName,
                product: i.productName,
                brand: i.brand || '',
                unit: i.unit || '',
                stockQty: i.stockQty,
                lastBilledDate: i.lastBilledDate ? dayjs(i.lastBilledDate).format('DD MMM YYYY') : 'Never',
                daysIdle: i.daysIdle >= 9999 ? '—' : `${i.daysIdle}d`,
              })),
              [
                { title: 'Salesman', key: 'salesman', dataIndex: 'salesman' },
                { title: 'Product', key: 'product', dataIndex: 'product' },
                { title: 'Brand', key: 'brand', dataIndex: 'brand' },
                { title: 'Unit', key: 'unit', dataIndex: 'unit' },
                { title: 'Stock Qty', key: 'stockQty', dataIndex: 'stockQty' },
                { title: 'Last Billed', key: 'lastBilledDate', dataIndex: 'lastBilledDate' },
                { title: 'Days Idle', key: 'daysIdle', dataIndex: 'daysIdle' },
              ],
              `dead-stock-by-salesman-${days}days-${dayjs().format('YYYY-MM-DD')}`
            )}
            style={{ height: 36, fontWeight: 700, background: '#059669' }}
          >
            Export
          </Button>
        </div>
      </div>

      {!isLoading && items.length > 0 && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {salesmen.map(([id, name]) => {
            const count = items.filter((i: any) => i.salesPersonId === id).length;
            return (
              <div
                key={id}
                onClick={() => setSalesPersonId(salesPersonId === id ? undefined : id)}
                style={{
                  background: salesPersonId === id ? '#fef2f2' : '#fff',
                  border: `1px solid ${salesPersonId === id ? '#fca5a5' : '#e2e8f0'}`,
                  borderRadius: 12,
                  padding: '10px 18px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>{name}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>{count}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>dead products</div>
              </div>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <Table
          dataSource={items}
          columns={columns}
          rowKey={(r) => `${r.salesPersonId}-${r.productId}`}
          pagination={{ pageSize: 50, showSizeChanger: false, showTotal: (total) => `${total} rows` }}
          size="middle"
          locale={{ emptyText: `No products idle for ${days}+ days` }}
          style={{ background: '#fff', borderRadius: 12, overflow: 'hidden' }}
        />
      )}
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

const DeadStockPage: React.FC = () => {
  const [days, setDays] = useState(30);
  const [inputDays, setInputDays] = useState<number | null>(30);
  const applyDays = () => { if (inputDays && inputDays >= 1) setDays(inputDays); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Dead Stock Report"
        subtitle="Products not billed for a configurable number of days"
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Not billed in:</span>
        <InputNumber
          min={1}
          max={365}
          value={inputDays}
          onChange={(v) => setInputDays(v)}
          onPressEnter={applyDays}
          onBlur={applyDays}
          addonAfter="days"
          style={{ width: 140 }}
        />
      </div>

      <Tabs
        defaultActiveKey="product"
        items={[
          {
            key: 'product',
            label: 'By Product',
            children: <ByProductTab days={days} />,
          },
          {
            key: 'salesman',
            label: 'By Salesman',
            children: <BySalesmanTab days={days} />,
          },
        ]}
      />
    </div>
  );
};

export default DeadStockPage;
