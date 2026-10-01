import React, { useState } from 'react';
import { DatePicker, Select, Button, Table, Space, Empty } from 'antd';
import { FileExcelOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetCustomerItemReportQuery } from '../../store/api/reportApi';
import { useGetCustomersQuery } from '../../store/api/customerApi';
import PageHeader from '../../components/PageHeader';
import { exportToXLSX } from '../../components/TableToolbar';
import { noFutureDates } from '../../utils/date';

const { RangePicker } = DatePicker;
const fmt = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fyStart = () => { const n = dayjs(); const y = n.month() >= 3 ? n.year() : n.year() - 1; return dayjs(`${y}-04-01`); };

const CustomerItemReportPage: React.FC = () => {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([fyStart(), dayjs()]);
  const [customerId, setCustomerId] = useState<string | undefined>();

  const { data: custData } = useGetCustomersQuery(undefined, { refetchOnMountOrArgChange: true });
  const customers: any[] = custData?.data?.content || custData?.data || [];

  const { data, isLoading } = useGetCustomerItemReportQuery(
    { customerId: customerId!, from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD') },
    { skip: !customerId }
  );
  const report = data?.data || {};
  const rows: any[] = report.rows || [];

  const doExport = () => {
    const exportRows = rows.map((r, i) => ({ sno: i + 1, productName: r.productName, brand: r.brand, unit: r.unit, qty: r.qty, amount: r.amount }));
    exportRows.push({ sno: '' as any, productName: 'TOTAL', brand: '', unit: '', qty: report.totalQty, amount: report.totalAmount });
    exportToXLSX(exportRows, [
      { title: 'S.No', key: 'sno', dataIndex: 'sno', type: 'number' as const, align: 'right' as const },
      { title: 'Product', key: 'productName', dataIndex: 'productName' },
      { title: 'Brand', key: 'brand', dataIndex: 'brand' },
      { title: 'Unit', key: 'unit', dataIndex: 'unit' },
      { title: 'Qty', key: 'qty', dataIndex: 'qty', type: 'number' as const },
      { title: 'Amount', key: 'amount', dataIndex: 'amount', type: 'currency' as const },
    ], `customer-item-${(report.customerName || 'customer').replace(/\s+/g, '-')}-${range[0].format('YYYY-MM-DD')}`, 'Customer Item Report');
  };

  return (
    <div>
      <PageHeader title="Customer Item Report" subtitle="Item-wise quantity and amount a customer bought" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Select
            showSearch placeholder="Select customer" style={{ width: 260 }} value={customerId} onChange={setCustomerId}
            filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
            options={customers.map((c: any) => ({ value: c.id, label: c.businessName }))}
          />
          <RangePicker value={range} onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])} format="DD MMM YYYY" disabledDate={noFutureDates} allowClear={false} />
        </Space>
        <Button icon={<FileExcelOutlined />} size="small" onClick={doExport} disabled={!rows.length}>Export Excel</Button>
      </div>

      {!customerId ? (
        <Empty description="Select a customer to see their item-wise purchases" style={{ padding: '48px 0' }} />
      ) : (
        <Table
          size="small" dataSource={rows} rowKey="productId" loading={isLoading} scroll={{ x: 640 }}
          pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t) => `${t} items` }}
          locale={{ emptyText: <div style={{ padding: '24px 0', color: '#9ca3af' }}>No purchases in this period</div> }}
          columns={[
            { title: 'S.No', width: 60, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
            { title: 'Product', dataIndex: 'productName', render: (v: string) => <span style={{ fontWeight: 600, color: '#0f172a' }}>{v}</span> },
            { title: 'Brand', dataIndex: 'brand', width: 140, render: (v: string) => v || '—' },
            { title: 'Unit', dataIndex: 'unit', width: 80, render: (v: string) => v || '—' },
            { title: 'Qty', dataIndex: 'qty', width: 100, align: 'right' as const, sorter: (a: any, b: any) => a.qty - b.qty },
            { title: 'Amount', dataIndex: 'amount', width: 140, align: 'right' as const, sorter: (a: any, b: any) => a.amount - b.amount, render: (v: any) => <strong>{fmt(v)}</strong> },
          ]}
          summary={() => rows.length > 0 ? (
            <Table.Summary.Row style={{ background: '#f8fafc', fontWeight: 700 }}>
              <Table.Summary.Cell index={0} colSpan={4}>Total ({rows.length} items)</Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">{report.totalQty}</Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right"><strong>{fmt(report.totalAmount)}</strong></Table.Summary.Cell>
            </Table.Summary.Row>
          ) : null}
        />
      )}
    </div>
  );
};

export default CustomerItemReportPage;
