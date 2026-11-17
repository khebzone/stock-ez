import React, { useState } from 'react';
import { DatePicker, Skeleton, Empty, Grid, Button, Modal, InputNumber, Select, Tooltip, message, Tabs } from 'antd';
import {
  EnvironmentOutlined, FileTextOutlined, WalletOutlined,
  ShoppingOutlined, LeftOutlined, RightOutlined, EditOutlined, CloseCircleOutlined,
  CloseOutlined, ShareAltOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useGetMyHistoryQuery } from '../../store/api/salesApi';
import { useGetOrderQuery, useUpdateOrderMutation, useCancelOrderMutation } from '../../store/api/orderApi';
import { useGetAllProductsQuery } from '../../store/api/productApi';
import { useGetWorkflowSettingsQuery } from '../../store/api/supplierApi';
import { useGetMyReturnHistoryQuery } from '../../store/api/goodsReturnApi';
import { hasPermission } from '../../utils/permissions';
import { getProductRates, isPriceOutOfRange, defaultUnitPrice } from '../../utils/priceUtils';

const { useBreakpoint } = Grid;

const P = '#059669';
const PL = '#ecfdf5';

const RETURN_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  SALES_RETURN:    { label: 'Sales Return',    color: '#2563eb', bg: '#eff6ff' },
  PURCHASE_RETURN: { label: 'Purchase Return', color: '#7c3aed', bg: '#f5f3ff' },
  DAMAGE:          { label: 'Damage / Loss',   color: '#dc2626', bg: '#fef2f2' },
};

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  SUBMITTED:        { color: '#f59e0b', bg: '#fffbeb' },
  PENDING_APPROVAL: { color: '#f59e0b', bg: '#fffbeb' },
  APPROVED:         { color: P,         bg: PL        },
  PACKING:          { color: '#f97316', bg: '#fff7ed' },
  PACKED:           { color: '#06b6d4', bg: '#ecfeff' },
  DISPATCHED:       { color: '#8b5cf6', bg: '#f5f3ff' },
  DELIVERED:        { color: P,         bg: PL        },
  CANCELLED:        { color: '#ef4444', bg: '#fef2f2' },
};

