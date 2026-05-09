import React, { useState, useEffect } from 'react';
import { Modal, Skeleton, Input, Button, DatePicker, Form, Select, message, Table, Tabs, InputNumber } from 'antd';
import {
  PlusOutlined, InboxOutlined, WarningOutlined,
  SearchOutlined, DownloadOutlined, PrinterOutlined, EditOutlined, HistoryOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useGetPurchasesQuery, useGetNearExpiryAlertsQuery, useUpdatePurchaseMutation, useGetPurchaseAuditQuery } from '../../store/api/purchaseApi';
import { useGetSuppliersQuery } from '../../store/api/supplierApi';
import { exportToCSV } from '../../components/TableToolbar';
import { formatINR } from '../../utils/format';
import PurchaseEntryPage from './PurchaseEntryPage';
import PurchasePrint from '../../components/PurchasePrint';

const { RangePicker } = DatePicker;
const P = '#059669';
const user = JSON.parse(localStorage.getItem('user') || '{}');
const isAdmin = user.role === 'ADMIN';

const ACTION_STYLE: Record<string, { color: string; bg: string }> = {
  CREATED: { color: '#059669', bg: '#ecfdf5' },
  UPDATED: { color: '#2563eb', bg: '#eff6ff' },
  DELETED: { color: '#dc2626', bg: '#fef2f2' },
};

