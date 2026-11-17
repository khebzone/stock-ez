import React, { useState, useEffect, useRef } from 'react';
import { Modal, Skeleton, Input, Button, DatePicker, message, Table, Tabs, Grid, Segmented, Tooltip, Popconfirm } from 'antd';
import {
  PlusOutlined, InboxOutlined, WarningOutlined,
  SearchOutlined, FileExcelOutlined, PrinterOutlined, EditOutlined, HistoryOutlined,
  TableOutlined, AppstoreOutlined, CloseCircleOutlined, DeleteOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import {
  useGetPurchasesQuery, useGetNearExpiryAlertsQuery, useVoidPurchaseMutation, useGetPurchaseAuditQuery,
  useGetPurchaseDraftsQuery, useLazyGetPurchaseDraftQuery, useDeletePurchaseDraftMutation,
} from '../../store/api/purchaseApi';
import { exportToXLSX } from '../../components/TableToolbar';
import { formatINR } from '../../utils/format';
import PurchaseEntryPage from './PurchaseEntryPage';
import PurchasePrint from '../../components/PurchasePrint';
import { hasPermission } from '../../utils/permissions';

const { RangePicker } = DatePicker;
const P = '#059669';
const canEditPurchase = hasPermission('PURCHASES_EDIT');

const ACTION_STYLE: Record<string, { color: string; bg: string }> = {
  CREATED: { color: '#059669', bg: '#ecfdf5' },
  UPDATED: { color: '#2563eb', bg: '#eff6ff' },
  DELETED: { color: '#dc2626', bg: '#fef2f2' },
};

const AuditTab: React.FC<{ purchaseId: string }> = ({ purchaseId }) => {
  const { data, isLoading } = useGetPurchaseAuditQuery(purchaseId, { refetchOnMountOrArgChange: true });
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
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [detailId, setDetailId]           = useState<string | null>(null);
  const [activeTab, setActiveTab]         = useState('items');
  const [showEntry, setShowEntry]         = useState(false);
  const [editEntry, setEditEntry]         = useState<any>(null);
  const [openDraft, setOpenDraft]         = useState<any>(null);
  const [page, setPage]                   = useState(0);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [debouncedInvoice, setDebouncedInvoice] = useState('');
  const [dateRange, setDateRange]         = useState<[Dayjs, Dayjs] | null>(null);
  const [statusFilter, setStatusFilter]   = useState<'ACTIVE' | 'VOID' | 'ALL'>('ACTIVE');
  const [printPurchase, setPrintPurchase] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => (localStorage.getItem('purchaseView') as 'table' | 'cards') || 'table');
  const [showAllNearExpiry, setShowAllNearExpiry] = useState(false);
  const [showAllExpired, setShowAllExpired] = useState(false);

  const setView = (v: 'table' | 'cards') => { setViewMode(v); localStorage.setItem('purchaseView', v); };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(supplierSearch), 400);
    return () => clearTimeout(t);
  }, [supplierSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedInvoice(invoiceSearch), 400);
    return () => clearTimeout(t);
  }, [invoiceSearch]);

  const [voidPurchase, { isLoading: voiding }] = useVoidPurchaseMutation();

  const { data: purchasesData, isLoading, isError, error: listError, refetch } = useGetPurchasesQuery({
    page,
    size: 20,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    supplierName: debouncedSearch || undefined,
    invoiceNumber: debouncedInvoice || undefined,
    from: dateRange?.[0]?.format('YYYY-MM-DD'),
    to: dateRange?.[1]?.format('YYYY-MM-DD'),
  }, { refetchOnMountOrArgChange: true });
  const { data: alertsData } = useGetNearExpiryAlertsQuery({ days: 30 }, { refetchOnMountOrArgChange: true });

  const purchases: any[] = purchasesData?.data?.content || [];
  const totalPages: number = purchasesData?.data?.totalPages || 0;
  const alerts: any[] = alertsData?.data || [];
  const nearExpiry = alerts.filter((a: any) => a.daysToExpiry >= 0);
  const expired    = alerts.filter((a: any) => a.daysToExpiry < 0);
  const foundEntry = purchases.find((p: any) => p.id === detailId);
  const lastSelected = useRef<any>(null);
  if (foundEntry) lastSelected.current = foundEntry;
  const selected = detailId ? (foundEntry ?? (lastSelected.current?.id === detailId ? lastSelected.current : undefined)) : undefined;
  const isVoided   = selected?.status === 'VOID';

  const { data: voidAuditData } = useGetPurchaseAuditQuery(detailId!, { skip: !detailId || !isVoided });
  const voidLog = isVoided ? (voidAuditData?.data || []).find((l: any) => l.action === 'VOIDED') : undefined;

  const soldLines: string[] = !selected ? [] : (selected.items || [])
    .map((i: any) => {
      const units = i.quantity + (i.freeQty || 0);
      const sold = units - (i.quantityAvailable ?? units);
      return sold > 0 ? `${i.product?.name} (${sold} sold)` : '';
    })
    .filter(Boolean);
  const paidAmt = Number(selected?.paidAmount || 0);
  const voidBlockReason = !selected || isVoided ? '' : paidAmt > 0
    ? `${formatINR(paidAmt)} already paid against this bill — reverse the payment(s) first.`
    : soldLines.length > 0
      ? `Already sold: ${soldLines.slice(0, 3).join(', ')}${soldLines.length > 3 ? ` +${soldLines.length - 3} more` : ''}. Remove only the unsold lines instead.`
      : '';
  const canVoidSelected = !isVoided && !voidBlockReason;

  const paymentStatus = (p: any) => {
    if (p.status === 'VOID') return '—';
    const paid = Number(p.paidAmount || 0);
    if (paid <= 0) return 'Unpaid';
    return paid >= Number(p.totalAmount || 0) ? 'Paid' : 'Partial';
  };

  const hasFilter = !!debouncedSearch || !!debouncedInvoice || !!dateRange || statusFilter !== 'ACTIVE';
  const effectiveView = isMobile ? 'cards' : viewMode;

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
    exportToXLSX(data, cols, `purchases-${new Date().toISOString().split('T')[0]}`);
  };

  const handleOpenEdit = () => {
    if (!selected) return;
    setEditEntry(selected);
    setDetailId(null);
    setActiveTab('items');
    setShowEntry(true);
  };

  const closeEntry = () => { setShowEntry(false); setEditEntry(null); setOpenDraft(null); };

  const canCreate = hasPermission('PURCHASES_CREATE');
  const { data: draftsData } = useGetPurchaseDraftsQuery(undefined, { skip: !canCreate, refetchOnMountOrArgChange: true });
  const drafts: any[] = draftsData?.data || [];
  const [loadDraft, { isFetching: loadingDraft }] = useLazyGetPurchaseDraftQuery();
  const [deleteDraft] = useDeletePurchaseDraftMutation();

  const handleOpenDraft = async (id: string) => {
    try {
      const res = await loadDraft(id).unwrap();
      setEditEntry(null);
      setOpenDraft(res?.data);
      setShowEntry(true);
    } catch (err: any) {
      message.error(err?.data?.message || 'Could not open the draft');
    }
  };

  const handleDeleteDraft = async (id: string) => {
    try {
      await deleteDraft(id).unwrap();
      message.success('Draft deleted');
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to delete draft');
    }
  };

  const draftColumns = [
    { title: 'Supplier', key: 'supplier', render: (_: any, d: any) => d.supplierName || <span style={{ color: '#94a3b8' }}>Not selected</span> },
    { title: 'Invoice No', dataIndex: 'invoiceNumber', key: 'invoice', width: 140, render: (v: string) => v || '—' },
    { title: 'Bill Date', dataIndex: 'purchaseDate', key: 'date', width: 120, render: (v: string) => v ? dayjs(v).format('DD MMM YYYY') : '—' },
    { title: 'Products', dataIndex: 'lineCount', key: 'lines', width: 90, align: 'right' as const },
    { title: 'Amount', dataIndex: 'totalAmount', key: 'amount', width: 130, align: 'right' as const, render: (v: number) => formatINR(v) },
    { title: 'Last Saved', key: 'saved', width: 210, render: (_: any, d: any) => `${dayjs(d.updatedAt).format('DD MMM YYYY, hh:mm A')}${d.updatedByName ? ` · ${d.updatedByName}` : ''}` },
    {
      title: '', key: 'actions', width: 90, align: 'right' as const,
      render: (_: any, d: any) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
          <Tooltip title="Continue">
            <Button size="small" type="text" icon={<EditOutlined />} loading={loadingDraft} onClick={() => handleOpenDraft(d.id)} />
          </Tooltip>
          <Popconfirm title="Delete this draft?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => handleDeleteDraft(d.id)}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  const handleVoidEntry = async () => {
    if (!detailId) return;
    try {
      await voidPurchase(detailId).unwrap();
      message.success('Purchase entry voided');
      if (statusFilter === 'ACTIVE') setDetailId(null);
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to void purchase entry');
    }
  };

  const handleClearFilters = () => {
    setSupplierSearch('');
    setDebouncedSearch('');
    setInvoiceSearch('');
    setDebouncedInvoice('');
    setDateRange(null);
    setStatusFilter('ACTIVE');
    setPage(0);
  };

  const tableColumns = [
    {
      title: 'Entry No', dataIndex: 'entryNumber', key: 'entryNumber',
      sorter: (a: any, b: any) => (a.entryNumber || '').localeCompare(b.entryNumber || ''),
      render: (v: string) => <span style={{ fontWeight: 700, color: '#0f172a' }}>{v}</span>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 70,
      render: (v: string) => v === 'VOID'
        ? <span style={{ color: '#94a3b8' }}>Void</span>
        : <span style={{ color: '#0f172a' }}>Active</span>,
    },
    {
      title: 'Supplier', dataIndex: 'supplierName', key: 'supplierName',
      sorter: (a: any, b: any) => (a.supplierName || '').localeCompare(b.supplierName || ''),
      render: (v: string) => <span style={{ color: '#0f172a' }}>{v}</span>,
    },
    {
      title: 'Date', dataIndex: 'purchaseDate', key: 'purchaseDate',
      defaultSortOrder: 'descend' as const,
      sorter: (a: any, b: any) => dayjs(a.purchaseDate).valueOf() - dayjs(b.purchaseDate).valueOf(),
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: 'Invoice No', dataIndex: 'invoiceNumber', key: 'invoiceNumber',
      render: (v: string) => v || <span style={{ color: '#cbd5e1' }}>—</span>,
    },
    {
      title: 'Items', dataIndex: 'items', key: 'items', align: 'right' as const, width: 70,
      sorter: (a: any, b: any) => (a.items?.length || 0) - (b.items?.length || 0),
      render: (items: any[]) => items?.length || 0,
    },
    {
      title: 'Taxable', dataIndex: 'totalTaxable', key: 'totalTaxable', align: 'right' as const,
      render: (v: any) => formatINR(v),
    },
    {
      title: 'CGST', dataIndex: 'totalCgst', key: 'totalCgst', align: 'right' as const,
      render: (v: any) => formatINR(v),
    },
    {
      title: 'SGST', dataIndex: 'totalSgst', key: 'totalSgst', align: 'right' as const,
      render: (v: any) => formatINR(v),
    },
    {
      title: 'Total', dataIndex: 'totalAmount', key: 'totalAmount', align: 'right' as const,
      sorter: (a: any, b: any) => (a.totalAmount || 0) - (b.totalAmount || 0),
      render: (v: any) => <span style={{ fontWeight: 700, color: '#0f172a' }}>{formatINR(v)}</span>,
    },
    {
      title: 'Payment', key: 'payment', width: 90,
      render: (_: any, record: any) => <span style={{ color: record.status === 'VOID' ? '#94a3b8' : '#0f172a' }}>{paymentStatus(record)}</span>,
    },
    {
      title: '', key: 'actions', width: 44, align: 'center' as const,
      render: (_: any, record: any) => (
        <button
          title="Audit History"
          onClick={e => { e.stopPropagation(); setDetailId(record.id); setActiveTab('audit'); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px 6px', borderRadius: 6, lineHeight: 1 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#475569'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#94a3b8'}
        >
          <HistoryOutlined style={{ fontSize: 15 }} />
        </button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Hidden print target */}
      {printPurchase && <PurchasePrint purchase={printPurchase} />}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>Purchase Entries</div>
          {!isMobile && <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>Manage incoming stock and batch tracking</div>}
        </div>
        {hasPermission('PURCHASES_CREATE') && (
        <button
          onClick={() => setShowEntry(true)}
          style={{
            background: P, border: 'none', borderRadius: 10, color: '#fff',
            fontWeight: 700, fontSize: 13, padding: isMobile ? '9px 14px' : '11px 20px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 3px 12px rgba(5,150,105,0.3)', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          <PlusOutlined /> {isMobile ? 'New Entry' : 'New Purchase Entry'}
        </button>
        )}
      </div>

      {/* Saved drafts */}
      {canCreate && drafts.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #f1f5f9' }}>
            Drafts ({drafts.length})
          </div>
          {isMobile ? (
            drafts.map((d: any) => (
              <div key={d.id} onClick={() => handleOpenDraft(d.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>{d.supplierName || 'No supplier'}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{d.lineCount} product(s) · {dayjs(d.updatedAt).format('DD MMM, hh:mm A')}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{formatINR(d.totalAmount)}</span>
                  <Popconfirm title="Delete this draft?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => handleDeleteDraft(d.id)}>
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              </div>
            ))
          ) : (
            <Table
              dataSource={drafts}
              columns={draftColumns}
              rowKey="id"
              size="small"
              pagination={false}
              onRow={(d: any) => ({ onClick: () => handleOpenDraft(d.id), style: { cursor: 'pointer' } })}
            />
          )}
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <RangePicker
            value={dateRange}
            onChange={(vals) => { setDateRange(vals as [Dayjs, Dayjs] | null); setPage(0); }}
            format="DD MMM YYYY"
            allowClear
            disabledDate={(d) => d.isAfter(dayjs(), 'day')}
            style={{ borderRadius: 8, flex: 1 }}
            placeholder={['From date', 'To date']}
          />
          {!isMobile && (
            <Button
              icon={<FileExcelOutlined />}
              onClick={handleExport}
              disabled={purchases.length === 0}
              style={{ borderRadius: 8 }}
            >
              Export Excel
            </Button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Search supplier..."
            value={supplierSearch}
            onChange={e => { setSupplierSearch(e.target.value); setPage(0); }}
            allowClear
            style={{ flex: 1, borderRadius: 8 }}
          />
          <Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Search invoice no..."
            value={invoiceSearch}
            onChange={e => { setInvoiceSearch(e.target.value); setPage(0); }}
            allowClear
            style={{ flex: 1, borderRadius: 8 }}
          />
          <Segmented
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v as 'ACTIVE' | 'VOID' | 'ALL'); setPage(0); }}
            options={[
              { label: 'Active', value: 'ACTIVE' },
              { label: 'Void', value: 'VOID' },
              { label: 'All', value: 'ALL' },
            ]}
          />
          {hasFilter && (
            <Button onClick={handleClearFilters} style={{ borderRadius: 8, color: '#64748b' }}>
              Clear
            </Button>
          )}
          {isMobile && (
            <Button
              icon={<FileExcelOutlined />}
              onClick={handleExport}
              disabled={purchases.length === 0}
              style={{ borderRadius: 8 }}
            />
          )}
        </div>
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
                {(showAllNearExpiry ? nearExpiry : nearExpiry.slice(0, 5)).map((a: any) => (
                  <div key={a.batchId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{a.product?.name}</span>
                    <span style={{ color: '#d97706', fontWeight: 600 }}>
                      {a.daysToExpiry === 0 ? 'Expires today' : `${a.daysToExpiry}d · ${a.quantityAvailable} ${a.product?.unit || 'units'}`}
                    </span>
                  </div>
                ))}
                {nearExpiry.length > 5 && (
                  <div
                    onClick={() => setShowAllNearExpiry(v => !v)}
                    style={{ fontSize: 12, color: '#b45309', cursor: 'pointer', fontWeight: 600, userSelect: 'none', marginTop: 2 }}
                  >
                    {showAllNearExpiry ? 'Show less' : `+${nearExpiry.length - 5} more batches`}
                  </div>
                )}
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
                {(showAllExpired ? expired : expired.slice(0, 5)).map((a: any) => (
                  <div key={a.batchId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{a.product?.name}</span>
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>{a.quantityAvailable} {a.product?.unit || 'units'} remaining</span>
                  </div>
                ))}
                {expired.length > 5 && (
                  <div
                    onClick={() => setShowAllExpired(v => !v)}
                    style={{ fontSize: 12, color: '#dc2626', cursor: 'pointer', fontWeight: 600, userSelect: 'none', marginTop: 2 }}
                  >
                    {showAllExpired ? 'Show less' : `+${expired.length - 5} more batches`}
                  </div>
                )}
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

      {/* Count + view toggle */}
      {!isMobile && !isLoading && purchases.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            {purchases.length} {purchases.length === 1 ? 'entry' : 'entries'}{totalPages > 1 ? ` · page ${page + 1} of ${totalPages}` : ''}
          </div>
          <Segmented
            value={viewMode}
            onChange={(v) => setView(v as 'table' | 'cards')}
            options={[
              { label: 'Table', value: 'table', icon: <TableOutlined /> },
              { label: 'Cards', value: 'cards', icon: <AppstoreOutlined /> },
            ]}
          />
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
          {effectiveView === 'table' ? (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
              <Table
                dataSource={purchases}
                columns={tableColumns}
                rowKey="id"
                size="middle"
                pagination={false}
                scroll={{ x: 900 }}
                onRow={(record: any) => ({
                  onClick: () => setDetailId(record.id),
                  style: { cursor: 'pointer' },
                })}
              />
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
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{p.supplierName} · {dayjs(p.purchaseDate).format('DD MMM YYYY')}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{p.items?.length || 0} product{(p.items?.length || 0) !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 17 }}>{formatINR(p.totalAmount)}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>by {p.createdBy?.fullName}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

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

      {/* Purchase Entry modal — new entry, or a saved one opened for editing */}
      <Modal
        title={editEntry
          ? `Edit ${editEntry.entryNumber} — ${editEntry.supplierName}`
          : openDraft ? `Draft — ${openDraft.supplierName || 'No supplier'}` : 'New Purchase Entry'}
        open={showEntry}
        onCancel={() => {
          Modal.confirm({
            title: editEntry || openDraft ? 'Discard changes?' : 'Discard purchase entry?',
            content: editEntry
              ? 'The saved purchase stays as it was.'
              : openDraft
                ? 'The draft stays as it was last saved.'
                : 'Unsaved lines stay on this device and can be resumed next time. Use Save as Draft to keep them for everyone.',
            okText: 'Discard',
            okType: 'danger',
            cancelText: 'Keep editing',
            onOk: closeEntry,
          });
        }}
        maskClosable={false}
        keyboard={false}
        footer={null} width="99vw" style={{ top: 10, maxWidth: 'none', paddingBottom: 0 }}
        styles={{ body: { padding: 10 } }} destroyOnClose
      >
        <PurchaseEntryPage
          key={editEntry?.id || openDraft?.id || 'new'}
          editEntry={editEntry || undefined}
          draft={openDraft || undefined}
          onClose={closeEntry}
          onSaved={() => { closeEntry(); refetch(); }}
          onDraftSaved={closeEntry}
        />
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={selected
          ? `${selected.entryNumber} — ${selected.supplierName}` + (isVoided ? '  ·  Void' : '')
          : ''}
        open={!!detailId}
        onCancel={() => { setDetailId(null); setActiveTab('items'); }}
        footer={[
          <Button
            key="print"
            icon={<PrinterOutlined />}
            onClick={() => { setPrintPurchase(selected); setTimeout(() => window.print(), 150); }}
          >
            Print
          </Button>,
          canEditPurchase && !isVoided && (
            <Button key="edit" icon={<EditOutlined />} onClick={handleOpenEdit}>
              Edit
            </Button>
          ),
          canEditPurchase && !isVoided && (
            <Tooltip key="voidTip" title={voidBlockReason}>
              <Popconfirm
                key="void"
                title="Void this purchase entry?"
                description="Reverses all stock it added. Only possible because nothing on it has sold or been paid."
                onConfirm={handleVoidEntry}
                okText="Void" okButtonProps={{ danger: true }} cancelText="Cancel"
                disabled={!canVoidSelected}
              >
                <Button danger icon={<CloseCircleOutlined />} disabled={!canVoidSelected} loading={voiding}>
                  Void Entry
                </Button>
              </Popconfirm>
            </Tooltip>
          ),
          <Button key="close" type="primary" onClick={() => { setDetailId(null); setActiveTab('items'); }}>Close</Button>,
        ].filter(Boolean)}
        width={isMobile ? '98vw' : 'min(1400px, 96vw)'}
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Header summary */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12, background: '#f8fafc', borderRadius: 10, padding: '12px 16px' }}>
              {[
                { label: 'Purchase Date', value: selected.purchaseDate },
                { label: 'Supplier',      value: selected.supplierName },
                { label: 'Invoice No.',   value: selected.invoiceNumber || '—' },
                { label: 'Taxable',       value: formatINR(selected.totalTaxable) },
                { label: 'CGST',          value: formatINR(selected.totalCgst) },
                { label: 'SGST',          value: formatINR(selected.totalSgst) },
                ...(!isVoided && Number(selected.billDiscountAmount) > 0 ? [{
                  label: `Bill Discount${selected.billDiscountType === 'PERCENT' ? ` ${Number(selected.billDiscountValue)}%` : ''}`,
                  value: `−${formatINR(selected.billDiscountAmount)}`,
                }] : []),
                ...(!isVoided && Number(selected.freightAmount) > 0 ? [{ label: 'Freight', value: `+${formatINR(selected.freightAmount)}` }] : []),
                ...(!isVoided && Number(selected.cashDiscountAmount) > 0 ? [{
                  label: `Cash Discount${selected.cashDiscountType === 'PERCENT' ? ` ${Number(selected.cashDiscountValue)}%` : ''}`,
                  value: `−${formatINR(selected.cashDiscountAmount)}`,
                }] : []),
                ...(!isVoided && Number(selected.roundOffAmount) !== 0 && selected.roundOffAmount != null ? [{
                  label: 'Round Off',
                  value: `${Number(selected.roundOffAmount) > 0 ? '+' : '−'}${formatINR(Math.abs(Number(selected.roundOffAmount)))}`,
                }] : []),
                { label: 'Net Payable',   value: formatINR(selected.totalAmount) },
                ...(!isVoided ? [
                  { label: 'Paid',        value: formatINR(paidAmt) },
                  { label: 'Balance Due', value: formatINR(Number(selected.totalAmount || 0) - paidAmt) },
                ] : []),
                ...(selected.createdBy?.fullName ? [{
                  label: 'Entered By',
                  value: `${selected.createdBy.fullName}${selected.createdAt ? ` · ${dayjs(selected.createdAt).format('DD MMM YYYY')}` : ''}`,
                }] : []),
                { label: 'Items',        value: `${(selected.items || []).length} product${(selected.items || []).length !== 1 ? 's' : ''}` },
              ].map(row => (
                <div key={row.label}>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{row.label}</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, marginTop: 2 }}>{row.value}</div>
                </div>
              ))}
            </div>
            {isVoided && (
              <div style={{ fontSize: 13, color: '#475569', background: '#f1f5f9', borderRadius: 8, padding: '8px 12px' }}>
                This entry is void
                {voidLog ? ` — voided by ${voidLog.performedBy} on ${dayjs(voidLog.performedAt).format('DD MMM YYYY, hh:mm A')}` : ''}.
                {' '}Its stock was reversed and all amounts are zero; quantities and rates are kept for reference.
              </div>
            )}
            {!isVoided && canEditPurchase && voidBlockReason && (
              <div style={{ fontSize: 12, color: '#64748b' }}>Void unavailable: {voidBlockReason}</div>
            )}
            {selected.notes && (
              <div style={{ fontSize: 13, color: '#64748b', background: '#fffbeb', borderRadius: 8, padding: '8px 12px' }}>{selected.notes}</div>
            )}

            <Tabs
              size="small"
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: 'items',
                  label: 'Items',
                  children: (
                    <Table
                      dataSource={[
                        ...(selected.items || []),
                        {
                          id: '__total__',
                          __isTotal: true,
                          quantity: (selected.items || []).reduce((s: number, i: any) => s + (i.quantity || 0), 0),
                          freeQty: (selected.items || []).reduce((s: number, i: any) => s + (i.freeQty || 0), 0),
                          discountTotal: (selected.items || []).reduce((s: number, i: any) =>
                            s + Number(i.discountAmount || 0) + Number(i.billDiscountAmount || 0), 0),
                          taxableAmount: selected.totalTaxable,
                          cgstAmount: selected.totalCgst,
                          sgstAmount: selected.totalSgst,
                          amount: selected.totalAmount,
                        },
                      ]}
                      rowKey="id"
                      size="small"
                      pagination={false}
                      scroll={{ x: 1340 }}
                      onRow={(row: any) => row.__isTotal ? { style: { background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #e2e8f0' } } : {}}
                      columns={([
                        {
                          title: '#',
                          render: (_: any, row: any, i: number) => row.__isTotal
                            ? <span style={{ fontWeight: 700 }}>Total</span>
                            : <span style={{ color: '#94a3b8' }}>{i + 1}</span>,
                          width: 36,
                        },
                        {
                          title: 'Product',
                          dataIndex: 'product',
                          width: 240,
                          render: (p: any, row: any) => row.__isTotal ? null : (
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{p?.name}</div>
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>{[p?.brand, p?.unit].filter(Boolean).join(' · ')}</div>
                            </div>
                          ),
                        },
                        {
                          title: 'Batch No.',
                          dataIndex: 'batchNumber',
                          width: 150,
                          render: (v: string, row: any) => row.__isTotal ? null : <span style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{v}</span>,
                        },
                        {
                          title: 'Expiry',
                          dataIndex: 'expiryDate',
                          width: 90,
                          render: (d: string, row: any) => {
                            if (row.__isTotal) return null;
                            if (!d) return <span style={{ color: '#94a3b8' }}>—</span>;
                            const days = Math.floor((new Date(d).getTime() - Date.now()) / 86400000);
                            const color = days < 0 ? '#dc2626' : days <= 30 ? '#d97706' : '#0f172a';
                            return <span style={{ color, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>{d}</span>;
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
                          title: 'Free',
                          dataIndex: 'freeQty',
                          align: 'right' as const,
                          width: 55,
                          render: (v: number) => v ? <span style={{ fontWeight: 600 }}>{v}</span> : <span style={{ color: '#94a3b8' }}>—</span>,
                        },
                        {
                          title: 'Discount',
                          key: 'discount',
                          align: 'right' as const,
                          width: 84,
                          render: (_: any, row: any) => {
                            const d = isVoided ? 0 : row.__isTotal
                              ? Number(row.discountTotal || 0)
                              : Number(row.discountAmount || 0) + Number(row.billDiscountAmount || 0);
                            return d > 0 ? formatINR(d) : <span style={{ color: '#94a3b8' }}>—</span>;
                          },
                        },
                        {
                          title: 'MRP',
                          dataIndex: 'mrp',
                          align: 'right' as const,
                          width: 80,
                          render: (v: any, row: any) => row.__isTotal ? null : formatINR(v),
                        },
                        {
                          title: 'Purch. Rate',
                          dataIndex: 'purchaseRate',
                          align: 'right' as const,
                          width: 84,
                          render: (v: any, row: any) => row.__isTotal ? null : formatINR(v),
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
                          width: 74,
                          render: (v: any, row: any) => row.__isTotal ? formatINR(v) : (
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
                          width: 74,
                          render: (v: any, row: any) => row.__isTotal ? formatINR(v) : (
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
                          width: 84,
                          render: (v: any) => <span style={{ fontWeight: 700, color: P }}>{formatINR(v)}</span>,
                        },
                        {
                          title: 'Min Sale',
                          dataIndex: 'minSaleRate',
                          align: 'right' as const,
                          width: 76,
                          render: (v: any, row: any) => row.__isTotal ? null : (v != null ? formatINR(v) : <span style={{ color: '#94a3b8' }}>—</span>),
                        },
                        {
                          title: 'Max Sale',
                          dataIndex: 'maxSaleRate',
                          align: 'right' as const,
                          width: 76,
                          render: (v: any, row: any) => row.__isTotal ? null : (v != null ? formatINR(v) : <span style={{ color: '#94a3b8' }}>—</span>),
                        },
                      ] as any[]).map((c: any) => ({ ...c, onCell: () => ({ style: { verticalAlign: 'top' } }) }))}
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
    </div>
  );
};

export default PurchaseListPage;
