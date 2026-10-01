import React, { useState } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { noFutureDates } from '../../utils/date';
import {
  Card, Table, Button, message, Space, Input, Modal,
  Form, Select, InputNumber, Grid, Spin, DatePicker, Alert, Tooltip, Popconfirm,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, EditOutlined,
  PlusOutlined, SearchOutlined, MinusOutlined,
} from '@ant-design/icons';
import {
  useGetAllOrdersQuery, useApproveOrderMutation, useApproveOrdersBatchMutation, useCancelOrderMutation, useUpdateOrderMutation,
  useCreateOrderMutation,
} from '../../store/api/orderApi';
import { useGetAllProductsQuery } from '../../store/api/productApi';
import { useGetCustomersQuery } from '../../store/api/customerApi';
import { useGetWorkflowSettingsQuery } from '../../store/api/supplierApi';
import PageHeader from '../../components/PageHeader';
import { hasPermission } from '../../utils/permissions';

const { Option } = Select;

// Identity for "the same real-world product" — catches duplicate product records
// (same name/brand/unit under different IDs) so it can't be added to an order twice.
const sameProductKey = (p: any) =>
  [p?.name, p?.brand, p?.unit].map(v => String(v ?? '').trim().toLowerCase()).join('|');

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  DRAFT:            { color: '#6b7280', bg: '#f3f4f6',  label: 'Draft' },
  SUBMITTED:        { color: '#f59e0b', bg: '#fffbeb',  label: 'Submitted' },
  PENDING_APPROVAL: { color: '#f59e0b', bg: '#fffbeb',  label: 'Pending Approval' },
  APPROVED:         { color: '#059669', bg: '#ecfdf5',  label: 'Approved' },
  PACKING:          { color: '#06b6d4', bg: '#ecfeff',  label: 'Packing' },
  PACKED:           { color: '#06b6d4', bg: '#ecfeff',  label: 'Packed' },
  DISPATCHED:       { color: '#8b5cf6', bg: '#f5f3ff',  label: 'Dispatched' },
  DELIVERED:        { color: '#10b981', bg: '#ecfdf5',  label: 'Delivered' },
  CANCELLED:        { color: '#ef4444', bg: '#fef2f2',  label: 'Cancelled' },
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { color: '#6b7280', bg: '#f3f4f6', label: status };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color, fontSize: 11,
      fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      border: `1px solid ${cfg.color}25`,
    }}>
      {cfg.label}
    </span>
  );
};

