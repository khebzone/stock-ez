import React, { useState, useMemo } from 'react';
import {
  Select, Button, InputNumber, Table, message, Card, Divider,
  Row, Col, Input, Grid,
} from 'antd';
import { PlusOutlined, MinusOutlined, DeleteOutlined, ShoppingCartOutlined, SearchOutlined } from '@ant-design/icons';

const { useBreakpoint } = Grid;
import { useGetCustomersQuery } from '../../store/api/customerApi';
import { useGetProductsQuery } from '../../store/api/productApi';
import { useGetPaymentMethodsQuery } from '../../store/api/paymentMethodApi';
import { useCounterSaleMutation } from '../../store/api/orderApi';
import PageHeader from '../../components/PageHeader';

const fmt = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface LineItem {
  key: string;
  productId: string;
  productName: string;
  unit: string;
  maxSaleRate: number;
  minSaleRate: number;
  gstPercent: number;
  quantity: number;
  unitPrice: number;
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
  const [lastOrder, setLastOrder]             = useState<any>(null);

  const { data: customersData }       = useGetCustomersQuery({});
  const { data: productsData }        = useGetProductsQuery({});
  const { data: paymentMethodsData }  = useGetPaymentMethodsQuery();
  const [counterSale, { isLoading: submitting }] = useCounterSaleMutation();

  const customers: any[]      = customersData?.data?.content || customersData?.data || [];
  const allProducts: any[]    = productsData?.data?.content || productsData?.data || [];
  const paymentMethods: any[] = paymentMethodsData?.data || [];

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase();
    return allProducts.filter((p: any) =>
      p.active !== false && (
        p.name?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.skuCode?.toLowerCase().includes(q)
      )
    );
  }, [allProducts, productSearch]);

  const addProduct = (productId: string) => {
    if (items.find(i => i.productId === productId)) return;
    const p = allProducts.find((x: any) => x.id === productId);
    if (!p) return;
    setItems(prev => [...prev, {
      key: productId,
      productId: p.id,
      productName: p.name,
      unit: p.unit || '',
      maxSaleRate: p.maxSaleRate || 0,
      minSaleRate: p.minSaleRate || 0,
      gstPercent: p.salesGstPercent || 0,
      quantity: 1,
      unitPrice: p.maxSaleRate || 0,
    }]);
  };

  const adjustQty = (productId: string, newQty: number) => {
    if (newQty <= 0) { removeItem(productId); return; }
    setItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity: newQty } : i));
  };

  const updateItem = (key: string, field: 'quantity' | 'unitPrice', value: number) => {
    setItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));
  };

  const removeItem = (key: string) => setItems(prev => prev.filter(i => i.key !== key));

  const totals = useMemo(() => {
    let subTotal = 0, totalGst = 0;
    for (const item of items) {
      const lineTotal = item.unitPrice * item.quantity;
      const divisor   = 100 + item.gstPercent;
      const lineBase  = (lineTotal * 100) / divisor;
      const gstAmt    = lineTotal - lineBase;
      subTotal += lineBase;
      totalGst += gstAmt;
    }
    return { subTotal, totalGst, total: subTotal + totalGst };
  }, [items]);

  const balance = totals.total - (paymentAmount || 0);

  const handleSubmit = async () => {
    if (!customerId) { message.error('Select a customer'); return; }
    if (items.length === 0) { message.error('Add at least one product'); return; }
    for (const item of items) {
      if (item.unitPrice < item.minSaleRate) {
        message.error(`Price for ${item.productName} is below minimum ₹${item.minSaleRate}`);
        return;
      }
      if (item.unitPrice > item.maxSaleRate) {
        message.error(`Price for ${item.productName} exceeds maximum ₹${item.maxSaleRate}`);
        return;
      }
    }

    try {
      const body: any = {
        customerId,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
        notes: notes || undefined,
      };
      if (paymentAmount && paymentAmount > 0) {
        body.paymentAmount  = paymentAmount;
        body.paymentMethodId = paymentMethodId || undefined;
        if (!paymentMethodId) body.paymentMode = 'CASH';
      }
      const res = await counterSale(body).unwrap();
      setLastOrder(res.data);
      message.success(`Counter sale ${res.data?.order?.orderNumber} completed`);
      setCustomerId(undefined);
      setItems([]);
      setPaymentMethodId(undefined);
      setPaymentAmount(null);
      setNotes('');
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to complete sale');
    }
  };

  const itemColumns = [
    {
      title: 'Product',
      key: 'product',
      render: (_: any, r: LineItem) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.productName}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{r.unit}</div>
        </div>
      ),
    },
    {
      title: 'Qty',
      key: 'qty',
      width: 90,
      render: (_: any, r: LineItem) => (
        <InputNumber
          min={1} value={r.quantity} size="small" style={{ width: 72 }}
          onChange={v => updateItem(r.key, 'quantity', v || 1)}
        />
      ),
    },
    {
      title: 'Price (₹)',
      key: 'price',
      width: 120,
      render: (_: any, r: LineItem) => (
        <InputNumber
          min={0} precision={2} value={r.unitPrice} size="small" style={{ width: 100 }}
          onChange={v => updateItem(r.key, 'unitPrice', v || 0)}
          status={r.unitPrice < r.minSaleRate || r.unitPrice > r.maxSaleRate ? 'error' : undefined}
        />
      ),
    },
    {
      title: 'Total',
      key: 'total',
      width: 100,
      align: 'right' as const,
      render: (_: any, r: LineItem) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
          {fmt(r.unitPrice * r.quantity)}
        </span>
      ),
    },
    {
      title: '',
      key: 'del',
      width: 40,
      render: (_: any, r: LineItem) => (
        <Button icon={<DeleteOutlined />} size="small" type="text" danger onClick={() => removeItem(r.key)} />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Counter Sale"
        subtitle="Sell to walk-in customers — order is immediately delivered"
        action={
          <Button
            type="primary" size="large" icon={<ShoppingCartOutlined />}
            loading={submitting} onClick={handleSubmit}
            disabled={!customerId || items.length === 0}
            style={{ background: '#059669', borderColor: '#059669', fontWeight: 700 }}
          >
            Bill &amp; Collect
          </Button>
        }
      />

      <Row gutter={[20, 20]}>
        {/* ── Left: Customer + Items ── */}
        <Col xs={24} lg={15}>
          <Card style={{ borderRadius: 12, marginBottom: 16 }} styles={{ body: { padding: 20 } }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              Customer
            </div>
            <Select
              showSearch placeholder="Search customer by name or phone..."
              style={{ width: '100%' }} size="large"
              value={customerId} onChange={setCustomerId}
              optionFilterProp="label"
              options={customers.map((c: any) => ({
                value: c.id,
                label: `${c.businessName}${c.phone ? ` — ${c.phone}` : ''}`,
              }))}
            />
          </Card>

          <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 20 } }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              Products
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
              <div style={{ display: 'grid', gridTemplateColumns: isSmall ? '1fr 1fr' : 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginBottom: 12 }}>
                {filteredProducts.slice(0, 40).map((p: any) => {
                  const existingItem = items.find(i => i.productId === p.id);
                  const qty = existingItem?.quantity || 0;
                  const inCart = qty > 0;
                  const outOfStock = p.stockQuantity != null && p.stockQuantity === 0;
                  return (
                    <div key={p.id} style={{
                      background: '#fff',
                      border: `1px solid ${inCart ? P : '#e2e8f0'}`,
                      borderRadius: 10, padding: 10,
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
                        ₹{(p.minSaleRate || 0).toFixed(2)}
                        {p.salesGstPercent > 0 && <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}> +{p.salesGstPercent}%</span>}
                      </div>
                      {outOfStock ? (
                        <div style={{ textAlign: 'center', fontSize: 11, color: '#ef4444', fontWeight: 600 }}>Out of Stock</div>
                      ) : qty === 0 ? (
                        <button
                          onClick={() => addProduct(p.id)}
                          style={{ width: '100%', height: 32, border: `1px solid ${P}`, borderRadius: 6, background: '#fff', color: P, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                        >
                          <PlusOutlined style={{ fontSize: 10 }} /> Add
                        </button>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: PL, borderRadius: 6, padding: '2px 4px' }}>
                          <button onClick={() => adjustQty(p.id, qty - 1)} style={{ width: 26, height: 26, border: 'none', background: '#fff', borderRadius: 4, cursor: 'pointer', color: P, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <MinusOutlined style={{ fontSize: 9 }} />
                          </button>
                          <span style={{ fontWeight: 700, color: P, fontSize: 14 }}>{qty}</span>
                          <button onClick={() => adjustQty(p.id, qty + 1)} style={{ width: 26, height: 26, border: 'none', background: P, borderRadius: 4, cursor: 'pointer', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <PlusOutlined style={{ fontSize: 9 }} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {items.length > 0 && (
              <Table
                columns={itemColumns}
                dataSource={items}
                rowKey="key"
                size="small"
                pagination={false}
                style={{ marginTop: 4 }}
              />
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
            <Divider style={{ margin: '10px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 18, color: '#0f172a' }}>{fmt(totals.total)}</span>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
              Payment Collected
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Payment Method</div>
              <Select
                placeholder="Cash (default)" allowClear style={{ width: '100%' }}
                value={paymentMethodId} onChange={setPaymentMethodId}
                options={paymentMethods.map((m: any) => ({ value: m.id, label: m.name }))}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Amount Collected (₹)</div>
              <InputNumber
                style={{ width: '100%' }} min={0} max={totals.total} precision={2}
                placeholder={`Max ${fmt(totals.total)}`}
                value={paymentAmount}
                onChange={v => setPaymentAmount(v)}
                formatter={v => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(v: any) => v!.replace(/₹\s?|(,*)/g, '')}
              />
            </div>

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

            <Button
              type="primary" size="large" block icon={<ShoppingCartOutlined />}
              loading={submitting} onClick={handleSubmit}
              disabled={!customerId || items.length === 0}
              style={{ background: '#059669', borderColor: '#059669', fontWeight: 700, height: 48 }}
            >
              Bill &amp; Collect
            </Button>

            {lastOrder && (
              <div style={{ marginTop: 16, background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontWeight: 700, color: '#059669', fontSize: 13 }}>Last Sale</div>
                <div style={{ fontSize: 12, color: '#065f46', marginTop: 4 }}>
                  {lastOrder.order?.orderNumber} · {lastOrder.order?.customer?.businessName}
                </div>
                <div style={{ fontSize: 12, color: '#065f46' }}>
                  Total: {fmt(lastOrder.order?.totalAmount)} · Paid: {fmt(lastOrder.order?.paidAmount || 0)}
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CounterSalePage;
