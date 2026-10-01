import React, { useState } from 'react';
import { DatePicker, Button, Table, Space } from 'antd';
import { FileExcelOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetCustomerSalesQuery } from '../../store/api/reportApi';
import PageHeader from '../../components/PageHeader';
import { exportToXLSX } from '../../components/TableToolbar';
import { noFutureDates } from '../../utils/date';

const { RangePicker } = DatePicker;
const fmt = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fyStart = () => { const n = dayjs(); const y = n.month() >= 3 ? n.year() : n.year() - 1; return dayjs(`${y}-04-01`); };

const CustomerSalesReportPage: React.FC = () => {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([fyStart(), dayjs()]);
  const { data, isLoading } = useGetCustomerSalesQuery({ from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD') });
  const report = data?.data || {};
  const rows: any[] = report.rows || [];

  const doExport = () => {
    const exportRows = rows.map((r, i) => ({
      sno: i + 1, customerName: r.customerName, routeName: r.routeName,
      orderCount: r.orderCount, totalQty: r.totalQty, totalAmount: r.totalAmount, outstanding: r.outstanding,
    }));
    exportRows.push({ sno: '' as any, customerName: 'TOTAL', routeName: '', orderCount: report.totalOrders, totalQty: report.totalQty, totalAmount: report.totalAmount, outstanding: report.totalOutstanding });
    exportToXLSX(exportRows, [
      { title: 'S.No', key: 'sno', dataIndex: 'sno', type: 'number' as const, align: 'right' as const },
      { title: 'Customer', key: 'customerName', dataIndex: 'customerName' },
      { title: 'Route', key: 'routeName', dataIndex: 'routeName' },
      { title: 'Bills', key: 'orderCount', dataIndex: 'orderCount', type: 'number' as const },
      { title: 'Qty', key: 'totalQty', dataIndex: 'totalQty', type: 'number' as const },
      { title: 'Sales Amt', key: 'totalAmount', dataIndex: 'totalAmount', type: 'currency' as const },
      { title: 'Balance', key: 'outstanding', dataIndex: 'outstanding', type: 'currency' as const },
    ], `customer-sales-${range[0].format('YYYY-MM-DD')}`, 'Customer Sales');
  };

  return (
    <div>
      <PageHeader title="Customer Sales" subtitle="Total bills, quantity, sales and balance per customer" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <RangePicker value={range} onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])} format="DD MMM YYYY" disabledDate={noFutureDates} allowClear={false} />
        </Space>
        <Button icon={<FileExcelOutlined />} size="small" onClick={doExport} disabled={!rows.length}>Export Excel</Button>
      </div>
      <Table
        size="small" dataSource={rows} rowKey="customerId" loading={isLoading} scroll={{ x: 760 }}
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t) => `${t} customers` }}
        locale={{ emptyText: <div style={{ padding: '24px 0', color: '#9ca3af' }}>No sales in this period</div> }}
        columns={[
          { title: 'S.No', width: 60, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
          { title: 'Customer', dataIndex: 'customerName', render: (v: string) => <span style={{ fontWeight: 600, color: '#0f172a' }}>{v}</span> },
          { title: 'Route', dataIndex: 'routeName', width: 160, render: (v: string) => v || '—' },
          { title: 'Bills', dataIndex: 'orderCount', width: 80, align: 'right' as const, sorter: (a: any, b: any) => a.orderCount - b.orderCount },
          { title: 'Qty', dataIndex: 'totalQty', width: 90, align: 'right' as const, sorter: (a: any, b: any) => a.totalQty - b.totalQty },
          { title: 'Sales Amt', dataIndex: 'totalAmount', width: 130, align: 'right' as const, sorter: (a: any, b: any) => a.totalAmount - b.totalAmount, render: (v: any) => <strong>{fmt(v)}</strong> },
          { title: 'Balance', dataIndex: 'outstanding', width: 130, align: 'right' as const, render: (v: any) => <span style={{ color: Number(v) > 0 ? '#dc2626' : '#059669', fontWeight: 700 }}>{fmt(v)}</span> },
        ]}
        summary={() => rows.length > 0 ? (
          <Table.Summary.Row style={{ background: '#f8fafc', fontWeight: 700 }}>
            <Table.Summary.Cell index={0} colSpan={3}>Total ({report.customerCount} customers)</Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right">{report.totalOrders}</Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="right">{report.totalQty}</Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="right"><strong>{fmt(report.totalAmount)}</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="right"><strong style={{ color: '#dc2626' }}>{fmt(report.totalOutstanding)}</strong></Table.Summary.Cell>
          </Table.Summary.Row>
        ) : null}
      />
    </div>
  );
};

export default CustomerSalesReportPage;
