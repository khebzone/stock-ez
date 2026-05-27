import React, { useState } from 'react';
import {
  Button, Select, DatePicker, Input, InputNumber, Modal, message,
  Tabs, Skeleton, Tag,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ArrowLeftOutlined,
  RollbackOutlined, WarningOutlined, ShopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import AuditHistoryButton from '../../components/AuditHistoryButton';
import { useGetProductsQuery } from '../../store/api/productApi';
import { useGetOrdersQuery } from '../../store/api/orderApi';
import { useListGoodsReturnsQuery, useCreateGoodsReturnMutation } from '../../store/api/goodsReturnApi';

const fmt = (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; description: string }> = {
  SALES_RETURN:     { label: 'Sales Return',     color: '#2563eb', icon: <RollbackOutlined />, description: 'Customer returning goods — stock restored, customer balance reduced' },
  PURCHASE_RETURN:  { label: 'Purchase Return',  color: '#7c3aed', icon: <ShopOutlined />,     description: 'Returning goods to supplier — stock removed' },
  DAMAGE:           { label: 'Damage / Loss',    color: '#dc2626', icon: <WarningOutlined />,  description: 'Damaged or lost goods — stock removed, loss recorded' },
};

interface ReturnLine {
  id: number;
  productId: string | null;
  batchNumber: string;
  quantity: number | null;
  unitRate: number | null;
  reason: string;
}

const emptyLine = (id: number): ReturnLine => ({
  id, productId: null, batchNumber: '', quantity: null, unitRate: null, reason: '',
});

/* ── New Entry Form ── */
const NewReturnForm: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [type, setType]             = useState<string>('SALES_RETURN');
  const [orderId, setOrderId]       = useState<string | null>(null);
  const [supplierName, setSupplier] = useState('');
  const [returnDate, setReturnDate] = useState<any>(dayjs());
  const [reason, setReason]         = useState('');
  const [lines, setLines]           = useState<ReturnLine[]>([emptyLine(1)]);
  const [nextId, setNextId]         = useState(2);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: productsData } = useGetProductsQuery({ size: 500 });
  const { data: ordersData }   = useGetOrdersQuery({ size: 200, status: 'DELIVERED' }, { skip: type !== 'SALES_RETURN' });
  const [createReturn, { isLoading: saving }] = useCreateGoodsReturnMutation();

  const products: any[] = productsData?.data?.content || productsData?.data || [];
  const orders: any[]   = ordersData?.data?.content || ordersData?.data || [];

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
        const prod = products.find((p: any) => p.id === value);
        if (prod) updated.unitRate = Number(prod.minSaleRate) || null;
      }
      return updated;
    }));
  };

  const totalAmount = lines.reduce((s, l) => s + (l.unitRate || 0) * (l.quantity || 0), 0);

  const handleSave = () => {
    if (!returnDate) { message.error('Return date is required'); return; }
    if (type === 'SALES_RETURN' && !orderId) { message.error('Select the reference order for sales return'); return; }
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
        supplierName: type === 'PURCHASE_RETURN' ? supplierName.trim() : null,
        returnDate: dayjs(returnDate).format('YYYY-MM-DD'),
        reason: reason.trim() || null,
        items: lines.map(l => ({
          productId: l.productId,
          batchNumber: l.batchNumber.trim() || null,
          quantity: l.quantity,
          unitRate: l.unitRate,
          reason: l.reason.trim() || null,
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {Object.entries(TYPE_CONFIG).map(([key, c]) => (
          <div key={key} onClick={() => setType(key)} style={{
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
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Return Date *</div>
            <DatePicker size="large" style={{ width: '100%', borderRadius: 10 }}
              value={returnDate} onChange={setReturnDate} allowClear={false} />
          </div>

          {type === 'SALES_RETURN' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Reference Order *</div>
              <Select size="large" showSearch optionFilterProp="label"
                placeholder="Select order..." style={{ width: '100%' }}
                value={orderId || undefined} onChange={setOrderId}
                options={orders.map((o: any) => ({ value: o.id, label: `${o.orderNumber} — ${o.customerName || o.customer?.businessName}` }))}
              />
            </div>
          )}

          {type === 'PURCHASE_RETURN' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Supplier Name *</div>
              <Input size="large" style={{ borderRadius: 10 }} placeholder="e.g. Tamil Nadu Traders"
                value={supplierName} onChange={e => setSupplier(e.target.value)} />
            </div>
          )}

          {type === 'DAMAGE' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Reason for Damage</div>
              <Input size="large" style={{ borderRadius: 10 }} placeholder="e.g. Flood, accident, packaging failure"
                value={reason} onChange={e => setReason(e.target.value)} />
            </div>
          )}
        </div>
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
          <Button icon={<PlusOutlined />} onClick={addLine} style={{ borderRadius: 8, fontWeight: 600 }}>
            Add Item
          </Button>
        </div>

        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lines.map((line, idx) => {
            const prod = products.find((p: any) => p.id === line.productId);
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

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0 12px', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 5 }}>Product *</div>
                    <Select size="large" showSearch optionFilterProp="label" style={{ width: '100%' }}
                      placeholder="Select product" value={line.productId || undefined}
                      onChange={v => updateLine(line.id, 'productId', v)}
                      options={products.map((p: any) => ({ value: p.id, label: `${p.name}${p.brand ? ` — ${p.brand}` : ''}` }))}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 5 }}>Batch No.</div>
                    <Input size="large" style={{ borderRadius: 8 }} placeholder="e.g. B001"
                      value={line.batchNumber} onChange={e => updateLine(line.id, 'batchNumber', e.target.value)} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 5 }}>Qty *</div>
                    <InputNumber size="large" style={{ width: '100%' }} min={1} precision={0}
                      value={line.quantity || undefined} onChange={v => updateLine(line.id, 'quantity', v)}
                      addonAfter={prod?.unit || 'Units'} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 5 }}>Rate *</div>
                    <InputNumber size="large" style={{ width: '100%' }} min={0.01} precision={2}
                      prefix="₹" value={line.unitRate || undefined} onChange={v => updateLine(line.id, 'unitRate', v)} />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 5 }}>Reason (optional)</div>
                  <Input size="middle" style={{ borderRadius: 8 }} placeholder="e.g. wrong item, broken seal, expired..."
                    value={line.reason} onChange={e => updateLine(line.id, 'reason', e.target.value)} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Total + Submit */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '18px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Total Return Value</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: cfg.color }}>{fmt(totalAmount)}</div>
          </div>
          <Button type="primary" size="large" onClick={handleSave}
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
        width={460}>
        <div style={{ padding: '12px 0' }}>
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 16 }}>
            {type === 'SALES_RETURN' && 'Stock will be restored. Customer outstanding will be reduced by the return value.'}
            {type === 'PURCHASE_RETURN' && 'Stock will be deducted (FIFO). Supplier return will be recorded.'}
            {type === 'DAMAGE' && 'Stock will be deducted (FIFO). Loss will be recorded in the system.'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {lines.map((l, i) => {
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

/* ── History List ── */
const ReturnHistory: React.FC = () => {
  const { data, isLoading } = useListGoodsReturnsQuery({});
  const returns: any[] = data?.data?.content || data?.data || [];

  if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />;

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      {returns.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
          No return entries yet
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 120px 2fr 1fr 1fr 40px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 20px' }}>
            {['Return No.', 'Type', 'Details', 'Date', 'Amount', ''].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
            ))}
          </div>
          {returns.map((r: any, i: number) => {
            const cfg = TYPE_CONFIG[r.type] || TYPE_CONFIG.DAMAGE;
            return (
              <div key={r.id} style={{
                display: 'grid', gridTemplateColumns: '140px 120px 2fr 1fr 1fr 40px',
                padding: '14px 20px', alignItems: 'center',
                borderBottom: i < returns.length - 1 ? '1px solid #f1f5f9' : 'none',
              }}>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{r.returnNumber}</div>
                <div>
                  <Tag color={r.type === 'SALES_RETURN' ? 'blue' : r.type === 'PURCHASE_RETURN' ? 'purple' : 'red'}
                    style={{ fontWeight: 600, borderRadius: 6 }}>
                    {cfg.label}
                  </Tag>
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>
                    {r.referenceOrderNumber || r.supplierName || 'Damage Entry'}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                    {r.items?.length || 0} item{(r.items?.length || 0) !== 1 ? 's' : ''}
                    {r.reason ? ` · ${r.reason}` : ''}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#64748b' }}>{dayjs(r.returnDate).format('DD MMM YYYY')}</div>
                <div style={{ fontWeight: 800, color: cfg.color, fontSize: 14 }}>{fmt(r.totalAmount)}</div>
                <div><AuditHistoryButton entityType="GOODS_RETURN" entityId={r.id} title={`Audit — ${r.returnNumber}`} /></div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

/* ── Page ── */
const GoodsReturnPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('new');

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
          { key: 'new',     label: <span><PlusOutlined /> New Entry</span>,      children: <NewReturnForm onDone={() => setActiveTab('history')} /> },
          { key: 'history', label: <span><RollbackOutlined /> History</span>,    children: <ReturnHistory /> },
        ]}
      />
    </div>
  );
};

export default GoodsReturnPage;