const AuditTab: React.FC<{ purchaseId: string }> = ({ purchaseId }) => {
  const { data, isLoading } = useGetPurchaseAuditQuery(purchaseId);
  const logs: any[] = data?.data || [];

  if (isLoading) return <Skeleton active paragraph={{ rows: 3 }} />;
  if (logs.length === 0)
    return <div style={{ textAlign: 'center', color: '#94a3b8', padding: '32px 0', fontSize: 13 }}>No audit records found.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {logs.map((log: any, i: number) => {
        const style = ACTION_STYLE[log.action] || { color: '#64748b', bg: '#f8fafc' };
        const dt = new Date(log.performedAt);
        const dateStr = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        return (
          <div key={log.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < logs.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
            <div style={{ flexShrink: 0, paddingTop: 2 }}>
              <span style={{ background: style.bg, color: style.color, fontWeight: 700, fontSize: 11, padding: '2px 8px', borderRadius: 4, letterSpacing: 0.3 }}>
                {log.action}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#0f172a', lineHeight: 1.5 }}>{log.description}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                {log.performedBy} &nbsp;·&nbsp; {dateStr} {timeStr}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const PurchaseListPage: React.FC = () => {
  const [detailId, setDetailId]           = useState<string | null>(null);
  const [showEntry, setShowEntry]         = useState(false);
  const [showEdit, setShowEdit]           = useState(false);
  const [page, setPage]                   = useState(0);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateRange, setDateRange]         = useState<[Dayjs, Dayjs] | null>(null);
  const [printPurchase, setPrintPurchase] = useState<any>(null);
  const [itemEdits, setItemEdits]         = useState<Record<string, any>>({});
  const [editForm] = Form.useForm();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(supplierSearch), 400);
    return () => clearTimeout(t);
  }, [supplierSearch]);

  const { data: suppData } = useGetSuppliersQuery({});
  const suppliers: any[] = suppData?.data?.content || suppData?.data || [];

  const [updatePurchase, { isLoading: updating }] = useUpdatePurchaseMutation();

  const { data: purchasesData, isLoading, isError, error: listError, refetch } = useGetPurchasesQuery({
    page,
    size: 20,
    supplierName: debouncedSearch || undefined,
    from: dateRange?.[0]?.format('YYYY-MM-DD'),
    to: dateRange?.[1]?.format('YYYY-MM-DD'),
  });
  const { data: alertsData } = useGetNearExpiryAlertsQuery({ days: 30 });

  const purchases: any[] = purchasesData?.data?.content || [];
  const totalPages: number = purchasesData?.data?.totalPages || 0;
  const alerts: any[] = alertsData?.data || [];
  const nearExpiry = alerts.filter((a: any) => a.daysToExpiry >= 0);
  const expired    = alerts.filter((a: any) => a.daysToExpiry < 0);
  const selected   = purchases.find((p: any) => p.id === detailId);

  const hasFilter = !!debouncedSearch || !!dateRange;

  const handleExport = () => {
    const cols = [
      { title: 'Entry No',    key: 'entryNumber',   dataIndex: 'entryNumber' },
      { title: 'Supplier',    key: 'supplierName',  dataIndex: 'supplierName' },
      { title: 'Date',        key: 'purchaseDate',  dataIndex: 'purchaseDate' },
      { title: 'Invoice No',  key: 'invoiceNumber', dataIndex: 'invoiceNumber' },
      { title: 'Total Amount',key: 'totalAmount',   dataIndex: 'totalAmount' },
      { title: 'Products',    key: 'products',      dataIndex: 'products' },
      { title: 'Created By',  key: 'createdByName', dataIndex: 'createdByName' },
    ];
    const data = purchases.map((p: any) => ({
      ...p,
      products: p.items?.length || 0,
      createdByName: p.createdBy?.fullName || '',
    }));
    exportToCSV(data, cols, `purchases-${new Date().toISOString().split('T')[0]}`);
  };

  const handleOpenEdit = () => {
    if (!selected) return;
    editForm.setFieldsValue({
      supplierName: selected.supplierName,
      supplierId: selected.supplierId || undefined,
      purchaseDate: dayjs(selected.purchaseDate),
      invoiceNumber: selected.invoiceNumber || '',
      notes: selected.notes || '',
    });
    const initialEdits: Record<string, any> = {};
    (selected.items || []).forEach((item: any) => {
      initialEdits[item.id] = {
        mrp: Number(item.mrp),
        expiryDate: item.expiryDate ? dayjs(item.expiryDate) : null,
        mfgDate: item.mfgDate ? dayjs(item.mfgDate) : null,
        minSaleRate: item.minSaleRate != null ? Number(item.minSaleRate) : null,
        maxSaleRate: item.maxSaleRate != null ? Number(item.maxSaleRate) : null,
      };
    });
    setItemEdits(initialEdits);
    setShowEdit(true);
  };

  const handleEditSave = async (values: any) => {
    try {
      const itemUpdates = Object.entries(itemEdits).map(([itemId, fields]) => ({
        itemId,
        mrp: fields.mrp || null,
        expiryDate: fields.expiryDate ? fields.expiryDate.format('YYYY-MM-DD') : null,
        mfgDate: fields.mfgDate ? fields.mfgDate.format('YYYY-MM-DD') : null,
        minSaleRate: fields.minSaleRate || null,
        maxSaleRate: fields.maxSaleRate || null,
      }));
      await updatePurchase({
        id: detailId!,
        body: {
          supplierName: values.supplierName,
          supplierId: values.supplierId || null,
          purchaseDate: values.purchaseDate.format('YYYY-MM-DD'),
          invoiceNumber: values.invoiceNumber || null,
          notes: values.notes || null,
          itemUpdates,
        },
      }).unwrap();
      message.success('Purchase updated');
      setShowEdit(false);
    } catch {
      message.error('Failed to update purchase');
    }
  };

  const handleClearFilters = () => {
    setSupplierSearch('');
    setDebouncedSearch('');
    setDateRange(null);
    setPage(0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Hidden print target */}
      {printPurchase && <PurchasePrint purchase={printPurchase} />}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>Purchase Entries</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>Manage incoming stock and batch tracking</div>
        </div>
        <button
          onClick={() => setShowEntry(true)}
          style={{
            background: P, border: 'none', borderRadius: 12, color: '#fff',
            fontWeight: 700, fontSize: 14, padding: '11px 20px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 3px 12px rgba(5,150,105,0.3)',
          }}
        >
          <PlusOutlined /> New Purchase Entry
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <RangePicker
          value={dateRange}
          onChange={(vals) => { setDateRange(vals as [Dayjs, Dayjs] | null); setPage(0); }}
          format="DD MMM YYYY"
          allowClear
          style={{ borderRadius: 8 }}
          placeholder={['From date', 'To date']}
        />
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Search supplier..."
          value={supplierSearch}
          onChange={e => { setSupplierSearch(e.target.value); setPage(0); }}
          allowClear
          style={{ width: 200, borderRadius: 8 }}
        />
        {hasFilter && (
          <Button size="small" onClick={handleClearFilters} style={{ borderRadius: 8, color: '#64748b' }}>
            Clear
          </Button>
        )}
        <Button
          icon={<DownloadOutlined />}
          onClick={handleExport}
          disabled={purchases.length === 0}
          style={{ borderRadius: 8, marginLeft: 'auto' }}
        >
          Export CSV
        </Button>
      </div>

      {/* Near-expiry alerts */}
      {(nearExpiry.length > 0 || expired.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: expired.length > 0 ? '1fr 1fr' : '1fr', gap: 14 }}>
          {nearExpiry.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 14, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <WarningOutlined style={{ color: '#d97706', fontSize: 18 }} />
                <div style={{ fontWeight: 700, color: '#92400e', fontSize: 14 }}>Near Expiry ({nearExpiry.length} batches)</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {nearExpiry.slice(0, 5).map((a: any) => (
                  <div key={a.batchId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{a.product?.name}</span>
                    <span style={{ color: '#d97706', fontWeight: 600 }}>
                      {a.daysToExpiry === 0 ? 'Expires today' : `${a.daysToExpiry}d · ${a.quantityAvailable} ${a.product?.unit || 'units'}`}
                    </span>
                  </div>
                ))}
                {nearExpiry.length > 5 && <div style={{ fontSize: 12, color: '#b45309' }}>+{nearExpiry.length - 5} more batches</div>}
              </div>
            </div>
          )}
          {expired.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 14, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>⛔</span>
                <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 14 }}>Expired Stock ({expired.length} batches)</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {expired.slice(0, 5).map((a: any) => (
                  <div key={a.batchId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{a.product?.name}</span>
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>{a.quantityAvailable} {a.product?.unit || 'units'} remaining</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* API error */}
      {isError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', color: '#dc2626', fontSize: 13 }}>
          <span style={{ fontWeight: 700 }}>Failed to load purchases — </span>
          {(listError as any)?.data?.message || (listError as any)?.error || 'Check backend logs for details.'}
        </div>
      )}

      {/* Purchases list */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 16 }}>
              <Skeleton active paragraph={{ rows: 2 }} />
            </div>
          ))}
        </div>
      ) : purchases.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28, color: P }}>
            <InboxOutlined />
          </div>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 16, marginBottom: 6 }}>
            {hasFilter ? 'No entries match your filters' : 'No purchase entries yet'}
          </div>
          <div style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
            {hasFilter ? 'Try adjusting the date range or supplier search.' : 'Create your first purchase entry to start tracking stock batches.'}
          </div>
          {!hasFilter && (
            <button
              onClick={() => setShowEntry(true)}
              style={{ background: P, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 24px', cursor: 'pointer' }}
            >
              Create Purchase Entry
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {purchases.map((p: any) => (
            <div
              key={p.id}
              onClick={() => setDetailId(p.id)}
              style={{
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
                padding: '16px 20px', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)', transition: 'all 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = P}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'}
            >
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: P, fontSize: 20, flexShrink: 0 }}>
                  <InboxOutlined />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>{p.entryNumber}</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{p.supplierName} · {p.purchaseDate}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{p.items?.length || 0} product{(p.items?.length || 0) !== 1 ? 's' : ''}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 17 }}>{formatINR(p.totalAmount)}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>by {p.createdBy?.fullName}</div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: page === 0 ? 'not-allowed' : 'pointer', color: page === 0 ? '#94a3b8' : '#0f172a', fontWeight: 600 }}>
                ← Prev
              </button>
              <span style={{ padding: '6px 14px', fontSize: 13, color: '#64748b' }}>Page {page + 1} of {totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', color: page >= totalPages - 1 ? '#94a3b8' : '#0f172a', fontWeight: 600 }}>
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* New Purchase Entry modal */}
      <Modal
        open={showEntry} onCancel={() => setShowEntry(false)}
        footer={null} width="96vw" style={{ top: 16 }}
        styles={{ body: { padding: 20 } }} destroyOnClose
      >
        <PurchaseEntryPage
          onClose={() => setShowEntry(false)}
          onSaved={() => { setShowEntry(false); refetch(); }}
        />
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={selected ? `${selected.entryNumber} — ${selected.supplierName}` : ''}
        open={!!detailId}
        onCancel={() => setDetailId(null)}
        footer={[
          <Button
            key="print"
            icon={<PrinterOutlined />}
            onClick={() => { setPrintPurchase(selected); setTimeout(() => window.print(), 150); }}
          >
            Print
          </Button>,
          isAdmin && (
            <Button key="edit" icon={<EditOutlined />} onClick={handleOpenEdit}>
              Edit
            </Button>
          ),
          <Button key="close" type="primary" onClick={() => setDetailId(null)}>Close</Button>,
        ].filter(Boolean)}
        width={960}
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Header summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, background: '#f8fafc', borderRadius: 10, padding: '12px 16px' }}>
              {[
                { label: 'Purchase Date', value: selected.purchaseDate },
                { label: 'Supplier',      value: selected.supplierName },
                { label: 'Invoice No.',   value: selected.invoiceNumber || '—' },
                { label: 'Taxable',       value: formatINR(selected.totalTaxable) },
                { label: 'CGST',          value: formatINR(selected.totalCgst) },
                { label: 'SGST',          value: formatINR(selected.totalSgst) },
                { label: 'Net Total',     value: formatINR(selected.totalAmount) },
                { label: 'Items',         value: `${(selected.items || []).length} product${(selected.items || []).length !== 1 ? 's' : ''}` },
              ].map(row => (
                <div key={row.label}>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{row.label}</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, marginTop: 2 }}>{row.value}</div>
                </div>
              ))}
            </div>
            {selected.notes && (
              <div style={{ fontSize: 13, color: '#64748b', background: '#fffbeb', borderRadius: 8, padding: '8px 12px' }}>{selected.notes}</div>
            )}

            <Tabs
              size="small"
              items={[
                {
                  key: 'items',
                  label: 'Items',
                  children: (
                    <Table
                      dataSource={selected.items || []}
                      rowKey="id"
                      size="small"
                      pagination={false}
                      scroll={{ x: 'max-content' }}
                      columns={[
                        {
                          title: '#',
                          render: (_: any, __: any, i: number) => <span style={{ color: '#94a3b8' }}>{i + 1}</span>,
                          width: 36,
                        },
                        {
                          title: 'Product',
                          dataIndex: 'product',
                          width: 160,
                          render: (p: any) => (
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{p?.name}</div>
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>{[p?.brand, p?.unit].filter(Boolean).join(' · ')}</div>
                            </div>
                          ),
                        },
                        {
                          title: 'Batch No.',
                          dataIndex: 'batchNumber',
                          width: 130,
                          render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
                        },
                        {
                          title: 'Expiry',
                          dataIndex: 'expiryDate',
                          width: 95,
                          render: (d: string) => {
                            if (!d) return <span style={{ color: '#94a3b8' }}>—</span>;
                            const days = Math.floor((new Date(d).getTime() - Date.now()) / 86400000);
                            const color = days < 0 ? '#dc2626' : days <= 30 ? '#d97706' : '#0f172a';
                            return <span style={{ color, fontWeight: 600, fontSize: 12 }}>{d}</span>;
                          },
                        },
                        {
                          title: 'Qty',
                          dataIndex: 'quantity',
                          align: 'right' as const,
                          width: 55,
                          render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
                        },
                        {
                          title: 'MRP',
                          dataIndex: 'mrp',
                          align: 'right' as const,
                          width: 80,
                          render: (v: any) => formatINR(v),
                        },
                        {
                          title: 'Purch. Rate',
                          dataIndex: 'purchaseRate',
                          align: 'right' as const,
                          width: 90,
                          render: (v: any) => formatINR(v),
                        },
                        {
                          title: 'Taxable',
                          dataIndex: 'taxableAmount',
                          align: 'right' as const,
                          width: 80,
                          render: (v: any) => formatINR(v),
                        },
                        {
                          title: 'CGST',
                          dataIndex: 'cgstAmount',
                          align: 'right' as const,
                          width: 80,
                          render: (v: any, row: any) => (
                            <div>
                              <div>{formatINR(v)}</div>
                              <div style={{ fontSize: 10, color: '#94a3b8' }}>{row.cgstPercent || 0}%</div>
                            </div>
                          ),
                        },
                        {
                          title: 'SGST',
                          dataIndex: 'sgstAmount',
                          align: 'right' as const,
                          width: 80,
                          render: (v: any, row: any) => (
                            <div>
                              <div>{formatINR(v)}</div>
                              <div style={{ fontSize: 10, color: '#94a3b8' }}>{row.sgstPercent || 0}%</div>
                            </div>
                          ),
                        },
                        {
                          title: 'Net Amt',
                          dataIndex: 'amount',
                          align: 'right' as const,
                          width: 90,
                          render: (v: any) => <span style={{ fontWeight: 700, color: P }}>{formatINR(v)}</span>,
                        },
                        {
                          title: 'Min Sale',
                          dataIndex: 'minSaleRate',
                          align: 'right' as const,
                          width: 80,
                          render: (v: any) => v != null ? formatINR(v) : <span style={{ color: '#94a3b8' }}>—</span>,
                        },
                        {
                          title: 'Max Sale',
                          dataIndex: 'maxSaleRate',
                          align: 'right' as const,
                          width: 80,
                          render: (v: any) => v != null ? formatINR(v) : <span style={{ color: '#94a3b8' }}>—</span>,
                        },
                      ]}
                      summary={() => (
                        <Table.Summary.Row style={{ background: '#f8fafc', fontWeight: 700 }}>
                          <Table.Summary.Cell index={0} colSpan={4}>Total</Table.Summary.Cell>
                          <Table.Summary.Cell index={4} align="right">
                            {(selected.items || []).reduce((s: number, i: any) => s + (i.quantity || 0), 0)}
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={5} colSpan={2} />
                          <Table.Summary.Cell index={7} align="right">{formatINR(selected.totalTaxable)}</Table.Summary.Cell>
                          <Table.Summary.Cell index={8} align="right">{formatINR(selected.totalCgst)}</Table.Summary.Cell>
                          <Table.Summary.Cell index={9} align="right">{formatINR(selected.totalSgst)}</Table.Summary.Cell>
                          <Table.Summary.Cell index={10} align="right" style={{ color: P }}>{formatINR(selected.totalAmount)}</Table.Summary.Cell>
                          <Table.Summary.Cell index={11} colSpan={2} />
                        </Table.Summary.Row>
                      )}
                    />
                  ),
                },
                {
                  key: 'audit',
                  label: (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <HistoryOutlined /> Audit History
                    </span>
                  ),
                  children: <AuditTab purchaseId={detailId!} />,
                },
              ]}
            />
          </div>
        )}
      </Modal>
      {/* Edit modal */}
      <Modal
        title={`Edit Purchase — ${selected?.entryNumber}`}
        open={showEdit}
        onCancel={() => setShowEdit(false)}
        footer={null}
        width={860}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSave} style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="supplierId" label="Supplier">
              <Select
                showSearch optionFilterProp="label" allowClear
                placeholder="Select supplier"
                options={suppliers.map((s: any) => ({ value: s.id, label: s.name }))}
              />
            </Form.Item>
            <Form.Item name="supplierName" label="Supplier Name *" rules={[{ required: true, message: 'Required' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="purchaseDate" label="Purchase Date *" rules={[{ required: true, message: 'Required' }]}>
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" allowClear={false} />
            </Form.Item>
            <Form.Item name="invoiceNumber" label="Invoice / Ref No.">
              <Input placeholder="e.g. INV-2026-0421" />
            </Form.Item>
          </div>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>

          {/* Batch items */}
          {(selected?.items || []).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Batch Items — Edit expiry, MRP, and sale rates
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>Product</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>Batch</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>Qty</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>MRP</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: '#6b7280', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>Expiry</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>Min Sale</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>Max Sale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selected?.items || []).map((item: any, idx: number) => {
                      const edit = itemEdits[item.id] || {};
                      const setEdit = (field: string, val: any) =>
                        setItemEdits(prev => ({ ...prev, [item.id]: { ...prev[item.id], [field]: val } }));
                      return (
                        <tr key={item.id} style={{ borderTop: idx > 0 ? '1px solid #f1f5f9' : 'none' }}>
                          <td style={{ padding: '8px 12px', color: '#0f172a', fontWeight: 500 }}>{item.product?.name}</td>
                          <td style={{ padding: '8px 12px', color: '#6b7280', fontFamily: 'monospace', fontSize: 11 }}>{item.batchNumber}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#374151' }}>{item.quantity}</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                            <InputNumber
                              size="small" variant="outlined" min={0.01} precision={2}
                              style={{ width: 80 }} styles={{ input: { textAlign: 'right' } }}
                              value={edit.mrp} onChange={v => setEdit('mrp', v)}
                            />
                          </td>
                          <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                            <DatePicker
                              size="small" format="MM/YY" picker="month"
                              style={{ width: 90 }}
                              value={edit.expiryDate}
                              onChange={v => setEdit('expiryDate', v)}
                            />
                          </td>
                          <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                            <InputNumber
                              size="small" variant="outlined" min={0} precision={2}
                              style={{ width: 80 }} styles={{ input: { textAlign: 'right' } }}
                              value={edit.minSaleRate} onChange={v => setEdit('minSaleRate', v)}
                            />
                          </td>
                          <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                            <InputNumber
                              size="small" variant="outlined" min={0} precision={2}
                              style={{ width: 80 }} styles={{ input: { textAlign: 'right' } }}
                              value={edit.maxSaleRate} onChange={v => setEdit('maxSaleRate', v)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                Quantity and product cannot be changed. To correct quantities, delete and recreate the entry.
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={updating}>Save Changes</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default PurchaseListPage;
