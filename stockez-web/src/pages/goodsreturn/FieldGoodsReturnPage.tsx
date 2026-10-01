import React, { useState, useEffect } from 'react';
import {
  Button, Select, DatePicker, Input, InputNumber, Modal, message,
  Tabs, Skeleton, Tag, Badge, Pagination, Grid,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined,
  RollbackOutlined, WarningOutlined, ShopOutlined,
  DownOutlined, RightOutlined, DollarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AuditHistoryButton from '../../components/AuditHistoryButton';
import { hasPermission } from '../../utils/permissions';
import {
  SETTLEMENT_OPTIONS, SETTLED_MESSAGE, type SettlementKey,
} from '../../utils/supplierSettlement';
import { useGetAllProductsQuery } from '../../store/api/productApi';
import { useGetAllOrdersQuery } from '../../store/api/orderApi';
import {
  useListGoodsReturnsQuery, useCreateGoodsReturnMutation,
  useGetPendingRefundsQuery, useProcessRefundMutation,
  useGetReturnedQtyByOrderQuery,
} from '../../store/api/goodsReturnApi';
import { useGetAllPurchasesQuery, useGetPurchaseQuery, useGetBatchesByProductQuery } from '../../store/api/purchaseApi';

const { useBreakpoint } = Grid;

const fmt = (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; description: string }> = {
  SALES_RETURN:     { label: 'Sales Return',     color: '#2563eb', icon: <RollbackOutlined />, description: 'Customer returning goods — stock restored, customer balance reduced' },
  PURCHASE_RETURN:  { label: 'Purchase Return',  color: '#7c3aed', icon: <ShopOutlined />,     description: 'Returning goods to supplier — stock removed' },
  DAMAGE:           { label: 'Damage / Loss',    color: '#dc2626', icon: <WarningOutlined />,  description: 'Damaged or lost goods — stock removed, loss recorded' },
};

interface ReturnLine {
  id: number;
  productId: string | null;
  productName?: string;
  batchNumber: string;
  quantity: number | null;
  maxQuantity?: number;
  unitRate: number | null;
}

const emptyLine = (id: number): ReturnLine => ({
  id, productId: null, batchNumber: '', quantity: null, unitRate: null,
});

/* ── Batch dropdown — one RTK call per line ── */
const BatchSelect: React.FC<{
  productId: string | null;
  value: string;
  onChange: (v: string) => void;
}> = ({ productId, value, onChange }) => {
  const { data } = useGetBatchesByProductQuery(productId!, { skip: !productId });
  const batches: any[] = data?.data || [];
  return (
    <Select
      size="middle"
      style={{ width: '100%' }}
      placeholder="Select batch..."
      value={value || undefined}
      onChange={v => onChange(v ?? '')}
      onClear={() => onChange('')}
      allowClear
      showSearch
      filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
      disabled={!productId}
      options={batches.map((b: any) => ({
        value: b.batchNumber,
        label: `${b.batchNumber}${b.expiryDate ? ` · exp ${dayjs(b.expiryDate).format('DD MMM YY')}` : ''} · ${b.quantityAvailable} avail`,
      }))}
    />
  );
};

/* ── New Entry Form ── */
const NewReturnForm: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const screens = useBreakpoint();
  const isSmall = !screens.sm;
  // Purchase Return (goods back to a supplier) is a warehouse/procurement action —
  // hide it from field roles (sales/delivery) who never deal with suppliers at all.
  const visibleTypes = Object.entries(TYPE_CONFIG).filter(([key]) =>
    key !== 'PURCHASE_RETURN' || hasPermission('PURCHASES_VIEW')
  );
  // A delivery-only person (no office-level order visibility) should only be able to
  // file a return against an order they themselves delivered — not the whole tenant's
  // delivered orders. Office/admin/sales roles are untouched (deliveredByMe stays false).
  const isDeliveryOnly = hasPermission('DELIVERY_VIEW')
    && !hasPermission('ORDERS_VIEW') && !hasPermission('INVOICE_VIEW');
  const [type, setType]             = useState<string>('SALES_RETURN');
  const [orderId, setOrderId]       = useState<string | null>(null);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [supplierName, setSupplier] = useState('');
  const [returnDate, setReturnDate] = useState<any>(dayjs());
  const [reason, setReason]         = useState('');
  const [lines, setLines]           = useState<ReturnLine[]>([emptyLine(1)]);
  const [nextId, setNextId]         = useState(2);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: productsData } = useGetAllProductsQuery();
  const { data: ordersData }   = useGetAllOrdersQuery({ status: 'DELIVERED', deliveredByMe: isDeliveryOnly }, { skip: type !== 'SALES_RETURN' });
  const { data: purchasesData } = useGetAllPurchasesQuery(undefined, { skip: type !== 'PURCHASE_RETURN' });
  const { data: purchaseDetail } = useGetPurchaseQuery(purchaseId!, { skip: !purchaseId || type !== 'PURCHASE_RETURN' });
  const { data: returnedQtyData } = useGetReturnedQtyByOrderQuery(orderId!, { skip: !orderId || type !== 'SALES_RETURN' });
  const [createReturn, { isLoading: saving }] = useCreateGoodsReturnMutation();

  const products: any[]  = productsData?.data?.content || productsData?.data || [];
  const orders: any[]    = ordersData?.data?.content || ordersData?.data || [];
  const purchases: any[] = purchasesData?.data?.content || purchasesData?.data || [];

  useEffect(() => {
    if (!purchaseDetail || !purchaseId) return;
    const p = purchaseDetail.data || purchaseDetail;
    if (p?.supplierName) setSupplier(p.supplierName);
    if (p?.items?.length > 0) {
      const autoLines: ReturnLine[] = p.items.map((item: any, idx: number) => ({
        id: idx + 1,
        productId: item.product?.id || null,
        batchNumber: item.batchNumber || '',
        quantity: item.quantity || null,
        unitRate: item.purchaseRate != null ? Number(item.purchaseRate) : null,
      }));
      setLines(autoLines);
      setNextId(autoLines.length + 1);
    }
  }, [purchaseDetail, purchaseId]);

  // Clear lines immediately when order changes so we don't show stale data
  useEffect(() => {
    setLines([emptyLine(1)]);
    setNextId(2);
  }, [orderId]);

  // Populate lines once returned-qty data has loaded for the selected order
  useEffect(() => {
    if (!orderId || type !== 'SALES_RETURN' || returnedQtyData === undefined) return;
    const selectedOrder = orders.find((o: any) => o.id === orderId);
    if (!selectedOrder?.items?.length) return;

    const alreadyReturned: Record<string, number> = returnedQtyData?.data || {};

    const returnable = selectedOrder.items
      .map((item: any) => {
        const returned = alreadyReturned[item.product?.id] || 0;
        const remainingQty = (item.quantity || 0) - returned;
        return { item, remainingQty };
      })
      .filter(({ remainingQty }: { remainingQty: number }) => remainingQty > 0);

    if (returnable.length === 0) {
      message.warning('All items from this order have already been returned');
      setLines([emptyLine(1)]);
      setNextId(2);
      return;
    }

    const autoLines: ReturnLine[] = returnable.map(({ item, remainingQty }: { item: any; remainingQty: number }, idx: number) => ({
      id: idx + 1,
      productId: item.product?.id || null,
      productName: item.product?.name || item.productName || null,
      batchNumber: item.batchNumber || '',
      quantity: remainingQty,
      maxQuantity: remainingQty,
      unitRate: item.unitPrice != null ? Number(item.unitPrice) : null,
    }));
    setLines(autoLines);
    setNextId(autoLines.length + 1);
  }, [orderId, returnedQtyData, orders, type]);

  const resetLines = () => { setLines([emptyLine(1)]); setNextId(2); };

  const handleTypeChange = (newType: string) => {
    setType(newType);
    setOrderId(null);
    setPurchaseId(null);
    setSupplier('');
    setReason('');
    resetLines();
  };

  const addLine = () => { setLines(p => [...p, emptyLine(nextId)]); setNextId(n => n + 1); };
  const removeLine = (id: number) => {
    if (lines.length === 1) { message.warning('At least one item required'); return; }
    setLines(p => p.filter(l => l.id !== id));
  };
  const updateLine = (id: number, field: keyof ReturnLine, value: any) => {
    setLines(p => p.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: value };
      if (field === 'productId') {
        const prod = products.find((pr: any) => pr.id === value);
        if (prod) updated.unitRate = Number(prod.minSaleRate) || null;
        updated.batchNumber = '';
      }
      return updated;
    }));
  };

  const handleOrderChange = (newOrderId: string | null) => {
    setOrderId(newOrderId);
    if (!newOrderId) resetLines();
  };

  const handlePurchaseChange = (newPurchaseId: string | undefined) => {
    const pid = newPurchaseId || null;
    setPurchaseId(pid);
    if (!pid) {
      setSupplier('');
      resetLines();
    }
  };

  const totalAmount = lines.reduce((s, l) => s + (l.unitRate || 0) * (l.quantity || 0), 0);

  const handleSave = () => {
    if (!returnDate) { message.error('Return date is required'); return; }
    if (type === 'SALES_RETURN' && !orderId) { message.error('Select the reference order for sales return'); return; }
    if (type === 'PURCHASE_RETURN' && !purchaseId) { message.error('Select the reference purchase'); return; }
    if (type === 'PURCHASE_RETURN' && !supplierName.trim()) { message.error('Supplier name is required'); return; }
    for (const l of lines) {
      if (!l.productId) { message.error('Select product for all lines'); return; }
      if (!l.quantity || l.quantity < 1) { message.error('Quantity must be ≥ 1'); return; }
      if (!l.unitRate || l.unitRate <= 0) { message.error('Unit rate must be > 0'); return; }
    }
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    try {
      await createReturn({
        type,
        orderId: type === 'SALES_RETURN' ? orderId : null,
        purchaseEntryId: type === 'PURCHASE_RETURN' ? purchaseId : null,
        supplierName: type === 'PURCHASE_RETURN' ? supplierName.trim() : null,
        returnDate: dayjs(returnDate).format('YYYY-MM-DD'),
        reason: reason.trim() || null,
        items: lines.map(l => ({
          productId: l.productId,
          batchNumber: l.batchNumber.trim() || null,
          quantity: l.quantity,
          unitRate: l.unitRate,
        })),
      }).unwrap();
      message.success('Return entry saved — stock and accounts updated!');
      setConfirmOpen(false);
      onDone();
    } catch (e: any) {
      message.error(e?.data?.message || 'Failed to save return entry');
      setConfirmOpen(false);
    }
  };

  const cfg = TYPE_CONFIG[type];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 860 }}>

      {/* Type selector */}
      <div style={{ display: 'grid', gridTemplateColumns: isSmall ? '1fr' : `repeat(${visibleTypes.length}, 1fr)`, gap: 12 }}>
        {visibleTypes.map(([key, c]) => (
          <div key={key} onClick={() => handleTypeChange(key)} style={{
            borderRadius: 14, border: `2px solid ${type === key ? c.color : '#e2e8f0'}`,
            background: type === key ? `${c.color}08` : '#fff',
            padding: '14px 18px', cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ color: c.color, fontSize: 16 }}>{c.icon}</span>
              <span style={{ fontWeight: 700, color: type === key ? c.color : '#0f172a', fontSize: 13 }}>{c.label}</span>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>{c.description}</div>
          </div>
        ))}
      </div>

      {/* Header fields */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: isSmall ? '16px' : '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isSmall ? '1fr' : '1fr 1fr', gap: isSmall ? 14 : '0 24px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Return Date *</div>
            <DatePicker size="large" style={{ width: '100%', borderRadius: 10 }} format="DD MMM YYYY"
              value={returnDate} onChange={setReturnDate} allowClear={false} />
          </div>

          {type === 'SALES_RETURN' && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Reference Order *</div>
              <Select size="large" showSearch filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                placeholder="Select order..." style={{ width: '100%' }}
                value={orderId || undefined} onChange={handleOrderChange}
                options={orders.map((o: any) => ({ value: o.id, label: `${o.orderNumber} — ${o.customerName || o.customer?.businessName}` }))}
              />
            </div>
          )}

          {type === 'PURCHASE_RETURN' && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Reference Purchase *</div>
              <Select size="large" showSearch filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                placeholder="Select purchase..." style={{ width: '100%' }}
                value={purchaseId || undefined} onChange={handlePurchaseChange}
                options={purchases.map((p: any) => ({ value: p.id, label: `${p.entryNumber} — ${p.supplierName}` }))}
              />
            </div>
          )}

          {type === 'DAMAGE' && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Reason for Damage</div>
              <Input size="large" style={{ borderRadius: 10 }} placeholder="e.g. Flood, accident, packaging failure"
                value={reason} onChange={e => setReason(e.target.value)} />
            </div>
          )}
        </div>

        {type === 'PURCHASE_RETURN' && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Supplier Name *</div>
            <Input size="large" style={{ borderRadius: 10 }} placeholder="e.g. Tamil Nadu Traders"
              value={supplierName} onChange={e => setSupplier(e.target.value)} />
          </div>
        )}

        {type !== 'DAMAGE' && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Reason / Notes</div>
            <Input.TextArea rows={2} style={{ borderRadius: 10 }} placeholder="Why is this return happening?"
              value={reason} onChange={e => setReason(e.target.value)} />
          </div>
        )}
      </div>

      {/* Product lines */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '14px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Items ({lines.length})
          </div>
          {type !== 'SALES_RETURN' && (
            <Button icon={<PlusOutlined />} onClick={addLine} style={{ borderRadius: 8, fontWeight: 600 }}>
              Add Item
            </Button>
          )}
        </div>

        {type === 'SALES_RETURN' && !orderId ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            Select a Reference Order above to load its items
          </div>
        ) : (
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lines.map((line, idx) => {
            const lineAmt = (line.unitRate || 0) * (line.quantity || 0);
            return (
              <div key={line.id} style={{ background: '#f8fafc', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Item {idx + 1}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {lineAmt > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{fmt(lineAmt)}</span>}
                    <button onClick={() => removeLine(line.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, padding: 4 }}>
                      <DeleteOutlined />
                    </button>
                  </div>
                </div>

                {type === 'SALES_RETURN' && orderId ? (
                  /* Locked mode — product & batch from order, only qty editable */
                  <div style={{ display: 'grid', gridTemplateColumns: isSmall ? '1fr 1fr' : '1fr 1fr 90px 120px', gap: isSmall ? '10px 12px' : '0 12px', marginBottom: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 5 }}>Product</div>
                      <div style={{
                        minHeight: 40, display: 'flex', alignItems: 'center', padding: '8px 12px',
                        background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
                        fontSize: 13, fontWeight: 600, color: '#0f172a', wordBreak: 'break-word',
                      }}>
                        {line.productName || products.find((p: any) => p.id === line.productId)?.name || '—'}
                      </div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 5 }}>Batch No.</div>
                      <div style={{
                        minHeight: 40, display: 'flex', alignItems: 'center', padding: '8px 12px',
                        background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
                        fontSize: 12, fontFamily: 'monospace', color: '#374151', wordBreak: 'break-word',
                      }}>
                        {line.batchNumber || '—'}
                      </div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 5 }}>Qty *</div>
                      <InputNumber size="large" style={{ width: '100%' }} min={1}
                        max={line.maxQuantity || undefined} precision={0}
                        value={line.quantity || undefined}
                        onChange={v => updateLine(line.id, 'quantity', v)} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 5 }}>Rate</div>
                      <div style={{
                        minHeight: 40, display: 'flex', alignItems: 'center', padding: '8px 12px',
                        background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
                        fontSize: 13, fontWeight: 600, color: '#0f172a', wordBreak: 'break-word',
                      }}>
                        {line.unitRate != null ? fmt(line.unitRate) : '—'}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Free-form mode — full dropdowns */
                  <div style={{ display: 'grid', gridTemplateColumns: isSmall ? '1fr 1fr' : '2fr 2fr 90px 120px', gap: isSmall ? '10px 12px' : '0 12px', marginBottom: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 5 }}>Product *</div>
                      <Select size="large" showSearch filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())} style={{ width: '100%' }}
                        placeholder="Select product" value={line.productId || undefined}
                        onChange={v => updateLine(line.id, 'productId', v)}
                        options={products.map((p: any) => ({ value: p.id, label: `${p.name}${p.brand ? ` — ${p.brand}` : ''}` }))}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 5 }}>Batch No.</div>
                      <BatchSelect
                        productId={line.productId}
                        value={line.batchNumber}
                        onChange={v => updateLine(line.id, 'batchNumber', v)}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 5 }}>Qty *</div>
                      <InputNumber size="large" style={{ width: '100%' }} min={1} precision={0}
                        value={line.quantity || undefined}
                        onChange={v => updateLine(line.id, 'quantity', v)} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 5 }}>Rate *</div>
                      <InputNumber size="large" style={{ width: '100%' }} min={0.01} precision={2}
                        prefix="₹" value={line.unitRate || undefined}
                        onChange={v => updateLine(line.id, 'unitRate', v)} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Total + Submit */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: isSmall ? '16px' : '18px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', flexDirection: isSmall ? 'column' : 'row', gap: isSmall ? 14 : 0, justifyContent: 'space-between', alignItems: isSmall ? 'stretch' : 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Total Return Value</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: cfg.color }}>{fmt(totalAmount)}</div>
          </div>
          <Button type="primary" size="large" onClick={handleSave} block={isSmall}
            style={{ height: 48, borderRadius: 12, fontWeight: 700, background: cfg.color, borderColor: cfg.color, padding: '0 28px' }}>
            Save {TYPE_CONFIG[type].label}
          </Button>
        </div>
      </div>

      {/* Confirm */}
      <Modal open={confirmOpen} onCancel={() => setConfirmOpen(false)} onOk={handleConfirm}
        confirmLoading={saving} okText="Confirm & Save"
        okButtonProps={{ style: { background: cfg.color, borderColor: cfg.color, fontWeight: 700 } }}
        title={<div style={{ fontSize: 16, fontWeight: 700, color: cfg.color }}>{cfg.icon} Confirm {cfg.label}</div>}
        width={isSmall ? 'calc(100% - 16px)' : 460}
        centered>
        <div style={{ padding: '12px 0' }}>
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 16 }}>
            {type === 'SALES_RETURN' && 'Stock will be restored. Customer outstanding will be reduced by the return value.'}
            {type === 'PURCHASE_RETURN' && 'Stock will be deducted (FIFO). Supplier return will be recorded.'}
            {type === 'DAMAGE' && 'Stock will be deducted (FIFO). Loss will be recorded in the system.'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {lines.map((l) => {
              const prod = products.find((p: any) => p.id === l.productId);
              return (
                <div key={l.id} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{prod?.name || '—'}</span>
                  <span style={{ color: '#64748b' }}>Qty: {l.quantity} × {fmt(l.unitRate || 0)} = <strong>{fmt((l.quantity || 0) * (l.unitRate || 0))}</strong></span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, fontWeight: 800, fontSize: 15, textAlign: 'right', color: cfg.color }}>
            Total: {fmt(totalAmount)}
          </div>
        </div>
      </Modal>
    </div>
  );
};

/* ── Pending Refunds & Supplier Claims ── */
const PendingRefundsList: React.FC = () => {
  const screens = useBreakpoint();
  const isSmall = !screens.sm;
  const { data, isLoading } = useGetPendingRefundsQuery();
  const [processRefund, { isLoading: processing }] = useProcessRefundMutation();
  const [selected, setSelected] = useState<any | null>(null);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [refundDate, setRefundDate] = useState<any>(dayjs());
  const [settlementMode, setSettlementMode] = useState<SettlementKey | undefined>(undefined);
  const [replacementExpiry, setReplacementExpiry] = useState<any>(null);
  const [notes, setNotes] = useState('');

  const pendingList: any[] = data?.data || [];
  const isSupplierClaim = selected?.type === 'PURCHASE_RETURN';

  const closeModal = () => {
    setSelected(null);
    setPaymentMode('CASH');
    setRefundDate(dayjs());
    setSettlementMode(undefined);
    setReplacementExpiry(null);
    setNotes('');
  };

  const handleProcess = async () => {
    if (!selected) return;
    if (isSupplierClaim && !settlementMode) {
      message.error('Choose how the supplier settled this');
      return;
    }
    try {
      await processRefund({
        id: selected.id,
        settlementMode: isSupplierClaim ? settlementMode : undefined,
        paymentMode: (!isSupplierClaim || settlementMode === 'CASH_REFUND') ? paymentMode : undefined,
        replacementExpiryDate: settlementMode === 'GOODS_REPLACED' && replacementExpiry
          ? dayjs(replacementExpiry).format('YYYY-MM-DD') : undefined,
        refundDate: dayjs(refundDate).format('YYYY-MM-DD'),
        notes: notes.trim() || undefined,
      }).unwrap();
      message.success(isSupplierClaim && settlementMode
        ? SETTLED_MESSAGE[settlementMode](fmt(selected.refundAmount))
        : `Refund of ${fmt(selected.refundAmount)} processed`);
      closeModal();
    } catch (e: any) {
      message.error(e?.data?.message || 'Failed to process');
    }
  };

  if (isLoading) return <Skeleton active paragraph={{ rows: 4 }} />;

  const customerRefunds = pendingList.filter((r: any) => r.type === 'SALES_RETURN');
  const supplierClaims  = pendingList.filter((r: any) => r.type === 'PURCHASE_RETURN');

  const renderTable = (rows: any[], emptyText: string) => {
    if (rows.length === 0) {
      return (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          {emptyText}
        </div>
      );
    }

    if (isSmall) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r: any) => {
            const isPurchase = r.type === 'PURCHASE_RETURN';
            const party = isPurchase
              ? (r.supplierName || r.referencePurchaseSupplierName || '—')
              : (r.referenceOrderCustomerName || '—');
            const ref = isPurchase ? r.referencePurchaseEntryNumber : r.referenceOrderNumber;
            return (
              <div key={r.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{r.returnNumber}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginTop: 2, wordBreak: 'break-word' }}>{party}</div>
                    {ref && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{ref}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', flexShrink: 0, whiteSpace: 'nowrap' }}>{dayjs(r.returnDate).format('DD MMM YY')}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 8, gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>Return Value {fmt(r.totalAmount)}</div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: isPurchase ? '#16a34a' : '#dc2626' }}>{fmt(r.refundAmount)}</div>
                  </div>
                  <Button type="primary" size="small" onClick={() => setSelected(r)}
                    style={{ fontWeight: 600, borderRadius: 6, background: isPurchase ? '#16a34a' : undefined, borderColor: isPurchase ? '#16a34a' : undefined }}>
                    {isPurchase ? 'Settle' : 'Process Refund'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 130px 130px 130px 150px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '10px 20px' }}>
          {['Return No.', rows[0]?.type === 'PURCHASE_RETURN' ? 'Supplier' : 'Customer', 'Return Date', 'Return Value', 'Amount Due', 'Action'].map(h => (
            <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
          ))}
        </div>
        {rows.map((r: any, i: number) => {
          const isPurchase = r.type === 'PURCHASE_RETURN';
          const party = isPurchase
            ? (r.supplierName || r.referencePurchaseSupplierName || '—')
            : (r.referenceOrderCustomerName || '—');
          const ref = isPurchase ? r.referencePurchaseEntryNumber : r.referenceOrderNumber;
          return (
            <div key={r.id} style={{
              display: 'grid', gridTemplateColumns: '150px 1fr 130px 130px 130px 150px',
              padding: '14px 20px', alignItems: 'center',
              borderBottom: i < rows.length - 1 ? '1px solid #f1f5f9' : 'none',
            }}>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{r.returnNumber}</div>
              <div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{party}</div>
                {ref && <div style={{ fontSize: 11, color: '#94a3b8' }}>{ref}</div>}
              </div>
              <div style={{ fontSize: 13, color: '#64748b' }}>{dayjs(r.returnDate).format('DD MMM YYYY')}</div>
              <div style={{ fontWeight: 600, fontSize: 13, textAlign: 'right', paddingRight: 16 }}>{fmt(r.totalAmount)}</div>
              <div style={{ fontWeight: 800, fontSize: 14, color: isPurchase ? '#16a34a' : '#dc2626', textAlign: 'right', paddingRight: 16 }}>{fmt(r.refundAmount)}</div>
              <div>
                <Button type="primary" size="small" onClick={() => setSelected(r)}
                  style={{ fontWeight: 600, borderRadius: 6, background: isPurchase ? '#16a34a' : undefined, borderColor: isPurchase ? '#16a34a' : undefined }}>
                  {isPurchase ? 'Settle' : 'Process Refund'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            Customer Refunds — money to pay out
          </div>
          {renderTable(customerRefunds, 'No pending customer refunds')}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            Supplier Claims — money to receive from suppliers
          </div>
          {renderTable(supplierClaims, 'No pending supplier claims')}
        </div>
      </div>

      <Modal
        open={!!selected}
        onCancel={closeModal}
        onOk={handleProcess}
        confirmLoading={processing}
        okText={isSupplierClaim ? 'Confirm Settlement' : 'Confirm Refund'}
        okButtonProps={{ style: { fontWeight: 700, background: isSupplierClaim ? '#16a34a' : '#dc2626', borderColor: isSupplierClaim ? '#16a34a' : '#dc2626' } }}
        title={
          <span style={{ fontWeight: 700, color: isSupplierClaim ? '#16a34a' : '#dc2626' }}>
            <DollarOutlined /> {isSupplierClaim ? 'Settle Supplier Claim' : 'Process Customer Refund'} — {selected?.returnNumber}
          </span>
        }
        width={isSmall ? 'calc(100% - 16px)' : 440}
        centered
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '12px 0' }}>
            <div style={{
              background: isSupplierClaim ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${isSupplierClaim ? '#bbf7d0' : '#fecaca'}`,
              borderRadius: 10, padding: '12px 16px',
            }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {isSupplierClaim ? 'Amount receivable from supplier' : 'Refund amount due to customer'}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: isSupplierClaim ? '#16a34a' : '#dc2626' }}>{fmt(selected.refundAmount)}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                {isSupplierClaim
                  ? (selected.supplierName || selected.referencePurchaseSupplierName)
                  : selected.referenceOrderCustomerName}
              </div>
            </div>
            {isSupplierClaim && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                  How did the supplier settle this? *
                </div>
                <Select size="large" style={{ width: '100%' }} value={settlementMode} onChange={setSettlementMode}
                  placeholder="Select settlement"
                  options={SETTLEMENT_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                />
                {settlementMode && (
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, lineHeight: 1.5 }}>
                    {SETTLEMENT_OPTIONS.find(o => o.value === settlementMode)?.hint}
                  </div>
                )}
              </div>
            )}
            {(!isSupplierClaim || settlementMode === 'CASH_REFUND') && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                  {isSupplierClaim ? 'Received via *' : 'Payment Mode *'}
                </div>
                <Select size="large" style={{ width: '100%' }} value={paymentMode} onChange={setPaymentMode}
                  options={[
                    { value: 'CASH',   label: 'Cash' },
                    { value: 'UPI',    label: 'UPI' },
                    { value: 'CHEQUE', label: 'Cheque' },
                    { value: 'NEFT',   label: 'NEFT / Bank Transfer' },
                    { value: 'RTGS',   label: 'RTGS' },
                    ...(isSupplierClaim ? [] : [{ value: 'CREDIT', label: 'Credit Note' }]),
                  ]}
                />
              </div>
            )}
            {isSupplierClaim && settlementMode === 'GOODS_REPLACED' && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                  Expiry on the replacement packs
                </div>
                <DatePicker size="large" style={{ width: '100%' }} value={replacementExpiry}
                  onChange={setReplacementExpiry} placeholder="Read it off the stock" />
              </div>
            )}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                {isSupplierClaim ? 'Settlement Date *' : 'Refund Date *'}
              </div>
              <DatePicker size="large" style={{ width: '100%' }} value={refundDate} onChange={setRefundDate} allowClear={false} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Notes (optional)</div>
              <Input.TextArea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={isSupplierClaim ? 'e.g. credit note #CN-2024-001, bank ref...' : 'e.g. returned via bank transfer, reference #...'} />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

/* ── Pending tab label with live count badge ── */
const PendingRefundsTabLabel: React.FC = () => {
  const { data } = useGetPendingRefundsQuery();
  const count = (data?.data || []).length;
  return (
    <span>
      <DollarOutlined /> Refunds & Claims
      {count > 0 && <Badge count={count} size="small" style={{ marginLeft: 8 }} />}
    </span>
  );
};

/* ── History List ── */
const ReturnHistory: React.FC = () => {
  const screens = useBreakpoint();
  const isSmall = !screens.sm;
  const [currentPage, setCurrentPage] = useState(1);
  const { data, isLoading } = useListGoodsReturnsQuery({ page: currentPage - 1, size: 20 });
  const allReturns: any[] = data?.data?.content || [];
  const totalReturns: number = data?.data?.totalElements || 0;
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const returns = typeFilter === 'ALL' ? allReturns : allReturns.filter((r: any) => r.type === typeFilter);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />;

  const renderItemRows = (r: any) => (
    <>
      {isSmall ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          {(r.items || []).map((item: any) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid #e2e8f0', paddingTop: 6 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', wordBreak: 'break-word' }}>
                  {item.productName}{item.productBrand ? ` — ${item.productBrand}` : ''}
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{item.batchNumber || '—'} · Qty {item.quantity}</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>{fmt(item.amount)}</div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 130px 70px 110px', padding: '6px 0 4px', marginTop: 4 }}>
            {['Product', 'Batch', 'Qty', 'Amount'].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textAlign: h === 'Qty' || h === 'Amount' ? 'right' : undefined }}>{h}</div>
            ))}
          </div>
          {(r.items || []).map((item: any) => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 130px 70px 110px', padding: '6px 0', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                {item.productName}{item.productBrand ? ` — ${item.productBrand}` : ''}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{item.batchNumber || '—'}</div>
              <div style={{ fontSize: 13, color: '#374151', textAlign: 'right' }}>{item.quantity}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', textAlign: 'right' }}>{fmt(item.amount)}</div>
            </div>
          ))}
        </>
      )}
      {r.refundStatus === 'PROCESSED' && r.refundAmount > 0 && (
        <div style={{ marginTop: 10, padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 12 }}>
          <span style={{ color: '#166534', fontWeight: 600 }}>Refund {fmt(r.refundAmount)} processed</span>
          {r.refundMode && <span style={{ color: '#64748b' }}> via {r.refundMode}</span>}
          {r.refundDate && <span style={{ color: '#64748b' }}> on {dayjs(r.refundDate).format('DD MMM YYYY')}</span>}
        </div>
      )}
    </>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Type:</span>
        <Select size="small" value={typeFilter} onChange={(v) => { setTypeFilter(v); setCurrentPage(1); }} style={{ width: isSmall ? '100%' : 180 }}
          options={[
            { value: 'ALL',              label: 'All Types' },
            { value: 'SALES_RETURN',     label: 'Sales Return' },
            { value: 'PURCHASE_RETURN',  label: 'Purchase Return' },
            { value: 'DAMAGE',           label: 'Damage / Loss' },
          ]}
        />
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{totalReturns} record{totalReturns !== 1 ? 's' : ''}</span>
      </div>

      {allReturns.length === 0 && !isLoading ? (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
          No return entries found
        </div>
      ) : isSmall ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {returns.map((r: any) => {
            const cfg = TYPE_CONFIG[r.type] || TYPE_CONFIG.DAMAGE;
            const detail = r.referencePurchaseEntryNumber || r.referenceOrderNumber || r.supplierName || 'Damage Entry';
            const partyName = r.type === 'SALES_RETURN'
              ? r.referenceOrderCustomerName
              : (r.type === 'PURCHASE_RETURN' ? (r.supplierName || r.referencePurchaseSupplierName) : null);
            const isExpanded = expanded.has(r.id);
            return (
              <div key={r.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div onClick={() => toggleExpand(r.id)} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#94a3b8', fontSize: 10 }}>{isExpanded ? <DownOutlined /> : <RightOutlined />}</span>
                        <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{r.returnNumber}</span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginTop: 3, wordBreak: 'break-word' }}>{detail}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        {partyName && <span>{partyName}</span>}
                        {partyName && r.referenceOrderRouteName && <span> · </span>}
                        {r.referenceOrderRouteName && <span>{r.referenceOrderRouteName}</span>}
                        {' · '}{r.items?.length || 0} item{(r.items?.length || 0) !== 1 ? 's' : ''} · {dayjs(r.returnDate).format('DD MMM YY')}
                      </div>
                      {r.reason && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{r.reason}</div>}
                    </div>
                    <Tag color={r.type === 'SALES_RETURN' ? 'blue' : r.type === 'PURCHASE_RETURN' ? 'purple' : 'red'}
                      style={{ fontWeight: 600, borderRadius: 6, flexShrink: 0, margin: 0 }}>
                      {cfg.label}
                    </Tag>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 8, marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {r.warehouseStatus === 'CANCELLED' ? (
                        <Tag color="default" style={{ fontWeight: 600, borderRadius: 6, fontSize: 11, margin: 0 }}>Cancelled</Tag>
                      ) : (
                        <>
                          {r.type === 'SALES_RETURN' && r.warehouseStatus === 'PENDING_VERIFICATION' && (
                            <Tag color="volcano" style={{ fontWeight: 600, borderRadius: 6, fontSize: 11, margin: 0 }}>Pending Verification</Tag>
                          )}
                          {r.refundStatus === 'PENDING' && (
                            <Tag color="orange" style={{ fontWeight: 600, borderRadius: 6, fontSize: 11, margin: 0 }}>Refund Due</Tag>
                          )}
                          {r.refundStatus === 'PROCESSED' && (
                            <Tag color="green" style={{ fontWeight: 600, borderRadius: 6, fontSize: 11, margin: 0 }}>Refunded</Tag>
                          )}
                        </>
                      )}
                    </div>
                    <span style={{ fontWeight: 800, color: cfg.color, fontSize: 14 }}>{fmt(r.totalAmount)}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
                    {renderItemRows(r)}
                    <div style={{ marginTop: 8, textAlign: 'right' }}>
                      <AuditHistoryButton entityType="GOODS_RETURN" entityId={r.id} title={`Audit — ${r.returnNumber}`} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 120px 2fr 70px 1fr 1fr 110px 40px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 20px' }}>
            {['Return No.', 'Type', 'Details', 'Items', 'Date', 'Amount', 'Refund', ''].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
            ))}
          </div>
          {returns.map((r: any, i: number) => {
            const cfg = TYPE_CONFIG[r.type] || TYPE_CONFIG.DAMAGE;
            const detail = r.referencePurchaseEntryNumber || r.referenceOrderNumber || r.supplierName || 'Damage Entry';
            const partyName = r.type === 'SALES_RETURN'
              ? r.referenceOrderCustomerName
              : (r.type === 'PURCHASE_RETURN' ? (r.supplierName || r.referencePurchaseSupplierName) : null);
            const isExpanded = expanded.has(r.id);
            const isLast = i === returns.length - 1;
            return (
              <React.Fragment key={r.id}>
                <div
                  onClick={() => toggleExpand(r.id)}
                  style={{
                    display: 'grid', gridTemplateColumns: '160px 120px 2fr 70px 1fr 1fr 110px 40px',
                    padding: '14px 20px', alignItems: 'center', cursor: 'pointer',
                    borderBottom: (!isExpanded && !isLast) ? '1px solid #f1f5f9' : '1px solid #e2e8f0',
                    background: isExpanded ? '#f8fafc' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>
                      {isExpanded ? <DownOutlined /> : <RightOutlined />}
                    </span>
                    <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{r.returnNumber}</span>
                  </div>
                  <div>
                    <Tag color={r.type === 'SALES_RETURN' ? 'blue' : r.type === 'PURCHASE_RETURN' ? 'purple' : 'red'}
                      style={{ fontWeight: 600, borderRadius: 6 }}>
                      {cfg.label}
                    </Tag>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{detail}</div>
                    <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>
                      {partyName && <span style={{ fontWeight: 500 }}>{partyName}</span>}
                      {partyName && r.referenceOrderRouteName && <span style={{ color: '#94a3b8' }}> · </span>}
                      {r.referenceOrderRouteName && <span style={{ color: '#64748b' }}>{r.referenceOrderRouteName}</span>}
                      {r.reason && <span style={{ color: '#94a3b8' }}>{(partyName || r.referenceOrderRouteName) ? ' · ' : ''}{r.reason}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                    {r.items?.length || 0}
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>{dayjs(r.returnDate).format('DD MMM YYYY')}</div>
                  <div style={{ fontWeight: 800, color: cfg.color, fontSize: 14 }}>{fmt(r.totalAmount)}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {r.warehouseStatus === 'CANCELLED' ? (
                      <Tag color="default" style={{ fontWeight: 600, borderRadius: 6, fontSize: 11 }}>Cancelled</Tag>
                    ) : (
                      <>
                        {r.type === 'SALES_RETURN' && r.warehouseStatus === 'PENDING_VERIFICATION' && (
                          <Tag color="volcano" style={{ fontWeight: 600, borderRadius: 6, fontSize: 11 }}>Pending Verification</Tag>
                        )}
                        {r.refundStatus === 'PENDING' && (
                          <Tag color="orange" style={{ fontWeight: 600, borderRadius: 6, fontSize: 11 }}>Refund Due</Tag>
                        )}
                        {r.refundStatus === 'PROCESSED' && (
                          <Tag color="green" style={{ fontWeight: 600, borderRadius: 6, fontSize: 11 }}>Refunded</Tag>
                        )}
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    <AuditHistoryButton entityType="GOODS_RETURN" entityId={r.id} title={`Audit — ${r.returnNumber}`} />
                  </div>
                </div>

                {isExpanded && (
                  <div style={{
                    padding: '0 20px 16px 40px', background: '#f8fafc',
                    borderBottom: !isLast ? '1px solid #f1f5f9' : 'none',
                  }}>
                    {renderItemRows(r)}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
      {totalReturns > 20 && (
        <div style={{ textAlign: 'right', paddingTop: 8 }}>
          <Pagination
            current={currentPage}
            total={totalReturns}
            pageSize={20}
            showSizeChanger={false}
            showTotal={(t) => `${t} returns`}
            onChange={(p) => setCurrentPage(p)}
          />
        </div>
      )}
    </div>
  );
};

/* ── Page — field (Sales/Delivery) version, kept fully independent from the admin
     Goods Return page so field-specific changes never risk affecting the office view. ── */
const FieldGoodsReturnPage: React.FC = () => {
  const canCreate      = hasPermission('RETURNS_CREATE');
  const canViewHistory = hasPermission('RETURNS_VIEW') || hasPermission('RETURNS_APPROVE');
  const canViewRefunds = hasPermission('RETURNS_VIEW');
  const [activeTab, setActiveTab] = useState(canCreate ? 'new' : canViewHistory ? 'history' : 'refunds');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>Goods Return & Damage</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>
          Sales returns, purchase returns and damage entries — automatic stock & account adjustments
        </div>
      </div>
      <Tabs activeKey={activeTab} onChange={setActiveTab}
        items={[
          ...(canCreate ? [{ key: 'new', label: <span><PlusOutlined /> New Entry</span>, children: <NewReturnForm onDone={() => setActiveTab('history')} /> }] : []),
          ...(canViewHistory ? [{ key: 'history', label: <span><RollbackOutlined /> History</span>, children: <ReturnHistory /> }] : []),
          ...(canViewRefunds ? [{ key: 'refunds', label: <PendingRefundsTabLabel />,                children: <PendingRefundsList /> }] : []),
        ]}
      />
    </div>
  );
};

export default FieldGoodsReturnPage;
