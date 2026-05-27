import React, { useState } from 'react';
import {
  Form, Input, InputNumber, Select, Modal, message, Divider, Spin, Grid, Skeleton,
} from 'antd';
import {
  WalletOutlined, SendOutlined, CheckCircleOutlined, InfoCircleOutlined,
  ArrowLeftOutlined, SearchOutlined, EditOutlined,
} from '@ant-design/icons';
import {
  useCollectPaymentMutation,
  useGetMyDayCollectionsQuery,
  useSubmitDayCollectionsMutation,
  useGetOutstandingSummaryQuery,
  useGetCustomerOrdersQuery,
  useGetCustomerPaymentHistoryQuery,
} from '../../store/api/paymentApi';
import { useGetPaymentMethodsQuery } from '../../store/api/paymentMethodApi';
import dayjs from 'dayjs';

const { useBreakpoint } = Grid;

const P = '#059669';
const PD = '#047857';
const PL = '#ecfdf5';
const REQUIRES_REFERENCE = ['UPI', 'CHEQUE', 'NEFT', 'RTGS'];
const MODE_COLOR: Record<string, string> = {
  CASH: '#059669', UPI: '#7c3aed', CHEQUE: '#d97706', NEFT: '#0891b2', RTGS: '#2563eb', CREDIT: '#ef4444',
};

