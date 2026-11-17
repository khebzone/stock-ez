import React, { useMemo, useState } from 'react';
import { Select, Input, DatePicker, Skeleton, Grid, Button } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useGetCustomerAllOrdersQuery, useGetCustomerPaymentHistoryQuery } from '../../store/api/paymentApi';
import { useGetCustomersQuery } from '../../store/api/customerApi';
import { formatINR } from '../../utils/format';
import PaymentActions from '../../components/PaymentActions';

const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

const PAGE_SIZE = 50;

const MODE_COLOR: Record<string, string> = {
  CASH: '#059669', UPI: '#7c3aed', CHEQUE: '#d97706', NEFT: '#0891b2', RTGS: '#2563eb', CREDIT: '#ef4444',
};

const orderPaymentLabel = (o: any) => {
  const paid = Number(o.paidAmount || 0);
  if (Number(o.balanceAmount || 0) <= 0) return 'Paid';
  return paid > 0 ? 'Partial' : 'Unpaid';
};

const headerCell: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 };

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  border: '1px solid #e2e8f0',
  overflow: 'hidden',
  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
};

const ORDER_COLS = '2fr 1fr 1fr 1fr';
const PAYMENT_COLS = '1.2fr 1.2fr 1.4fr 1.4fr 1fr 70px';