const fmt = (v?: number) =>
  v != null ? `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bg: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, bg }) => (
  <div style={{
    background: '#fff', borderRadius: 12,
    padding: '14px 12px', border: '1px solid #e2e8f0',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    display: 'flex', flexDirection: 'column', gap: 8,
  }}>
    <div style={{
      width: 34, height: 34, borderRadius: 9, background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color, fontSize: 16,
    }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 500, marginTop: 2 }}>{label}</div>
    </div>
  </div>
);

const renderAvailBadge = (avail: number) => {
  const isOut = avail <= 0;
  const isLow = avail > 0 && avail <= 10;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1,
        padding: '3px 8px',
        borderRadius: 5,
        background: isOut ? '#fef2f2' : isLow ? '#fffbeb' : '#f0fdf4',
        color: isOut ? '#dc2626' : isLow ? '#d97706' : '#16a34a',
        border: `1px solid ${isOut ? '#fecaca' : isLow ? '#fde68a' : '#bbf7d0'}`,
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
      }}
    >
      Avail: {avail}
    </span>
  );
};

const SalesHistoryPage: React.FC = () => {
  const screens = useBreakpoint();
  const isSmall = !screens.sm;
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [activeTab, setActiveTab] = useState('orders');
  const [sharingReceiptId, setSharingReceiptId] = useState<string | null>(null);
  const [sharingInvoiceId, setSharingInvoiceId] = useState<string | null>(null);

  const dateStr = date.format('YYYY-MM-DD');
  const { data, isLoading, refetch } = useGetMyHistoryQuery(dateStr, { refetchOnMountOrArgChange: true });
  const history = data?.data;

  const canViewReturns = hasPermission('RETURNS_CREATE');
  const { data: returnsData } = useGetMyReturnHistoryQuery(dateStr, { skip: !canViewReturns, refetchOnMountOrArgChange: true });
  const myReturns: any[] = returnsData?.data || [];

  const shareInvoice = async (order: any) => {
    if (sharingInvoiceId) return;
    setSharingInvoiceId(order.orderId);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_BASE}/api/public/invoice/${order.orderId}/pdf`);
      if (!res.ok) {
        let detail = `Error ${res.status}`;
        try { const body = await res.json(); if (body?.message) detail = body.message; } catch { /* not JSON */ }
        throw new Error(detail);
      }
      const blob = await res.blob();
      const filename = `${order.orderNumber}.pdf`;
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ title: `Invoice ${order.orderNumber}`, files: [file] });
          return;
        } catch (e: any) { if (e?.name === 'AbortError') return; }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      message.info('Invoice PDF downloaded');
    } catch (err: any) {
      message.error(err?.message || 'Could not generate invoice PDF');
    } finally {
      setSharingInvoiceId(null);
    }
  };

  const shareReceipt = async (payment: any) => {
    if (sharingReceiptId) return;
    setSharingReceiptId(payment.paymentId);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_BASE}/api/public/payment-receipt/${payment.paymentId}/pdf`);
      if (!res.ok) {
        let detail = `Error ${res.status}`;
        try { const body = await res.json(); if (body?.message) detail = body.message; } catch { /* not JSON */ }
        throw new Error(detail);
      }
      const blob = await res.blob();
      const filename = `Receipt-${dateStr}.pdf`;
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ title: 'Payment Receipt', files: [file] });
          return;
        } catch (e: any) { if (e?.name === 'AbortError') return; }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      message.info('Receipt PDF downloaded');
    } catch (err: any) {
      message.error(err?.message || 'Could not generate receipt PDF');
    } finally {
      setSharingReceiptId(null);
    }
  };

  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [editOverallDisc, setEditOverallDisc] = useState<number | null>(null);
  const [addProductKey, setAddProductKey] = useState(0);
  const { data: editOrderData, isFetching: loadingOrder } = useGetOrderQuery(editOrderId!, { skip: !editOrderId, refetchOnMountOrArgChange: true });
  const [updateOrder, { isLoading: saving }] = useUpdateOrderMutation();
  const [cancelOrder] = useCancelOrderMutation();
  const { data: productsData } = useGetAllProductsQuery(undefined, { skip: !editOrderId });
  const { data: workflowData }  = useGetWorkflowSettingsQuery(undefined, { refetchOnMountOrArgChange: true });
  const discountType = workflowData?.data?.discountType ?? 'PERCENT';

  const products: any[] = React.useMemo(() =>
    (productsData?.data?.content || productsData?.data || [])
      .map((p: any) => ({ ...p, stockQuantity: p.sellableStock ?? p.stockQuantity })),
  [productsData]);
  const productsById: Record<string, any> = React.useMemo(() => {
    const m: Record<string, any> = {};
    products.forEach((p: any) => { m[p.id] = p; });
    return m;
  }, [products]);

  const handleCancel = (orderId: string, orderNumber: string) => {
    Modal.confirm({
      title: 'Cancel this order?',
      content: `Order #${orderNumber} will be cancelled and its stock restored. This cannot be undone.`,
      okText: 'Yes, Cancel Order',
      okType: 'danger',
      cancelText: 'No, Keep It',
      centered: true,
      onOk: async () => {
        try {
          await cancelOrder({ id: orderId }).unwrap();
          message.success('Order cancelled');
          refetch();
        } catch (err: any) {
          message.error(err?.data?.message || 'Failed to cancel order');
        }
      },
    });
  };

  const openEdit = (orderId: string) => {
    setEditOrderId(orderId);
    setEditItems([]);
    setEditOverallDisc(null);
    setAddProductKey(k => k + 1);
  };

  React.useEffect(() => {
    if (editOrderData?.data?.items) {
      setEditItems(editOrderData.data.items.map((i: any) => ({
        productId: i.product?.id,
        productName: i.product?.name,
        productBrand: i.product?.brand,
        product: productsById[i.product?.id] ?? i.product,
        quantity: i.quantity,
        initialQuantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        gstPercent: Number(i.gstPercent) || 0,
        discountAmount: Number(i.discountAmount) || 0,
        discountPercent: Number(i.discountPercent) || 0,
      })));
      setEditOverallDisc(editOrderData.data.overallDiscountValue != null ? Number(editOrderData.data.overallDiscountValue) : null);
    }
  // Only re-initialise when the fetched order changes, not on every products re-render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOrderId, editOrderData]);

  const availableProducts = React.useMemo(() =>
    products.filter((p: any) =>
      p.active !== false &&
      (p.stockQuantity == null || p.stockQuantity > 0) &&
      !editItems.some(i => i.productId === p.id)
    ),
  [products, editItems]);

  const addProduct = (productId: string) => {
    const p = productsById[productId];
    if (!p) return;
    const { min, max } = getProductRates(p);
    setEditItems(prev => [...prev, {
      productId: p.id,
      productName: p.name,
      productBrand: p.brand,
      product: p,
      quantity: 1,
      initialQuantity: 0,
      unitPrice: defaultUnitPrice(min, max),
      gstPercent: p.salesGstPercent || 0,
      discountAmount: 0,
      discountPercent: 0,
    }]);
    setAddProductKey(k => k + 1);
  };

  const removeItem = (productId: string) =>
    setEditItems(prev => prev.filter(i => i.productId !== productId));

  const updateItem = (productId: string, patch: Record<string, any>) =>
    setEditItems(prev => prev.map(i => i.productId === productId ? { ...i, ...patch } : i));

  const editLineGross  = (item: any) => item.unitPrice * item.quantity;
  const editLineTotal  = (item: any) => discountType === 'AMOUNT'
    ? Math.max(0, editLineGross(item) - (item.discountAmount || 0))
    : editLineGross(item) * (1 - (item.discountPercent || 0) / 100);
  const editLineBase   = (item: any) => editLineTotal(item) * 100 / (100 + (item.gstPercent || 0));

  const editTotals = React.useMemo(() => {
    let subTotal = 0, totalGst = 0, grossIncl = 0;
    for (const item of editItems) {
      const lt = editLineTotal(item);
      subTotal += editLineBase(item);
      totalGst += lt - editLineBase(item);
      grossIncl += lt;
    }
    const dv = editOverallDisc || 0;
    const discount = dv <= 0 || grossIncl <= 0 ? 0
      : discountType === 'PERCENT'
        ? Math.round(grossIncl * Math.min(dv, 100)) / 100
        : Math.min(dv, grossIncl);
    const factor = grossIncl > 0 ? (grossIncl - discount) / grossIncl : 1;
    subTotal *= factor;
    totalGst *= factor;
    return {
      subTotal: Math.round(subTotal * 100) / 100,
      totalGst: Math.round(totalGst * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      total: Math.round((subTotal + totalGst) * 100) / 100,
    };
  }, [editItems, editOverallDisc, discountType]);

  const editPriceErrors = editItems.filter(item => {
    const { min, max } = getProductRates(item.product);
    return isPriceOutOfRange(item.unitPrice, min, max);
  });

  const editDiscountErrors = discountType === 'AMOUNT'
    ? editItems.filter(item => (item.discountAmount || 0) > editLineGross(item))
    : [];

  const handleSaveEdit = async () => {
    if (editItems.length === 0) { message.error('Order must have at least one item'); return; }
    if (editPriceErrors.length > 0) {
      message.error(`Fix price for: ${editPriceErrors.map(i => i.productName).join(', ')}`);
      return;
    }
    if (editDiscountErrors.length > 0) {
      message.error(`Discount exceeds line total for: ${editDiscountErrors.map(i => i.productName).join(', ')}`);
      return;
    }
    try {
      await updateOrder({
        id: editOrderId!,
        items: editItems.map(i => {
          const discPct = discountType === 'AMOUNT'
            ? Math.min(100, ((i.discountAmount || 0) / (i.unitPrice * i.quantity)) * 100)
            : (i.discountPercent || 0);
          return { productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, discountPercent: discPct };
        }),
        overallDiscountType: editOverallDisc && editOverallDisc > 0 ? discountType : null,
        overallDiscountValue: editOverallDisc && editOverallDisc > 0 ? editOverallDisc : null,
      }).unwrap();
      message.success('Order updated');
      setEditOrderId(null);
      refetch();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to update order');
    }
  };

  const goBack = () => setDate(d => d.subtract(1, 'day'));
  const goForward = () => {
    if (!date.isSame(dayjs(), 'day')) setDate(d => d.add(1, 'day'));
  };
  const isToday = date.isSame(dayjs(), 'day');

  const totalSales = Number(history?.totalSales || 0);
  const totalCollected = Number(history?.totalCollected || 0);
  const cash = Number(history?.cashCollected || 0);
  const upi = Number(history?.upiCollected || 0);
  const other = Number(history?.otherCollected || 0);

  const collectedLabel = totalCollected >= 1000
    ? `₹${(totalCollected / 1000).toFixed(1)}k`
    : fmt(totalCollected);
  const salesLabel = totalSales >= 1000
    ? `₹${(totalSales / 1000).toFixed(1)}k`
    : fmt(totalSales);

  // When editing an order, show a dedicated full-page view identical to the Sales Order Review screen
  if (editOrderId) {
    const editCustomer = editOrderData?.data?.customer;
    const orderNumber = editOrderData?.data?.orderNumber || '';
    const orderStatus = editOrderData?.data?.status || '';
    const statusCfg = STATUS_COLORS[orderStatus] || { color: '#6b7280', bg: '#f3f4f6' };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setEditOrderId(null)}
            style={{
              background: '#f1f5f9', border: 'none', borderRadius: 8,
              width: 36, height: 36, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#475569', fontSize: 15, flexShrink: 0,
            }}
          >
            <LeftOutlined />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Edit Order</span>
              {orderStatus && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  background: statusCfg.bg, color: statusCfg.color,
                }}>
                  {orderStatus}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              #{orderNumber} {editCustomer?.businessName ? `· ${editCustomer.businessName}` : ''}
            </div>
          </div>
        </div>

        {loadingOrder ? (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20 }}>
            <Skeleton active paragraph={{ rows: 6 }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Order document card — identical to Sales Order Review screen */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              {/* Bill To */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f4f8' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  Bill To
                </div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15, lineHeight: 1.3 }}>
                  {editCustomer?.businessName || '—'}
                </div>
                {(editCustomer?.ownerName || editCustomer?.phone) && (
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {editCustomer.ownerName}
                    {editCustomer.phone && <span> · {editCustomer.phone}</span>}
                  </div>
                )}
              </div>

              {/* Add a product dropdown */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f4f8', background: '#fafafa' }}>
                <Select
                  key={addProductKey}
                  showSearch
                  placeholder="Add a product to this order..."
                  value={undefined}
                  onChange={addProduct}
                  filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                  options={availableProducts.map((p: any) => {
                    const stock = p.sellableStock ?? p.stockQuantity ?? 0;
                    return {
                      value: p.id,
                      label: `${p.name}${p.brand ? ` (${p.brand})` : ''} — Stock: ${stock}`,
                    };
                  })}
                  notFoundContent="No more products available"
                  style={{ width: '100%' }}
                  size="large"
                />
              </div>

              {/* Items */}
              {editItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: 13 }}>
                  No items in this order — select a product above to add
                </div>
              ) : (
                editItems.map((item, idx) => {
                  const { min, max } = getProductRates(item.product);
                  const belowMin = min != null && item.unitPrice < min;
                  const aboveMax = max != null && item.unitPrice > max;
                  const hasError = belowMin || aboveMax;
                  const gross    = editLineGross(item);
                  const total    = editLineTotal(item);
                  const gstAmt   = total - editLineBase(item);
                  const discountValue = discountType === 'AMOUNT' ? (item.discountAmount || 0) : (item.discountPercent || 0);
                  const discountExceeds = discountType === 'AMOUNT' && (item.discountAmount || 0) > gross;
                  const prod = productsById[item.productId] ?? item.product;
                  const baseStock = prod?.sellableStock ?? prod?.stockQuantity ?? 0;
                  const initialQty = item.initialQuantity ?? 0;
                  const remainingAvail = Math.max(0, baseStock + initialQty - (item.quantity || 0));

                  return (
                    <div
                      key={item.productId}
                      style={{
                        borderBottom: idx < editItems.length - 1 ? '6px solid #f1f5f9' : 'none',
                        background: hasError ? '#fffdf0' : '#fff',
                      }}
                    >
                      {/* Top row: name + total + delete */}
                      <div style={{ padding: '11px 16px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13, lineHeight: 1.4 }}>{item.productName}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                            {item.productBrand && <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.productBrand}</div>}
                            {item.productBrand && <span style={{ color: '#cbd5e1', fontSize: 10 }}>•</span>}
                            {renderAvailBadge(remainingAvail)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: hasError ? '#dc2626' : '#0f172a' }}>₹{total.toFixed(2)}</div>
                            {item.gstPercent > 0 && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>GST ₹{gstAmt.toFixed(2)}</div>}
                          </div>
                          <button
                            onClick={() => removeItem(item.productId)}
                            style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '2px 0 0 4px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                          >
                            <CloseOutlined style={{ fontSize: 11 }} />
                          </button>
                        </div>
                      </div>

                      {/* Bottom row: Qty, Rate, Disc */}
                      <div style={{ padding: '0 16px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, width: '100%' }}>
                          <div style={{ flexShrink: 0 }}>
                            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginBottom: 3 }}>QTY</div>
                            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden', height: 30 }}>
                              <button onClick={() => updateItem(item.productId, { quantity: Math.max(1, item.quantity - 1) })} style={{ width: 28, height: '100%', border: 'none', background: '#f8fafc', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                              <InputNumber min={1} value={item.quantity} onChange={v => updateItem(item.productId, { quantity: v ?? 1 })} size="small" controls={false} style={{ width: 34, textAlign: 'center', height: '100%', border: 'none', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', background: '#fff', fontWeight: 700, color: '#0f172a', fontSize: 12, outline: 'none' }} />
                              <button onClick={() => updateItem(item.productId, { quantity: item.quantity + 1 })} style={{ width: 28, height: '100%', border: 'none', background: '#f8fafc', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                            </div>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginBottom: 3 }}>RATE</div>
                            <Tooltip title={(min != null || max != null) ? `${min != null ? `min ₹${Number(min).toFixed(2)}` : ''}${min != null && max != null ? ' – ' : ''}${max != null ? `max ₹${Number(max).toFixed(2)}` : ''}` : undefined}>
                              <InputNumber size="small" controls={false} min={0.01} value={item.unitPrice} onChange={v => v != null && updateItem(item.productId, { unitPrice: v })} prefix="₹" status={hasError ? 'error' : ''} style={{ width: '100%', height: 30 }} />
                            </Tooltip>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              DISC {discountType === 'AMOUNT' ? '(₹)' : '(%)'}
                            </div>
                            <InputNumber
                              size="small" min={0} controls={false} precision={2} value={discountValue || undefined}
                              status={discountExceeds ? 'error' : ''}
                              onChange={v => updateItem(item.productId, discountType === 'AMOUNT' ? { discountAmount: v ?? 0 } : { discountPercent: v ?? 0 })}
                              prefix={discountType === 'AMOUNT' ? '₹' : undefined}
                              suffix={discountType === 'PERCENT' ? '%' : undefined}
                              max={discountType === 'AMOUNT' ? gross : 100}
                              style={{ width: '100%', height: 30 }}
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        {(min != null || max != null) && (
                          <div style={{ fontSize: 10, color: hasError ? '#dc2626' : '#94a3b8', fontWeight: hasError ? 600 : 500 }}>
                            {hasError
                              ? (belowMin ? `Below min rate ₹${Number(min).toFixed(2)}` : `Above max rate ₹${Number(max).toFixed(2)}`)
                              : `Allowed: ${min != null ? `₹${Number(min).toFixed(2)}` : ''}${min != null && max != null ? ' – ' : ''}${max != null ? `₹${Number(max).toFixed(2)}` : ''}`
                            }
                          </div>
                        )}
                        {discountExceeds && (
                          <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>
                            Discount cannot exceed the line total (₹{gross.toFixed(2)})
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Totals block */}
              {editItems.length > 0 && (
                <div style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: '#94a3b8' }}>Overall Discount {discountType === 'AMOUNT' ? '(₹)' : '(%)'}</span>
                      <InputNumber
                        size="small" min={0} precision={2} controls={false}
                        value={editOverallDisc ?? undefined}
                        max={discountType === 'PERCENT' ? 100 : undefined}
                        {...(discountType === 'AMOUNT' ? { prefix: '₹' } : { suffix: '%' })}
                        style={{ width: 90 }} placeholder="0"
                        onChange={v => setEditOverallDisc(v as number)}
                      />
                    </div>
                    {editTotals.discount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, color: '#94a3b8' }}>Less: Discount</span>
                        <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>−₹{editTotals.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: '#475569' }}>Subtotal</span>
                      <span style={{ fontSize: 13, color: '#475569' }}>₹{editTotals.subTotal.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: '#64748b' }}>GST</span>
                      <span style={{ fontSize: 13, color: '#64748b' }}>₹{editTotals.totalGst.toFixed(2)}</span>
                    </div>
                    <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 4, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Total</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: P }}>₹{editTotals.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <button
                onClick={handleSaveEdit}
                disabled={saving || editItems.length === 0 || editPriceErrors.length > 0 || editDiscountErrors.length > 0}
                style={{
                  width: '100%', padding: '14px',
                  background: (editItems.length === 0 || editPriceErrors.length > 0 || editDiscountErrors.length > 0) ? '#94a3b8' : P,
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontWeight: 700, fontSize: 15, cursor: (editItems.length === 0 || editPriceErrors.length > 0 || editDiscountErrors.length > 0) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {saving ? 'Saving Changes…' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditOrderId(null)}
                style={{
                  width: '100%', padding: '12px',
                  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
                  color: '#64748b', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Page Title */}
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: -0.3 }}>My History</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Daily activity summary</div>
      </div>

      {/* Date Navigator */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <button
          onClick={goBack}
          style={{
            width: 34, height: 34, borderRadius: 8, border: '1px solid #e2e8f0',
            background: '#f8fafc', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0,
          }}
        >
          <LeftOutlined style={{ fontSize: 12 }} />
        </button>

        <div style={{ flex: 1, textAlign: 'center' }}>
          <DatePicker
            value={date}
            onChange={(d) => d && setDate(d)}
            disabledDate={(d) => d.isAfter(dayjs(), 'day')}
            format="DD MMM YYYY"
            allowClear={false}
            suffixIcon={null}
            style={{ border: 'none', boxShadow: 'none', background: 'transparent', width: '100%' }}
            variant="borderless"
          />
        </div>

        <button
          onClick={goForward}
          disabled={isToday}
          style={{
            width: 34, height: 34, borderRadius: 8, border: '1px solid #e2e8f0',
            background: isToday ? '#f1f5f9' : '#f8fafc',
            cursor: isToday ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isToday ? '#cbd5e1' : '#64748b', flexShrink: 0,
          }}
        >
          <RightOutlined style={{ fontSize: 12 }} />
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[1, 2, 3, 4].map(i => <Skeleton key={i} active paragraph={{ rows: 2 }} title={false} />)}
          </div>
          <Skeleton active paragraph={{ rows: 4 }} />
        </div>
      ) : (
        <>
          {/* Route Banner */}
          <div style={{
            background: history?.routeName ? PL : '#f8fafc',
            border: `1px solid ${history?.routeName ? '#a7f3d0' : '#e2e8f0'}`,
            borderRadius: 12, padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: history?.routeName ? P : '#cbd5e1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 16, flexShrink: 0,
            }}>
              <EnvironmentOutlined />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Route</div>
              <div style={{
                fontWeight: 700, fontSize: 14,
                color: history?.routeName ? '#0f172a' : '#94a3b8',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {history?.routeName || 'No route allocated'}
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isSmall ? 8 : 10 }}>
            <StatCard icon={<FileTextOutlined />} label="Orders" value={String(history?.ordersCount || 0)} color="#8b5cf6" bg="#f5f3ff" />
            <StatCard icon={<ShoppingOutlined />} label="Sales Value" value={salesLabel} color={P} bg={PL} />
            <StatCard icon={<WalletOutlined />} label="Collected" value={collectedLabel} color="#d97706" bg="#fffbeb" />
            <div style={{
              background: '#fff', borderRadius: 12,
              padding: '14px 12px', border: '1px solid #e2e8f0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}>
              <div style={{ fontSize: 10, color: '#64748b', fontWeight: 500, marginBottom: 6 }}>Breakdown</div>
              {[
                { label: 'Cash', value: cash, color: '#16a34a' },
                { label: 'UPI',  value: upi,  color: '#7c3aed' },
                { label: 'Other', value: other, color: '#0369a1' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{row.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: row.value > 0 ? row.color : '#94a3b8' }}>
                    {fmt(row.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Orders / Payments Tabs */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'orders',
                label: `Orders (${history?.ordersCount || 0})`,
                children: !history?.orders?.length ? (
                  <div style={{
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16,
                    padding: '36px 20px', textAlign: 'center',
                  }}>
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <span style={{ color: '#94a3b8', fontSize: 13 }}>No orders on this day</span>
                      }
                    />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {history.orders.map((order: any) => {
                      const sc = STATUS_COLORS[order.status] || { color: '#6b7280', bg: '#f3f4f6' };
                      const balance = Number(order.totalAmount || 0) - Number(order.paidAmount || 0);
                      return (
                        <div key={order.orderId} style={{
                          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
                          padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{
                                fontWeight: 700, color: '#0f172a', fontSize: 13,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {order.customerName}
                              </div>
                              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                                #{order.orderNumber} · {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: '3px 9px',
                                borderRadius: 20, background: sc.bg, color: sc.color,
                              }}>
                                {order.status}
                              </span>
                              {(['DRAFT', 'SUBMITTED', 'APPROVED'].includes(order.status) && (hasPermission('ORDERS_EDIT') || hasPermission('ORDERS_CREATE'))
                                || ['DRAFT', 'SUBMITTED'].includes(order.status) && hasPermission('ORDERS_CANCEL')) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                  {(hasPermission('ORDERS_EDIT') || hasPermission('ORDERS_CREATE')) && (
                                    <Tooltip title="Edit order">
                                      <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(order.orderId)} style={{ color: '#64748b', width: 26, height: 26, padding: 0 }} />
                                    </Tooltip>
                                  )}
                                  {hasPermission('ORDERS_CANCEL') && ['DRAFT', 'SUBMITTED'].includes(order.status) && (
                                    <Tooltip title="Cancel order">
                                      <Button type="text" danger size="small" icon={<CloseCircleOutlined />} onClick={() => handleCancel(order.orderId, order.orderNumber)} style={{ width: 26, height: 26, padding: 0 }} />
                                    </Tooltip>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 12, borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 10, color: '#94a3b8' }}>Total</div>
                              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 13 }}>{fmt(order.totalAmount)}</div>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 10, color: '#94a3b8' }}>Collected</div>
                              <div style={{ fontWeight: 700, color: P, fontSize: 13 }}>{fmt(order.paidAmount)}</div>
                            </div>
                            {balance > 0.01 && (
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 10, color: '#94a3b8' }}>Balance</div>
                                <div style={{ fontWeight: 700, color: '#ef4444', fontSize: 13 }}>{fmt(balance)}</div>
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: 8, marginTop: 8 }}>
                            <Button
                              type="text" size="small" icon={<ShareAltOutlined />}
                              loading={sharingInvoiceId === order.orderId}
                              onClick={() => shareInvoice(order)}
                              style={{ color: P, fontWeight: 600 }}
                            >
                              Share Invoice
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ),
              },
              {
                key: 'payments',
                label: `Payments Collected (${history?.payments?.length || 0})`,
                children: !history?.payments?.length ? (
                  <div style={{
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16,
                    padding: '36px 20px', textAlign: 'center',
                  }}>
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <span style={{ color: '#94a3b8', fontSize: 13 }}>No payments collected on this day</span>
                      }
                    />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {history.payments.map((p: any) => (
                      <div key={p.paymentId} style={{
                        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
                        padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{
                              fontWeight: 700, color: '#0f172a', fontSize: 13,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {p.customerName}
                            </div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                              #{p.orderNumber}
                              {p.paymentMethodName ? ` · ${p.paymentMethodName}` : ''}
                              {p.referenceNumber ? ` · Ref: ${p.referenceNumber}` : ''}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                            <div style={{ fontWeight: 800, color: P, fontSize: 14 }}>{fmt(p.amount)}</div>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '3px 9px',
                              borderRadius: 20, background: PL, color: P,
                            }}>
                              {p.paymentMode}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: p.submitted ? P : '#d97706' }}>
                            {p.submitted ? 'Submitted to accountant' : 'Pending submission'}
                          </span>
                          <Button
                            type="text" size="small" icon={<ShareAltOutlined />}
                            loading={sharingReceiptId === p.paymentId}
                            onClick={() => shareReceipt(p)}
                            style={{ color: P, fontWeight: 600 }}
                          >
                            Share
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ),
              },
              ...(canViewReturns ? [{
                key: 'returns',
                label: `Returns (${myReturns.length})`,
                children: !myReturns.length ? (
                  <div style={{
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16,
                    padding: '36px 20px', textAlign: 'center',
                  }}>
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <span style={{ color: '#94a3b8', fontSize: 13 }}>No returns filed on this day</span>
                      }
                    />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {myReturns.map((r: any) => {
                      const tc = RETURN_TYPE_LABELS[r.type] || RETURN_TYPE_LABELS.DAMAGE;
                      const party = r.type === 'PURCHASE_RETURN' ? (r.supplierName || r.referencePurchaseSupplierName) : r.referenceOrderCustomerName;
                      return (
                        <div key={r.id} style={{
                          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
                          padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{r.returnNumber}</div>
                              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                                {party || '—'} · {r.items?.length || 0} item{(r.items?.length || 0) !== 1 ? 's' : ''}
                              </div>
                            </div>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '3px 9px',
                              borderRadius: 20, background: tc.bg, color: tc.color, flexShrink: 0, marginLeft: 8,
                            }}>
                              {tc.label}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: r.warehouseStatus === 'PENDING_VERIFICATION' ? '#d97706' : '#94a3b8' }}>
                              {r.warehouseStatus === 'PENDING_VERIFICATION' ? 'Pending warehouse verification' : r.refundStatus === 'PENDING' ? 'Refund pending' : 'Processed'}
                            </span>
                            <span style={{ fontWeight: 800, color: tc.color, fontSize: 14 }}>{fmt(r.totalAmount)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ),
              }] : []),
            ]}
          />
        </>
      )}
    </div>
  );
};

export default SalesHistoryPage;
