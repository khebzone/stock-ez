import React, { useState, useMemo } from 'react';
import {
  Select, Button, InputNumber, Table, message, Card, Divider,
  Row, Col, Input, Grid, Modal, Form, Switch, Tooltip, Pagination,
} from 'antd';
import { PlusOutlined, MinusOutlined, DeleteOutlined, ShoppingCartOutlined, SearchOutlined, UserAddOutlined, PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetCustomersQuery, useCreateCustomerMutation, useGetCustomerOutstandingQuery } from '../../store/api/customerApi';
import { useGetAllProductsQuery } from '../../store/api/productApi';
import { useGetPaymentMethodsQuery } from '../../store/api/paymentMethodApi';
import { useCounterSaleMutation } from '../../store/api/orderApi';
import { useGetRoutesQuery } from '../../store/api/routeApi';
import { useGetGatePassOptionsQuery } from '../../store/api/routeAllocationApi';
import { useGetWorkflowSettingsQuery } from '../../store/api/supplierApi';
import PageHeader from '../../components/PageHeader';
import BatchInfoPopover from '../../components/BatchInfoPopover';
import { getProductRates, isPriceOutOfRange, defaultUnitPrice } from '../../utils/priceUtils';

const { useBreakpoint } = Grid;

const fmt = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Identity for "the same real-world product" — catches duplicate product records
// (same name/brand/unit under different IDs) so it can't be billed twice.
const sameProductKey = (p: any) =>
  [p?.name, p?.brand, p?.unit].map(v => String(v ?? '').trim().toLowerCase()).join('|');

interface LineItem {
  key: string;
  productId: string;
  productName: string;
  unit: string;
  minSaleRate: number | null;
  maxSaleRate: number | null;
  gstPercent: number;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  purchaseRate: number | null;
  fifoBatchAvailable: number | null;
  stockQuantity: number | null;
}

const P  = '#059669';
const PL = '#ecfdf5';

