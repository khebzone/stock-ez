import React, { useState, useEffect } from 'react';
import { Input, message, Spin, Button, InputNumber, Grid, Tooltip } from 'antd';
import {
  SearchOutlined, PlusOutlined, MinusOutlined, CheckCircleOutlined,
  ShoppingCartOutlined, ArrowLeftOutlined, CloseOutlined,
  UserOutlined, AppstoreOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGetMyCustomersQuery } from '../../store/api/salesApi';
import { useGetProductsQuery } from '../../store/api/productApi';
import { useCreateOrderMutation } from '../../store/api/orderApi';
import { useGetCustomerOutstandingQuery } from '../../store/api/customerApi';

const { useBreakpoint } = Grid;

const P  = '#059669';
const PD = '#047857';
const PL = '#ecfdf5';

interface CartItem {
  productId: string;
  product: any;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
}

const QtyInput: React.FC<{
  qty: number; product: any;
  setQty: (p: any, q: number) => void;
  style?: React.CSSProperties;
}> = ({ qty, product, setQty, style }) => {
  const [val, setVal] = React.useState(String(qty));
  React.useEffect(() => { setVal(String(qty)); }, [qty]);
  return (
    <input
      type="number"
      value={val}
      min={1}
      max={product?.stockQuantity ?? undefined}
      onChange={e => {
        setVal(e.target.value);
        const v = parseInt(e.target.value);
        if (!isNaN(v) && v >= 1) setQty(product, v);
      }}
      onBlur={() => {
        const v = parseInt(val);
        if (isNaN(v) || v < 1) setVal(String(qty));
      }}
      style={{ MozAppearance: 'textfield' as any, ...style }}
    />
  );
};

