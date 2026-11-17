import React, { useMemo, useState } from 'react';
import {
  Table, Button, Card, Tabs, Select, InputNumber, Modal, Form, Input, DatePicker, Tooltip,
  Empty, Row, Col, message,
} from 'antd';
import {
  PrinterOutlined, DownloadOutlined, FileExcelOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import {
  useGetClaimableBatchesQuery, useGetExpiryClaimsQuery, useGetExpiryWriteOffsQuery,
  useCreateExpiryClaimMutation,
} from '../../store/api/goodsReturnApi';
import { hasPermission } from '../../utils/permissions';
import { SETTLEMENT_LABEL, downloadDebitNotePdf, type SettlementKey } from '../../utils/supplierSettlement';
import PageHeader from '../../components/PageHeader';
import DebitNotePrint from '../../components/DebitNotePrint';
import SettleClaimModal from '../../components/SettleClaimModal';
import TableToolbar, { exportToXLSX, type Column } from '../../components/TableToolbar';

const fmt = (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d?: string) => (d ? dayjs(d).format('DD MMM YYYY') : '—');
const NO_SUPPLIER = '__none__';
const RED = '#dc2626';
const AMBER = '#d97706';

const Stat: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <Card size="small" style={{ borderRadius: 8 }}>
    <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 700, color: color || '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
  </Card>
);

