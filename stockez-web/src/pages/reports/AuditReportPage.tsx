import React, { useState } from 'react';
import { Table, DatePicker, Button, Space, Typography, Tabs } from 'antd';
import { FileExcelOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { noFutureDates } from '../../utils/date';
import { exportToXLSX } from '../../components/TableToolbar';
import { useGetSalesRegisterQuery, useGetPurchaseRegisterQuery, useGetCollectionDetailQuery } from '../../store/api/reportApi';
import PageHeader from '../../components/PageHeader';
import Gstr1Report from './Gstr1Report';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const fmt = (v: number | string) =>
  Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Shared filter bar ───────────────────────────────────────────────────────

interface FilterBarProps {
  range: [dayjs.Dayjs, dayjs.Dayjs];
  setRange: (r: [dayjs.Dayjs, dayjs.Dayjs]) => void;
  onApply: () => void;
  onExport: () => void;
  exportDisabled: boolean;
  totalGst: number;
  totalNet: number;
  hasData: boolean;
  taxableLabel?: string;
}

const FilterBar: React.FC<FilterBarProps> = ({
  range, setRange, onApply, onExport, exportDisabled, totalGst, totalNet, hasData, taxableLabel,
}) => {
  const taxable = totalNet - totalGst;
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '14px 20px', marginBottom: 16,
      display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap',
    }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Date Range</div>
        <RangePicker
          value={range}
          onChange={v => v && setRange(v as [dayjs.Dayjs, dayjs.Dayjs])}
          format="DD MMM YYYY"
          allowClear={false}
          disabledDate={noFutureDates}
          style={{ borderRadius: 8 }}
        />
      </div>
      <Space>
        <Button type="primary" icon={<SearchOutlined />} onClick={onApply}>Search</Button>
        <Button
          icon={<FileExcelOutlined />}
          onClick={onExport}
          disabled={exportDisabled}
          style={exportDisabled ? {} : { color: '#059669', borderColor: '#059669' }}
        >
          Export Excel
        </Button>
      </Space>
      {hasData && (
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 24, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>{taxableLabel ?? 'Taxable Value'}</div>
            <Text strong>₹{fmt(taxable)}</Text>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>Total GST</div>
            <Text strong>₹{fmt(totalGst)}</Text>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>Net Amount</div>
            <Text strong style={{ fontSize: 15 }}>₹{fmt(totalNet)}</Text>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sales Register tab ──────────────────────────────────────────────────────

const SalesRegister: React.FC = () => {
  const startOfMonth = dayjs().startOf('month');
  const [range, setRange]       = useState<[dayjs.Dayjs, dayjs.Dayjs]>([startOfMonth, dayjs()]);
  const [activeFrom, setFrom]   = useState(startOfMonth.format('YYYY-MM-DD'));
  const [activeTo, setTo]       = useState(dayjs().format('YYYY-MM-DD'));

  const { data, isLoading, isFetching } = useGetSalesRegisterQuery({ from: activeFrom, to: activeTo });
  const rows: any[] = data?.data || [];

  const apply = () => { setFrom(range[0].format('YYYY-MM-DD')); setTo(range[1].format('YYYY-MM-DD')); };

  const exportExcel = () => exportToXLSX(rows, [
    { title: 'S.No', key: 'sNo' },
    { title: 'Inv No', key: 'invNo' },
    { title: 'Inv Date', key: 'invDate', type: 'date' },
    { title: 'Customer', key: 'customerName' },
    { title: 'GSTN No', key: 'gstin' },
    { title: 'Product', key: 'productName' },
    { title: 'Unit', key: 'unit' },
    { title: 'HSN Code', key: 'hsnCode' },
    { title: 'GST %', key: 'gstPercent', type: 'percent' },
    { title: 'GST', key: 'gstAmount', type: 'currency' },
    { title: 'CGST %', key: 'cgstPercent', type: 'percent' },
    { title: 'CGST Net', key: 'cgstAmount', type: 'currency' },
    { title: 'SGST %', key: 'sgstPercent', type: 'percent' },
    { title: 'SGST Net', key: 'sgstAmount', type: 'currency' },
    { title: 'Quantity', key: 'quantity', type: 'number' },
    { title: 'MRP', key: 'unitPrice', type: 'currency' },
    { title: 'Net Amount', key: 'netAmount', type: 'currency' },
  ], `sales-register-${activeFrom}-to-${activeTo}`, 'Sales Register', {
    title: 'Sales Register',
    subtitle: `${dayjs(activeFrom).format('DD MMM YYYY')} to ${dayjs(activeTo).format('DD MMM YYYY')} · ${rows.length} records`,
    totals: true,
  });

  const totalGst = rows.reduce((s, r) => s + Number(r.gstAmount), 0);
  const totalNet = rows.reduce((s, r) => s + Number(r.netAmount), 0);

  const columns = [
    { title: 'S.No',     dataIndex: 'sNo',         key: 'sNo',    width: 55,  align: 'right' as const },
    { title: 'Inv No',   dataIndex: 'invNo',        key: 'invNo',  width: 140 },
    { title: 'Inv Date', dataIndex: 'invDate',      key: 'date',   width: 110, render: (v: string) => dayjs(v).format('DD MMM YYYY') },
    { title: 'Customer', dataIndex: 'customerName', key: 'cust',   ellipsis: true },
    { title: 'GSTN No',  dataIndex: 'gstin',        key: 'gstin',  width: 150, render: (v: string) => v || '—' },
    { title: 'Product',  dataIndex: 'productName',  key: 'prod',   ellipsis: true },
    { title: 'Unit',     dataIndex: 'unit',         key: 'unit',   width: 55 },
    { title: 'HSN',      dataIndex: 'hsnCode',      key: 'hsn',    width: 100, render: (v: string) => v || '—' },
    { title: 'GST %',    dataIndex: 'gstPercent',   key: 'gstPct', width: 65,  align: 'right' as const, render: (v: number) => `${Number(v).toFixed(0)}%` },
    { title: 'GST',      dataIndex: 'gstAmount',    key: 'gstAmt', width: 80,  align: 'right' as const, render: (v: number) => fmt(v) },
    { title: 'CGST %',   dataIndex: 'cgstPercent',  key: 'cPct',   width: 65,  align: 'right' as const, render: (v: number) => `${Number(v).toFixed(1)}%` },
    { title: 'CGST Net', dataIndex: 'cgstAmount',   key: 'cAmt',   width: 85,  align: 'right' as const, render: (v: number) => fmt(v) },
    { title: 'SGST %',   dataIndex: 'sgstPercent',  key: 'sPct',   width: 65,  align: 'right' as const, render: (v: number) => `${Number(v).toFixed(1)}%` },
    { title: 'SGST Net', dataIndex: 'sgstAmount',   key: 'sAmt',   width: 85,  align: 'right' as const, render: (v: number) => fmt(v) },
    { title: 'Qty',      dataIndex: 'quantity',     key: 'qty',    width: 55,  align: 'right' as const },
    { title: 'MRP',      dataIndex: 'unitPrice',    key: 'mrp',    width: 80,  align: 'right' as const, render: (v: number) => fmt(v) },
    { title: 'Net Amount', dataIndex: 'netAmount',  key: 'net',    width: 105, align: 'right' as const, render: (v: number) => <strong>{fmt(v)}</strong> },
  ];

  return (
    <>
      <FilterBar
        range={range} setRange={setRange} onApply={apply}
        onExport={exportExcel} exportDisabled={rows.length === 0}
        totalGst={totalGst} totalNet={totalNet} hasData={rows.length > 0}
      />
      <Table
        size="small" dataSource={rows} rowKey={(_, i) => String(i)}
        loading={isLoading || isFetching} columns={columns} scroll={{ x: 1450 }}
        pagination={{ pageSize: 100, showSizeChanger: false, showTotal: t => `${t} line items` }}
        locale={{ emptyText: <div style={{ padding: '32px 0', color: '#94a3b8' }}>No delivered orders in selected date range</div> }}
        summary={() =>
          rows.length > 0 ? (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={9} />
              <Table.Summary.Cell index={9} align="right"><strong>{fmt(totalGst)}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={10} />
              <Table.Summary.Cell index={11} align="right"><strong>{fmt(rows.reduce((s, r) => s + Number(r.cgstAmount), 0))}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={12} />
              <Table.Summary.Cell index={13} align="right"><strong>{fmt(rows.reduce((s, r) => s + Number(r.sgstAmount), 0))}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={14} /><Table.Summary.Cell index={15} />
              <Table.Summary.Cell index={16} align="right"><strong>{fmt(totalNet)}</strong></Table.Summary.Cell>
            </Table.Summary.Row>
          ) : null
        }
      />
    </>
  );
};

// ─── Purchase Register tab ───────────────────────────────────────────────────

const PurchaseRegister: React.FC = () => {
  const startOfMonth = dayjs().startOf('month');
  const [range, setRange]       = useState<[dayjs.Dayjs, dayjs.Dayjs]>([startOfMonth, dayjs()]);
  const [activeFrom, setFrom]   = useState(startOfMonth.format('YYYY-MM-DD'));
  const [activeTo, setTo]       = useState(dayjs().format('YYYY-MM-DD'));

  const { data, isLoading, isFetching } = useGetPurchaseRegisterQuery({ from: activeFrom, to: activeTo });
  const rows: any[] = data?.data || [];

  const apply = () => { setFrom(range[0].format('YYYY-MM-DD')); setTo(range[1].format('YYYY-MM-DD')); };

  const exportExcel = () => exportToXLSX(rows, [
    { title: 'S.No', key: 'sNo' },
    { title: 'Purchase No', key: 'purchaseNo' },
    { title: 'Supplier Inv No', key: 'supplierInvNo' },
    { title: 'Purchase Date', key: 'purchaseDate', type: 'date' },
    { title: 'Supplier', key: 'supplierName' },
    { title: 'Supplier GSTN', key: 'supplierGstin' },
    { title: 'Product', key: 'productName' },
    { title: 'Unit', key: 'unit' },
    { title: 'HSN Code', key: 'hsnCode' },
    { title: 'GST %', key: 'gstPercent', type: 'percent' },
    { title: 'GST', key: 'gstAmount', type: 'currency' },
    { title: 'CGST %', key: 'cgstPercent', type: 'percent' },
    { title: 'CGST Net', key: 'cgstAmount', type: 'currency' },
    { title: 'SGST %', key: 'sgstPercent', type: 'percent' },
    { title: 'SGST Net', key: 'sgstAmount', type: 'currency' },
    { title: 'Quantity', key: 'quantity', type: 'number' },
    { title: 'Rate (Excl GST)', key: 'rateExclGst', type: 'currency' },
    { title: 'Net Amount', key: 'netAmount', type: 'currency' },
  ], `purchase-register-${activeFrom}-to-${activeTo}`, 'Purchase Register', {
    title: 'Purchase Register',
    subtitle: `${dayjs(activeFrom).format('DD MMM YYYY')} to ${dayjs(activeTo).format('DD MMM YYYY')} · ${rows.length} records`,
    totals: true,
  });

  const totalGst = rows.reduce((s, r) => s + Number(r.gstAmount), 0);
  const totalNet = rows.reduce((s, r) => s + Number(r.netAmount), 0);

  const columns = [
    { title: 'S.No',        dataIndex: 'sNo',           key: 'sNo',    width: 55,  align: 'right' as const },
    { title: 'Purchase No', dataIndex: 'purchaseNo',    key: 'purNo',  width: 140 },
    { title: 'Supp Inv No', dataIndex: 'supplierInvNo', key: 'sInv',   width: 120, render: (v: string) => v || '—' },
    { title: 'Date',        dataIndex: 'purchaseDate',  key: 'date',   width: 110, render: (v: string) => dayjs(v).format('DD MMM YYYY') },
    { title: 'Supplier',    dataIndex: 'supplierName',  key: 'supp',   ellipsis: true },
    { title: 'Supp GSTN',   dataIndex: 'supplierGstin', key: 'sGst',   width: 150, render: (v: string) => v || '—' },
    { title: 'Product',     dataIndex: 'productName',   key: 'prod',   ellipsis: true },
    { title: 'Unit',        dataIndex: 'unit',          key: 'unit',   width: 55 },
    { title: 'HSN',         dataIndex: 'hsnCode',       key: 'hsn',    width: 100, render: (v: string) => v || '—' },
    { title: 'GST %',       dataIndex: 'gstPercent',    key: 'gstPct', width: 65,  align: 'right' as const, render: (v: number) => `${Number(v).toFixed(0)}%` },
    { title: 'GST',         dataIndex: 'gstAmount',     key: 'gstAmt', width: 80,  align: 'right' as const, render: (v: number) => fmt(v) },
    { title: 'CGST %',      dataIndex: 'cgstPercent',   key: 'cPct',   width: 65,  align: 'right' as const, render: (v: number) => `${Number(v).toFixed(1)}%` },
    { title: 'CGST Net',    dataIndex: 'cgstAmount',    key: 'cAmt',   width: 85,  align: 'right' as const, render: (v: number) => fmt(v) },
    { title: 'SGST %',      dataIndex: 'sgstPercent',   key: 'sPct',   width: 65,  align: 'right' as const, render: (v: number) => `${Number(v).toFixed(1)}%` },
    { title: 'SGST Net',    dataIndex: 'sgstAmount',    key: 'sAmt',   width: 85,  align: 'right' as const, render: (v: number) => fmt(v) },
    { title: 'Qty',         dataIndex: 'quantity',      key: 'qty',    width: 55,  align: 'right' as const },
    { title: 'Rate (Ex-GST)', dataIndex: 'rateExclGst', key: 'rate',   width: 105, align: 'right' as const, render: (v: number) => fmt(v) },
    { title: 'Net Amount',  dataIndex: 'netAmount',     key: 'net',    width: 105, align: 'right' as const, render: (v: number) => <strong>{fmt(v)}</strong> },
  ];

  return (
    <>
      <FilterBar
        range={range} setRange={setRange} onApply={apply}
        onExport={exportExcel} exportDisabled={rows.length === 0}
        totalGst={totalGst} totalNet={totalNet} hasData={rows.length > 0}
        taxableLabel="Taxable Value (Ex-GST)"
      />
      <Table
        size="small" dataSource={rows} rowKey={(_, i) => String(i)}
        loading={isLoading || isFetching} columns={columns} scroll={{ x: 1550 }}
        pagination={{ pageSize: 100, showSizeChanger: false, showTotal: t => `${t} line items` }}
        locale={{ emptyText: <div style={{ padding: '32px 0', color: '#94a3b8' }}>No purchases in selected date range</div> }}
        summary={() =>
          rows.length > 0 ? (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={9} />
              <Table.Summary.Cell index={9} align="right"><strong>{fmt(totalGst)}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={10} />
              <Table.Summary.Cell index={11} align="right"><strong>{fmt(rows.reduce((s, r) => s + Number(r.cgstAmount), 0))}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={12} />
              <Table.Summary.Cell index={13} align="right"><strong>{fmt(rows.reduce((s, r) => s + Number(r.sgstAmount), 0))}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={14} /><Table.Summary.Cell index={15} />
              <Table.Summary.Cell index={16} align="right"><strong>{fmt(totalNet)}</strong></Table.Summary.Cell>
            </Table.Summary.Row>
          ) : null
        }
      />
    </>
  );
};

// ─── Collection Report tab ───────────────────────────────────────────────────

const CollectionReport: React.FC = () => {
  const today = dayjs();
  const [range, setRange]     = useState<[dayjs.Dayjs, dayjs.Dayjs]>([today, today]);
  const [activeFrom, setFrom] = useState(today.format('YYYY-MM-DD'));
  const [activeTo, setTo]     = useState(today.format('YYYY-MM-DD'));

  const { data, isLoading, isFetching } = useGetCollectionDetailQuery({ from: activeFrom, to: activeTo });
  const rows: any[] = data?.data || [];

  const apply = () => { setFrom(range[0].format('YYYY-MM-DD')); setTo(range[1].format('YYYY-MM-DD')); };

  const exportExcel = () => exportToXLSX(rows, [
    { title: 'S.No', key: 'sNo' },
    { title: 'Date', key: 'collectionDate', type: 'date' },
    { title: 'Customer', key: 'customerName' },
    { title: 'Order No', key: 'orderNumber' },
    { title: 'Payment Mode', key: 'paymentMode' },
    { title: 'Method', key: 'paymentMethodName' },
    { title: 'Reference No', key: 'referenceNumber' },
    { title: 'Amount', key: 'amount', type: 'currency' },
    { title: 'Collected By', key: 'collectedBy' },
    { title: 'Cleared', key: 'cleared', transform: (v: any) => (v ? 'Yes' : 'No') },
  ], `collection-${activeFrom}-to-${activeTo}`, 'Collection Report', {
    title: 'Collection Report',
    subtitle: `${dayjs(activeFrom).format('DD MMM YYYY')} to ${dayjs(activeTo).format('DD MMM YYYY')} · ${rows.length} records`,
    totals: true,
  });

  const totalAmt   = rows.reduce((s, r) => s + Number(r.amount), 0);
  const clearedAmt = rows.filter(r => r.cleared).reduce((s, r) => s + Number(r.amount), 0);
  const pendingAmt = totalAmt - clearedAmt;

  const MODE_COLOR: Record<string, string> = {
    CASH: '#059669', UPI: '#2563eb', NEFT: '#7c3aed', CHEQUE: '#d97706', CREDIT: '#dc2626',
  };

  const columns = [
    { title: 'S.No',     dataIndex: 'sNo',            key: 'sNo',   width: 55,  align: 'right' as const },
    { title: 'Date',     dataIndex: 'collectionDate', key: 'date',  width: 110, render: (v: string) => dayjs(v).format('DD MMM YYYY') },
    { title: 'Customer', dataIndex: 'customerName',   key: 'cust',  ellipsis: true },
    { title: 'Order No', dataIndex: 'orderNumber',    key: 'order', width: 145 },
    {
      title: 'Mode', dataIndex: 'paymentMode', key: 'mode', width: 85,
      render: (v: string) => (
        <span style={{ fontWeight: 600, color: MODE_COLOR[v] || '#374151', fontSize: 12 }}>{v}</span>
      ),
    },
    { title: 'Method',   dataIndex: 'paymentMethodName', key: 'method', width: 100, render: (v: string) => v || '—' },
    { title: 'Ref No',   dataIndex: 'referenceNumber',   key: 'ref',    width: 140, render: (v: string) => v || '—' },
    {
      title: 'Amount', dataIndex: 'amount', key: 'amt', width: 100,
      align: 'right' as const,
      render: (v: number) => <strong>₹{fmt(v)}</strong>,
    },
    { title: 'Collected By', dataIndex: 'collectedBy', key: 'by', width: 140 },
    {
      title: 'Cleared', dataIndex: 'cleared', key: 'cleared', width: 75,
      render: (v: boolean) => (
        <span style={{ color: v ? '#059669' : '#d97706', fontWeight: 600, fontSize: 12 }}>
          {v ? 'Yes' : 'Pending'}
        </span>
      ),
    },
  ];

  return (
    <>
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
        padding: '14px 20px', marginBottom: 16,
        display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Date Range</div>
          <RangePicker
            value={range}
            onChange={v => v && setRange(v as [dayjs.Dayjs, dayjs.Dayjs])}
            format="DD MMM YYYY" allowClear={false} disabledDate={noFutureDates} style={{ borderRadius: 8 }}
          />
        </div>
        <Space>
          <Button type="primary" icon={<SearchOutlined />} onClick={apply}>Search</Button>
          <Button
            icon={<FileExcelOutlined />} onClick={exportExcel} disabled={rows.length === 0}
            style={rows.length === 0 ? {} : { color: '#059669', borderColor: '#059669' }}
          >
            Export Excel
          </Button>
        </Space>
        {rows.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 24, alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Total Collected</div>
              <Text strong style={{ fontSize: 15 }}>₹{fmt(totalAmt)}</Text>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Cleared</div>
              <Text strong style={{ color: '#059669' }}>₹{fmt(clearedAmt)}</Text>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Pending</div>
              <Text strong style={{ color: '#d97706' }}>₹{fmt(pendingAmt)}</Text>
            </div>
          </div>
        )}
      </div>
      <Table
        size="small" dataSource={rows} rowKey={(_, i) => String(i)}
        loading={isLoading || isFetching} columns={columns} scroll={{ x: 1100 }}
        pagination={{ pageSize: 100, showSizeChanger: false, showTotal: t => `${t} payments` }}
        locale={{ emptyText: <div style={{ padding: '32px 0', color: '#94a3b8' }}>No payments in selected date range</div> }}
        summary={() =>
          rows.length > 0 ? (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={7} />
              <Table.Summary.Cell index={7} align="right">
                <strong>₹{fmt(totalAmt)}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={8} colSpan={2} />
            </Table.Summary.Row>
          ) : null
        }
      />
    </>
  );
};

// ─── Main page ───────────────────────────────────────────────────────────────

const AuditReportPage: React.FC = () => (
  <div>
    <PageHeader
      title="Audit Report"
      subtitle="GST filing tables and registers — export and send to your CA or auditor"
    />
    <Tabs
      defaultActiveKey="gstr1"
      items={[
        { key: 'gstr1',      label: 'GSTR-1 Filing',     children: <Gstr1Report /> },
        { key: 'sales',      label: 'Sales Register',    children: <SalesRegister /> },
        { key: 'purchase',   label: 'Purchase Register', children: <PurchaseRegister /> },
        { key: 'collection', label: 'Collection Report', children: <CollectionReport /> },
      ]}
    />
  </div>
);

export default AuditReportPage;
