import React, { useState } from 'react';
import { Modal, Button, Skeleton, Form, Input, InputNumber, Select, Switch, message, Grid } from 'antd';
import {
  PhoneOutlined, EnvironmentOutlined, PlusOutlined,
  CheckCircleOutlined, ShoppingOutlined,
  AimOutlined, LoadingOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useGetMyAllocationQuery } from '../../store/api/salesApi';
import { useGetMyOrdersQuery } from '../../store/api/orderApi';
import { useCreateCustomerMutation } from '../../store/api/customerApi';
import { useGetRoutePlanQuery } from '../../store/api/routeApi';

const { useBreakpoint } = Grid;

const P = '#059669';

const STATUS_CFG = {
  not_visited:       { color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0',  label: 'Not Visited',       dot: '#cbd5e1' },
  order_placed:      { color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe',  label: 'Order Placed',      dot: '#8b5cf6' },
  payment_collected: { color: P,         bg: '#ecfdf5', border: '#a7f3d0',  label: 'Payment Collected', dot: P         },
};

const SalesRoutePage: React.FC = () => {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isSmall  = !screens.sm;
  const { data: allocData, isLoading, refetch } = useGetMyAllocationQuery();
  const { data: ordersData } = useGetMyOrdersQuery();
  const { data: planData } = useGetRoutePlanQuery(
    allocData?.data?.routeId || '', { skip: !allocData?.data?.routeId }
  );
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [newCustomerForm] = Form.useForm();
  const [createCustomer, { isLoading: creating }] = useCreateCustomerMutation();

  const allocation = allocData?.data;
  const customers: any[] = allocation?.customers || [];
  const orders: any[] = ordersData?.data || [];
  const routePlaces: any[] = planData?.data?.plan || [];

  const customerOrderMap: Record<string, any> = {};
  orders.forEach((o: any) => { if (o.customer?.id) customerOrderMap[o.customer.id] = o; });

  const getStatus = (id: string) => {
    const o = customerOrderMap[id];
    if (!o) return 'not_visited';
    if ((o.paidAmount || 0) > 0 && (o.balanceAmount || 0) <= 0) return 'payment_collected';
    return 'order_placed';
  };

  const openNewCustomer = () => {
    newCustomerForm.resetFields();
    setGpsCoords(null);
    setNewCustomerOpen(true);
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
      },
      () => {
        setGpsLoading(false);
        message.warning('Could not get GPS location. You can still save without it.');
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  const handleCreateCustomer = async () => {
    try {
      const values = await newCustomerForm.validateFields();
      const payload: any = {
        businessName:  values.businessName.trim(),
        ownerName:     values.ownerName.trim(),
        phone:         values.phone.trim(),
        altPhone:      values.altPhone?.trim()  || undefined,
        email:         values.email?.trim()     || undefined,
        address:       values.address?.trim()   || undefined,
        gstin:         values.gstin?.trim()     || undefined,
        routeId:       allocation?.routeId,
        routePlaceId:  values.routePlaceId,
        creditAllowed: values.creditAllowed || false,
        creditDays:    values.creditDays    || undefined,
        creditLimit:   values.creditLimit   || undefined,
      };
      if (gpsCoords) {
        payload.latitude  = gpsCoords.lat;
        payload.longitude = gpsCoords.lng;
      }
      await createCustomer(payload).unwrap();
      message.success('Customer added');
      setNewCustomerOpen(false);
      refetch();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.data?.message || 'Failed to add customer');
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Skeleton active paragraph={{ rows: 3 }} />
        {[1, 2, 3, 4].map(i => <Skeleton key={i} active paragraph={{ rows: 2 }} />)}
      </div>
    );
  }

  if (!allocation) {
    return (
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 32, color: '#94a3b8' }}>
          <EnvironmentOutlined />
        </div>
        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 17, marginBottom: 6 }}>No Route Today</div>
        <div style={{ color: '#64748b', fontSize: 13 }}>You don't have a route allocated for today. Contact your manager.</div>
      </div>
    );
  }

  const visitedCount = customers.filter(c => getStatus(c.id) !== 'not_visited').length;
  const pct = customers.length ? Math.round((visitedCount / customers.length) * 100) : 0;

  const selectedOrder = selectedCustomer ? customerOrderMap[selectedCustomer.id] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Route Header */}
      <div style={{
        background: `linear-gradient(135deg, ${P} 0%, #047857 100%)`,
        borderRadius: 18, padding: '20px',
        boxShadow: '0 6px 24px rgba(5,150,105,0.28)', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -24, right: -24, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              Today's Route
            </div>
            <div style={{ color: '#fff', fontSize: 21, fontWeight: 800, marginTop: 4, letterSpacing: -0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{allocation.routeName}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 3 }}>
              {new Date(allocation.allocationDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ color: '#fff', fontSize: 32, fontWeight: 900, lineHeight: 1 }}>{visitedCount}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>of {customers.length} visited</div>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Progress</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>{pct}%</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 100, height: 7 }}>
            <div style={{
              height: 7, borderRadius: 100,
              background: 'rgba(255,255,255,0.9)',
              width: `${pct}%`, transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_CFG).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.dot, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{v.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Customer list */}
      {customers.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          No customers on this route
        </div>
      ) : (
        customers.map((c: any, idx: number) => {
          const status = getStatus(c.id);
          const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG];
          const order = customerOrderMap[c.id];

          return (
            <div
              key={c.id}
              onClick={() => setSelectedCustomer(c)}
              className="card-clickable"
              style={{
                background: '#fff', borderRadius: 14,
                border: `1.5px solid ${cfg.border}`,
                padding: '14px 16px', cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* Step badge */}
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  background: cfg.bg, border: `2px solid ${cfg.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: cfg.color, fontWeight: 800, fontSize: 13,
                }}>
                  {status === 'not_visited' ? idx + 1 : <CheckCircleOutlined style={{ fontSize: 16 }} />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, lineHeight: 1.3 }}>
                        {c.businessName}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        {c.ownerName}
                      </div>
                      {c.placeName && (
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <EnvironmentOutlined style={{ fontSize: 10 }} />{c.placeName}
                        </div>
                      )}
                    </div>
                    <span style={{
                      flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '3px 10px',
                      borderRadius: 20, background: cfg.bg, color: cfg.color,
                      border: `1px solid ${cfg.border}`,
                    }}>
                      {cfg.label}
                    </span>
                  </div>

                  {order && (
                    <div style={{
                      marginTop: 10, background: '#f8fafc', borderRadius: 10,
                      padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ShoppingOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
                        <span style={{ fontSize: 12, color: '#475569' }}>
                          #{order.orderNumber} · {order.items?.length || 0} items
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: P, fontSize: 13 }}>₹{order.totalAmount?.toFixed(0)}</div>
                        {(order.balanceAmount || 0) > 0 && (
                          <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>
                            Due ₹{order.balanceAmount?.toFixed(0)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!order && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                      <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()} style={{
                        display: 'flex', alignItems: 'center', gap: 5, flex: 1,
                        fontSize: 12, color: '#2563eb', textDecoration: 'none',
                        background: '#eff6ff', borderRadius: 8,
                        padding: isSmall ? '10px 12px' : '6px 10px',
                        justifyContent: 'center', minHeight: 40,
                      }}>
                        <PhoneOutlined style={{ fontSize: 12 }} />{c.phone}
                      </a>
                      <button
                        onClick={e => { e.stopPropagation(); navigate('/sales/order', { state: { customerId: c.id } }); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5, flex: 1,
                          fontSize: 12, color: P, border: `1.5px solid ${P}`,
                          background: '#fff', borderRadius: 8,
                          padding: isSmall ? '10px 12px' : '6px 12px',
                          cursor: 'pointer', fontWeight: 700, justifyContent: 'center', minHeight: 40,
                        }}
                      >
                        <PlusOutlined style={{ fontSize: 12 }} />New Order
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Add New Customer button */}
      <button
        onClick={openNewCustomer}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: '14px',
          background: '#fff', border: `2px dashed #a7f3d0`,
          borderRadius: 14, cursor: 'pointer',
          color: P, fontSize: 13, fontWeight: 700,
        }}
      >
        <PlusOutlined />New Customer
      </button>

      {/* Customer Detail Modal */}
      <Modal
        open={!!selectedCustomer}
        onCancel={() => setSelectedCustomer(null)}
        width={isMobile ? '94%' : 520}
        centered
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto', padding: '12px 0 0' } }}
        title={
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>{selectedCustomer?.businessName}</div>
            {selectedCustomer?.placeName && (
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
                <EnvironmentOutlined style={{ marginRight: 4 }} />{selectedCustomer.placeName}
              </div>
            )}
          </div>
        }
        footer={
          <div style={{ display: 'flex', flexDirection: isSmall ? 'column' : 'row', gap: 8, justifyContent: 'flex-end' }}>
            {!selectedOrder && (
              <Button type="primary" icon={<PlusOutlined />}
                size={isSmall ? 'large' : 'middle'}
                block={isSmall}
                style={{ background: P, borderColor: P, fontWeight: 700 }}
                onClick={() => { navigate('/sales/order', { state: { customerId: selectedCustomer?.id } }); setSelectedCustomer(null); }}
              >
                New Order
              </Button>
            )}
            <Button block={isSmall} size={isSmall ? 'large' : 'middle'} onClick={() => setSelectedCustomer(null)}>Close</Button>
          </div>
        }
      >
        {selectedCustomer && (
          <div>
            {/* Customer info */}
            <div style={{ padding: '0 20px 14px' }}>
              {[
                { label: 'Owner',   value: selectedCustomer.ownerName  },
                { label: 'Phone',   value: <a href={`tel:${selectedCustomer.phone}`} style={{ color: '#2563eb' }}>{selectedCustomer.phone}</a> },
                { label: 'Address', value: selectedCustomer.address    },
                selectedCustomer.creditAllowed && { label: 'Credit Limit', value: `₹${Number(selectedCustomer.creditLimit || 0).toFixed(0)}` },
              ].filter(Boolean).map((row: any, i: number, arr: any[]) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, minWidth: 80 }}>{row.label}</span>
                  <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 500, textAlign: 'right', flex: 1 }}>{row.value || '—'}</span>
                </div>
              ))}
            </div>

            {selectedOrder && (() => {
              const balance = Number(selectedOrder.balanceAmount || 0);
              const sc = {
                SUBMITTED:        '#f59e0b', PENDING_APPROVAL: '#f59e0b',
                APPROVED:         P,         PREPARING:        '#f97316',
                PREPARED:         '#06b6d4', DISPATCHED:       '#8b5cf6',
                DELIVERED:        P,         CANCELLED:        '#ef4444',
              }[selectedOrder.status as string] || '#6b7280';
              return (
                <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: 16 }}>
                  {/* Order summary header */}
                  <div style={{ padding: '0 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Today's Order</div>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 15 }}>#{selectedOrder.orderNumber}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${sc}18`, color: sc }}>
                        {selectedOrder.status}
                      </span>
                      <div style={{ fontWeight: 900, color: P, fontSize: 17, marginTop: 4 }}>₹{Number(selectedOrder.totalAmount || 0).toFixed(2)}</div>
                      {balance > 0 ? (
                        <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>Due ₹{balance.toFixed(2)}</div>
                      ) : (
                        <div style={{ fontSize: 11, color: P, fontWeight: 700 }}>✓ Fully Paid</div>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <div style={{ borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ padding: '10px 20px 6px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                      Items ({selectedOrder.items?.length || 0})
                    </div>
                    {(selectedOrder.items || []).map((item: any, idx: number) => (
                      <div
                        key={item.id}
                        style={{
                          padding: '11px 20px',
                          borderBottom: idx < (selectedOrder.items.length - 1) ? '1px solid #f8fafc' : 'none',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, lineHeight: 1.3 }}>
                            {item.product?.name}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                            {item.product?.brand && <span>{item.product.brand} · </span>}
                            {item.quantity} {item.product?.unit || 'pcs'} × ₹{Number(item.unitPrice).toFixed(2)}
                          </div>
                        </div>
                        <div style={{ fontWeight: 800, color: P, fontSize: 14, flexShrink: 0 }}>
                          ₹{Number(item.lineTotal).toFixed(2)}
                        </div>
                      </div>
                    ))}
                    {/* Total footer */}
                    <div style={{ padding: '12px 20px', borderTop: '2px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', background: '#f8fafc' }}>
                      <span style={{ fontWeight: 700, color: '#64748b', fontSize: 13 }}>{selectedOrder.items?.length || 0} items</span>
                      <span style={{ fontWeight: 900, color: P, fontSize: 16 }}>₹{Number(selectedOrder.totalAmount || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </Modal>

      {/* New Customer Modal */}
      <Modal
        open={newCustomerOpen}
        onCancel={() => setNewCustomerOpen(false)}
        title={<span style={{ fontWeight: 700 }}>New Customer</span>}
        onOk={handleCreateCustomer}
        confirmLoading={creating}
        okText="Save Customer"
        okButtonProps={{ style: { background: P, borderColor: P } }}
        width={isMobile ? '92%' : 520}
        centered
      >
        {/* GPS status banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: gpsCoords ? '#ecfdf5' : gpsLoading ? '#fffbeb' : '#fef2f2',
          border: `1px solid ${gpsCoords ? '#a7f3d0' : gpsLoading ? '#fde68a' : '#fca5a5'}`,
          borderRadius: 8, padding: '8px 12px', marginBottom: 16, marginTop: 4, fontSize: 12,
        }}>
          {gpsLoading ? (
            <><LoadingOutlined style={{ color: '#f59e0b' }} /><span style={{ color: '#92400e' }}>Getting your location…</span></>
          ) : gpsCoords ? (
            <><AimOutlined style={{ color: P }} /><span style={{ color: '#065f46' }}>Location captured ({gpsCoords.lat.toFixed(5)}, {gpsCoords.lng.toFixed(5)})</span></>
          ) : (
            <><AimOutlined style={{ color: '#ef4444' }} /><span style={{ color: '#991b1b' }}>Location unavailable — customer saved without GPS</span></>
          )}
        </div>

        <Form form={newCustomerForm} layout="vertical" requiredMark={false}>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Basic Info</div>

          <Form.Item name="businessName" label="Business / Shop Name *" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. Ravi General Stores" />
          </Form.Item>
          <Form.Item name="ownerName" label="Owner Name *" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. Ravi Kumar" />
          </Form.Item>
          <Form.Item name="phone" label="Mobile Number *" rules={[{ required: true, message: 'Required' }, { pattern: /^\d{10}$/, message: '10-digit number' }]}>
            <Input placeholder="10-digit mobile number" maxLength={10} />
          </Form.Item>
          <Form.Item name="altPhone" label="Alt Mobile">
            <Input placeholder="Optional" maxLength={10} />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} placeholder="Shop address (optional)" />
          </Form.Item>
          <Form.Item name="gstin" label="GSTIN">
            <Input placeholder="Optional" />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input type="email" placeholder="Optional" />
          </Form.Item>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, margin: '8px 0 12px' }}>Route Stop</div>

          <Form.Item name="routePlaceId" label="Stop / Place *" rules={[{ required: true, message: 'Select a stop' }]}>
            <Select placeholder="Select stop on this route" size="large">
              {routePlaces.map((p: any) => (
                <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, margin: '8px 0 12px' }}>Credit</div>

          <Form.Item name="creditAllowed" label="Allow Credit" valuePropName="checked">
            <Switch checkedChildren="Credit On" unCheckedChildren="Cash Only" />
          </Form.Item>
          <Form.Item name="creditDays" label="Credit Days">
            <InputNumber style={{ width: '100%' }} min={0} max={365} placeholder="e.g. 30" addonAfter="days" />
          </Form.Item>
          <Form.Item name="creditLimit" label="Credit Limit" style={{ marginBottom: 0 }}>
            <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 50000" addonBefore="₹" />
          </Form.Item>

        </Form>
      </Modal>
    </div>
  );
};

export default SalesRoutePage;