const CounterSalePage: React.FC = () => {
  const screens = useBreakpoint();
  const isSmall = !screens.md;

  const [customerId, setCustomerId]           = useState<string | undefined>();
  const [items, setItems]                     = useState<LineItem[]>([]);
  const [productSearch, setProductSearch]     = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState<string | undefined>();
  const [paymentAmount, setPaymentAmount]     = useState<number | null>(null);
  const [notes, setNotes]                     = useState('');
  const [overallDisc, setOverallDisc]         = useState<{ type: 'PERCENT' | 'AMOUNT'; value: number | null }>({ type: 'PERCENT', value: null });
  const [finalStatus, setFinalStatus]         = useState('DELIVERED');
  const [gatePassId, setGatePassId]           = useState<string | undefined>();
  const [lastOrder, setLastOrder]             = useState<any>(null);
  const [addCustOpen, setAddCustOpen]         = useState(false);
  const [addCustForm]                         = Form.useForm();
  const [addCustRouteId, setAddCustRouteId]   = useState<string | undefined>();
  const [filterRouteId, setFilterRouteId]     = useState<string | undefined>();
  const [filterPlaceId, setFilterPlaceId]     = useState<string | undefined>();
  const [filterPhone, setFilterPhone]         = useState('');
  const [filterBrand, setFilterBrand]         = useState<string | undefined>();
  const [filterCategory, setFilterCategory]   = useState<string | undefined>();
  const [filterSubCat, setFilterSubCat]       = useState<string | undefined>();
  const [productPage, setProductPage]         = useState(1);

  const { data: customersData, refetch: refetchCustomers } = useGetCustomersQuery(undefined, { refetchOnMountOrArgChange: true });
  const { data: productsData, refetch: refetchProducts } =
    useGetAllProductsQuery(undefined, { refetchOnMountOrArgChange: true, pollingInterval: 60_000, refetchOnFocus: true });
  const { data: paymentMethodsData }  = useGetPaymentMethodsQuery();
  const [counterSale, { isLoading: submitting }] = useCounterSaleMutation();
  const [createCustomer, { isLoading: creatingCust }] = useCreateCustomerMutation();
  const { data: routesData } = useGetRoutesQuery(undefined, { refetchOnMountOrArgChange: true });
  const { data: gatePassOptionsData } = useGetGatePassOptionsQuery(undefined, { refetchOnMountOrArgChange: true });
  const { data: workflowData } = useGetWorkflowSettingsQuery();
  const { data: outstandingData } = useGetCustomerOutstandingQuery(customerId!, { skip: !customerId });

  const customers: any[]      = customersData?.data?.content || customersData?.data || [];
  const allProducts: any[]    = productsData?.data?.content || productsData?.data || [];
  const paymentMethods: any[] = paymentMethodsData?.data || [];
  const routes: any[]         = routesData?.data || [];
  const gatePassOptions: any[] = gatePassOptionsData?.data || [];
  const discountType: 'PERCENT' | 'AMOUNT' = workflowData?.data?.discountType ?? 'PERCENT';
  const maxDiscountPercent: number | null   = workflowData?.data?.maxDiscountPercent ?? null;
  const showPurchaseRate: boolean           = workflowData?.data?.showPurchaseRateToSales ?? true;


  const getPlacesForRoute = (routeId: string) => {
    const route = routes.find((r: any) => r.id === routeId);
    return [...(route?.places || [])].sort((a: any, b: any) => a.sortOrder - b.sortOrder);
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((c: any) => {
      if (filterRouteId && c.route?.id !== filterRouteId) return false;
      if (filterPlaceId && c.routePlace?.id !== filterPlaceId) return false;
      if (filterPhone && !c.phone?.includes(filterPhone)) return false;
      return true;
    });
  }, [customers, filterRouteId, filterPlaceId, filterPhone]);

  const uniqueBrands = useMemo(() =>
    [...new Set(allProducts.filter((p: any) => p.brand).map((p: any) => p.brand as string))].sort()
  , [allProducts]);

  const uniqueCategories = useMemo(() =>
    [...new Set(allProducts.filter((p: any) => p.category).map((p: any) => p.category as string))].sort()
  , [allProducts]);

  const uniqueSubCategories = useMemo(() => {
    const src = filterCategory ? allProducts.filter((p: any) => p.category === filterCategory) : allProducts;
    return [...new Set(src.filter((p: any) => p.subCategory).map((p: any) => p.subCategory as string))].sort();
  }, [allProducts, filterCategory]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase();
    return allProducts.filter((p: any) => {
      if (p.active === false) return false;
      if (p.stockQuantity != null && p.stockQuantity === 0) return false;
      if (filterBrand && p.brand !== filterBrand) return false;
      if (filterCategory && p.category !== filterCategory) return false;
      if (filterSubCat && p.subCategory !== filterSubCat) return false;
      return !q || p.name?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q) || p.skuCode?.toLowerCase().includes(q);
    });
  }, [allProducts, productSearch, filterBrand, filterCategory, filterSubCat]);

  React.useEffect(() => { setProductPage(1); }, [productSearch, filterBrand, filterCategory, filterSubCat]);

  const addProduct = (productId: string) => {
    if (items.find(i => i.productId === productId)) return;
    const p = allProducts.find((x: any) => x.id === productId);
    if (!p) return;
    const key = sameProductKey(p);
    if (items.some(i => {
      const ip = allProducts.find((x: any) => x.id === i.productId);
      return ip && sameProductKey(ip) === key;
    })) {
      message.warning(`"${p.name}" is already in this sale — increase its quantity instead of adding it again`);
      return;
    }
    const { min, max } = getProductRates(p);
    const fifoPtr = p.fifoPurchaseRate != null
      ? Number(p.fifoPurchaseRate)
      : p.purchaseRate != null
        ? Number(p.purchaseRate)
        : null;
    setItems(prev => [...prev, {
      key: productId,
      productId: p.id,
      productName: p.name,
      unit: p.unit || '',
      minSaleRate: min,
      maxSaleRate: max,
      gstPercent: p.salesGstPercent || 0,
      quantity: 1,
      unitPrice: defaultUnitPrice(min, max),
      discountPercent: 0,
      discountAmount: 0,
      purchaseRate: fifoPtr,
      fifoBatchAvailable: p.fifoBatchAvailable != null ? Number(p.fifoBatchAvailable) : null,
      stockQuantity: p.stockQuantity != null ? Number(p.stockQuantity) : null,
    }]);
  };

  const adjustQty = (productId: string, newQty: number) => {
    if (newQty <= 0) { removeItem(productId); return; }
    setItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity: newQty } : i));
  };

  const updateItem = (key: string, field: 'quantity' | 'unitPrice' | 'discountPercent' | 'discountAmount', value: number) => {
    setItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));
  };

  const removeItem = (key: string) => setItems(prev => prev.filter(i => i.key !== key));

  const lineTotal = (item: LineItem) => {
    const lineGross = item.unitPrice * item.quantity;
    return discountType === 'AMOUNT'
      ? lineGross - (item.discountAmount || 0)
      : lineGross * (1 - (item.discountPercent || 0) / 100);
  };

  const totals = useMemo(() => {
    let subTotal = 0, totalGst = 0, grossIncl = 0;
    for (const item of items) {
      const lt       = lineTotal(item);
      const divisor  = 100 + item.gstPercent;
      const lineBase = (lt * 100) / divisor;
      const gstAmt   = lt - lineBase;
      subTotal += lineBase;
      totalGst += gstAmt;
      grossIncl += lt;
    }
    // Overall (bill-level) discount, applied before GST → scale subtotal & GST down together.
    const dv = overallDisc.value || 0;
    const discount = dv <= 0 || grossIncl <= 0 ? 0
      : discountType === 'PERCENT'
        ? Math.round(grossIncl * Math.min(dv, 100)) / 100
        : Math.min(dv, grossIncl);
    const factor = grossIncl > 0 ? (grossIncl - discount) / grossIncl : 1;
    subTotal *= factor;
    totalGst *= factor;
    const rawTotal = subTotal + totalGst;
    const total = Math.round(rawTotal);
    const roundOff = Math.round((total - rawTotal) * 100) / 100;
    return { subTotal: Math.round(subTotal * 100) / 100, totalGst: Math.round(totalGst * 100) / 100, discount: Math.round(discount * 100) / 100, roundOff, total };
  }, [items, discountType, overallDisc]);

  const priceErrors = items.filter(i => isPriceOutOfRange(i.unitPrice, i.minSaleRate, i.maxSaleRate));
  const discountErrors = discountType === 'PERCENT' && maxDiscountPercent != null
    ? items.filter(i => (i.discountPercent || 0) > maxDiscountPercent!)
    : [];
  const crossBatchErrors = items.filter(i => i.stockQuantity != null && i.quantity > i.stockQuantity);
  const selectedMethod = paymentMethods.find((m: any) => m.id === paymentMethodId);
  const isCredit = selectedMethod?.mode === 'CREDIT';
  const amountExceedsTotal = !isCredit && paymentAmount != null && paymentAmount > totals.total;
  const balance = Math.round((totals.total - (isCredit ? 0 : (paymentAmount || 0))) * 100) / 100;
  const existingOutstanding = Number(outstandingData?.data?.totalOutstanding || 0);

  // Credit limit. Only the unpaid part of the bill is new credit, so a sale settled in full at the
  // counter is never blocked — same rule the backend applies in OrderService.
  const creditEnforcement = workflowData?.data?.creditLimitEnforcement ?? 'HARD_BLOCK';
  const creditLimit = Number(outstandingData?.data?.creditLimit || 0);
  const creditChecked = creditEnforcement !== 'DISABLED'
    && outstandingData?.data?.creditAllowed === true && creditLimit > 0;
  const creditAvailable = Math.max(0, creditLimit - existingOutstanding);
  const alreadyOverLimit = creditChecked && outstandingData?.data?.overLimit === true;
  const wouldExceedLimit = creditChecked && !alreadyOverLimit && balance > creditAvailable;
  const creditBlocked = balance > 0 && (alreadyOverLimit || wouldExceedLimit);
  const shortfall = Math.max(0, Math.round((balance - creditAvailable) * 100) / 100);

  const handleAddCustomer = async () => {
    try {
      const values = await addCustForm.validateFields();
      const payload: any = {
        businessName:  values.businessName.trim(),
        ownerName:     values.ownerName.trim(),
        phone:         values.phone.trim(),
        altPhone:      values.altPhone?.trim()  || undefined,
        email:         values.email?.trim()     || undefined,
        address:       values.address?.trim()   || undefined,
        gstin:         values.gstin?.trim()     || undefined,
        routeId:       values.routeId,
        routePlaceId:  values.routePlaceId,
        creditAllowed: values.creditAllowed || false,
        creditDays:    values.creditDays    || undefined,
        creditLimit:   values.creditLimit   || undefined,
      };
      await createCustomer(payload).unwrap();
      message.success('Customer added');
      setAddCustOpen(false);
      setAddCustRouteId(undefined);
      addCustForm.resetFields();
      const refetched = await refetchCustomers();
      const list: any[] = refetched.data?.data?.content || refetched.data?.data || [];
      const newCust = list.find((c: any) => c.phone === values.phone.trim());
      if (newCust) setCustomerId(newCust.id);
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.data?.message || 'Failed to add customer');
    }
  };

  const handleSubmit = async () => {
    if (!customerId) { message.error('Please select a customer before billing'); return; }
    if (items.length === 0) { message.error('Add at least one product'); return; }
    for (const item of items) {
      if (item.stockQuantity != null && item.quantity > item.stockQuantity) {
        message.error(`${item.productName}: only ${item.stockQuantity} in stock — reduce quantity`);
        return;
      }
    }
    if (!isCredit && (paymentAmount === null || paymentAmount === undefined)) {
      message.error('Enter the amount collected (enter 0 to put the full amount on account)');
      return;
    }
    if (!isCredit && paymentAmount && paymentAmount > 0 && !paymentMethodId) {
      message.error('Select a payment method');
      return;
    }
    if (amountExceedsTotal) { message.error(`Amount collected cannot exceed the total of ${fmt(totals.total)}`); return; }
    if (alreadyOverLimit && balance > 0) {
      message.error(`This shop is over its credit limit — collect payment, or take the full ${fmt(totals.total)} now`);
      return;
    }
    if (wouldExceedLimit) {
      message.error(`Only ${fmt(creditAvailable)} of credit left — collect ${fmt(shortfall)} more or reduce the bill`);
      return;
    }
    if (discountErrors.length > 0) {
      message.error(`Discount exceeds the maximum allowed ${maxDiscountPercent}% — reduce discount on ${discountErrors[0].productName}`);
      return;
    }
    for (const item of items) {
      if (isPriceOutOfRange(item.unitPrice, item.minSaleRate, item.maxSaleRate)) {
        const hint = item.minSaleRate != null && item.unitPrice < item.minSaleRate
          ? `below minimum ₹${item.minSaleRate.toFixed(2)}`
          : `exceeds maximum ₹${item.maxSaleRate!.toFixed(2)}`;
        message.error(`Price for ${item.productName} is ${hint}`);
        return;
      }
    }

    try {
      const body: any = {
        customerId,
        items: items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          ...(discountType === 'AMOUNT'
            ? { discountAmount: i.discountAmount || 0 }
            : { discountPercent: i.discountPercent || 0 }),
        })),
        notes: notes || undefined,
        finalStatus,
        gatePassId: gatePassId || undefined,
        overallDiscountType: overallDisc.value && overallDisc.value > 0 ? discountType : null,
        overallDiscountValue: overallDisc.value && overallDisc.value > 0 ? overallDisc.value : null,
      };
      if (paymentAmount && paymentAmount > 0) {
        body.paymentAmount   = paymentAmount;
        body.paymentMethodId = paymentMethodId;
      }
      const res = await counterSale(body).unwrap();
      setLastOrder(res.data);
      message.success(`Counter sale ${res.data?.order?.orderNumber} completed`);
      setCustomerId(undefined);
      setItems([]);
      setPaymentMethodId(undefined);
      setPaymentAmount(null);
      setNotes('');
      setOverallDisc({ type: 'PERCENT', value: null });
      setFinalStatus('DELIVERED');
      setGatePassId(undefined);
      setFilterRouteId(undefined);
      setFilterPlaceId(undefined);
      setFilterPhone('');
      setProductSearch('');
      setFilterBrand(undefined);
      setFilterCategory(undefined);
      setFilterSubCat(undefined);
      setProductPage(1);
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to complete sale');
      if (/insufficient stock/i.test(err?.data?.message || '')) refetchProducts();
    }
  };

  const itemColumns = [
    {
      title: 'Product',
      key: 'product',
      render: (_: any, r: LineItem) => {
        const hasError = isPriceOutOfRange(r.unitPrice, r.minSaleRate, r.maxSaleRate);
        const belowMin = r.minSaleRate != null && r.unitPrice < r.minSaleRate;
        const overStock = r.stockQuantity != null && r.quantity > r.stockQuantity;
        return (
          <div>
            <div style={{ fontWeight: 600 }}>{r.productName}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{r.unit}</div>
            {hasError && (
              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginTop: 2 }}>
                {belowMin ? `Below min ₹${r.minSaleRate!.toFixed(2)}` : `Above max ₹${r.maxSaleRate!.toFixed(2)}`}
              </div>
            )}
            {overStock && (
              <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600, marginTop: 2 }}>
                Only {r.stockQuantity} in stock — reduce qty
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Qty',
      key: 'qty',
      width: 90,
      render: (_: any, r: LineItem) => (
        <InputNumber
          min={1}
          max={r.stockQuantity ?? undefined}
          value={r.quantity}
          size="small"
          style={{ width: 72 }}
          onChange={v => updateItem(r.key, 'quantity', v || 1)}
          status={r.stockQuantity != null && r.quantity > r.stockQuantity ? 'warning' : undefined}
        />
      ),
    },
    {
      title: 'Price (₹)',
      key: 'price',
      width: 130,
      render: (_: any, r: LineItem) => {
        const hasError = isPriceOutOfRange(r.unitPrice, r.minSaleRate, r.maxSaleRate);
        const rangeTitle = (r.minSaleRate != null || r.maxSaleRate != null)
          ? `${r.minSaleRate != null ? `min ₹${r.minSaleRate.toFixed(2)}` : ''}${r.minSaleRate != null && r.maxSaleRate != null ? ' – ' : ''}${r.maxSaleRate != null ? `max ₹${r.maxSaleRate.toFixed(2)}` : ''}`
          : undefined;
        return (
          <Tooltip title={rangeTitle} placement="top">
            <InputNumber
              min={0.01} precision={2} value={r.unitPrice} size="small" style={{ width: 106 }}
              onChange={v => updateItem(r.key, 'unitPrice', v || 0)}
              status={hasError ? 'error' : undefined}
              prefix="₹"
            />
          </Tooltip>
        );
      },
    },
    {
      title: discountType === 'AMOUNT' ? 'Disc (₹)' : 'Disc %',
      key: 'disc',
      width: 100,
      render: (_: any, r: LineItem) => discountType === 'AMOUNT' ? (
        <InputNumber
          min={0} max={r.unitPrice * r.quantity} precision={2} value={r.discountAmount} size="small" style={{ width: 82 }}
          onChange={v => updateItem(r.key, 'discountAmount', v || 0)}
          prefix="₹"
        />
      ) : (
        <InputNumber
          min={0} max={maxDiscountPercent ?? 100} precision={2} value={r.discountPercent} size="small" style={{ width: 82 }}
          onChange={v => updateItem(r.key, 'discountPercent', v || 0)}
          status={maxDiscountPercent != null && r.discountPercent > maxDiscountPercent ? 'error' : undefined}
          addonAfter="%"
        />
      ),
    },
    {
      title: 'PTR',
      key: 'ptr',
      width: 90,
      align: 'right' as const,
      render: (_: any, r: LineItem) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>
          {r.purchaseRate != null ? `₹${r.purchaseRate.toFixed(2)}` : '—'}
        </span>
      ),
    },
    {
      title: 'Total',
      key: 'total',
      width: 100,
      align: 'right' as const,
      render: (_: any, r: LineItem) => {
        const hasError = isPriceOutOfRange(r.unitPrice, r.minSaleRate, r.maxSaleRate);
        return (
          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: hasError ? '#dc2626' : undefined }}>
            {fmt(lineTotal(r))}
          </span>
        );
      },
    },
    {
      title: '',
      key: 'del',
      width: 40,
      render: (_: any, r: LineItem) => (
        <Button icon={<DeleteOutlined />} size="small" type="text" danger onClick={() => removeItem(r.key)} />
      ),
    },
  ].filter(col => showPurchaseRate || col.key !== 'ptr');

  return (
    <div style={{ paddingBottom: isSmall && items.length > 0 ? 76 : 0 }}>
      <PageHeader
        title="Counter Sale"
        subtitle="Select a customer and sell over the counter — order is immediately delivered"
        action={isSmall ? undefined : (
          <Button
            type="primary" size="large" icon={<ShoppingCartOutlined />}
            loading={submitting} onClick={handleSubmit}
            style={{ background: '#059669', borderColor: '#059669', fontWeight: 700 }}
          >
            Bill &amp; Collect
          </Button>
        )}
      />

      <Row gutter={[20, 20]}>
        {/* ── Left: Customer + Items ── */}
        <Col xs={24} lg={15}>
          <Card style={{ borderRadius: 12, marginBottom: 16 }} styles={{ body: { padding: isSmall ? 14 : 20 } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Customer
              </div>
              <Button
                size="small" icon={<UserAddOutlined />}
                onClick={() => { addCustForm.resetFields(); setAddCustRouteId(undefined); setAddCustOpen(true); }}
                style={{ fontSize: 12, fontWeight: 600 }}
              >
                Add Customer
              </Button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <Select
                placeholder="Filter by Route"
                allowClear
                size="small"
                style={{ flex: 1, minWidth: 130 }}
                value={filterRouteId}
                onChange={(v) => { setFilterRouteId(v); setFilterPlaceId(undefined); }}
                options={routes.map((r: any) => ({ value: r.id, label: r.name }))}
                showSearch
                filterOption={(input, option) => (option?.label as string)?.toLowerCase().startsWith(input.toLowerCase())}
              />
              <Select
                placeholder="Filter by Stop"
                allowClear
                size="small"
                style={{ flex: 1, minWidth: 130 }}
                value={filterPlaceId}
                onChange={setFilterPlaceId}
                disabled={!filterRouteId}
                options={getPlacesForRoute(filterRouteId || '').map((p: any) => ({ value: p.id, label: p.name }))}
              />
              <Input
                placeholder="Mobile number"
                size="small"
                style={{ flex: 1, minWidth: 130 }}
                value={filterPhone}
                onChange={e => setFilterPhone(e.target.value.replace(/\D/g, ''))}
                allowClear
                maxLength={10}
                prefix={<SearchOutlined style={{ color: '#94a3b8', fontSize: 11 }} />}
              />
            </div>

            <Select
              showSearch placeholder="Search customer by name..."
              style={{ width: '100%' }} size="large"
              value={customerId} onChange={setCustomerId}
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().startsWith(input.toLowerCase())}
              options={filteredCustomers.map((c: any) => ({
                value: c.id,
                label: c.businessName,
              }))}
              notFoundContent={
                <div style={{ padding: '8px 0', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
                  {filterRouteId || filterPlaceId ? 'No customers on this route/stop' : 'No customers found'}
                </div>
              }
            />
            {(filterRouteId || filterPlaceId || filterPhone) && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} matched
              </div>
            )}
          </Card>

          {/* Add Customer Modal */}
          <Modal
            open={addCustOpen}
            onCancel={() => { setAddCustOpen(false); setAddCustRouteId(undefined); }}
            title={<span style={{ fontWeight: 700 }}>New Customer</span>}
            onOk={handleAddCustomer}
            confirmLoading={creatingCust}
            okText="Save Customer"
            okButtonProps={{ style: { background: P, borderColor: P } }}
            width={isSmall ? '94vw' : 480}
            centered
          >
            <Form form={addCustForm} layout="vertical" requiredMark={false} style={{ marginTop: 8 }}>
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
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, margin: '8px 0 12px' }}>Route</div>
              <Form.Item name="routeId" label="Route *" rules={[{ required: true, message: 'Select a route' }]}>
                <Select
                  placeholder="Select route"
                  showSearch
                  optionFilterProp="children"
                  onChange={(v) => { setAddCustRouteId(v); addCustForm.setFieldValue('routePlaceId', undefined); }}
                >
                  {routes.map((r: any) => (
                    <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="routePlaceId" label="Stop / Place *" rules={[{ required: true, message: 'Select a stop' }]}>
                <Select
                  placeholder={addCustRouteId ? 'Select stop' : 'Select a route first'}
                  disabled={!addCustRouteId}
                >
                  {getPlacesForRoute(addCustRouteId || '').map((p: any) => (
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

          <Card style={{ borderRadius: 12 }} styles={{ body: { padding: isSmall ? 14 : 20 } }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              Products
            </div>

            {items.length > 0 && (
              isSmall ? (
                <div style={{ marginBottom: 12 }}>
                  {items.map(r => {
                    const hasError = isPriceOutOfRange(r.unitPrice, r.minSaleRate, r.maxSaleRate);
                    const belowMin = r.minSaleRate != null && r.unitPrice < r.minSaleRate;
                    const overStock = r.stockQuantity != null && r.quantity > r.stockQuantity;
                    const atStockLimit = r.stockQuantity != null && r.quantity >= r.stockQuantity;
                    return (
                      <div key={r.key} style={{ border: `1px solid ${hasError || overStock ? (overStock ? '#fde68a' : '#fca5a5') : '#e2e8f0'}`, borderRadius: 8, padding: 10, marginBottom: 8, background: hasError ? '#fff5f5' : overStock ? '#fffbeb' : '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ flex: 1, marginRight: 8 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{r.productName}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{r.unit}</div>
                            {hasError && (
                              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginTop: 2 }}>
                                {belowMin ? `Below min ₹${r.minSaleRate!.toFixed(2)}` : `Above max ₹${r.maxSaleRate!.toFixed(2)}`}
                              </div>
                            )}
                            {overStock && (
                              <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600, marginTop: 2 }}>
                                Only {r.stockQuantity} in stock — reduce qty
                              </div>
                            )}
                          </div>
                          <Button icon={<DeleteOutlined />} size="small" type="text" danger onClick={() => removeItem(r.key)} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: 6, padding: '2px 4px', gap: 4 }}>
                            <button onClick={() => adjustQty(r.productId, r.quantity - 1)} style={{ width: 26, height: 26, border: 'none', background: '#fff', borderRadius: 4, cursor: 'pointer', color: '#475569', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <MinusOutlined style={{ fontSize: 9 }} />
                            </button>
                            <span style={{ fontWeight: 700, fontSize: 14, minWidth: 20, textAlign: 'center', color: '#0f172a' }}>{r.quantity}</span>
                            <button
                              onClick={() => !atStockLimit && adjustQty(r.productId, r.quantity + 1)}
                              disabled={atStockLimit}
                              style={{ width: 26, height: 26, border: 'none', background: atStockLimit ? '#e2e8f0' : '#475569', borderRadius: 4, cursor: atStockLimit ? 'not-allowed' : 'pointer', color: atStockLimit ? '#94a3b8' : '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <PlusOutlined style={{ fontSize: 9 }} />
                            </button>
                          </div>
                          <InputNumber
                            min={0.01} precision={2} value={r.unitPrice} size="small"
                            style={{ flex: 1, minWidth: 0 }}
                            onChange={v => updateItem(r.key, 'unitPrice', v || 0)}
                            status={hasError ? 'error' : undefined}
                            prefix="₹"
                          />
                          {discountType === 'AMOUNT' ? (
                            <InputNumber
                              min={0} max={r.unitPrice * r.quantity} precision={2} value={r.discountAmount} size="small"
                              style={{ width: 72 }}
                              onChange={v => updateItem(r.key, 'discountAmount', v || 0)}
                              prefix="₹"
                              placeholder="Disc"
                            />
                          ) : (
                            <InputNumber
                              min={0} max={maxDiscountPercent ?? 100} precision={2} value={r.discountPercent} size="small"
                              style={{ width: 64 }}
                              onChange={v => updateItem(r.key, 'discountPercent', v || 0)}
                              status={maxDiscountPercent != null && r.discountPercent > maxDiscountPercent ? 'error' : undefined}
                              suffix="%"
                              placeholder="Disc"
                            />
                          )}
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: hasError ? '#dc2626' : '#0f172a', fontSize: 13, minWidth: 60, textAlign: 'right' }}>
                            {fmt(lineTotal(r))}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Table
                  columns={itemColumns}
                  dataSource={items}
                  rowKey="key"
                  size="small"
                  pagination={false}
                  style={{ marginBottom: 12 }}
                  rowClassName={(r: LineItem) => isPriceOutOfRange(r.unitPrice, r.minSaleRate, r.maxSaleRate) ? 'row-price-error' : ''}
                />
              )
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <Select
                placeholder="Brand"
                allowClear
                size="small"
                style={{ flex: 1, minWidth: 110 }}
                value={filterBrand}
                onChange={setFilterBrand}
                options={uniqueBrands.map(b => ({ value: b, label: b }))}
                showSearch
                filterOption={(input, option) => (option?.label as string)?.toLowerCase().startsWith(input.toLowerCase())}
              />
              <Select
                placeholder="Category"
                allowClear
                size="small"
                style={{ flex: 1, minWidth: 110 }}
                value={filterCategory}
                onChange={(v) => { setFilterCategory(v); setFilterSubCat(undefined); }}
                options={uniqueCategories.map(c => ({ value: c, label: c }))}
                showSearch
                filterOption={(input, option) => (option?.label as string)?.toLowerCase().startsWith(input.toLowerCase())}
              />
              <Select
                placeholder="Sub Category"
                allowClear
                size="small"
                style={{ flex: 1, minWidth: 120 }}
                value={filterSubCat}
                onChange={setFilterSubCat}
                disabled={uniqueSubCategories.length === 0}
                options={uniqueSubCategories.map(s => ({ value: s, label: s }))}
                showSearch
                filterOption={(input, option) => (option?.label as string)?.toLowerCase().startsWith(input.toLowerCase())}
              />
            </div>
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Search product by name or brand..."
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              allowClear
              style={{ marginBottom: 12 }}
            />

            {filteredProducts.length === 0 ? (
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '32px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13, border: '1px solid #e2e8f0', marginBottom: 12 }}>
                No products found
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isSmall ? '1fr 1fr' : 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginBottom: 8 }}>
                {filteredProducts.slice((productPage - 1) * 40, productPage * 40).map((p: any) => {
                  const existingItem = items.find(i => i.productId === p.id);
                  const qty = existingItem?.quantity || 0;
                  const inCart = qty > 0;
                  return (
                    <div key={p.id} style={{
                      background: '#fff',
                      border: `1px solid ${inCart ? P : '#e2e8f0'}`,
                      borderRadius: 12, overflow: 'hidden',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                      display: 'flex', flexDirection: 'column',
                    }}>
                      <div style={{ position: 'relative', background: '#fff', padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ position: 'absolute', top: 6, left: 8, zIndex: 1 }}>
                          <BatchInfoPopover productId={p.id} unit={p.unit} />
                        </span>
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: 110, objectFit: 'contain', display: 'block' }} />
                        ) : (
                          <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ShoppingCartOutlined style={{ fontSize: 24, color: '#cbd5e1' }} />
                          </div>
                        )}
                        <span style={{
                          position: 'absolute', top: 6, right: 6, fontSize: 10, fontWeight: 700,
                          padding: '2px 7px', borderRadius: 12,
                          background: (p.stockQuantity ?? 0) <= 10 ? '#fffbeb' : '#f0fdf4',
                          color: (p.stockQuantity ?? 0) <= 10 ? '#d97706' : '#16a34a',
                          border: `1px solid ${(p.stockQuantity ?? 0) <= 10 ? '#fde68a' : '#bbf7d0'}`,
                        }}>
                          {p.stockQuantity}
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
                        {qty === 0 ? (
                          <button
                            onClick={() => addProduct(p.id)}
                            style={{ marginTop: 'auto', width: '100%', height: 34, border: `1px solid ${P}`, borderRadius: 8, background: '#fff', color: P, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                          >
                            <PlusOutlined style={{ fontSize: 10 }} /> Add
                          </button>
                        ) : (
                          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: PL, borderRadius: 8, padding: '3px 4px' }}>
                            <button onClick={() => adjustQty(p.id, qty - 1)} style={{ width: 28, height: 28, border: 'none', background: '#fff', borderRadius: 6, cursor: 'pointer', color: P, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <MinusOutlined style={{ fontSize: 9 }} />
                            </button>
                            <InputNumber
                              min={1}
                              max={p.stockQuantity != null ? Number(p.stockQuantity) : undefined}
                              value={qty}
                              size="small"
                              controls={false}
                              onChange={v => adjustQty(p.id, v || 1)}
                              style={{ width: 36, fontWeight: 700, color: P, fontSize: 13, textAlign: 'center', border: 'none', background: 'transparent', boxShadow: 'none' }}
                            />
                            <button onClick={() => adjustQty(p.id, qty + 1)} style={{ width: 28, height: 28, border: 'none', background: P, borderRadius: 6, cursor: 'pointer', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <PlusOutlined style={{ fontSize: 9 }} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {filteredProducts.length > 40 && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <Pagination
                  current={productPage}
                  pageSize={40}
                  total={filteredProducts.length}
                  onChange={p => setProductPage(p)}
                  showSizeChanger={false}
                  showTotal={(total, range) => `${range[0]}–${range[1]} of ${total} products`}
                  size="small"
                />
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                Notes (optional)
              </div>
              <Input.TextArea
                rows={2} placeholder="Any notes for this sale..."
                value={notes} onChange={e => setNotes(e.target.value)}
              />
            </div>
          </Card>
        </Col>

        {/* ── Right: Summary + Payment ── */}
        <Col xs={24} lg={9}>
          <Card style={{ borderRadius: 12, position: 'sticky', top: 20 }} styles={{ body: { padding: 20 } }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
              Order Summary
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: '#64748b' }}>Sub Total (excl. GST)</span>
              <span style={{ fontFamily: 'monospace' }}>{fmt(totals.subTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: '#64748b' }}>GST</span>
              <span style={{ fontFamily: 'monospace' }}>{fmt(totals.totalGst)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: '#64748b' }}>Overall Discount {discountType === 'PERCENT' ? '(%)' : '(₹)'}</span>
              <InputNumber size="small" min={0} style={{ width: 120 }} placeholder="0"
                prefix={discountType === 'AMOUNT' ? '₹' : undefined}
                value={overallDisc.value ?? undefined}
                max={discountType === 'PERCENT' ? 100 : undefined}
                onChange={(v) => setOverallDisc(d => ({ ...d, value: v as number }))} />
            </div>
            {totals.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>Less: Discount</span>
                <span style={{ fontFamily: 'monospace', color: '#dc2626' }}>−{fmt(totals.discount)}</span>
              </div>
            )}
            <Divider style={{ margin: '10px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 18, color: '#0f172a' }}>{fmt(totals.total)}</span>
            </div>

            {customerId && existingOutstanding > 0 && (
              <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 12px', marginBottom: creditChecked ? 8 : 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#991b1b', fontWeight: 600 }}>Previous Outstanding</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14, color: '#dc2626' }}>{fmt(existingOutstanding)}</span>
              </div>
            )}

            {customerId && creditChecked && (
              <div style={{
                background: creditBlocked ? '#fef2f2' : '#f8fafc',
                border: `1px solid ${creditBlocked ? '#fecaca' : '#e2e8f0'}`,
                borderRadius: 8, padding: '8px 12px', marginBottom: 16,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                    Credit Limit {fmt(creditLimit)}
                  </span>
                  <span style={{
                    fontFamily: 'monospace', fontWeight: 800, fontSize: 14,
                    color: creditBlocked ? '#dc2626' : '#059669',
                  }}>
                    {fmt(creditAvailable)} left
                  </span>
                </div>
                {alreadyOverLimit && (
                  <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 700, marginTop: 4, lineHeight: 1.5 }}>
                    Already over the limit — collect payment before billing on account.
                    A bill paid in full at the counter is still allowed.
                  </div>
                )}
                {wouldExceedLimit && (
                  <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 700, marginTop: 4, lineHeight: 1.5 }}>
                    This bill puts {fmt(balance)} on account, which is {fmt(shortfall)} over the limit.
                    Collect {fmt(shortfall)} more, or reduce the bill.
                  </div>
                )}
              </div>
            )}

            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
              Payment Collected
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}><span style={{ color: '#ff4d4f', marginRight: 2 }}>*</span>Payment Method</div>
              <Select
                placeholder="Select payment method..." allowClear style={{ width: '100%' }}
                value={paymentMethodId}
                onChange={(v) => {
                  setPaymentMethodId(v);
                  const m = paymentMethods.find((x: any) => x.id === v);
                  if (m?.mode === 'CREDIT') setPaymentAmount(null);
                }}
                options={paymentMethods.map((m: any) => ({ value: m.id, label: m.name }))}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}><span style={{ color: '#ff4d4f', marginRight: 2 }}>*</span>Amount Collected (₹)</div>
              <InputNumber
                style={{ width: '100%' }} min={0} precision={2}
                placeholder={isCredit ? 'Full amount goes to outstanding' : `e.g. ${fmt(totals.total)}`}
                value={isCredit ? null : paymentAmount}
                disabled={isCredit}
                onChange={v => {
                  if (isCredit) return;
                  setPaymentAmount(v);
                }}
                formatter={v => v !== undefined && v !== '' ? `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                parser={(v: any) => v!.replace(/[^\d.]/g, '')}
                status={amountExceedsTotal || (!isCredit && paymentAmount === null) ? 'error' : undefined}
              />
              {isCredit && (
                <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 4 }}>
                  Full amount will be recorded as outstanding on this customer's account.
                </div>
              )}
              {amountExceedsTotal && (
                <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>
                  Amount cannot exceed the total of {fmt(totals.total)}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Move Order To</div>
              <Select
                style={{ width: '100%' }}
                value={finalStatus}
                onChange={setFinalStatus}
                options={[
                  { value: 'APPROVED',  label: 'Approved — billed, goods not yet handed over' },
                  { value: 'PACKED',    label: 'Packed — ready for pickup/dispatch' },
                  { value: 'DELIVERED', label: 'Delivered — customer takes goods now' },
                ]}
              />
            </div>

            {gatePassOptions.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Link to Gate Pass (optional)</div>
                <Select
                  style={{ width: '100%' }}
                  allowClear
                  showSearch
                  filterOption={(input, option: any) =>
                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                  placeholder="Not linked — bill under my own login"
                  value={gatePassId}
                  onChange={setGatePassId}
                  options={Object.entries(
                    gatePassOptions.reduce((groups: Record<string, any[]>, g: any) => {
                      (groups[g.allocationDate] ||= []).push(g);
                      return groups;
                    }, {})
                  ).map(([date, items]) => ({
                    label: dayjs(date).isSame(dayjs(), 'day') ? 'Today'
                      : dayjs(date).isSame(dayjs().subtract(1, 'day'), 'day') ? 'Yesterday'
                      : dayjs(date).format('DD MMM YYYY'),
                    title: date,
                    options: items.map((g: any) => ({
                      value: g.allocationId,
                      label: `${g.salesPersonName} — ${g.routeName}${g.salesCompleted ? ' (Completed)' : ''}`,
                    })),
                  }))}
                />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  Use this to bill a phone-in order under a salesman's route/day — covers the last 7 days,
                  e.g. a customer calls back after his Gate Pass for that route is already completed.
                </div>
              </div>
            )}

            <Divider style={{ margin: '10px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Balance Due</span>
              <span style={{
                fontFamily: 'monospace', fontWeight: 800, fontSize: 16,
                color: balance > 0 ? '#dc2626' : '#059669',
              }}>
                {fmt(Math.max(0, balance))}
              </span>
            </div>

            {balance > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400e', marginBottom: 16 }}>
                ₹{fmt(balance)} will remain as outstanding on this customer's account.
              </div>
            )}

            {!isSmall && (
              <Button
                type="primary" size="large" block icon={<ShoppingCartOutlined />}
                loading={submitting} onClick={handleSubmit} disabled={creditBlocked}
                style={creditBlocked
                  ? { fontWeight: 700, height: 48 }
                  : { background: '#059669', borderColor: '#059669', fontWeight: 700, height: 48 }}
              >
                {creditBlocked ? 'Blocked — Credit Limit' : 'Bill & Collect'}
              </Button>
            )}

            {lastOrder && (
              <div style={{ marginTop: 16, background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontWeight: 700, color: '#059669', fontSize: 13 }}>Last Sale</div>
                <div style={{ fontSize: 12, color: '#065f46', marginTop: 4 }}>
                  {lastOrder.order?.orderNumber} · {lastOrder.order?.customer?.businessName}
                </div>
                <div style={{ fontSize: 12, color: '#065f46' }}>
                  Total: {fmt(lastOrder.order?.totalAmount)} · Paid: {fmt(lastOrder.order?.paidAmount || 0)}
                </div>
                <Button
                  icon={<PrinterOutlined />} size="small" block
                  style={{ marginTop: 10, fontWeight: 600 }}
                  onClick={() => window.open(`/invoice/${lastOrder.order?.id}`, '_blank')}
                >
                  Print Invoice
                </Button>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {isSmall && items.length > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, background: '#fff', borderTop: '2px solid #e2e8f0', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 -4px 12px rgba(0,0,0,0.08)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>{items.length} item{items.length > 1 ? 's' : ''}</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a', fontFamily: 'monospace', lineHeight: 1.2 }}>{fmt(totals.total)}</div>
            {balance > 0 && <div style={{ fontSize: 10, color: '#dc2626' }}>Due: {fmt(balance)}</div>}
          </div>
          <Button
            type="primary" size="large" icon={<ShoppingCartOutlined />}
            loading={submitting} onClick={handleSubmit} disabled={creditBlocked}
            style={creditBlocked
              ? { fontWeight: 700, height: 48 }
              : { background: '#059669', borderColor: '#059669', fontWeight: 700, height: 48 }}
          >
            {creditBlocked ? 'Blocked' : 'Bill & Collect'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default CounterSalePage;