const InvoiceApproverPage: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const editModalWidth = isMobile ? '100vw' : 780;

  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [rejectModal,  setRejectModal]  = useState(false);
  const [rejectForm]                    = Form.useForm();
  const [rejectingId,  setRejectingId]  = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [bulkApproving, setBulkApproving]     = useState(false);
  const [dateFilter,    setDateFilter]        = useState<Dayjs | null>(dayjs());
  const [statusFilter,  setStatusFilter]      = useState<string | null>(null);
  const [search,        setSearch]            = useState('');
  const [approvingAll,  setApprovingAll]      = useState(false);

  // Edit order state
  const [editOpen,  setEditOpen]  = useState(false);
  const [editOrder, setEditOrder] = useState<any>(null);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [editOverallDisc, setEditOverallDisc] = useState<number | null>(null);

  // Create order state
  const [createOpen, setCreateOpen]               = useState(false);
  const [createCustomerId, setCreateCustomerId]   = useState<string | undefined>();
  const [createItems, setCreateItems]             = useState<any[]>([]);
  const [createProductSearch, setCreateProductSearch] = useState('');
  const [createOverallDisc, setCreateOverallDisc] = useState<number | null>(null);

  const { data: workflowData } = useGetWorkflowSettingsQuery(undefined, { refetchOnMountOrArgChange: true });
  const discountType = workflowData?.data?.discountType ?? 'PERCENT';

  const [salesPersonFilter, setSalesPersonFilter] = useState<string | null>(null);
  const [routeFilter, setRouteFilter] = useState<string | null>(null);

  const { data: ordersData, isLoading, refetch } = useGetAllOrdersQuery(undefined, { refetchOnMountOrArgChange: true });
  const { data: productsData } = useGetAllProductsQuery(undefined, { refetchOnMountOrArgChange: true });
  const { data: customersData, isLoading: customersLoading } = useGetCustomersQuery(undefined, { refetchOnMountOrArgChange: true });
  const [approveOrder, { isLoading: approving }] = useApproveOrderMutation();
  const [approveOrdersBatch] = useApproveOrdersBatchMutation();
  const [cancelOrder,  { isLoading: cancelling }] = useCancelOrderMutation();
  const [updateOrder,  { isLoading: updating }]  = useUpdateOrderMutation();
  const [createOrder,  { isLoading: creating }]  = useCreateOrderMutation();
  const orders:    any[] = ordersData?.data?.content || ordersData?.data || [];
  const products:  any[] = productsData?.data?.content || productsData?.data || [];
  const customers: any[] = customersData?.data?.content || customersData?.data || [];

  const salesPersonOptions = Array.from(
    new Map(
      orders
        .filter((o: any) => o.salesPerson?.id)
        .map((o: any) => [o.salesPerson.id, o.salesPerson.fullName])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const routeOptions = Array.from(
    new Set(
      orders
        .filter((o: any) => o.customer?.routeName && (!salesPersonFilter || o.salesPerson?.id === salesPersonFilter))
        .map((o: any) => o.customer.routeName as string)
    )
  ).sort();

  const APPROVER_STATUSES = ['SUBMITTED', 'APPROVED', 'CANCELLED'];
  const filteredOrders = orders.filter((o: any) => {
    if (salesPersonFilter && o.salesPerson?.id !== salesPersonFilter) return false;
    if (routeFilter && o.customer?.routeName !== routeFilter) return false;
    if (statusFilter ? o.status !== statusFilter : !APPROVER_STATUSES.includes(o.status)) return false;
    if (dateFilter && !dayjs(o.orderDate).isSame(dateFilter, 'day')) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = `${o.orderNumber || ''} ${o.customer?.businessName || ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const oldPendingCount = dateFilter
    ? orders.filter((o: any) => o.status === 'SUBMITTED' && !dayjs(o.orderDate).isSame(dateFilter, 'day')).length
    : 0;

  const filteredCreateProducts = createProductSearch
    ? products.filter((p: any) => {
        const s = createProductSearch.toLowerCase();
        return p.name?.toLowerCase().includes(s) || p.brand?.toLowerCase().includes(s);
      })
    : products;

  // ── Approve ──────────────────────────────────────────────────────────────
  const handleApprove = async (id: string) => {
    try {
      await approveOrder(id).unwrap();
      message.success('Order approved');
      refetch();
      if (selectedOrder?.id === id) setDrawerOpen(false);
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to approve');
    }
  };

  const handleApproveSelected = async () => {
    if (!selectedRowKeys.length) return;
    setBulkApproving(true);
    try {
      const res = await approveOrdersBatch(selectedRowKeys).unwrap();
      reportBulkApproveResult(res?.data);
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to approve orders');
    }
    setBulkApproving(false);
    setSelectedRowKeys([]);
    refetch();
  };

  const handleApproveAll = async () => {
    const ids = filteredOrders.filter((o: any) => o.status === 'SUBMITTED').map((o: any) => o.id);
    if (!ids.length) return;
    setApprovingAll(true);
    try {
      const res = await approveOrdersBatch(ids).unwrap();
      reportBulkApproveResult(res?.data);
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to approve orders');
    }
    setApprovingAll(false);
    refetch();
  };

  const reportBulkApproveResult = (data: any) => {
    const approvedCount = data?.approvedCount || 0;
    const failures: any[] = data?.failures || [];
    if (failures.length === 0) {
      message.success(`${approvedCount} order(s) approved`);
    } else {
      message.warning(
        `${approvedCount} order(s) approved, ${failures.length} failed: ` +
        failures.map(f => `${f.orderNumber || f.orderId} (${f.reason})`).join('; ')
      );
    }
  };

  // ── Reject ───────────────────────────────────────────────────────────────
  const openRejectModal = (id: string) => { setRejectingId(id); rejectForm.resetFields(); setRejectModal(true); };

  const handleReject = async () => {
    try {
      const { reason } = await rejectForm.validateFields();
      await cancelOrder({ id: rejectingId!, reason }).unwrap();
      message.success('Order rejected');
      setRejectModal(false);
      refetch();
      if (selectedOrder?.id === rejectingId) setDrawerOpen(false);
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.data?.message || 'Failed to reject');
    }
  };

  // ── Edit order ────────────────────────────────────────────────────────────
  const openEdit = (order: any) => {
    setEditOrder(order);
    setEditItems((order.items || []).map((item: any) => ({
      productId:       item.product?.id,
      quantity:        item.quantity,
      unitPrice:       Number(item.unitPrice),
      discountPercent: Number(item.discountPercent || 0),
      gstPercent:      Number(item.gstPercent),
      _name:  item.product?.name,
      _brand: item.product?.brand,
    })));
    setEditOverallDisc(order.overallDiscountValue != null ? Number(order.overallDiscountValue) : null);
    setEditOpen(true);
  };

  const addEditItem = () =>
    setEditItems(prev => [...prev, { productId: undefined, quantity: 1, unitPrice: 0, discountPercent: 0, gstPercent: 0 }]);

  const removeEditItem = (i: number) => setEditItems(prev => prev.filter((_, idx) => idx !== i));

  const updateEditItem = (i: number, field: string, value: any) => {
    if (field === 'productId' && value) {
      const picked = products.find((p: any) => p.id === value);
      const key = picked && sameProductKey(picked);
      const dup = key && editItems.some((it, idx) => {
        if (idx === i || !it.productId) return false;
        const ip = products.find((x: any) => x.id === it.productId);
        return ip && sameProductKey(ip) === key;
      });
      if (dup) {
        message.warning(`"${picked.name}" is already added — increase its quantity instead of adding it again`);
        return;
      }
    }
    setEditItems(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      if (field === 'productId') {
        const p = products.find((p: any) => p.id === value);
        if (p) {
          next[i].unitPrice  = Number(p.minSaleRate || 0);
          next[i].gstPercent = Number(p.salesGstPercent || 0);
          next[i]._name  = p.name;
          next[i]._brand = p.brand;
        }
      }
      return next;
    });
  };

  const calcEditLine = (item: any) => {
    const gross = (item.unitPrice || 0) * (item.quantity || 0);
    const disc  = gross * (item.discountPercent || 0) / 100;
    return gross - disc;
  };

  // Bill-level discount — shown as an approximation here; the server pro-rata apportions
  // it into the per-line amounts (same math as the other order-entry screens).
  const calcOverallDiscount = (grossTotal: number, discValue: number | null) => {
    const dv = discValue || 0;
    if (dv <= 0 || grossTotal <= 0) return 0;
    return discountType === 'PERCENT'
      ? Math.round(grossTotal * Math.min(dv, 100)) / 100
      : Math.min(dv, grossTotal);
  };

  const handleSaveEdit = async () => {
    if (!editItems.length || editItems.some(i => !i.productId || !i.quantity || !i.unitPrice)) {
      message.error('Every item needs a product, quantity, and price');
      return;
    }
    try {
      await updateOrder({
        id: editOrder.id,
        items: editItems.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, discountPercent: i.discountPercent || 0 })),
        notes: editOrder.notes,
        overallDiscountType: editOverallDisc && editOverallDisc > 0 ? discountType : null,
        overallDiscountValue: editOverallDisc && editOverallDisc > 0 ? editOverallDisc : null,
      }).unwrap();
      message.success('Order updated');
      setEditOpen(false);
      refetch();
      if (selectedOrder?.id === editOrder.id) setDrawerOpen(false);
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to update order');
    }
  };

  // ── Create order ──────────────────────────────────────────────────────────
  const openCreate = () => {
    setCreateCustomerId(undefined);
    setCreateItems(isMobile ? [] : [{ productId: undefined, quantity: 1, unitPrice: 0, discountPercent: 0, gstPercent: 0 }]);
    setCreateProductSearch('');
    setCreateOverallDisc(null);
    setCreateOpen(true);
  };

  const addCreateItem = () =>
    setCreateItems(prev => [...prev, { productId: undefined, quantity: 1, unitPrice: 0, discountPercent: 0, gstPercent: 0 }]);

  const removeCreateItem = (i: number) => setCreateItems(prev => prev.filter((_, idx) => idx !== i));

  const addProductToCreate = (product: any) => {
    const idx = createItems.findIndex(i => i.productId === product.id);
    if (idx >= 0) {
      setCreateItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      const key = sameProductKey(product);
      const dupIdx = createItems.findIndex(i => {
        const ip = products.find((x: any) => x.id === i.productId);
        return ip && sameProductKey(ip) === key;
      });
      if (dupIdx >= 0) {
        message.warning(`"${product.name}" is already added — increase its quantity instead of adding it again`);
        return;
      }
      setCreateItems(prev => [...prev, {
        productId:       product.id,
        quantity:        1,
        unitPrice:       Number(product.salesRate1 || 0),
        discountPercent: 0,
        gstPercent:      Number(product.salesGstPercent || 0),
      }]);
    }
  };

  const updateCreateItem = (i: number, field: string, value: any) => {
    if (field === 'productId' && value) {
      const picked = products.find((p: any) => p.id === value);
      const key = picked && sameProductKey(picked);
      const dup = key && createItems.some((it, idx) => {
        if (idx === i || !it.productId) return false;
        const ip = products.find((x: any) => x.id === it.productId);
        return ip && sameProductKey(ip) === key;
      });
      if (dup) {
        message.warning(`"${picked.name}" is already added — increase its quantity instead of adding it again`);
        return;
      }
    }
    setCreateItems(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      if (field === 'productId') {
        const p = products.find((p: any) => p.id === value);
        if (p) {
          next[i].unitPrice  = Number(p.minSaleRate || 0);
          next[i].gstPercent = Number(p.salesGstPercent || 0);
        }
      }
      return next;
    });
  };

  const handleCreateOrder = async () => {
    if (!createCustomerId) { message.error('Please select a customer'); return; }
    if (!createItems.length || createItems.some(i => !i.productId || !i.quantity || !i.unitPrice)) {
      message.error('Every item needs a product, quantity, and price');
      return;
    }
    try {
      await createOrder({
        customerId: createCustomerId,
        items: createItems.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, discountPercent: i.discountPercent || 0 })),
        overallDiscountType: createOverallDisc && createOverallDisc > 0 ? discountType : null,
        overallDiscountValue: createOverallDisc && createOverallDisc > 0 ? createOverallDisc : null,
      }).unwrap();
      setCreateOpen(false);
      refetch();
      message.success('Order created');
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to create order');
    }
  };

  // ── Columns ──────────────────────────────────────────────────────────────
  const allColumns = [
    {
      title: 'Order', key: 'order',
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 700, color: '#1a1d2e' }}>#{r.orderNumber}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>
            {r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
          </div>
        </div>
      ),
    },
    {
      title: 'Customer', key: 'customer',
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1a1d2e' }}>{r.customer?.businessName}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{r.customer?.phone}</div>
        </div>
      ),
    },
    {
      title: 'Sales Person', key: 'salesPerson', hide: isMobile,
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1a1d2e' }}>{r.salesPerson?.fullName || '—'}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{r.salesPerson?.phone}</div>
        </div>
      ),
    },
    {
      title: 'Route', key: 'route', hide: isMobile,
      render: (_: any, r: any) => (
        <span style={{ color: '#374151' }}>{r.customer?.routeName || '—'}</span>
      ),
    },
    {
      title: 'Items', key: 'items', width: 80, hide: isMobile,
      render: (_: any, r: any) => (
        <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: '1px solid #bfdbfe' }}>
          {r.items?.length || 0}
        </span>
      ),
    },
    {
      title: 'Amount', key: 'amount',
      render: (_: any, r: any) => (
        <div style={{ fontWeight: 800, color: '#059669', fontSize: 14 }}>₹{r.totalAmount?.toFixed(2)}</div>
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (s: string) => <StatusPill status={s} />,
    },
    {
      title: '', key: 'actions', width: isMobile ? 120 : 200,
      render: (_: any, record: any) => (
        <Space size={2} split={isMobile ? null : <span style={{ color: '#e8ecf0' }}>|</span>}>
          <Tooltip title="View">
            <Button type="text" size="small" icon={<EyeOutlined />}
              onClick={() => { setSelectedOrder(record); setDrawerOpen(true); }} />
          </Tooltip>
          {record.status === 'SUBMITTED' && hasPermission('INVOICE_APPROVE') && (
            <>
              <Tooltip title="Edit">
                <Button type="text" size="small" icon={<EditOutlined />} style={{ color: '#2563eb' }}
                  onClick={() => openEdit(record)} />
              </Tooltip>
              <Tooltip title="Approve">
                <Button type="text" size="small" icon={<CheckCircleOutlined />} style={{ color: '#059669' }}
                  loading={approving} onClick={() => handleApprove(record.id)} />
              </Tooltip>
              <Tooltip title="Reject">
                <Button type="text" size="small" danger icon={<CloseCircleOutlined />}
                  onClick={() => openRejectModal(record.id)} />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];
  const columns = allColumns.filter((c: any) => !c.hide);

  return (
    <div>
      <PageHeader
        title="Invoice Approver"
        subtitle="Review, edit and approve submitted orders"
        count={filteredOrders.filter((o: any) => o.status === 'SUBMITTED').length}
        countLabel="pending"
        action={
          <Space wrap>
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Search order # or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              style={{ width: 220 }}
            />
            <DatePicker
              value={dateFilter}
              onChange={(date) => { setDateFilter(date); setSelectedRowKeys([]); }}
              format="DD MMM YYYY"
              allowClear
              placeholder="All dates"
              disabledDate={noFutureDates}
              style={{ width: 150 }}
            />
            <Select
              allowClear
              placeholder="All statuses"
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v ?? null); setSelectedRowKeys([]); }}
              style={{ width: 160 }}
              options={[
                { value: 'SUBMITTED',        label: 'Pending Approval' },
                { value: 'APPROVED',         label: 'Approved' },
                { value: 'CANCELLED',        label: 'Cancelled' },
              ]}
            />
            {salesPersonOptions.length > 0 && (
              <Select
                allowClear
                placeholder="All salespersons"
                value={salesPersonFilter}
                onChange={(v) => { setSalesPersonFilter(v ?? null); setRouteFilter(null); setSelectedRowKeys([]); }}
                style={{ width: 180 }}
                options={salesPersonOptions.map(([id, name]) => ({ value: id, label: name }))}
              />
            )}
            {routeOptions.length > 0 && (
              <Select
                allowClear
                placeholder="All routes"
                value={routeFilter}
                onChange={(v) => { setRouteFilter(v ?? null); setSelectedRowKeys([]); }}
                style={{ width: 160 }}
                options={routeOptions.map(r => ({ value: r, label: r }))}
              />
            )}
            {!isMobile && selectedRowKeys.length > 0 && (
              <Button type="primary" icon={<CheckCircleOutlined />} loading={bulkApproving}
                onClick={handleApproveSelected}
                style={{ background: '#059669', border: 'none', fontWeight: 700, borderRadius: 8 }}>
                Approve Selected ({selectedRowKeys.length})
              </Button>
            )}
            {(() => {
              const pendingCount = filteredOrders.filter((o: any) => o.status === 'SUBMITTED').length;
              return pendingCount > 0 && (
                <Popconfirm
                  title={`Approve all ${pendingCount} pending order(s)?`}
                  description="This matches your current filters and cannot be undone."
                  onConfirm={handleApproveAll}
                  okText="Approve All"
                >
                  <Button type="primary" icon={<CheckCircleOutlined />} loading={approvingAll}
                    style={{ background: '#059669', border: 'none', fontWeight: 700, borderRadius: 8 }}>
                    Approve All ({pendingCount})
                  </Button>
                </Popconfirm>
              );
            })()}
            <Button onClick={refetch} style={{ borderRadius: 8 }}>Refresh</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
              style={{ borderRadius: 8 }}>
              New Order
            </Button>
          </Space>
        }
      />

      {oldPendingCount > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12, margin: isMobile ? '0 12px 12px' : '0 24px 12px' }}
          message={`${oldPendingCount} order${oldPendingCount > 1 ? 's' : ''} pending approval from other dates`}
          action={
            <Button size="small" onClick={() => { setDateFilter(null); setStatusFilter('SUBMITTED'); setSelectedRowKeys([]); }}>
              View All
            </Button>
          }
        />
      )}

      {isMobile ? (
        <Spin spinning={isLoading}>
          <div style={{ paddingBottom: 24 }}>
            {filteredOrders.length === 0 && !isLoading && (
              <div style={{ padding: '48px 0', color: '#64748b', textAlign: 'center', fontSize: 14 }}>
                No orders found
              </div>
            )}
            {filteredOrders.map((record: any) => (
              <div key={record.id} style={{
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #e8ecf0',
                marginBottom: 12,
                overflow: 'hidden',
              }}>
                {/* Card header */}
                <div style={{
                  padding: '12px 16px',
                  background: '#f8fafc',
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontWeight: 700, color: '#1a1d2e', fontSize: 14 }}>
                    {record.orderNumber}
                  </span>
                  <StatusPill status={record.status} />
                </div>

                {/* Card body */}
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ fontWeight: 700, color: '#1a1d2e', fontSize: 15, marginBottom: 3 }}>
                    {record.customer?.businessName}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 13, marginBottom: 10 }}>
                    {record.customer?.phone}
                    {record.salesPerson?.fullName && (
                      <span style={{ color: '#9ca3af' }}> · {record.salesPerson.fullName}</span>
                    )}
                    {record.customer?.routeName && (
                      <span style={{ color: '#9ca3af' }}> · {record.customer.routeName}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: '#9ca3af', fontSize: 12 }}>
                      {record.orderDate
                        ? new Date(record.orderDate).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })
                        : '—'}
                      {' · '}{record.items?.length || 0} item{record.items?.length !== 1 ? 's' : ''}
                    </div>
                    <div style={{ fontWeight: 800, color: '#059669', fontSize: 18 }}>
                      ₹{record.totalAmount?.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Card actions */}
                <div style={{
                  padding: '10px 16px',
                  borderTop: '1px solid #f0f0f0',
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                }}>
                  <Button size="small" icon={<EyeOutlined />}
                    onClick={() => { setSelectedOrder(record); setDrawerOpen(true); }}
                    style={{ flex: 1, minWidth: 60 }}>
                    View
                  </Button>
                  {record.status === 'SUBMITTED' && (
                    <>
                      <Button size="small" icon={<EditOutlined />}
                        onClick={() => openEdit(record)}
                        style={{ flex: 1, minWidth: 60, color: '#2563eb', borderColor: '#2563eb' }}>
                        Edit
                      </Button>
                      <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                        loading={approving} onClick={() => handleApprove(record.id)}
                        style={{ flex: 1, minWidth: 80, background: '#059669', border: 'none' }}>
                        Approve
                      </Button>
                      <Button size="small" danger icon={<CloseCircleOutlined />}
                        onClick={() => openRejectModal(record.id)}
                        style={{ flex: 1, minWidth: 60 }}>
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Spin>
      ) : (
        <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
          <Table
            rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys as string[]) }}
            columns={columns}
            dataSource={filteredOrders}
            rowKey="id"
            loading={isLoading}
            pagination={{ pageSize: 20, showTotal: t => `${t} orders` }}
            size="middle"
            scroll={{ x: 1000 }}
            locale={{ emptyText: <div style={{ padding: '40px 0', color: '#64748b' }}>No orders</div> }}
          />
        </Card>
      )}

      {/* ── Order Detail Modal ───────────────────────────────────────────── */}
      <Modal
        title={selectedOrder ? `${selectedOrder.orderNumber} — ${selectedOrder.customer?.businessName}` : ''}
        open={drawerOpen}
        onCancel={() => { setDrawerOpen(false); setSelectedOrder(null); }}
        footer={[
          selectedOrder?.status === 'SUBMITTED' && (
            <Button key="edit" icon={<EditOutlined />}
              onClick={() => { openEdit(selectedOrder); setDrawerOpen(false); }}>
              Edit Order
            </Button>
          ),
          selectedOrder?.status === 'SUBMITTED' && (
            <Button key="reject" danger icon={<CloseCircleOutlined />}
              onClick={() => openRejectModal(selectedOrder.id)}>
              Reject
            </Button>
          ),
          selectedOrder?.status === 'SUBMITTED' && (
            <Button key="approve" type="primary" icon={<CheckCircleOutlined />} loading={approving}
              onClick={() => handleApprove(selectedOrder.id)}
              style={{ background: '#059669', border: 'none' }}>
              Approve Order
            </Button>
          ),
          <Button key="close" onClick={() => { setDrawerOpen(false); setSelectedOrder(null); }}>Close</Button>,
        ].filter(Boolean)}
        width={isMobile ? '98vw' : 900}
      >
        {selectedOrder && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Summary grid */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12, background: '#f8fafc', borderRadius: 10, padding: '12px 16px' }}>
              {[
                { label: 'Order #',      value: selectedOrder.orderNumber },
                { label: 'Date',         value: new Date(selectedOrder.orderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
                { label: 'Customer',     value: selectedOrder.customer?.businessName },
                { label: 'Phone',        value: selectedOrder.customer?.phone || '—' },
                { label: 'Sales Person', value: selectedOrder.salesPerson?.fullName || '—' },
                { label: 'Route',        value: selectedOrder.customer?.routeName || '—' },
                { label: 'Status',       value: <StatusPill status={selectedOrder.status} /> },
                { label: 'Outstanding',  value: <span style={{ color: Number(selectedOrder.balanceAmount) > 0 ? '#dc2626' : '#059669', fontWeight: 700 }}>₹{Number(selectedOrder.balanceAmount).toFixed(2)}</span> },
              ].map((row, i) => (
                <div key={i}>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{row.label}</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, marginTop: 2 }}>{row.value}</div>
                </div>
              ))}
            </div>

            {selectedOrder.notes && (
              <div style={{ fontSize: 13, color: '#64748b', background: '#fffbeb', borderRadius: 8, padding: '8px 12px' }}>{selectedOrder.notes}</div>
            )}

            {Number(selectedOrder.overallDiscountAmount) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, background: '#fef2f2', borderRadius: 8, padding: '8px 12px' }}>
                <span style={{ color: '#64748b' }}>
                  Overall Discount
                  {selectedOrder.overallDiscountType === 'PERCENT' && selectedOrder.overallDiscountValue
                    ? ` (${Number(selectedOrder.overallDiscountValue)}%)` : ''}
                </span>
                <span style={{ color: '#dc2626', fontWeight: 700 }}>−₹{Number(selectedOrder.overallDiscountAmount).toFixed(2)}</span>
              </div>
            )}

            {/* Items table */}
            <Table
              size="small"
              dataSource={[
                ...(selectedOrder.items || []),
                {
                  id: '__total__',
                  __isTotal: true,
                  quantity: (selectedOrder.items || []).reduce((s: number, i: any) => s + (i.quantity || 0), 0),
                  lineTotal: selectedOrder.totalAmount,
                  gstAmount: selectedOrder.totalGst,
                },
              ]}
              rowKey="id"
              pagination={false}
              scroll={{ x: isMobile ? 600 : undefined }}
              onRow={(row: any) => row.__isTotal ? { style: { background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #e2e8f0' } } : {}}
              columns={[
                {
                  title: '#', width: 36,
                  render: (_: any, row: any, i: number) => row.__isTotal
                    ? <span style={{ fontWeight: 700 }}>Total</span>
                    : <span style={{ color: '#94a3b8' }}>{i + 1}</span>,
                },
                {
                  title: 'Product', key: 'product', width: 200,
                  render: (_: any, row: any) => row.__isTotal ? null : (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{row.product?.name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{row.product?.brand}</div>
                    </div>
                  ),
                },
                {
                  title: 'Qty', dataIndex: 'quantity', align: 'right' as const, width: 55,
                  render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
                },
                {
                  title: 'Rate', dataIndex: 'unitPrice', align: 'right' as const, width: 80,
                  render: (v: any, row: any) => row.__isTotal ? null : `₹${Number(v).toFixed(2)}`,
                },
                {
                  title: 'Disc %', dataIndex: 'discountPercent', align: 'right' as const, width: 65,
                  render: (v: any, row: any) => row.__isTotal ? null : (Number(v) > 0 ? `${Number(v).toFixed(2)}%` : '—'),
                },
                {
                  title: 'GST', dataIndex: 'gstAmount', align: 'right' as const, width: 85,
                  render: (v: any, row: any) => row.__isTotal ? `₹${Number(v).toFixed(2)}` : (
                    <div>
                      <div>₹{Number(v).toFixed(2)}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{row.gstPercent || 0}%</div>
                    </div>
                  ),
                },
                {
                  title: 'Total', dataIndex: 'lineTotal', align: 'right' as const, width: 90,
                  render: (v: any) => <span style={{ fontWeight: 700, color: '#059669' }}>₹{Number(v).toFixed(2)}</span>,
                },
              ]}
            />
          </div>
        )}
      </Modal>

      {/* ── Edit Order Modal ──────────────────────────────────────────────── */}
      <Modal
        title={<span style={{ fontWeight: 700 }}>Edit Order #{editOrder?.orderNumber}</span>}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleSaveEdit}
        confirmLoading={updating}
        okText="Save Changes"
        okButtonProps={{ style: { background: '#2563eb', borderColor: '#2563eb' } }}
        width={editModalWidth}
      >
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
          Editing is only available while the order is pending approval. Stock levels will be recalculated automatically.
        </div>

        {/* Items editor */}
        <div style={{ borderBottom: '1px solid #f0f0f0', marginBottom: 12, paddingBottom: 8, fontWeight: 700, color: '#1a1d2e' }}>
          Items
        </div>

        {/* Desktop header row */}
        {!isMobile && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 100px 70px 80px 32px', gap: 8, padding: '0 0 6px', borderBottom: '1px solid #e2e8f0', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            <span>Product</span><span>Qty</span><span>Rate (₹)</span><span>Disc %</span><span style={{ textAlign: 'right' }}>Amount</span><span />
          </div>
        )}

        {editItems.map((item, i) => isMobile ? (
          <div key={i} style={{ border: '1px solid #e8ecf0', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
            {/* Product row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <Select
                showSearch placeholder="Select product" value={item.productId}
                optionFilterProp="children"
                onChange={(v) => updateEditItem(i, 'productId', v)}
                style={{ flex: 1 }} size="small"
              >
                {products.map((p: any) => (
                  <Option key={p.id} value={p.id}>{p.name}{p.brand ? ` (${p.brand})` : ''}</Option>
                ))}
              </Select>
              <Button type="text" danger size="small" onClick={() => removeEditItem(i)}
                style={{ padding: '0 6px', minWidth: 'unset', flexShrink: 0 }}>
                ✕
              </Button>
            </div>
            {/* Qty / Rate / Total row */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 3, fontWeight: 600 }}>Qty</div>
                <InputNumber min={1} size="small" style={{ width: '100%' }}
                  value={item.quantity} onChange={(v) => updateEditItem(i, 'quantity', v || 1)} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 3, fontWeight: 600 }}>Rate (₹)</div>
                <InputNumber min={0} precision={2} size="small" style={{ width: '100%' }}
                  value={item.unitPrice} onChange={(v) => updateEditItem(i, 'unitPrice', v || 0)} />
              </div>
              <div style={{ textAlign: 'right', flex: 1, minWidth: 80 }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 3, fontWeight: 600 }}>Amount</div>
                <div style={{ fontWeight: 700, color: '#059669', fontSize: 14 }}>₹{calcEditLine(item).toFixed(2)}</div>
              </div>
            </div>
          </div>
        ) : (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 100px 70px 80px 32px', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
            <Select showSearch placeholder="Select product" value={item.productId}
              optionFilterProp="children"
              onChange={(v) => updateEditItem(i, 'productId', v)}
              style={{ width: '100%' }} size="small">
              {products.map((p: any) => (
                <Option key={p.id} value={p.id}>{p.name}{p.brand ? ` (${p.brand})` : ''}</Option>
              ))}
            </Select>
            <InputNumber min={1} size="small" style={{ width: '100%' }}
              value={item.quantity} onChange={(v) => updateEditItem(i, 'quantity', v || 1)} />
            <InputNumber min={0} precision={2} size="small" style={{ width: '100%' }}
              value={item.unitPrice} onChange={(v) => updateEditItem(i, 'unitPrice', v || 0)} />
            <InputNumber min={0} max={100} precision={2} size="small" style={{ width: '100%' }}
              value={item.discountPercent} onChange={(v) => updateEditItem(i, 'discountPercent', v ?? 0)} suffix="%" />
            <div style={{ textAlign: 'right', fontWeight: 700, color: '#059669', fontSize: 12 }}>
              ₹{calcEditLine(item).toFixed(2)}
            </div>
            <Button type="text" danger size="small" onClick={() => removeEditItem(i)}
              style={{ padding: '0 4px', minWidth: 'unset' }}>
              ✕
            </Button>
          </div>
        ))}

        <Button icon={<PlusOutlined />} onClick={addEditItem} block size="small"
          style={{ borderStyle: 'dashed', borderRadius: 8, marginTop: 10, color: '#2563eb', borderColor: '#2563eb' }}>
          Add Item
        </Button>

        {editItems.length > 0 && (() => {
          const gross = editItems.reduce((s, i) => s + calcEditLine(i), 0);
          const disc  = calcOverallDiscount(gross, editOverallDisc);
          return (
            <>
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Overall Discount {discountType === 'AMOUNT' ? '(₹)' : '(%)'}
                </span>
                <InputNumber min={0} precision={2} size="small" style={{ width: 130 }} placeholder="0"
                  max={discountType === 'PERCENT' ? 100 : undefined}
                  {...(discountType === 'AMOUNT' ? { prefix: '₹' } : { suffix: '%' })}
                  value={editOverallDisc ?? undefined}
                  onChange={(v) => setEditOverallDisc(v as number)} />
              </div>
              {disc > 0 && (
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#dc2626' }}>
                  <span>Less: Discount</span>
                  <span>−₹{disc.toFixed(2)}</span>
                </div>
              )}
              <div style={{ marginTop: 8, background: '#ecfdf5', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#059669', fontSize: 14 }}>
                <span>{editItems.length} item(s)</span>
                <span>Total ≈ ₹{(gross - disc).toFixed(2)}</span>
              </div>
            </>
          );
        })()}
      </Modal>

      {/* ── Create Order Modal ───────────────────────────────────────────── */}
      <Modal
        title={<span style={{ fontWeight: 700 }}>Create New Order</span>}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreateOrder}
        confirmLoading={creating}
        okText="Create Order"
        okButtonProps={{ style: { background: '#2563eb', borderColor: '#2563eb' } }}
        width={editModalWidth}
      >
        {/* Customer */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
            Customer <span style={{ color: '#ef4444' }}>*</span>
          </div>
          <Select
            showSearch placeholder="Search customer..."
            value={createCustomerId}
            onChange={setCreateCustomerId}
            optionFilterProp="children"
            style={{ width: '100%' }}
            loading={customersLoading}
            notFoundContent={customersLoading ? 'Loading customers…' : 'No customers found'}
          >
            {customers.map((c: any) => (
              <Option key={c.id} value={c.id}>
                {c.businessName}
              </Option>
            ))}
          </Select>
        </div>

        {/* Items */}
        <div style={{ borderBottom: '1px solid #f0f0f0', marginBottom: 12, paddingBottom: 8, fontWeight: 700, color: '#1a1d2e' }}>
          Items
        </div>

        {isMobile ? (
          <>
            {/* Product search */}
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Search products..."
              value={createProductSearch}
              onChange={e => setCreateProductSearch(e.target.value)}
              allowClear
              style={{ borderRadius: 8, marginBottom: 10 }}
            />

            {/* Browsable product list */}
            <div style={{ border: '1px solid #e8ecf0', borderRadius: 8, overflow: 'hidden', maxHeight: 264, overflowY: 'auto', marginBottom: 14 }}>
              {filteredCreateProducts.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  {createProductSearch ? 'No products found' : 'No products available'}
                </div>
              ) : filteredCreateProducts.map((p: any) => {
                const idx = createItems.findIndex(ci => ci.productId === p.id);
                const qty = idx >= 0 ? createItems[idx].quantity : 0;
                const outOfStock = p.stockQuantity !== null && p.stockQuantity !== undefined && p.stockQuantity === 0;
                return (
                  <div key={p.id} style={{
                    padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
                    borderBottom: '1px solid #f1f5f9',
                    background: qty > 0 ? '#f0fdf4' : '#fff',
                    opacity: outOfStock ? 0.5 : 1,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#1a1d2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      {p.brand && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{p.brand}</div>}
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', marginTop: 2 }}>₹{Number(p.minSaleRate || 0).toFixed(2)}</div>
                    </div>
                    {outOfStock ? (
                      <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, flexShrink: 0 }}>Out of stock</span>
                    ) : qty === 0 ? (
                      <button
                        onClick={() => addProductToCreate(p)}
                        style={{ width: 34, height: 34, border: '1.5px solid #059669', borderRadius: 8, background: '#fff', color: '#059669', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      >
                        <PlusOutlined style={{ fontSize: 13 }} />
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => {
                            if (qty <= 1) removeCreateItem(idx);
                            else updateCreateItem(idx, 'quantity', qty - 1);
                          }}
                          style={{ width: 30, height: 30, border: '1px solid #e8ecf0', borderRadius: 6, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <MinusOutlined style={{ fontSize: 10 }} />
                        </button>
                        <span style={{ width: 28, textAlign: 'center', fontWeight: 700, color: '#059669', fontSize: 14 }}>{qty}</span>
                        <button
                          onClick={() => addProductToCreate(p)}
                          style={{ width: 30, height: 30, border: 'none', borderRadius: 6, background: '#059669', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <PlusOutlined style={{ fontSize: 10 }} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Selected items — rate override */}
            {createItems.length > 0 && (
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
                  Price Settings
                </div>
                {createItems.map((item, i) => {
                  const p = products.find((pr: any) => pr.id === item.productId);
                  return (
                    <div key={i} style={{ border: '1px solid #e8ecf0', borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#1a1d2e', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p?.name}</div>
                        <span style={{ fontSize: 12, color: '#059669', fontWeight: 700, marginLeft: 8, flexShrink: 0 }}>×{item.quantity}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 3, fontWeight: 600 }}>Rate (₹)</div>
                          <InputNumber min={0} precision={2} size="small" style={{ width: '100%' }}
                            value={item.unitPrice} onChange={(v) => updateCreateItem(i, 'unitPrice', v || 0)} />
                        </div>
                        <div style={{ textAlign: 'right', flex: 1 }}>
                          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 3, fontWeight: 600 }}>Amount</div>
                          <div style={{ fontWeight: 700, color: '#059669', fontSize: 14, marginTop: 6 }}>₹{calcEditLine(item).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(() => {
                  const gross = createItems.reduce((s, i) => s + calcEditLine(i), 0);
                  const disc  = calcOverallDiscount(gross, createOverallDisc);
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                          Overall Discount {discountType === 'AMOUNT' ? '(₹)' : '(%)'}
                        </span>
                        <InputNumber min={0} precision={2} size="small" style={{ width: 110 }} placeholder="0"
                          max={discountType === 'PERCENT' ? 100 : undefined}
                          {...(discountType === 'AMOUNT' ? { prefix: '₹' } : { suffix: '%' })}
                          value={createOverallDisc ?? undefined}
                          onChange={(v) => setCreateOverallDisc(v as number)} />
                      </div>
                      {disc > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#dc2626', marginBottom: 6 }}>
                          <span>Less: Discount</span>
                          <span>−₹{disc.toFixed(2)}</span>
                        </div>
                      )}
                      <div style={{ background: '#ecfdf5', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#059669', fontSize: 14 }}>
                        <span>{createItems.length} item(s)</span>
                        <span>Total ≈ ₹{(gross - disc).toFixed(2)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 80px 32px', gap: 8, padding: '0 0 6px', borderBottom: '1px solid #e2e8f0', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              <span>Product</span><span>Qty</span><span>Rate (₹)</span><span style={{ textAlign: 'right' }}>Amount</span><span />
            </div>
            {createItems.map((item, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 80px 32px', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                <Select showSearch placeholder="Select product" value={item.productId}
                  optionFilterProp="children"
                  onChange={(v) => updateCreateItem(i, 'productId', v)}
                  style={{ width: '100%' }} size="small">
                  {products.map((p: any) => (
                    <Option key={p.id} value={p.id}>{p.name}{p.brand ? ` (${p.brand})` : ''}</Option>
                  ))}
                </Select>
                <InputNumber min={1} size="small" style={{ width: '100%' }}
                  value={item.quantity} onChange={(v) => updateCreateItem(i, 'quantity', v || 1)} />
                <InputNumber min={0} precision={2} size="small" style={{ width: '100%' }}
                  value={item.unitPrice} onChange={(v) => updateCreateItem(i, 'unitPrice', v || 0)} />
                <div style={{ textAlign: 'right', fontWeight: 700, color: '#059669', fontSize: 12 }}>
                  ₹{calcEditLine(item).toFixed(2)}
                </div>
                <Button type="text" danger size="small" onClick={() => removeCreateItem(i)}
                  style={{ padding: '0 4px', minWidth: 'unset' }}>✕</Button>
              </div>
            ))}
            <Button icon={<PlusOutlined />} onClick={addCreateItem} block size="small"
              style={{ borderStyle: 'dashed', borderRadius: 8, marginTop: 10, color: '#2563eb', borderColor: '#2563eb' }}>
              Add Item
            </Button>
            {createItems.length > 0 && (() => {
              const gross = createItems.reduce((s, i) => s + calcEditLine(i), 0);
              const disc  = calcOverallDiscount(gross, createOverallDisc);
              return (
                <>
                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Overall Discount {discountType === 'AMOUNT' ? '(₹)' : '(%)'}
                    </span>
                    <InputNumber min={0} precision={2} size="small" style={{ width: 130 }} placeholder="0"
                      max={discountType === 'PERCENT' ? 100 : undefined}
                      {...(discountType === 'AMOUNT' ? { prefix: '₹' } : { suffix: '%' })}
                      value={createOverallDisc ?? undefined}
                      onChange={(v) => setCreateOverallDisc(v as number)} />
                  </div>
                  {disc > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#dc2626' }}>
                      <span>Less: Discount</span>
                      <span>−₹{disc.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ marginTop: 8, background: '#ecfdf5', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#059669', fontSize: 14 }}>
                    <span>{createItems.length} item(s)</span>
                    <span>Total ≈ ₹{(gross - disc).toFixed(2)}</span>
                  </div>
                </>
              );
            })()}
          </>
        )}

      </Modal>

      {/* ── Reject Modal ─────────────────────────────────────────────────── */}
      <Modal
        title={<span style={{ fontWeight: 700 }}>Reject Order</span>}
        open={rejectModal}
        onOk={handleReject}
        onCancel={() => setRejectModal(false)}
        confirmLoading={cancelling}
        okText="Reject"
        okButtonProps={{ danger: true }}
      >
        <Form form={rejectForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="reason" label="Reason for rejection"
            rules={[{ required: true, message: 'Please enter a reason' }]}>
            <Input.TextArea rows={3} placeholder="E.g. Incorrect pricing, duplicate order..." style={{ borderRadius: 8 }} />
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
};

export default InvoiceApproverPage;
