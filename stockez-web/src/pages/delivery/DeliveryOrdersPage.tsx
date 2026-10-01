import React, { useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, message, Skeleton, Grid } from 'antd';
import {
  TruckOutlined, CheckCircleOutlined, WalletOutlined, EnvironmentOutlined,
  PhoneOutlined, ShoppingOutlined, CompassOutlined,
} from '@ant-design/icons';
import { useGetMyDeliveriesQuery, useMarkDeliveredMutation, useDispatchOrderMutation, useReturnToWarehouseMutation, useMarkShopClosedMutation } from '../../store/api/orderApi';
import { useCollectPaymentMutation } from '../../store/api/paymentApi';
import { useGetPaymentMethodsQuery } from '../../store/api/paymentMethodApi';

const { useBreakpoint } = Grid;

const P = '#059669';
const PL = '#ecfdf5';
const REQUIRES_REF = ['UPI', 'CHEQUE', 'NEFT', 'RTGS'];
const MODE_COLOR: Record<string, string> = {
  CASH: '#059669', UPI: '#7c3aed', CHEQUE: '#d97706', NEFT: '#0891b2', RTGS: '#2563eb', CREDIT: '#ef4444',
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg: Record<string, { color: string; bg: string; label: string }> = {
    PACKED:                { color: '#d97706', bg: '#fef3c7', label: '📦 PACKED'              },
    DISPATCHED:            { color: P,         bg: PL,         label: '🚚 DISPATCHED'          },
    DELIVERED:             { color: '#059669', bg: '#ecfdf5', label: '✓ DELIVERED'            },
    RETURN_TO_WAREHOUSE:   { color: '#dc2626', bg: '#fef2f2', label: '↩ RETURN TO WAREHOUSE'  },
  };
  const s = cfg[status] || { color: '#64748b', bg: '#f3f4f6', label: status };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
};

const openDirections = (customer: any) => {
  if (customer?.latitude && customer?.longitude) {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${customer.latitude},${customer.longitude}`,
      '_blank'
    );
  } else if (customer?.address) {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`,
      '_blank'
    );
  }
};

