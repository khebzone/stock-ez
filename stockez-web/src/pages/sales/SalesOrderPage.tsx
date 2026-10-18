import React, { useState, useEffect, useMemo, useCallback, useTransition } from 'react';
import { Input, message, Spin, Button, InputNumber, Grid, Tooltip, Modal, Form, Select, Switch, Result, Popover } from 'antd';
import {
  SearchOutlined, PlusOutlined, MinusOutlined, CheckCircleOutlined,
  ShoppingCartOutlined, ArrowLeftOutlined, CloseOutlined,
  UserOutlined, AppstoreOutlined, FileTextOutlined,
  AimOutlined, LoadingOutlined, LockOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGetMyCustomersQuery, useGetMyAllocationQuery } from '../../store/api/salesApi';
import { useGetAllProductsQuery } from '../../store/api/productApi';
import { useCreateOrderMutation, useGetCustomerLastPricesQuery } from '../../store/api/orderApi';
import { useGetNearExpiryAlertsQuery } from '../../store/api/purchaseApi';
import { useGetCustomerOutstandingQuery, useCreateCustomerMutation } from '../../store/api/customerApi';
import { useGetRoutePlanQuery } from '../../store/api/routeApi';
import { useGetWorkflowSettingsQuery } from '../../store/api/supplierApi';
import { useGetTodayStatusQuery } from '../../store/api/attendanceApi';
import { getProductRates, isPriceOutOfRange, defaultUnitPrice } from '../../utils/priceUtils';

const { useBreakpoint } = Grid;

const P  = '#059669';
const PD = '#047857';
const PL = '#ecfdf5';

