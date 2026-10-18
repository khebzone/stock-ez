import React, { useState, useMemo } from 'react';
import { Row, Col, Select, Switch, Button, Table, InputNumber, Space, Tag } from 'antd';
import { ReloadOutlined, DownloadOutlined, LockOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetClosingStockQuery } from '../../store/api/reportApi';
import PageHeader from '../../components/PageHeader';
import { exportToXLSX, type Column } from '../../components/TableToolbar';
import { hasPlan, PLAN_META } from '../../utils/planGate';

const fmt = (v: number) => `₹${(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const MetricTile: React.FC<{ label: string; value: string; color: string; bg: string }> = ({ label, value, color, bg }) => (
  <div style={{ background: bg, borderRadius: 10, padding: '16px 20px', border: `1px solid ${color}20` }}>
    <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: 500 }}>{label}</div>
  </div>
);

const GstHeader: React.FC<{ main: string; sub: string }> = ({ main, sub }) => (
  <div style={{ lineHeight: 1.2 }}>
    <div>{main}</div>
    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'none', letterSpacing: 0 }}>{sub}</div>
  </div>
);

const StockValueTile: React.FC<{ excl: string; incl: string; color: string; bg: string }> = ({ excl, incl, color, bg }) => (
  <div style={{ background: bg, borderRadius: 10, padding: '16px 20px', border: `1px solid ${color}20`, display: 'flex', gap: 16 }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{excl}</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: 500 }}>Stock Value (excl GST)</div>
    </div>
    <div style={{ flex: 1, minWidth: 0, paddingLeft: 16, borderLeft: `1px solid ${color}30` }}>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{incl}</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: 500 }}>Stock Value (incl GST)</div>
    </div>
  </div>
);

const ClosingStockPage: React.FC = () => {
  const [showOutOfStock, setShowOutOfStock] = useState(false);
  const [showLowStock, setShowLowStock]    = useState(false);
  const [filterBrand, setFilterBrand]      = useState<string | undefined>();
  const [filterCat, setFilterCat]          = useState<string | undefined>();
  const [lowThreshold, setLowThreshold]    = useState<number | null>(null);

  const effectiveThreshold = lowThreshold ?? 20;

  const handleOutOfStockToggle = (val: boolean) => {
    setShowOutOfStock(val);
    if (val) {
      setShowLowStock(false);
      setLowThreshold(null);
    }
  };

  const { data, isLoading, refetch } = useGetClosingStockQuery();
  const report = data?.data;
  const allRows: any[] = report?.rows || [];

  const uniqueBrands = useMemo(() =>
    Array.from(new Set(allRows.map((r: any) => r.brand).filter(Boolean))).sort() as string[],
  [allRows]);

  const uniqueCategories = useMemo(() =>
    Array.from(new Set(allRows.map((r: any) => r.category).filter(Boolean))).sort() as string[],
  [allRows]);

  const rows = useMemo(() =>
    allRows.filter((r: any) => {
      if (showOutOfStock && r.stockQty !== 0) return false;
      if (!showOutOfStock && showLowStock && !(r.stockQty > 0 && r.stockQty <= effectiveThreshold)) return false;
      if (filterBrand && r.brand !== filterBrand) return false;
      if (filterCat && r.category !== filterCat) return false;
      return true;
    }),
  [allRows, showOutOfStock, showLowStock, filterBrand, filterCat, effectiveThreshold]);

  const computedLowCount = useMemo(() =>
    allRows.filter((r: any) => r.stockQty > 0 && r.stockQty <= effectiveThreshold).length,
  [allRows, effectiveThreshold]);

  const exportCols: Column[] = [
    { title: 'Brand',           key: 'brand',               dataIndex: 'brand' },
    { title: 'Product',         key: 'productName',         dataIndex: 'productName' },
    { title: 'Category',        key: 'category',            dataIndex: 'category',
      transform: (_v: any, r: any) => (r.category ? `${r.category}${r.subCategory ? ` / ${r.subCategory}` : ''}` : '-') },
    { title: 'Unit',            key: 'unit',                dataIndex: 'unit' },
    { title: 'HSN',             key: 'hsnCode',             dataIndex: 'hsnCode',             type: 'text' },
    { title: 'Stock Qty',       key: 'stockQty',            dataIndex: 'stockQty',            type: 'number' },
    { title: 'Rate (excl GST)', key: 'purchaseRateExclGst', dataIndex: 'purchaseRateExclGst', type: 'currency' },
    { title: 'Stock Value (excl GST)', key: 'stockValue',   dataIndex: 'stockValue',          type: 'currency' },
    { title: 'Rate (incl GST)', key: 'purchaseRateInclGst', dataIndex: 'purchaseRateInclGst', type: 'currency' },
    { title: 'Stock Value (incl GST)', key: 'stockValueInclGst', dataIndex: 'stockValueInclGst', type: 'currency' },
    { title: 'Status',          key: 'status',
      transform: (_v: any, r: any) => (r.stockQty === 0 ? 'Out of stock' : r.stockQty <= effectiveThreshold ? 'Low stock' : 'In stock') },
  ];

  const exportRows = useMemo(() =>
    [...rows].sort((a: any, b: any) =>
      (a.brand || '~').localeCompare(b.brand || '~') || a.productName.localeCompare(b.productName)),
  [rows]);

  const exportSubtitle = [
    `As on ${dayjs().format('DD MMM YYYY')}`,
    filterBrand ? `Brand: ${filterBrand}` : null,
    filterCat ? `Category: ${filterCat}` : null,
    showOutOfStock ? 'Out of stock items only' : showLowStock ? `Low stock items only (up to ${effectiveThreshold})` : null,
  ].filter(Boolean).join('  |  ');

  const handleExport = () => exportToXLSX(
    exportRows, exportCols, `closing-stock-${dayjs().format('YYYY-MM-DD')}`, 'Closing Stock',
    { title: 'Closing Stock Report', subtitle: exportSubtitle, totals: true, totalKeys: ['stockQty', 'stockValue', 'stockValueInclGst'], groupBy: 'brand' },
  );

  if (!hasPlan('PROFESSIONAL')) {
    const meta = PLAN_META['PROFESSIONAL'];
    return (
      <div>
        <PageHeader title="Closing Stock" subtitle="Current stock position across all products" />
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <LockOutlined style={{ fontSize: 36, color: '#94a3b8', marginBottom: 16 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
            Closing Stock — {meta.label} Plan
          </div>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Upgrade to {meta.label} ({meta.price}) to access this.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Closing Stock" subtitle="Current stock position across all products" />

      {report && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} md={5}><MetricTile label="Total Products"    value={String(report.totalProducts)}   color="#059669" bg="#ecfdf5" /></Col>
          <Col xs={12} md={5}><MetricTile label="Out of Stock"      value={String(report.outOfStockCount)} color="#dc2626" bg="#fef2f2" /></Col>
          <Col xs={12} md={5}><MetricTile label={`Low Stock (≤${effectiveThreshold})`} value={String(computedLowCount)} color="#d97706" bg="#fffbeb" /></Col>
          <Col xs={24} md={9}><StockValueTile excl={fmt(report.totalStockValue)} incl={fmt(report.totalStockValueInclGst)} color="#8b5cf6" bg="#f5f3ff" /></Col>
        </Row>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Select placeholder="Brand" allowClear showSearch filterOption={(input, option) => (option?.label as string)?.toLowerCase().startsWith(input.toLowerCase())} size="small" style={{ width: 140 }}
            value={filterBrand} onChange={setFilterBrand}
            options={uniqueBrands.map(b => ({ value: b, label: b }))} />
          <Select placeholder="Category" allowClear showSearch filterOption={(input, option) => (option?.label as string)?.toLowerCase().startsWith(input.toLowerCase())} size="small" style={{ width: 150 }}
            value={filterCat} onChange={setFilterCat}
            options={uniqueCategories.map(c => ({ value: c, label: c }))} />
          <Space size={4}>
            <span style={{ fontSize: 12, color: '#64748b' }}>Low stock ≤</span>
            <InputNumber size="small" value={lowThreshold} onChange={setLowThreshold} style={{ width: 70 }} />
          </Space>
          <Switch checked={showOutOfStock} onChange={handleOutOfStockToggle} checkedChildren="Out of Stock" unCheckedChildren="Out of Stock" />
          <Switch checked={showLowStock} onChange={setShowLowStock} checkedChildren="Low Stock" unCheckedChildren="Low Stock" />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} size="small">Refresh</Button>
        </Space>
        <Button icon={<DownloadOutlined />} size="small" onClick={handleExport} disabled={!rows.length}>Export</Button>
      </div>

      <Table
        size="small"
        dataSource={rows}
        rowKey="productId"
        loading={isLoading}
        scroll={{ x: 1000 }}
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t) => `${t} products` }}
        locale={{ emptyText: <div style={{ padding: '24px 0', color: '#9ca3af' }}>No products found</div> }}
        rowClassName={(r: any) => r.stockQty === 0 ? 'row-out-of-stock' : r.stockQty <= effectiveThreshold ? 'row-low-stock' : ''}
        columns={[
          { title: 'Product', dataIndex: 'productName', key: 'name', minWidth: 220,
            sorter: (a: any, b: any) => a.productName.localeCompare(b.productName),
            render: (v: string, r: any) => (
              <div>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{v}</div>
                {r.hsnCode && <div style={{ fontSize: 11, color: '#94a3b8' }}>HSN: {r.hsnCode}</div>}
              </div>
            )},
          { title: 'Brand',    dataIndex: 'brand',    key: 'brand',    width: 110,
            sorter: (a: any, b: any) => (a.brand || '').localeCompare(b.brand || '') },
          { title: 'Category', dataIndex: 'category', key: 'cat',      width: 120,
            sorter: (a: any, b: any) => (a.category || '').localeCompare(b.category || ''),
            render: (v: string, r: any) => v
              ? <span>{v}{r.subCategory ? <span style={{ color: '#94a3b8' }}> / {r.subCategory}</span> : ''}</span>
              : '-' },
          { title: 'Unit',      dataIndex: 'unit',               key: 'unit',  width: 70 },
          { title: 'Stock Qty', dataIndex: 'stockQty',           key: 'qty',   width: 100, align: 'right' as const,
            sorter: (a: any, b: any) => a.stockQty - b.stockQty,
            render: (v: number) => {
              if (v === 0) return <Tag color="red">Out of Stock</Tag>;
              if (v <= effectiveThreshold) return <span style={{ color: '#d97706', fontWeight: 700 }}>{v}</span>;
              return <span style={{ fontWeight: 600 }}>{v}</span>;
            }},
          { title: <GstHeader main="Rate" sub="excl GST" />, dataIndex: 'purchaseRateExclGst', key: 'rate',  width: 100, align: 'right' as const,
            render: (v: number) => fmt(v) },
          { title: <GstHeader main="Stock Value" sub="excl GST" />, dataIndex: 'stockValue',   key: 'value', width: 120, align: 'right' as const,
            sorter: (a: any, b: any) => a.stockValue - b.stockValue,
            render: (v: number) => <strong>{fmt(v)}</strong> },
          { title: <GstHeader main="Rate" sub="incl GST" />, dataIndex: 'purchaseRateInclGst', key: 'rateIncl',  width: 100, align: 'right' as const,
            render: (v: number) => fmt(v) },
          { title: <GstHeader main="Stock Value" sub="incl GST" />, dataIndex: 'stockValueInclGst', key: 'valueIncl', width: 120, align: 'right' as const,
            sorter: (a: any, b: any) => a.stockValueInclGst - b.stockValueInclGst,
            render: (v: number) => <strong>{fmt(v)}</strong> },
        ]}
        summary={() => rows.length > 0 ? (
          <Table.Summary.Row style={{ background: '#f8fafc', fontWeight: 700 }}>
            <Table.Summary.Cell index={0} colSpan={4}>Total</Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right">
              <strong>{rows.reduce((s: number, r: any) => s + r.stockQty, 0)}</strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={2} />
            <Table.Summary.Cell index={3} align="right">
              <strong>{fmt(rows.reduce((s: number, r: any) => s + (r.stockValue || 0), 0))}</strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={4} />
            <Table.Summary.Cell index={5} align="right">
              <strong>{fmt(rows.reduce((s: number, r: any) => s + (r.stockValueInclGst || 0), 0))}</strong>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        ) : null}
      />
    </div>
  );
};

export default ClosingStockPage;