const DeliveryOrdersPage: React.FC = () => {
  const screens = useBreakpoint();
  const isSmallPhone = !screens.sm;

  const [payModal, setPayModal]                 = useState(false);
  const [selectedOrder, setSelectedOrder]       = useState<any>(null);
  const [deliverConfirmId, setDeliverConfirmId] = useState<string | null>(null);
  const [returnConfirmId,  setReturnConfirmId]  = useState<string | null>(null);
  const [form] = Form.useForm();

  const { data: deliveriesData, isLoading, refetch } = useGetMyDeliveriesQuery(undefined, { refetchOnMountOrArgChange: true });
  const { data: methodsData }                        = useGetPaymentMethodsQuery();
  const [dispatchOrder, { isLoading: dispatching }]      = useDispatchOrderMutation();
  const [markDelivered, { isLoading: delivering }]       = useMarkDeliveredMutation();
  const [returnToWarehouse, { isLoading: returning }]    = useReturnToWarehouseMutation();
  const [markShopClosed, { isLoading: markingClosed }]   = useMarkShopClosedMutation();
  const [collectPayment, { isLoading: collecting }]  = useCollectPaymentMutation();

  const orders: any[] = deliveriesData?.data || [];
  const methods: any[] = methodsData?.data || [];

  const selectedMethodId = Form.useWatch('paymentMethodId', form);
  const selectedMethod   = methods.find(m => m.id === selectedMethodId);
  const needsRef         = selectedMethod && REQUIRES_REF.includes(selectedMethod.mode);

  const handleDispatch = async (id: string) => {
    try {
      await dispatchOrder(id).unwrap();
      message.success('Order dispatched!');
      refetch();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to dispatch');
    }
  };

  const handleMarkDelivered = async (id: string) => {
    try {
      await markDelivered(id).unwrap();
      message.success('Order marked as delivered!');
      setDeliverConfirmId(null);
      refetch();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to mark delivered');
    }
  };

  const handleReturnToWarehouse = async (id: string) => {
    try {
      await returnToWarehouse(id).unwrap();
      message.success('Order returned to warehouse');
      setReturnConfirmId(null);
      refetch();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to return');
    }
  };

  const handleShopClosed = async (id: string) => {
    try {
      await markShopClosed(id).unwrap();
      message.success('Marked shop closed — retry this stop anytime today');
      refetch();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to update');
    }
  };

  const openPay = (order: any) => {
    setSelectedOrder(order);
    form.resetFields();
    form.setFieldsValue({ amount: order.balanceAmount });
    setPayModal(true);
  };

  const handleCollect = async () => {
    try {
      const values = await form.validateFields();
      if (values.amount > (selectedOrder?.balanceAmount || 0)) {
        message.error(`Amount cannot exceed balance of ₹${selectedOrder?.balanceAmount?.toFixed(2)}`);
        return;
      }
      await collectPayment({
        orderId: selectedOrder.id,
        amount: values.amount,
        paymentMethodId: values.paymentMethodId,
        referenceNumber: values.referenceNumber,
        notes: values.notes,
      }).unwrap();
      message.success('Payment collected!');
      setPayModal(false);
      refetch();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.data?.message || 'Failed to collect payment');
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>My Deliveries</div>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px' }}>
            <Skeleton active paragraph={{ rows: 3 }} />
          </div>
        ))}
      </div>
    );
  }

  const pending = orders.filter(o => o.status !== 'DELIVERED');
  const done    = orders.filter(o => o.status === 'DELIVERED');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Title */}
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: -0.3 }}>My Deliveries</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
          {pending.length} pending · {done.length} delivered today
        </div>
      </div>

      {orders.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '56px 20px', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: PL, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 32, color: P }}>
            <TruckOutlined />
          </div>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 16 }}>No deliveries assigned</div>
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Check back later or contact your manager.</div>
        </div>
      ) : (
        [...pending, ...done].map((order: any) => {
          const isDelivered  = order.status === 'DELIVERED';
          const isPacked     = order.status === 'PACKED';
          const isDispatched = order.status === 'DISPATCHED';
          const hasBalance   = (order.balanceAmount || 0) > 0;

          return (
            <div key={order.id} style={{
              background: '#fff',
              border: `1px solid ${isDelivered ? '#a7f3d0' : '#e2e8f0'}`,
              borderRadius: 16, overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              opacity: isDelivered ? 0.88 : 1,
            }}>
              {/* Status accent bar */}
              <div style={{ height: 4, background: isDelivered ? '#059669' : isDispatched ? P : '#d97706' }} />

              <div style={{ padding: '14px 16px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {order.customer?.businessName}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>#{order.orderNumber}</div>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                {/* Address + Phone + Directions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
                      {order.customer?.address && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <EnvironmentOutlined style={{ color: '#94a3b8', fontSize: 12, marginTop: 2, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: '#475569', lineHeight: 1.4 }}>{order.customer.address}</span>
                        </div>
                      )}
                      {order.customer?.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <PhoneOutlined style={{ color: '#94a3b8', fontSize: 12, flexShrink: 0 }} />
                          <a href={`tel:${order.customer.phone}`} style={{ fontSize: 12, color: P, textDecoration: 'none', fontWeight: 600 }}>
                            {order.customer.phone}
                          </a>
                        </div>
                      )}
                    </div>
                    {(order.customer?.latitude || order.customer?.address) && !isDelivered && (
                      <button
                        onClick={() => openDirections(order.customer)}
                        style={{
                          flexShrink: 0,
                          display: 'flex', alignItems: 'center', gap: 5,
                          background: '#1d4ed8', color: '#fff',
                          border: 'none', borderRadius: 8,
                          fontWeight: 700, fontSize: 11,
                          padding: '7px 12px', cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(29,78,216,0.3)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <CompassOutlined style={{ fontSize: 13 }} />
                        Directions
                      </button>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <ShoppingOutlined style={{ color: '#64748b', fontSize: 12 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>{order.items?.length || 0} items</span>
                  </div>
                  {(order.items || []).slice(0, 3).map((item: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 3 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{item.product?.name}</span>
                      <span style={{ fontWeight: 700, flexShrink: 0 }}>×{item.quantity}</span>
                    </div>
                  ))}
                  {(order.items?.length || 0) > 3 && (
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>+{order.items.length - 3} more</div>
                  )}
                </div>

                {/* Amount */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 14, padding: '10px 14px',
                  background: hasBalance ? '#fef2f2' : '#f0fdf4', borderRadius: 10,
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Order Total</div>
                    <div style={{ fontWeight: 800, fontSize: 17, color: '#0f172a' }}>₹{order.totalAmount?.toFixed(2)}</div>
                  </div>
                  {hasBalance ? (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>BALANCE DUE</div>
                      <div style={{ fontWeight: 800, fontSize: 17, color: '#ef4444' }}>₹{order.balanceAmount?.toFixed(2)}</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <CheckCircleOutlined style={{ color: '#059669', fontSize: 16 }} />
                      <div>
                        <div style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>PAID</div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#059669' }}>₹{order.paidAmount?.toFixed(2)}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {isPacked && (
                  <button
                    onClick={() => handleDispatch(order.id)}
                    disabled={dispatching}
                    style={{
                      width: '100%', height: 46, border: 'none', borderRadius: 12,
                      background: dispatching ? '#e2e8f0' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                      color: dispatching ? '#94a3b8' : '#fff', fontWeight: 700, fontSize: 14,
                      cursor: dispatching ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: dispatching ? 'none' : '0 3px 12px rgba(124,58,237,0.3)',
                    }}
                  >
                    <TruckOutlined style={{ fontSize: 16 }} />
                    {dispatching ? 'Dispatching...' : 'Dispatch — Pickup Confirmed'}
                  </button>
                )}

                {isDispatched && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {hasBalance && (
                        <button
                          onClick={() => openPay(order)}
                          style={{
                            flex: 1, height: 44, border: `1.5px solid ${P}`, borderRadius: 10,
                            background: '#fff', color: P, fontWeight: 700, fontSize: 13,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          }}
                        >
                          <WalletOutlined />Collect
                        </button>
                      )}
                      <button
                        onClick={() => setDeliverConfirmId(order.id)}
                        style={{
                          flex: 1, height: 44, border: 'none', borderRadius: 10,
                          background: 'linear-gradient(135deg, #059669, #047857)',
                          color: '#fff', fontWeight: 700, fontSize: 13,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          boxShadow: '0 3px 10px rgba(5,150,105,0.3)',
                        }}
                      >
                        <CheckCircleOutlined />Mark Delivered
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleShopClosed(order.id)}
                        disabled={markingClosed}
                        style={{
                          flex: 1, height: 38, border: '1.5px solid #e2e8f0', borderRadius: 10,
                          background: '#fff', color: '#64748b', fontWeight: 600, fontSize: 12,
                          cursor: markingClosed ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        <ShoppingOutlined />Shop Closed
                      </button>
                      <button
                        onClick={() => setReturnConfirmId(order.id)}
                        style={{
                          flex: 1, height: 38, border: '1.5px solid #fecaca', borderRadius: 10,
                          background: '#fff', color: '#dc2626', fontWeight: 600, fontSize: 12,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        <ShoppingOutlined />Return to Warehouse
                      </button>
                    </div>
                  </div>
                )}

                {isDelivered && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {hasBalance && (
                      <button
                        onClick={() => openPay(order)}
                        style={{
                          height: 38, border: `1.5px solid #059669`, borderRadius: 8,
                          background: '#fff', color: '#059669', fontWeight: 600, fontSize: 12,
                          cursor: 'pointer', padding: '0 14px',
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}
                      >
                        <WalletOutlined />Collect Balance
                      </button>
                    )}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <CheckCircleOutlined style={{ color: '#059669', fontSize: 14 }} />
                      <span style={{ fontSize: 12, color: '#059669', fontWeight: 700 }}>Delivered</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* Confirm Delivery Modal */}
      <Modal
        title="Confirm Delivery"
        open={!!deliverConfirmId}
        onOk={() => deliverConfirmId && handleMarkDelivered(deliverConfirmId)}
        onCancel={() => setDeliverConfirmId(null)}
        confirmLoading={delivering}
        okText="Yes, Mark as Delivered"
        okButtonProps={{ style: { background: '#059669', borderColor: '#059669', fontWeight: 700 } }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 0' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CheckCircleOutlined style={{ color: '#059669', fontSize: 20 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Confirm successful delivery?</div>
            <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>
              This marks the order as delivered to the customer and cannot be undone.
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirm Return to Warehouse Modal */}
      <Modal
        title="Return to Warehouse?"
        open={!!returnConfirmId}
        onOk={() => returnConfirmId && handleReturnToWarehouse(returnConfirmId)}
        onCancel={() => setReturnConfirmId(null)}
        confirmLoading={returning}
        okText="Yes, Return to Warehouse"
        okButtonProps={{ danger: true, style: { fontWeight: 700 } }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 0' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShoppingOutlined style={{ color: '#dc2626', fontSize: 20 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>This removes it from your list</div>
            <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>
              Only use this if you're done for the day and physically handing the goods back —
              the warehouse will need to verify and re-dispatch it before it can be delivered again.
              If you'll try this stop again later today, use "Shop Closed" instead.
            </div>
          </div>
        </div>
      </Modal>

      {/* Collect Payment Modal */}
      <Modal
        title={
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Collect Payment</div>
            {selectedOrder && (
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
                {selectedOrder.customer?.businessName} · #{selectedOrder.orderNumber}
              </div>
            )}
          </div>
        }
        open={payModal}
        onOk={handleCollect}
        onCancel={() => setPayModal(false)}
        confirmLoading={collecting}
        okText="Collect Payment"
        okButtonProps={{ style: { background: P, borderColor: P, fontWeight: 700 } }}
      >
        {selectedOrder && (
          <>
            {isSmallPhone ? (
              <div style={{ background: '#fef2f2', borderRadius: 12, padding: '12px 14px', marginBottom: 16, marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>Total / Paid</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>₹{selectedOrder.totalAmount?.toFixed(2)} / ₹{(selectedOrder.paidAmount || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>Balance Due</span>
                  <span style={{ fontWeight: 800, color: '#ef4444', fontSize: 22 }}>₹{selectedOrder.balanceAmount?.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div style={{ background: '#fef2f2', borderRadius: 12, padding: '12px 16px', marginBottom: 18, marginTop: 8 }}>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Outstanding Balance</div>
                <div style={{ fontWeight: 800, color: '#ef4444', fontSize: 26, marginTop: 2 }}>
                  ₹{selectedOrder.balanceAmount?.toFixed(2)}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  Paid ₹{selectedOrder.paidAmount?.toFixed(2)} of ₹{selectedOrder.totalAmount?.toFixed(2)}
                </div>
              </div>
            )}

            <Form form={form} layout="vertical">
              <Form.Item name="amount" label="Amount"
                rules={[
                  { required: true, message: 'Enter the amount received from customer' },
                  { type: 'number', min: 0.01, message: 'Amount must be greater than ₹0' },
                  { validator: (_, v) => v && v > (selectedOrder?.balanceAmount || 0) ? Promise.reject(`Cannot exceed balance ₹${selectedOrder?.balanceAmount?.toFixed(2)}`) : Promise.resolve() },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }} size="large"
                  min={0.01} max={selectedOrder?.balanceAmount}
                  precision={2} prefix="₹" placeholder="0.00"
                />
              </Form.Item>

              {/* Quick amount buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: -8, marginBottom: 16 }}>
                {[25, 50, 75].map(pct => (
                  <button key={pct} type="button"
                    onClick={() => form.setFieldsValue({ amount: parseFloat((selectedOrder.balanceAmount * pct / 100).toFixed(2)) })}
                    style={{
                      flex: 1, height: 40, border: '1px solid #e2e8f0', borderRadius: 8,
                      background: '#f8fafc', color: '#475569', fontWeight: 600,
                      fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    {pct}%
                  </button>
                ))}
                <button type="button"
                  onClick={() => form.setFieldsValue({ amount: selectedOrder.balanceAmount })}
                  style={{
                    flex: 1, height: 40, border: '1px solid #a7f3d0', borderRadius: 8,
                    background: '#ecfdf5', color: P, fontWeight: 700,
                    fontSize: 12, cursor: 'pointer',
                  }}
                >
                  Full
                </button>
              </div>

              <Form.Item name="paymentMethodId" label="Payment Method"
                rules={[{ required: true, message: 'Select how the customer is paying' }]}
              >
                <Select size="large" placeholder="Select payment method">
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
                <Form.Item name="referenceNumber" label="Reference Number"
                  rules={[{ required: true, message: 'Enter the transaction reference or cheque number' }]}
                >
                  <Input size="large" placeholder={
                    selectedMethod?.mode === 'UPI' ? 'UPI Transaction ID'
                    : selectedMethod?.mode === 'CHEQUE' ? 'Cheque Number'
                    : (selectedMethod?.mode === 'NEFT' || selectedMethod?.mode === 'RTGS') ? 'UTR Number (e.g. KKBK24...)'
                    : 'Transaction Reference'
                  } />
                </Form.Item>
              )}
              <Form.Item name="notes" label="Notes (optional)">
                <Input.TextArea rows={2} placeholder="Any remarks..." style={{ borderRadius: 10 }} />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
};

export default DeliveryOrdersPage;
