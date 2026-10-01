import React, { useState } from 'react';
import { Table, DatePicker, Button, Space, Tabs, Alert, Tag, Typography } from 'antd';
import { FileExcelOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { noFutureDates } from '../../utils/date';
import { exportToXLSX } from '../../components/TableToolbar';
import { useGetGstr1Query } from '../../store/api/reportApi';

/**
 * GSTR-1 — the monthly outward supplies return.
 *
 * Sales to GST-registered shops go invoice-by-invoice (Table 4) so the buyer can claim input
 * credit; sales to unregistered shops collapse into one figure per tax rate (Table 7). The HSN
 * summary (Table 12) is mandatory, and verified sales returns become credit notes (Table 9B).
 */

const { RangePicker } = DatePicker;
const { Text } = Typography;

const fmt = (v: any) =>
  `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (v: any) => `${Number(v || 0)}%`;
const date = (v?: string) => (v ? dayjs(v).format('DD MMM YYYY') : '—');

const PROBLEM_LABEL: Record<string, string> = {
  MALFORMED_GSTIN: 'Invalid GSTIN',
  MISSING_HSN: 'Missing HSN code',
  INTER_STATE_B2B: 'Inter-state sale',
  INVOICED_NOT_DELIVERED: 'Billed, not delivered',
};

const Gstr1Report: React.FC = () => {
  const lastMonth = dayjs().subtract(1, 'month');
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    lastMonth.startOf('month'), lastMonth.endOf('month'),
  ]);
  const [activeFrom, setFrom] = useState(lastMonth.startOf('month').format('YYYY-MM-DD'));
  const [activeTo, setTo] = useState(lastMonth.endOf('month').format('YYYY-MM-DD'));

  const { data, isLoading, isFetching } = useGetGstr1Query({ from: activeFrom, to: activeTo });
  const r = data?.data || {};
  const totals = r.totals || {};
  const quality = r.dataQuality || {};

  const b2b: any[] = r.b2b || [];
  const b2cs: any[] = r.b2cs || [];
  const hsn: any[] = r.hsn || [];
  const creditNotes: any[] = r.creditNotes || [];
  const problems: any[] = quality.problems || [];

  const apply = () => { setFrom(range[0].format('YYYY-MM-DD')); setTo(range[1].format('YYYY-MM-DD')); };
  const period = `${dayjs(activeFrom).format('DD MMM YYYY')} to ${dayjs(activeTo).format('DD MMM YYYY')}`;
  const fileTag = `${activeFrom}-to-${activeTo}`;
  const subtitle = (extra: string) => `${period}  ·  GSTIN ${r.companyGstin || '—'}  ·  ${extra}`;

  // ── B2B (Table 4) ──
  const b2bColumns = [
    { title: 'GSTIN', dataIndex: 'gstin', width: 160 },
    { title: 'Customer', dataIndex: 'customerName', ellipsis: true },
    { title: 'Invoice No', dataIndex: 'invoiceNo', width: 135 },
    { title: 'Invoice Date', dataIndex: 'invoiceDate', width: 115, render: date },
    { title: 'Invoice Value', dataIndex: 'invoiceValue', width: 120, align: 'right' as const, render: fmt },
    { title: 'Place of Supply', dataIndex: 'placeOfSupply', width: 115, align: 'center' as const,
      render: (v: string, row: any) => (
        row.interState ? <Tag color="red" style={{ borderRadius: 4 }}>{v}</Tag> : (v || '—')
      ) },
    { title: 'Rate', dataIndex: 'rate', width: 70, align: 'right' as const, render: pct },
    { title: 'Taxable Value', dataIndex: 'taxableValue', width: 120, align: 'right' as const, render: fmt },
    { title: 'CGST', dataIndex: 'cgst', width: 100, align: 'right' as const, render: fmt },
    { title: 'SGST', dataIndex: 'sgst', width: 100, align: 'right' as const, render: fmt },
  ];

  const exportB2b = () => exportToXLSX(b2b, [
    { title: 'GSTIN/UIN of Recipient', key: 'gstin' },
    { title: 'Receiver Name', key: 'customerName' },
    { title: 'Invoice Number', key: 'invoiceNo' },
    { title: 'Invoice Date', key: 'invoiceDate', type: 'date' },
    { title: 'Invoice Value', key: 'invoiceValue', type: 'currency' },
    { title: 'Place Of Supply', key: 'placeOfSupply' },
    { title: 'Reverse Charge', key: 'reverseCharge' },
    { title: 'Rate', key: 'rate', type: 'percent' },
    { title: 'Taxable Value', key: 'taxableValue', type: 'currency' },
    { title: 'Central Tax', key: 'cgst', type: 'currency' },
    { title: 'State/UT Tax', key: 'sgst', type: 'currency' },
  ], `gstr1-b2b-${fileTag}`, 'B2B', {
    title: 'GSTR-1 · Table 4 — B2B Supplies (registered buyers)',
    subtitle: subtitle(`${r.b2bInvoiceCount || 0} invoices`),
    totals: true,
  });

  // ── B2C (Table 7) ──
  const b2csColumns = [
    { title: 'Type', dataIndex: 'type', width: 80 },
    { title: 'Place of Supply', dataIndex: 'placeOfSupply', width: 130, align: 'center' as const,
      render: (v: string) => v || '—' },
    { title: 'Rate', dataIndex: 'rate', width: 90, align: 'right' as const, render: pct },
    { title: 'Taxable Value', dataIndex: 'taxableValue', align: 'right' as const, render: fmt },
    { title: 'CGST', dataIndex: 'cgst', width: 140, align: 'right' as const, render: fmt },
    { title: 'SGST', dataIndex: 'sgst', width: 140, align: 'right' as const, render: fmt },
  ];

  const exportB2cs = () => exportToXLSX(b2cs, [
    { title: 'Type', key: 'type' },
    { title: 'Place Of Supply', key: 'placeOfSupply' },
    { title: 'Rate', key: 'rate', type: 'percent' },
    { title: 'Taxable Value', key: 'taxableValue', type: 'currency' },
    { title: 'Central Tax', key: 'cgst', type: 'currency' },
    { title: 'State/UT Tax', key: 'sgst', type: 'currency' },
  ], `gstr1-b2cs-${fileTag}`, 'B2CS', {
    title: 'GSTR-1 · Table 7 — B2C Small (unregistered buyers, consolidated)',
    subtitle: subtitle(`${r.b2cInvoiceCount || 0} invoices consolidated`),
    totals: true,
  });

  // ── HSN summary (Table 12) ──
  const hsnColumns = [
    { title: 'HSN', dataIndex: 'hsnCode', width: 110,
      render: (v: string) => (v === '(not set)' ? <Text type="danger">{v}</Text> : v) },
    { title: 'Description', dataIndex: 'description', ellipsis: true },
    { title: 'UQC', dataIndex: 'uqc', width: 70 },
    { title: 'Total Qty', dataIndex: 'totalQuantity', width: 90, align: 'right' as const,
      render: (v: any) => Number(v || 0).toLocaleString('en-IN') },
    { title: 'Rate', dataIndex: 'rate', width: 70, align: 'right' as const, render: pct },
    { title: 'Taxable Value', dataIndex: 'taxableValue', width: 130, align: 'right' as const, render: fmt },
    { title: 'CGST', dataIndex: 'cgst', width: 110, align: 'right' as const, render: fmt },
    { title: 'SGST', dataIndex: 'sgst', width: 110, align: 'right' as const, render: fmt },
    { title: 'Total Value', dataIndex: 'totalValue', width: 130, align: 'right' as const,
      render: (v: any) => <strong>{fmt(v)}</strong> },
  ];

  const exportHsn = () => exportToXLSX(hsn, [
    { title: 'HSN', key: 'hsnCode' },
    { title: 'Description', key: 'description' },
    { title: 'UQC', key: 'uqc' },
    { title: 'Total Quantity', key: 'totalQuantity', type: 'number' },
    { title: 'Rate', key: 'rate', type: 'percent' },
    { title: 'Taxable Value', key: 'taxableValue', type: 'currency' },
    { title: 'Central Tax', key: 'cgst', type: 'currency' },
    { title: 'State/UT Tax', key: 'sgst', type: 'currency' },
    { title: 'Total Value', key: 'totalValue', type: 'currency' },
  ], `gstr1-hsn-${fileTag}`, 'HSN', {
    title: 'GSTR-1 · Table 12 — HSN-wise Summary',
    subtitle: subtitle(`${hsn.length} HSN/rate combinations`),
    totals: true,
  });

  // ── Credit notes (Table 9B) ──
  const cnColumns = [
    { title: 'Note No', dataIndex: 'noteNo', width: 140 },
    { title: 'Note Date', dataIndex: 'noteDate', width: 115, render: date },
    { title: 'GSTIN', dataIndex: 'gstin', width: 160,
      render: (v: string) => v || <Text type="secondary">Unregistered</Text> },
    { title: 'Customer', dataIndex: 'customerName', ellipsis: true, render: (v: string) => v || '—' },
    { title: 'Original Invoice', dataIndex: 'originalInvoiceNo', width: 135, render: (v: string) => v || '—' },
    { title: 'Invoice Date', dataIndex: 'originalInvoiceDate', width: 115, render: date },
    { title: 'Rate', dataIndex: 'rate', width: 70, align: 'right' as const, render: pct },
    { title: 'Taxable Value', dataIndex: 'taxableValue', width: 120, align: 'right' as const, render: fmt },
    { title: 'CGST', dataIndex: 'cgst', width: 100, align: 'right' as const, render: fmt },
    { title: 'SGST', dataIndex: 'sgst', width: 100, align: 'right' as const, render: fmt },
  ];

  const exportCn = () => exportToXLSX(creditNotes, [
    { title: 'Note Number', key: 'noteNo' },
    { title: 'Note Date', key: 'noteDate', type: 'date' },
    { title: 'GSTIN/UIN of Recipient', key: 'gstin' },
    { title: 'Receiver Name', key: 'customerName' },
    { title: 'Original Invoice Number', key: 'originalInvoiceNo' },
    { title: 'Original Invoice Date', key: 'originalInvoiceDate', type: 'date' },
    { title: 'Rate', key: 'rate', type: 'percent' },
    { title: 'Taxable Value', key: 'taxableValue', type: 'currency' },
    { title: 'Central Tax', key: 'cgst', type: 'currency' },
    { title: 'State/UT Tax', key: 'sgst', type: 'currency' },
    { title: 'Note Value', key: 'noteValue', type: 'currency' },
  ], `gstr1-credit-notes-${fileTag}`, 'Credit Notes', {
    title: 'GSTR-1 · Table 9B — Credit Notes (sales returns)',
    subtitle: subtitle(`${creditNotes.length} rows`),
    totals: true,
  });

  // ── Fix before filing ──
  const problemColumns = [
    { title: 'Issue', dataIndex: 'kind', width: 180,
      render: (v: string) => <Tag color="orange" style={{ borderRadius: 4 }}>{PROBLEM_LABEL[v] || v}</Tag> },
    { title: 'Concerns', dataIndex: 'subject', width: 280, ellipsis: true },
    { title: 'What to do', dataIndex: 'detail' },
    { title: 'Value', dataIndex: 'amountAffected', width: 120, align: 'right' as const,
      render: (v: any) => (v != null ? fmt(v) : '—') },
  ];

  const summary = [
    { label: 'Invoices', value: String(r.invoiceCount ?? 0) },
    { label: 'B2B / B2C', value: `${r.b2bInvoiceCount ?? 0} / ${r.b2cInvoiceCount ?? 0}` },
    { label: 'Taxable Value', value: fmt(totals.taxableValue) },
    { label: 'CGST', value: fmt(totals.cgst) },
    { label: 'SGST', value: fmt(totals.sgst) },
    { label: 'Credit Notes', value: fmt(totals.creditNoteTaxableValue) },
    { label: 'Net Taxable', value: fmt(totals.netTaxableValue), strong: true },
  ];

  const tabLabel = (text: string, count: number) => `${text} (${count})`;

  return (
    <>
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
        padding: '14px 20px', marginBottom: 16,
        display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Filing Period</div>
          <RangePicker
            value={range}
            onChange={v => v && setRange(v as [dayjs.Dayjs, dayjs.Dayjs])}
            format="DD MMM YYYY"
            allowClear={false}
            disabledDate={noFutureDates}
            picker="date"
            style={{ borderRadius: 8 }}
          />
        </div>
        <Space>
          <Button type="primary" icon={<SearchOutlined />} onClick={apply}>Search</Button>
        </Space>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
          {summary.map(s => (
            <div key={s.label} style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
              <Text strong style={s.strong ? { fontSize: 15 } : undefined}>{s.value}</Text>
            </div>
          ))}
        </div>
      </div>

      {quality.companyGstinMissing && (
        <Alert
          type="error" showIcon style={{ marginBottom: 12, borderRadius: 8 }}
          message="Your own GSTIN is not set"
          description="Fill it in under Settings → Company Profile. Nothing can be filed without it."
        />
      )}
      {quality.companyStateCodeMissing && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 12, borderRadius: 8 }}
          message="Your GST state code is not set"
          description="Set it under Settings → Company Profile (33 for Tamil Nadu). Without it, place of supply on B2C sales is blank and inter-state sales cannot be detected."
        />
      )}
      {quality.problemCount > 0 && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 12, borderRadius: 8 }}
          message={`${quality.problemCount} thing${quality.problemCount > 1 ? 's' : ''} to fix before filing`}
          description="See the Fix Before Filing tab. These do not stop the report, but the filed return would be wrong."
        />
      )}

      <Alert
        type="info" showIcon style={{ marginBottom: 16, borderRadius: 8 }}
        message="How these figures are built"
        description={
          <span>
            Every bill raised in the period is included — from Approved onwards, by invoice date.
            Cancelled bills and drafts are left out. Shops with no GSTIN on file are treated as
            unregistered and reported under B2C, so check that any shop that really is registered
            has its GSTIN filled in. All tax is split as CGST + SGST; have your accountant confirm
            the figures before filing.
          </span>
        }
      />

      <Tabs
        defaultActiveKey="b2b"
        items={[
          {
            key: 'b2b',
            label: tabLabel('B2B — Registered', b2b.length),
            children: (
              <>
                <ExportBar onExport={exportB2b} disabled={b2b.length === 0} />
                <Table
                  size="small" dataSource={b2b} rowKey={(_, i) => `b2b-${i}`}
                  loading={isLoading || isFetching} columns={b2bColumns} scroll={{ x: 1300 }}
                  pagination={{ pageSize: 100, showSizeChanger: false, showTotal: t => `${t} rows` }}
                  locale={{ emptyText: <Empty text="No sales to GST-registered shops in this period" /> }}
                  summary={() => b2b.length ? (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={7}><strong>Total</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={7} align="right"><strong>{fmt(totals.b2bTaxableValue)}</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={8} align="right"><strong>{fmt(sum(b2b, 'cgst'))}</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={9} align="right"><strong>{fmt(sum(b2b, 'sgst'))}</strong></Table.Summary.Cell>
                    </Table.Summary.Row>
                  ) : null}
                />
              </>
            ),
          },
          {
            key: 'b2c',
            label: tabLabel('B2C — Consolidated', b2cs.length),
            children: (
              <>
                <ExportBar onExport={exportB2cs} disabled={b2cs.length === 0} />
                <Table
                  size="small" dataSource={b2cs} rowKey={(_, i) => `b2cs-${i}`}
                  loading={isLoading || isFetching} columns={b2csColumns}
                  pagination={false}
                  locale={{ emptyText: <Empty text="No sales to unregistered shops in this period" /> }}
                  summary={() => b2cs.length ? (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={3}><strong>Total</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right"><strong>{fmt(totals.b2cTaxableValue)}</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={4} align="right"><strong>{fmt(sum(b2cs, 'cgst'))}</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={5} align="right"><strong>{fmt(sum(b2cs, 'sgst'))}</strong></Table.Summary.Cell>
                    </Table.Summary.Row>
                  ) : null}
                />
              </>
            ),
          },
          {
            key: 'hsn',
            label: tabLabel('HSN Summary', hsn.length),
            children: (
              <>
                <ExportBar onExport={exportHsn} disabled={hsn.length === 0} />
                <Table
                  size="small" dataSource={hsn} rowKey={(_, i) => `hsn-${i}`}
                  loading={isLoading || isFetching} columns={hsnColumns} scroll={{ x: 1100 }}
                  pagination={{ pageSize: 100, showSizeChanger: false, showTotal: t => `${t} rows` }}
                  locale={{ emptyText: <Empty text="No sales in this period" /> }}
                  summary={() => hsn.length ? (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={5}><strong>Total</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={5} align="right"><strong>{fmt(sum(hsn, 'taxableValue'))}</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={6} align="right"><strong>{fmt(sum(hsn, 'cgst'))}</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={7} align="right"><strong>{fmt(sum(hsn, 'sgst'))}</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={8} align="right"><strong>{fmt(sum(hsn, 'totalValue'))}</strong></Table.Summary.Cell>
                    </Table.Summary.Row>
                  ) : null}
                />
              </>
            ),
          },
          {
            key: 'cn',
            label: tabLabel('Credit Notes', creditNotes.length),
            children: (
              <>
                <ExportBar onExport={exportCn} disabled={creditNotes.length === 0} />
                <Table
                  size="small" dataSource={creditNotes} rowKey={(_, i) => `cn-${i}`}
                  loading={isLoading || isFetching} columns={cnColumns} scroll={{ x: 1300 }}
                  pagination={{ pageSize: 50, showSizeChanger: false, showTotal: t => `${t} rows` }}
                  locale={{ emptyText: <Empty text="No verified sales returns in this period" /> }}
                  summary={() => creditNotes.length ? (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={7}><strong>Total</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={7} align="right"><strong>{fmt(sum(creditNotes, 'taxableValue'))}</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={8} align="right"><strong>{fmt(sum(creditNotes, 'cgst'))}</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={9} align="right"><strong>{fmt(sum(creditNotes, 'sgst'))}</strong></Table.Summary.Cell>
                    </Table.Summary.Row>
                  ) : null}
                />
              </>
            ),
          },
          {
            key: 'fix',
            label: tabLabel('Fix Before Filing', problems.length),
            children: (
              <Table
                size="small" dataSource={problems} rowKey={(_, i) => `p-${i}`}
                loading={isLoading || isFetching} columns={problemColumns}
                pagination={{ pageSize: 50, showSizeChanger: false, showTotal: t => `${t} issues` }}
                locale={{ emptyText: <Empty text="Nothing to fix — the data is clean for this period" /> }}
              />
            ),
          },
        ]}
      />
    </>
  );
};

const sum = (rows: any[], key: string) => rows.reduce((s, x) => s + Number(x[key] || 0), 0);

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ padding: '32px 0', color: '#94a3b8' }}>{text}</div>
);

const ExportBar: React.FC<{ onExport: () => void; disabled: boolean }> = ({ onExport, disabled }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
    <Button
      icon={<FileExcelOutlined />}
      onClick={onExport}
      disabled={disabled}
      style={disabled ? {} : { color: '#059669', borderColor: '#059669' }}
    >
      Export Excel
    </Button>
  </div>
);

export default Gstr1Report;
