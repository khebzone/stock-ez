import React, { useState } from 'react';
import { Table, Segmented, DatePicker } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useGetWarehouseReturnHistoryQuery } from '../../store/api/goodsReturnApi';
import { useGetUndeliveredReturnHistoryQuery } from '../../store/api/orderApi';

const { RangePicker } = DatePicker;

const fmt = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtDate = (v?: string) => (v ? dayjs(v).format('DD MMM YYYY') : '—');
const fmtDateTime = (v?: string) => (v ? dayjs(v).format('DD MMM YYYY, hh:mm A') : '—');

const refundLabel = (r: any) => {
  if (r.warehouseStatus === 'CANCELLED') return '—';
  if (r.refundStatus === 'PENDING') return 'Refund pending';
  if (r.refundStatus === 'PROCESSED') return `Refunded${r.refundMode ? ` (${r.refundMode})` : ''}`;
  return 'No refund';
};

const WarehouseReturnHistory: React.FC = () => {
  const [view, setView] = useState<'customer' | 'undelivered'>('customer');
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(29, 'day'), dayjs()]);
  const params = { from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD') };

  const { data: custData, isFetching: custLoading } = useGetWarehouseReturnHistoryQuery(params, { skip: view !== 'customer' });
  const { data: undData, isFetching: undLoading } = useGetUndeliveredReturnHistoryQuery(params, { skip: view !== 'undelivered' });

  const customerColumns = [
    { title: 'Handled On', key: 'on', width: 130, render: (_: any, r: any) => fmtDate(r.verifiedAt || r.cancelledAt || r.returnDate) },
    { title: 'Return No', dataIndex: 'returnNumber', key: 'no', width: 130, render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { title: 'Order', dataIndex: 'referenceOrderNumber', key: 'order', width: 140 },
    { title: 'Customer', key: 'customer', render: (_: any, r: any) => r.referenceOrderCustomerName || r.customerName || '—' },
    { title: 'Outcome', key: 'outcome', width: 110, render: (_: any, r: any) => (r.warehouseStatus === 'CANCELLED' ? 'Cancelled' : 'Verified') },
    { title: 'Filed', key: 'filed', width: 70, align: 'right' as const, render: (_: any, r: any) => (r.items || []).reduce((s: number, i: any) => s + (i.quantity || 0), 0) },
    { title: 'Received', key: 'rec', width: 85, align: 'right' as const,
      render: (_: any, r: any) => (r.warehouseStatus === 'CANCELLED' ? '—' : (r.items || []).reduce((s: number, i: any) => s + (i.receivedQty ?? 0), 0)) },
    { title: 'Damaged', key: 'dmg', width: 85, align: 'right' as const,
      render: (_: any, r: any) => (r.warehouseStatus === 'CANCELLED' ? '—' : (r.items || []).reduce((s: number, i: any) => s + (i.damagedQty ?? 0), 0)) },
    { title: 'Amount', dataIndex: 'totalAmount', key: 'amt', width: 110, align: 'right' as const, render: fmt },
    { title: 'Refund', key: 'refund', width: 140, render: (_: any, r: any) => refundLabel(r) },
    { title: 'By', key: 'by', width: 130, render: (_: any, r: any) => r.verifiedBy?.fullName || r.cancelledBy?.fullName || '—' },
  ];

  const itemColumns = [
    { title: 'Product', key: 'p', render: (_: any, i: any) => `${i.productName}${i.productBrand ? ` — ${i.productBrand}` : ''}` },
    { title: 'Batch', dataIndex: 'batchNumber', key: 'b', width: 160 },
    { title: 'Filed', dataIndex: 'quantity', key: 'q', width: 70, align: 'right' as const },
    { title: 'Received', dataIndex: 'receivedQty', key: 'r', width: 85, align: 'right' as const, render: (v: any) => v ?? '—' },
    { title: 'Damaged', dataIndex: 'damagedQty', key: 'd', width: 85, align: 'right' as const, render: (v: any) => v ?? 0 },
  ];

  const undeliveredColumns = [
    { title: 'Handled On', dataIndex: 'performedAt', key: 'on', width: 170, render: fmtDateTime },
    { title: 'Order', dataIndex: 'orderNumber', key: 'order', width: 140, render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { title: 'Customer', dataIndex: 'customerName', key: 'customer' },
    { title: 'Route', dataIndex: 'routeName', key: 'route', width: 140, render: (v: string) => v || '—' },
    { title: 'Delivery Person', dataIndex: 'deliveryPersonName', key: 'dp', width: 150, render: (v: string) => v || '—' },
    { title: 'Outcome', dataIndex: 'outcome', key: 'outcome', width: 170 },
    { title: 'Shortage', dataIndex: 'detail', key: 'detail', render: (v: string) => v || '—' },
    { title: 'Amount', dataIndex: 'totalAmount', key: 'amt', width: 110, align: 'right' as const, render: fmt },
    { title: 'By', dataIndex: 'performedBy', key: 'by', width: 130, render: (v: string) => v || '—' },
  ];

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 4 }}>History</div>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
        Everything the warehouse has already handled — who verified it, what came back, and what was damaged.
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <Segmented
          value={view}
          onChange={(v) => setView(v as 'customer' | 'undelivered')}
          options={[{ label: 'Customer Returns', value: 'customer' }, { label: 'Undelivered Orders', value: 'undelivered' }]}
        />
        <RangePicker
          value={range}
          allowClear={false}
          format="DD MMM YYYY"
          onChange={(v) => { if (v && v[0] && v[1]) setRange([v[0], v[1]]); }}
        />
      </div>

      {view === 'customer' ? (
        <Table
          size="small"
          rowKey="id"
          loading={custLoading}
          columns={customerColumns}
          dataSource={custData?.data || []}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          expandable={{
            expandedRowRender: (r: any) => (
              <div>
                <Table size="small" rowKey="id" columns={itemColumns} dataSource={r.items || []} pagination={false} />
                {r.warehouseStatus === 'CANCELLED' && r.cancellationReason && (
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>Cancelled: {r.cancellationReason}</div>
                )}
              </div>
            ),
          }}
          locale={{ emptyText: 'No returns handled in this period' }}
        />
      ) : (
        <Table
          size="small"
          rowKey={(r: any, i: any) => `${r.orderId}-${r.performedAt}-${i}`}
          loading={undLoading}
          columns={undeliveredColumns}
          dataSource={undData?.data || []}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          locale={{ emptyText: 'No undelivered orders handled in this period' }}
        />
      )}
    </div>
  );
};

export default WarehouseReturnHistory;