const StepBar: React.FC<{ step: number }> = ({ step }) => {
  const steps = [
    { icon: <UserOutlined />,     label: 'Customer' },
    { icon: <AppstoreOutlined />, label: 'Products' },
    { icon: <FileTextOutlined />, label: 'Review'   },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: i <= step ? P : '#e2e8f0',
              color: i <= step ? '#fff' : '#94a3b8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, transition: 'all 0.2s',
            }}>
              {i < step ? <CheckCircleOutlined /> : s.icon}
            </div>
            <div style={{ fontSize: 10, fontWeight: i === step ? 700 : 500, color: i <= step ? P : '#94a3b8', marginTop: 4 }}>
              {s.label}
            </div>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 2, height: 2, background: i < step ? P : '#e2e8f0', marginBottom: 18, transition: 'background 0.3s' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const SalesOrderPage: React.FC = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const screens   = useBreakpoint();
  const isMobile  = !screens.md;
  const isTablet  = screens.md && !screens.lg;

  const [step, setStep] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch]     = useState('');
  const [productSearch, setProductSearch]       = useState('');
  const [cart, setCart]                         = useState<CartItem[]>([]);
  const [notes, setNotes]                       = useState('');

  const { data: customersData, isLoading: custLoading } = useGetMyCustomersQuery();
  const { data: productsData,  isLoading: prodLoading  } = useGetProductsQuery({ size: 300 });
  const [createOrder, { isLoading: creating }]           = useCreateOrderMutation();
  const { data: outstandingData } = useGetCustomerOutstandingQuery(selectedCustomer?.id ?? 'skip', { skip: !selectedCustomer?.id });

  const customers: any[] = customersData?.data || [];
  const products: any[]  = productsData?.data?.content || productsData?.data || [];
  const outstanding  = outstandingData?.data;
  const isOverLimit  = outstanding?.overLimit === true;

  useEffect(() => {
    const state = location.state as any;
    if (state?.customerId && customers.length) {
      const c = customers.find((c: any) => c.id === state.customerId);
      if (c) { setSelectedCustomer(c); setStep(1); }
    }
  }, [location.state, customers]);

  const filteredCustomers = customers.filter((c: any) =>
    !customerSearch ||
    c.businessName?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.ownerName?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone?.includes(customerSearch)
  );

  const filteredProducts = products.filter((p: any) =>
    !productSearch ||
    p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.brand?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.code?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const getQty = (id: string) => cart.find(i => i.productId === id)?.quantity || 0;

  const setQty = (product: any, qty: number) => {
    if (qty < 0) return;
    if (qty === 0) {
      setCart(prev => prev.filter(i => i.productId !== product.id));
    } else {
      const max = product.stockQuantity;
      if (max !== undefined && max !== null && qty > max) {
        message.warning(`Only ${max} units available`);
        qty = max;
      }
      setCart(prev => {
        const exists = prev.find(i => i.productId === product.id);
        if (exists) return prev.map(i => i.productId === product.id ? { ...i, quantity: qty } : i);
        return [...prev, {
          productId: product.id, product, quantity: qty,
          unitPrice: product.salesRate1 || 0,
          gstPercent: product.salesGstPercent || 0,
        }];
      });
    }
  };

  const updatePrice = (productId: string, price: number) => {
    if (price <= 0) return;
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, unitPrice: price } : i));
  };

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(i => i.productId !== productId));

  const lineTotal    = (item: CartItem) => item.unitPrice * item.quantity * (1 + item.gstPercent / 100);
  const cartTotal    = () => cart.reduce((s, i) => s + lineTotal(i), 0);
  const cartSubtotal = () => cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const cartGst      = () => cart.reduce((s, i) => s + i.unitPrice * i.quantity * (i.gstPercent / 100), 0);

  const priceErrors = cart.filter(item => {
    const min = item.product?.fifoMinSaleRate ?? item.product?.minSaleRate;
    const max = item.product?.fifoMaxSaleRate ?? item.product?.maxSaleRate;
    return (min != null && item.unitPrice < min) || (max != null && item.unitPrice > max);
  });

  const handleSubmit = async () => {
    if (!selectedCustomer) { message.error('No customer selected'); return; }
    if (cart.length === 0)  { message.error('Cart is empty'); return; }
    if (isOverLimit) { message.error('Credit limit exceeded. Collect payment first.'); return; }
    if (priceErrors.length > 0) {
      message.error(`Fix price for: ${priceErrors.map(i => i.product?.name).join(', ')}`);
      return;
    }
    try {
      await createOrder({
        customerId: selectedCustomer.id,
        notes,
        items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
      }).unwrap();
      message.success('Order placed successfully!');
      navigate('/sales/route');
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to place order');
    }
  };

  // ── shared styles ────────────────────────────────────────────────────────────
  const colLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 0.5,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => step > 0 ? setStep(s => s - 1) : navigate(-1)}
          style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 15, flexShrink: 0 }}
        >
          <ArrowLeftOutlined />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>New Order</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {step === 0 ? 'Select a customer' : step === 1 ? `${selectedCustomer?.businessName} · Add products` : 'Review & confirm'}
          </div>
        </div>
        {cart.length > 0 && step < 2 && (
          <div
            style={{ flexShrink: 0, background: PL, borderRadius: 16, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', border: `1px solid #a7f3d0` }}
            onClick={() => { if (selectedCustomer) setStep(2); }}
          >
            <ShoppingCartOutlined style={{ color: P, fontSize: 13 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: P }}>{cart.length}</span>
          </div>
        )}
      </div>

      {/* Step bar */}
      <StepBar step={step} />

      {/* ── Step 0: Customer Selection ── */}
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Search by name, owner or phone..."
            value={customerSearch}
            onChange={e => setCustomerSearch(e.target.value)}
            size="large"
            allowClear
            style={{ borderRadius: 8 }}
          />
          {custLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          ) : filteredCustomers.length === 0 ? (
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13, border: '1px solid #e2e8f0' }}>
              {customerSearch ? 'No customers match your search' : 'No customers on today\'s route'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              {filteredCustomers.map((c: any, idx: number) => (
                <div
                  key={c.id}
                  onClick={() => { setSelectedCustomer(c); setStep(1); }}
                  style={{
                    background: selectedCustomer?.id === c.id ? PL : '#fff',
                    borderBottom: idx < filteredCustomers.length - 1 ? '1px solid #f1f5f9' : 'none',
                    padding: '13px 15px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12,
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    background: selectedCustomer?.id === c.id ? P : '#f1f5f9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: selectedCustomer?.id === c.id ? '#fff' : '#64748b',
                    fontWeight: 700, fontSize: 15,
                  }}>
                    {c.businessName?.[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.businessName}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
                      {c.ownerName} · {c.phone}
                    </div>
                    {c.placeName && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{c.placeName}</div>}
                  </div>
                  <CheckCircleOutlined style={{ color: selectedCustomer?.id === c.id ? P : '#e2e8f0', fontSize: 16, flexShrink: 0 }} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step 1: Products ── */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Customer bar */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ ...colLabel }}>Customer</div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, marginTop: 1 }}>{selectedCustomer?.businessName}</div>
            </div>
            <button onClick={() => setStep(0)} style={{ background: 'none', border: 'none', color: P, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              Change
            </button>
          </div>

          {/* Credit warning */}
          {outstanding && outstanding.totalOutstanding > 0 && (
            <div style={{ background: isOverLimit ? '#fef2f2' : '#fffbeb', border: `1px solid ${isOverLimit ? '#fecaca' : '#fde68a'}`, borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: isOverLimit ? '#dc2626' : '#92400e' }}>
                  {isOverLimit ? 'Credit Limit Exceeded' : 'Outstanding Balance'}
                </div>
                <span style={{ fontWeight: 700, fontSize: 13, color: isOverLimit ? '#dc2626' : '#d97706' }}>
                  ₹{Number(outstanding.totalOutstanding).toFixed(2)}
                </span>
              </div>
              {outstanding.creditAllowed && outstanding.creditLimit > 0 && (
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  Limit: ₹{Number(outstanding.creditLimit).toFixed(2)}
                  {isOverLimit && <span style={{ color: '#dc2626', fontWeight: 700 }}> — New orders blocked</span>}
                </div>
              )}
            </div>
          )}

          <Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Search products..."
            value={productSearch}
            onChange={e => setProductSearch(e.target.value)}
            size="large"
            allowClear
            style={{ borderRadius: 8 }}
          />

          {/* Cart bar */}
          {cart.length > 0 && (
            <div style={{ background: isOverLimit ? '#dc2626' : P, borderRadius: 8, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>
                  {isOverLimit ? 'Credit limit exceeded — blocked' : `${cart.length} item${cart.length > 1 ? 's' : ''}`}
                </div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>₹{cartTotal().toFixed(2)}</div>
              </div>
              <Button size="small" onClick={() => !isOverLimit && setStep(2)} disabled={isOverLimit}
                style={{ background: '#fff', color: isOverLimit ? '#94a3b8' : P, fontWeight: 700, border: 'none', borderRadius: 6, height: 32, padding: '0 14px' }}>
                {isOverLimit ? 'Blocked' : 'Review →'}
              </Button>
            </div>
          )}

          {prodLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          ) : filteredProducts.length === 0 ? (
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13, border: '1px solid #e2e8f0' }}>
              No products found
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
              {filteredProducts.map((p: any) => {
                const qty = getQty(p.id);
                const inCart = qty > 0;
                const outOfStock = (p.stockQuantity !== null && p.stockQuantity !== undefined) && p.stockQuantity === 0;
                return (
                  <div key={p.id} style={{
                    background: '#fff',
                    border: `1px solid ${inCart ? P : '#e2e8f0'}`,
                    borderRadius: 10, padding: '10px',
                    opacity: outOfStock ? 0.5 : 1,
                    transition: 'border-color 0.15s',
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    <div style={{ position: 'relative' }}>
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: 64, objectFit: 'cover', borderRadius: 6 }} />
                      ) : (
                        <div style={{ height: 52, borderRadius: 6, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ShoppingCartOutlined style={{ fontSize: 18, color: '#cbd5e1' }} />
                        </div>
                      )}
                      <span style={{
                        position: 'absolute', top: 3, right: 3, fontSize: 9, fontWeight: 700,
                        padding: '1px 5px', borderRadius: 10,
                        background: outOfStock ? '#fef2f2' : (p.stockQuantity <= 10 ? '#fffbeb' : '#f0fdf4'),
                        color: outOfStock ? '#ef4444' : (p.stockQuantity <= 10 ? '#d97706' : '#16a34a'),
                      }}>
                        {outOfStock ? 'Out' : p.stockQuantity}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 12, lineHeight: 1.3 }}>{p.name}</div>
                      {p.brand && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{p.brand}</div>}
                    </div>
                    <div style={{ fontWeight: 700, color: P, fontSize: 13 }}>
                      ₹{(p.salesRate1 || 0).toFixed(2)}
                      {p.salesGstPercent > 0 && <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}> +{p.salesGstPercent}%</span>}
                    </div>
                    {outOfStock ? (
                      <div style={{ textAlign: 'center', fontSize: 11, color: '#ef4444', fontWeight: 600 }}>Out of Stock</div>
                    ) : qty === 0 ? (
                      <button
                        onClick={() => setQty(p, 1)}
                        style={{ width: '100%', height: 32, border: `1px solid ${P}`, borderRadius: 6, background: '#fff', color: P, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                      >
                        <PlusOutlined style={{ fontSize: 10 }} /> Add
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: PL, borderRadius: 6, padding: '2px 4px' }}>
                        <button onClick={() => setQty(p, qty - 1)} style={{ width: 26, height: 26, border: 'none', background: '#fff', borderRadius: 4, cursor: 'pointer', color: P, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <MinusOutlined style={{ fontSize: 9 }} />
                        </button>
                        <QtyInput qty={qty} product={p} setQty={setQty} style={{ width: 36, textAlign: 'center', border: 'none', background: 'transparent', fontWeight: 700, color: P, fontSize: 14, outline: 'none' }} />
                        <button onClick={() => setQty(p, qty + 1)} style={{ width: 26, height: 26, border: 'none', background: P, borderRadius: 4, cursor: 'pointer', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PlusOutlined style={{ fontSize: 9 }} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Review ── */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Order document */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>

            {/* Bill To */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f4f8', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ ...colLabel, marginBottom: 4 }}>Bill To</div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15, lineHeight: 1.3 }}>{selectedCustomer?.businessName}</div>
                {selectedCustomer?.ownerName && (
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {selectedCustomer.ownerName}
                    {selectedCustomer.phone && <span> · {selectedCustomer.phone}</span>}
                  </div>
                )}
              </div>
              <button
                onClick={() => setStep(0)}
                style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, color: '#475569', fontSize: 12, cursor: 'pointer', fontWeight: 500, padding: '4px 10px', marginTop: 2 }}
              >
                Change
              </button>
            </div>

            {/* Table column headers — desktop only */}
            {!isMobile && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: isTablet ? '1fr 76px 68px 62px 52px 76px 20px' : '1fr 84px 76px 70px 60px 84px 22px',
                gap: '0 8px',
                padding: '7px 16px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
              }}>
                <div style={{ ...colLabel }}>Product</div>
                <div style={{ ...colLabel }}>Rate</div>
                <div style={{ ...colLabel, textAlign: 'center' }}>Qty</div>
                <div style={{ ...colLabel, textAlign: 'right' }}>Gross</div>
                <div style={{ ...colLabel, textAlign: 'right' }}>GST</div>
                <div style={{ ...colLabel, textAlign: 'right' }}>Total</div>
                <div />
              </div>
            )}

            {/* Line items */}
            {cart.map((item, idx) => {
              const min      = item.product?.fifoMinSaleRate ?? item.product?.minSaleRate;
              const max      = item.product?.fifoMaxSaleRate ?? item.product?.maxSaleRate;
              const belowMin = min != null && item.unitPrice < min;
              const aboveMax = max != null && item.unitPrice > max;
              const hasError = belowMin || aboveMax;
              const gross    = item.unitPrice * item.quantity;
              const gstAmt   = gross * item.gstPercent / 100;

              const qtyH    = isTablet ? 26 : 30;
              const btnW    = isMobile ? 28 : 22;
              const inputW  = isMobile ? 34 : (isTablet ? 24 : 28);
              const QtyControl = (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden', height: qtyH, flexShrink: 0 }}>
                  <button onClick={() => setQty(item.product, item.quantity - 1)} style={{ width: btnW, height: '100%', border: 'none', background: '#f8fafc', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MinusOutlined style={{ fontSize: 9 }} />
                  </button>
                  <QtyInput qty={item.quantity} product={item.product} setQty={setQty}
                    style={{ width: inputW, textAlign: 'center', height: '100%', border: 'none', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', background: '#fff', fontWeight: 700, color: '#0f172a', fontSize: 12, outline: 'none' }} />
                  <button onClick={() => setQty(item.product, item.quantity + 1)} style={{ width: btnW, height: '100%', border: 'none', background: '#f8fafc', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <PlusOutlined style={{ fontSize: 9 }} />
                  </button>
                </div>
              );

              return (
                <div
                  key={item.productId}
                  style={{
                    borderBottom: idx < cart.length - 1 ? '6px solid #f1f5f9' : 'none',
                    background: hasError ? '#fffdf0' : '#fff',
                  }}
                >
                  {isMobile ? (
                    <>
                      {/* Mobile — top row: name + total + delete */}
                      <div style={{ padding: '11px 16px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13, lineHeight: 1.4 }}>{item.product?.name}</div>
                          {item.product?.brand && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{item.product.brand}</div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: hasError ? '#dc2626' : '#0f172a' }}>₹{lineTotal(item).toFixed(2)}</div>
                            {item.gstPercent > 0 && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>GST ₹{gstAmt.toFixed(2)}</div>}
                          </div>
                          <button onClick={() => removeFromCart(item.productId)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '2px 0 0 4px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                            <CloseOutlined style={{ fontSize: 11 }} />
                          </button>
                        </div>
                      </div>
                      {/* Mobile — bottom row: qty + rate input + error if any */}
                      <div style={{ padding: '0 16px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {QtyControl}
                        <Tooltip
                          title={(min != null || max != null) ? `${min != null ? `min ₹${Number(min).toFixed(2)}` : ''}${min != null && max != null ? ' – ' : ''}${max != null ? `max ₹${Number(max).toFixed(2)}` : ''}` : undefined}
                          placement="top"
                        >
                          <InputNumber size="small" min={0.01} value={item.unitPrice} onChange={v => v != null && updatePrice(item.productId, v)} prefix="₹" style={{ width: 90, height: 30 }} status={hasError ? 'error' : ''} />
                        </Tooltip>
                        {hasError && (
                          <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>
                            {belowMin ? `Below min ₹${Number(min).toFixed(2)}` : `Above max ₹${Number(max).toFixed(2)}`}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Desktop/tablet — single row: Product | Rate | Qty | Gross | GST | Total | Delete */
                    <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr 76px 68px 62px 52px 76px 20px' : '1fr 84px 76px 70px 60px 84px 22px', gap: '0 8px', padding: '10px 16px', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product?.name}</div>
                        {item.product?.brand && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{item.product.brand}</div>}
                        {hasError && (
                          <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 600, marginTop: 2 }}>
                            {belowMin ? `Below min ₹${Number(min).toFixed(2)}` : `Above max ₹${Number(max).toFixed(2)}`}
                          </div>
                        )}
                      </div>
                      <Tooltip
                        title={(min != null || max != null) ? `${min != null ? `min ₹${Number(min).toFixed(2)}` : ''}${min != null && max != null ? ' – ' : ''}${max != null ? `max ₹${Number(max).toFixed(2)}` : ''}` : undefined}
                        placement="top"
                      >
                        <InputNumber size="small" min={0.01} value={item.unitPrice} onChange={v => v != null && updatePrice(item.productId, v)} prefix="₹" style={{ width: isTablet ? 72 : 82, height: isTablet ? 26 : 30 }} status={hasError ? 'error' : ''} />
                      </Tooltip>
                      {QtyControl}
                      <div style={{ textAlign: 'right', fontSize: 13, color: '#475569' }}>₹{gross.toFixed(2)}</div>
                      <div style={{ textAlign: 'right', fontSize: 13, color: '#475569' }}>₹{gstAmt.toFixed(2)}</div>
                      <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 14, color: hasError ? '#dc2626' : '#0f172a' }}>₹{lineTotal(item).toFixed(2)}</div>
                      <button onClick={() => removeFromCart(item.productId)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CloseOutlined style={{ fontSize: 11 }} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Totals block — same grid as table rows so amounts align with Total column */}
            <div style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc', padding: '8px 0 10px' }}>
              {[
                { label: 'Subtotal', value: cartSubtotal().toFixed(2), color: '#0f172a' },
                { label: 'GST',      value: cartGst().toFixed(2),      color: '#64748b' },
              ].map(row => (
                <div key={row.label} style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr 76px 68px 62px 52px 76px 20px' : '1fr 84px 76px 70px 60px 84px 22px', gap: '0 8px', padding: '2px 16px' }}>
                  <div style={{ gridColumn: '1 / 6', textAlign: 'right', fontSize: 12, color: '#64748b' }}>{row.label}</div>
                  <div style={{ textAlign: 'right', fontSize: 12, color: row.color }}>₹{row.value}</div>
                  <div />
                </div>
              ))}
              <div style={{ height: 1, background: '#e2e8f0', margin: '6px 16px 4px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr 76px 68px 62px 52px 76px 20px' : '1fr 84px 76px 70px 60px 84px 22px', gap: '0 8px', padding: '2px 16px' }}>
                <div style={{ gridColumn: '1 / 6', textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Total</div>
                <div style={{ textAlign: 'right', fontSize: 16, fontWeight: 800, color: P }}>₹{cartTotal().toFixed(2)}</div>
                <div />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <div style={{ ...colLabel, marginBottom: 6 }}>Notes (optional)</div>
            <Input.TextArea
              rows={2}
              placeholder="Delivery instructions or special notes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              maxLength={300}
              showCount
              style={{ borderRadius: 8, fontSize: 13 }}
            />
          </div>

          {/* Credit limit block */}
          {isOverLimit && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 13, marginBottom: 3 }}>Order Blocked — Credit Limit Exceeded</div>
              <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                {selectedCustomer?.businessName} has ₹{Number(outstanding?.totalOutstanding || 0).toFixed(2)} outstanding against a limit of ₹{Number(outstanding?.creditLimit || 0).toFixed(2)}.
              </div>
            </div>
          )}

          {/* Submit */}
          <Button
            type="primary" size="large" block loading={creating} onClick={handleSubmit}
            disabled={isOverLimit || priceErrors.length > 0}
            style={{
              height: 48, borderRadius: 8, fontWeight: 700, fontSize: 15,
              background: (isOverLimit || priceErrors.length > 0) ? '#94a3b8' : P,
              borderColor: (isOverLimit || priceErrors.length > 0) ? '#94a3b8' : PD,
            }}
          >
            {creating ? 'Placing Order...'
              : isOverLimit ? 'Order Blocked'
              : priceErrors.length > 0 ? 'Fix Price Errors First'
              : `Place Order · ₹${cartTotal().toFixed(2)}`}
          </Button>
        </div>
      )}
    </div>
  );
};

export default SalesOrderPage;