interface CartItem {
  productId: string;
  product: any;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
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

// ── Module-level pure helpers (stable references, no state dependency) ────────

const fmtShortDate = (d: string) => {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

// Identity for "the same real-world product" — catches duplicate product records
// (same name/brand/unit under different IDs) so the salesman can't bill it twice.
const sameProductKey = (p: any) =>
  [p?.name, p?.brand, p?.unit].map(v => String(v ?? '').trim().toLowerCase()).join('|');

const pricePopoverContent = (entries: { price: number; date: string }[]) => (
  <div style={{ minWidth: 150 }}>
    {entries.map((e, i) => (
      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, padding: '3px 0', fontSize: 12, borderBottom: i < entries.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
        <span style={{ fontWeight: 600, color: '#0f172a' }}>₹{Number(e.price).toFixed(2)}</span>
        <span style={{ color: '#64748b' }}>{fmtShortDate(e.date)}</span>
      </div>
    ))}
  </div>
);

// ── Memoized product card — only re-renders when this product's qty changes ───

interface ProductCardProps {
  p: any;
  qty: number;
  daysLeft: number | undefined;
  lastPrices: { price: number; date: string }[] | undefined;
  setQty: (product: any, qty: number) => void;
  onPreview: (url: string) => void;
  isMobile: boolean;
  isSmall: boolean;
  showPurchaseRate: boolean;
}

const ProductCard = React.memo<ProductCardProps>(({ p, qty, daysLeft, lastPrices, setQty, onPreview, isMobile, isSmall, showPurchaseRate }) => {
  const inCart    = qty > 0;
  const isExpired = daysLeft != null && daysLeft <= 0;
  const isNear    = daysLeft != null && daysLeft > 0;
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${inCart ? P : isExpired ? '#fca5a5' : isNear ? '#fde68a' : '#e2e8f0'}`,
      borderRadius: 12, overflow: 'hidden',
      transition: 'border-color 0.15s, box-shadow 0.15s',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Image — full pack on white (contain), never cropped */}
      <div style={{ position: 'relative', background: '#fff', padding: 8, borderBottom: '1px solid #f1f5f9' }}>
        {p.imageUrl ? (
          <img src={p.imageUrl} alt={p.name} onClick={() => onPreview(p.imageUrl)} style={{ width: '100%', height: 110, objectFit: 'contain', cursor: 'pointer', display: 'block' }} />
        ) : (
          <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingCartOutlined style={{ fontSize: 24, color: '#cbd5e1' }} />
          </div>
        )}
        <span style={{
          position: 'absolute', top: 6, right: 6, fontSize: 10, fontWeight: 700,
          padding: '2px 7px', borderRadius: 12,
          background: p.stockQuantity <= 10 ? '#fffbeb' : '#f0fdf4',
          color: p.stockQuantity <= 10 ? '#d97706' : '#16a34a',
          border: `1px solid ${p.stockQuantity <= 10 ? '#fde68a' : '#bbf7d0'}`,
        }}>
          {p.stockQuantity}
        </span>
      </div>

      {/* Content — brand · name · price hierarchy */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {p.brand && <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.3 }}>{p.brand}</div>}
        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13, lineHeight: 1.35 }}>{p.name}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(p.fifoMrp ?? p.mrp) != null && (
            <span style={{ fontSize: 11, color: '#64748b' }}>MRP ₹{Number(p.fifoMrp ?? p.mrp).toFixed(2)}</span>
          )}
          <span style={{ fontSize: 14, fontWeight: 700, color: P }}>
            SR ₹{((p.fifoMaxSaleRate ?? p.maxSaleRate) || 0).toFixed(2)}
            {p.salesGstPercent > 0 && <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}> +{p.salesGstPercent}%</span>}
          </span>
          {showPurchaseRate && (p.fifoPurchaseRate != null || p.purchaseRate != null) && (
            <span style={{ fontSize: 11, color: '#64748b' }}>
              PR ₹{p.fifoPurchaseRate != null
                ? Number(p.fifoPurchaseRate).toFixed(2)
                : Number(p.purchaseRate).toFixed(2)}
            </span>
          )}
        </div>
        {lastPrices && lastPrices.length > 0 && (
          isMobile ? (
            <div style={{ fontSize: 10, color: '#64748b' }}>
              Last: {lastPrices.map((e, i) => <span key={i}>{i > 0 && <span style={{ color: '#cbd5e1' }}> · </span>}₹{Number(e.price).toFixed(2)} <span style={{ color: '#94a3b8' }}>({fmtShortDate(e.date)})</span></span>)}
            </div>
          ) : (
            <Popover trigger={["hover", "click"]} title={<span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Last Billed</span>} content={pricePopoverContent(lastPrices)}>
              <div style={{ fontSize: 10, color: '#64748b', cursor: 'pointer' }}>
                Last: {lastPrices.map((e, i) => <span key={i}>{i > 0 && <span style={{ color: '#cbd5e1' }}> · </span>}₹{Number(e.price).toFixed(2)}</span>)}
              </div>
            </Popover>
          )
        )}
        {qty === 0 ? (
          <button
            onClick={() => setQty(p, 1)}
            style={{ marginTop: 'auto', width: '100%', height: 34, border: `1px solid ${P}`, borderRadius: 8, background: '#fff', color: P, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <PlusOutlined style={{ fontSize: 10 }} /> Add
          </button>
        ) : (
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: PL, borderRadius: 8, padding: '3px 4px' }}>
            <button onClick={() => setQty(p, qty - 1)} style={{ width: 28, height: 28, border: 'none', background: '#fff', borderRadius: 6, cursor: 'pointer', color: P, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MinusOutlined style={{ fontSize: 9 }} />
            </button>
            <QtyInput qty={qty} product={p} setQty={setQty} style={{ width: 36, textAlign: 'center', border: 'none', background: 'transparent', fontWeight: 700, color: P, fontSize: 14, outline: 'none' }} />
            <button onClick={() => setQty(p, qty + 1)} style={{ width: 28, height: 28, border: 'none', background: P, borderRadius: 6, cursor: 'pointer', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PlusOutlined style={{ fontSize: 9 }} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

// ── Main page ─────────────────────────────────────────────────────────────────

const SalesOrderPage: React.FC = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const screens   = useBreakpoint();
  const isMobile  = !screens.md;
  const isSmall   = !screens.sm;
  const isTablet  = screens.md && !screens.lg;

  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch]     = useState('');
  const [filterStop, setFilterStop]             = useState<string>('ALL');
  const [productSearch, setProductSearch]       = useState('');
  const [selectedBrand, setSelectedBrand]       = useState<string>('ALL');
  const [brandSearch, setBrandSearch]           = useState('');
  const [filterCategory, setFilterCategory]     = useState<string | undefined>();
  const [filterSubCat, setFilterSubCat]         = useState<string | undefined>();
  const [cart, setCart]                         = useState<CartItem[]>([]);

  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [gpsLoading, setGpsLoading]           = useState(false);
  const [gpsCoords, setGpsCoords]             = useState<{ lat: number; lng: number } | null>(null);
  const [newCustomerForm]                     = Form.useForm();

  const { data: customersData, isLoading: custLoading, refetch: refetchCustomers } = useGetMyCustomersQuery();
  const { data: productsData,  isLoading: prodLoading, refetch: refetchProducts } =
    useGetAllProductsQuery(undefined, { pollingInterval: 60_000, refetchOnFocus: true });
  const [createOrder, { isLoading: creating }]           = useCreateOrderMutation();
  const [createCustomer, { isLoading: creatingCust }]    = useCreateCustomerMutation();
  const { data: outstandingData } = useGetCustomerOutstandingQuery(selectedCustomer?.id ?? 'skip', { skip: !selectedCustomer?.id , refetchOnMountOrArgChange: true });
  const { data: lastPricesData }  = useGetCustomerLastPricesQuery(selectedCustomer?.id ?? '', { skip: !selectedCustomer?.id , refetchOnMountOrArgChange: true });
  const lastPrices: Record<string, { price: number; date: string }[]> = lastPricesData?.data || {};

  const { data: nearExpiryData } = useGetNearExpiryAlertsQuery({ days: 30 }, { refetchOnMountOrArgChange: true });
  const nearExpiryMap: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    (nearExpiryData?.data || []).forEach((a: any) => {
      const pid = a.product?.id;
      if (!pid) return;
      if (map[pid] == null || a.daysToExpiry < map[pid]) map[pid] = a.daysToExpiry;
    });
    return map;
  }, [nearExpiryData]);

  const { data: allocData }         = useGetMyAllocationQuery();
  const { data: workflowData }      = useGetWorkflowSettingsQuery(undefined, { refetchOnMountOrArgChange: true });
  const discountType = workflowData?.data?.discountType ?? 'PERCENT';
  const { data: attendanceData }    = useGetTodayStatusQuery();
  const billingLocked = !!(workflowData?.data?.lockBillingAfterCheckout && attendanceData?.data?.checkedOut);
  const showPurchaseRate = workflowData?.data?.showPurchaseRateToSales ?? true;
  const { data: planData }        = useGetRoutePlanQuery(
    allocData?.data?.routeId || '', { skip: !allocData?.data?.routeId }
  );

  const allocation    = allocData?.data;
  const routePlaces: any[] = planData?.data?.plan || [];
  const newCustomerRouteId: string | undefined = allocation?.routeId;

  const customers: any[] = customersData?.data || [];

  // Stops come from today's allocated route plan — no allocation means no stops.
  const addCustomerStops = useMemo(() =>
    routePlaces.map((p: any) => ({ id: p.id, name: p.name })).filter((p: any) => !!p.id),
  [routePlaces]);

  const products: any[]  = productsData?.data?.content || productsData?.data || [];
  const outstanding  = outstandingData?.data;
  const creditEnforcement = workflowData?.data?.creditLimitEnforcement ?? 'HARD_BLOCK';
  const creditChecked = creditEnforcement !== 'DISABLED'
    && outstanding?.creditAllowed === true && Number(outstanding?.creditLimit || 0) > 0;
  const creditAvailable = Math.max(0,
    Number(outstanding?.creditLimit || 0) - Number(outstanding?.totalOutstanding || 0));
  const alreadyOverLimit = creditChecked && outstanding?.overLimit === true;

  // O(1) qty lookup — rebuilt only when cart changes
  const cartQtyMap = useMemo(() => {
    const m: Record<string, number> = {};
    cart.forEach(i => { m[i.productId] = i.quantity; });
    return m;
  }, [cart]);

  const getQty = (id: string) => cartQtyMap[id] || 0;

  useEffect(() => {
    const state = location.state as any;
    if (state?.customerId && customers.length) {
      const c = customers.find((c: any) => c.id === state.customerId);
      if (c) handleSelectCustomer(c);
    }
  }, [location.state, customers]);

  const handleSelectCustomer = (c: any) => {
    setSelectedCustomer(c);
    startTransition(() => {
      setSelectedBrand('ALL');
      setProductSearch('');
      setFilterCategory(undefined);
      setFilterSubCat(undefined);
      setStep(1);
    });
  };

  // Build ordered stop list from plan for filter chips
  const stopList: { id: string; name: string }[] = useMemo(
    () => (planData?.data?.plan || []).map((p: any) => ({ id: p.id, name: p.name })),
    [planData],
  );

  // Customer IDs per stop (from plan's embedded customer lists)
  const stopCustomerIds: Record<string, Set<string>> = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    (planData?.data?.plan || []).forEach((p: any) => {
      map[p.id] = new Set((p.customers || []).map((c: any) => c.id));
    });
    return map;
  }, [planData]);

  const filteredCustomers = useMemo(() => customers.filter((c: any) => {
    if (filterStop !== 'ALL' && !stopCustomerIds[filterStop]?.has(c.id)) return false;
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    return (
      c.businessName?.toLowerCase().includes(q) ||
      c.ownerName?.toLowerCase().includes(q) ||
      c.phone?.includes(customerSearch)
    );
  }), [customers, filterStop, customerSearch, stopCustomerIds]);

  const brandList: string[] = useMemo(() => [
    'ALL',
    ...Array.from(new Set(products.map((p: any) => p.brand).filter(Boolean))).sort() as string[],
  ], [products]);

  const uniqueCategories = useMemo(() =>
    (Array.from(new Set(products.filter((p: any) => p.category).map((p: any) => p.category))).sort()) as string[],
  [products]);

  const uniqueSubCategories = useMemo(() =>
    (Array.from(new Set(
      products
        .filter((p: any) => p.subCategory && (!filterCategory || p.category === filterCategory))
        .map((p: any) => p.subCategory)
    )).sort()) as string[],
  [products, filterCategory]);

  const filteredProducts = useMemo(() => products.filter((p: any) => {
    if (p.active === false) return false;
    if (p.stockQuantity != null && p.stockQuantity === 0) return false;
    if (selectedBrand !== 'ALL' && p.brand !== selectedBrand) return false;
    if (filterCategory && p.category !== filterCategory) return false;
    if (filterSubCat && p.subCategory !== filterSubCat) return false;
    if (!productSearch) return true;
    const q = productSearch.toLowerCase();
    return p.name?.toLowerCase().includes(q);
  }), [products, selectedBrand, filterCategory, filterSubCat, productSearch]);

  const clearStockProducts = useMemo(() =>
    filteredProducts.filter(
      (p: any) => nearExpiryMap[p.id] != null && p.stockQuantity > (cartQtyMap[p.id] || 0)
    ),
  [filteredProducts, nearExpiryMap, cartQtyMap]);

  // Stable callback — uses only functional setCart, so deps are empty
  const setQty = useCallback((product: any, qty: number) => {
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
        const dup = prev.find(i => sameProductKey(i.product) === sameProductKey(product));
        if (dup) {
          queueMicrotask(() => message.warning(`"${product.name}" is already in this order — increase its quantity instead of adding it again`));
          return prev;
        }
        return [...prev, {
          productId: product.id, product, quantity: qty,
          unitPrice:       (() => { const r = getProductRates(product); return defaultUnitPrice(r.min, r.max); })(),
          discountPercent: 0,
          gstPercent:      product.salesGstPercent || 0,
        }];
      });
    }
  }, []);

  const handlePreview = useCallback((url: string) => setPreviewImage(url), []);

  const updatePrice = (productId: string, price: number) => {
    if (price <= 0) return;
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, unitPrice: price } : i));
  };

  const removeFromCart = useCallback((productId: string) =>
    setCart(prev => prev.filter(i => i.productId !== productId)), []);

  const [discountAmounts, setDiscountAmounts] = useState<Record<string, number>>({});
  const [overallDiscValue, setOverallDiscValue] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const lineGross = (item: CartItem) => item.unitPrice * item.quantity;
  const lineTotal = (item: CartItem) => discountType === 'AMOUNT'
    ? Math.max(0, lineGross(item) - (discountAmounts[item.productId] ?? 0))
    : lineGross(item) * (1 - (item.discountPercent || 0) / 100);
  const lineBase  = (item: CartItem) => lineTotal(item) * 100 / (100 + item.gstPercent);

  // Bill-level (overall) discount, applied before GST — scales subtotal & GST down together
  // and is pro-rata apportioned into the per-line amounts server-side.
  const cartTotals = useMemo(() => {
    let subTotal = 0, totalGst = 0, grossIncl = 0;
    for (const item of cart) {
      const lt = lineTotal(item);
      subTotal += lineBase(item);
      totalGst += lt - lineBase(item);
      grossIncl += lt;
    }
    const dv = overallDiscValue || 0;
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
  }, [cart, discountAmounts, discountType, overallDiscValue]);

  // A sales order goes entirely on account, so the whole cart counts against the limit. Catching
  // "this order would cross it" here — not just "already over" — matches the backend gate and lets
  // the salesman trim the cart at the shop instead of being refused at submit.
  const wouldExceedLimit = creditChecked && !alreadyOverLimit && cartTotals.total > creditAvailable;
  const isOverLimit = alreadyOverLimit || wouldExceedLimit;
  const creditShortfall = Math.max(0, Math.round((cartTotals.total - creditAvailable) * 100) / 100);

  const priceErrors = useMemo(() => cart.filter(item => {
    const { min, max } = getProductRates(item.product);
    return isPriceOutOfRange(item.unitPrice, min, max);
  }), [cart]);

  const openNewCustomer = () => {
    newCustomerForm.resetFields();
    setGpsCoords(null);
    setNewCustomerOpen(true);
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsLoading(false); },
      () => { setGpsLoading(false); message.warning('Could not get GPS location. You can still save without it.'); },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  const handleCreateCustomer = async () => {
    try {
      const values = await newCustomerForm.validateFields();
      if (!newCustomerRouteId) {
        message.error('No route is assigned to you — contact your admin before adding customers');
        return;
      }
      const payload: any = {
        businessName:  values.businessName.trim(),
        ownerName:     values.ownerName.trim(),
        phone:         values.phone.trim(),
        altPhone:      values.altPhone?.trim()  || undefined,
        email:         values.email?.trim()     || undefined,
        address:       values.address?.trim()   || undefined,
        gstin:         values.gstin?.trim()     || undefined,
        routeId:       newCustomerRouteId,
        routePlaceId:  values.routePlaceId,
        creditAllowed: values.creditAllowed || false,
        creditDays:    values.creditDays    || undefined,
        creditLimit:   values.creditLimit   || undefined,
      };
      if (gpsCoords) { payload.latitude = gpsCoords.lat; payload.longitude = gpsCoords.lng; }
      await createCustomer(payload).unwrap();
      message.success('Customer added — select them below');
      setNewCustomerOpen(false);
      const refetched = await refetchCustomers();
      const newCust = (refetched.data?.data as any[])?.find((c: any) => c.phone === values.phone.trim());
      if (newCust) { setSelectedCustomer(newCust); setStep(1); }
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.data?.message || 'Failed to add customer');
    }
  };

  const handleSubmit = async () => {
    if (!selectedCustomer) { message.error('No customer selected'); return; }
    if (cart.length === 0)  { message.error('Cart is empty'); return; }
    if (alreadyOverLimit) { message.error('Credit limit reached — collect payment before placing a new order.'); return; }
    if (wouldExceedLimit) {
      message.error(`Only ₹${creditAvailable.toFixed(2)} of credit left — remove ₹${creditShortfall.toFixed(2)} from the order or collect payment first.`);
      return;
    }
    if (priceErrors.length > 0) {
      message.error(`Fix price for: ${priceErrors.map(i => i.product?.name).join(', ')}`);
      return;
    }
    try {
      await createOrder({
        customerId: selectedCustomer.id,
        items: cart.map(i => {
          const discPct = discountType === 'AMOUNT'
            ? Math.min(100, ((discountAmounts[i.productId] ?? 0) / (i.unitPrice * i.quantity)) * 100)
            : (i.discountPercent || 0);
          return { productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, discountPercent: discPct };
        }),
        notes: notes.trim() || undefined,
        overallDiscountType: overallDiscValue && overallDiscValue > 0 ? discountType : null,
        overallDiscountValue: overallDiscValue && overallDiscValue > 0 ? overallDiscValue : null,
      }).unwrap();
      message.success('Order placed successfully!');
      setNotes('');
      navigate('/sales/route');
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to place order');
      if (err?.data?.code === 'INSUFFICIENT_STOCK' || /insufficient stock/i.test(err?.data?.message || '')) refetchProducts();
    }
  };

  // ── shared styles ────────────────────────────────────────────────────────────
  const colLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 0.5,
  };

  if (billingLocked) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center' }}>
        <Result
          icon={<LockOutlined style={{ color: '#94a3b8', fontSize: 48 }} />}
          title="Billing Locked"
          subTitle="You have checked out for today. New orders cannot be created after checkout."
          extra={
            <Button onClick={() => navigate(-1)}>Go Back</Button>
          }
        />
      </div>
    );
  }

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

          {/* Stop filter */}
          {stopList.length > 0 && (
            <Select
              style={{ width: '100%' }}
              value={filterStop}
              onChange={v => setFilterStop(v)}
              options={[
                { value: 'ALL', label: 'All Stops' },
                ...stopList.map(stop => ({ value: stop.id, label: stop.name })),
              ]}
            />
          )}

          {/* New Customer — top, so the salesman doesn't have to scroll the whole list */}
          <button
            onClick={openNewCustomer}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '12px',
              background: P, border: 'none',
              borderRadius: 10, cursor: 'pointer',
              color: '#fff', fontSize: 14, fontWeight: 700,
            }}
          >
            <PlusOutlined />New Customer
          </button>

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
                  onClick={() => handleSelectCustomer(c)}
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
                  {isPending && selectedCustomer?.id === c.id
                    ? <LoadingOutlined style={{ color: P, fontSize: 16, flexShrink: 0 }} />
                    : <CheckCircleOutlined style={{ color: selectedCustomer?.id === c.id ? P : '#e2e8f0', fontSize: 16, flexShrink: 0 }} />
                  }
                </div>
              ))}
            </div>
          )}

          {/* New Customer */}
          <button
            onClick={openNewCustomer}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '14px',
              background: '#fff', border: '2px dashed #a7f3d0',
              borderRadius: 10, cursor: 'pointer',
              color: P, fontSize: 13, fontWeight: 700,
            }}
          >
            <PlusOutlined />New Customer
          </button>
        </div>
      )}

      {/* New Customer Modal */}
      <Modal
        open={newCustomerOpen}
        onCancel={() => setNewCustomerOpen(false)}
        title={<span style={{ fontWeight: 700 }}>New Customer</span>}
        onOk={handleCreateCustomer}
        confirmLoading={creatingCust}
        okText="Save Customer"
        okButtonProps={{ style: { background: P, borderColor: P } }}
        width={isMobile ? '92%' : 520}
        centered
      >
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
          <Form.Item name="altPhone" label="Alt Mobile" rules={[{ pattern: /^\d{10}$/, message: 'Enter a valid 10-digit mobile number' }]}>
            <Input placeholder="Optional" maxLength={10} />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} placeholder="Shop address (optional)" />
          </Form.Item>
          <Form.Item name="gstin" label="GSTIN" rules={[{ pattern: /^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][0-9A-Za-z][Zz][0-9A-Za-z]$/, message: 'Invalid GSTIN — e.g. 29AADCB2230M1ZV' }]}>
            <Input placeholder="Optional" maxLength={15} />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Enter a valid email (e.g. name@domain.com)' }]}>
            <Input type="email" placeholder="Optional" />
          </Form.Item>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, margin: '8px 0 12px' }}>Route Stop</div>
          <Form.Item name="routePlaceId" label="Stop / Place *" rules={[{ required: true, message: 'Select a stop' }]}>
            <Select
              placeholder={addCustomerStops.length ? 'Select stop on this route' : 'No stops on your route — ask admin to add stops'}
              size="large"
              notFoundContent="No stops configured on your route"
            >
              {addCustomerStops.map((p: any) => (
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
                  Limit: ₹{Number(outstanding.creditLimit).toFixed(2)} · ₹{creditAvailable.toFixed(2)} left
                  {alreadyOverLimit && <span style={{ color: '#dc2626', fontWeight: 700 }}> — New orders blocked</span>}
                  {wouldExceedLimit && <span style={{ color: '#dc2626', fontWeight: 700 }}> — cart is ₹{creditShortfall.toFixed(2)} over</span>}
                </div>
              )}
            </div>
          )}

          {/* Brand / Category / Sub Category filters */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Select
              placeholder="Brand" allowClear showSearch
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().startsWith(input.toLowerCase())}
              size="small" style={{ flex: 1, minWidth: 110 }}
              value={selectedBrand === 'ALL' ? undefined : selectedBrand}
              onChange={v => { setSelectedBrand(v ?? 'ALL'); setBrandSearch(''); }}
              options={brandList.filter(b => b !== 'ALL').map(b => ({ value: b, label: b }))}
            />
            <Select
              placeholder="Category" allowClear showSearch
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().startsWith(input.toLowerCase())}
              size="small" style={{ flex: 1, minWidth: 110 }}
              value={filterCategory}
              onChange={v => { setFilterCategory(v); setFilterSubCat(undefined); }}
              options={uniqueCategories.map(c => ({ value: c, label: c }))}
            />
            <Select
              placeholder="Sub Category" allowClear showSearch
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().startsWith(input.toLowerCase())}
              size="small" style={{ flex: 1, minWidth: 120 }}
              value={filterSubCat}
              onChange={setFilterSubCat}
              disabled={uniqueSubCategories.length === 0}
              options={uniqueSubCategories.map(s => ({ value: s, label: s }))}
            />
          </div>

          <Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder={selectedBrand === 'ALL' ? 'Search products...' : `Search in ${selectedBrand}...`}
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
                  {alreadyOverLimit ? 'Credit limit reached — collect payment'
                    : wouldExceedLimit ? `₹${creditShortfall.toFixed(2)} over the credit limit`
                    : `${cart.length} item${cart.length > 1 ? 's' : ''}`}
                </div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>₹{cartTotals.total.toFixed(2)}</div>
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
            <>
              {/* Clear Stock section */}
              {clearStockProducts.length > 0 && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 12px 8px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                    Clear Stock — {clearStockProducts.length} item{clearStockProducts.length > 1 ? 's' : ''} expiring
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {clearStockProducts.map((p: any) => {
                      const qty = getQty(p.id);
                      const daysLeft = nearExpiryMap[p.id];
                      const isExpired = daysLeft <= 0;
                      return (
                        <div key={p.id} style={{ background: '#fff', border: `1px solid ${qty > 0 ? P : isExpired ? '#fca5a5' : '#fde68a'}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ position: 'relative', background: '#fff', padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} onClick={() => setPreviewImage(p.imageUrl)} style={{ width: '100%', height: 110, objectFit: 'contain', cursor: 'pointer', display: 'block' }} />
                            ) : (
                              <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ShoppingCartOutlined style={{ fontSize: 24, color: '#cbd5e1' }} />
                              </div>
                            )}
                            <span style={{ position: 'absolute', top: 6, right: 6, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 12, background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>
                              {p.stockQuantity - qty}
                            </span>
                          </div>
                          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                            {p.brand && <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.3 }}>{p.brand}</div>}
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13, lineHeight: 1.35 }}>{p.name}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {(p.fifoMrp ?? p.mrp) != null && (
                                <span style={{ fontSize: 11, color: '#64748b' }}>MRP ₹{Number(p.fifoMrp ?? p.mrp).toFixed(2)}</span>
                              )}
                              <span style={{ fontSize: 14, fontWeight: 700, color: P }}>
                                SR ₹{((p.fifoMaxSaleRate ?? p.maxSaleRate) || 0).toFixed(2)}
                                {p.salesGstPercent > 0 && <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}> +{p.salesGstPercent}%</span>}
                              </span>
                              {showPurchaseRate && (p.fifoPurchaseRate != null || p.purchaseRate != null) && (
                                <span style={{ fontSize: 11, color: '#64748b' }}>
                                  PR ₹{p.fifoPurchaseRate != null
                                    ? Number(p.fifoPurchaseRate).toFixed(2)
                                    : Number(p.purchaseRate).toFixed(2)}
                                </span>
                              )}
                            </div>
                            {lastPrices[p.id]?.length > 0 && (
                              <div style={{ fontSize: 10, color: '#64748b' }}>
                                Last: {lastPrices[p.id].map((e: any, i: number) => <span key={i}>{i > 0 && <span style={{ color: '#cbd5e1' }}> · </span>}₹{Number(e.price).toFixed(2)} <span style={{ color: '#94a3b8' }}>({fmtShortDate(e.date)})</span></span>)}
                              </div>
                            )}
                            <div style={{ fontSize: 11, fontWeight: 700, color: isExpired ? '#dc2626' : '#d97706' }}>
                              {isExpired ? 'Expired' : `Exp in ${daysLeft}d`}
                            </div>
                            {qty === 0 ? (
                              <button onClick={() => setQty(p, 1)} style={{ marginTop: 'auto', width: '100%', height: 34, border: `1px solid ${P}`, borderRadius: 8, background: '#fff', color: P, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                <PlusOutlined style={{ fontSize: 10 }} /> Add
                              </button>
                            ) : (
                              <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: PL, borderRadius: 8, padding: '3px 4px' }}>
                                <button onClick={() => setQty(p, qty - 1)} style={{ width: 28, height: 28, border: 'none', background: '#fff', borderRadius: 6, cursor: 'pointer', color: P, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <MinusOutlined style={{ fontSize: 9 }} />
                                </button>
                                <QtyInput qty={qty} product={p} setQty={setQty} style={{ width: 36, textAlign: 'center', border: 'none', background: 'transparent', fontWeight: 700, color: P, fontSize: 14, outline: 'none' }} />
                                <button onClick={() => setQty(p, qty + 1)} style={{ width: 28, height: 28, border: 'none', background: P, borderRadius: 6, cursor: 'pointer', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <PlusOutlined style={{ fontSize: 9 }} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All Products grid */}
              {clearStockProducts.length > 0 && (
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>All Products</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: isSmall ? '1fr 1fr' : 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                {filteredProducts.map((p: any) => (
                  <ProductCard
                    key={p.id}
                    p={p}
                    qty={cartQtyMap[p.id] || 0}
                    daysLeft={nearExpiryMap[p.id]}
                    lastPrices={lastPrices[p.id]}
                    setQty={setQty}
                    onPreview={handlePreview}
                    isMobile={isMobile}
                    isSmall={isSmall}
                    showPurchaseRate={showPurchaseRate}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Image preview modal */}
      <Modal
        open={!!previewImage}
        onCancel={() => setPreviewImage(null)}
        footer={null}
        centered
        width="auto"
        styles={{ body: { padding: 0, lineHeight: 0 } }}
      >
        {previewImage && (
          <img src={previewImage} alt="Product" style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8, display: 'block' }} />
        )}
      </Modal>

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
                gridTemplateColumns: isTablet ? '1fr 70px 60px 64px 58px 48px 72px 20px' : '1fr 80px 65px 72px 66px 56px 82px 22px',
                gap: '0 8px',
                padding: '7px 16px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
              }}>
                <div style={{ ...colLabel }}>Product</div>
                <div style={{ ...colLabel }}>Rate</div>
                <div style={{ ...colLabel, textAlign: 'center' }}>{discountType === 'AMOUNT' ? 'Disc ₹' : 'Disc %'}</div>
                <div style={{ ...colLabel, textAlign: 'center' }}>Qty</div>
                <div style={{ ...colLabel, textAlign: 'right' }}>Gross</div>
                <div style={{ ...colLabel, textAlign: 'right' }}>GST</div>
                <div style={{ ...colLabel, textAlign: 'right' }}>Total</div>
                <div />
              </div>
            )}

            {/* Line items */}
            {cart.map((item, idx) => {
              const { min, max } = getProductRates(item.product);
              const belowMin = min != null && item.unitPrice < min;
              const aboveMax = max != null && item.unitPrice > max;
              const hasError = belowMin || aboveMax;
              const gross    = lineTotal(item);
              const gstAmt   = gross * item.gstPercent / (100 + item.gstPercent);
              const updateDiscount = (v: number | null) => {
                if (discountType === 'AMOUNT') {
                  setDiscountAmounts(prev => ({ ...prev, [item.productId]: v ?? 0 }));
                } else {
                  setCart(prev => prev.map(c => c.productId === item.productId ? { ...c, discountPercent: v ?? 0 } : c));
                }
              };
              const discountValue = discountType === 'AMOUNT'
                ? (discountAmounts[item.productId] ?? 0)
                : item.discountPercent;

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
                      {/* Mobile — bottom row: qty + rate input + optional error below */}
                      <div style={{ padding: '0 16px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {QtyControl}
                          <Tooltip
                            title={(min != null || max != null) ? `${min != null ? `min ₹${Number(min).toFixed(2)}` : ''}${min != null && max != null ? ' – ' : ''}${max != null ? `max ₹${Number(max).toFixed(2)}` : ''}` : undefined}
                            placement="top"
                          >
                            <InputNumber size="small" min={0.01} value={item.unitPrice} onChange={v => v != null && updatePrice(item.productId, v)} prefix="₹" style={{ width: isSmall ? 100 : 110, height: 30 }} status={hasError ? 'error' : ''} />
                          </Tooltip>
                          <InputNumber size="small" min={0} precision={2} value={discountValue} onChange={updateDiscount} {...(discountType === 'AMOUNT' ? { prefix: '₹', style: { width: 82, height: 30 }, placeholder: '₹ disc' } : { suffix: '%', max: 100, style: { width: 72, height: 30 }, placeholder: 'Disc%' })} />
                        </div>
                        {lastPrices[item.productId]?.length > 0 && (
                          <span style={{ fontSize: 10, color: '#64748b' }}>
                            Last: {lastPrices[item.productId].map((e, i) => <span key={i}>{i > 0 && <span style={{ color: '#cbd5e1' }}> · </span>}₹{Number(e.price).toFixed(2)} <span style={{ color: '#94a3b8' }}>({fmtShortDate(e.date)})</span></span>)}
                          </span>
                        )}
                        {hasError && (
                          <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>
                            {belowMin ? `Below min ₹${Number(min).toFixed(2)}` : `Above max ₹${Number(max).toFixed(2)}`}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Desktop/tablet — Product | Rate | Disc% | Qty | Gross | GST | Total | Delete */
                    <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr 70px 60px 64px 58px 48px 72px 20px' : '1fr 80px 65px 72px 66px 56px 82px 22px', gap: '0 8px', padding: '10px 16px', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product?.name}</div>
                        {item.product?.brand && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{item.product.brand}</div>}
                        {lastPrices[item.productId]?.length > 0 && (
                          <Popover trigger={["hover", "click"]} title={<span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Last Billed</span>} content={pricePopoverContent(lastPrices[item.productId])}>
                            <div style={{ fontSize: 10, color: '#64748b', marginTop: 1, cursor: 'pointer' }}>
                              Last: {lastPrices[item.productId].map((e, i) => <span key={i}>{i > 0 && <span style={{ color: '#cbd5e1' }}> · </span>}₹{Number(e.price).toFixed(2)}</span>)}
                            </div>
                          </Popover>
                        )}
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
                        <InputNumber size="small" min={0.01} value={item.unitPrice} onChange={v => v != null && updatePrice(item.productId, v)} prefix="₹" style={{ width: '100%', height: isTablet ? 26 : 30 }} status={hasError ? 'error' : ''} />
                      </Tooltip>
                      <InputNumber size="small" min={0} precision={2} value={discountValue} onChange={updateDiscount} {...(discountType === 'AMOUNT' ? { prefix: '₹' } : { suffix: '%', max: 100 })} style={{ width: '100%', height: isTablet ? 26 : 30 }} />
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

            {/* Totals block */}
            <div style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc', padding: '10px 16px' }}>
              {isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>Overall Discount {discountType === 'AMOUNT' ? '(₹)' : '(%)'}</span>
                    <InputNumber
                      size="small" min={0} precision={2}
                      value={overallDiscValue ?? undefined}
                      max={discountType === 'PERCENT' ? 100 : undefined}
                      {...(discountType === 'AMOUNT' ? { prefix: '₹' } : { suffix: '%' })}
                      style={{ width: 90 }} placeholder="0"
                      onChange={v => setOverallDiscValue(v as number)}
                    />
                  </div>
                  {cartTotals.discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: '#94a3b8' }}>Less: Discount</span>
                      <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>−₹{cartTotals.discount.toFixed(2)}</span>
                    </div>
                  )}
                  {[
                    { label: 'Subtotal', value: cartTotals.subTotal.toFixed(2), color: '#475569', size: 13, weight: 500 },
                    { label: 'GST',      value: cartTotals.totalGst.toFixed(2), color: '#64748b', size: 13, weight: 500 },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: row.size, color: '#94a3b8' }}>{row.label}</span>
                      <span style={{ fontSize: row.size, color: row.color, fontWeight: row.weight }}>₹{row.value}</span>
                    </div>
                  ))}
                  <div style={{ height: 1, background: '#e2e8f0', margin: '4px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Total</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: P }}>₹{cartTotals.total.toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr 70px 60px 64px 58px 48px 72px 20px' : '1fr 80px 65px 72px 66px 56px 82px 22px', gap: '0 8px', padding: '2px 0', alignItems: 'center' }}>
                    <div style={{ gridColumn: '1 / 7', textAlign: 'right', fontSize: 12, color: '#64748b' }}>Overall Discount {discountType === 'AMOUNT' ? '(₹)' : '(%)'}</div>
                    <InputNumber
                      size="small" min={0} precision={2}
                      value={overallDiscValue ?? undefined}
                      max={discountType === 'PERCENT' ? 100 : undefined}
                      {...(discountType === 'AMOUNT' ? { prefix: '₹' } : { suffix: '%' })}
                      style={{ width: '100%', height: isTablet ? 26 : 30 }} placeholder="0"
                      onChange={v => setOverallDiscValue(v as number)}
                    />
                    <div />
                  </div>
                  {cartTotals.discount > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr 70px 60px 64px 58px 48px 72px 20px' : '1fr 80px 65px 72px 66px 56px 82px 22px', gap: '0 8px', padding: '2px 0' }}>
                      <div style={{ gridColumn: '1 / 7', textAlign: 'right', fontSize: 12, color: '#64748b' }}>Less: Discount</div>
                      <div style={{ textAlign: 'right', fontSize: 12, color: '#dc2626' }}>−₹{cartTotals.discount.toFixed(2)}</div>
                      <div />
                    </div>
                  )}
                  {[
                    { label: 'Subtotal', value: cartTotals.subTotal.toFixed(2), color: '#0f172a' },
                    { label: 'GST',      value: cartTotals.totalGst.toFixed(2), color: '#64748b' },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr 70px 60px 64px 58px 48px 72px 20px' : '1fr 80px 65px 72px 66px 56px 82px 22px', gap: '0 8px', padding: '2px 0' }}>
                      <div style={{ gridColumn: '1 / 7', textAlign: 'right', fontSize: 12, color: '#64748b' }}>{row.label}</div>
                      <div style={{ textAlign: 'right', fontSize: 12, color: row.color }}>₹{row.value}</div>
                      <div />
                    </div>
                  ))}
                  <div style={{ height: 1, background: '#e2e8f0', margin: '6px 0 4px' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr 70px 60px 64px 58px 48px 72px 20px' : '1fr 80px 65px 72px 66px 56px 82px 22px', gap: '0 8px', padding: '2px 0' }}>
                    <div style={{ gridColumn: '1 / 7', textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Total</div>
                    <div style={{ textAlign: 'right', fontSize: 16, fontWeight: 800, color: P }}>₹{cartTotals.total.toFixed(2)}</div>
                    <div />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 8 }}>
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
              <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 13, marginBottom: 3 }}>
                {alreadyOverLimit ? 'Order Blocked — Credit Limit Reached' : 'Order Blocked — This Order Crosses the Limit'}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                {alreadyOverLimit ? (
                  <>
                    {selectedCustomer?.businessName} has ₹{Number(outstanding?.totalOutstanding || 0).toFixed(2)} outstanding
                    against a limit of ₹{Number(outstanding?.creditLimit || 0).toFixed(2)}. Collect payment before
                    placing a new order.
                  </>
                ) : (
                  <>
                    {selectedCustomer?.businessName} has ₹{creditAvailable.toFixed(2)} of credit left, but this order
                    is ₹{cartTotals.total.toFixed(2)}. Remove ₹{creditShortfall.toFixed(2)} from the order, or collect
                    payment first.
                  </>
                )}
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
              : `Place Order · ₹${cartTotals.total.toFixed(2)}`}
          </Button>
        </div>
      )}
    </div>
  );
};

export default SalesOrderPage;
