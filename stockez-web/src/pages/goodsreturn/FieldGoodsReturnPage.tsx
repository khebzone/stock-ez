import React, { useEffect, useMemo, useState } from 'react';
import { Button, Select, Input, InputNumber, Drawer, message, Skeleton, Grid, Empty } from 'antd';
import {
  PlusOutlined, MinusOutlined, DeleteOutlined, SearchOutlined, LeftOutlined, RightOutlined,
  CheckCircleFilled, DownOutlined, UpOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { hasPermission } from '../../utils/permissions';
import { useGetAllProductsQuery } from '../../store/api/productApi';
import { useGetAllOrdersQuery } from '../../store/api/orderApi';
import {
  useCreateGoodsReturnMutation, useGetReturnedQtyByOrderQuery, useGetMyReturnHistoryQuery,
} from '../../store/api/goodsReturnApi';
import { useGetAllPurchasesQuery, useGetPurchaseQuery, useGetBatchesByProductQuery } from '../../store/api/purchaseApi';

const { useBreakpoint } = Grid;

const P = '#059669';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e5e7eb';
const fmt = (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

type Kind = 'SALES_RETURN' | 'DAMAGE' | 'PURCHASE_RETURN';

const KIND_LABEL: Record<Kind, string> = {
  SALES_RETURN: 'Customer Return',
  DAMAGE: 'Damage / Loss',
  PURCHASE_RETURN: 'Supplier Return',
};

const KIND_HINT: Record<Kind, string> = {
  SALES_RETURN: 'Customer giving goods back. The warehouse checks them on arrival, then the bill is reduced.',
  DAMAGE: 'Damaged or lost goods. Stock is removed and the loss is recorded.',
  PURCHASE_RETURN: 'Goods going back to the supplier. Stock is removed.',
};

const REASONS = ['Damaged', 'Expired', 'Wrong item', 'Customer refused', 'Other'];

interface Line {
  key: string;
  productId: string | null;
  name: string;
  batchNumber: string;
  qty: number;
  max?: number;
  rate: number | null;
  sold?: number;
}

const box: React.CSSProperties = { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10 };
const cap: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 4 };
const meta: React.CSSProperties = { fontSize: 11.5, color: MUTED, marginTop: 2, lineHeight: 1.4 };

const Stepper: React.FC<{ value: number; max?: number; onChange: (v: number) => void }> = ({ value, max, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
    <Button shape="circle" icon={<MinusOutlined />} disabled={value <= 0} onClick={() => onChange(value - 1)} />
    <InputNumber
      controls={false} min={0} max={max} precision={0} value={value} inputMode="numeric"
      onChange={(v) => onChange(Math.min(Math.max(Number(v || 0), 0), max ?? Number.MAX_SAFE_INTEGER))}
      style={{ width: 48 }}
    />
    <Button shape="circle" icon={<PlusOutlined />} disabled={max != null && value >= max} onClick={() => onChange(value + 1)} />
  </div>
);

const BatchSelect: React.FC<{
  productId: string | null; value: string; onChange: (v: string, avail?: number) => void;
}> = ({ productId, value, onChange }) => {
  const { data } = useGetBatchesByProductQuery(productId!, { skip: !productId });
  const batches: any[] = data?.data || [];
  return (
    <Select
      style={{ width: '100%' }} placeholder="Batch (optional)" allowClear showSearch
      value={value || undefined} disabled={!productId}
      onChange={(v, opt: any) => onChange(v ?? '', opt?.avail)}
      onClear={() => onChange('')}
      filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
      options={batches.filter((b: any) => Number(b.quantityAvailable) > 0).map((b: any) => ({
        value: b.batchNumber,
        avail: b.quantityAvailable,
        label: `${b.batchNumber}${b.expiryDate ? ` · exp ${dayjs(b.expiryDate).format('DD MMM YY')}` : ''} · ${b.quantityAvailable} avail`,
      }))}
    />
  );
};

/* Underline tabs — lighter than a segmented control */
const Tabs2: React.FC<{ value: string; onChange: (v: any) => void; items: { value: string; label: string }[] }> = ({ value, onChange, items }) => (
  <div style={{ display: 'flex', borderBottom: `1px solid ${LINE}` }}>
    {items.map((it) => {
      const on = it.value === value;
      return (
        <button key={it.value} type="button" onClick={() => onChange(it.value)} style={{
          flex: 1, height: 38, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
          fontWeight: on ? 700 : 500, color: on ? P : MUTED, borderBottom: `2px solid ${on ? P : 'transparent'}`, marginBottom: -1,
        }}>{it.label}</button>
      );
    })}
  </div>
);

const Chips: React.FC<{ value: string; onChange: (v: any) => void; items: { value: string; label: string }[] }> = ({ value, onChange, items }) => (
  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
    {items.map((it) => {
      const on = it.value === value;
      return (
        <button key={it.value} type="button" onClick={() => onChange(it.value)} style={{
          height: 30, padding: '0 12px', borderRadius: 15, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          border: `1px solid ${on ? P : '#d1d5db'}`, background: on ? '#ecfdf5' : '#fff', color: on ? P : '#475569',
        }}>{it.label}</button>
      );
    })}
  </div>
);

/* ── Bottom bar + confirm sheet shared by all three flows ── */
const SubmitSection: React.FC<{
  kind: Kind; lines: Line[]; reason: string; extra: Record<string, any>; onFiled: (ret: any) => void;
}> = ({ kind, lines, reason, extra, onFiled }) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [open, setOpen] = useState(false);
  const [createReturn, { isLoading }] = useCreateGoodsReturnMutation();

  const active = lines.filter((l) => l.qty > 0);
  const units = active.reduce((s, l) => s + l.qty, 0);
  const total = active.reduce((s, l) => s + l.qty * (l.rate || 0), 0);

  const review = () => {
    if (active.length === 0) { message.warning('Set a quantity on at least one item'); return; }
    if (active.some((l) => !l.rate || l.rate <= 0)) { message.error('Every item needs a rate above zero'); return; }
    setOpen(true);
  };

  const file = async () => {
    try {
      const res: any = await createReturn({
        type: kind,
        ...extra,
        returnDate: dayjs().format('YYYY-MM-DD'),
        reason: reason.trim() || null,
        items: active.map((l) => ({
          productId: l.productId, batchNumber: l.batchNumber.trim() || null, quantity: l.qty, unitRate: l.rate,
        })),
      }).unwrap();
      setOpen(false);
      onFiled(res?.data);
    } catch (e: any) {
      setOpen(false);
      message.error(e?.data?.message || 'Could not file the return');
    }
  };

  const bar: React.CSSProperties = isMobile
    ? { position: 'fixed', left: 12, right: 12, bottom: 'calc(66px + env(safe-area-inset-bottom, 0px))', zIndex: 150 }
    : {};

  return (
    <>
      {isMobile && <div style={{ height: 64 }} />}
      <div style={{
        ...bar, ...box, padding: '8px 10px 8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        boxShadow: isMobile ? '0 4px 14px rgba(15,23,42,0.12)' : undefined,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: MUTED }}>{units} unit{units !== 1 ? 's' : ''} · {active.length} item{active.length !== 1 ? 's' : ''}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>{fmt(total)}</div>
        </div>
        <Button type="primary" onClick={review} disabled={active.length === 0}
          style={{ height: 38, borderRadius: 8, fontWeight: 600, background: active.length ? P : undefined, borderColor: active.length ? P : undefined }}>
          Review & File
        </Button>
      </div>

      <Drawer
        open={open} onClose={() => setOpen(false)} placement="bottom" height="auto"
        title={<span style={{ fontWeight: 700, fontSize: 14 }}>Confirm {KIND_LABEL[kind]}</span>}
        styles={{ body: { padding: '4px 16px calc(16px + env(safe-area-inset-bottom, 0px))' }, header: { padding: '12px 16px' } }}
      >
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>{KIND_HINT[kind]}</div>
        <div style={{ ...box, marginBottom: 10 }}>
          {active.map((l, i) => (
            <div key={l.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '8px 12px', borderTop: i ? `1px solid ${LINE}` : 'none' }}>
              <span style={{ fontWeight: 600, minWidth: 0, wordBreak: 'break-word' }}>{l.name}</span>
              <span style={{ color: MUTED, whiteSpace: 'nowrap' }}>{l.qty} × {fmt(l.rate || 0)}</span>
            </div>
          ))}
        </div>
        {reason.trim() && <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>Reason: {reason.trim()}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
          <span>Total</span><span>{fmt(total)}</span>
        </div>
        <Button type="primary" block loading={isLoading} onClick={file}
          style={{ height: 42, borderRadius: 8, fontWeight: 600, background: P, borderColor: P }}>
          Confirm & File
        </Button>
      </Drawer>
    </>
  );
};

const ReasonPicker: React.FC<{ reason: string; setReason: (v: string) => void }> = ({ setReason }) => {
  const [chip, setChip] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const apply = (c: string | null, n: string) => setReason([c, n.trim()].filter(Boolean).join(': '));
  return (
    <div style={{ ...box, padding: 12 }}>
      <div style={cap}>Reason</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {REASONS.map((r) => {
          const on = chip === r;
          return (
            <button key={r} type="button" onClick={() => { const next = on ? null : r; setChip(next); apply(next, note); }}
              style={{
                height: 30, padding: '0 12px', borderRadius: 15, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${on ? P : '#d1d5db'}`, background: on ? '#ecfdf5' : '#fff', color: on ? P : '#475569',
              }}>
              {r}
            </button>
          );
        })}
      </div>
      <Input placeholder="Add a note (optional)" value={note}
        onChange={(e) => { setNote(e.target.value); apply(chip, e.target.value); }} />
    </div>
  );
};

/* One return line: name + detail on the left, stepper on the right */
const QtyRow: React.FC<{ line: Line; detail: string; onQty: (v: number) => void }> = ({ line, detail, onQty }) => (
  <div style={{ ...box, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, borderColor: line.qty > 0 ? P : LINE }}>
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.3, wordBreak: 'break-word' }}>{line.name}</div>
      <div style={meta}>{detail}</div>
      {line.qty > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: P, marginTop: 2 }}>{fmt(line.qty * (line.rate || 0))}</div>}
    </div>
    <Stepper value={line.qty} max={line.max} onChange={onQty} />
  </div>
);

const SectionHead: React.FC<{ text: string; action?: React.ReactNode }> = ({ text, action }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 22 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>{text}</div>
    {action}
  </div>
);

/* ── 1. Customer return: pick the delivered order, then set quantities ── */
const SalesReturnFlow: React.FC<{ onFiled: (r: any) => void }> = ({ onFiled }) => {
  const isDeliveryOnly = hasPermission('DELIVERY_VIEW') && !hasPermission('ORDERS_VIEW') && !hasPermission('INVOICE_VIEW');
  const { data: ordersData, isLoading } = useGetAllOrdersQuery({ status: 'DELIVERED', deliveredByMe: isDeliveryOnly });
  const [orderId, setOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [reason, setReason] = useState('');
  const { data: returnedData, isFetching: loadingReturned } = useGetReturnedQtyByOrderQuery(orderId!, { skip: !orderId });

  const orders: any[] = useMemo(() => {
    const list: any[] = ordersData?.data?.content || ordersData?.data || [];
    return [...list].sort((a, b) => String(b.orderDate).localeCompare(String(a.orderDate)) || String(b.orderNumber).localeCompare(String(a.orderNumber)));
  }, [ordersData]);
  const order = orders.find((o) => o.id === orderId);
  const customerOf = (o: any) => o.customerName || o.customer?.businessName || '';

  useEffect(() => {
    if (!order || returnedData === undefined) return;
    const alreadyReturned: Record<string, number> = returnedData?.data || {};
    const pool: Record<string, number> = {};
    (order.items || []).forEach((it: any) => {
      const pid = it.product?.id;
      pool[pid] = (pool[pid] ?? -(alreadyReturned[pid] || 0)) + (it.quantity || 0);
    });
    const built: Line[] = [];
    (order.items || []).forEach((it: any, idx: number) => {
      const pid = it.product?.id;
      const take = Math.max(Math.min(it.quantity || 0, pool[pid]), 0);
      pool[pid] -= take;
      if (take > 0) {
        built.push({
          key: `${it.id || idx}`, productId: pid || null, name: it.product?.name || it.productName || '—',
          batchNumber: it.batchNumber || '', qty: 0, max: take, sold: it.quantity,
          rate: it.unitPrice != null ? Number(it.unitPrice) : null,
        });
      }
    });
    setLines(built);
  }, [order, returnedData]);

  const setQty = (key: string, qty: number) => setLines((p) => p.map((l) => (l.key === key ? { ...l, qty } : l)));

  if (!orderId) {
    const q = search.trim().toLowerCase();
    const filtered = orders.filter((o) => !q || `${o.orderNumber} ${customerOf(o)}`.toLowerCase().includes(q));
    const shown = filtered.slice(0, 40);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Input allowClear prefix={<SearchOutlined style={{ color: '#94a3b8' }} />} placeholder="Search customer or order number"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : shown.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No delivered orders found" style={{ margin: '24px 0' }} />
        ) : (
          <div style={box}>
            {shown.map((o, i) => (
              <div key={o.id} onClick={() => setOrderId(o.id)} style={{
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                borderTop: i ? `1px solid ${LINE}` : 'none',
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: INK, wordBreak: 'break-word' }}>{customerOf(o) || '—'}</div>
                  <div style={meta}>{o.orderNumber} · {dayjs(o.orderDate).format('DD MMM YY')} · {(o.items || []).length} item{(o.items || []).length !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(o.totalAmount)}</div>
                <RightOutlined style={{ color: '#cbd5e1', fontSize: 11 }} />
              </div>
            ))}
          </div>
        )}
        {filtered.length > shown.length && (
          <div style={{ textAlign: 'center', fontSize: 11.5, color: '#94a3b8' }}>Showing {shown.length} of {filtered.length} - search to narrow down</div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ ...box, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, wordBreak: 'break-word' }}>{order ? customerOf(order) : ''}</div>
          <div style={meta}>{order?.orderNumber} · {order ? dayjs(order.orderDate).format('DD MMM YY') : ''}</div>
        </div>
        <Button size="small" onClick={() => { setOrderId(null); setLines([]); setReason(''); }}>Change</Button>
      </div>

      {loadingReturned ? <Skeleton active paragraph={{ rows: 3 }} /> : lines.length === 0 ? (
        <div style={{ ...box, padding: 14, textAlign: 'center', color: MUTED, fontSize: 12.5 }}>Everything on this order has already been returned.</div>
      ) : (
        <>
          <SectionHead text="How many are coming back?"
            action={<Button type="link" size="small" style={{ padding: 0, fontSize: 12 }} onClick={() => setLines((p) => p.map((l) => ({ ...l, qty: l.max || 0 })))}>Return all</Button>} />
          {lines.map((l) => (
            <QtyRow key={l.key} line={l} onQty={(v) => setQty(l.key, v)}
              detail={`${l.batchNumber ? `${l.batchNumber} · ` : ''}Sold ${l.sold} · Can return ${l.max} · ${fmt(l.rate || 0)}`} />
          ))}
          <ReasonPicker reason={reason} setReason={setReason} />
          <SubmitSection kind="SALES_RETURN" lines={lines} reason={reason} extra={{ orderId }} onFiled={onFiled} />
        </>
      )}
    </div>
  );
};

/* ── 2. Damage / loss: choose products freely ── */
const DamageFlow: React.FC<{ onFiled: (r: any) => void }> = ({ onFiled }) => {
  const { data: productsData } = useGetAllProductsQuery();
  const products: any[] = productsData?.data?.content || productsData?.data || [];
  const [lines, setLines] = useState<Line[]>([{ key: 'l1', productId: null, name: '', batchNumber: '', qty: 0, rate: null }]);
  const [reason, setReason] = useState('');

  const patch = (key: string, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
  const pickProduct = (key: string, pid: string) => {
    const prod = products.find((x: any) => x.id === pid);
    patch(key, { productId: pid, name: prod?.name || '', batchNumber: '', max: undefined, qty: 0, rate: Number(prod?.minSaleRate) || null });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {lines.map((l, idx) => (
        <div key={l.key} style={{ ...box, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>Item {idx + 1}</div>
            {lines.length > 1 && (
              <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} />
            )}
          </div>
          <div style={cap}>Product</div>
          <Select showSearch style={{ width: '100%', marginBottom: 8 }} placeholder="Select product"
            value={l.productId || undefined} onChange={(v) => pickProduct(l.key, v)}
            filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
            options={products.map((p: any) => ({ value: p.id, label: `${p.name}${p.brand ? ` — ${p.brand}` : ''}` }))} />
          <div style={cap}>Batch</div>
          <div style={{ marginBottom: 8 }}>
            <BatchSelect productId={l.productId} value={l.batchNumber}
              onChange={(v, avail) => patch(l.key, { batchNumber: v, max: v && avail != null ? avail : undefined, qty: v && avail != null ? Math.min(l.qty, avail) : l.qty })} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={cap}>Quantity</div>
              <Stepper value={l.qty} max={l.max} onChange={(v) => patch(l.key, { qty: v })} />
            </div>
            <div style={{ width: 104 }}>
              <div style={cap}>Rate</div>
              <InputNumber style={{ width: '100%' }} min={0.01} precision={2} prefix="₹" inputMode="decimal"
                value={l.rate || undefined} onChange={(v) => patch(l.key, { rate: v == null ? null : Number(v) })} />
            </div>
          </div>
        </div>
      ))}
      <Button icon={<PlusOutlined />} onClick={() => setLines((ls) => [...ls, { key: `l${Date.now()}`, productId: null, name: '', batchNumber: '', qty: 0, rate: null }])}
        style={{ height: 36, borderRadius: 8, fontWeight: 600 }}>
        Add another product
      </Button>
      <div style={{ ...box, padding: 12 }}>
        <div style={cap}>What happened?</div>
        <Input placeholder="e.g. Rain damage, broken in transit" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <SubmitSection kind="DAMAGE" lines={lines} reason={reason} extra={{}} onFiled={onFiled} />
    </div>
  );
};

/* ── 3. Supplier return: pick a purchase bill, then set quantities ── */
const PurchaseReturnFlow: React.FC<{ onFiled: (r: any) => void }> = ({ onFiled }) => {
  const { data: purchasesData } = useGetAllPurchasesQuery();
  const purchases: any[] = purchasesData?.data?.content || purchasesData?.data || [];
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const { data: detail } = useGetPurchaseQuery(purchaseId!, { skip: !purchaseId });
  const [lines, setLines] = useState<Line[]>([]);
  const [reason, setReason] = useState('');

  const purchase = detail?.data || detail;

  useEffect(() => {
    if (!purchaseId || !purchase?.items) { setLines([]); return; }
    setLines(purchase.items
      .filter((it: any) => (it.quantityAvailable ?? it.quantity) > 0)
      .map((it: any, idx: number) => {
        const max = Math.min(it.quantity || 0, it.quantityAvailable ?? it.quantity ?? 0);
        return {
          key: `${it.id || idx}`, productId: it.product?.id || null, name: it.product?.name || '—',
          batchNumber: it.batchNumber || '', qty: 0, max, sold: it.quantity,
          rate: it.purchaseRate != null ? Number(it.purchaseRate) : null,
        } as Line;
      }));
  }, [purchaseId, purchase]);

  const setQty = (key: string, qty: number) => setLines((p) => p.map((l) => (l.key === key ? { ...l, qty } : l)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ ...box, padding: 12 }}>
        <div style={cap}>Purchase bill</div>
        <Select showSearch style={{ width: '100%' }} placeholder="Select purchase" value={purchaseId || undefined}
          onChange={(v) => setPurchaseId(v ?? null)} allowClear onClear={() => setPurchaseId(null)}
          filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
          options={purchases.map((p: any) => ({ value: p.id, label: `${p.entryNumber} — ${p.supplierName}` }))} />
      </div>
      {purchaseId && lines.length === 0 && (
        <div style={{ ...box, padding: 14, textAlign: 'center', color: MUTED, fontSize: 12.5 }}>No stock from this purchase is left to return.</div>
      )}
      {lines.map((l) => (
        <QtyRow key={l.key} line={l} onQty={(v) => setQty(l.key, v)}
          detail={`${l.batchNumber ? `${l.batchNumber} · ` : ''}Bought ${l.sold} · In stock ${l.max} · ${fmt(l.rate || 0)}`} />
      ))}
      {lines.length > 0 && (
        <>
          <ReasonPicker reason={reason} setReason={setReason} />
          <SubmitSection kind="PURCHASE_RETURN" lines={lines} reason={reason}
            extra={{ purchaseEntryId: purchaseId, supplierName: purchase?.supplierName }} onFiled={onFiled} />
        </>
      )}
    </div>
  );
};

/* ── Result screen after filing ── */
const Filed: React.FC<{ ret: any; onAnother: () => void; onHistory: () => void }> = ({ ret, onAnother, onHistory }) => (
  <div style={{ ...box, textAlign: 'center', padding: '24px 16px' }}>
    <CheckCircleFilled style={{ fontSize: 34, color: P }} />
    <div style={{ fontSize: 15, fontWeight: 700, marginTop: 8 }}>Return filed</div>
    <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginTop: 2 }}>{ret?.returnNumber}</div>
    <div style={{ fontSize: 12, color: MUTED, margin: '8px 0 16px' }}>
      {ret?.type === 'SALES_RETURN'
        ? 'Hand the goods to the warehouse. The bill is reduced once they confirm what arrived.'
        : 'Stock and accounts are updated.'}
    </div>
    <Button type="primary" block onClick={onAnother} style={{ height: 40, borderRadius: 8, fontWeight: 600, background: P, borderColor: P }}>
      File another
    </Button>
    <Button block onClick={onHistory} style={{ height: 40, borderRadius: 8, marginTop: 8 }}>View my returns</Button>
  </div>
);

/* ── My returns: the user's own filings, one day at a time ── */
const statusOf = (r: any): { text: string; color: string } => {
  if (r.warehouseStatus === 'CANCELLED') return { text: 'Cancelled', color: '#94a3b8' };
  if (r.type === 'SALES_RETURN' && r.warehouseStatus === 'PENDING_VERIFICATION') return { text: 'Awaiting warehouse', color: '#d97706' };
  if (r.refundStatus === 'PENDING') return { text: 'Refund due', color: '#d97706' };
  if (r.refundStatus === 'PROCESSED') return { text: 'Refunded', color: P };
  return { text: r.type === 'SALES_RETURN' ? 'Verified' : 'Done', color: P };
};

const MyReturns: React.FC = () => {
  const [day, setDay] = useState(dayjs());
  const [open, setOpen] = useState<string | null>(null);
  const { data, isFetching } = useGetMyReturnHistoryQuery(day.format('YYYY-MM-DD'));
  const rows: any[] = data?.data || [];
  const today = day.isSame(dayjs(), 'day');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ ...box, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 40 }}>
        <Button type="text" icon={<LeftOutlined />} onClick={() => setDay((d) => d.subtract(1, 'day'))} />
        <div style={{ fontSize: 13, fontWeight: 600 }}>{today ? 'Today' : day.format('DD MMM YYYY')}</div>
        <Button type="text" icon={<RightOutlined />} disabled={today} onClick={() => setDay((d) => d.add(1, 'day'))} />
      </div>
      {isFetching ? <Skeleton active paragraph={{ rows: 3 }} /> : rows.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing filed on this day" style={{ margin: '24px 0' }} />
      ) : (
        <div style={box}>
          {rows.map((r, i) => {
            const st = statusOf(r);
            const isOpen = open === r.id;
            const party = r.type === 'SALES_RETURN' ? r.referenceOrderCustomerName : (r.supplierName || r.referencePurchaseSupplierName);
            const showReceived = r.type === 'SALES_RETURN' && r.warehouseStatus === 'VERIFIED';
            return (
              <div key={r.id} style={{ borderTop: i ? `1px solid ${LINE}` : 'none' }}>
                <div onClick={() => setOpen(isOpen ? null : r.id)} style={{ cursor: 'pointer', padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.returnNumber}</div>
                    <div style={{ ...meta, wordBreak: 'break-word' }}>{KIND_LABEL[r.type as Kind] || r.type}{party ? ` · ${party}` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(r.totalAmount)}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: st.color }}>{st.text}</div>
                  </div>
                  <span style={{ color: '#cbd5e1', fontSize: 10 }}>{isOpen ? <UpOutlined /> : <DownOutlined />}</span>
                </div>
                {isOpen && (
                  <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(r.items || []).map((it: any) => (
                      <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                        <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{it.productName}</span>
                        <span style={{ color: MUTED, whiteSpace: 'nowrap' }}>
                          {showReceived
                            ? `filed ${it.quantity} · got ${it.receivedQty ?? 0}${it.damagedQty ? ` · ${it.damagedQty} damaged` : ''}`
                            : `Qty ${it.quantity}`}
                        </span>
                      </div>
                    ))}
                    {r.reason && <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{r.reason}</div>}
                    {r.warehouseStatus === 'CANCELLED' && r.cancellationReason && (
                      <div style={{ fontSize: 11.5, color: '#94a3b8' }}>Cancelled: {r.cancellationReason}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* Field (Sales / Delivery) version — separate from the office Goods Return page so a phone gets
   a task-by-task flow instead of the desktop form. Refund payouts stay with Finance. */
const FieldGoodsReturnPage: React.FC = () => {
  const canCreate = hasPermission('RETURNS_CREATE');
  const kinds = useMemo(() => {
    const k: Kind[] = ['SALES_RETURN'];
    if (hasPermission('RETURNS_DAMAGE')) k.push('DAMAGE');
    if (hasPermission('PURCHASES_VIEW')) k.push('PURCHASE_RETURN');
    return k;
  }, []);
  const [tab, setTab] = useState<'file' | 'mine'>(canCreate ? 'file' : 'mine');
  const [kind, setKind] = useState<Kind>('SALES_RETURN');
  const [filed, setFiled] = useState<any | null>(null);
  const [run, setRun] = useState(0);

  const again = () => { setFiled(null); setRun((n) => n + 1); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560, margin: '0 auto', fontSize: 13 }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: INK }}>Returns</div>

      {canCreate && (
        <Tabs2 value={tab} onChange={(v) => { setTab(v); setFiled(null); }}
          items={[{ value: 'file', label: 'File a Return' }, { value: 'mine', label: 'My Returns' }]} />
      )}

      {tab === 'mine' ? <MyReturns /> : filed ? (
        <Filed ret={filed} onAnother={again} onHistory={() => { setFiled(null); setTab('mine'); }} />
      ) : (
        <>
          {kinds.length > 1 && (
            <Chips value={kind} onChange={(v) => { setKind(v as Kind); setRun((n) => n + 1); }}
              items={kinds.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
          )}
          <div style={{ fontSize: 11.5, color: MUTED, marginTop: -4 }}>{KIND_HINT[kind]}</div>
          {kind === 'SALES_RETURN' && <SalesReturnFlow key={`s${run}`} onFiled={setFiled} />}
          {kind === 'DAMAGE' && <DamageFlow key={`d${run}`} onFiled={setFiled} />}
          {kind === 'PURCHASE_RETURN' && <PurchaseReturnFlow key={`p${run}`} onFiled={setFiled} />}
        </>
      )}
    </div>
  );
};

export default FieldGoodsReturnPage;
