import React, { useState } from 'react';
import {
  Card, Table, Button, Drawer, Descriptions, message, Space, Input, Modal,
  Form, Select, InputNumber, Grid, Spin, Radio,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, EditOutlined,
  PlusOutlined, RollbackOutlined, SearchOutlined, MinusOutlined,
} from '@ant-design/icons';
import {
  useGetOrdersQuery, useApproveOrderMutation, useCancelOrderMutation, useUpdateOrderMutation,
  useCreateOrderMutation,
} from '../../store/api/orderApi';
import { useGetProductsQuery } from '../../store/api/productApi';
import { useGetCustomersQuery } from '../../store/api/customerApi';
import PageHeader from '../../components/PageHeader';
import ReturnFromOrderModal from '../../components/ReturnFromOrderModal';

const { Option } = Select;

const RETURNABLE_STATUSES = new Set(['APPROVED', 'PREPARING', 'PREPARED', 'DISPATCHED', 'DELIVERED']);

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  DRAFT:            { color: '#6b7280', bg: '#f3f4f6',  label: 'Draft' },
  SUBMITTED:        { color: '#f59e0b', bg: '#fffbeb',  label: 'Submitted' },
  PENDING_APPROVAL: { color: '#f59e0b', bg: '#fffbeb',  label: 'Pending Approval' },
  APPROVED:         { color: '#059669', bg: '#ecfdf5',  label: 'Approved' },
  PREPARING:        { color: '#06b6d4', bg: '#ecfeff',  label: 'Preparing' },
  PREPARED:         { color: '#06b6d4', bg: '#ecfeff',  label: 'Prepared' },
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
  const drawerWidth = isMobile ? '100%' : 520;
  const editModalWidth = isMobile ? '100vw' : 780;

  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [rejectModal,  setRejectModal]  = useState(false);
  const [rejectForm]                    = Form.useForm();
  const [rejectingId,  setRejectingId]  = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [bulkApproving, setBulkApproving]     = useState(false);

  // Edit order state
  const [editOpen,  setEditOpen]  = useState(false);
  const [editOrder, setEditOrder] = useState<any>(null);
  const [editItems, setEditItems] = useState<any[]>([]);

  // Return modal state
  const [returnOpen,  setReturnOpen]  = useState(false);
  const [returnOrder, setReturnOrder] = useState<any>(null);

  // Create order state
  const [createOpen, setCreateOpen]               = useState(false);
  const [isWalkIn, setIsWalkIn]                   = useState(false);
  const [createCustomerId, setCreateCustomerId]   = useState<string | undefined>();
  const [walkInName, setWalkInName]               = useState('');
  const [walkInPhone, setWalkInPhone]             = useState('');
  const [createItems, setCreateItems]             = useState<any[]>([]);
  const [createProductSearch, setCreateProductSearch] = useState('');

  const { data: ordersData, isLoading, refetch } = useGetOrdersQuery({});
  const { data: productsData } = useGetProductsQuery({ size: 500 });
  const { data: customersData, isLoading: customersLoading } = useGetCustomersQuery({});
  const [approveOrder, { isLoading: approving }] = useApproveOrderMutation();
  const [cancelOrder,  { isLoading: cancelling }] = useCancelOrderMutation();
  const [updateOrder,  { isLoading: updating }]  = useUpdateOrderMutation();
  const [createOrder,  { isLoading: creating }]  = useCreateOrderMutation();

  const orders:    any[] = ordersData?.data?.content || ordersData?.data || [];
  const products:  any[] = productsData?.data?.content || productsData?.data || [];
  const customers: any[] = customersData?.data?.content || customersData?.data || [];

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
    let ok = 0;
    for (const id of selectedRowKeys) {
      try { await approveOrder(id).unwrap(); ok++; } catch { /* skip */ }
    }
    setBulkApproving(false);
    setSelectedRowKeys([]);
    message.success(`${ok} order(s) approved`);
    refetch();
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
      productId: item.product?.id,
      quantity:  item.quantity,
      unitPrice: Number(item.unitPrice),
      gstPercent: Number(item.gstPercent),
      _name: item.product?.name,
      _brand: item.product?.brand,
    })));
    setEditOpen(true);
  };

  const addEditItem = () =>
    setEditItems(prev => [...prev, { productId: undefined, quantity: 1, unitPrice: 0, gstPercent: 0 }]);

  const removeEditItem = (i: number) => setEditItems(prev => prev.filter((_, idx) => idx !== i));

  const updateEditItem = (i: number, field: string, value: any) => {
    setEditItems(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      if (field === 'productId') {
        const p = products.find((p: any) => p.id === value);
        if (p) {
          next[i].unitPrice  = Number(p.salesRate1 || 0);
          next[i].gstPercent = Number(p.salesGstPercent || 0);
          next[i]._name  = p.name;
          next[i]._brand = p.brand;
        }
      }
      return next;
    });
  };

  const calcEditLine = (item: any) =>
    (item.unitPrice || 0) * (item.quantity || 0) * (1 + (item.gstPercent || 0) / 100);

  const handleSaveEdit = async () => {
    if (!editItems.length || editItems.some(i => !i.productId || !i.quantity || !i.unitPrice)) {
      message.error('Every item needs a product, quantity, and price');
      return;
    }
    try {
      await updateOrder({
        id: editOrder.id,
        items: editItems.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
        notes: editOrder.notes,
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
    setIsWalkIn(false);
    setCreateCustomerId(undefined);
    setWalkInName('');
    setWalkInPhone('');
    setCreateItems(isMobile ? [] : [{ productId: undefined, quantity: 1, unitPrice: 0, gstPercent: 0 }]);
    setCreateProductSearch('');
    setCreateOpen(true);
  };

  const addCreateItem = () =>
    setCreateItems(prev => [...prev, { productId: undefined, quantity: 1, unitPrice: 0, gstPercent: 0 }]);

  const removeCreateItem = (i: number) => setCreateItems(prev => prev.filter((_, idx) => idx !== i));

  const addProductToCreate = (product: any) => {
    const idx = createItems.findIndex(i => i.productId === product.id);
    if (idx >= 0) {
      setCreateItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCreateItems(prev => [...prev, {
        productId: product.id,
        quantity: 1,
        unitPrice: Number(product.salesRate1 || 0),
        gstPercent: Number(product.salesGstPercent || 0),
      }]);
    }
  };

  const updateCreateItem = (i: number, field: string, value: any) => {
    setCreateItems(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      if (field === 'productId') {
        const p = products.find((p: any) => p.id === value);
        if (p) {
          next[i].unitPrice  = Number(p.salesRate1 || 0);
          next[i].gstPercent = Number(p.salesGstPercent || 0);
        }
      }
      return next;
    });
  };

  const handleCreateOrder = async () => {
    if (isWalkIn) {
      if (!walkInName.trim()) { message.error('Please enter the customer name'); return; }
    } else {
      if (!createCustomerId) { message.error('Please select a customer'); return; }
    }
    if (!createItems.length || createItems.some(i => !i.productId || !i.quantity || !i.unitPrice)) {
      message.error('Every item needs a product, quantity, and price');
      return;
    }
    try {
      await createOrder(isWalkIn
        ? { walkInName: walkInName.trim(), walkInPhone: walkInPhone.trim() || undefined, items: createItems.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })) }
        : { customerId: createCustomerId, items: createItems.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })) }
      ).unwrap();
      message.success('Order created');
      setCreateOpen(false);
      refetch();
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
            {r.orderDate ? new Date(r.orderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
          </div>
        </div>
      ),
    },
    {
      title: 'Customer', key: 'customer',
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1a1d2e' }}>
            {r.customer?.businessName || r.walkInName}
            {!r.customer && r.walkInName && (
              <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#6b7280', background: '#f3f4f6', padding: '1px 6px', borderRadius: 10 }}>Walk-in</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{r.customer?.phone || r.walkInPhone}</div>
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
      title: '', key: 'actions', width: isMobile ? 120 : 240,
      render: (_: any, record: any) => (
        <Space size={4} split={isMobile ? null : <span style={{ color: '#e8ecf0' }}>|</span>}>
          <Button type="link" size="small" icon={<EyeOutlined />}
            onClick={() => { setSelectedOrder(record); setDrawerOpen(true); }}>
            {!isMobile && 'View'}
          </Button>
          {record.status === 'SUBMITTED' && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} style={{ color: '#2563eb' }}
                onClick={() => openEdit(record)}>
                {!isMobile && 'Edit'}
              </Button>
              <Button type="link" size="small" icon={<CheckCircleOutlined />} style={{ color: '#059669' }}
                loading={approving} onClick={() => handleApprove(record.id)}>
                {!isMobile && 'Approve'}
              </Button>
              <Button type="link" size="small" danger icon={<CloseCircleOutlined />}
                onClick={() => openRejectModal(record.id)}>
                {!isMobile && 'Reject'}
              </Button>
            </>
          )}
          {RETURNABLE_STATUSES.has(record.status) && (
            <Button type="link" size="small" danger icon={<RollbackOutlined />}
              onClick={() => { setReturnOrder(record); setReturnOpen(true); }}>
              {!isMobile && 'Return'}
            </Button>
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
        count={orders.filter((o: any) => o.status === 'SUBMITTED').length}
        countLabel="pending"
        action={
          <Space>
            {!isMobile && selectedRowKeys.length > 0 && (
              <Button type="primary" icon={<CheckCircleOutlined />} loading={bulkApproving}
                onClick={handleApproveSelected}
                style={{ background: '#059669', border: 'none', fontWeight: 700, borderRadius: 8 }}>
                Approve Selected ({selectedRowKeys.length})
              </Button>
            )}
            <Button onClick={refetch} style={{ borderRadius: 8 }}>Refresh</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
              style={{ borderRadius: 8 }}>
              New Order
            </Button>
          </Space>
        }
      />

      {isMobile ? (
        <Spin spinning={isLoading}>
          <div style={{ paddingBottom: 24 }}>
            {orders.length === 0 && !isLoading && (
              <div style={{ padding: '48px 0', color: '#64748b', textAlign: 'center', fontSize: 14 }}>
                No orders found
              </div>
            )}
            {orders.map((record: any) => (
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
                  <div style={{ fontWeight: 700, color: '#1a1d2e', fontSize: 15, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {record.customer?.businessName || record.walkInName}
                    {!record.customer && record.walkInName && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', background: '#f3f4f6', padding: '1px 6px', borderRadius: 10 }}>Walk-in</span>
                    )}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 13, marginBottom: 10 }}>
                    {record.customer?.phone || record.walkInPhone}
                    {record.salesPerson?.fullName && (
                      <span style={{ color: '#9ca3af' }}> · {record.salesPerson.fullName}</span>
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
                  {RETURNABLE_STATUSES.has(record.status) && (
                    <Button size="small" danger icon={<RollbackOutlined />}
                      onClick={() => { setReturnOrder(record); setReturnOpen(true); }}
                      style={{ flex: 1, minWidth: 70 }}>
                      Return
                    </Button>
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
            dataSource={orders}
            rowKey="id"
            loading={isLoading}
            pagination={{ pageSize: 20, showTotal: t => `${t} orders` }}
            size="middle"
            scroll={{ x: 1000 }}
            locale={{ emptyText: <div style={{ padding: '40px 0', color: '#64748b' }}>No orders</div> }}
          />
        </Card>
      )}

      {/* ── Order Detail Drawer ───────────────────────────────────────────── */}
      <Drawer
        title={
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Order #{selectedOrder?.orderNumber}</div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
              {selectedOrder?.customer?.businessName || selectedOrder?.walkInName}
              {!selectedOrder?.customer && selectedOrder?.walkInName && (
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#6b7280', background: '#f3f4f6', padding: '1px 6px', borderRadius: 10 }}>Walk-in</span>
              )}
            </div>
          </div>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={drawerWidth}
        footer={
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            {selectedOrder?.status === 'SUBMITTED' && (
              <>
                <Button icon={<EditOutlined />} onClick={() => { openEdit(selectedOrder); setDrawerOpen(false); }}>
                  Edit Order
                </Button>
                <Button danger icon={<CloseCircleOutlined />} onClick={() => openRejectModal(selectedOrder.id)}>
                  Reject
                </Button>
                <Button type="primary" icon={<CheckCircleOutlined />} loading={approving}
                  onClick={() => handleApprove(selectedOrder.id)}
                  style={{ background: '#059669', border: 'none' }}>
                  Approve Order
                </Button>
              </>
            )}
            {RETURNABLE_STATUSES.has(selectedOrder?.status) && (
              <Button danger icon={<RollbackOutlined />}
                onClick={() => { setReturnOrder(selectedOrder); setReturnOpen(true); }}>
                Return Items
              </Button>
            )}
          </Space>
        }
      >
        {selectedOrder && (
          <>
            <Descriptions bordered size="small" column={isMobile ? 1 : 2} style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Order #">{selectedOrder.orderNumber}</Descriptions.Item>
              <Descriptions.Item label="Date">
                {new Date(selectedOrder.orderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Descriptions.Item>
              <Descriptions.Item label="Customer">
                {selectedOrder.customer?.businessName || selectedOrder.walkInName}
                {!selectedOrder.customer && selectedOrder.walkInName && (
                  <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#6b7280', background: '#f3f4f6', padding: '1px 6px', borderRadius: 10 }}>Walk-in</span>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">{selectedOrder.customer?.phone || selectedOrder.walkInPhone || '—'}</Descriptions.Item>
              <Descriptions.Item label="Sales Person">{selectedOrder.salesPerson?.fullName || '—'}</Descriptions.Item>
              <Descriptions.Item label="Status"><StatusPill status={selectedOrder.status} /></Descriptions.Item>
              <Descriptions.Item label="Subtotal">₹{selectedOrder.subTotal?.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="GST">₹{selectedOrder.totalGst?.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="Total" span={2}>
                <strong style={{ color: '#059669', fontSize: 16 }}>₹{selectedOrder.totalAmount?.toFixed(2)}</strong>
              </Descriptions.Item>
              {selectedOrder.notes && (
                <Descriptions.Item label="Notes" span={2}>{selectedOrder.notes}</Descriptions.Item>
              )}
            </Descriptions>

            <div style={{ fontWeight: 700, color: '#1a1d2e', marginBottom: 12, fontSize: 14 }}>
              Order Items ({selectedOrder.items?.length || 0})
            </div>
            <Table
              size="small" dataSource={selectedOrder.items || []} rowKey="id" pagination={false}
              scroll={isMobile ? { x: true } : undefined}
              columns={[
                {
                  title: 'Product', key: 'product',
                  render: (_: any, r: any) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.product?.name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.product?.brand}</div>
                    </div>
                  ),
                },
                { title: 'Qty', dataIndex: 'quantity', key: 'qty', width: 55 },
                ...(!isMobile ? [
                  { title: 'Rate', dataIndex: 'unitPrice', key: 'rate', width: 80, render: (v: number) => `₹${Number(v)?.toFixed(2)}` },
                  { title: 'GST', dataIndex: 'gstAmount', key: 'gst', width: 70, render: (v: number) => `₹${Number(v)?.toFixed(2)}` },
                ] : []),
                { title: 'Total', dataIndex: 'lineTotal', key: 'total', width: 80, render: (v: number) => <strong style={{ color: '#059669' }}>₹{Number(v)?.toFixed(2)}</strong> },
              ]}
            />
          </>
        )}
      </Drawer>

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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 80px 32px', gap: 8, padding: '0 0 6px', borderBottom: '1px solid #e2e8f0', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            <span>Product</span><span>Qty</span><span>Rate (₹)</span><span style={{ textAlign: 'right' }}>Amount</span><span />
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
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 80px 32px', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
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

        {editItems.length > 0 && (
          <div style={{ marginTop: 12, background: '#ecfdf5', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#059669', fontSize: 14 }}>
            <span>{editItems.length} item(s)</span>
            <span>Total ≈ ₹{editItems.reduce((s, i) => s + calcEditLine(i), 0).toFixed(2)}</span>
          </div>
        )}
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
          <Radio.Group
            value={isWalkIn ? 'walkin' : 'registered'}
            onChange={e => { setIsWalkIn(e.target.value === 'walkin'); setCreateCustomerId(undefined); setWalkInName(''); setWalkInPhone(''); }}
            optionType="button"
            buttonStyle="solid"
            style={{ marginBottom: 10, width: '100%', display: 'flex' }}
          >
            <Radio.Button value="registered" style={{ flex: 1, textAlign: 'center', fontWeight: 600 }}>Registered</Radio.Button>
            <Radio.Button value="walkin" style={{ flex: 1, textAlign: 'center', fontWeight: 600 }}>Walk-in / Cash</Radio.Button>
          </Radio.Group>
          {isWalkIn ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                placeholder="Customer name *"
                value={walkInName}
                onChange={e => setWalkInName(e.target.value)}
                style={{ flex: 2 }}
              />
              <Input
                placeholder="Phone (optional)"
                value={walkInPhone}
                onChange={e => setWalkInPhone(e.target.value)}
                style={{ flex: 1 }}
                maxLength={15}
              />
            </div>
          ) : (
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
                  {c.businessName}{c.phone ? ` — ${c.phone}` : ''}
                </Option>
              ))}
            </Select>
          )}
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
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', marginTop: 2 }}>₹{Number(p.salesRate1 || 0).toFixed(2)}</div>
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
                <div style={{ background: '#ecfdf5', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#059669', fontSize: 14 }}>
                  <span>{createItems.length} item(s)</span>
                  <span>Total ≈ ₹{createItems.reduce((s, i) => s + calcEditLine(i), 0).toFixed(2)}</span>
                </div>
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
            {createItems.length > 0 && (
              <div style={{ marginTop: 12, background: '#ecfdf5', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#059669', fontSize: 14 }}>
                <span>{createItems.length} item(s)</span>
                <span>Total ≈ ₹{createItems.reduce((s, i) => s + calcEditLine(i), 0).toFixed(2)}</span>
              </div>
            )}
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

      {/* ── Return Items Modal ───────────────────────────────────────────── */}
      {returnOrder && (
        <ReturnFromOrderModal
          order={returnOrder}
          open={returnOpen}
          onClose={() => { setReturnOpen(false); setReturnOrder(null); }}
        />
      )}
    </div>
  );
};

export default InvoiceApproverPage;