const CustomerPaymentHistoryView: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.lg;

  const [customerId, setCustomerId] = useState<string | undefined>();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const { data: customersData } = useGetCustomersQuery();
  const customers: any[] = customersData?.data?.content || customersData?.data || [];

  const { data: ordersData, isFetching: ordersLoading } = useGetCustomerAllOrdersQuery(customerId!, { skip: !customerId });
  const orders: any[] = ordersData?.data || [];

  const { data: historyData, isFetching: historyLoading } = useGetCustomerPaymentHistoryQuery(customerId!, { skip: !customerId });
  const payments: any[] = historyData?.data || [];

  const filteredOrders = useMemo(() => orders.filter(o => {
    if (orderSearch.trim() && !(o.orderNumber || '').toLowerCase().includes(orderSearch.trim().toLowerCase())) return false;
    if (range && (dayjs(o.orderDate).isBefore(range[0], 'day') || dayjs(o.orderDate).isAfter(range[1], 'day'))) return false;
    return true;
  }), [orders, orderSearch, range]);

  const selectedOrder = orders.find(o => o.id === orderId);
  const orderPayments = useMemo(
    () => payments.filter(p => p.order?.id === orderId).sort((a, b) => dayjs(a.collectionDate).valueOf() - dayjs(b.collectionDate).valueOf()),
    [payments, orderId],
  );

  const onCustomerChange = (id?: string) => {
    setCustomerId(id);
    setOrderId(null);
    setOrderSearch('');
    setRange(null);
    setVisible(PAGE_SIZE);
  };

  const shown = filteredOrders.slice(0, visible);

  const ordersPanel = (
    <div style={cardStyle}>
      <div style={{ display: 'grid', gridTemplateColumns: ORDER_COLS, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 20px' }}>
        {['Order', 'Ordered', 'Paid', 'Outstanding'].map(h => <div key={h} style={headerCell}>{h}</div>)}
      </div>
      {!customerId ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>Select a customer to see their orders</div>
      ) : ordersLoading ? (
        <div style={{ padding: 20 }}><Skeleton active paragraph={{ rows: 5 }} /></div>
      ) : filteredOrders.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>No orders match the filters</div>
      ) : (
        <>
          {shown.map((o, i) => {
            const isSelected = o.id === orderId;
            const balance = Number(o.balanceAmount || 0);
            return (
              <div
                key={o.id}
                onClick={() => setOrderId(isSelected && !isMobile ? null : o.id)}
                style={{
                  display: 'grid', gridTemplateColumns: ORDER_COLS, padding: '13px 20px', alignItems: 'center',
                  background: isSelected ? '#eff6ff' : '#fff', cursor: 'pointer', transition: 'background 0.15s',
                  borderBottom: i < shown.length - 1 ? '1px solid #f1f5f9' : 'none',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{o.orderNumber}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                    {dayjs(o.orderDate).format('DD MMM YYYY')} · {orderPaymentLabel(o)}
                  </div>
                </div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{formatINR(o.totalAmount)}</div>
                <div style={{ fontWeight: 600, color: '#059669', fontSize: 13 }}>{formatINR(o.paidAmount)}</div>
                <div style={{ fontWeight: 800, color: balance > 0 ? '#dc2626' : '#059669', fontSize: 13 }}>{formatINR(balance)}</div>
              </div>
            );
          })}
          {filteredOrders.length > visible && (
            <div style={{ padding: 12, textAlign: 'center', borderTop: '1px solid #f1f5f9' }}>
              <Button type="link" onClick={() => setVisible(v => v + PAGE_SIZE)}>
                Show more ({filteredOrders.length - visible} remaining)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );

  const detailPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!selectedOrder ? (
        <div style={{ ...cardStyle, padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>
          {customerId ? 'Select an order to see how it was paid' : 'Select a customer first'}
        </div>
      ) : (
        <>
          <div style={{ ...cardStyle, padding: '18px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{selectedOrder.orderNumber}</div>
                <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                  {dayjs(selectedOrder.orderDate).format('DD MMM YYYY')} · {orderPaymentLabel(selectedOrder)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                {[
                  { label: 'Ordered', value: formatINR(selectedOrder.totalAmount), color: '#0f172a' },
                  { label: 'Paid', value: formatINR(selectedOrder.paidAmount), color: '#059669' },
                  { label: 'Due', value: formatINR(selectedOrder.balanceAmount), color: Number(selectedOrder.balanceAmount) > 0 ? '#dc2626' : '#059669' },
                ].map(stat => (
                  <div key={stat.label} style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: stat.color, marginTop: 2 }}>{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, marginLeft: 4 }}>Payment History</div>
          {historyLoading ? <Skeleton active paragraph={{ rows: 3 }} /> : (
            <div style={{ ...cardStyle, overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: PAYMENT_COLS, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '10px 14px', minWidth: 560 }}>
                {['Date', 'Amount', 'Method', 'Reference', 'Status', ''].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
                ))}
              </div>
              {orderPayments.length === 0 ? (
                <div style={{ padding: '24px 14px', textAlign: 'center', color: '#94a3b8' }}>No payments recorded for this order</div>
              ) : orderPayments.map((p, i) => {
                const mode = p.paymentMode as string;
                const statusLabel = p.status === 'BOUNCED' ? 'Bounced' : p.status === 'DEPOSITED' ? 'Deposited' : p.cleared ? 'Cleared' : p.submitted ? 'Submitted' : 'Pending';
                const statusColor = p.status === 'BOUNCED' ? '#dc2626' : p.cleared ? '#059669' : p.submitted ? '#0891b2' : '#d97706';
                return (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: PAYMENT_COLS, padding: '10px 14px', alignItems: 'center', borderBottom: i < orderPayments.length - 1 ? '1px solid #f1f5f9' : 'none', minWidth: 560 }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{dayjs(p.collectionDate).format('DD MMM YYYY')}</div>
                    <div style={{ fontWeight: 800, color: Number(p.amount) < 0 ? '#dc2626' : '#059669', fontSize: 12 }}>{formatINR(p.amount)}</div>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${MODE_COLOR[mode] || '#6b7280'}18`, color: MODE_COLOR[mode] || '#6b7280' }}>
                        {p.paymentMethodName || mode}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#475569', wordBreak: 'break-word' }}>{p.referenceNumber || '—'}</div>
                    <div style={{ fontSize: 11, color: statusColor, fontWeight: 700 }}>{statusLabel}</div>
                    <div>{Number(p.amount) > 0 && <PaymentActions payment={p} />}</div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select
          showSearch allowClear
          placeholder="Select customer"
          value={customerId}
          onChange={onCustomerChange}
          filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
          options={customers.map(c => ({ value: c.id, label: c.businessName }))}
          style={{ width: isMobile ? '100%' : 280, borderRadius: 10 }}
        />
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Search order no"
          value={orderSearch}
          onChange={e => { setOrderSearch(e.target.value); setVisible(PAGE_SIZE); }}
          disabled={!customerId}
          style={{ width: isMobile ? '100%' : 200, borderRadius: 10 }}
        />
        <RangePicker
          value={range}
          onChange={v => { setRange(v as [Dayjs, Dayjs] | null); setVisible(PAGE_SIZE); }}
          format="DD MMM YYYY"
          disabled={!customerId}
          allowClear
          style={{ width: isMobile ? '100%' : undefined, borderRadius: 10 }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '6fr 6fr', gap: 20, alignItems: 'start' }}>
        {ordersPanel}
        {detailPanel}
      </div>
    </div>
  );
};

export default CustomerPaymentHistoryView;
