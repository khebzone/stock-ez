import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DatePicker, Select, Skeleton, Tabs, Button, Table, message } from 'antd';
import { UserOutlined, ShopOutlined, FileExcelOutlined, ProfileOutlined, ContainerOutlined, PrinterOutlined } from '@ant-design/icons';
import { exportToXLSX } from '../../components/TableToolbar';
import dayjs from 'dayjs';
import { noFutureDates } from '../../utils/date';
import { useGetCustomersQuery } from '../../store/api/customerApi';
import { useGetCustomerLedgerQuery, useGetCustomerHistoryQuery, useGetSupplierHistoryQuery, useGetVendorLedgerQuery } from '../../store/api/reportApi';
import { useGetSupplierPaymentSummariesQuery } from '../../store/api/purchaseApi';
import { useGetCompanyProfileQuery } from '../../store/api/supplierApi';

const { RangePicker } = DatePicker;

const fmt = (v: number) => {
  const n = Number(v || 0);
  const abs = Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  return n < 0 ? `-₹${abs}` : `₹${abs}`;
};
const numFmt = (v: any) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fyStart = () => {
  const now = dayjs();
  const y = now.month() >= 3 ? now.year() : now.year() - 1;
  return dayjs(`${y}-04-01`);
};

const escHtml = (s: any) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

const companyHeaderLines = (c: any): { name: string; lines: string[] } => {
  const lines: string[] = [];
  if (c?.ownerName) lines.push('Prop: ' + c.ownerName);
  const addr = [c?.address, c?.city, c?.state, c?.pinCode].filter(Boolean).join(', ');
  if (addr) lines.push(addr);
  const ids = [c?.gstin ? 'GSTIN: ' + c.gstin : '', c?.phone ? 'Ph: ' + c.phone : ''].filter(Boolean).join('  ·  ');
  if (ids) lines.push(ids);
  return { name: c?.name || 'StockEz', lines };
};

interface PrintCol { label: string; align: 'left' | 'right' | 'center' }
function printStatement(opts: {
  companyName: string; companyLines?: string[]; title: string; meta?: string;
  headers: PrintCol[]; rows: string[][]; totalRow?: string[];
}) {
  const { companyName, companyLines = [], title, meta, headers, rows, totalRow } = opts;
  const thead = headers.map(h => `<th class="${h.align}">${escHtml(h.label)}</th>`).join('');
  const tbody = rows.map(r => `<tr>${r.map((c, i) => `<td class="${headers[i].align}">${escHtml(c)}</td>`).join('')}</tr>`).join('');
  const tfoot = totalRow ? `<tr class="total">${totalRow.map((c, i) => `<td class="${headers[i].align}">${escHtml(c)}</td>`).join('')}</tr>` : '';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escHtml(title)}</title>
