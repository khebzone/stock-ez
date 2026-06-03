import React, { useState } from 'react';
import { DatePicker, Select, Skeleton, Tabs, Button } from 'antd';
import { UserOutlined, ShopOutlined, FileExcelOutlined } from '@ant-design/icons';
import { exportToXLSX } from '../../components/TableToolbar';
import dayjs from 'dayjs';
import { useGetCustomersQuery } from '../../store/api/customerApi';
import { useGetCustomerLedgerQuery, useGetVendorLedgerQuery } from '../../store/api/reportApi';

const { RangePicker } = DatePicker;

const fmt = (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const CustomerLedger: React.FC = () => {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs()]);

  const { data: customersData } = useGetCustomersQuery({});
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
          showSearch optionFilterProp="label"
          placeholder="Select customer..."
          value={customerId || undefined}
          onChange={setCustomerId}
          style={{ flex: 1, minWidth: 220 }}
          options={customers.map(c => ({ value: c.id, label: `${c.businessName} — ${c.phone}` }))}
        />
        <RangePicker
          value={range}
          onChange={v => v && setRange(v as [dayjs.Dayjs, dayjs.Dayjs])}
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
        <RangePicker value={range} onChange={v => v && setRange(v as [dayjs.Dayjs, dayjs.Dayjs])} allowClear={false} style={{ borderRadius: 10 }} />
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

const LedgerPage: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>Ledger Report</div>
      <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>Complete transaction history for customers and vendors</div>
    </div>
    <Tabs
      defaultActiveKey="customer"
      items={[
        { key: 'customer', label: <span><UserOutlined /> Customer Ledger</span>, children: <CustomerLedger /> },
        { key: 'vendor',   label: <span><ShopOutlined /> Vendor Ledger</span>,   children: <VendorLedger /> },
      ]}
    />
  </div>
);

export default LedgerPage;
