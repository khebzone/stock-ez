import React, { useState } from 'react';
import { Button, Form, Input, InputNumber, Select, Modal, Skeleton, message, Grid } from 'antd';
import { DownloadOutlined, WalletOutlined, ArrowLeftOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetOutstandingSummaryQuery,
  useGetCustomerOrdersQuery,
  useGetCustomerPaymentHistoryQuery,
  useCollectPaymentMutation,
} from '../../store/api/paymentApi';
import { useGetPaymentMethodsQuery } from '../../store/api/paymentMethodApi';
import { exportToCSV } from '../../components/TableToolbar';
import { formatINR } from '../../utils/format';

const { useBreakpoint } = Grid;

const REQUIRES_REFERENCE = ['UPI', 'CHEQUE', 'NEFT', 'RTGS'];
const MODE_COLOR: Record<string, string> = {
  CASH: '#059669', UPI: '#7c3aed', CHEQUE: '#d97706', NEFT: '#0891b2', RTGS: '#2563eb', CREDIT: '#ef4444',
};

const CustomerOutstandingPage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isTablet = screens.md && !screens.lg;
  const isDesktop = screens.lg;
  const isLargeDesktop = screens.xl;

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [collectModal, setCollectModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [form] = Form.useForm();

  const { data: summaryData, isLoading: summaryLoading, refetch: refetchSummary } = useGetOutstandingSummaryQuery();
  const allSummaries: any[] = summaryData?.data || [];
  const summaries = allSummaries.filter(s =>
    !search || s.businessName.toLowerCase().includes(search.toLowerCase()) || s.phone.includes(search)
  );

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

  const selected = allSummaries.find(s => s.customerId === selectedCustomerId);

  const collectAmount = Form.useWatch('amount', form);
  const selectedMethodId = Form.useWatch('paymentMethodId', form);
  const selectedMethod = methods.find(m => m.id === selectedMethodId);
  const needsRef = selectedMethod && REQUIRES_REFERENCE.includes(selectedMethod.mode);
  const isPartial = collectAmount != null && selectedOrder && collectAmount < selectedOrder.balanceAmount;

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

  const tableContainerStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 16,
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  };

  // Only show all columns on large screens
  const listColumns = isLargeDesktop ? '2fr 1fr 1fr 1fr' : '1fr 120px';

  const tableHeaderStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: listColumns,
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    padding: '12px 20px',
  };

  const tableRowStyle = (isSelected: boolean): React.CSSProperties => ({
    display: 'grid',
    gridTemplateColumns: listColumns,
    padding: '13px 20px',
    alignItems: 'center',
    background: isSelected ? '#eff6ff' : '#fff',
    cursor: 'pointer',
    transition: 'background 0.15s',
  });

  const shouldShowList = !isMobile || !selectedCustomerId;
  const shouldShowDetail = !!selectedCustomerId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, padding: '4px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {isMobile && selectedCustomerId && (
            <button onClick={() => setSelectedCustomerId(null)}
              style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, width: 38, height: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
              <ArrowLeftOutlined />
            </button>
          )}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', fontSize: 18, flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <WalletOutlined />
          </div>
          <div>
            <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>Customer Outstanding</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: 500 }}>
              {isMobile ? 'Track and record collections' : 'Track amounts owed by each customer and record collections'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, width: isMobile ? '100%' : 'auto' }}>
          <Input
            placeholder="Search customer..."
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ borderRadius: 10, width: isMobile ? '100%' : 220 }}
            allowClear
          />
          {!isMobile && (
            <Button
              type="primary"
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
                  { title: 'Customer', key: 'customer', dataIndex: 'customer' },
                  { title: 'Owner', key: 'owner', dataIndex: 'owner' },
                  { title: 'Phone', key: 'phone', dataIndex: 'phone' },
                  { title: 'Route', key: 'route', dataIndex: 'route' },
                  { title: 'Total Ordered', key: 'ordered', dataIndex: 'ordered' },
                  { title: 'Total Paid', key: 'paid', dataIndex: 'paid' },
                  { title: 'Outstanding', key: 'outstanding', dataIndex: 'outstanding' },
                  { title: 'Last Order', key: 'lastOrder', dataIndex: 'lastOrder' },
                  { title: 'Last Payment', key: 'lastPayment', dataIndex: 'lastPayment' },
                ],
                `customer-outstanding-${dayjs().format('YYYY-MM-DD')}`
              )}
              style={{ borderRadius: 10, height: 40, fontWeight: 700, background: '#059669' }}
            >
              Export
            </Button>
          )}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: (selectedCustomerId && isDesktop) ? (isLargeDesktop ? '380px 1fr' : '320px 1fr') : '1fr',
        gap: 20,
        alignItems: 'start'
      }}>

        {/* Customer Summary Table */}
        {shouldShowList && (
          <div style={tableContainerStyle}>
            <div style={tableHeaderStyle}>
              {isLargeDesktop ? (
                ['Customer', 'Ordered', 'Paid', 'Outstanding'].map(h => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
                ))
              ) : (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>Customer</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'right' }}>Outstanding</div>
                </>
              )}
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
                  onClick={() => setSelectedCustomerId(isSelected && !isMobile ? null : s.customerId)}
                  style={{
                    ...tableRowStyle(isSelected),
                    borderBottom: i < summaries.length - 1 ? '1px solid #f1f5f9' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: isSelected ? '#fff' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#475569', fontSize: 13, flexShrink: 0 }}>
                      {s.businessName?.[0]}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.businessName}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{s.routeName}</div>
                    </div>
                  </div>
                  {isLargeDesktop ? (
                    <>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{formatINR(s.totalOrdered)}</div>
                      <div style={{ fontWeight: 600, color: '#059669', fontSize: 13 }}>{formatINR(s.totalPaid)}</div>
                      <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 13 }}>{formatINR(s.outstanding)}</div>
                    </>
                  ) : (
                    <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 13, textAlign: 'right' }}>{formatINR(s.outstanding)}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Detail Panel */}
        {shouldShowDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Detail Summary Card */}
            {selected && (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: isMobile ? '16px' : '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: '#0f172a' }}>{selected.businessName}</div>
                    <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                      {selected.ownerName} · {selected.phone}
                      {selected.lastPaymentDate && <div style={{ marginTop: 2 }}>Last paid: {dayjs(selected.lastPaymentDate).format('DD MMM YYYY')}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: isMobile ? 12 : 20, width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-end', borderTop: isMobile ? '1px solid #f1f5f9' : 'none', paddingTop: isMobile ? 12 : 0 }}>
                    {[
                      { label: 'Ordered', value: formatINR(selected.totalOrdered), color: '#0f172a' },
                      { label: 'Paid', value: formatINR(selected.totalPaid), color: '#059669' },
                      { label: 'Due', value: formatINR(selected.outstanding), color: '#dc2626' },
                    ].map(stat => (
                      <div key={stat.label} style={{ textAlign: isMobile ? 'center' : 'right', flex: isMobile ? 1 : 'none' }}>
                        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</div>
                        <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, color: stat.color, marginTop: 2 }}>{stat.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Unpaid Orders - Scrollable on very small screens, otherwise fits */}
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, marginLeft: 4 }}>Unpaid Orders</div>
            {ordersLoading ? <Skeleton active paragraph={{ rows: 3 }} /> : (
              <div style={{ ...tableContainerStyle, overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 1fr 100px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 18px', minWidth: 450 }}>
                  {['Date', 'Order', 'Total', 'Balance', ''].map(h => (
                    <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
                  ))}
                </div>
                {unpaidOrders.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>No unpaid orders</div>
                ) : unpaidOrders.map((o: any, i: number) => (
                  <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 1fr 100px', padding: '14px 18px', alignItems: 'center', borderBottom: i < unpaidOrders.length - 1 ? '1px solid #f1f5f9' : 'none', minWidth: 450 }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{dayjs(o.orderDate).format('DD MMM YYYY')}</div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{o.orderNumber}</div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{formatINR(o.totalAmount)}</div>
                    <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 13 }}>{formatINR(o.balanceAmount)}</div>
                    <Button
                      type="primary" size="small" icon={<WalletOutlined />}
                      onClick={() => openCollect(o)}
                      style={{ borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#059669' }}
                    >
                      Collect
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Payment History */}
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, marginTop: 4, marginLeft: 4 }}>Payment History</div>
            {historyLoading ? <Skeleton active paragraph={{ rows: 3 }} /> : (
              <div style={{ ...tableContainerStyle, overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '110px 100px 1fr 100px 90px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 18px', minWidth: 480 }}>
                  {['Date', 'Amount', 'Method', 'Order', 'Status'].map(h => (
                    <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
                  ))}
                </div>
                {paymentHistory.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>No payments recorded</div>
                ) : paymentHistory.slice().reverse().map((p: any, i: number) => (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '110px 100px 1fr 100px 90px', padding: '12px 18px', alignItems: 'center', borderBottom: i < paymentHistory.length - 1 ? '1px solid #f1f5f9' : 'none', minWidth: 480 }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{dayjs(p.collectionDate).format('DD MMM YYYY')}</div>
                    <div style={{ fontWeight: 800, color: '#059669', fontSize: 13.5 }}>{formatINR(p.amount)}</div>
                    <div>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${MODE_COLOR[p.paymentMode] || '#6b7280'}18`, color: MODE_COLOR[p.paymentMode] || '#6b7280' }}>
                        {p.paymentMethodName || p.paymentMode}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#475569' }}>{p.order?.orderNumber}</div>
                    <div style={{ fontSize: 11, color: p.cleared ? '#059669' : p.submitted ? '#0891b2' : '#d97706', fontWeight: 700 }}>
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
          <div style={{ paddingBottom: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#0f172a' }}>Collect Payment</div>
            {selectedOrder && (
              <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 500, marginTop: 4 }}>
                Order #{selectedOrder.orderNumber} · {selectedOrder.customerName || selected?.businessName}
              </div>
            )}
          </div>
        }
        open={collectModal}
        onOk={handleCollect}
        onCancel={() => setCollectModal(false)}
        confirmLoading={collecting}
        okText={isPartial ? 'Record Partial' : 'Record Payment'}
        okButtonProps={{ style: { background: isPartial ? '#d97706' : '#059669', borderColor: isPartial ? '#d97706' : '#059669', fontWeight: 800, height: 42, borderRadius: 10 } }}
        cancelButtonProps={{ style: { height: 42, borderRadius: 10, fontWeight: 600 } }}
        width={460}
        centered
      >
        {selectedOrder && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
              {[
                { label: 'Order Total', value: formatINR(selectedOrder.totalAmount), color: '#0f172a' },
                { label: 'Paid So Far', value: formatINR(selectedOrder.paidAmount || 0), color: '#059669' },
                { label: 'Balance Due', value: formatINR(selectedOrder.balanceAmount), color: '#dc2626' },
              ].map(col => (
                <div key={col.label} style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 10px', textAlign: 'center', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, marginBottom: 5, textTransform: 'uppercase' }}>{col.label}</div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: col.color }}>{col.value}</div>
                </div>
              ))}
            </div>

            <Form form={form} layout="vertical" requiredMark={false}>
              <Form.Item name="amount" label={<span style={{ fontWeight: 700, color: '#475569' }}>Amount to Collect</span>}
                rules={[
                  { required: true, message: 'Please enter amount' },
                  { type: 'number', min: 0.01, message: 'Must be greater than zero' },
                  { validator: (_, v) => v && v > (selectedOrder?.balanceAmount || 0) ? Promise.reject('Cannot exceed balance') : Promise.resolve() },
                ]}
              >
                <InputNumber style={{ width: '100%' }} min={0.01} max={selectedOrder?.balanceAmount} precision={2} prefix="₹" placeholder="0.00" size="large" controls={false} />
              </Form.Item>

              {isPartial && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 12.5, color: '#92400e', fontWeight: 500 }}>
                  Partial Payment — {formatINR((selectedOrder.balanceAmount - (collectAmount || 0)))} will remain due.
                </div>
              )}

              <Form.Item name="paymentMethodId" label={<span style={{ fontWeight: 700, color: '#475569' }}>Payment Method</span>} rules={[{ required: true, message: 'Please select a method' }]}>
                <Select size="large" placeholder="Select payment method" style={{ borderRadius: 10 }}>
                  {methods.map((m: any) => (
                    <Select.Option key={m.id} value={m.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: MODE_COLOR[m.mode] || '#6b7280', display: 'inline-block' }} />
                        <span style={{ fontWeight: 600 }}>{m.name}</span>
                        <span style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase' }}>{m.mode}</span>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              {needsRef && (
                <Form.Item name="referenceNumber" label={<span style={{ fontWeight: 700, color: '#475569' }}>Reference Number</span>} rules={[{ required: true, message: 'Please enter reference' }]}>
                  <Input size="large" placeholder="Transaction ID / UTR" />
                </Form.Item>
              )}

              <Form.Item name="notes" label={<span style={{ fontWeight: 700, color: '#475569' }}>Notes (Optional)</span>} style={{ marginBottom: 0 }}>
                <Input.TextArea rows={2} placeholder="Any additional details..." style={{ borderRadius: 10 }} />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CustomerOutstandingPage;
