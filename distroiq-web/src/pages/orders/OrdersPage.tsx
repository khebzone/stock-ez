import React, { useState } from 'react';
import {
  Table, Button, Modal, Form, Select, Space, Row, Col,
  Card, message, Descriptions, InputNumber, Input, Popconfirm, DatePicker,
} from 'antd';
import {
  PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, EyeOutlined,
  ShoppingOutlined, PrinterOutlined, RollbackOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { formatINR } from '../../utils/format';
import {
  useGetOrdersQuery, useGetMyOrdersQuery, useGetMyDeliveriesQuery, useCreateOrderMutation,
  useApproveOrderMutation, useCancelOrderMutation,
  useStartPreparingMutation, useMarkPreparedMutation, useVerifyItemsMutation,
  useDispatchOrderMutation, useMarkDeliveredMutation,
} from '../../store/api/orderApi';
import { useGetOrderPaymentsQuery } from '../../store/api/paymentApi';
import { useGetCustomersQuery } from '../../store/api/customerApi';
import { useGetProductsQuery } from '../../store/api/productApi';
import PageHeader from '../../components/PageHeader';
import TableToolbar from '../../components/TableToolbar';
import InvoicePrint from '../../components/InvoicePrint';
import AuditHistoryButton from '../../components/AuditHistoryButton';
import ReturnFromOrderModal from '../../components/ReturnFromOrderModal';

const { Option } = Select;

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  DRAFT:      { color: '#6b7280', bg: '#f3f4f6',  label: 'Draft' },
  SUBMITTED:  { color: '#f59e0b', bg: '#fffbeb',  label: 'Pending Approval' },
  APPROVED:   { color: '#059669', bg: '#ecfdf5',  label: 'Approved' },
  PREPARING:        { color: '#f97316', bg: '#fff7ed',  label: 'Preparing' },
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

const OrdersPage: React.FC = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const role = user.role;
  const isSales     = role === 'SALES';
  const isInvoice   = role === 'INVOICE';
  const isAdmin     = role === 'ADMIN';
  const isWarehouse = role === 'WAREHOUSE';
  const isDelivery  = role === 'DELIVERY';

  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [dateRange, setDateRange]       = useState<[Dayjs, Dayjs] | null>(null);
  const [createModal, setCreateModal]   = useState(false);
  const [detailModal, setDetailModal]   = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderItems, setOrderItems]     = useState<any[]>([]);
  const [printOrder, setPrintOrder]     = useState<any>(null);
  const [verifyModal, setVerifyModal]   = useState(false);
  const [returnModal, setReturnModal]   = useState(false);
  const [verifyQtys, setVerifyQtys]     = useState<Record<string, number>>({});
  const [form] = Form.useForm();

  const { data: myOrdersData,     isLoading: loadingMy,       refetch: refetchMy }       = useGetMyOrdersQuery(undefined,    { skip: !isSales });
  const { data: myDeliveriesData, isLoading: loadingDelivery, refetch: refetchDelivery } = useGetMyDeliveriesQuery(undefined, { skip: !isDelivery });
  const { data: allOrdersData,    isLoading: loadingAll,      refetch: refetchAll }      = useGetOrdersQuery({
    status: statusFilter,
    from: dateRange?.[0]?.format('YYYY-MM-DD'),
    to:   dateRange?.[1]?.format('YYYY-MM-DD'),
  }, { skip: isSales || isDelivery });

  const ordersData = isSales ? myOrdersData : isDelivery ? myDeliveriesData : allOrdersData;
  const isLoading  = isSales ? loadingMy    : isDelivery ? loadingDelivery  : loadingAll;
  const refetch    = isSales ? refetchMy    : isDelivery ? refetchDelivery  : refetchAll;
  const { data: customersData } = useGetCustomersQuery({});
  const { data: productsData }  = useGetProductsQuery({});

  const [createOrder,   { isLoading: creating  }] = useCreateOrderMutation();
  const [approveOrder,  { isLoading: approving }] = useApproveOrderMutation();
  const [cancelOrder] = useCancelOrderMutation();
  const { data: orderPaymentsData } = useGetOrderPaymentsQuery(selectedOrder?.id, { skip: !selectedOrder?.id || !detailModal });
  const orderPayments: any[] = orderPaymentsData?.data || [];

  const [startPreparing]                           = useStartPreparingMutation();
  const [verifyItems, { isLoading: verifying }]    = useVerifyItemsMutation();
  const [markPrepared]                             = useMarkPreparedMutation();
  const [dispatchOrder]                            = useDispatchOrderMutation();
  const [markDelivered]                            = useMarkDeliveredMutation();

  const orders          = ordersData?.data?.content   || ordersData?.data   || [];
  const customers       = customersData?.data?.content || customersData?.data || [];
  const products = productsData?.data?.content || productsData?.data || [];

  /* ── Order items helpers ── */
  const addItem = () => setOrderItems([...orderItems, { productId: undefined, quantity: 1, unitPrice: 0, gstPercent: 0 }]);
  const removeItem = (i: number) => setOrderItems(orderItems.filter((_, idx) => idx !== i));
  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...orderItems];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'productId') {
      const p = products.find((p: any) => p.id === value);
      if (p) { updated[index].unitPrice = p.salesRate1 || p.sales_rate1; updated[index].gstPercent = p.salesGstPercent || p.sales_gst_percent; }
    }
    setOrderItems(updated);
  };
  const calcTotal = () => orderItems.reduce((s, item) =>
    s + (item.unitPrice || 0) * (item.quantity || 0) * (1 + (item.gstPercent || 0) / 100), 0);

  /* ── Handlers ── */
  const handleCreate = async () => {
    if (!orderItems.length) { message.error('Add at least one product'); return; }
    try {
      const values = await form.validateFields();
      await createOrder({ ...values, items: orderItems }).unwrap();
      message.success('Order created'); setCreateModal(false); form.resetFields(); setOrderItems([]); refetch();
    } catch (err: any) { message.error(err?.data?.message || 'Failed'); }
  };
  const handleApprove = async (id: string) => {
    try { await approveOrder(id).unwrap(); message.success('Order approved'); refetch(); }
    catch (err: any) { message.error(err?.data?.message || 'Failed'); }
  };
  const handleCancel = async (id: string) => {
    try { await cancelOrder({ id }).unwrap(); message.success('Order cancelled'); refetch(); }
    catch (err: any) { message.error(err?.data?.message || 'Failed'); }
  };
  const handleStartPreparing = async (id: string) => {
    try { await startPreparing(id).unwrap(); message.success('Picking started'); refetch(); }
    catch (err: any) { message.error(err?.data?.message || 'Failed'); }
  };
  const handleDispatch = async (id: string) => {
    try { await dispatchOrder(id).unwrap(); message.success('Order dispatched'); refetch(); }
    catch (err: any) { message.error(err?.data?.message || 'Failed'); }
  };
  const handleMarkDelivered = async (id: string) => {
    try { await markDelivered(id).unwrap(); message.success('Order marked as delivered'); refetch(); }
    catch (err: any) { message.error(err?.data?.message || 'Failed'); }
  };
  const openVerifyModal = (order: any) => {
    setSelectedOrder(order);
    setVerifyModal(true);
  };
  const handleVerifyAndPrepare = async () => {
    if (!selectedOrder) return;
    try {
      const items = (selectedOrder.items || []).map((item: any) => ({
        itemId: item.id,
        verifiedQuantity: item.quantity,
      }));
      await verifyItems({ id: selectedOrder.id, items }).unwrap();
      await markPrepared(selectedOrder.id).unwrap();
      message.success('Order marked as prepared');
      setVerifyModal(false);
      refetch();
    } catch (err: any) { message.error(err?.data?.message || 'Failed'); }
  };
  const handlePrint = (order: any) => {
    setPrintOrder(order);
    setTimeout(() => window.print(), 100);
  };

  /* ── Columns ── */
  const exportColumns = [
    { title: 'Order #', key: 'orderNumber', dataIndex: 'orderNumber' },
    { title: 'Customer', key: 'customer', dataIndex: ['customer', 'businessName'] },
    { title: 'Date', key: 'date', dataIndex: 'orderDate' },
    { title: 'Amount', key: 'amount', dataIndex: 'totalAmount' },
    { title: 'Status', key: 'status', dataIndex: 'status' },
  ];

  const columns = [
    {
      title: 'Order',
      key: 'order',
      sorter: (a: any, b: any) => (a.orderNumber || '').localeCompare(b.orderNumber || ''),
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 700, color: '#1a1d2e' }}>#{r.orderNumber}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{new Date(r.orderDate).toLocaleDateString('en-IN')}</div>
        </div>
      ),
    },
    {
      title: 'Customer',
      key: 'customer',
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1a1d2e' }}>{r.customer?.businessName}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{r.customer?.phone}</div>
        </div>
      ),
    },
    {
      title: 'Amount',
      key: 'amount',
      width: 130,
      sorter: (a: any, b: any) => (a.totalAmount || 0) - (b.totalAmount || 0),
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 700, color: '#059669', fontSize: 14 }}>{formatINR(r.totalAmount)}</div>
          {r.balanceAmount > 0 && <div style={{ fontSize: 11, color: '#ef4444' }}>Due: {formatINR(r.balanceAmount)}</div>}
        </div>
      ),
    },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s: string) => <StatusPill status={s} /> },
    {
      title: '',
      key: 'actions',
      width: 200,
      render: (_: any, record: any) => (
        <Space split={<span style={{ color: '#e8ecf0' }}>|</span>}>
          <Button type="link" size="small" icon={<EyeOutlined />}
            onClick={() => { setSelectedOrder(record); setDetailModal(true); }}>View</Button>
          {isInvoice && record.status === 'SUBMITTED' && (
            <Button type="link" size="small" icon={<CheckCircleOutlined />} loading={approving}
              style={{ color: '#10b981' }} onClick={() => handleApprove(record.id)}>Approve</Button>
          )}
          {isWarehouse && record.status === 'APPROVED' && (
            <Button type="link" size="small" style={{ color: '#f97316' }}
              onClick={() => handleStartPreparing(record.id)}>Start Picking</Button>
          )}
          {isWarehouse && record.status === 'PREPARING' && (
            <Button type="link" size="small" style={{ color: '#06b6d4' }}
              onClick={() => openVerifyModal(record)}>Verify & Prepare</Button>
          )}
          {isDelivery && record.status === 'PREPARED' && (
            <Popconfirm title="Confirm pickup and dispatch?" onConfirm={() => handleDispatch(record.id)}>
              <Button type="link" size="small" style={{ color: '#8b5cf6' }}>Dispatch</Button>
            </Popconfirm>
          )}
          {isDelivery && record.status === 'DISPATCHED' && (
            <Popconfirm title="Confirm delivery to customer?" onConfirm={() => handleMarkDelivered(record.id)}>
              <Button type="link" size="small" style={{ color: '#10b981' }}>Mark Delivered</Button>
            </Popconfirm>
          )}
          {(isAdmin || isSales) && ['DRAFT', 'SUBMITTED'].includes(record.status) && (
            <Popconfirm title="Cancel this order?" onConfirm={() => handleCancel(record.id)}>
              <Button type="link" size="small" danger icon={<CloseCircleOutlined />}>Cancel</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Hidden invoice for print */}
      {printOrder && <InvoicePrint order={printOrder} />}

      <PageHeader
        title="Orders"
        subtitle={isSales ? 'My sales orders' : isDelivery ? "Today's deliveries" : 'All orders across routes'}
        count={orders.length}
        countLabel="orders"
        action={
          <Space>
            {!isSales && !isDelivery && (
              <>
                <DatePicker.RangePicker
                  value={dateRange}
                  onChange={(vals) => setDateRange(vals as [Dayjs, Dayjs] | null)}
                  format="DD MMM YYYY"
                  allowClear
                  style={{ borderRadius: 8 }}
                  placeholder={['From', 'To']}
                />
                <Select placeholder="Filter by status" style={{ width: 190 }} allowClear value={statusFilter} onChange={setStatusFilter}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
                </Select>
              </>
            )}
            {isSales && (
              <Button type="primary" icon={<PlusOutlined />} size="middle"
                onClick={() => { form.resetFields(); setOrderItems([]); setCreateModal(true); }}>
                New Order
              </Button>
            )}
          </Space>
        }
      />

      <Card style={{ borderRadius: 12, padding: 0 }} styles={{ body: { padding: 0 } }}>
        <TableToolbar
          total={orders.length}
          label="orders"
          data={orders}
          columns={exportColumns}
          exportFilename={`orders-${new Date().toISOString().split('T')[0]}`}
        />
        <Table
          columns={columns} dataSource={orders} rowKey="id" loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} orders` }}
          size="middle" scroll={{ x: 750 }}
        />
      </Card>

      {/* ── Create Order Modal ── */}
      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 16 }}>Create New Order</span>}
        open={createModal} onOk={handleCreate} onCancel={() => setCreateModal(false)}
        confirmLoading={creating} width={820} okText="Place Order" okButtonProps={{ size: 'middle' }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="customerId" label="Customer" rules={[{ required: true }]}>
                <Select showSearch placeholder="Select customer" optionFilterProp="children">
                  {customers.map((c: any) => <Option key={c.id} value={c.id}>{c.businessName} — {c.routePlace?.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="notes" label="Notes"><Input placeholder="Optional" /></Form.Item>
            </Col>
          </Row>
        </Form>
        <div style={{ borderTop: '1px solid #f0f0f0', margin: '4px 0 16px', paddingTop: 16 }}>
          <div style={{ fontWeight: 700, color: '#1a1d2e', marginBottom: 12 }}>Order Items</div>
          {orderItems.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af' }}>
              <ShoppingOutlined style={{ fontSize: 28, display: 'block', marginBottom: 8 }} />No items added
            </div>
          )}
          {orderItems.map((item, index) => (
            <Card key={index} size="small" style={{ marginBottom: 8, borderRadius: 8 }}
              extra={<Button size="small" danger type="text" onClick={() => removeItem(index)}>Remove</Button>}>
              <Row gutter={10} align="middle">
                <Col span={10}>
                  <Select showSearch placeholder="Product" style={{ width: '100%' }} value={item.productId}
                    optionFilterProp="children" onChange={(v) => updateItem(index, 'productId', v)}>
                    {products.map((p: any) => <Option key={p.id} value={p.id}>{p.name} ({p.brand})</Option>)}
                  </Select>
                </Col>
                <Col span={4}>
                  <InputNumber placeholder="Qty" style={{ width: '100%' }} min={1} value={item.quantity}
                    onChange={(v) => updateItem(index, 'quantity', v)} />
                </Col>
                <Col span={5}>
                  <InputNumber placeholder="Rate ₹" style={{ width: '100%' }} min={0} precision={2}
                    value={item.unitPrice} onChange={(v) => updateItem(index, 'unitPrice', v)} />
                </Col>
                <Col span={3}><span style={{ color: '#9ca3af', fontSize: 12 }}>GST {item.gstPercent}%</span></Col>
                <Col span={2}><span style={{ color: '#059669', fontWeight: 700, fontSize: 12 }}>
                  ₹{((item.unitPrice || 0) * (item.quantity || 0) * (1 + (item.gstPercent || 0) / 100)).toFixed(0)}
                </span></Col>
              </Row>
            </Card>
          ))}
          <Button icon={<PlusOutlined />} onClick={addItem} block style={{ borderStyle: 'dashed', borderRadius: 8, marginTop: 8 }}>
            Add Product
          </Button>
          {orderItems.length > 0 && (
            <div style={{ marginTop: 12, background: '#ecfdf5', borderRadius: 8, padding: '10px 14px', fontWeight: 600, color: '#059669' }}>
              Total: ₹{calcTotal().toFixed(2)} ({orderItems.length} items)
            </div>
          )}
        </div>
      </Modal>

      {/* ── Order Detail Modal ── */}
      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 16 }}>Order #{selectedOrder?.orderNumber}</span>}
        open={detailModal} onCancel={() => setDetailModal(false)}
        footer={[
          <Button key="print" icon={<PrinterOutlined />} onClick={() => handlePrint(selectedOrder)}>
            Print Invoice
          </Button>,
          selectedOrder?.status === 'DELIVERED' && (
            <Button key="return" icon={<RollbackOutlined />} danger onClick={() => setReturnModal(true)}>
              Return Items
            </Button>
          ),
          <Button key="close" type="primary" onClick={() => setDetailModal(false)}>Close</Button>,
        ]}
        width={720}
      >
        {selectedOrder && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginTop: 12 }}>
              <Descriptions.Item label="Customer">{selectedOrder.customer?.businessName}</Descriptions.Item>
              <Descriptions.Item label="Phone">{selectedOrder.customer?.phone}</Descriptions.Item>
              <Descriptions.Item label="Date">{new Date(selectedOrder.orderDate).toLocaleDateString('en-IN')}</Descriptions.Item>
              <Descriptions.Item label="Status"><StatusPill status={selectedOrder.status} /></Descriptions.Item>
              <Descriptions.Item label="Total">{formatINR(selectedOrder.totalAmount)}</Descriptions.Item>
              <Descriptions.Item label="Paid">{formatINR(selectedOrder.paidAmount)}</Descriptions.Item>
              <Descriptions.Item label="Balance" span={2}>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>{formatINR(selectedOrder.balanceAmount)}</span>
              </Descriptions.Item>
            </Descriptions>
            <div style={{ fontWeight: 700, color: '#1a1d2e', margin: '16px 0 8px' }}>Items</div>
            <Table size="small" dataSource={selectedOrder.items || []} rowKey="id" pagination={false}
              columns={[
                { title: 'Product', dataIndex: ['product', 'name'], key: 'name' },
                { title: 'Qty', dataIndex: 'quantity', key: 'qty', width: 60 },
                { title: 'Rate', dataIndex: 'unitPrice', key: 'rate', render: (v: number) => `₹${v?.toFixed(2)}` },
                { title: 'GST', dataIndex: 'gstAmount', key: 'gst', render: (v: number) => `₹${v?.toFixed(2)}` },
                { title: 'Total', dataIndex: 'lineTotal', key: 'total', render: (v: number) => <strong style={{ color: '#059669' }}>₹{v?.toFixed(2)}</strong> },
              ]}
            />
            <div style={{ fontWeight: 700, color: '#1a1d2e', margin: '16px 0 8px' }}>
              Payment History
              {orderPayments.length > 0 && (
                <span style={{ fontWeight: 400, fontSize: 12, color: '#64748b', marginLeft: 8 }}>
                  {orderPayments.length} payment{orderPayments.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {orderPayments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8', fontSize: 13 }}>
                No payments recorded yet
              </div>
            ) : (
              <Table size="small" dataSource={orderPayments} rowKey="id" pagination={false}
                columns={[
                  {
                    title: 'Date', dataIndex: 'collectionDate', key: 'date', width: 110,
                    render: (v: string) => new Date(v).toLocaleDateString('en-IN'),
                  },
                  {
                    title: 'Amount', dataIndex: 'amount', key: 'amount', width: 110,
                    render: (v: number) => <strong style={{ color: '#059669' }}>₹{Number(v).toFixed(2)}</strong>,
                  },
                  {
                    title: 'Mode', key: 'mode',
                    render: (_: any, r: any) => (
                      <span style={{ fontSize: 12, fontWeight: 600 }}>
                        {r.paymentMethodName || r.paymentMode}
                      </span>
                    ),
                  },
                  {
                    title: 'Collected By', key: 'collector',
                    render: (_: any, r: any) => (
                      <span style={{ fontSize: 12, color: '#475569' }}>{r.collectedBy?.fullName}</span>
                    ),
                  },
                  {
                    title: 'Ref #', dataIndex: 'referenceNumber', key: 'ref', width: 120,
                    render: (v: string) => <span style={{ fontSize: 12, color: '#94a3b8' }}>{v || '—'}</span>,
                  },
                  {
                    title: 'Status', key: 'status', width: 90,
                    render: (_: any, r: any) => (
                      r.cleared
                        ? <span style={{ color: '#059669', fontSize: 11, fontWeight: 700 }}>✓ Cleared</span>
                        : r.submitted
                          ? <span style={{ color: '#d97706', fontSize: 11, fontWeight: 700 }}>Submitted</span>
                          : <span style={{ color: '#94a3b8', fontSize: 11 }}>Collected</span>
                    ),
                  },
                ]}
              />
            )}
            <div style={{ fontWeight: 700, color: '#1a1d2e', margin: '16px 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
              Audit History
              <AuditHistoryButton entityType="ORDER" entityId={selectedOrder.id} title={`Audit — Order #${selectedOrder.orderNumber}`} />
            </div>
          </>
        )}
      </Modal>

      {/* ── Verify Items Modal ── */}
      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 16 }}>Verify Items — #{selectedOrder?.orderNumber}</span>}
        open={verifyModal} onOk={handleVerifyAndPrepare} onCancel={() => setVerifyModal(false)}
        confirmLoading={verifying} okText="Verify & Mark Prepared" width={640}
        okButtonProps={{ size: 'middle', style: { background: '#06b6d4', borderColor: '#06b6d4' } }}
      >
        <div style={{ marginTop: 8, color: '#6b7280', fontSize: 13, marginBottom: 12 }}>
          Check each item against the order and click <strong>Verify & Mark Prepared</strong> to confirm.
        </div>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', padding: '6px 0',
          borderBottom: '2px solid #e2e8f0', fontSize: 11, fontWeight: 700, color: '#64748b',
          textTransform: 'uppercase', letterSpacing: 0.5, gap: 16 }}>
          <span>Product</span>
          <span style={{ textAlign: 'right' }}>Rate</span>
          <span style={{ textAlign: 'right', minWidth: 60 }}>Qty</span>
        </div>
        {(selectedOrder?.items || []).map((item: any, idx: number) => (
          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto',
            alignItems: 'center', padding: '11px 0', gap: 16,
            borderBottom: idx < (selectedOrder?.items?.length - 1) ? '1px solid #f1f5f9' : 'none' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#1a1d2e', fontSize: 14 }}>{item.product?.name}</div>
              {item.product?.brand && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{item.product.brand}</div>}
            </div>
            <div style={{ textAlign: 'right', fontSize: 13, color: '#475569' }}>
              ₹{item.unitPrice?.toFixed(2)}
            </div>
            <div style={{ textAlign: 'right', minWidth: 72 }}>
              <span style={{ fontWeight: 800, fontSize: 18, color: '#059669' }}>{item.quantity}</span>
              {item.product?.unit && (
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginLeft: 4 }}>{item.product.unit}</span>
              )}
            </div>
          </div>
        ))}
        <div style={{ marginTop: 14, background: '#ecfdf5', borderRadius: 8, padding: '10px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#065f46' }}>{selectedOrder?.items?.length} item(s) · Total</span>
          <span style={{ fontWeight: 800, color: '#059669', fontSize: 15 }}>₹{selectedOrder?.totalAmount?.toFixed(2)}</span>
        </div>
      </Modal>

      {/* ── Return Items Modal ── */}
      {selectedOrder && (
        <ReturnFromOrderModal
          order={selectedOrder}
          open={returnModal}
          onClose={() => setReturnModal(false)}
        />
      )}

    </div>
  );
};

export default OrdersPage;