// ── Expired stock — pick batches and file them to the supplier ──────────────────
const ExpiredStockTab: React.FC<{ onFiled: () => void }> = ({ onFiled }) => {
  const [days, setDays] = useState(0);
  const [supplier, setSupplier] = useState<string | undefined>();
  const [selected, setSelected] = useState<React.Key[]>([]);
  const [claimQty, setClaimQty] = useState<Record<string, number>>({});
  const [filing, setFiling] = useState(false);
  const [form] = Form.useForm();
  const { data, isLoading, refetch } = useGetClaimableBatchesQuery(days, { refetchOnMountOrArgChange: true });
  const [createClaim, { isLoading: creating }] = useCreateExpiryClaimMutation();
  const canFile = hasPermission('RETURNS_DAMAGE');

  const rows: any[] = data?.data || [];
  const supplierKey = (r: any) => r.supplierName || NO_SUPPLIER;
  const visible = supplier ? rows.filter(r => supplierKey(r) === supplier) : rows;
  const qtyOf = (r: any) => claimQty[r.batchId] ?? r.quantity;

  const supplierOptions = useMemo(() => {
    const totals = new Map<string, number>();
    rows.forEach(r => totals.set(supplierKey(r), (totals.get(supplierKey(r)) || 0) + Number(r.value || 0)));
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ value: k, label: `${k === NO_SUPPLIER ? 'No supplier on record' : k} — ${fmt(v)}` }));
  }, [rows]);

  const expiredValue = rows.filter(r => r.expired).reduce((s, r) => s + Number(r.value || 0), 0);
  const nearValue = rows.filter(r => !r.expired).reduce((s, r) => s + Number(r.value || 0), 0);

  const chosen = rows.filter(r => selected.includes(r.batchId));
  const chosenSuppliers = Array.from(new Set(chosen.map(supplierKey)));
  const mixedSuppliers = chosenSuppliers.length > 1;
  const chosenValue = chosen.reduce((s, r) => s + Number(r.purchaseRate || 0) * qtyOf(r), 0);

  const openFile = () => {
    const only = chosenSuppliers[0];
    form.setFieldsValue({
      supplierName: only && only !== NO_SUPPLIER ? only : undefined,
      claimDate: dayjs(),
      reason: undefined,
    });
    setFiling(true);
  };

  const submit = async (values: any) => {
    try {
      const res = await createClaim({
        supplierName: values.supplierName.trim(),
        claimDate: values.claimDate.format('YYYY-MM-DD'),
        reason: values.reason?.trim() || undefined,
        items: chosen.map(r => ({ batchId: r.batchId, quantity: qtyOf(r) })),
      }).unwrap();
      message.success(`Claim ${res?.data?.returnNumber || ''} filed — ${fmt(chosenValue)}`);
      setFiling(false);
      setSelected([]);
      setClaimQty({});
      refetch();
      onFiled();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to file the claim');
    }
  };

  const columns = [
    {
      title: 'Product',
      key: 'product',
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.productName}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.batchNumber}</div>
        </div>
      ),
    },
    {
      title: 'Supplier',
      key: 'supplier',
      width: 220,
      render: (_: any, r: any) => r.supplierName ? (
        <div>
          <div>{r.supplierName}</div>
          {r.supplierInvoiceNumber && <div style={{ fontSize: 12, color: '#94a3b8' }}>Inv {r.supplierInvoiceNumber}</div>}
        </div>
      ) : <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: 'Expiry',
      key: 'expiry',
      width: 150,
      sorter: (a: any, b: any) => dayjs(a.expiryDate).valueOf() - dayjs(b.expiryDate).valueOf(),
      render: (_: any, r: any) => (
        <div>
          <div>{fmtDate(r.expiryDate)}</div>
          <div style={{ fontSize: 12, color: r.expired ? RED : AMBER }}>
            {r.expired ? `Expired ${Math.abs(r.daysToExpiry)} day${Math.abs(r.daysToExpiry) === 1 ? '' : 's'} ago`
              : r.daysToExpiry === 0 ? 'Expires today' : `Expires in ${r.daysToExpiry} days`}
          </div>
        </div>
      ),
    },
    { title: 'In Stock', dataIndex: 'quantity', width: 90, align: 'right' as const },
    {
      title: 'Claim Qty',
      key: 'claimQty',
      width: 110,
      align: 'right' as const,
      render: (_: any, r: any) => (
        <InputNumber
          size="small" min={1} max={r.quantity} precision={0} style={{ width: 80 }}
          value={qtyOf(r)}
          onChange={(v) => setClaimQty(q => ({ ...q, [r.batchId]: Math.min(Math.max(Number(v || 1), 1), r.quantity) }))}
        />
      ),
    },
    {
      title: 'Rate', dataIndex: 'purchaseRate', width: 110, align: 'right' as const,
      render: (v: number) => fmt(v),
    },
    {
      title: 'Claim Value', key: 'value', width: 130, align: 'right' as const,
      sorter: (a: any, b: any) => a.value - b.value,
      render: (_: any, r: any) => <span style={{ fontWeight: 600 }}>{fmt(Number(r.purchaseRate || 0) * qtyOf(r))}</span>,
    },
  ];

  return (
    <>
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col xs={12} md={6}><Stat label="Expired stock value" value={fmt(expiredValue)} color={expiredValue > 0 ? RED : undefined} /></Col>
        {days > 0 && <Col xs={12} md={6}><Stat label={`Expiring within ${days} days`} value={fmt(nearValue)} color={nearValue > 0 ? AMBER : undefined} /></Col>}
        <Col xs={12} md={6}><Stat label="Batches" value={String(rows.length)} /></Col>
      </Row>

      <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: '12px 16px' }}>
          <Select
            value={days} onChange={(v) => { setDays(v); setSelected([]); }} style={{ width: 260 }}
            options={[
              { value: 0, label: 'Expired only' },
              { value: 30, label: 'Expired + expiring in 30 days' },
              { value: 60, label: 'Expired + expiring in 60 days' },
              { value: 90, label: 'Expired + expiring in 90 days' },
            ]}
          />
          <Select
            allowClear placeholder="All suppliers" value={supplier} style={{ width: 300 }}
            onChange={(v) => { setSupplier(v); setSelected([]); }} options={supplierOptions}
          />
          <div style={{ flex: 1 }} />
          {selected.length > 0 && (
            <span style={{ fontSize: 13, color: mixedSuppliers ? RED : '#475569' }}>
              {mixedSuppliers
                ? 'Selected batches belong to different suppliers — file one supplier at a time'
                : `${selected.length} batch${selected.length > 1 ? 'es' : ''} · ${fmt(chosenValue)}`}
            </span>
          )}
          {canFile && (
            <Button type="primary" disabled={!selected.length || mixedSuppliers} onClick={openFile}>
              File Claim
            </Button>
          )}
        </div>
        <Table
          rowKey="batchId"
          columns={columns}
          dataSource={visible}
          loading={isLoading}
          size="middle"
          rowSelection={canFile ? { selectedRowKeys: selected, onChange: setSelected } : undefined}
          pagination={{ pageSize: 50, showTotal: t => `${t} batch${t !== 1 ? 'es' : ''}` }}
          locale={{ emptyText: <Empty description={days ? 'Nothing expired or expiring in this window' : 'No expired stock'} /> }}
        />
      </Card>

      <Modal
        open={filing}
        onCancel={() => setFiling(false)}
        title="File Expiry Claim"
        footer={null}
        width={460}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={submit} style={{ marginTop: 12 }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 13 }}>
            {chosen.length} batch{chosen.length !== 1 ? 'es' : ''} · {chosen.reduce((s, r) => s + qtyOf(r), 0)} units ·{' '}
            <strong>{fmt(chosenValue)}</strong>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              The stock leaves inventory now. Nothing changes on the supplier's bill until they settle the claim.
            </div>
          </div>
          <Form.Item name="supplierName" label="Supplier" rules={[{ required: true, whitespace: true, message: 'Enter the supplier' }]}>
            <Input placeholder="Supplier the claim goes to" />
          </Form.Item>
          <Form.Item name="claimDate" label="Claim Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
          </Form.Item>
          <Form.Item name="reason" label="Remarks (optional)">
            <Input placeholder="e.g. Expired stock — Oct 2026" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button onClick={() => setFiling(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={creating}>File Claim {fmt(chosenValue)}</Button>
          </div>
        </Form>
      </Modal>
    </>
  );
};

