import React, { useState } from 'react';
import { Table, Button, Tag, Collapse, message, Popconfirm, Empty, Spin, Modal, InputNumber, Input } from 'antd';
import { CheckOutlined, CloseOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { hasPermission } from '../../utils/permissions';
import { useGetWarehouseReturnsQuery, useConfirmWarehouseReturnMutation, useCancelOrderMutation } from '../../store/api/orderApi';
import { useGetPendingVerificationQuery, useVerifyGoodsReturnMutation, useCancelGoodsReturnMutation } from '../../store/api/goodsReturnApi';
import PageHeader from '../../components/PageHeader';
import WarehouseReturnHistory from './WarehouseReturnHistory';

const { Panel } = Collapse;

const fmt = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const returnAge = (returnedAt?: string) => {
  if (!returnedAt) return null;
  const days = dayjs().startOf('day').diff(dayjs(returnedAt).startOf('day'), 'day');
  const label = days <= 0 ? 'returned today' : days === 1 ? 'returned yesterday' : `returned ${days} days ago`;
  return { label, stale: days >= 2 };
};

const WarehouseReturnsPage: React.FC = () => {
  const { data, isLoading, refetch } = useGetWarehouseReturnsQuery();
  const [confirmReturn, { isLoading: confirming }] = useConfirmWarehouseReturnMutation();
  const [cancelOrder, { isLoading: cancelling }] = useCancelOrderMutation();

  const canVerify = hasPermission('RETURNS_APPROVE');
  const { data: pvData, refetch: refetchPv } = useGetPendingVerificationQuery(undefined, { skip: !canVerify });
  const [verifyReturn, { isLoading: verifying }] = useVerifyGoodsReturnMutation();
  const [cancelReturn, { isLoading: cancellingReturn }] = useCancelGoodsReturnMutation();
  const pending: any[] = pvData?.data || [];

  const [verifyTarget, setVerifyTarget] = useState<any | null>(null);
  const [received, setReceived] = useState<Record<string, number>>({});
  const [damaged, setDamaged] = useState<Record<string, number>>({});

  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const [confirmTarget, setConfirmTarget] = useState<any | null>(null);
  const [confirmReceived, setConfirmReceived] = useState<Record<string, number>>({});

  const groups: any[] = data?.data || [];

  const openVerify = (ret: any) => {
    const init: Record<string, number> = {};
    (ret.items || []).forEach((it: any) => { init[it.id] = it.quantity; });
    setReceived(init);
    setDamaged({});
    setVerifyTarget(ret);
  };

  const submitVerify = async () => {
    if (!verifyTarget) return;
    try {
      const items = (verifyTarget.items || []).map((it: any) => ({
        itemId: it.id, receivedQty: received[it.id] ?? 0, damagedQty: damaged[it.id] ?? 0,
      }));
      const res: any = await verifyReturn({ id: verifyTarget.id, items }).unwrap();
      const shortfall = (verifyTarget.items || []).reduce((s: number, it: any) => s + (it.quantity - (received[it.id] ?? 0)), 0);
      const damagedTotal = (verifyTarget.items || []).reduce((s: number, it: any) => s + (damaged[it.id] ?? 0), 0);
      const notes: string[] = [];
      if (shortfall > 0) notes.push(`${shortfall} unit(s) short, recorded`);
      if (damagedTotal > 0) notes.push(`${damagedTotal} damaged, written off`);
      if (res?.data?.refundStatus === 'PENDING') notes.push(`refund of ${fmt(res.data.refundAmount)} queued for finance`);
      message.success(`${verifyTarget.returnNumber} verified${notes.length ? ' — ' + notes.join('; ') : ' — stock restored'}`);
      setVerifyTarget(null);
      refetchPv();
    } catch (err: any) {
      message.error(err?.data?.message || 'Verification failed');
    }
  };

  const submitCancel = async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) { message.error('Please enter a reason'); return; }
    try {
      await cancelReturn({ id: cancelTarget.id, reason: cancelReason.trim() }).unwrap();
      message.success(`${cancelTarget.returnNumber} cancelled`);
      setCancelTarget(null);
      setCancelReason('');
      refetchPv();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to cancel return');
    }
  };

  const openConfirm = (order: any) => {
    const init: Record<string, number> = {};
    (order.items || []).forEach((it: any) => { init[it.itemId] = it.quantity; });
    setConfirmReceived(init);
    setConfirmTarget(order);
  };

  const submitConfirm = async () => {
    if (!confirmTarget) return;
    try {
      const items = (confirmTarget.items || []).map((it: any) => ({ itemId: it.itemId, receivedQty: confirmReceived[it.itemId] ?? 0 }));
      await confirmReturn({ id: confirmTarget.id, items }).unwrap();
      const shortfall = (confirmTarget.items || []).reduce((s: number, it: any) => s + (it.quantity - (confirmReceived[it.itemId] ?? 0)), 0);
      message.success(shortfall > 0
        ? `${confirmTarget.orderNumber} confirmed — ${shortfall} unit(s) short, flagged for review`
        : `${confirmTarget.orderNumber} confirmed in full — moved back to PACKED for re-dispatch`);
      setConfirmTarget(null);
      refetch();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to confirm');
    }
  };

  const handleCancel = async (orderId: string, orderNumber: string) => {
    try {
      await cancelOrder({ id: orderId, reason: 'Cancelled after warehouse return — goods received' }).unwrap();
      message.success(`${orderNumber} cancelled — stock restored`);
      refetch();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to cancel');
    }
  };

  const itemColumns = [
    { title: 'Product', dataIndex: 'productName', key: 'product', render: (v: string, r: any) => (
      <div>
        <div style={{ fontWeight: 500 }}>{v}</div>
        {r.brand && <div style={{ fontSize: 12, color: '#6b7280' }}>{r.brand}</div>}
      </div>
    )},
    { title: 'Unit', dataIndex: 'unit', key: 'unit', width: 80 },
    { title: 'Qty', dataIndex: 'quantity', key: 'qty', width: 70, align: 'right' as const },
    { title: 'Unit Price', dataIndex: 'unitPrice', key: 'unitPrice', width: 120, align: 'right' as const, render: fmt },
    { title: 'Amount', key: 'amount', width: 120, align: 'right' as const,
      render: (_: any, r: any) => fmt(r.quantity * r.unitPrice) },
  ];

  return (
    <div>
      <PageHeader
        title="Warehouse Returns"
        subtitle="Orders returned by delivery persons — verify receipt and confirm for re-dispatch or cancel"
      />

      {canVerify && pending.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Returns Pending Verification</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
            Goods filed as returned by the field team — physically count each item and confirm what actually reached the warehouse.
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            {pending.map((r: any, i: number) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', flexWrap: 'wrap', borderBottom: i < pending.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{r.returnNumber}</span>
                <span style={{ fontSize: 13 }}>{r.referenceOrderCustomerName}</span>
                {r.referenceOrderRouteName && <span style={{ fontSize: 12, color: '#6b7280' }}>{r.referenceOrderRouteName}</span>}
                <span style={{ fontSize: 12, color: '#6b7280' }}>{r.items?.length || 0} item{(r.items?.length || 0) !== 1 ? 's' : ''}</span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{dayjs(r.returnDate).format('DD MMM YYYY')}</span>
                <span style={{ marginLeft: 'auto', fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>{fmt(r.totalAmount)}</span>
                <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => openVerify(r)}>Verify</Button>
                {hasPermission('RETURNS_CREATE') && (
                  <Button size="small" danger icon={<CloseOutlined />} onClick={() => { setCancelReason(''); setCancelTarget(r); }}>
                    Cancel
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 4 }}>Undelivered Orders</div>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
        Every order awaiting warehouse action, oldest returns flagged — the list clears as you confirm or cancel each.
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : groups.length === 0 ? (
        <Empty description="No orders pending warehouse return" style={{ margin: '24px 0' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groups.map((group: any) => (
            <div key={group.deliveryPersonId || 'unassigned'} style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ background: '#f8fafc', padding: '10px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserOutlined style={{ color: '#6b7280' }} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{group.deliveryPersonName}</span>
                {group.deliveryPersonPhone && (
                  <span style={{ fontSize: 13, color: '#6b7280' }}>{group.deliveryPersonPhone}</span>
                )}
                <Tag style={{ marginLeft: 'auto' }}>{group.orderCount} order{group.orderCount !== 1 ? 's' : ''}</Tag>
              </div>

              <Collapse ghost>
                {group.orders?.map((order: any) => (
                  <Panel
                    key={order.id}
                    header={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                        <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{order.orderNumber}</span>
                        <span style={{ fontSize: 13 }}>{order.customerName}</span>
                        {order.routeName && <span style={{ fontSize: 12, color: '#6b7280' }}>{order.routeName}</span>}
                        {(() => {
                          const a = returnAge(order.returnedAt);
                          return a ? <Tag color={a.stale ? 'orange' : 'default'} style={{ fontSize: 11, margin: 0 }}>{a.label}</Tag> : null;
                        })()}
                        <span style={{ marginLeft: 'auto', fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>{fmt(order.totalAmount)}</span>
                      </div>
                    }
                    extra={
                      hasPermission('PICKLIST_UPDATE') ? (
                        <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="small"
                            type="primary"
                            icon={<CheckOutlined />}
                            onClick={() => openConfirm(order)}
                          >
                            Confirm Received
                          </Button>
                          <Popconfirm
                            title="Cancel this order?"
                            description="Stock will be restored. If the customer already paid, a refund is queued for finance. This cannot be undone."
                            onConfirm={() => handleCancel(order.id, order.orderNumber)}
                            okText="Cancel Order"
                            okButtonProps={{ danger: true }}
                          >
                            <Button
                              size="small"
                              danger
                              icon={<CloseOutlined />}
                              loading={cancelling}
                            >
                              Cancel
                            </Button>
                          </Popconfirm>
                        </div>
                      ) : null
                    }
                  >
                    <Table
                      columns={itemColumns}
                      dataSource={order.items}
                      rowKey={(r: any, i: any) => i}
                      pagination={false}
                      size="small"
                      style={{ marginTop: 0 }}
                    />
                  </Panel>
                ))}
              </Collapse>
            </div>
          ))}
        </div>
      )}

      <WarehouseReturnHistory />

      <Modal
        open={!!verifyTarget}
        title={verifyTarget ? `Verify Receipt — ${verifyTarget.returnNumber}` : ''}
        onCancel={() => setVerifyTarget(null)}
        onOk={submitVerify}
        okText="Confirm Received"
        confirmLoading={verifying}
        width={580}
      >
        {verifyTarget && (
          <div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
              {verifyTarget.referenceOrderCustomerName}
              {verifyTarget.referenceOrderRouteName ? ` · ${verifyTarget.referenceOrderRouteName}` : ''}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
              Enter how many units of each product physically reached the warehouse, and how many of those are damaged. Damaged units are credited to the customer but not put back into stock.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 100px 60px', gap: 8, fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, padding: '0 0 6px' }}>
              <div>Product</div>
              <div style={{ textAlign: 'right' }}>Filed</div>
              <div style={{ textAlign: 'right' }}>Received</div>
              <div style={{ textAlign: 'right' }}>Damaged</div>
              <div style={{ textAlign: 'right' }}>Short</div>
            </div>
            {(verifyTarget.items || []).map((it: any) => {
              const rec = received[it.id] ?? 0;
              const short = it.quantity - rec;
              return (
                <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 100px 60px', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                      {it.productName}{it.productBrand ? ` — ${it.productBrand}` : ''}
                    </div>
                    {it.batchNumber && <div style={{ fontSize: 11, color: '#94a3b8' }}>{it.batchNumber}</div>}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13, color: '#374151' }}>{it.quantity}</div>
                  <div style={{ textAlign: 'right' }}>
                    <InputNumber
                      size="small"
                      min={0}
                      max={it.quantity}
                      value={rec}
                      onChange={(v) => {
                        const n = Number(v ?? 0);
                        setReceived((prev) => ({ ...prev, [it.id]: n }));
                        setDamaged((prev) => ({ ...prev, [it.id]: Math.min(prev[it.id] ?? 0, n) }));
                      }}
                      style={{ width: 90 }}
                    />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <InputNumber
                      size="small"
                      min={0}
                      max={rec}
                      value={damaged[it.id] ?? 0}
                      onChange={(v) => setDamaged((prev) => ({ ...prev, [it.id]: Number(v ?? 0) }))}
                      style={{ width: 90 }}
                    />
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: short > 0 ? '#dc2626' : '#059669' }}>
                    {short > 0 ? short : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <Modal
        open={!!confirmTarget}
        title={confirmTarget ? `Confirm Received — ${confirmTarget.orderNumber}` : ''}
        onCancel={() => setConfirmTarget(null)}
        onOk={submitConfirm}
        okText="Confirm Received"
        confirmLoading={confirming}
        width={580}
      >
        {confirmTarget && (
          <div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
              {confirmTarget.customerName}
              {confirmTarget.routeName ? ` · ${confirmTarget.routeName}` : ''}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
              Enter how many units of each product physically came back to the warehouse. Any shortfall is flagged for review.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 110px 80px', gap: 8, fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, padding: '0 0 6px' }}>
              <div>Product</div>
              <div style={{ textAlign: 'right' }}>Out</div>
              <div style={{ textAlign: 'right' }}>Received</div>
              <div style={{ textAlign: 'right' }}>Short</div>
            </div>
            {(confirmTarget.items || []).map((it: any) => {
              const rec = confirmReceived[it.itemId] ?? 0;
              const short = it.quantity - rec;
              return (
                <div key={it.itemId} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 110px 80px', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                      {it.productName}{it.brand ? ` — ${it.brand}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13, color: '#374151' }}>{it.quantity}</div>
                  <div style={{ textAlign: 'right' }}>
                    <InputNumber
                      size="small"
                      min={0}
                      max={it.quantity}
                      value={rec}
                      onChange={(v) => setConfirmReceived((prev) => ({ ...prev, [it.itemId]: Number(v ?? 0) }))}
                      style={{ width: 100 }}
                    />
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: short > 0 ? '#dc2626' : '#059669' }}>
                    {short > 0 ? short : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <Modal
        open={!!cancelTarget}
        title={cancelTarget ? `Cancel Return — ${cancelTarget.returnNumber}` : ''}
        onCancel={() => setCancelTarget(null)}
        onOk={submitCancel}
        okText="Cancel Return"
        okButtonProps={{ danger: true }}
        confirmLoading={cancellingReturn}
      >
        {cancelTarget && (
          <div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
              {cancelTarget.referenceOrderCustomerName}
              {cancelTarget.referenceOrderRouteName ? ` · ${cancelTarget.referenceOrderRouteName}` : ''}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
              This return hasn't been verified yet, so nothing has moved — stock, the customer's balance,
              and payments are untouched. Cancelling just voids the filing.
            </div>
            <Input.TextArea
              rows={3}
              placeholder="Reason for cancelling (e.g. filed against the wrong order)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default WarehouseReturnsPage;
