import React, { useState } from 'react';
import { Table, DatePicker, Tag } from 'antd';
import {
  ShoppingOutlined, WalletOutlined, CarOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { noFutureDates } from '../../utils/date';
import { useGetFieldActivityQuery } from '../../store/api/routeAllocationApi';
import PageHeader from '../../components/PageHeader';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', SUBMITTED: 'blue', APPROVED: 'cyan',
  PACKING: 'orange', PACKED: 'purple',
  DISPATCHED: 'geekblue', DELIVERED: 'green', CANCELLED: 'red',
  RETURN_TO_WAREHOUSE: 'volcano',
};

const KpiCard: React.FC<{ icon: React.ReactNode; label: string; value: string; color?: string }> = ({ icon, label, value, color }) => (
  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 18px', flex: 1 }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 700, color: color || '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
      {icon} {value}
    </div>
  </div>
);

const OrdersExpandedRow: React.FC<{ orders: any[] }> = ({ orders }) => {
  if (!orders?.length) return (
    <div style={{ padding: '12px 24px', color: '#94a3b8', fontSize: 13 }}>No orders for this person today</div>
  );

  const columns = [
    { title: 'Order #', dataIndex: 'orderNumber', width: 140, render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#0f172a' }}>{v}</span> },
    { title: 'Customer', key: 'customer', render: (_: any, r: any) => <div><div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{r.customerName}</div><div style={{ fontSize: 11, color: '#94a3b8' }}>{r.customerPhone}</div></div> },
    { title: 'Items', dataIndex: 'itemCount', width: 60, align: 'center' as const, render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'Invoice Amt', dataIndex: 'totalAmount', width: 120, align: 'right' as const, render: (v: number) => <span style={{ fontWeight: 600 }}>₹{Number(v || 0).toFixed(2)}</span> },
    { title: 'Paid', dataIndex: 'paidAmount', width: 110, align: 'right' as const, render: (v: number) => <span style={{ color: '#059669' }}>₹{Number(v || 0).toFixed(2)}</span> },
    { title: 'Balance', dataIndex: 'balanceAmount', width: 110, align: 'right' as const, render: (v: number) => <span style={{ color: Number(v) > 0 ? '#dc2626' : '#059669', fontWeight: Number(v) > 0 ? 600 : 400 }}>₹{Number(v || 0).toFixed(2)}</span> },
    { title: 'Status', dataIndex: 'status', width: 110, render: (s: string) => <Tag color={STATUS_COLOR[s] || 'default'} style={{ fontSize: 11 }}>{s}</Tag> },
  ];

  return (
    <div style={{ padding: '0 16px 12px 48px', background: '#f8fafc' }}>
      <Table dataSource={orders.map((o: any, i: number) => ({ ...o, key: i }))} columns={columns} size="small" pagination={false} style={{ borderRadius: 6, overflow: 'hidden' }} />
    </div>
  );
};

const FieldMonitorPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const { data, isLoading, refetch } = useGetFieldActivityQuery(selectedDate);
  const activities: any[] = data?.data?.activities || [];

  const salesActivities    = activities.filter((a: any) => a.type === 'SALES');
  const deliveryActivities = activities.filter((a: any) => a.type === 'DELIVERY');

  const totalOrders    = salesActivities.reduce((s: number, a: any) => s + (a.ordersCount || 0), 0);
  const totalSalesVal  = salesActivities.reduce((s: number, a: any) => s + Number(a.ordersValue || 0), 0);
  const totalCash      = activities.reduce((s: number, a: any) => s + Number(a.cashCollected || 0), 0);
  const totalCollected = activities.reduce((s: number, a: any) => s + Number(a.totalCollected || 0), 0);

  const statusColumn = {
    title: 'Status',
    key: 'status',
    width: 110,
    render: (_: any, r: any) => r.status === 'COMPLETED'
      ? <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>COMPLETED</span>
      : <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>ACTIVE</span>,
  };

  const salesColumns = [
    { title: 'Sales Person', key: 'person', render: (_: any, r: any) => <div><div style={{ fontWeight: 600, color: '#0f172a' }}>{r.person?.fullName}</div><div style={{ fontSize: 12, color: '#64748b' }}>{r.person?.phone}</div></div> },
    { title: 'Route', dataIndex: 'routeName' },
    { title: 'Vehicle / KM', key: 'vehicle', render: (_: any, r: any) => <div><div style={{ color: '#334155' }}>{r.vehicle?.vehicleNumber || '—'}</div>{r.kmDriven != null ? <div style={{ fontSize: 11, color: '#64748b' }}>{r.startKm} → {r.endKm} ({r.kmDriven} km)</div> : r.startKm != null ? <div style={{ fontSize: 11, color: '#64748b' }}>Start: {r.startKm} km</div> : null}</div> },
    { title: 'Orders', dataIndex: 'ordersCount', width: 80, align: 'right' as const, render: (v: number) => <span style={{ fontWeight: 700 }}>{v}</span> },
    { title: 'Order Value', dataIndex: 'ordersValue', width: 120, align: 'right' as const, render: (v: number) => `₹${Number(v || 0).toFixed(2)}` },
    { title: 'Cash', dataIndex: 'cashCollected', width: 110, align: 'right' as const, render: (v: number) => `₹${Number(v || 0).toFixed(2)}` },
    { title: 'UPI', dataIndex: 'upiCollected', width: 110, align: 'right' as const, render: (v: number) => `₹${Number(v || 0).toFixed(2)}` },
    { title: 'Total Collected', dataIndex: 'totalCollected', width: 130, align: 'right' as const, render: (v: number) => <span style={{ fontWeight: 700, color: '#059669' }}>₹{Number(v || 0).toFixed(2)}</span> },
    statusColumn,
  ];

  const deliveryColumns = [
    { title: 'Delivery Person', key: 'person', render: (_: any, r: any) => <div><div style={{ fontWeight: 600, color: '#0f172a' }}>{r.person?.fullName}</div><div style={{ fontSize: 12, color: '#64748b' }}>{r.person?.phone}</div></div> },
    { title: 'Route', dataIndex: 'routeName' },
    { title: 'Vehicle / KM', key: 'vehicle', render: (_: any, r: any) => <div><div style={{ color: '#334155' }}>{r.vehicle?.vehicleNumber || '—'}</div>{r.kmDriven != null ? <div style={{ fontSize: 11, color: '#64748b' }}>{r.startKm} → {r.endKm} ({r.kmDriven} km)</div> : r.startKm != null ? <div style={{ fontSize: 11, color: '#64748b' }}>Start: {r.startKm} km</div> : null}</div> },
    { title: 'Total', dataIndex: 'ordersCount', width: 70, align: 'right' as const, render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'Delivered', dataIndex: 'deliveriesCompleted', width: 90, align: 'right' as const, render: (v: number) => <span style={{ fontWeight: 700, color: '#059669' }}>{v}</span> },
    { title: 'Returned', key: 'returned', width: 90, align: 'right' as const, render: (_: any, r: any) => {
      const count = (r.orders || []).filter((o: any) => o.status === 'RETURN_TO_WAREHOUSE').length;
      return count > 0
        ? <span style={{ fontWeight: 700, color: '#dc2626' }}>{count}</span>
        : <span style={{ color: '#94a3b8' }}>0</span>;
    }},
    { title: 'Cash', dataIndex: 'cashCollected', width: 110, align: 'right' as const, render: (v: number) => `₹${Number(v || 0).toFixed(2)}` },
    { title: 'UPI', dataIndex: 'upiCollected', width: 110, align: 'right' as const, render: (v: number) => `₹${Number(v || 0).toFixed(2)}` },
    { title: 'Total Collected', dataIndex: 'totalCollected', width: 130, align: 'right' as const, render: (v: number) => <span style={{ fontWeight: 700, color: '#059669' }}>₹{Number(v || 0).toFixed(2)}</span> },
    statusColumn,
  ];

  return (
    <div>
      <PageHeader
        title="Field Monitor"
        subtitle="Daily activity — click any row to see customer orders"
        action={
          <DatePicker
            value={dayjs(selectedDate)}
            onChange={(d) => d && setSelectedDate(d.format('YYYY-MM-DD'))}
            format="DD MMM YYYY"
            allowClear={false}
            disabledDate={noFutureDates}
          />
        }
      />

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <KpiCard icon={<ShoppingOutlined />}    label="Total Orders"    value={String(totalOrders)} />
        <KpiCard icon={<WalletOutlined />}       label="Sales Value"     value={`₹${totalSalesVal.toFixed(2)}`} />
        <KpiCard icon={<CarOutlined />}          label="Cash Collected"  value={`₹${totalCash.toFixed(2)}`} />
        <KpiCard icon={<CheckCircleOutlined />}  label="Total Collected" value={`₹${totalCollected.toFixed(2)}`} color="#059669" />
      </div>

      {/* Sales section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Sales Activity
        </div>
        <Table
          columns={salesColumns}
          dataSource={salesActivities.map((a: any, i: number) => ({ ...a, key: `s-${i}` }))}
          loading={isLoading}
          size="middle"
          pagination={false}
          scroll={{ x: 900 }}
          locale={{ emptyText: 'No sales activity for this date' }}
          expandable={{
            expandedRowRender: (record: any) => <OrdersExpandedRow orders={record.orders} />,
            rowExpandable: () => true,
            expandRowByClick: true,
          }}
        />
      </div>

      {/* Delivery section */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Delivery Activity
        </div>
        <Table
          columns={deliveryColumns}
          dataSource={deliveryActivities.map((a: any, i: number) => ({ ...a, key: `d-${i}` }))}
          loading={isLoading}
          size="middle"
          pagination={false}
          scroll={{ x: 900 }}
          locale={{ emptyText: 'No delivery activity for this date' }}
          expandable={{
            expandedRowRender: (record: any) => <OrdersExpandedRow orders={record.orders} />,
            rowExpandable: () => true,
            expandRowByClick: true,
          }}
        />
      </div>
    </div>
  );
};

export default FieldMonitorPage;