// ── Claims — follow up and settle ───────────────────────────────────────────────
const claimSheetColumns: Column[] = [
  { title: 'Product', key: 'productName' },
  { title: 'HSN', key: 'hsnCode', type: 'text' },
  { title: 'Batch', key: 'batchNumber', type: 'text' },
  { title: 'Expiry Date', key: 'expiryDate', type: 'date' },
  { title: 'Qty', key: 'quantity', type: 'number' },
  { title: 'Rate', key: 'unitRate', type: 'currency' },
  { title: 'GST %', key: 'gstPercent', type: 'percent' },
  { title: 'Taxable', key: 'taxableAmount', type: 'currency' },
  { title: 'GST', key: 'gstAmount', type: 'currency' },
  { title: 'Amount', key: 'amount', type: 'currency' },
];

const ClaimsTab: React.FC = () => {
  const { data, isLoading, refetch } = useGetExpiryClaimsQuery(undefined, { refetchOnMountOrArgChange: true });
  const [status, setStatus] = useState<'ALL' | 'PENDING' | 'PROCESSED'>('ALL');
  const [target, setTarget] = useState<any>(null);
  const [printId, setPrintId] = useState<string | null>(null);
  const canSettle = hasPermission('RETURNS_CREATE');

  const rows: any[] = data?.data || [];
  const visible = status === 'ALL' ? rows : rows.filter(r => r.refundStatus === status);
  const open = rows.filter(r => r.refundStatus === 'PENDING');
  const settled = rows.filter(r => r.refundStatus === 'PROCESSED');
  const openValue = open.reduce((s, r) => s + Number(r.totalAmount || 0), 0);
  const recovered = settled.reduce((s, r) => s + Number(r.refundAmount || 0), 0);
  const writtenOff = settled.reduce((s, r) => s + Number(r.writtenOffAmount || 0), 0);

  const exportSheet = (r: any) => exportToXLSX(
    r.items || [],
    claimSheetColumns,
    `${r.returnNumber}-claim-sheet`,
    'Claim Sheet',
    {
      title: `Expiry Claim ${r.returnNumber}`,
      subtitle: `To ${r.supplierName} · Claim date ${fmtDate(r.returnDate)}`,
      totals: true,
      totalKeys: ['quantity', 'taxableAmount', 'gstAmount', 'amount'],
    },
  );

  const columns = [
    {
      title: 'Claim',
      key: 'claim',
      width: 170,
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 700 }}>{r.returnNumber}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{fmtDate(r.returnDate)}</div>
        </div>
      ),
    },
    { title: 'Supplier', dataIndex: 'supplierName', key: 'supplier' },
    {
      title: 'Batches', key: 'items', width: 90, align: 'right' as const,
      render: (_: any, r: any) => (r.items || []).length,
    },
    {
      title: 'Claimed', dataIndex: 'totalAmount', width: 120, align: 'right' as const,
      render: (v: number) => fmt(v),
    },
    {
      title: 'Recovered', key: 'recovered', width: 120, align: 'right' as const,
      render: (_: any, r: any) => r.refundStatus === 'PROCESSED' ? fmt(r.refundAmount) : <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: 'Written Off', key: 'writtenOff', width: 120, align: 'right' as const,
      render: (_: any, r: any) => Number(r.writtenOffAmount || 0) > 0
        ? <span style={{ color: RED }}>{fmt(r.writtenOffAmount)}</span>
        : <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: 'Status',
      key: 'status',
      width: 170,
      render: (_: any, r: any) => {
        if (r.refundStatus === 'PENDING') {
          const age = dayjs().startOf('day').diff(dayjs(r.returnDate), 'day');
          return (
            <div>
              <div>Open</div>
              <div style={{ fontSize: 12, color: age > 30 ? AMBER : '#94a3b8' }}>{age} day{age === 1 ? '' : 's'} pending</div>
            </div>
          );
        }
        return (
          <div>
            <div style={{ color: r.settlementMode === 'REJECTED' ? RED : undefined }}>
              {SETTLEMENT_LABEL[r.settlementMode as SettlementKey] || 'Settled'}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{fmtDate(r.refundDate)}</div>
          </div>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 170,
      align: 'center' as const,
      render: (_: any, r: any) => (
        <span style={{ display: 'inline-flex', gap: 2 }}>
          <Tooltip title="Print claim note">
            <Button type="text" size="small" icon={<PrinterOutlined />} onClick={() => setPrintId(r.id)} />
          </Tooltip>
          <Tooltip title="Download claim note PDF">
            <Button type="text" size="small" icon={<DownloadOutlined />}
              onClick={() => downloadDebitNotePdf(r.id, r.returnNumber).catch((e) => message.error(e?.message || 'Download failed'))} />
          </Tooltip>
          <Tooltip title="Claim sheet (Excel)">
            <Button type="text" size="small" icon={<FileExcelOutlined />} onClick={() => exportSheet(r)} />
          </Tooltip>
          {r.refundStatus === 'PENDING' && canSettle && (
            <Tooltip title="Record supplier's response">
              <Button type="text" size="small" icon={<CheckCircleOutlined />} onClick={() => setTarget(r)} />
            </Tooltip>
          )}
        </span>
      ),
    },
  ];

  return (
    <>
      <DebitNotePrint returnId={printId} onReady={() => { window.print(); setPrintId(null); }} />
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col xs={12} md={6}><Stat label={`Open claims (${open.length})`} value={fmt(openValue)} /></Col>
        <Col xs={12} md={6}><Stat label="Recovered" value={fmt(recovered)} /></Col>
        <Col xs={12} md={6}><Stat label="Written off" value={fmt(writtenOff)} color={writtenOff > 0 ? RED : undefined} /></Col>
      </Row>
      <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
        <div style={{ padding: '12px 16px' }}>
          <Select
            value={status} onChange={setStatus} style={{ width: 180 }}
            options={[
              { value: 'ALL', label: 'All claims' },
              { value: 'PENDING', label: 'Open' },
              { value: 'PROCESSED', label: 'Settled' },
            ]}
          />
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={visible}
          loading={isLoading}
          size="middle"
          pagination={{ pageSize: 25, showTotal: t => `${t} claim${t !== 1 ? 's' : ''}` }}
          locale={{ emptyText: <Empty description="No expiry claims filed yet" /> }}
        />
      </Card>
      <SettleClaimModal claim={target} onClose={() => setTarget(null)} onSettled={refetch} />
    </>
  );
};

