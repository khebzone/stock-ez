import React, { useState, useEffect } from 'react';
import { Modal, Skeleton, Input, Button, DatePicker, Form, Select, message, Table, Tabs, InputNumber, Grid, Divider, Segmented, Tooltip, Popconfirm } from 'antd';
import {
  PlusOutlined, InboxOutlined, WarningOutlined,
  SearchOutlined, FileExcelOutlined, PrinterOutlined, EditOutlined, HistoryOutlined,
  TableOutlined, AppstoreOutlined, CloseCircleOutlined, DeleteOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useGetPurchasesQuery, useGetNearExpiryAlertsQuery, useUpdatePurchaseMutation, useVoidPurchaseMutation, useGetPurchaseAuditQuery } from '../../store/api/purchaseApi';
import { useGetSuppliersQuery } from '../../store/api/supplierApi';
import { useGetAllProductsQuery } from '../../store/api/productApi';
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
  const [showEdit, setShowEdit]           = useState(false);
  const [page, setPage]                   = useState(0);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [debouncedInvoice, setDebouncedInvoice] = useState('');
  const [dateRange, setDateRange]         = useState<[Dayjs, Dayjs] | null>(null);
  const [printPurchase, setPrintPurchase] = useState<any>(null);
  const [itemEdits, setItemEdits]         = useState<Record<string, any>>({});
  const [newPurchaseItems, setNewPurchaseItems] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => (localStorage.getItem('purchaseView') as 'table' | 'cards') || 'table');
  const [showAllNearExpiry, setShowAllNearExpiry] = useState(false);
  const [showAllExpired, setShowAllExpired] = useState(false);
  const [editForm] = Form.useForm();

  const setView = (v: 'table' | 'cards') => { setViewMode(v); localStorage.setItem('purchaseView', v); };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(supplierSearch), 400);
    return () => clearTimeout(t);
  }, [supplierSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedInvoice(invoiceSearch), 400);
    return () => clearTimeout(t);
  }, [invoiceSearch]);

  const { data: suppData } = useGetSuppliersQuery(undefined, { refetchOnMountOrArgChange: true });
  const suppliers: any[] = suppData?.data?.content || suppData?.data || [];
  const { data: productsData } = useGetAllProductsQuery(undefined, { refetchOnMountOrArgChange: true });
  const allProducts: any[] = productsData?.data?.content || productsData?.data || [];

  const [updatePurchase, { isLoading: updating }] = useUpdatePurchaseMutation();
  const [voidPurchase, { isLoading: voiding }] = useVoidPurchaseMutation();
  const [removedItemIds, setRemovedItemIds] = useState<Set<string>>(new Set());

  const { data: purchasesData, isLoading, isError, error: listError, refetch } = useGetPurchasesQuery({
    page,
    size: 20,
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
  const selected   = purchases.find((p: any) => p.id === detailId);
  const isVoided   = selected?.status === 'VOID';
  const voidBlockReason = !selected ? '' : Number(selected.paidAmount || 0) > 0
    ? `₹${Number(selected.paidAmount).toFixed(2)} already paid against this bill — reverse the payment(s) first.`
    : (selected.items || []).some((i: any) => i.quantity - (i.quantityAvailable ?? i.quantity) > 0)
      ? 'Some units on this entry are already sold — remove only the unsold lines instead.'
      : '';
  const canVoidSelected = !isVoided && !voidBlockReason;

  const hasFilter = !!debouncedSearch || !!debouncedInvoice || !!dateRange;
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
        quantity: item.quantity,
        totalAmount: Number(item.amount),
        mrp: Number(item.mrp),
        expiryDate: item.expiryDate ? dayjs(item.expiryDate) : null,
        mfgDate: item.mfgDate ? dayjs(item.mfgDate) : null,
        minSaleRate: item.minSaleRate != null ? Number(item.minSaleRate) : null,
        maxSaleRate: item.maxSaleRate != null ? Number(item.maxSaleRate) : null,
      };
    });
    setItemEdits(initialEdits);
    setNewPurchaseItems([]);
    setRemovedItemIds(new Set());
    setShowEdit(true);
  };

  const handleVoidEntry = async () => {
    if (!detailId) return;
    try {
      await voidPurchase(detailId).unwrap();
      message.success('Purchase entry voided');
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to void purchase entry');
    }
  };

  const handleEditSave = async (values: any) => {
    for (const ni of newPurchaseItems) {
      if (!ni.productId || !ni.quantity || !ni.totalAmount || !ni.mrp || !ni.expiryDate || !ni.minSaleRate || !ni.maxSaleRate) {
        message.error('All fields are required for new items (product, qty, total amt, MRP, expiry, min/max rate)');
        return;
      }
    }
    try {
      const itemUpdates = Object.entries(itemEdits)
        .filter(([itemId]) => !removedItemIds.has(itemId))
        .map(([itemId, fields]) => ({
          itemId,
          quantity: fields.quantity || null,
          totalAmount: fields.totalAmount || null,
          mrp: fields.mrp || null,
          expiryDate: fields.expiryDate ? fields.expiryDate.format('YYYY-MM-DD') : null,
          mfgDate: fields.mfgDate ? fields.mfgDate.format('YYYY-MM-DD') : null,
          minSaleRate: fields.minSaleRate || null,
          maxSaleRate: fields.maxSaleRate || null,
        }));
      const newItems = newPurchaseItems.map(ni => ({
        productId: ni.productId,
        quantity: ni.quantity,
        totalAmount: ni.totalAmount,
        mrp: ni.mrp,
        expiryDate: ni.expiryDate ? ni.expiryDate.format('YYYY-MM-DD') : null,
        mfgDate: ni.mfgDate ? ni.mfgDate.format('YYYY-MM-DD') : null,
        minSaleRate: ni.minSaleRate,
        maxSaleRate: ni.maxSaleRate,
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
          newItems: newItems.length > 0 ? newItems : undefined,
          removeItemIds: removedItemIds.size > 0 ? Array.from(removedItemIds) : undefined,
        },
      }).unwrap();
      message.success('Purchase updated');
      setShowEdit(false);
      refetch();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to update purchase');
    }
  };

  const handleClearFilters = () => {
    setSupplierSearch('');
    setDebouncedSearch('');
    setInvoiceSearch('');
    setDebouncedInvoice('');
    setDateRange(null);
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

      {/* New Purchase Entry modal */}
      <Modal
        title="New Purchase Entry"
        open={showEntry}
        onCancel={() => {
          Modal.confirm({
            title: 'Discard purchase entry?',
            content: 'All entered product lines will be lost.',
            okText: 'Discard',
            okType: 'danger',
            cancelText: 'Keep editing',
            onOk: () => setShowEntry(false),
          });
        }}
        maskClosable={false}
        keyboard={false}
        footer={null} width="99vw" style={{ top: 10, maxWidth: 'none', paddingBottom: 0 }}
        styles={{ body: { padding: 10 } }} destroyOnClose
      >
        <PurchaseEntryPage
          onClose={() => setShowEntry(false)}
          onSaved={() => { setShowEntry(false); refetch(); }}
        />
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={selected
          ? `${selected.entryNumber} — ${selected.supplierName}` + (isVoided ? '  ·  Void' : '')
          : ''}
        open={!!detailId && !showEdit}
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
        width={isMobile ? '98vw' : 1340}
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
                          taxableAmount: selected.totalTaxable,
                          cgstAmount: selected.totalCgst,
                          sgstAmount: selected.totalSgst,
                          amount: selected.totalAmount,
                        },
                      ]}
                      rowKey="id"
                      size="small"
                      pagination={false}
                      scroll={isMobile ? { x: 1100 } : undefined}
                      onRow={(row: any) => row.__isTotal ? { style: { background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #e2e8f0' } } : {}}
                      columns={[
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
                          width: 210,
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
                      ]}
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
        width={isMobile ? '98vw' : 1340}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSave} style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '0 16px' }}>
            <Form.Item name="supplierId" label="Supplier">
              <Select
                showSearch filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())} allowClear
                placeholder="Select supplier"
                options={suppliers.map((s: any) => ({ value: s.id, label: s.name }))}
              />
            </Form.Item>
            <Form.Item name="supplierName" label="Supplier Name" rules={[{ required: true, message: 'Required' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="purchaseDate" label="Purchase Date" rules={[{ required: true, message: 'Required' }]}>
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" allowClear={false} />
            </Form.Item>
            <Form.Item name="invoiceNumber" label="Invoice / Ref No.">
              <Input placeholder="e.g. INV-2026-0421" />
            </Form.Item>
          </div>
          {/* Existing batch items */}
          {(selected?.items || []).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Existing Items
              </div>
              <Table
                size="small"
                pagination={false}
                rowKey="id"
                dataSource={selected?.items || []}
                scroll={{ x: 'max-content' }}
                onRow={(item: any) => ({
                  style: removedItemIds.has(item.id)
                    ? { opacity: 0.45, textDecoration: 'line-through' }
                    : {},
                })}
                columns={[
                  {
                    title: 'Product', dataIndex: ['product', 'name'], width: 150,
                    render: (v: string) => <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }}>{v}</span>,
                  },
                  {
                    title: 'Batch', dataIndex: 'batchNumber', width: 120,
                    render: (v: string) => <span style={{ fontSize: 13, color: '#334155' }}>{v}</span>,
                  },
                  {
                    title: 'Qty', align: 'right' as const, width: 90,
                    render: (_: any, item: any) => {
                      const soldQty = item.quantity - (item.quantityAvailable ?? item.quantity);
                      const minQty  = soldQty > 0 ? soldQty : 1;
                      const edit = itemEdits[item.id] || {};
                      return (
                        <>
                          <InputNumber
                            size="small" variant="outlined" min={minQty} precision={0}
                            style={{ width: 72 }} styles={{ input: { textAlign: 'right' } }}
                            value={edit.quantity}
                            onChange={v => setItemEdits(prev => ({ ...prev, [item.id]: { ...prev[item.id], quantity: v } }))}
                          />
                          {soldQty > 0 && (
                            <div style={{ fontSize: 10, color: '#d97706', marginTop: 2, textAlign: 'right' }}>
                              {soldQty} sold — min {minQty}
                            </div>
                          )}
                        </>
                      );
                    },
                  },
                  {
                    title: 'Total Amt (₹)', align: 'right' as const, width: 110,
                    render: (_: any, item: any) => {
                      const soldQty = item.quantity - (item.quantityAvailable ?? item.quantity);
                      const edit = itemEdits[item.id] || {};
                      return (
                        <Tooltip title={soldQty > 0
                          ? `Rate is locked — ${soldQty} unit(s) already sold at the recorded cost. Reduce quantity to ${soldQty} and add a new line at the correct rate instead.`
                          : 'Total price for this line — corrects a mistakenly-entered purchase rate.'}>
                          <InputNumber
                            size="small" variant="outlined" min={0.01} precision={2}
                            style={{ width: 90 }} styles={{ input: { textAlign: 'right' } }}
                            value={edit.totalAmount}
                            onChange={v => setItemEdits(prev => ({ ...prev, [item.id]: { ...prev[item.id], totalAmount: v } }))}
                            disabled={soldQty > 0}
                          />
                        </Tooltip>
                      );
                    },
                  },
                  {
                    title: 'MRP', align: 'right' as const, width: 100,
                    render: (_: any, item: any) => {
                      const edit = itemEdits[item.id] || {};
                      return (
                        <InputNumber
                          size="small" variant="outlined" min={0.01} precision={2}
                          style={{ width: 80 }} styles={{ input: { textAlign: 'right' } }}
                          value={edit.mrp}
                          onChange={v => setItemEdits(prev => ({ ...prev, [item.id]: { ...prev[item.id], mrp: v } }))}
                        />
                      );
                    },
                  },
                  {
                    title: 'Expiry', align: 'center' as const, width: 110,
                    render: (_: any, item: any) => {
                      const edit = itemEdits[item.id] || {};
                      return (
                        <DatePicker
                          size="small" format="MM/YY" picker="month"
                          style={{ width: 90 }}
                          value={edit.expiryDate}
                          onChange={v => setItemEdits(prev => ({ ...prev, [item.id]: { ...prev[item.id], expiryDate: v } }))}
                        />
                      );
                    },
                  },
                  {
                    title: 'Min Sale', align: 'right' as const, width: 100,
                    render: (_: any, item: any) => {
                      const edit = itemEdits[item.id] || {};
                      return (
                        <InputNumber
                          size="small" variant="outlined" min={0} precision={2}
                          style={{ width: 80 }} styles={{ input: { textAlign: 'right' } }}
                          value={edit.minSaleRate}
                          onChange={v => setItemEdits(prev => ({ ...prev, [item.id]: { ...prev[item.id], minSaleRate: v } }))}
                        />
                      );
                    },
                  },
                  {
                    title: 'Max Sale', align: 'right' as const, width: 100,
                    render: (_: any, item: any) => {
                      const edit = itemEdits[item.id] || {};
                      return (
                        <InputNumber
                          size="small" variant="outlined" min={0} precision={2}
                          style={{ width: 80 }} styles={{ input: { textAlign: 'right' } }}
                          value={edit.maxSaleRate}
                          onChange={v => setItemEdits(prev => ({ ...prev, [item.id]: { ...prev[item.id], maxSaleRate: v } }))}
                        />
                      );
                    },
                  },
                  {
                    title: '', key: 'rowAction', align: 'center' as const, width: 100,
                    render: (_: any, item: any) => {
                      const soldQty = item.quantity - (item.quantityAvailable ?? item.quantity);
                      const minQty  = soldQty > 0 ? soldQty : 1;
                      const isRemoved = removedItemIds.has(item.id);
                      if (isRemoved) {
                        return (
                          <Button size="small" onClick={() => setRemovedItemIds(prev => {
                            const next = new Set(prev); next.delete(item.id); return next;
                          })}>
                            Undo
                          </Button>
                        );
                      }
                      if (soldQty > 0) {
                        return (
                          <Tooltip title={`Line can't be fully removed — ${soldQty} unit(s) already sold. Trim quantity down to ${soldQty} instead.`}>
                            <Button size="small" onClick={() => setItemEdits(prev => ({ ...prev, [item.id]: { ...prev[item.id], quantity: minQty } }))}>
                              Trim to sold
                            </Button>
                          </Tooltip>
                        );
                      }
                      return (
                        <Tooltip title="Remove this line entirely — nothing from it has sold">
                          <Popconfirm
                            title="Remove this line?"
                            description="Its stock addition will be reversed on save."
                            onConfirm={() => setRemovedItemIds(prev => new Set(prev).add(item.id))}
                            okText="Remove" cancelText="Cancel"
                          >
                            <Button size="small" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        </Tooltip>
                      );
                    },
                  },
                ]}
              />
            </div>
          )}

          {/* Add new items */}
          <Divider style={{ margin: '12px 0' }} />
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Add New Items
              </div>
              <Button
                size="small" icon={<PlusOutlined />}
                onClick={() => setNewPurchaseItems(prev => [...prev, { _key: crypto.randomUUID(), productId: null, quantity: null, totalAmount: null, mrp: null, expiryDate: null, mfgDate: null, minSaleRate: null, maxSaleRate: null }])}
              >
                Add Product
              </Button>
            </div>
            {newPurchaseItems.length > 0 && (
              <Table
                size="small"
                pagination={false}
                rowKey="_key"
                dataSource={newPurchaseItems}
                scroll={{ x: 'max-content' }}
                columns={[
                  {
                    title: 'Product', width: 180,
                    render: (_: any, ni: any, i: number) => (
                      <Select
                        size="small" showSearch filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())} placeholder="Select product"
                        style={{ width: '100%' }}
                        value={ni.productId}
                        onChange={v => setNewPurchaseItems(prev => prev.map((x, j) => j === i ? { ...x, productId: v } : x))}
                        options={allProducts.map((p: any) => ({ value: p.id, label: `${p.name}${p.brand ? ' · ' + p.brand : ''}` }))}
                      />
                    ),
                  },
                  {
                    title: 'Qty', align: 'right' as const, width: 80,
                    render: (_: any, ni: any, i: number) => (
                      <InputNumber size="small" min={1} precision={0} style={{ width: 64 }} styles={{ input: { textAlign: 'right' } }} value={ni.quantity} onChange={v => setNewPurchaseItems(prev => prev.map((x, j) => j === i ? { ...x, quantity: v } : x))} />
                    ),
                  },
                  {
                    title: 'Total Amt (₹)', align: 'right' as const, width: 110,
                    render: (_: any, ni: any, i: number) => (
                      <InputNumber size="small" min={0.01} precision={2} style={{ width: 90 }} styles={{ input: { textAlign: 'right' } }} value={ni.totalAmount} onChange={v => setNewPurchaseItems(prev => prev.map((x, j) => j === i ? { ...x, totalAmount: v } : x))} />
                    ),
                  },
                  {
                    title: 'MRP', align: 'right' as const, width: 100,
                    render: (_: any, ni: any, i: number) => (
                      <InputNumber size="small" min={0.01} precision={2} style={{ width: 80 }} styles={{ input: { textAlign: 'right' } }} value={ni.mrp} onChange={v => setNewPurchaseItems(prev => prev.map((x, j) => j === i ? { ...x, mrp: v } : x))} />
                    ),
                  },
                  {
                    title: 'Expiry', align: 'center' as const, width: 110,
                    render: (_: any, ni: any, i: number) => (
                      <DatePicker size="small" format="MM/YY" picker="month" style={{ width: 90 }} value={ni.expiryDate} onChange={v => setNewPurchaseItems(prev => prev.map((x, j) => j === i ? { ...x, expiryDate: v } : x))} />
                    ),
                  },
                  {
                    title: 'Min Sale', align: 'right' as const, width: 100,
                    render: (_: any, ni: any, i: number) => (
                      <InputNumber size="small" min={0} precision={2} style={{ width: 80 }} styles={{ input: { textAlign: 'right' } }} value={ni.minSaleRate} onChange={v => setNewPurchaseItems(prev => prev.map((x, j) => j === i ? { ...x, minSaleRate: v } : x))} />
                    ),
                  },
                  {
                    title: 'Max Sale', align: 'right' as const, width: 100,
                    render: (_: any, ni: any, i: number) => (
                      <InputNumber size="small" min={0} precision={2} style={{ width: 80 }} styles={{ input: { textAlign: 'right' } }} value={ni.maxSaleRate} onChange={v => setNewPurchaseItems(prev => prev.map((x, j) => j === i ? { ...x, maxSaleRate: v } : x))} />
                    ),
                  },
                  {
                    title: '', key: 'rowAction', align: 'center' as const, width: 50,
                    render: (_: any, __: any, i: number) => (
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setNewPurchaseItems(prev => prev.filter((_, j) => j !== i))} />
                    ),
                  },
                ]}
              />
            )}
          </div>

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