const formatINR = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DeliveryPaymentsPage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [collectModal, setCollectModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const [search, setSearch] = useState('');
  const [form] = Form.useForm();

  const { data: outstandingData, isLoading: outLoading, refetch: refetchOutstanding } = useGetOutstandingSummaryQuery();
  const { data: dayData, isLoading: dayLoading, refetch: refetchDay } = useGetMyDayCollectionsQuery();
  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useGetCustomerOrdersQuery(
    selectedCustomerId!, { skip: !selectedCustomerId }
  );
  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useGetCustomerPaymentHistoryQuery(
    selectedCustomerId!, { skip: !selectedCustomerId }
  );
  const { data: methodsData, isLoading: methodsLoading } = useGetPaymentMethodsQuery();

  const [collectPayment, { isLoading: collecting }] = useCollectPaymentMutation();
  const [submitDay, { isLoading: submitting }] = useSubmitDayCollectionsMutation();

  const allCustomers: any[] = outstandingData?.data || [];
  const customers = allCustomers.filter(c =>
    !search || c.businessName.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );
  const unpaidOrders: any[] = ordersData?.data || [];
  const paymentHistory: any[] = historyData?.data || [];
  const methods: any[] = methodsData?.data || [];
  const daySummary = dayData?.data;
  const selected = allCustomers.find(c => c.customerId === selectedCustomerId);

  const collectAmount = Form.useWatch('amount', form);
  const selectedMethodId = Form.useWatch('paymentMethodId', form);
  const selectedMethod = methods.find(m => m.id === selectedMethodId);
  const needsRef = selectedMethod && REQUIRES_REFERENCE.includes(selectedMethod.mode);
  const isPartial = collectAmount != null && selectedOrder && collectAmount < selectedOrder.balanceAmount;

  const unsubmittedCount = (daySummary?.payments || []).filter((p: any) => !p.submitted).length;
  const alreadySubmitted = daySummary?.allSubmitted && (daySummary?.totalPayments || 0) > 0;
  const totalCollected = Number(daySummary?.totalCollected || 0);

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
      message.success(isPartial ? 'Partial payment collected!' : 'Payment collected!');
      setCollectModal(false);
      refetchDay();
      refetchOutstanding();
      refetchOrders();
      refetchHistory();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.data?.message || 'Failed to collect payment');
    }
  };

  const handleSubmitDay = async () => {
    try {
      await submitDay().unwrap();
      message.success('Collections submitted to accountant!');
      setSubmitConfirm(false);
      refetchDay();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to submit');
      setSubmitConfirm(false);
    }
  };

  const selectCustomer = (id: string) => {
    setSelectedCustomerId(id);
    if (isMobile) setShowDetail(true);
  };

  if (dayLoading || outLoading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  }

  const customerListPanel = (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Search customer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ borderRadius: 10, height: 40 }}
          allowClear
        />
      </div>
      {customers.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
          {allCustomers.length === 0 ? 'No outstanding balances' : 'No match found'}
        </div>
      ) : customers.map((c: any, i: number) => {
        const isSelected = c.customerId === selectedCustomerId;
        return (
          <div key={c.customerId}
            onClick={() => selectCustomer(c.customerId)}
            style={{
              padding: '14px 16px', cursor: 'pointer',
              borderBottom: i < customers.length - 1 ? '1px solid #f1f5f9' : 'none',
              background: isSelected ? '#eff6ff' : '#fff',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: 12,
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: isSelected ? P : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: isSelected ? '#fff' : '#475569', fontSize: 14, flexShrink: 0 }}>
              {c.businessName?.[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.businessName}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{c.routeName} · {c.orderCount} order{c.orderCount !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 13 }}>{formatINR(c.outstanding)}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>DUE</div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const detailPanel = selectedCustomerId && selected ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{selected.businessName}</div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>
              {selected.ownerName} · {selected.phone}
              {selected.lastPaymentDate && ` · Last paid: ${dayjs(selected.lastPaymentDate).format('DD MMM YYYY')}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { label: 'Ordered', value: formatINR(selected.totalOrdered), color: '#0f172a' },
              { label: 'Paid', value: formatINR(selected.totalPaid), color: P },
              { label: 'Due', value: formatINR(selected.outstanding), color: '#dc2626' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: s.color, marginTop: 1 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, marginLeft: 4 }}>Unpaid Orders</div>
      {ordersLoading ? <Skeleton active paragraph={{ rows: 2 }} /> : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 90px 90px 90px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 16px', minWidth: 450 }}>
              {['Date', 'Order #', 'Total', 'Balance', ''].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
              ))}
            </div>
            {unpaidOrders.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>All orders paid</div>
            ) : unpaidOrders.map((o: any, i: number) => (
              <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 90px 90px 90px', padding: '12px 16px', alignItems: 'center', borderBottom: i < unpaidOrders.length - 1 ? '1px solid #f1f5f9' : 'none', minWidth: 450 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>{dayjs(o.orderDate).format('DD MMM YYYY')}</div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{o.orderNumber}</div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{formatINR(o.totalAmount)}</div>
                <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 13 }}>{formatINR(o.balanceAmount)}</div>
                <button onClick={() => openCollect(o)}
                  style={{ background: P, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 11, padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <WalletOutlined style={{ fontSize: 12 }} /> Collect
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, marginTop: 6, marginLeft: 4 }}>Payment History</div>
      {historyLoading ? <Skeleton active paragraph={{ rows: 2 }} /> : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 90px 1fr 90px 80px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 16px', minWidth: 450 }}>
              {['Date', 'Amount', 'Method', 'Order', 'Status'].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
              ))}
            </div>
            {paymentHistory.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>No payments recorded</div>
            ) : paymentHistory.slice().reverse().map((p: any, i: number) => (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '100px 90px 1fr 90px 80px', padding: '12px 16px', alignItems: 'center', borderBottom: i < paymentHistory.length - 1 ? '1px solid #f1f5f9' : 'none', minWidth: 450 }}>
                <div style={{ fontSize: 11, color: '#64748b' }}>{dayjs(p.collectionDate).format('DD MMM YYYY')}</div>
                <div style={{ fontWeight: 800, color: '#059669', fontSize: 13 }}>{formatINR(p.amount)}</div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: `${MODE_COLOR[p.paymentMode] || '#6b7280'}18`, color: MODE_COLOR[p.paymentMode] || '#6b7280', width: 'fit-content' }}>
                  {p.paymentMethodName || p.paymentMode}
                </span>
                <div style={{ fontSize: 11, color: '#475569' }}>{p.order?.orderNumber}</div>
                <div style={{ fontSize: 10, color: p.cleared ? '#059669' : p.submitted ? '#0891b2' : '#d97706', fontWeight: 700 }}>
                  {p.cleared ? 'Cleared' : p.submitted ? 'Submitted' : 'Pending'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  ) : (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px dashed #e2e8f0', padding: '80px 20px', textAlign: 'center', color: '#94a3b8' }}>
      <WalletOutlined style={{ fontSize: 36, marginBottom: 14, color: '#cbd5e1' }} />
      <div style={{ fontWeight: 600, fontSize: 14 }}>Select a customer to view details and record payment</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Main Page Content wrapper */}
      {isMobile && showDetail && selectedCustomerId && selected ? (
        /* Mobile Detail View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
            <button onClick={() => { setShowDetail(false); setSelectedCustomerId(null); }}
              style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, width: 42, height: 42, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 18, flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <ArrowLeftOutlined />
            </button>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{selected.businessName}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: 500 }}>{selected.routeName} · {selected.phone}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Ordered', value: formatINR(selected.totalOrdered), color: '#0f172a' },
              { label: 'Paid', value: formatINR(selected.totalPaid), color: P },
              { label: 'Due', value: formatINR(selected.outstanding), color: '#dc2626' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '12px 10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4 }}>Unpaid Orders</div>
          {ordersLoading ? <Skeleton active paragraph={{ rows: 2 }} /> : unpaidOrders.length === 0 ? (
            <div style={{ background: '#f0fdf4', borderRadius: 14, padding: '24px', textAlign: 'center', color: '#059669', fontWeight: 600, border: '1px solid #dcfce7' }}>All orders paid</div>
          ) : unpaidOrders.map((o: any) => (
            <div key={o.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13.5 }}>{o.orderNumber}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{dayjs(o.orderDate).format('DD MMM YYYY')} · Total {formatINR(o.totalAmount)}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 8 }}>
                <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 14 }}>{formatINR(o.balanceAmount)}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>DUE</div>
              </div>
              <button onClick={() => openCollect(o)}
                style={{ background: P, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 12, padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, boxShadow: `0 3px 10px ${P}33` }}>
                <WalletOutlined style={{ fontSize: 13 }} />
              </button>
            </div>
          ))}

          {paymentHistory.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 6 }}>Payment History</div>
              {paymentHistory.slice().reverse().map((p: any) => (
                <div key={p.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#059669' }}>{formatINR(p.amount)}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{dayjs(p.collectionDate).format('DD MMM YYYY')} · {p.order?.orderNumber}</div>
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${MODE_COLOR[p.paymentMode] || '#6b7280'}18`, color: MODE_COLOR[p.paymentMode] || '#6b7280' }}>
                    {p.paymentMethodName || p.paymentMode}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        /* Standard View (List + Stats) */
        <>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 0' }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: P, fontSize: 18, flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <WalletOutlined />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>My Collections</div>
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2, fontWeight: 500 }}>
                {allCustomers.length} customers with outstanding · {daySummary?.totalPayments || 0} collected today
              </div>
            </div>
          </div>

          {/* Day Summary - Premium Card */}
          {(daySummary?.totalPayments || 0) > 0 && (
            <div style={{
              background: alreadySubmitted ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: `1px solid ${alreadySubmitted ? '#bbf7d0' : '#fde68a'}`,
              borderRadius: 20, padding: '18px 22px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
              position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: -15, right: -15, width: 80, height: 80, borderRadius: '50%', background: alreadySubmitted ? 'rgba(5,150,105,0.05)' : 'rgba(217,119,6,0.05)' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: alreadySubmitted ? '#065f46' : '#92400e', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {alreadySubmitted ? '✓ Collections Submitted' : "Today's Collections"}
                  </div>
                  <div style={{ fontSize: 12, color: alreadySubmitted ? '#059669' : '#b45309', marginTop: 2, fontWeight: 500 }}>
                    {daySummary?.totalPayments || 0} payment recorded today
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 12px', borderRadius: 20, background: alreadySubmitted ? '#86efac' : '#fbbf24', color: alreadySubmitted ? '#065f46' : '#92400e', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                  {alreadySubmitted ? 'COMPLETED' : `${unsubmittedCount} PENDING`}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px 24px', marginBottom: 18 }}>
                {[
                  { label: 'Cash', key: 'cashAmount', color: MODE_COLOR.CASH },
                  { label: 'UPI', key: 'upiAmount', color: MODE_COLOR.UPI },
                  { label: 'Cheque', key: 'chequeAmount', color: MODE_COLOR.CHEQUE },
                  { label: 'NEFT', key: 'neftAmount', color: MODE_COLOR.NEFT },
                  { label: 'RTGS', key: 'rtgsAmount', color: MODE_COLOR.RTGS },
                  { label: 'Credit', key: 'creditAmount', color: MODE_COLOR.CREDIT },
                ].filter(s => (daySummary?.[s.key] || 0) > 0).map(s => (
                  <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
                      <span style={{ fontSize: 12, color: '#4b5563', fontWeight: 600 }}>{s.label}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: s.color }}>{formatINR(daySummary?.[s.key] || 0)}</span>
                  </div>
                ))}
              </div>

              <Divider style={{ margin: '0 0 16px', opacity: 0.1, borderColor: '#000' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Collected</div>
                  <div style={{ fontWeight: 900, fontSize: 26, color: '#0f172a', letterSpacing: -0.5 }}>{formatINR(totalCollected)}</div>
                </div>
                {!alreadySubmitted && unsubmittedCount > 0 && (
                  <button onClick={() => setSubmitConfirm(true)}
                    style={{ background: '#d97706', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 800, fontSize: 14, padding: '12px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 12px rgba(217,119,6,0.3)', transition: 'transform 0.2s' }}>
                    <SendOutlined style={{ fontSize: 14 }} />
                    Submit Handover ({unsubmittedCount})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Customer Outstanding Section */}
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginLeft: 4 }}>
            Customer Outstanding ({allCustomers.length})
          </div>

          {isMobile ? (
            customerListPanel
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'start' }}>
              {customerListPanel}
              {detailPanel}
            </div>
          )}
        </>
      )}

      {/* MODALS - Always in DOM */}
      <Modal
        title={
          <div style={{ paddingBottom: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#0f172a' }}>Collect Payment</div>
            {selectedOrder && (
              <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 500, marginTop: 4 }}>
                Order #{selectedOrder.orderNumber} · {selected?.businessName}
              </div>
            )}
          </div>
        }
        open={collectModal}
        onOk={handleCollect}
        onCancel={() => setCollectModal(false)}
        confirmLoading={collecting}
        okText={isPartial ? 'Collect Partial' : 'Collect Full Payment'}
        okButtonProps={{ style: { background: isPartial ? '#d97706' : P, borderColor: isPartial ? '#d97706' : P, fontWeight: 800, height: 42, borderRadius: 10 } }}
        cancelButtonProps={{ style: { height: 42, borderRadius: 10, fontWeight: 600 } }}
        width={460}
        centered
        styles={{ body: { paddingTop: 12 } }}
      >
        {selectedOrder && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
              {[
                { label: 'Order Total', value: formatINR(selectedOrder.totalAmount), color: '#0f172a' },
                { label: 'Paid So Far', value: formatINR(selectedOrder.paidAmount || 0), color: P },
                { label: 'Balance Due', value: formatINR(selectedOrder.balanceAmount), color: '#ef4444' },
              ].map(col => (
                <div key={col.label} style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 10px', textAlign: 'center', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, marginBottom: 5, textTransform: 'uppercase' }}>{col.label}</div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: col.color }}>{col.value}</div>
                </div>
              ))}
            </div>

            <Form form={form} layout="vertical" requiredMark={false}>
              <Form.Item name="amount"
                label={<span style={{ fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}><EditOutlined style={{ fontSize: 14 }} />Amount to Collect</span>}
                rules={[
                  { required: true, message: 'Please enter amount' },
                  { type: 'number', min: 0.01, message: 'Must be greater than zero' },
                  { validator: (_, v) => v && v > (selectedOrder?.balanceAmount || 0) ? Promise.reject('Cannot exceed balance amount') : Promise.resolve() },
                ]}
              >
                <InputNumber style={{ width: '100%' }} size="large" min={0.01} max={selectedOrder?.balanceAmount} precision={2} prefix="₹" placeholder="0.00" controls={false} />
              </Form.Item>

              {isPartial && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 12.5, color: '#92400e', fontWeight: 500 }}>
                  <InfoCircleOutlined style={{ marginRight: 6 }} /> Partial Payment — {formatINR(selectedOrder.balanceAmount - (collectAmount || 0))} will remain due.
                </div>
              )}

              <Form.Item name="paymentMethodId" label={<span style={{ fontWeight: 700, color: '#475569' }}>Payment Method</span>} rules={[{ required: true, message: 'Please select a method' }]}>
                <Select size="large" placeholder="Select payment method" loading={methodsLoading} style={{ borderRadius: 10 }}>
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
                  <Input size="large" placeholder={
                    selectedMethod?.mode === 'UPI' ? 'Transaction ID / UTR'
                      : selectedMethod?.mode === 'CHEQUE' ? 'Cheque Number'
                        : 'Transaction Reference'
                  } />
                </Form.Item>
              )}

              <Form.Item name="notes" label={<span style={{ fontWeight: 700, color: '#475569' }}>Notes (Optional)</span>} style={{ marginBottom: 0 }}>
                <Input.TextArea rows={2} placeholder="Any additional details..." style={{ borderRadius: 10 }} />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* Submit Confirm */}
      <Modal
        title={null}
        open={submitConfirm}
        onOk={handleSubmitDay}
        onCancel={() => setSubmitConfirm(false)}
        confirmLoading={submitting}
        okText="Yes, Submit Now"
        okButtonProps={{ style: { background: '#d97706', borderColor: '#d97706', fontWeight: 800, height: 42, borderRadius: 10 } }}
        cancelButtonProps={{ style: { height: 42, borderRadius: 10, fontWeight: 600 } }}
        centered
        width={400}
      >
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <InfoCircleOutlined style={{ color: '#d97706', fontSize: 28 }} />
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a', marginBottom: 8 }}>Submit Collections?</div>
          <div style={{ color: '#64748b', fontSize: 14, lineHeight: 1.5, marginBottom: 10 }}>
            You are about to submit <strong>{unsubmittedCount} payment(s)</strong> totaling <strong>{formatINR(totalCollected)}</strong> to the accountant.
            This action cannot be undone.
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DeliveryPaymentsPage;