// ── Expiry loss — what the suppliers refused ────────────────────────────────────
const fyStart = () => {
  const now = dayjs();
  return (now.month() >= 3 ? now : now.subtract(1, 'year')).month(3).date(1);
};

const lossExportColumns: Column[] = [
  { title: 'Claim', key: 'returnNumber', type: 'text' },
  { title: 'Claim Date', key: 'returnDate', type: 'date' },
  { title: 'Settled On', key: 'refundDate', type: 'date' },
  { title: 'Supplier', key: 'supplierName' },
  { title: 'Settlement', key: 'settlementMode', transform: (v: any) => SETTLEMENT_LABEL[v as SettlementKey] || v || '' },
  { title: 'Claimed', key: 'totalAmount', type: 'currency' },
  { title: 'Recovered', key: 'refundAmount', type: 'currency' },
  { title: 'Written Off', key: 'writtenOffAmount', type: 'currency' },
];

const LossTab: React.FC = () => {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([fyStart(), dayjs()]);
  const from = range[0].format('YYYY-MM-DD');
  const to = range[1].format('YYYY-MM-DD');
  const { data, isLoading } = useGetExpiryWriteOffsQuery({ from, to }, { refetchOnMountOrArgChange: true });
  const rows: any[] = data?.data || [];
  const total = rows.reduce((s, r) => s + Number(r.writtenOffAmount || 0), 0);

  const bySupplier = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(r => m.set(r.supplierName || '—', (m.get(r.supplierName || '—') || 0) + Number(r.writtenOffAmount || 0)));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const columns = [
    {
      title: 'Claim', key: 'claim', width: 170,
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 700 }}>{r.returnNumber}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Filed {fmtDate(r.returnDate)}</div>
        </div>
      ),
    },
    { title: 'Supplier', dataIndex: 'supplierName', key: 'supplier' },
    {
      title: 'Settled', key: 'settled', width: 160,
      render: (_: any, r: any) => (
        <div>
          <div>{SETTLEMENT_LABEL[r.settlementMode as SettlementKey] || 'Settled'}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{fmtDate(r.refundDate)}</div>
        </div>
      ),
    },
    { title: 'Claimed', dataIndex: 'totalAmount', width: 120, align: 'right' as const, render: (v: number) => fmt(v) },
    { title: 'Recovered', dataIndex: 'refundAmount', width: 120, align: 'right' as const, render: (v: number) => fmt(v) },
    {
      title: 'Written Off', dataIndex: 'writtenOffAmount', width: 130, align: 'right' as const,
      render: (v: number) => <span style={{ color: RED, fontWeight: 600 }}>{fmt(v)}</span>,
    },
  ];

  return (
    <>
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col xs={12} md={6}><Stat label="Written off in period" value={fmt(total)} color={total > 0 ? RED : undefined} /></Col>
        {bySupplier.slice(0, 3).map(([name, v]) => (
          <Col xs={12} md={6} key={name}><Stat label={name} value={fmt(v)} /></Col>
        ))}
      </Row>
      <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
        <div style={{ padding: '12px 16px 0' }}>
          <DatePicker.RangePicker
            value={range} format="DD MMM YYYY" allowClear={false}
            onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])}
          />
        </div>
        <TableToolbar
          total={rows.length}
          label="claims"
          data={rows}
          columns={lossExportColumns}
          exportFilename={`expiry-loss-${from}-to-${to}`}
          exportFormat="excel"
          sheetName="Expiry Loss"
          exportTitle="Expiry Loss"
          exportSubtitle={`${fmtDate(from)} to ${fmtDate(to)}`}
          exportTotals
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={isLoading}
          size="middle"
          pagination={{ pageSize: 25 }}
          locale={{ emptyText: <Empty description="No expiry losses in this period" /> }}
        />
      </Card>
    </>
  );
};

const ExpiryClaimsPage: React.FC = () => {
  const [tab, setTab] = useState('stock');
  return (
    <div>
      <PageHeader
        title="Expiry Claims"
        subtitle="Claim expired stock back from suppliers, record what they accept, and track the loss"
      />
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'stock', label: 'Expired Stock', children: <ExpiredStockTab onFiled={() => setTab('claims')} /> },
          { key: 'claims', label: 'Claims', children: <ClaimsTab /> },
          { key: 'loss', label: 'Expiry Loss', children: <LossTab /> },
        ]}
      />
    </div>
  );
};

export default ExpiryClaimsPage;
