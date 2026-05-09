import React, { useState } from 'react';
import { Button, Form, Input, InputNumber, Select, Modal, Skeleton, message } from 'antd';
import { DownloadOutlined, WalletOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetCustomerOutstandingQuery,
  useGetCustomerOrdersQuery,
  useGetCustomerPaymentHistoryQuery,
  useCollectPaymentMutation,
} from '../../store/api/paymentApi';
import { useGetPaymentMethodsQuery } from '../../store/api/paymentMethodApi';
import { exportToCSV } from '../../components/TableToolbar';
import { formatINR } from '../../utils/format';

const REQUIRES_REFERENCE = ['UPI', 'CHEQUE', 'NEFT', 'RTGS'];
const MODE_COLOR: Record<string, string> = {
  CASH: '#059669', UPI: '#7c3aed', CHEQUE: '#d97706', NEFT: '#0891b2', RTGS: '#2563eb', CREDIT: '#ef4444',
};

const CustomerOutstandingPage: React.FC = () => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [collectModal, setCollectModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [form] = Form.useForm();

  const { data: summaryData, isLoading: summaryLoading, refetch: refetchSummary } = useGetCustomerOutstandingQuery();
  const summaries: any[] = summaryData?.data || [];

  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useGetCustomerOrdersQuery(
    selectedCustomerId!,
    { skip: !selectedCustomerId }
  );
  const unpaidOrders: any[] = ordersData?.data || [];

  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useGetCustomerPaymentHistoryQuery(
    selectedCustomerId!,
    { skip: !selectedCustomerId }
  );
  const paymentHistory: any[] = historyData?.data || [];

  const { data: methodsData } = useGetPaymentMethodsQuery();
  const methods: any[] = methodsData?.data || [];

  const [collectPayment, { isLoading: collecting }] = useCollectPaymentMutation();

  const selected = summaries.find(s => s.customerId === selectedCustomerId);

  const collectAmount  = Form.useWatch('amount', form);
  const selectedMethodId = Form.useWatch('paymentMethodId', form);
  const selectedMethod   = methods.find(m => m.id === selectedMethodId);
  const needsRef         = selectedMethod && REQUIRES_REFERENCE.includes(selectedMethod.mode);
  const isPartial        = collectAmount != null && selectedOrder && collectAmount < selectedOrder.balanceAmount;

  const openCollect = (order: any) => {
    setSelectedOrder(order);
    form.resetFields();
    form.setFieldsValue({ amount: order.balanceAmount });
    setCollectModal(true);
  };

  const handleCollect = async () => {
    try {
      const values = await form.validateFields();
      if (values.amount > selectedOrder?.balanceAmount) {
        message.error(`Amount cannot exceed balance of ${formatINR(selectedOrder?.balanceAmount)}`);
        return;
      }
      await collectPayment({
        orderId: selectedOrder.id,
        amount: values.amount,
        paymentMethodId: values.paymentMethodId,
        referenceNumber: values.referenceNumber || null,
        notes: values.notes || null,
      }).unwrap();
      message.success(isPartial ? 'Partial payment recorded' : 'Payment recorded');
      setCollectModal(false);
      refetchSummary();
      refetchOrders();
      refetchHistory();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.data?.message || 'Failed to record payment');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>Customer Outstanding</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>Track amounts owed by each customer and record collections</div>
        </div>
        <Button
          icon={<DownloadOutlined />}
          disabled={summaries.length === 0}
          onClick={() => exportToCSV(
            summaries.map((s: any) => ({
              customer: s.businessName,
              owner: s.ownerName,
              phone: s.phone,
              route: s.routeName,
              ordered: s.totalOrdered,
              paid: s.totalPaid,
              outstanding: s.outstanding,
              lastOrder: s.lastOrderDate ? dayjs(s.lastOrderDate).format('DD MMM YYYY') : '',
              lastPayment: s.lastPaymentDate ? dayjs(s.lastPaymentDate).format('DD MMM YYYY') : '',
            })),
            [
              { title: 'Customer',      key: 'customer',    dataIndex: 'customer' },
              { title: 'Owner',         key: 'owner',       dataIndex: 'owner' },
              { title: 'Phone',         key: 'phone',       dataIndex: 'phone' },
              { title: 'Route',         key: 'route',       dataIndex: 'route' },
              { title: 'Total Ordered', key: 'ordered',     dataIndex: 'ordered' },
              { title: 'Total Paid',    key: 'paid',        dataIndex: 'paid' },
              { title: 'Outstanding',   key: 'outstanding', dataIndex: 'outstanding' },
              { title: 'Last Order',    key: 'lastOrder',   dataIndex: 'lastOrder' },
              { title: 'Last Payment',  key: 'lastPayment', dataIndex: 'lastPayment' },
            ],
            `customer-outstanding-${dayjs().format('YYYY-MM-DD')}`
          )}
          style={{ borderRadius: 8 }}
        >
          Export CSV
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedCustomerId ? '1fr 1.4fr' : '1fr', gap: 16, alignItems: 'start' }}>

        {/* Customer Summary Table */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 20px' }}>
            {['Customer', 'Ordered', 'Paid', 'Outstanding'].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
            ))}
          </div>

          {summaryLoading ? (
            <div style={{ padding: 20 }}><Skeleton active paragraph={{ rows: 5 }} /></div>
          ) : summaries.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>No outstanding balances</div>
          ) : summaries.map((s: any, i: number) => {
            const isSelected = s.customerId === selectedCustomerId;
            return (
              <div
                key={s.customerId}
                onClick={() => setSelectedCustomerId(isSelected ? null : s.customerId)}
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
                  padding: '13px 20px', alignItems: 'center',
                  borderBottom: i < summaries.length - 1 ? '1px solid #f1f5f9' : 'none',
                  background: isSelected ? '#eff6ff' : '#fff',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '#fff'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#475569', fontSize: 13, flexShrink: 0 }}>
                    {s.businessName?.[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{s.businessName}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{s.routeName} · {s.orderCount} order{s.orderCount !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{formatINR(s.totalOrdered)}</div>
                <div style={{ fontWeight: 600, color: '#059669', fontSize: 13 }}>{formatINR(s.totalPaid)}</div>
                <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 13 }}>{formatINR(s.outstanding)}</div>
              </div>
            );
          })}
        </div>

        {/* Right panel */}
        {selectedCustomerId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Customer summary card */}
            {selected && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{selected.businessName}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {selected.ownerName} · {selected.phone}
                      {selected.lastPaymentDate && ` · Last paid: ${dayjs(selected.lastPaymentDate).format('DD MMM YYYY')}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    {[
                      { label: 'Ordered',     value: formatINR(selected.totalOrdered), color: '#0f172a' },
                      { label: 'Paid',        value: formatINR(selected.totalPaid),    color: '#059669' },
                      { label: 'Outstanding', value: formatINR(selected.outstanding),  color: '#dc2626' },
                    ].map(stat => (
                      <div key={stat.label} style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: stat.color, marginTop: 2 }}>{stat.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Unpaid Orders */}
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>Unpaid Orders</div>
            {ordersLoading ? <Skeleton active paragraph={{ rows: 3 }} /> : (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr 80px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '11px 16px' }}>
                  {['Date', 'Order', 'Total', 'Balance', ''].map(h => (
                    <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
                  ))}
                </div>
                {unpaidOrders.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>No unpaid orders</div>
                ) : unpaidOrders.map((o: any, i: number) => (
                  <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr 80px', padding: '12px 16px', alignItems: 'center', borderBottom: i < unpaidOrders.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{dayjs(o.orderDate).format('DD MMM YYYY')}</div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{o.orderNumber}</div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{formatINR(o.totalAmount)}</div>
                    <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 13 }}>{formatINR(o.balanceAmount)}</div>
                    <Button
                      type="primary" size="small" icon={<WalletOutlined />}
                      onClick={() => openCollect(o)}
                      style={{ borderRadius: 7, fontSize: 12, fontWeight: 700 }}
                    >
                      Collect
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Payment History */}
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, marginTop: 4 }}>Payment History</div>
            {historyLoading ? <Skeleton active paragraph={{ rows: 3 }} /> : (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 1fr 1fr', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '11px 16px' }}>
                  {['Date', 'Amount', 'Method', 'Order', 'Status'].map(h => (
                    <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
                  ))}
                </div>
                {paymentHistory.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>No payments recorded</div>
                ) : paymentHistory.map((p: any, i: number) => (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 1fr 1fr', padding: '11px 16px', alignItems: 'center', borderBottom: i < paymentHistory.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{dayjs(p.collectionDate).format('DD MMM YYYY')}</div>
                    <div style={{ fontWeight: 800, color: '#059669', fontSize: 14 }}>{formatINR(p.amount)}</div>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${MODE_COLOR[p.paymentMode] || '#6b7280'}18`, color: MODE_COLOR[p.paymentMode] || '#6b7280' }}>
                        {p.paymentMethodName || p.paymentMode}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#475569' }}>{p.order?.orderNumber}</div>
                    <div style={{ fontSize: 11, color: p.cleared ? '#059669' : p.submitted ? '#0891b2' : '#d97706', fontWeight: 600 }}>
                      {p.cleared ? 'Cleared' : p.submitted ? 'Submitted' : 'Pending'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Collect Payment Modal */}
      <Modal
        title={
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Collect Payment</div>
            {selectedOrder && (
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
                {selectedOrder.orderNumber} · {selectedOrder.customerName}
              </div>
            )}
          </div>
        }
        open={collectModal}
        onOk={handleCollect}
        onCancel={() => setCollectModal(false)}
        confirmLoading={collecting}
        okText={isPartial ? 'Record Partial' : 'Record Payment'}
        okButtonProps={{ style: { background: isPartial ? '#d97706' : '#059669', borderColor: isPartial ? '#d97706' : '#059669', fontWeight: 700 } }}
        width={460}
      >
        {selectedOrder && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
              {[
                { label: 'Order Total', value: formatINR(selectedOrder.totalAmount), color: '#0f172a' },
                { label: 'Paid So Far', value: formatINR(selectedOrder.paidAmount || 0), color: '#059669' },
                { label: 'Balance Due', value: formatINR(selectedOrder.balanceAmount), color: '#dc2626' },
              ].map(col => (
                <div key={col.label} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginBottom: 3 }}>{col.label}</div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: col.color }}>{col.value}</div>
                </div>
              ))}
            </div>

            <Form form={form} layout="vertical">
              <Form.Item name="amount" label="Amount *"
                rules={[
                  { required: true, message: 'Enter amount' },
                  { type: 'number', min: 0.01, message: 'Must be greater than ₹0' },
                  { validator: (_, v) => v && v > (selectedOrder?.balanceAmount || 0) ? Promise.reject('Cannot exceed balance ' + formatINR(selectedOrder?.balanceAmount)) : Promise.resolve() },
                ]}
              >
                <InputNumber style={{ width: '100%' }} min={0.01} max={selectedOrder?.balanceAmount} precision={2} prefix="₹" placeholder="0.00" size="large" />
              </Form.Item>

              <div style={{ display: 'flex', gap: 8, marginTop: -8, marginBottom: 16 }}>
                {[25, 50, 75].map(pct => (
                  <button key={pct} type="button"
                    onClick={() => form.setFieldsValue({ amount: parseFloat((selectedOrder.balanceAmount * pct / 100).toFixed(2)) })}
                    style={{ flex: 1, height: 36, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                  >
                    {pct}%
                  </button>
                ))}
                <button type="button"
                  onClick={() => form.setFieldsValue({ amount: selectedOrder.balanceAmount })}
                  style={{ flex: 1, height: 36, border: '1px solid #a7f3d0', borderRadius: 8, background: '#ecfdf5', color: '#059669', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                >
                  Full
                </button>
              </div>

              {isPartial && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#92400e' }}>
                  Partial — {formatINR((selectedOrder.balanceAmount - (collectAmount || 0)))} will remain outstanding.
                </div>
              )}

              <Form.Item name="paymentMethodId" label="Payment Method *" rules={[{ required: true, message: 'Select a payment method' }]}>
                <Select size="large" placeholder="Select payment method">
                  {methods.map((m: any) => (
                    <Select.Option key={m.id} value={m.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: MODE_COLOR[m.mode] || '#6b7280', display: 'inline-block' }} />
                        <span style={{ fontWeight: 600 }}>{m.name}</span>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{m.mode}</span>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              {needsRef && (
                <Form.Item name="referenceNumber" label="Reference Number *" rules={[{ required: true, message: 'Enter reference number' }]}>
                  <Input size="large" placeholder={
                    selectedMethod?.mode === 'UPI' ? 'UPI Transaction ID'
                    : selectedMethod?.mode === 'CHEQUE' ? 'Cheque Number'
                    : (selectedMethod?.mode === 'NEFT' || selectedMethod?.mode === 'RTGS') ? 'UTR Number (e.g. KKBK24...)'
                    : 'Transaction Reference'
                  } />
                </Form.Item>
              )}

              <Form.Item name="notes" label="Notes" style={{ marginBottom: 0 }}>
                <Input.TextArea rows={2} placeholder="Optional remarks..." style={{ borderRadius: 8 }} />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CustomerOutstandingPage;
