import React, { useState } from 'react';
import {
  Form, Input, InputNumber, Select, Modal, message, Divider, Spin, Grid, Skeleton,
} from 'antd';
import {
  WalletOutlined, CheckCircleOutlined, SendOutlined, InfoCircleOutlined,
  ArrowLeftOutlined, EditOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  useCollectPaymentMutation,
  useGetMyDayCollectionsQuery,
  useSubmitDayCollectionsMutation,
  useGetCustomerOutstandingQuery,
  useGetCustomerOrdersQuery,
  useGetCustomerPaymentHistoryQuery,
} from '../../store/api/paymentApi';
import { useGetPaymentMethodsQuery } from '../../store/api/paymentMethodApi';
import dayjs from 'dayjs';

const { useBreakpoint } = Grid;

const P = '#059669';
const REQUIRES_REFERENCE = ['UPI', 'CHEQUE', 'NEFT', 'RTGS'];
const MODE_COLOR: Record<string, string> = {
  CASH: '#059669', UPI: '#7c3aed', CHEQUE: '#d97706', NEFT: '#0891b2', RTGS: '#2563eb', CREDIT: '#ef4444',
};

const formatINR = (v: any) => `₹${Number(v || 0).toFixed(2)}`;

const SalesPaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showDetail, setShowDetail]       = useState(false);
  const [collectModal, setCollectModal]   = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const [search, setSearch]               = useState('');
  const [form] = Form.useForm();

  const { data: outstandingData, isLoading: outLoading, refetch: refetchOutstanding } = useGetCustomerOutstandingQuery();
  const { data: dayData,         isLoading: dayLoading,  refetch: refetchDay         } = useGetMyDayCollectionsQuery();
  const { data: ordersData,      isLoading: ordersLoading, refetch: refetchOrders    } = useGetCustomerOrdersQuery(
    selectedCustomerId!, { skip: !selectedCustomerId }
  );
  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useGetCustomerPaymentHistoryQuery(
    selectedCustomerId!, { skip: !selectedCustomerId }
  );
  const { data: methodsData, isLoading: methodsLoading } = useGetPaymentMethodsQuery();

  const [collectPayment, { isLoading: collecting }] = useCollectPaymentMutation();
  const [submitDay,      { isLoading: submitting  }] = useSubmitDayCollectionsMutation();

  const allCustomers: any[] = outstandingData?.data || [];
  const customers = allCustomers.filter(c =>
    !search || c.businessName.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );
  const unpaidOrders: any[]   = ordersData?.data || [];
  const paymentHistory: any[] = historyData?.data || [];
  const methods: any[]        = methodsData?.data || [];
  const daySummary            = dayData?.data;
  const selected              = allCustomers.find(c => c.customerId === selectedCustomerId);

  const collectAmount    = Form.useWatch('amount', form);
  const selectedMethodId = Form.useWatch('paymentMethodId', form);
  const selectedMethod   = methods.find(m => m.id === selectedMethodId);
  const needsRef         = selectedMethod && REQUIRES_REFERENCE.includes(selectedMethod.mode);
  const isPartial        = collectAmount != null && selectedOrder && collectAmount < selectedOrder.balanceAmount;

  const unsubmittedCount = (daySummary?.payments || []).filter((p: any) => !p.submitted).length;
  const alreadySubmitted = daySummary?.allSubmitted && (daySummary?.totalPayments || 0) > 0;
  const totalCollected   = Number(daySummary?.totalCollected || 0);

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

  // Mobile detail view
  if (isMobile && showDetail && selectedCustomerId && selected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => { setShowDetail(false); setSelectedCustomerId(null); }}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: 10, width: 38, height: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 16, flexShrink: 0 }}>
            <ArrowLeftOutlined />
          </button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{selected.businessName}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{selected.routeName} · {selected.phone}</div>
          </div>
        </div>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'Ordered', value: formatINR(selected.totalOrdered), color: '#0f172a' },
            { label: 'Paid',    value: formatINR(selected.totalPaid),    color: P },
            { label: 'Due',     value: formatINR(selected.outstanding),  color: '#dc2626' },
          ].map(s => (
            <div key={s.label} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Unpaid Orders */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>Unpaid Orders</div>
        {ordersLoading ? <Skeleton active paragraph={{ rows: 2 }} /> : unpaidOrders.length === 0 ? (
          <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '20px', textAlign: 'center', color: '#059669', fontWeight: 600 }}>All orders paid</div>
        ) : unpaidOrders.map((o: any) => (
          <div key={o.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #fee2e2', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{o.orderNumber}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{dayjs(o.orderDate).format('DD MMM YYYY')} · Total {formatINR(o.totalAmount)}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 14 }}>{formatINR(o.balanceAmount)}</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>due</div>
            </div>
            <button onClick={() => openCollect(o)}
              style={{ background: P, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 12, padding: '9px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <WalletOutlined style={{ fontSize: 12 }} /> Collect
            </button>
          </div>
        ))}

        {/* Payment History */}
        {paymentHistory.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>Payment History</div>
            {paymentHistory.slice().reverse().map((p: any) => (
              <div key={p.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#059669' }}>{formatINR(p.amount)}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{dayjs(p.collectionDate).format('DD MMM YYYY')} · {p.order?.orderNumber}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${MODE_COLOR[p.paymentMode] || '#6b7280'}18`, color: MODE_COLOR[p.paymentMode] || '#6b7280' }}>
                  {p.paymentMethodName || p.paymentMode}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  const customerListPanel = (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Search customer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ borderRadius: 8 }}
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
              padding: '13px 16px', cursor: 'pointer',
              borderBottom: i < customers.length - 1 ? '1px solid #f1f5f9' : 'none',
              background: isSelected ? '#eff6ff' : '#fff',
              transition: 'background 0.15s',
              display: 'flex', alignItems: 'center', gap: 10,
            }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isSelected ? '#eff6ff' : '#fff'; }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#475569', fontSize: 13, flexShrink: 0 }}>
              {c.businessName?.[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.businessName}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{c.routeName} · {c.orderCount} order{c.orderCount !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 13 }}>{formatINR(c.outstanding)}</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>outstanding</div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const detailPanel = selectedCustomerId && selected ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Customer card */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{selected.businessName}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {selected.ownerName} · {selected.phone}
              {selected.lastPaymentDate && ` · Last paid: ${dayjs(selected.lastPaymentDate).format('DD MMM YYYY')}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { label: 'Ordered', value: formatINR(selected.totalOrdered), color: '#0f172a' },
              { label: 'Paid',    value: formatINR(selected.totalPaid),    color: P },
              { label: 'Due',     value: formatINR(selected.outstanding),  color: '#dc2626' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Unpaid orders */}
      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>Unpaid Orders</div>
      {ordersLoading ? <Skeleton active paragraph={{ rows: 2 }} /> : (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 80px 80px 80px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '10px 14px' }}>
            {['Date', 'Order #', 'Total', 'Balance', ''].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6 }}>{h}</div>
            ))}
          </div>
          {unpaidOrders.length === 0 ? (
            <div style={{ padding: '28px 14px', textAlign: 'center', color: '#94a3b8' }}>All orders paid</div>
          ) : unpaidOrders.map((o: any, i: number) => (
            <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 80px 80px 80px', padding: '11px 14px', alignItems: 'center', borderBottom: i < unpaidOrders.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>{dayjs(o.orderDate).format('DD MMM YYYY')}</div>
              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 12 }}>{o.orderNumber}</div>
              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 12 }}>{formatINR(o.totalAmount)}</div>
              <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 12 }}>{formatINR(o.balanceAmount)}</div>
              <button onClick={() => openCollect(o)}
                style={{ background: P, border: 'none', borderRadius: 7, color: '#fff', fontWeight: 700, fontSize: 11, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <WalletOutlined style={{ fontSize: 11 }} /> Collect
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Payment history */}
      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, marginTop: 4 }}>Payment History</div>
      {historyLoading ? <Skeleton active paragraph={{ rows: 2 }} /> : (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 80px 1fr 80px 70px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '10px 14px' }}>
            {['Date', 'Amount', 'Method', 'Order', 'Status'].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6 }}>{h}</div>
            ))}
          </div>
          {paymentHistory.length === 0 ? (
            <div style={{ padding: '28px 14px', textAlign: 'center', color: '#94a3b8' }}>No payments recorded</div>
          ) : paymentHistory.slice().reverse().map((p: any, i: number) => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '90px 80px 1fr 80px 70px', padding: '10px 14px', alignItems: 'center', borderBottom: i < paymentHistory.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>{dayjs(p.collectionDate).format('DD MMM YYYY')}</div>
              <div style={{ fontWeight: 800, color: '#059669', fontSize: 13 }}>{formatINR(p.amount)}</div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: `${MODE_COLOR[p.paymentMode] || '#6b7280'}18`, color: MODE_COLOR[p.paymentMode] || '#6b7280', width: 'fit-content' }}>
                {p.paymentMethodName || p.paymentMode}
              </span>
              <div style={{ fontSize: 11, color: '#475569' }}>{p.order?.orderNumber}</div>
              <div style={{ fontSize: 10, color: p.cleared ? '#059669' : p.submitted ? '#0891b2' : '#d97706', fontWeight: 700 }}>
                {p.cleared ? 'Cleared' : p.submitted ? 'Submitted' : 'Pending'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  ) : (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px dashed #e2e8f0', padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
      <WalletOutlined style={{ fontSize: 32, marginBottom: 12 }} />
      <div style={{ fontWeight: 600 }}>Select a customer to view details and collect payment</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/sales/dashboard')}
          style={{ background: '#f1f5f9', border: 'none', borderRadius: 10, width: 38, height: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 16, flexShrink: 0 }}>
          <ArrowLeftOutlined />
        </button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: -0.3 }}>Payments</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
            {allCustomers.length} customers with outstanding · {daySummary?.totalPayments || 0} collected today
          </div>
        </div>
      </div>

      {/* Day Summary */}
      {(daySummary?.totalPayments || 0) > 0 && (
        <div style={{
          background: alreadySubmitted ? '#f0fdf4' : '#fffbeb',
          border: `1.5px solid ${alreadySubmitted ? '#a7f3d0' : '#fde68a'}`,
          borderRadius: 16, padding: '14px 18px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: alreadySubmitted ? '#059669' : '#92400e' }}>
                {alreadySubmitted ? '✓ Submitted to Accountant' : "Today's Collections"}
              </div>
              <div style={{ fontSize: 11, color: alreadySubmitted ? '#6ee7b7' : '#b45309', marginTop: 1 }}>
                {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              </div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: alreadySubmitted ? '#bbf7d0' : '#fde68a', color: alreadySubmitted ? '#065f46' : '#92400e', flexShrink: 0, marginLeft: 8 }}>
              {alreadySubmitted ? 'DONE' : 'PENDING'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 14px', marginBottom: 10 }}>
            {[
              { label: 'Cash',   key: 'cashAmount',   color: MODE_COLOR.CASH   },
              { label: 'UPI',    key: 'upiAmount',    color: MODE_COLOR.UPI    },
              { label: 'Cheque', key: 'chequeAmount', color: MODE_COLOR.CHEQUE },
              { label: 'NEFT',   key: 'neftAmount',   color: MODE_COLOR.NEFT   },
              { label: 'RTGS',   key: 'rtgsAmount',   color: MODE_COLOR.RTGS   },
              { label: 'Credit', key: 'creditAmount', color: MODE_COLOR.CREDIT },
            ].filter(s => (daySummary?.[s.key] || 0) > 0).map(s => (
              <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>{s.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{formatINR(daySummary?.[s.key] || 0)}</span>
              </div>
            ))}
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Total Collected</div>
              <div style={{ fontWeight: 800, fontSize: 20, color: '#0f172a' }}>{formatINR(totalCollected)}</div>
            </div>
            {!alreadySubmitted && unsubmittedCount > 0 && (
              <button onClick={() => setSubmitConfirm(true)}
                style={{ background: '#d97706', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 13, padding: '9px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(217,119,6,0.3)', whiteSpace: 'nowrap' }}>
                <SendOutlined style={{ fontSize: 13 }} />
                Submit ({unsubmittedCount})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Customer Outstanding — two panel */}
      <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
        Customer Outstanding ({allCustomers.length})
      </div>

      {isMobile ? (
        customerListPanel
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>
          {customerListPanel}
          {detailPanel}
        </div>
      )}

      {/* Collect Payment Modal */}
      <Modal
        title={
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Collect Payment</div>
            {selectedOrder && (
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
                #{selectedOrder.orderNumber} · {selected?.businessName}
              </div>
            )}
          </div>
        }
        open={collectModal}
        onOk={handleCollect}
        onCancel={() => setCollectModal(false)}
        confirmLoading={collecting}
        okText={isPartial ? 'Collect Partial' : 'Collect Full Payment'}
        okButtonProps={{ style: { background: isPartial ? '#d97706' : P, borderColor: isPartial ? '#d97706' : P, fontWeight: 700 } }}
        width={440}
      >
        {selectedOrder && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 18 }}>
              {[
                { label: 'Order Total', value: formatINR(selectedOrder.totalAmount),   color: '#0f172a' },
                { label: 'Paid So Far', value: formatINR(selectedOrder.paidAmount || 0), color: P },
                { label: 'Balance Due', value: formatINR(selectedOrder.balanceAmount), color: '#ef4444' },
              ].map(col => (
                <div key={col.label} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginBottom: 3 }}>{col.label}</div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: col.color }}>{col.value}</div>
                </div>
              ))}
            </div>

            <Form form={form} layout="vertical">
              <Form.Item name="amount"
                label={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><EditOutlined style={{ fontSize: 12, color: '#64748b' }} />Amount to Collect</span>}
                rules={[
                  { required: true, message: 'Enter amount' },
                  { type: 'number', min: 0.01, message: 'Must be greater than ₹0' },
                  { validator: (_, v) => v && v > (selectedOrder?.balanceAmount || 0) ? Promise.reject('Cannot exceed balance') : Promise.resolve() },
                ]}
              >
                <InputNumber style={{ width: '100%' }} size="large" min={0.01} max={selectedOrder?.balanceAmount} precision={2} prefix="₹" placeholder="0.00" />
              </Form.Item>

              <div style={{ display: 'flex', gap: 8, marginTop: -8, marginBottom: 16 }}>
                {[25, 50, 75].map(pct => (
                  <button key={pct} type="button"
                    onClick={() => form.setFieldsValue({ amount: parseFloat((selectedOrder.balanceAmount * pct / 100).toFixed(2)) })}
                    style={{ flex: 1, height: 38, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                    {pct}%
                  </button>
                ))}
                <button type="button"
                  onClick={() => form.setFieldsValue({ amount: selectedOrder.balanceAmount })}
                  style={{ flex: 1, height: 38, border: '1px solid #a7f3d0', borderRadius: 8, background: '#ecfdf5', color: P, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  Full
                </button>
              </div>

              {isPartial && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#92400e' }}>
                  Partial — {formatINR(selectedOrder.balanceAmount - (collectAmount || 0))} will remain outstanding.
                </div>
              )}

              <Form.Item name="paymentMethodId" label="Payment Method *" rules={[{ required: true, message: 'Select a payment method' }]}>
                <Select size="large" placeholder="Select payment method" loading={methodsLoading}>
                  {methods.map((m: any) => (
                    <Select.Option key={m.id} value={m.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: MODE_COLOR[m.mode] || '#6b7280', display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600 }}>{m.name}</span>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{m.mode}</span>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              {needsRef && (
                <Form.Item name="referenceNumber" label="Reference Number *" rules={[{ required: true, message: 'Enter reference' }]}>
                  <Input size="large" placeholder={
                    selectedMethod?.mode === 'UPI' ? 'UPI Transaction ID'
                    : selectedMethod?.mode === 'CHEQUE' ? 'Cheque Number'
                    : (selectedMethod?.mode === 'NEFT' || selectedMethod?.mode === 'RTGS') ? 'UTR Number (e.g. KKBK24...)'
                    : 'Transaction Reference'
                  } />
                </Form.Item>
              )}
              <Form.Item name="notes" label="Notes (optional)" style={{ marginBottom: 0 }}>
                <Input.TextArea rows={2} placeholder="Any additional remarks..." style={{ borderRadius: 8 }} />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* Submit Confirm */}
      <Modal
        title="Submit Day Collections"
        open={submitConfirm}
        onOk={handleSubmitDay}
        onCancel={() => setSubmitConfirm(false)}
        confirmLoading={submitting}
        okText="Yes, Submit Now"
        okButtonProps={{ style: { background: '#d97706', borderColor: '#d97706', fontWeight: 700 } }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 0' }}>
          <InfoCircleOutlined style={{ color: '#d97706', fontSize: 22, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Submit {unsubmittedCount} payment(s)?</div>
            <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>
              Total <strong>{formatINR(totalCollected)}</strong> will be handed over to the accountant for verification.
              You cannot edit or delete these payments after submission.
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SalesPaymentPage;
