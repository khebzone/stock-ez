import React, { useState } from 'react';
import { Table, Tabs, Tag, Button, Modal, Form, DatePicker, Input, InputNumber, message, Skeleton, Grid } from 'antd';
import { BankOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetInstrumentsQuery,
  useDepositInstrumentMutation,
  useRealiseInstrumentMutation,
  useBounceInstrumentMutation,
} from '../../store/api/paymentApi';
import { formatINR } from '../../utils/format';
import PageHeader from '../../components/PageHeader';
import { hasPermission } from '../../utils/permissions';

const { useBreakpoint } = Grid;

const MODE_COLOR: Record<string, string> = {
  CHEQUE: '#d97706', NEFT: '#0891b2', RTGS: '#2563eb',
};
const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING:   { label: 'In Hand',        color: 'gold' },
  DEPOSITED: { label: 'Under Clearing', color: 'blue' },
  REALISED:  { label: 'Realised',       color: 'green' },
  BOUNCED:   { label: 'Bounced',        color: 'red' },
};

const fmtDate = (d?: string) => (d ? dayjs(d).format('DD MMM YYYY') : '—');

const BankClearancePage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const { data, isLoading } = useGetInstrumentsQuery();
  const [deposit, { isLoading: depositing }] = useDepositInstrumentMutation();
  const [realise, { isLoading: realising }]  = useRealiseInstrumentMutation();
  const [bounce,  { isLoading: bouncing }]   = useBounceInstrumentMutation();

  const all: any[] = data?.data || [];
  const pending   = all.filter(p => p.status === 'PENDING');
  const deposited = all.filter(p => p.status === 'DEPOSITED');
  const realised  = all.filter(p => p.status === 'REALISED');
  const bounced   = all.filter(p => p.status === 'BOUNCED');

  const [modal, setModal] = useState<null | { type: 'deposit' | 'realise' | 'bounce'; row: any }>(null);
  const [form] = Form.useForm();

  const openModal = (type: 'deposit' | 'realise' | 'bounce', row: any) => {
    form.resetFields();
    form.setFieldsValue({
      depositDate: dayjs(),
      realisedDate: dayjs(),
    });
    setModal({ type, row });
  };

  const handleSubmit = async () => {
    if (!modal) return;
    const v = await form.validateFields().catch(() => null);
    if (!v) return;
    const id = modal.row.id;
    try {
      if (modal.type === 'deposit') {
        await deposit({ id, depositDate: v.depositDate?.format('YYYY-MM-DD'), depositBank: v.depositBank }).unwrap();
        message.success('Marked as deposited');
      } else if (modal.type === 'realise') {
        await realise({ id, realisedDate: v.realisedDate?.format('YYYY-MM-DD') }).unwrap();
        message.success('Realised — customer balance updated');
      } else {
        await bounce({ id, bounceReason: v.bounceReason, bankCharges: v.bankCharges || undefined }).unwrap();
        message.success('Marked as bounced');
      }
      setModal(null);
    } catch (err: any) {
      message.error(err?.data?.message || 'Action failed');
    }
  };

  const instrumentCol = {
    title: 'Instrument', key: 'instrument',
    render: (_: any, r: any) => (
      <div>
        <div style={{ fontWeight: 600 }}>
          <Tag color={MODE_COLOR[r.paymentMode] ? undefined : 'default'} style={{ color: MODE_COLOR[r.paymentMode], borderColor: MODE_COLOR[r.paymentMode], background: `${MODE_COLOR[r.paymentMode]}10` }}>
            {r.paymentMode}
          </Tag>
          {r.referenceNumber}
        </div>
        {r.draweeBank && <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.draweeBank}</div>}
      </div>
    ),
  };
  const customerCol = { title: 'Customer', dataIndex: 'customerName', key: 'customerName' };
  const amountCol = {
    title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right' as const,
    render: (v: number) => <span style={{ fontWeight: 700 }}>{formatINR(v)}</span>,
  };
  const collectedByCol = {
    title: 'Collected By', key: 'collectedBy',
    render: (_: any, r: any) => r.collectedBy?.fullName || '—',
  };

  const pendingCols = [
    instrumentCol, customerCol, amountCol,
    { title: 'Instrument Date', key: 'instrumentDate', render: (_: any, r: any) => fmtDate(r.instrumentDate) },
    { title: 'Collected', key: 'collectionDate', render: (_: any, r: any) => fmtDate(r.collectionDate) },
    collectedByCol,
    {
      title: 'Action', key: 'action', align: 'right' as const,
      render: (_: any, r: any) => hasPermission('BANK_CLEARANCE_UPDATE') ? (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button size="small" type="primary" icon={<BankOutlined />} onClick={() => openModal('deposit', r)}>Deposit</Button>
          <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => openModal('bounce', r)}>Bounce</Button>
        </div>
      ) : null,
    },
  ];

  const depositedCols = [
    instrumentCol, customerCol, amountCol,
    { title: 'Deposited', key: 'depositDate', render: (_: any, r: any) => fmtDate(r.depositDate) },
    { title: 'Bank', dataIndex: 'depositBank', key: 'depositBank', render: (v: string) => v || '—' },
    collectedByCol,
    {
      title: 'Action', key: 'action', align: 'right' as const,
      render: (_: any, r: any) => hasPermission('BANK_CLEARANCE_UPDATE') ? (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button size="small" type="primary" icon={<CheckCircleOutlined />} style={{ background: '#059669', border: 'none' }} onClick={() => openModal('realise', r)}>Realised</Button>
          <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => openModal('bounce', r)}>Bounce</Button>
        </div>
      ) : null,
    },
  ];

  const realisedCols = [
    instrumentCol, customerCol, amountCol,
    { title: 'Realised On', key: 'realisedDate', render: (_: any, r: any) => fmtDate(r.realisedDate) },
    { title: 'Bank', dataIndex: 'depositBank', key: 'depositBank', render: (v: string) => v || '—' },
    collectedByCol,
  ];

  const bouncedCols = [
    instrumentCol, customerCol, amountCol,
    { title: 'Reason', dataIndex: 'bounceReason', key: 'bounceReason' },
    { title: 'Bank Charges', dataIndex: 'bankCharges', key: 'bankCharges', align: 'right' as const, render: (v: number) => (v ? formatINR(v) : '—') },
    collectedByCol,
  ];

  const sum = (rows: any[]) => rows.reduce((s, r) => s + Number(r.amount || 0), 0);

  const Card = ({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) => (
    <div style={{ flex: 1, minWidth: 150, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 18px' }}>
      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{sub}</div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Bank Clearance" subtitle="Cheques & bank transfers awaiting realisation" />

      {isLoading ? <Skeleton active paragraph={{ rows: 2 }} /> : (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <Card label="In Hand"        value={formatINR(sum(pending))}   sub={`${pending.length} instrument(s)`}   color="#d97706" />
          <Card label="Under Clearing" value={formatINR(sum(deposited))} sub={`${deposited.length} instrument(s)`} color="#0891b2" />
          <Card label="Realised"       value={formatINR(sum(realised))}  sub={`${realised.length} instrument(s)`}  color="#059669" />
          <Card label="Bounced"        value={formatINR(sum(bounced))}   sub={`${bounced.length} instrument(s)`}   color="#dc2626" />
        </div>
      )}

      <Tabs
        defaultActiveKey="pending"
        items={[
          { key: 'pending',   label: `In Hand (${pending.length})`,        children: <Table rowKey="id" loading={isLoading} columns={pendingCols}   dataSource={pending}   size="middle" scroll={{ x: isMobile ? 800 : undefined }} locale={{ emptyText: 'No cheques in hand' }} pagination={false} /> },
          { key: 'deposited', label: `Under Clearing (${deposited.length})`, children: <Table rowKey="id" loading={isLoading} columns={depositedCols} dataSource={deposited} size="middle" scroll={{ x: isMobile ? 800 : undefined }} locale={{ emptyText: 'Nothing under clearing' }} pagination={false} /> },
          { key: 'realised',  label: `Realised (${realised.length})`,       children: <Table rowKey="id" loading={isLoading} columns={realisedCols}  dataSource={realised}  size="middle" scroll={{ x: isMobile ? 800 : undefined }} locale={{ emptyText: 'No realised instruments' }} pagination={{ pageSize: 20 }} /> },
          { key: 'bounced',   label: `Bounced (${bounced.length})`,         children: <Table rowKey="id" loading={isLoading} columns={bouncedCols}   dataSource={bounced}   size="middle" scroll={{ x: isMobile ? 800 : undefined }} locale={{ emptyText: 'No bounced instruments' }} pagination={false} /> },
        ]}
      />

      <Modal
        open={!!modal}
        title={modal?.type === 'deposit' ? 'Deposit to Bank' : modal?.type === 'realise' ? 'Mark as Realised' : 'Mark as Bounced'}
        onCancel={() => setModal(null)}
        onOk={handleSubmit}
        confirmLoading={depositing || realising || bouncing}
        okText={modal?.type === 'bounce' ? 'Confirm Bounce' : 'Confirm'}
        okButtonProps={modal?.type === 'bounce' ? { danger: true } : undefined}
        destroyOnClose
      >
        {modal && (
          <div style={{ marginBottom: 12, fontSize: 13, color: '#475569' }}>
            <b>{modal.row.paymentMode}</b> {modal.row.referenceNumber} · {modal.row.customerName} · <b>{formatINR(modal.row.amount)}</b>
          </div>
        )}
        <Form form={form} layout="vertical">
          {modal?.type === 'deposit' && (
            <>
              <Form.Item name="depositDate" label="Deposit Date" rules={[{ required: true, message: 'Select deposit date' }]}>
                <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="depositBank" label="Deposited To (Bank Account)">
                <Input placeholder="e.g. HDFC Current A/c" />
              </Form.Item>
            </>
          )}
          {modal?.type === 'realise' && (
            <>
              <Form.Item name="realisedDate" label="Realised Date" rules={[{ required: true, message: 'Select realised date' }]}>
                <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
              </Form.Item>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                This reduces the customer's outstanding balance by {modal && formatINR(modal.row.amount)}.
              </div>
            </>
          )}
          {modal?.type === 'bounce' && (
            <>
              <Form.Item name="bounceReason" label="Bounce Reason" rules={[{ required: true, message: 'Enter reason' }]}>
                <Input placeholder="e.g. Insufficient funds" />
              </Form.Item>
              <Form.Item name="bankCharges" label="Bank Charges (₹)">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="Penalty debited by bank, if any" />
              </Form.Item>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                The customer's balance stays due (it was never reduced).
              </div>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default BankClearancePage;
