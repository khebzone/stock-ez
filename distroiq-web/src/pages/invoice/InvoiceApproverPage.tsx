import React, { useState } from 'react';
import {
  Card, Table, Button, Drawer, Descriptions, message, Space, Input, Popconfirm,
  Modal, Form, Tag, Spin,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, FileTextOutlined,
} from '@ant-design/icons';
import {
  useGetOrdersQuery, useApproveOrderMutation, useCancelOrderMutation,
} from '../../store/api/orderApi';
import PageHeader from '../../components/PageHeader';

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectForm] = Form.useForm();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [bulkApproving, setBulkApproving] = useState(false);

  const { data: ordersData, isLoading, refetch } = useGetOrdersQuery({ status: 'SUBMITTED' });
  const [approveOrder, { isLoading: approving }] = useApproveOrderMutation();
  const [cancelOrder, { isLoading: cancelling }] = useCancelOrderMutation();

  const orders: any[] = ordersData?.data?.content || ordersData?.data || [];

  const handleApprove = async (id: string) => {
    try {
      await approveOrder(id).unwrap();
      message.success('Order approved successfully');
      refetch();
      if (selectedOrder?.id === id) setDrawerOpen(false);
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to approve');
    }
  };

  const handleApproveSelected = async () => {
    if (selectedRowKeys.length === 0) return;
    setBulkApproving(true);
    let successCount = 0;
    for (const id of selectedRowKeys) {
      try {
        await approveOrder(id).unwrap();
        successCount++;
      } catch { /* individual failures silently skip */ }
    }
    setBulkApproving(false);
    setSelectedRowKeys([]);
    message.success(`${successCount} order(s) approved`);
    refetch();
  };

  const openRejectModal = (id: string) => {
    setRejectingId(id);
    rejectForm.resetFields();
    setRejectModal(true);
  };

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

  const columns = [
    {
      title: 'Order',
      key: 'order',
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
      title: 'Sales Person',
      key: 'salesPerson',
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1a1d2e' }}>{r.salesPerson?.fullName || '—'}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{r.salesPerson?.phone}</div>
        </div>
      ),
    },
    {
      title: 'Items',
      key: 'items',
      width: 80,
      render: (_: any, r: any) => (
        <span style={{
          background: '#eff6ff', color: '#2563eb', fontSize: 12, fontWeight: 700,
          padding: '3px 10px', borderRadius: 20, border: '1px solid #bfdbfe',
        }}>
          {r.items?.length || 0}
        </span>
      ),
    },
    {
      title: 'Amount',
      key: 'amount',
      render: (_: any, r: any) => (
        <div style={{ fontWeight: 800, color: '#059669', fontSize: 14 }}>
          ₹{r.totalAmount?.toFixed(2)}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <StatusPill status={s} />,
    },
    {
      title: '',
      key: 'actions',
      width: 200,
      render: (_: any, record: any) => (
        <Space split={<span style={{ color: '#e8ecf0' }}>|</span>}>
          <Button type="link" size="small" icon={<EyeOutlined />}
            onClick={() => { setSelectedOrder(record); setDrawerOpen(true); }}>
            View
          </Button>
          <Button
            type="link" size="small" icon={<CheckCircleOutlined />}
            style={{ color: '#059669' }} loading={approving}
            onClick={() => handleApprove(record.id)}
          >
            Approve
          </Button>
          <Button
            type="link" size="small" danger icon={<CloseCircleOutlined />}
            onClick={() => openRejectModal(record.id)}
          >
            Reject
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Invoice Approver"
        subtitle="Review and approve submitted orders"
        count={orders.length}
        countLabel="pending"
        action={
          <Space>
            {selectedRowKeys.length > 0 && (
              <Button
                type="primary" icon={<CheckCircleOutlined />}
                loading={bulkApproving} onClick={handleApproveSelected}
                style={{ background: '#059669', border: 'none', fontWeight: 700, borderRadius: 8 }}
              >
                Approve Selected ({selectedRowKeys.length})
              </Button>
            )}
            <Button onClick={refetch} style={{ borderRadius: 8 }}>Refresh</Button>
          </Space>
        }
      />

      <Card style={{ borderRadius: 12, padding: 0 }} styles={{ body: { padding: 0 } }}>
        <Table
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as string[]),
          }}
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20, showTotal: t => `${t} orders pending approval` }}
          size="middle"
          scroll={{ x: 900 }}
          locale={{ emptyText: <div style={{ padding: '40px 0', color: '#64748b' }}>No orders pending approval</div> }}
        />
      </Card>

      {/* Order Detail Drawer */}
      <Drawer
        title={
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Order #{selectedOrder?.orderNumber}</div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
              {selectedOrder?.customer?.businessName}
            </div>
          </div>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={520}
        footer={
          selectedOrder?.status === 'SUBMITTED' ? (
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                danger icon={<CloseCircleOutlined />}
                onClick={() => openRejectModal(selectedOrder.id)}
              >
                Reject
              </Button>
              <Button
                type="primary" icon={<CheckCircleOutlined />}
                loading={approving}
                onClick={() => handleApprove(selectedOrder.id)}
                style={{ background: '#059669', border: 'none' }}
              >
                Approve Order
              </Button>
            </Space>
          ) : null
        }
      >
        {selectedOrder && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Order #">{selectedOrder.orderNumber}</Descriptions.Item>
              <Descriptions.Item label="Date">
                {new Date(selectedOrder.orderDate).toLocaleDateString('en-IN')}
              </Descriptions.Item>
              <Descriptions.Item label="Customer">{selectedOrder.customer?.businessName}</Descriptions.Item>
              <Descriptions.Item label="Phone">{selectedOrder.customer?.phone}</Descriptions.Item>
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
              size="small"
              dataSource={selectedOrder.items || []}
              rowKey="id"
              pagination={false}
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
                {
                  title: 'Rate', dataIndex: 'unitPrice', key: 'rate', width: 80,
                  render: (v: number) => `₹${v?.toFixed(2)}`,
                },
                {
                  title: 'GST', dataIndex: 'gstAmount', key: 'gst', width: 70,
                  render: (v: number) => `₹${v?.toFixed(2)}`,
                },
                {
                  title: 'Total', dataIndex: 'lineTotal', key: 'total', width: 80,
                  render: (v: number) => (
                    <strong style={{ color: '#059669' }}>₹{v?.toFixed(2)}</strong>
                  ),
                },
              ]}
            />
          </>
        )}
      </Drawer>

      {/* Reject Modal */}
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
          <Form.Item
            name="reason"
            label="Reason for rejection"
            rules={[{ required: true, message: 'Please enter a reason' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="E.g. Incorrect pricing, duplicate order, customer request..."
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InvoiceApproverPage;