<style>
 *{margin:0;padding:0;box-sizing:border-box;}
 body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:28px 34px;}
 .company{text-align:center;font-size:19px;font-weight:800;letter-spacing:.3px;}
 .cl{text-align:center;font-size:11px;color:#444;margin-top:2px;}
 .title{text-align:center;font-size:14px;font-weight:800;margin-top:12px;text-transform:uppercase;letter-spacing:.5px;}
 .meta{text-align:center;font-size:11px;color:#555;margin-top:3px;}
 hr{border:none;border-top:1px solid #999;margin:12px 0 0;}
 table{width:100%;border-collapse:collapse;margin-top:16px;}
 th{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;padding:6px 10px;border-bottom:1.5px solid #333;white-space:nowrap;}
 td{font-size:12px;padding:5px 10px;border-bottom:1px solid #eee;}
 .left{text-align:left;}.right{text-align:right;}.center{text-align:center;}
 tr.total td{font-weight:800;border-top:2px solid #333;border-bottom:none;padding-top:8px;background:#fafafa;}
 @media print{body{padding:10px 14px;}}
</style></head><body>
 <div class="company">${escHtml(companyName)}</div>
 ${companyLines.map(l => `<div class="cl">${escHtml(l)}</div>`).join('')}
 <div class="title">${escHtml(title)}</div>
 ${meta ? `<div class="meta">${escHtml(meta)}</div>` : ''}
 <hr/>
 <table><thead><tr>${thead}</tr></thead><tbody>${tbody}${tfoot}</tbody></table>
 <script>window.onload=function(){window.print();}</script>
</body></html>`;
  const win = window.open('', '_blank');
  if (!win) { message.warning('Allow popups to print'); return; }
  win.document.write(html); win.document.close();
}

const CustomerLedger: React.FC = () => {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs()]);

  const { data: customersData } = useGetCustomersQuery();
  const customers: any[] = customersData?.data?.content || customersData?.data || [];

  const { data, isLoading } = useGetCustomerLedgerQuery(
    { customerId: customerId!, from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD') },
    { skip: !customerId }
  );

  const ledger: any = data?.data || {};
  const entries: any[] = ledger.entries || [];
  const selected = customers.find(c => c.id === customerId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select
          showSearch filterOption={(input, option) => (option?.label as string)?.toLowerCase().startsWith(input.toLowerCase())}
          placeholder="Select customer..."
          value={customerId || undefined}
          onChange={setCustomerId}
          style={{ flex: 1, minWidth: 220 }}
          options={customers.map(c => ({ value: c.id, label: c.businessName }))}
        />
        <RangePicker
          value={range}
          onChange={v => v && setRange(v as [dayjs.Dayjs, dayjs.Dayjs])} disabledDate={noFutureDates}
          allowClear={false}
          style={{ borderRadius: 10 }}
        />
        {entries.length > 0 && (
          <Button
            icon={<FileExcelOutlined />}
            onClick={() => exportToXLSX(
              entries.map((e: any) => ({
                date: dayjs(e.date).format('DD MMM YYYY'),
                description: e.description,
                reference: e.reference || '',
                debit:  e.type === 'DEBIT'  ? e.amount : '',
                credit: e.type === 'CREDIT' ? e.amount : '',
                balance: e.runningBalance,
              })),
              [
                { title: 'Date',        key: 'date',        dataIndex: 'date' },
                { title: 'Description', key: 'description', dataIndex: 'description' },
                { title: 'Reference',   key: 'reference',   dataIndex: 'reference' },
                { title: 'Debit (Dr)',  key: 'debit',       dataIndex: 'debit' },
                { title: 'Credit (Cr)', key: 'credit',      dataIndex: 'credit' },
                { title: 'Balance',     key: 'balance',     dataIndex: 'balance' },
              ],
              `ledger-${selected?.businessName?.replace(/\s+/g, '-')}-${range[0].format('YYYY-MM-DD')}`
            )}
            style={{ borderRadius: 8 }}
          >
            Export Excel
          </Button>
        )}
      </div>

      {!customerId ? (
        <div style={{ background: '#f8fafc', borderRadius: 14, padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
          <UserOutlined style={{ fontSize: 40, marginBottom: 12, display: 'block' }} />
          Select a customer to view their ledger
        </div>
      ) : isLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : (
        <>
          {/* Customer info + balance summary */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{selected?.businessName}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{selected?.phone} · {selected?.address}</div>
              </div>
              <div style={{ display: 'flex', gap: 24 }}>
                {[
                  { label: 'Opening Balance', value: fmt(ledger.openingBalance || 0), color: '#0f172a' },
                  { label: 'Total Invoiced',  value: fmt(ledger.totalDebit || 0),     color: '#dc2626' },
                  { label: 'Total Received',  value: fmt(ledger.totalCredit || 0),    color: '#059669' },
                  { label: 'Closing Balance', value: fmt(ledger.closingBalance || 0), color: Number(ledger.closingBalance || 0) > 0 ? '#dc2626' : '#059669' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color, marginTop: 3 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ledger table */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 2fr 1fr 1fr 1fr', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 20px' }}>
              {['Date', 'Description', 'Debit (Dr)', 'Credit (Cr)', 'Balance'].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
              ))}
            </div>

            {entries.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>No transactions in this period</div>
            ) : (
              <>
                {/* Opening balance row */}
                <div style={{ display: 'grid', gridTemplateColumns: '120px 2fr 1fr 1fr 1fr', padding: '12px 20px', background: '#fffbeb', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{range[0].format('DD MMM YYYY')}</div>
                  <div style={{ fontWeight: 600, color: '#92400e', fontSize: 13 }}>Opening Balance</div>
                  <div />
                  <div />
                  <div style={{ fontWeight: 700, color: '#92400e' }}>{fmt(ledger.openingBalance || 0)}</div>
                </div>

                {entries.map((e: any, i: number) => {
                  const isDebit = e.type === 'DEBIT';
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 2fr 1fr 1fr 1fr', padding: '12px 20px', borderBottom: i < entries.length - 1 ? '1px solid #f1f5f9' : 'none', alignItems: 'center' }}>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{dayjs(e.date).format('DD MMM YYYY')}</div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{e.description}</div>
                        {e.reference && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{e.reference}</div>}
                      </div>
                      <div style={{ fontWeight: 700, color: isDebit ? '#dc2626' : '#94a3b8' }}>
                        {isDebit ? fmt(e.amount) : '—'}
                      </div>
                      <div style={{ fontWeight: 700, color: !isDebit ? '#059669' : '#94a3b8' }}>
                        {!isDebit ? fmt(e.amount) : '—'}
                      </div>
                      <div style={{ fontWeight: 700, color: Number(e.runningBalance || 0) > 0 ? '#dc2626' : '#059669', fontSize: 14 }}>
                        {fmt(e.runningBalance || 0)}
                      </div>
                    </div>
                  );
                })}

                {/* Closing balance row */}
                <div style={{ display: 'grid', gridTemplateColumns: '120px 2fr 1fr 1fr 1fr', padding: '13px 20px', borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{range[1].format('DD MMM YYYY')}</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>Closing Balance</div>
                  <div style={{ fontWeight: 800, color: '#dc2626' }}>{fmt(ledger.totalDebit || 0)}</div>
                  <div style={{ fontWeight: 800, color: '#059669' }}>{fmt(ledger.totalCredit || 0)}</div>
                  <div style={{ fontWeight: 800, color: Number(ledger.closingBalance || 0) > 0 ? '#dc2626' : '#059669', fontSize: 15 }}>
                    {fmt(ledger.closingBalance || 0)}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const VendorLedger: React.FC = () => {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs()]);

  const { data, isLoading } = useGetVendorLedgerQuery({
    from: range[0].format('YYYY-MM-DD'),
    to: range[1].format('YYYY-MM-DD'),
  });

  const vendors: any[] = data?.data?.vendors || [];
  const total: number = data?.data?.totalPurchases || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <RangePicker value={range} onChange={v => v && setRange(v as [dayjs.Dayjs, dayjs.Dayjs])} disabledDate={noFutureDates} allowClear={false} style={{ borderRadius: 10 }} />
        {vendors.length > 0 && (
          <Button
            icon={<FileExcelOutlined />}
            onClick={() => exportToXLSX(
              vendors.map((v: any) => ({
                supplier: v.supplierName,
                entries: v.entryCount,
                total: v.totalAmount,
                lastDate: v.lastPurchaseDate ? dayjs(v.lastPurchaseDate).format('DD MMM YYYY') : '',
              })),
              [
                { title: 'Supplier',       key: 'supplier', dataIndex: 'supplier' },
                { title: 'Entries',        key: 'entries',  dataIndex: 'entries' },
                { title: 'Total Amount',   key: 'total',    dataIndex: 'total' },
                { title: 'Last Purchase',  key: 'lastDate', dataIndex: 'lastDate' },
              ],
              `vendor-ledger-${range[0].format('YYYY-MM-DD')}`
            )}
            style={{ borderRadius: 8 }}
          >
            Export Excel
          </Button>
        )}
      </div>

      {/* Summary */}
      <div style={{ background: '#eff6ff', borderRadius: 14, border: '1px solid #bfdbfe', padding: '16px 20px' }}>
        <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>Total Purchases</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>{fmt(total)}</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{vendors.length} supplier{vendors.length !== 1 ? 's' : ''}</div>
      </div>

      {isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 20px' }}>
            {['Supplier', 'Entries', 'Total Purchased', 'Last Purchase'].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
            ))}
          </div>
          {vendors.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>No purchases in this period</div>
          ) : vendors.map((v: any, i: number) => (
            <div key={v.supplierName} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '14px 20px', borderBottom: i < vendors.length - 1 ? '1px solid #f1f5f9' : 'none', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                    {v.supplierName?.[0]}
                  </div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{v.supplierName}</div>
                </div>
              </div>
              <div style={{ fontWeight: 600, color: '#475569' }}>{v.entryCount}</div>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 15 }}>{fmt(v.totalAmount)}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>{v.lastPurchaseDate ? dayjs(v.lastPurchaseDate).format('DD MMM YYYY') : '—'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const CustomerHistory: React.FC<{ initialCustomerId?: string | null }> = ({ initialCustomerId }) => {
  const [customerId, setCustomerId] = useState<string | null>(initialCustomerId ?? null);
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([fyStart(), dayjs()]);

  const { data: customersData } = useGetCustomersQuery();
  const customers: any[] = customersData?.data?.content || customersData?.data || [];

  const { data, isLoading } = useGetCustomerHistoryQuery(
    { customerId: customerId!, from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD') },
    { skip: !customerId }
  );

  const hist: any = data?.data || {};
  const rows: any[] = hist.rows || [];
  const selected = customers.find(c => c.id === customerId);

  const { data: profileData } = useGetCompanyProfileQuery();
  const company = profileData?.data;
  const custTotalDue = (hist.totalBilled || 0) - (hist.totalCollected || 0);

  const columns = [
    { title: 'S.No', dataIndex: 'serialNo', width: 64, align: 'center' as const },
    { title: 'Bill No', dataIndex: 'billNo', width: 130, render: (v: string) => v ? <span style={{ fontWeight: 700, color: '#0f172a' }}>{v}</span> : '' },
    { title: 'Bill Date', dataIndex: 'billDate', width: 120, render: (v: string) => v ? dayjs(v).format('DD MMM YYYY') : '' },
    { title: 'Bill Amt', dataIndex: 'billAmount', width: 120, align: 'right' as const, render: (v: any) => v != null ? <span style={{ fontWeight: 700, color: '#0f172a' }}>{fmt(v)}</span> : '' },
    { title: 'Coll. Date', dataIndex: 'collectionDate', width: 120, render: (v: string) => v ? dayjs(v).format('DD MMM YYYY') : '' },
    { title: 'Coll. Amt', dataIndex: 'collectionAmount', width: 120, align: 'right' as const, render: (v: any) => v != null ? <span style={{ color: Number(v) < 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>{fmt(v)}</span> : '' },
    { title: 'Collected By', dataIndex: 'collectedBy', width: 150, render: (v: string) => v || '' },
    { title: 'Mode', dataIndex: 'paymentMode', width: 120, render: (v: string) => v || '' },
    { title: 'Due', dataIndex: 'dueAmount', width: 120, align: 'right' as const, render: (v: any) => v != null ? <span style={{ color: Number(v) !== 0 ? '#dc2626' : '#059669', fontWeight: 700 }}>{fmt(v)}</span> : '' },
  ];

  const doExport = () => {
    const exportData: any[] = rows.map((r: any) => ({
      serialNo: r.serialNo,
      billNo: r.billNo || '',
      billDate: r.billDate || '',
      billAmount: r.billAmount ?? '',
      collectionDate: r.collectionDate || '',
      collectionAmount: r.collectionAmount ?? '',
      collectedBy: r.collectedBy || '',
      paymentMode: r.paymentMode || '',
      dueAmount: r.dueAmount ?? '',
    }));
    exportData.push({
      serialNo: '', billNo: 'TOTAL', billDate: '',
      billAmount: hist.totalBilled ?? 0,
      collectionDate: '', collectionAmount: hist.totalCollected ?? 0,
      collectedBy: '', paymentMode: '', dueAmount: custTotalDue,
    });
    exportToXLSX(
      exportData,
      [
        { title: 'S.No',         key: 'serialNo',         dataIndex: 'serialNo',         type: 'number'   as const, align: 'right' as const },
        { title: 'Bill No',      key: 'billNo',           dataIndex: 'billNo' },
        { title: 'Bill Date',    key: 'billDate',         dataIndex: 'billDate',         type: 'date'     as const },
        { title: 'Bill Amt',     key: 'billAmount',       dataIndex: 'billAmount',       type: 'currency' as const },
        { title: 'Coll. Date',   key: 'collectionDate',   dataIndex: 'collectionDate',   type: 'date'     as const },
        { title: 'Coll. Amt',    key: 'collectionAmount', dataIndex: 'collectionAmount', type: 'currency' as const },
        { title: 'Collected By', key: 'collectedBy',      dataIndex: 'collectedBy' },
        { title: 'Mode',         key: 'paymentMode',      dataIndex: 'paymentMode' },
        { title: 'Due',          key: 'dueAmount',        dataIndex: 'dueAmount',        type: 'currency' as const },
      ],
      `customer-history-${(selected?.businessName || 'customer').replace(/\s+/g, '-')}-${range[0].format('YYYY-MM-DD')}`,
      'Customer History',
      {
        title: `${hist.businessName || selected?.businessName || ''} — Customer History`,
        subtitle: `${range[0].format('DD MMM YYYY')} – ${range[1].format('DD MMM YYYY')}  ·  Opening ${fmt(hist.openingBalance || 0)}  ·  Billed ${fmt(hist.totalBilled || 0)}  ·  Collected ${fmt(hist.totalCollected || 0)}  ·  Closing ${fmt(hist.closingBalance || 0)}`,
      },
    );
  };

  const doPrint = () => {
    const { name, lines } = companyHeaderLines(company);
    printStatement({
      companyName: name,
      companyLines: lines,
      title: `${hist.businessName || selected?.businessName || ''} Customer History`,
      meta: `${range[0].format('DD MMM YYYY')} to ${range[1].format('DD MMM YYYY')}`,
      headers: [
        { label: 'S.No', align: 'center' },
        { label: 'Bill No', align: 'left' },
        { label: 'Bill Date', align: 'left' },
        { label: 'Bill Amt', align: 'right' },
        { label: 'Coll. Date', align: 'left' },
        { label: 'Coll. Amt', align: 'right' },
        { label: 'Collected By', align: 'left' },
        { label: 'Mode', align: 'left' },
        { label: 'Due', align: 'right' },
      ],
      rows: rows.map((r: any) => [
        String(r.serialNo ?? ''),
        r.billNo || '',
        r.billDate ? dayjs(r.billDate).format('DD MMM YYYY') : '',
        r.billAmount != null ? numFmt(r.billAmount) : '',
        r.collectionDate ? dayjs(r.collectionDate).format('DD MMM YYYY') : '',
        r.collectionAmount != null ? numFmt(r.collectionAmount) : '',
        r.collectedBy || '',
        r.paymentMode || '',
        r.dueAmount != null ? numFmt(r.dueAmount) : '',
      ]),
      totalRow: ['', 'TOTAL', '', numFmt(hist.totalBilled || 0), '', numFmt(hist.totalCollected || 0), '', '', numFmt(custTotalDue)],
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select
          showSearch filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
          placeholder="Select customer..."
          value={customerId || undefined}
          onChange={setCustomerId}
          style={{ flex: 1, minWidth: 220 }}
          options={customers.map(c => ({ value: c.id, label: c.businessName }))}
        />
        <RangePicker
          value={range}
          onChange={v => v && setRange(v as [dayjs.Dayjs, dayjs.Dayjs])} disabledDate={noFutureDates}
          allowClear={false}
          style={{ borderRadius: 10 }}
        />
        {rows.length > 0 && <Button icon={<PrinterOutlined />} onClick={doPrint} style={{ borderRadius: 8 }}>Print</Button>}
        {rows.length > 0 && <Button icon={<FileExcelOutlined />} onClick={doExport} style={{ borderRadius: 8 }}>Export</Button>}
      </div>

      {!customerId ? (
        <div style={{ background: '#f8fafc', borderRadius: 14, padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
          <ProfileOutlined style={{ fontSize: 40, marginBottom: 12, display: 'block' }} />
          Select a customer to view their bill-wise collection history
        </div>
      ) : isLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : (
        <>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{selected?.businessName}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{selected?.phone}{selected?.address ? ` · ${selected.address}` : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 24 }}>
                {[
                  { label: 'Opening Balance', value: fmt(hist.openingBalance || 0), color: '#0f172a' },
                  { label: 'Total Billed',    value: fmt(hist.totalBilled || 0),    color: '#dc2626' },
                  { label: 'Total Collected', value: fmt(hist.totalCollected || 0), color: '#059669' },
                  { label: 'Closing Balance', value: fmt(hist.closingBalance || 0), color: Number(hist.closingBalance || 0) > 0 ? '#dc2626' : '#059669' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color, marginTop: 3 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Table
            columns={columns}
            dataSource={rows}
            rowKey="serialNo"
            size="middle"
            loading={isLoading}
            pagination={rows.length > 100 ? { pageSize: 100, showSizeChanger: false } : false}
            scroll={{ x: 1080 }}
            locale={{ emptyText: 'No bills or collections in this period' }}
            summary={rows.length ? () => (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ background: '#f8fafc' }}>
                  <Table.Summary.Cell index={0} align="center"><span style={{ fontWeight: 800 }}>TOTAL</span></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} />
                  <Table.Summary.Cell index={2} />
                  <Table.Summary.Cell index={3} align="right"><span style={{ fontWeight: 800, color: '#0f172a' }}>{fmt(hist.totalBilled || 0)}</span></Table.Summary.Cell>
                  <Table.Summary.Cell index={4} />
                  <Table.Summary.Cell index={5} align="right"><span style={{ fontWeight: 800, color: '#059669' }}>{fmt(hist.totalCollected || 0)}</span></Table.Summary.Cell>
                  <Table.Summary.Cell index={6} />
                  <Table.Summary.Cell index={7} />
                  <Table.Summary.Cell index={8} align="right"><span style={{ fontWeight: 800, color: Number(custTotalDue) > 0 ? '#dc2626' : '#059669' }}>{fmt(custTotalDue)}</span></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            ) : undefined}
          />
        </>
      )}
    </div>
  );
};

const SupplierHistory: React.FC = () => {
  const [supplierName, setSupplierName] = useState<string | null>(null);
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([fyStart(), dayjs()]);

  const { data: summariesData } = useGetSupplierPaymentSummariesQuery();
  const suppliers: any[] = summariesData?.data?.content || summariesData?.data || [];

  const { data, isLoading } = useGetSupplierHistoryQuery(
    { supplierName: supplierName!, from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD') },
    { skip: !supplierName }
  );

  const hist: any = data?.data || {};
  const rows: any[] = hist.rows || [];

  const { data: profileData } = useGetCompanyProfileQuery();
  const company = profileData?.data;

  // Goods returned reduce what we owe, but only while the credit is still open or was knocked
  // off a bill — one paid back in cash or replaced with goods leaves the bill standing in full.
  const totalDue = (hist.totalPurchased || 0) - (hist.totalPaid || 0) - (hist.returnCreditOpen || 0);
  const columns = [
    { title: 'S.No', dataIndex: 'serialNo', width: 64, align: 'center' as const },
    { title: 'Invoice No', key: 'invoiceNo', width: 170, render: (_: any, r: any) => { const v = r.invoiceNo || r.returnNo || r.billNo; return v ? <span style={{ fontWeight: 700, color: '#0f172a' }}>{v}</span> : ''; } },
    { title: 'Invoice Date', key: 'billDate', width: 120, render: (_: any, r: any) => { const v = r.billDate || r.returnDate; return v ? dayjs(v).format('DD MMM YYYY') : ''; } },
    { title: 'Inv Amt', dataIndex: 'billAmount', width: 120, align: 'right' as const, render: (v: any) => v != null ? <span style={{ fontWeight: 700, color: '#0f172a' }}>{fmt(v)}</span> : '' },
    { title: 'Returned', key: 'returnAmount', width: 130, align: 'right' as const, render: (_: any, r: any) => (
      r.returnAmount != null
        ? (
          <div>
            <span style={{ color: '#7c3aed', fontWeight: 700 }}>{fmt(r.returnAmount)}</span>
            {!r.reducesPayable && <div style={{ fontSize: 10, color: '#94a3b8' }}>settled back</div>}
          </div>
        )
        : ''
    ) },
    { title: 'Pay Date', dataIndex: 'paymentDate', width: 120, render: (v: string) => v ? dayjs(v).format('DD MMM YYYY') : '' },
    { title: 'Paid Amt', dataIndex: 'paymentAmount', width: 120, align: 'right' as const, render: (v: any) => v != null ? <span style={{ color: '#059669', fontWeight: 600 }}>{fmt(v)}</span> : '' },
    { title: 'Pay Type', dataIndex: 'paymentMethod', width: 120, render: (v: string) => v || '' },
    { title: 'Due Amt', dataIndex: 'dueAmount', width: 120, align: 'right' as const, render: (v: any) => v != null ? <span style={{ color: Number(v) !== 0 ? '#dc2626' : '#059669', fontWeight: 700 }}>{fmt(v)}</span> : '' },
  ];

  const doExport = () => {
    const exportData: any[] = rows.map((r: any) => ({
      serialNo: r.serialNo,
      invoiceNo: r.invoiceNo || r.returnNo || r.billNo || '',
      billDate: r.billDate || r.returnDate || '',
      billAmount: r.billAmount ?? '',
      returnAmount: r.returnAmount ?? '',
      paymentDate: r.paymentDate || '',
      paymentAmount: r.paymentAmount ?? '',
      paymentMethod: r.paymentMethod || '',
      dueAmount: r.dueAmount ?? '',
    }));
    exportData.push({
      serialNo: '', invoiceNo: 'TOTAL', billDate: '',
      billAmount: hist.totalPurchased ?? 0,
      returnAmount: hist.totalReturned ?? 0,
      paymentDate: '', paymentAmount: hist.totalPaid ?? 0,
      paymentMethod: '', dueAmount: totalDue,
    });
    exportToXLSX(
      exportData,
      [
        { title: 'S.No',         key: 'serialNo',      dataIndex: 'serialNo',      type: 'number'   as const, align: 'right' as const },
        { title: 'Invoice No',   key: 'invoiceNo',     dataIndex: 'invoiceNo' },
        { title: 'Invoice Date', key: 'billDate',      dataIndex: 'billDate',      type: 'date'     as const },
        { title: 'Inv Amt',      key: 'billAmount',    dataIndex: 'billAmount',    type: 'currency' as const },
        { title: 'Returned',     key: 'returnAmount',  dataIndex: 'returnAmount',  type: 'currency' as const },
        { title: 'Pay Date',     key: 'paymentDate',   dataIndex: 'paymentDate',   type: 'date'     as const },
        { title: 'Paid Amt',     key: 'paymentAmount', dataIndex: 'paymentAmount', type: 'currency' as const },
        { title: 'Pay Type',     key: 'paymentMethod', dataIndex: 'paymentMethod' },
        { title: 'Due Amt',      key: 'dueAmount',     dataIndex: 'dueAmount',     type: 'currency' as const },
      ],
      `supplier-history-${(supplierName || 'supplier').replace(/\s+/g, '-')}-${range[0].format('YYYY-MM-DD')}`,
      'Supplier History',
      {
        title: `${hist.supplierName || supplierName || ''} — Supplier History`,
        subtitle: `${range[0].format('DD MMM YYYY')} – ${range[1].format('DD MMM YYYY')}  ·  Opening ${fmt(hist.openingBalance || 0)}  ·  Purchased ${fmt(hist.totalPurchased || 0)}  ·  Returned ${fmt(hist.totalReturned || 0)}  ·  Paid ${fmt(hist.totalPaid || 0)}  ·  Closing ${fmt(hist.closingBalance || 0)}`,
      },
    );
  };

  const doPrint = () => {
    const { name, lines } = companyHeaderLines(company);
    printStatement({
      companyName: name,
      companyLines: lines,
      title: `${hist.supplierName || supplierName || ''} Supplier History`,
      meta: `${range[0].format('DD MMM YYYY')} to ${range[1].format('DD MMM YYYY')}`,
      headers: [
        { label: 'S.No', align: 'center' },
        { label: 'Invoice No', align: 'left' },
        { label: 'Invoice Date', align: 'left' },
        { label: 'Inv Amt', align: 'right' },
        { label: 'Returned', align: 'right' },
        { label: 'Pay Date', align: 'left' },
        { label: 'Paid Amt', align: 'right' },
        { label: 'Pay Type', align: 'left' },
        { label: 'Due Amt', align: 'right' },
      ],
      rows: rows.map((r: any) => [
        String(r.serialNo ?? ''),
        r.invoiceNo || r.returnNo || r.billNo || '',
        (r.billDate || r.returnDate) ? dayjs(r.billDate || r.returnDate).format('DD MMM YYYY') : '',
        r.billAmount != null ? numFmt(r.billAmount) : '',
        r.returnAmount != null ? numFmt(r.returnAmount) : '',
        r.paymentDate ? dayjs(r.paymentDate).format('DD MMM YYYY') : '',
        r.paymentAmount != null ? numFmt(r.paymentAmount) : '',
        r.paymentMethod || '',
        r.dueAmount != null ? numFmt(r.dueAmount) : '',
      ]),
      totalRow: ['', 'TOTAL', '', numFmt(hist.totalPurchased || 0), numFmt(hist.totalReturned || 0), '', numFmt(hist.totalPaid || 0), '', numFmt(totalDue)],
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select
          showSearch filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
          placeholder="Select supplier..."
          value={supplierName || undefined}
          onChange={setSupplierName}
          style={{ flex: 1, minWidth: 220 }}
          options={suppliers.map(s => ({ value: s.supplierName, label: s.supplierName }))}
        />
        <RangePicker
          value={range}
          onChange={v => v && setRange(v as [dayjs.Dayjs, dayjs.Dayjs])} disabledDate={noFutureDates}
          allowClear={false}
          style={{ borderRadius: 10 }}
        />
        {rows.length > 0 && <Button icon={<PrinterOutlined />} onClick={doPrint} style={{ borderRadius: 8 }}>Print</Button>}
        {rows.length > 0 && <Button icon={<FileExcelOutlined />} onClick={doExport} style={{ borderRadius: 8 }}>Export</Button>}
      </div>

      {!supplierName ? (
        <div style={{ background: '#f8fafc', borderRadius: 14, padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
          <ContainerOutlined style={{ fontSize: 40, marginBottom: 12, display: 'block' }} />
          Select a supplier to view their bill-wise purchase &amp; payment history
        </div>
      ) : isLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : (
        <>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{hist.supplierName || supplierName}</div>
              <div style={{ display: 'flex', gap: 24 }}>
                {[
                  { label: 'Opening Balance',  value: fmt(hist.openingBalance || 0),  color: '#0f172a' },
                  { label: 'Total Purchased',  value: fmt(hist.totalPurchased || 0),  color: '#dc2626' },
                  { label: 'Goods Returned',   value: fmt(hist.totalReturned || 0),   color: '#7c3aed' },
                  { label: 'Total Paid',       value: fmt(hist.totalPaid || 0),       color: '#059669' },
                  { label: 'Closing Balance',  value: fmt(hist.closingBalance || 0),  color: Number(hist.closingBalance || 0) > 0 ? '#dc2626' : '#059669' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color, marginTop: 3 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Table
            columns={columns}
            dataSource={rows}
            rowKey="serialNo"
            size="middle"
            loading={isLoading}
            pagination={rows.length > 100 ? { pageSize: 100, showSizeChanger: false } : false}
            scroll={{ x: 1000 }}
            locale={{ emptyText: 'No purchases or payments in this period' }}
            summary={rows.length ? () => (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ background: '#f8fafc' }}>
                  <Table.Summary.Cell index={0} align="center"><span style={{ fontWeight: 800 }}>TOTAL</span></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} />
                  <Table.Summary.Cell index={2} />
                  <Table.Summary.Cell index={3} align="right"><span style={{ fontWeight: 800, color: '#0f172a' }}>{fmt(hist.totalPurchased || 0)}</span></Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right"><span style={{ fontWeight: 800, color: '#7c3aed' }}>{fmt(hist.totalReturned || 0)}</span></Table.Summary.Cell>
                  <Table.Summary.Cell index={5} />
                  <Table.Summary.Cell index={6} align="right"><span style={{ fontWeight: 800, color: '#059669' }}>{fmt(hist.totalPaid || 0)}</span></Table.Summary.Cell>
                  <Table.Summary.Cell index={7} />
                  <Table.Summary.Cell index={8} align="right"><span style={{ fontWeight: 800, color: Number(totalDue) > 0 ? '#dc2626' : '#059669' }}>{fmt(totalDue)}</span></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            ) : undefined}
          />
        </>
      )}
    </div>
  );
};

const LedgerPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const customerIdFromUrl = searchParams.get('customerId');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>Ledger Report</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>Complete transaction history for customers and vendors</div>
      </div>
      <Tabs
        activeKey={tabFromUrl || 'customer'}
        onChange={(key) => setSearchParams(key === 'customer' ? {} : { tab: key })}
        items={[
          { key: 'customer',  label: <span><UserOutlined /> Customer Ledger</span>,     children: <CustomerLedger /> },
          { key: 'history',   label: <span><ProfileOutlined /> Customer History</span>,   children: <CustomerHistory initialCustomerId={customerIdFromUrl} /> },
          { key: 'vendor',    label: <span><ShopOutlined /> Vendor Ledger</span>,        children: <VendorLedger /> },
          { key: 'supplier',  label: <span><ContainerOutlined /> Supplier History</span>, children: <SupplierHistory /> },
        ]}
      />
    </div>
  );
};

export default LedgerPage;
