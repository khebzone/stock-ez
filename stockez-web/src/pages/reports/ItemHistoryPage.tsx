import React, { useState } from 'react';
import { DatePicker, Select, Button, Table, Space, Empty } from 'antd';
import { FileExcelOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetItemHistoryQuery } from '../../store/api/reportApi';
import { useGetCustomersQuery } from '../../store/api/customerApi';
import { useGetAllProductsQuery } from '../../store/api/productApi';
import PageHeader from '../../components/PageHeader';
import { exportToXLSX } from '../../components/TableToolbar';
import { noFutureDates } from '../../utils/date';

const { RangePicker } = DatePicker;
const fmt = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fyStart = () => { const n = dayjs(); const y = n.month() >= 3 ? n.year() : n.year() - 1; return dayjs(`${y}-04-01`); };

const ItemHistoryPage: React.FC = () => {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([fyStart(), dayjs()]);
  const [productId, setProductId] = useState<string | undefined>();
  const [customerId, setCustomerId] = useState<string | undefined>();

  const { data: prodData } = useGetAllProductsQuery(undefined, { refetchOnMountOrArgChange: true });
  const products: any[] = prodData?.data?.content || prodData?.data || [];

  const { data: custData } = useGetCustomersQuery(undefined, { refetchOnMountOrArgChange: true });
  const customers: any[] = custData?.data?.content || custData?.data || [];

  const { data, isLoading } = useGetItemHistoryQuery(
    { productId: productId!, customerId, from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD') },
    { skip: !productId }
  );
  const report = data?.data || {};
  const rows: any[] = report.rows || [];

  const doExport = () => {
    const exportRows = rows.map((r, i) => ({
      sno: i + 1, orderDate: r.orderDate, orderNumber: r.orderNumber, customerName: r.customerName,
      quantity: r.quantity, rate: r.rate, amount: r.amount,
    }));
    exportRows.push({ sno: '' as any, orderDate: '', orderNumber: '', customerName: 'TOTAL', quantity: report.totalQty, rate: '' as any, amount: report.totalAmount });
    exportToXLSX(exportRows, [
      { title: 'S.No', key: 'sno', dataIndex: 'sno', type: 'number' as const, align: 'right' as const },
      { title: 'Date', key: 'orderDate', dataIndex: 'orderDate', type: 'date' as const },
      { title: 'Order #', key: 'orderNumber', dataIndex: 'orderNumber' },
      { title: 'Customer', key: 'customerName', dataIndex: 'customerName' },
      { title: 'Qty', key: 'quantity', dataIndex: 'quantity', type: 'number' as const },
      { title: 'Rate', key: 'rate', dataIndex: 'rate', type: 'currency' as const },
      { title: 'Amount', key: 'amount', dataIndex: 'amount', type: 'currency' as const },
    ], `item-history-${(report.productName || 'item').replace(/\s+/g, '-')}-${range[0].format('YYYY-MM-DD')}`, 'Item History');
  };

  return (
    <div>
      <PageHeader title="Item History" subtitle="Who bought a product, how much quantity — filterable to one customer" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Select
            showSearch placeholder="Select product" style={{ width: 260 }} value={productId} onChange={setProductId}
            filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
            options={products.map((p: any) => ({ value: p.id, label: `${p.name}${p.brand ? ' · ' + p.brand : ''}` }))}
          />
          <Select
            showSearch allowClear placeholder="All customers" style={{ width: 220 }} value={customerId} onChange={setCustomerId}
            filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
            options={customers.map((c: any) => ({ value: c.id, label: c.businessName }))}
          />
          <RangePicker value={range} onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])} format="DD MMM YYYY" disabledDate={noFutureDates} allowClear={false} />
        </Space>
        <Button icon={<FileExcelOutlined />} size="small" onClick={doExport} disabled={!rows.length}>Export Excel</Button>
      </div>

      {!productId ? (
        <Empty description="Select a product to see who bought it" style={{ padding: '48px 0' }} />
      ) : (
        <>
          {report.productName && (
            <div style={{ display: 'flex', gap: 24, alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{report.productName}</span>
                {report.brand && <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 6 }}>{report.brand} · {report.unit}</span>}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{report.customerName}</div>
              {!customerId && <div style={{ fontSize: 12, color: '#64748b' }}>{report.distinctCustomers} customer{report.distinctCustomers === 1 ? '' : 's'}</div>}
            </div>
          )}
          <Table
            size="small" dataSource={rows} rowKey="orderId" loading={isLoading} scroll={{ x: 700 }}
            pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t) => `${t} transactions` }}
            locale={{ emptyText: <div style={{ padding: '24px 0', color: '#9ca3af' }}>No purchases in this period</div> }}
            columns={[
              { title: 'S.No', width: 60, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
              { title: 'Date', dataIndex: 'orderDate', width: 120, render: (v: string) => dayjs(v).format('DD MMM YYYY') },
              { title: 'Order #', dataIndex: 'orderNumber', width: 140, render: (v: string) => <span style={{ fontWeight: 600, color: '#0f172a' }}>{v}</span> },
              { title: 'Customer', dataIndex: 'customerName' },
              { title: 'Qty', dataIndex: 'quantity', width: 90, align: 'right' as const, sorter: (a: any, b: any) => a.quantity - b.quantity },
              { title: 'Rate', dataIndex: 'rate', width: 110, align: 'right' as const, render: (v: any) => fmt(v) },
              { title: 'Amount', dataIndex: 'amount', width: 140, align: 'right' as const, sorter: (a: any, b: any) => a.amount - b.amount, render: (v: any) => <strong>{fmt(v)}</strong> },
            ]}
            summary={() => rows.length > 0 ? (
              <Table.Summary.Row style={{ background: '#f8fafc', fontWeight: 700 }}>
                <Table.Summary.Cell index={0} colSpan={4}>Total ({rows.length} transactions)</Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">{report.totalQty}</Table.Summary.Cell>
                <Table.Summary.Cell index={2} />
                <Table.Summary.Cell index={3} align="right"><strong>{fmt(report.totalAmount)}</strong></Table.Summary.Cell>
              </Table.Summary.Row>
            ) : null}
          />
        </>
      )}
    </div>
  );
};

export default ItemHistoryPage;
