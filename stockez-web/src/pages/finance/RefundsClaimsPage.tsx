import React, { useState } from 'react';
import {
  Table, Button, Card, message, Tag, Tabs, Badge, Empty,
  Modal, Select, Form, Input, DatePicker, Tooltip,
} from 'antd';
import {
  RollbackOutlined, ShopOutlined, CheckCircleOutlined, DollarOutlined, PrinterOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetCustomerRefundsQuery, useGetSupplierClaimsQuery, useProcessRefundMutation,
  useGetPendingRefundsQuery,
} from '../../store/api/goodsReturnApi';
import { hasPermission } from '../../utils/permissions';
import {
  SETTLEMENT_OPTIONS, SETTLEMENT_LABEL, SETTLED_MESSAGE, downloadDebitNotePdf, type SettlementKey,
} from '../../utils/supplierSettlement';
import PageHeader from '../../components/PageHeader';
import DebitNotePrint from '../../components/DebitNotePrint';

const fmt = (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

// ── Customer Refunds — pending payouts + processed tracking view ──
const CustomerRefundsTab: React.FC = () => {
  const { data, isLoading } = useGetCustomerRefundsQuery();
  const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = useGetPendingRefundsQuery();
  const [processRefund, { isLoading: processing }] = useProcessRefundMutation();
  const [target, setTarget] = useState<any>(null);
  const [form] = Form.useForm();
  const canProcess = hasPermission('RETURNS_CREATE');

  const rows: any[] = data?.data || [];
  // Pending customer refunds (excess on old-stock returns, cancelled paid orders) — money still to pay out.
  const pending: any[] = (pendingData?.data || []).filter(
    (r: any) => r.type === 'SALES_RETURN' || r.type === 'OLD_STOCK_RETURN'
  );
  const totalRefunded = rows.reduce((s, r) => s + Number(r.refundAmount || 0), 0);
  const totalPending = pending.reduce((s, r) => s + Number(r.refundAmount || 0), 0);

  const partyName = (r: any) => r.customerName || r.referenceOrderCustomerName || '—';
  const partyRef = (r: any) =>
    r.referenceOrderNumber ? `#${r.referenceOrderNumber}` : (r.type === 'OLD_STOCK_RETURN' ? 'Old goods · no order' : '');

  const handlePay = async (values: any) => {
    try {
      await processRefund({
        id: target.id,
        paymentMode: values.paymentMode,
        refundDate: values.refundDate.format('YYYY-MM-DD'),
        notes: values.notes,
      }).unwrap();
      message.success(`Refund of ${fmt(target.refundAmount)} paid to ${partyName(target)}`);
      setTarget(null);
      form.resetFields();
      refetchPending();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to process refund');
    }
  };

  const customerCell = (r: any) => (
    <div>
      <div style={{ fontWeight: 600, fontSize: 13 }}>{partyName(r)}</div>
      <div style={{ fontSize: 11, color: r.referenceOrderNumber ? '#2563eb' : '#94a3b8' }}>{partyRef(r)}</div>
    </div>
  );

  const pendingColumns = [
    { title: 'Return', key: 'return', render: (_: any, r: any) => (
      <div>
        <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.returnNumber}</div>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>{dayjs(r.returnDate).format('DD MMM YYYY')}</div>
      </div>
    ) },
    { title: 'Customer', key: 'cust', render: (_: any, r: any) => customerCell(r) },
    { title: 'Refund Due', dataIndex: 'refundAmount', width: 140, align: 'right' as const,
      render: (v: number) => <span style={{ fontWeight: 800, color: '#dc2626' }}>{fmt(v)}</span> },
    { title: 'Action', key: 'action', width: 170, render: (_: any, r: any) => (
      canProcess ? (
        <Button type="primary" size="small" icon={<DollarOutlined />}
          onClick={() => { setTarget(r); form.setFieldsValue({ refundDate: dayjs(), paymentMode: 'CASH' }); }}
          style={{ background: '#dc2626', border: 'none', borderRadius: 6, fontWeight: 600 }}>
          Process Refund
        </Button>
      ) : null
    ) },
  ];

  const columns = [
    { title: 'Return', key: 'return', render: (_: any, r: any) => (
      <div>
        <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.returnNumber}</div>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>{dayjs(r.returnDate).format('DD MMM YYYY')}</div>
      </div>
    ) },
    { title: 'Customer / Order', key: 'order', render: (_: any, r: any) => customerCell(r) },
    { title: 'Return Value', dataIndex: 'totalAmount', width: 130, align: 'right' as const,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{fmt(v)}</span> },
    { title: 'Refunded', dataIndex: 'refundAmount', width: 130, align: 'right' as const,
      render: (v: number) => <span style={{ fontWeight: 800, color: '#dc2626' }}>{fmt(v)}</span> },
    { title: 'Method', dataIndex: 'refundMode', width: 90, render: (v: string) => v || 'CASH' },
    { title: 'Refund Date', dataIndex: 'refundDate', width: 130, render: (v: string) => v ? dayjs(v).format('DD MMM YYYY') : '—' },
    { title: 'Status', key: 'status', width: 110, render: () => <Badge status="error" text="Refunded" /> },
  ];

  return (
    <>
      {pending.length > 0 && (
        <>
          <Card style={{ borderRadius: 12, marginBottom: 14, border: '1px solid #fecaca' }} styles={{ body: { padding: '14px 18px' } }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>Pending Customer Refunds — money to pay out</div>
            <div style={{ fontWeight: 800, fontSize: 20, color: '#dc2626' }}>{fmt(totalPending)}</div>
          </Card>
          <Card style={{ borderRadius: 12, marginBottom: 18 }} styles={{ body: { padding: 0 } }}>
            <Table columns={pendingColumns} dataSource={pending} rowKey="id" loading={pendingLoading}
              size="middle" pagination={false} />
          </Card>
        </>
      )}

      {rows.length > 0 && (
        <Card style={{ borderRadius: 12, marginBottom: 14 }} styles={{ body: { padding: '14px 18px' } }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>Total Refunded to Customers</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#dc2626' }}>{fmt(totalRefunded)}</div>
        </Card>
      )}
      <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={rows}
          rowKey="id"
          loading={isLoading}
          size="middle"
          pagination={{ pageSize: 25, showTotal: t => `${t} refund${t !== 1 ? 's' : ''}` }}
          locale={{ emptyText: <Empty description="No customer refunds yet" /> }}
        />
      </Card>

      <Modal
        open={!!target}
        onCancel={() => { setTarget(null); form.resetFields(); }}
        footer={null}
        title={<span style={{ fontWeight: 700, color: '#dc2626' }}><DollarOutlined /> Process Refund — {target?.returnNumber}</span>}
        width={440}
        destroyOnClose
      >
        {target && (
          <Form form={form} layout="vertical" onFinish={handlePay} style={{ marginTop: 12 }}>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>Refund due to customer</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#dc2626' }}>{fmt(target.refundAmount)}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{partyName(target)}</div>
            </div>
            <Form.Item name="paymentMode" label="Refund Mode" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'CASH', label: 'Cash' },
                  { value: 'UPI', label: 'UPI' },
                  { value: 'CHEQUE', label: 'Cheque' },
                  { value: 'NEFT', label: 'NEFT / Bank Transfer' },
                  { value: 'CREDIT', label: 'Credit Note' },
                ]}
              />
            </Form.Item>
            <Form.Item name="refundDate" label="Refund Date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
            <Form.Item name="notes" label="Notes (optional)">
              <Input placeholder="e.g. paid in cash, bank ref..." />
            </Form.Item>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button onClick={() => { setTarget(null); form.resetFields(); }}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={processing}
                style={{ background: '#dc2626', border: 'none', fontWeight: 700 }}>
                Confirm Refund {fmt(target.refundAmount || 0)}
              </Button>
            </div>
          </Form>
        )}
      </Modal>
    </>
  );
};

