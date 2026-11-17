import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Form, Select, Input, DatePicker, InputNumber, Button, Table, message } from 'antd';
import { DollarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useProcessRefundMutation } from '../store/api/goodsReturnApi';
import { SETTLEMENT_OPTIONS, SETTLED_MESSAGE, type SettlementKey } from '../utils/supplierSettlement';

const fmt = (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const round2 = (v: number) => Math.round(v * 100) / 100;

interface Props {
  claim: any | null;
  onClose: () => void;
  onSettled?: () => void;
}

const SettleClaimModal: React.FC<Props> = ({ claim, onClose, onSettled }) => {
  const [form] = Form.useForm();
  const [processRefund, { isLoading }] = useProcessRefundMutation();
  const [acceptedQty, setAcceptedQty] = useState<Record<string, number>>({});
  const settlementMode: SettlementKey | undefined = Form.useWatch('settlementMode', form);
  const acceptedAmount: number | undefined = Form.useWatch('acceptedAmount', form);

  const items: any[] = claim?.items || [];
  const total = Number(claim?.totalAmount || 0);
  const rejected = settlementMode === 'REJECTED';

  useEffect(() => {
    if (!claim) return;
    const qty: Record<string, number> = {};
    (claim.items || []).forEach((it: any) => { qty[it.id] = it.quantity; });
    setAcceptedQty(qty);
    form.setFieldsValue({ refundDate: dayjs(), acceptedAmount: round2(total), settlementMode: undefined });
  }, [claim, form, total]);

  const acceptedValue = useMemo(
    () => round2(items.reduce((s, it) => s + Number(it.unitRate || 0) * (acceptedQty[it.id] ?? it.quantity), 0)),
    [items, acceptedQty],
  );

  const setLineQty = (itemId: string, qty: number) => {
    const next = { ...acceptedQty, [itemId]: qty };
    setAcceptedQty(next);
    const value = round2(items.reduce((s, it) => s + Number(it.unitRate || 0) * (next[it.id] ?? it.quantity), 0));
    form.setFieldsValue({ acceptedAmount: value });
  };

  const credited = rejected ? 0 : Number(acceptedAmount ?? acceptedValue);
  const writtenOff = round2(Math.max(total - credited, 0));

  const close = () => { form.resetFields(); onClose(); };

  const submit = async (values: any) => {
    const partialLines = items.some(it => (acceptedQty[it.id] ?? it.quantity) !== it.quantity);
    const discounted = !rejected && round2(Number(values.acceptedAmount)) !== acceptedValue;
    try {
      await processRefund({
        id: claim.id,
        settlementMode: values.settlementMode,
        paymentMode: values.settlementMode === 'CASH_REFUND' ? values.paymentMode : undefined,
        supplierRefNumber: values.supplierRefNumber?.trim() || undefined,
        replacementExpiryDate: values.settlementMode === 'GOODS_REPLACED' && values.replacementExpiryDate
          ? values.replacementExpiryDate.format('YYYY-MM-DD') : undefined,
        refundDate: values.refundDate.format('YYYY-MM-DD'),
        notes: values.notes,
        acceptedItems: !rejected && partialLines
          ? items.map(it => ({ itemId: it.id, acceptedQty: acceptedQty[it.id] ?? it.quantity }))
          : undefined,
        acceptedAmount: discounted ? round2(Number(values.acceptedAmount)) : undefined,
      }).unwrap();
      message.success(SETTLED_MESSAGE[values.settlementMode as SettlementKey](fmt(credited)));
      close();
      onSettled?.();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to settle claim');
    }
  };

  const lineColumns = [
    {
      title: 'Product',
      key: 'product',
      render: (_: any, it: any) => (
        <div>
          <div style={{ fontWeight: 600 }}>{it.productName}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{it.batchNumber || '—'}</div>
        </div>
      ),
    },
    { title: 'Claimed', dataIndex: 'quantity', width: 80, align: 'right' as const },
    {
      title: 'Accepted',
      key: 'accepted',
      width: 100,
      align: 'right' as const,
      render: (_: any, it: any) => (
        <InputNumber
          size="small" min={0} max={it.quantity} precision={0} style={{ width: 80 }}
          value={acceptedQty[it.id] ?? it.quantity}
          onChange={(v) => setLineQty(it.id, Number(v ?? 0))}
        />
      ),
    },
    {
      title: 'Value',
      key: 'value',
      width: 110,
      align: 'right' as const,
      render: (_: any, it: any) => fmt(Number(it.unitRate || 0) * (acceptedQty[it.id] ?? it.quantity)),
    },
  ];

  return (
    <Modal
      open={!!claim}
      onCancel={close}
      title={
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            <DollarOutlined style={{ marginRight: 6 }} />
            Settle Supplier Claim
          </div>
          {claim && (
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
              {claim.returnNumber} · {claim.supplierName || claim.referencePurchaseSupplierName} · Claimed {fmt(total)}
            </div>
          )}
        </div>
      }
      footer={null}
      width={620}
      centered
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={submit} style={{ marginTop: 16 }}>
        <Form.Item
          name="settlementMode"
          label="How did the supplier settle this?"
          rules={[{ required: true, message: 'Choose how it was settled' }]}
        >
          <Select
            placeholder="Select settlement"
            options={SETTLEMENT_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
          />
        </Form.Item>

        {settlementMode && (
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
            padding: '10px 12px', marginBottom: 16, fontSize: 12, color: '#475569',
          }}>
            {SETTLEMENT_OPTIONS.find(o => o.value === settlementMode)?.hint}
          </div>
        )}

        {settlementMode && !rejected && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
              Accepted by supplier
            </div>
            <Table
              size="small" rowKey="id" pagination={false} dataSource={items} columns={lineColumns}
              style={{ marginBottom: 12 }} scroll={items.length > 6 ? { y: 240 } : undefined}
            />
            <Form.Item
              name="acceptedAmount"
              label="Amount credited / paid by supplier"
              tooltip="Lower it if the supplier settled at a discount. The shortfall is written off."
              rules={[
                { required: true, message: 'Enter the accepted amount' },
                {
                  validator: (_, v) => Number(v) > acceptedValue + 0.001
                    ? Promise.reject(new Error(`Cannot be more than ${fmt(acceptedValue)}`))
                    : Number(v) <= 0
                      ? Promise.reject(new Error('Nothing accepted — choose "Rejected by supplier" instead'))
                      : Promise.resolve(),
                },
              ]}
            >
              <InputNumber prefix="₹" min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </>
        )}

        {settlementMode && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', fontSize: 13,
            border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', marginBottom: 16,
          }}>
            <span>Recovered <strong>{fmt(credited)}</strong></span>
            <span>
              Written off{' '}
              <strong style={{ color: writtenOff > 0 ? '#dc2626' : undefined }}>{fmt(writtenOff)}</strong>
            </span>
          </div>
        )}

        {settlementMode === 'CASH_REFUND' && (
          <Form.Item name="paymentMode" label="Received Via" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'CASH', label: 'Cash' },
                { value: 'UPI', label: 'UPI' },
                { value: 'CHEQUE', label: 'Cheque' },
                { value: 'NEFT', label: 'NEFT / Bank Transfer' },
                { value: 'RTGS', label: 'RTGS' },
              ]}
            />
          </Form.Item>
        )}

        {settlementMode === 'GOODS_REPLACED' && (
          <Form.Item
            name="replacementExpiryDate"
            label="Expiry on the replacement packs"
            extra="Read it off the physical stock — it goes on the new batch."
          >
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
          </Form.Item>
        )}

        {!rejected && (
          <Form.Item name="supplierRefNumber" label="Supplier's Credit Note / Ref No. (optional)">
            <Input placeholder="e.g. CN-2026-001" />
          </Form.Item>
        )}
        <Form.Item name="refundDate" label="Settlement Date" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
        </Form.Item>
        <Form.Item name="notes" label="Notes (optional)">
          <Input placeholder={rejected ? 'e.g. supplier refused — claim filed too late' : 'e.g. collected by driver, bank ref...'} />
        </Form.Item>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <Button onClick={close}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={isLoading} danger={rejected}>
            {rejected ? 'Close as Rejected' : `Confirm Settlement ${fmt(credited)}`}
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default SettleClaimModal;
