import React, { useState } from 'react';
import { Row, Col, Card, DatePicker, Button, Table, Tabs, Space } from 'antd';
import { DollarOutlined, ShoppingOutlined, ReloadOutlined, DownloadOutlined, RiseOutlined, TagsOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetSalesReportQuery, useGetCollectionReportQuery, useGetProfitReportQuery, useGetBrandProfitReportQuery } from '../../store/api/dashboardApi';
import PageHeader from '../../components/PageHeader';
import SalesTrendChart from '../../components/charts/SalesTrendChart';
import CollectionBarChart from '../../components/charts/CollectionBarChart';
import { exportToCSV } from '../../components/TableToolbar';

const { RangePicker } = DatePicker;

/* ── KPI metric tile ── */
const MetricTile: React.FC<{ label: string; value: string; color: string; bg: string }> = ({ label, value, color, bg }) => (
  <div style={{
    background: bg, borderRadius: 10, padding: '16px 20px',
    border: `1px solid ${color}20`,
  }}>
    <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: 500 }}>{label}</div>
  </div>
);

const fmt = (v: number) => `₹${(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

/* ── Sales Tab ── */
const SalesTab: React.FC = () => {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs()]);

  const { data, isLoading, refetch } = useGetSalesReportQuery({
    from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'),
  });
  const sales = data?.data;
  const breakdown = sales?.dailyBreakdown || [];

  const exportCols = [
    { title: 'Date', key: 'date', dataIndex: 'date' },
    { title: 'Orders', key: 'orderCount', dataIndex: 'orderCount' },
    { title: 'Sub Total', key: 'subTotal', dataIndex: 'subTotal' },
    { title: 'GST', key: 'totalGst', dataIndex: 'totalGst' },
    { title: 'Total', key: 'totalAmount', dataIndex: 'totalAmount' },
  ];

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <RangePicker value={range} onChange={(v) => v && setRange(v as any)} format="DD MMM YYYY" style={{ borderRadius: 8 }} />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} style={{ borderRadius: 8 }}>Refresh</Button>
        </Space>
        <Button icon={<DownloadOutlined />} onClick={() => exportToCSV(breakdown, exportCols, `sales-report-${range[0].format('YYYY-MM-DD')}`)}
          style={{ borderRadius: 8 }} disabled={!breakdown.length}>Export CSV</Button>
      </div>

      {/* KPI tiles */}
      {sales && (
        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
          <Col xs={12} md={6}><MetricTile label="Total Orders" value={String(sales.totalOrders || 0)} color="#059669" bg="#ecfdf5" /></Col>
          <Col xs={12} md={6}><MetricTile label="Total Revenue" value={fmt(sales.totalRevenue)} color="#10b981" bg="#ecfdf5" /></Col>
          <Col xs={12} md={6}><MetricTile label="Total GST" value={fmt(sales.totalGst)} color="#f59e0b" bg="#fffbeb" /></Col>
          <Col xs={12} md={6}><MetricTile label="Avg Order Value" value={fmt(sales.avgOrderValue)} color="#8b5cf6" bg="#f5f3ff" /></Col>
        </Row>
      )}

      {/* Line chart */}
      {breakdown.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 20 }}>
          <div className="chart-title">Revenue Trend</div>
          <div className="chart-sub">{range[0].format('DD MMM')} → {range[1].format('DD MMM YYYY')}</div>
          <SalesTrendChart data={breakdown} height={220} />
        </div>
      )}

      {/* Table */}
      <Table
        size="small"
        dataSource={breakdown}
        rowKey="date"
        loading={isLoading}
        pagination={false}
        locale={{ emptyText: <div style={{ padding: '24px 0', color: '#9ca3af' }}>No data for selected range</div> }}
        columns={[
          { title: 'Date', dataIndex: 'date', key: 'date', render: (d: string) => dayjs(d).format('DD MMM YYYY') },
          { title: 'Orders', dataIndex: 'orderCount', key: 'orders', width: 80, sorter: (a: any, b: any) => a.orderCount - b.orderCount },
          { title: 'Sub Total', dataIndex: 'subTotal', key: 'sub', render: (v: number) => fmt(v), sorter: (a: any, b: any) => a.subTotal - b.subTotal },
          { title: 'GST', dataIndex: 'totalGst', key: 'gst', render: (v: number) => fmt(v) },
          { title: 'Total', dataIndex: 'totalAmount', key: 'total', sorter: (a: any, b: any) => a.totalAmount - b.totalAmount,
            render: (v: number) => <strong style={{ color: '#059669' }}>{fmt(v)}</strong> },
        ]}
        summary={() => breakdown.length > 0 ? (
          <Table.Summary.Row style={{ background: '#f8fafc', fontWeight: 700 }}>
            <Table.Summary.Cell index={0}>Total</Table.Summary.Cell>
            <Table.Summary.Cell index={1}>{breakdown.reduce((s: number, r: any) => s + r.orderCount, 0)}</Table.Summary.Cell>
            <Table.Summary.Cell index={2}>{fmt(breakdown.reduce((s: number, r: any) => s + r.subTotal, 0))}</Table.Summary.Cell>
            <Table.Summary.Cell index={3}>{fmt(breakdown.reduce((s: number, r: any) => s + r.totalGst, 0))}</Table.Summary.Cell>
            <Table.Summary.Cell index={4}><span style={{ color: '#059669' }}>{fmt(breakdown.reduce((s: number, r: any) => s + r.totalAmount, 0))}</span></Table.Summary.Cell>
          </Table.Summary.Row>
        ) : null}
      />
    </div>
  );
};

/* ── Collections Tab ── */
const CollectionsTab: React.FC = () => {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs()]);

  const { data, isLoading, refetch } = useGetCollectionReportQuery({
    from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'),
  });
  const collections = data?.data;
  const breakdown = collections?.dailyBreakdown || [];

  const exportCols = [
    { title: 'Date', key: 'date', dataIndex: 'date' },
    { title: 'Payments', key: 'paymentCount', dataIndex: 'paymentCount' },
    { title: 'Cash', key: 'cashAmount', dataIndex: 'cashAmount' },
    { title: 'UPI', key: 'upiAmount', dataIndex: 'upiAmount' },
    { title: 'Bank', key: 'bankTransferAmount', dataIndex: 'bankTransferAmount' },
    { title: 'Total', key: 'totalAmount', dataIndex: 'totalAmount' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <RangePicker value={range} onChange={(v) => v && setRange(v as any)} format="DD MMM YYYY" style={{ borderRadius: 8 }} />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} style={{ borderRadius: 8 }}>Refresh</Button>
        </Space>
        <Button icon={<DownloadOutlined />} onClick={() => exportToCSV(breakdown, exportCols, `collection-report-${range[0].format('YYYY-MM-DD')}`)}
          style={{ borderRadius: 8 }} disabled={!breakdown.length}>Export CSV</Button>
      </div>

      {collections && (
        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
          <Col xs={12} md={6}><MetricTile label="Total Collected" value={fmt(collections.totalCollected)} color="#10b981" bg="#ecfdf5" /></Col>
          <Col xs={12} md={6}><MetricTile label="Cash" value={fmt(collections.totalCash)} color="#059669" bg="#ecfdf5" /></Col>
          <Col xs={12} md={6}><MetricTile label="Digital" value={fmt(collections.totalDigital)} color="#8b5cf6" bg="#f5f3ff" /></Col>
          <Col xs={12} md={6}><MetricTile label="Uncleared" value={fmt(collections.totalUncleared)} color="#f59e0b" bg="#fffbeb" /></Col>
        </Row>
      )}

      {/* Stacked bar chart */}
      {breakdown.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 20 }}>
          <div className="chart-title">Collection by Mode</div>
          <div className="chart-sub">Cash vs UPI vs Bank Transfer breakdown</div>
          <CollectionBarChart data={breakdown} height={220} />
        </div>
      )}

      <Table
        size="small" dataSource={breakdown} rowKey="date" loading={isLoading} pagination={false}
        locale={{ emptyText: <div style={{ padding: '24px 0', color: '#9ca3af' }}>No data for selected range</div> }}
        columns={[
          { title: 'Date', dataIndex: 'date', key: 'date', render: (d: string) => dayjs(d).format('DD MMM YYYY') },
          { title: 'Payments', dataIndex: 'paymentCount', key: 'count', width: 90 },
          { title: 'Cash', dataIndex: 'cashAmount', key: 'cash', render: (v: number) => fmt(v) },
          { title: 'UPI', dataIndex: 'upiAmount', key: 'upi', render: (v: number) => fmt(v) },
          { title: 'Bank', dataIndex: 'bankTransferAmount', key: 'bank', render: (v: number) => fmt(v) },
          { title: 'Total', dataIndex: 'totalAmount', key: 'total', sorter: (a: any, b: any) => a.totalAmount - b.totalAmount,
            render: (v: number) => <strong style={{ color: '#10b981' }}>{fmt(v)}</strong> },
        ]}
        summary={() => breakdown.length > 0 ? (
          <Table.Summary.Row style={{ background: '#f8fafc', fontWeight: 700 }}>
            <Table.Summary.Cell index={0}>Total</Table.Summary.Cell>
            <Table.Summary.Cell index={1}>{breakdown.reduce((s: number, r: any) => s + r.paymentCount, 0)}</Table.Summary.Cell>
            <Table.Summary.Cell index={2}>{fmt(breakdown.reduce((s: number, r: any) => s + r.cashAmount, 0))}</Table.Summary.Cell>
            <Table.Summary.Cell index={3}>{fmt(breakdown.reduce((s: number, r: any) => s + r.upiAmount, 0))}</Table.Summary.Cell>
            <Table.Summary.Cell index={4}>{fmt(breakdown.reduce((s: number, r: any) => s + r.bankTransferAmount, 0))}</Table.Summary.Cell>
            <Table.Summary.Cell index={5}><span style={{ color: '#10b981' }}>{fmt(breakdown.reduce((s: number, r: any) => s + r.totalAmount, 0))}</span></Table.Summary.Cell>
          </Table.Summary.Row>
        ) : null}
      />
    </div>
  );
};

/* ── Profit Tab ── */
const ProfitTab: React.FC = () => {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs()]);

  const { data, isLoading, refetch } = useGetProfitReportQuery({
    from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'),
  });
  const report = data?.data;
  const rows: any[] = report?.routeBreakdown || [];

  const fmtPct = (v: number) => `${(v || 0).toFixed(2)}%`;

  const exportCols = [
    { title: 'Route', key: 'routeName', dataIndex: 'routeName' },
    { title: 'Orders', key: 'orderCount', dataIndex: 'orderCount' },
    { title: 'Revenue (excl. GST)', key: 'revenue', dataIndex: 'revenue' },
    { title: 'COGS', key: 'cogs', dataIndex: 'cogs' },
    { title: 'Gross Profit', key: 'grossProfit', dataIndex: 'grossProfit' },
    { title: 'Margin %', key: 'marginPercent', dataIndex: 'marginPercent' },
  ];

  const totalProfit = rows.reduce((s: number, r: any) => s + Number(r.grossProfit), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <RangePicker value={range} onChange={(v) => v && setRange(v as any)} format="DD MMM YYYY" style={{ borderRadius: 8 }} />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} style={{ borderRadius: 8 }}>Refresh</Button>
        </Space>
        <Button icon={<DownloadOutlined />} onClick={() => exportToCSV(rows, exportCols, `profit-report-${range[0].format('YYYY-MM-DD')}`)}
          style={{ borderRadius: 8 }} disabled={!rows.length}>Export CSV</Button>
      </div>

      {report && (
        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
          <Col xs={12} md={5}><MetricTile label="Total Orders" value={String(report.totalOrders || 0)} color="#059669" bg="#ecfdf5" /></Col>
          <Col xs={12} md={5}><MetricTile label="Revenue (excl. GST)" value={fmt(report.totalRevenue)} color="#10b981" bg="#ecfdf5" /></Col>
          <Col xs={12} md={5}><MetricTile label="COGS" value={fmt(report.totalCogs)} color="#6b7280" bg="#f9fafb" /></Col>
          <Col xs={12} md={5}><MetricTile
            label="Gross Profit"
            value={fmt(report.totalGrossProfit)}
            color={Number(report.totalGrossProfit) >= 0 ? '#059669' : '#dc2626'}
            bg={Number(report.totalGrossProfit) >= 0 ? '#ecfdf5' : '#fef2f2'}
          /></Col>
          <Col xs={12} md={4}><MetricTile label="Margin %" value={fmtPct(report.totalMarginPercent)} color="#8b5cf6" bg="#f5f3ff" /></Col>
        </Row>
      )}

      <Table
        size="small"
        dataSource={rows}
        rowKey={(r: any) => r.routeId || 'walk-in'}
        loading={isLoading}
        pagination={false}
        locale={{ emptyText: <div style={{ padding: '24px 0', color: '#9ca3af' }}>No delivered orders in selected range</div> }}
        columns={[
          { title: 'Route / Branch', dataIndex: 'routeName', key: 'route' },
          { title: 'Orders', dataIndex: 'orderCount', key: 'orders', width: 80, align: 'right' as const,
            sorter: (a: any, b: any) => a.orderCount - b.orderCount },
          { title: 'Revenue (excl. GST)', dataIndex: 'revenue', key: 'revenue', align: 'right' as const,
            render: (v: number) => fmt(v),
            sorter: (a: any, b: any) => a.revenue - b.revenue },
          { title: 'COGS', dataIndex: 'cogs', key: 'cogs', align: 'right' as const,
            render: (v: number) => fmt(v) },
          { title: 'Gross Profit', dataIndex: 'grossProfit', key: 'profit', align: 'right' as const,
            sorter: (a: any, b: any) => a.grossProfit - b.grossProfit,
            render: (v: number) => (
              <strong style={{ color: v >= 0 ? '#059669' : '#dc2626' }}>{fmt(v)}</strong>
            ) },
          { title: 'Margin %', dataIndex: 'marginPercent', key: 'margin', align: 'right' as const,
            sorter: (a: any, b: any) => a.marginPercent - b.marginPercent,
            render: (v: number) => (
              <span style={{ color: v >= 0 ? '#059669' : '#dc2626' }}>{fmtPct(v)}</span>
            ) },
        ]}
        summary={() => rows.length > 0 ? (
          <Table.Summary.Row style={{ background: '#f8fafc', fontWeight: 700 }}>
            <Table.Summary.Cell index={0}>Total</Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right">{rows.reduce((s: number, r: any) => s + r.orderCount, 0)}</Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="right">{fmt(rows.reduce((s: number, r: any) => s + Number(r.revenue), 0))}</Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="right">{fmt(rows.reduce((s: number, r: any) => s + Number(r.cogs), 0))}</Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="right">
              <strong style={{ color: totalProfit >= 0 ? '#059669' : '#dc2626' }}>{fmt(totalProfit)}</strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={5} align="right">
              {report ? fmtPct(report.totalMarginPercent) : '-'}
            </Table.Summary.Cell>
          </Table.Summary.Row>
        ) : null}
      />
    </div>
  );
};

/* ── Brand Profit Tab ── */
const BrandProfitTab: React.FC = () => {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs()]);

  const { data, isLoading, refetch } = useGetBrandProfitReportQuery({
    from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'),
  });
  const report = data?.data;
  const rows: any[] = report?.brands || [];

  const fmtPct = (v: number) => `${(v || 0).toFixed(2)}%`;
  const totalProfit = rows.reduce((s: number, r: any) => s + Number(r.grossProfit), 0);

  const exportCols = [
    { title: 'Brand',           key: 'brand',         dataIndex: 'brand'         },
    { title: 'Qty Sold',        key: 'qtySold',       dataIndex: 'qtySold'       },
    { title: 'Orders',          key: 'orderCount',    dataIndex: 'orderCount'    },
    { title: 'Revenue (excl. GST)', key: 'revenue',   dataIndex: 'revenue'       },
    { title: 'COGS',            key: 'cogs',          dataIndex: 'cogs'          },
    { title: 'Gross Profit',    key: 'grossProfit',   dataIndex: 'grossProfit'   },
    { title: 'Margin %',        key: 'marginPercent', dataIndex: 'marginPercent' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <RangePicker value={range} onChange={(v) => v && setRange(v as any)} format="DD MMM YYYY" style={{ borderRadius: 8 }} />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} style={{ borderRadius: 8 }}>Refresh</Button>
        </Space>
        <Button icon={<DownloadOutlined />} onClick={() => exportToCSV(rows, exportCols, `brand-profit-${range[0].format('YYYY-MM-DD')}`)}
          style={{ borderRadius: 8 }} disabled={!rows.length}>Export CSV</Button>
      </div>

      {report && (
        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
          <Col xs={12} md={5}><MetricTile label="Total Orders"        value={String(report.totalOrders || 0)}  color="#059669" bg="#ecfdf5" /></Col>
          <Col xs={12} md={5}><MetricTile label="Revenue (excl. GST)" value={fmt(report.totalRevenue)}         color="#10b981" bg="#ecfdf5" /></Col>
          <Col xs={12} md={5}><MetricTile label="COGS"                value={fmt(report.totalCogs)}            color="#6b7280" bg="#f9fafb" /></Col>
          <Col xs={12} md={5}><MetricTile
            label="Gross Profit"
            value={fmt(report.totalGrossProfit)}
            color={Number(report.totalGrossProfit) >= 0 ? '#059669' : '#dc2626'}
            bg={Number(report.totalGrossProfit) >= 0 ? '#ecfdf5' : '#fef2f2'}
          /></Col>
          <Col xs={12} md={4}><MetricTile label="Margin %"            value={fmtPct(report.totalMarginPercent)} color="#8b5cf6" bg="#f5f3ff" /></Col>
        </Row>
      )}

      <Table
        size="small"
        dataSource={rows}
        rowKey="brand"
        loading={isLoading}
        pagination={false}
        locale={{ emptyText: <div style={{ padding: '24px 0', color: '#9ca3af' }}>No delivered orders in selected range</div> }}
        columns={[
          { title: 'Brand',     dataIndex: 'brand',      key: 'brand',
            render: (v: string) => <strong style={{ color: '#0f172a' }}>{v}</strong> },
          { title: 'Qty Sold',  dataIndex: 'qtySold',    key: 'qty',    width: 90,  align: 'right' as const,
            sorter: (a: any, b: any) => a.qtySold - b.qtySold },
          { title: 'Orders',    dataIndex: 'orderCount', key: 'orders', width: 80,  align: 'right' as const,
            sorter: (a: any, b: any) => a.orderCount - b.orderCount },
          { title: 'Revenue (excl. GST)', dataIndex: 'revenue', key: 'revenue', align: 'right' as const,
            render: (v: number) => fmt(v),
            sorter: (a: any, b: any) => a.revenue - b.revenue },
          { title: 'COGS',      dataIndex: 'cogs',        key: 'cogs',   align: 'right' as const,
            render: (v: number) => fmt(v) },
          { title: 'Gross Profit', dataIndex: 'grossProfit', key: 'profit', align: 'right' as const,
            sorter: (a: any, b: any) => a.grossProfit - b.grossProfit,
            render: (v: number) => <strong style={{ color: v >= 0 ? '#059669' : '#dc2626' }}>{fmt(v)}</strong> },
          { title: 'Margin %',  dataIndex: 'marginPercent', key: 'margin', align: 'right' as const,
            sorter: (a: any, b: any) => a.marginPercent - b.marginPercent,
            render: (v: number) => <span style={{ color: v >= 0 ? '#059669' : '#dc2626' }}>{fmtPct(v)}</span> },
        ]}
        summary={() => rows.length > 0 ? (
          <Table.Summary.Row style={{ background: '#f8fafc', fontWeight: 700 }}>
            <Table.Summary.Cell index={0}>Total</Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right">{rows.reduce((s: number, r: any) => s + r.qtySold, 0)}</Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="right">{report?.totalOrders || 0}</Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="right">{fmt(rows.reduce((s: number, r: any) => s + Number(r.revenue), 0))}</Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="right">{fmt(rows.reduce((s: number, r: any) => s + Number(r.cogs), 0))}</Table.Summary.Cell>
            <Table.Summary.Cell index={5} align="right">
              <strong style={{ color: totalProfit >= 0 ? '#059669' : '#dc2626' }}>{fmt(totalProfit)}</strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={6} align="right">
              {report ? fmtPct(report.totalMarginPercent) : '-'}
            </Table.Summary.Cell>
          </Table.Summary.Row>
        ) : null}
      />
    </div>
  );
};

/* ── Page ── */
const ReportsPage: React.FC = () => (
  <div>
    <PageHeader title="Reports & Analytics" subtitle="Business performance insights" />
    <Card style={{ borderRadius: 12 }}>
      <Tabs
        size="large"
        tabBarStyle={{ marginBottom: 20 }}
        items={[
          { key: 'sales',        label: <Space><ShoppingOutlined />Sales Report</Space>,    children: <SalesTab /> },
          { key: 'collections',  label: <Space><DollarOutlined />Collections</Space>,        children: <CollectionsTab /> },
          { key: 'profit',       label: <Space><RiseOutlined />Profit by Route</Space>,      children: <ProfitTab /> },
          { key: 'brandprofit',  label: <Space><TagsOutlined />Brand Profit</Space>,         children: <BrandProfitTab /> },
        ]}
      />
    </Card>
  </div>
);

export default ReportsPage;