// ── Supplier Claims — money to recover from suppliers on purchase returns ──
const SupplierClaimsTab: React.FC = () => {
  const { data, isLoading, refetch } = useGetSupplierClaimsQuery();
  const [processRefund, { isLoading: processing }] = useProcessRefundMutation();
  const [target, setTarget] = useState<any>(null);
  const [printId, setPrintId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const canProcess = hasPermission('RETURNS_CREATE');

  const rows: any[] = data?.data || [];
  const pending = rows.filter((r) => r.refundStatus === 'PENDING');
  const totalPending = pending.reduce((s, r) => s + Number(r.refundAmount || 0), 0);
  const settlementMode = Form.useWatch('settlementMode', form);

  const handleReceive = async (values: any) => {
    try {
      await processRefund({
        id: target.id,
        settlementMode: values.settlementMode,
        paymentMode: values.settlementMode === 'CASH_REFUND' ? values.paymentMode : undefined,
        supplierRefNumber: values.supplierRefNumber?.trim() || undefined,
        replacementExpiryDate: values.settlementMode === 'GOODS_REPLACED' && values.replacementExpiryDate
          ? values.replacementExpiryDate.format('YYYY-MM-DD') : undefined,
        refundDate: values.refundDate.format('YYYY-MM-DD'),
        notes: values.notes,
      }).unwrap();
      message.success(SETTLED_MESSAGE[values.settlementMode as SettlementKey](fmt(target.refundAmount)));
      setTarget(null);
      form.resetFields();
      refetch();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to settle claim');
    }
  };

  const columns = [
    {
      title: 'Return',
      key: 'return',
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.returnNumber}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{dayjs(r.returnDate).format('DD MMM YYYY')}</div>
        </div>
      ),
    },
    {
      title: 'Supplier',
      key: 'supplier',
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            {r.supplierName || r.referencePurchaseSupplierName || '—'}
          </div>
          {r.referencePurchaseEntryNumber && (
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.referencePurchaseEntryNumber}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Claim Amount',
      dataIndex: 'refundAmount',
      width: 140,
      align: 'right' as const,
      render: (v: number) => <span style={{ fontWeight: 800, color: '#16a34a' }}>{fmt(v)}</span>,
    },
    {
      title: 'Settled As',
      key: 'status',
      width: 210,
      render: (_: any, r: any) => {
        if (r.refundStatus !== 'PROCESSED') {
          return (
            <div>
              <Badge status="warning" text="Open" />
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Reducing their outstanding</div>
            </div>
          );
        }
        const label = SETTLEMENT_LABEL[r.settlementMode as SettlementKey] || r.refundMode || 'Settled';
        return (
          <div>
            <Badge status="success" text={label} />
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              {r.refundDate ? dayjs(r.refundDate).format('DD MMM YYYY') : ''}
              {r.supplierRefNumber ? ` · ${r.supplierRefNumber}` : ''}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Payable',
      key: 'payable',
      width: 130,
      render: (_: any, r: any) => (
        <span style={{ fontSize: 12, color: r.reducesPayable ? '#16a34a' : '#94a3b8' }}>
          {r.reducesPayable ? 'Reduced' : 'Bill stands'}
        </span>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 210,
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Tooltip title="Print debit note">
            <Button size="small" icon={<PrinterOutlined />} style={{ borderRadius: 6 }}
              onClick={() => setPrintId(r.id)} />
          </Tooltip>
          <Tooltip title="Download debit note PDF">
            <Button size="small" icon={<DownloadOutlined />} style={{ borderRadius: 6 }}
              onClick={async () => {
                try {
                  await downloadDebitNotePdf(r.id, r.returnNumber);
                } catch (e: any) {
                  message.error(e?.message || 'Could not download the debit note');
                }
              }} />
          </Tooltip>
          {r.refundStatus === 'PENDING' && canProcess && (
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => { setTarget(r); form.setFieldsValue({ refundDate: dayjs() }); }}
              style={{ background: '#16a34a', border: 'none', borderRadius: 6, fontWeight: 600 }}
            >
              Settle
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <DebitNotePrint
        returnId={printId}
        onReady={() => { window.print(); setPrintId(null); }}
      />
      {pending.length > 0 && (
        <Card style={{ borderRadius: 12, marginBottom: 14, border: '1px solid #bbf7d0' }} styles={{ body: { padding: '14px 18px' } }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            Open Claims — knocked off what we owe these suppliers
          </div>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#16a34a' }}>{fmt(totalPending)}</div>
        </Card>
      )}
      <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={rows}
          rowKey="id"
          loading={isLoading}
          size="middle"
          pagination={{ pageSize: 25, showTotal: t => `${t} claim${t !== 1 ? 's' : ''}` }}
          locale={{ emptyText: <Empty description="No supplier claims" /> }}
        />
      </Card>

      <Modal
        open={!!target}
        onCancel={() => { setTarget(null); form.resetFields(); }}
        title={
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              <DollarOutlined style={{ color: '#16a34a', marginRight: 6 }} />
              Settle Supplier Claim
            </div>
            {target && (
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
                {target.returnNumber} · {target.supplierName || target.referencePurchaseSupplierName} ·{' '}
                <span style={{ color: '#16a34a', fontWeight: 700 }}>{fmt(target?.refundAmount)}</span>
              </div>
            )}
          </div>
        }
        footer={null}
        width={420}
        centered
      >
        <Form form={form} layout="vertical" onFinish={handleReceive} style={{ marginTop: 16 }}>
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

          <Form.Item name="supplierRefNumber" label="Supplier's Credit Note / Ref No. (optional)">
            <Input placeholder="e.g. CN-2026-001" />
          </Form.Item>
          <Form.Item name="refundDate" label="Settlement Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
          </Form.Item>
          <Form.Item name="notes" label="Notes (optional)">
            <Input placeholder="e.g. collected by driver, bank ref..." />
          </Form.Item>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button onClick={() => { setTarget(null); form.resetFields(); }}>Cancel</Button>
            <Button
              type="primary" htmlType="submit" loading={processing}
              style={{ background: '#16a34a', border: 'none', fontWeight: 700 }}
            >
              Confirm Settlement {fmt(target?.refundAmount || 0)}
            </Button>
          </div>
        </Form>
      </Modal>
    </>
  );
};

const RefundsClaimsPage: React.FC = () => {
  const { data: claimsData } = useGetSupplierClaimsQuery();
  const pendingClaims = (claimsData?.data || []).filter((r: any) => r.refundStatus === 'PENDING').length;

  const tabs = [
    {
      key: 'refunds',
      label: <span><RollbackOutlined /> Customer Refunds</span>,
      children: <CustomerRefundsTab />,
    },
    {
      key: 'claims',
      label: (
        <span>
          <ShopOutlined /> Supplier Claims
          {pendingClaims > 0 && <Badge count={pendingClaims} size="small" style={{ marginLeft: 6, background: '#16a34a' }} />}
        </span>
      ),
      children: <SupplierClaimsTab />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Refunds & Claims"
        subtitle="Track customer cash refunds and recover money owed by suppliers on purchase returns"
        count={pendingClaims}
        countLabel={pendingClaims > 0 ? `${pendingClaims} claim${pendingClaims > 1 ? 's' : ''} pending` : 'all clear'}
      />
      <Tabs items={tabs} defaultActiveKey="refunds" style={{ marginTop: 8 }} />
    </div>
  );
};

export default RefundsClaimsPage;
