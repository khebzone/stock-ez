import React, { useState } from 'react';
import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Skeleton, Popconfirm, message } from 'antd';
import { PlusOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetSupplierPaymentSummariesQuery,
  useGetSupplierPaymentsQuery,
  useCreateSupplierPaymentMutation,
  useDeleteSupplierPaymentMutation,
} from '../../store/api/purchaseApi';
import { exportToCSV } from '../../components/TableToolbar';
import { formatINR } from '../../utils/format';

const PAYMENT_METHODS = ['CASH', 'UPI', 'NEFT', 'RTGS', 'CHEQUE', 'BANK_TRANSFER'];

const SupplierPaymentsPage: React.FC = () => {
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [form] = Form.useForm();

  const { data: summariesData, isLoading: summaryLoading } = useGetSupplierPaymentSummariesQuery();
  const summaries: any[] = summariesData?.data || [];

  const { data: paymentsData, isLoading: paymentsLoading } = useGetSupplierPaymentsQuery(
    { supplierName: selectedSupplier! },
    { skip: !selectedSupplier }
  );
  const payments: any[] = paymentsData?.data || [];

  const [createPayment, { isLoading: creating }] = useCreateSupplierPaymentMutation();
  const [deletePayment] = useDeleteSupplierPaymentMutation();

  const selected = summaries.find(s => s.supplierName === selectedSupplier);

  const handleSubmit = async (values: any) => {
    try {
      await createPayment({
        supplierName: selectedSupplier,
        amount: values.amount,
        paymentDate: values.paymentDate.format('YYYY-MM-DD'),
        paymentMethod: values.paymentMethod,
        referenceNumber: values.referenceNumber || null,
        notes: values.notes || null,
      }).unwrap();
      message.success('Payment recorded');
      form.resetFields();
      setShowPaymentModal(false);
    } catch {
      message.error('Failed to record payment');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePayment(id).unwrap();
      message.success('Payment deleted');
    } catch {
      message.error('Failed to delete payment');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>Supplier Payments</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>Track amounts owed to and paid to each supplier</div>
        </div>
        <Button
          icon={<DownloadOutlined />}
          disabled={summaries.length === 0}
          onClick={() => exportToCSV(
            summaries.map((s: any) => ({
              supplier: s.supplierName,
              purchased: s.totalPurchased,
              paid: s.totalPaid,
              outstanding: s.outstanding,
              lastPurchase: s.lastPurchaseDate ? dayjs(s.lastPurchaseDate).format('DD MMM YYYY') : '',
              lastPayment: s.lastPaymentDate ? dayjs(s.lastPaymentDate).format('DD MMM YYYY') : '',
            })),
            [
              { title: 'Supplier',       key: 'supplier',    dataIndex: 'supplier' },
              { title: 'Total Purchased', key: 'purchased',  dataIndex: 'purchased' },
              { title: 'Total Paid',      key: 'paid',       dataIndex: 'paid' },
              { title: 'Outstanding',     key: 'outstanding', dataIndex: 'outstanding' },
              { title: 'Last Purchase',   key: 'lastPurchase', dataIndex: 'lastPurchase' },
              { title: 'Last Payment',    key: 'lastPayment',  dataIndex: 'lastPayment' },
            ],
            `supplier-payables-${dayjs().format('YYYY-MM-DD')}`
          )}
          style={{ borderRadius: 8 }}
        >
          Export CSV
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedSupplier ? '1fr 1.4fr' : '1fr', gap: 16, alignItems: 'start' }}>

        {/* Supplier Summary Table */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 20px' }}>
            {['Supplier', 'Purchased', 'Paid', 'Outstanding'].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
            ))}
          </div>

          {summaryLoading ? (
            <div style={{ padding: 20 }}><Skeleton active paragraph={{ rows: 5 }} /></div>
          ) : summaries.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>No purchase data yet</div>
          ) : summaries.map((s: any, i: number) => {
            const isSelected = s.supplierName === selectedSupplier;
            const hasOutstanding = Number(s.outstanding) > 0;
            return (
              <div
                key={s.supplierName}
                onClick={() => setSelectedSupplier(isSelected ? null : s.supplierName)}
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
                  padding: '13px 20px', alignItems: 'center',
                  borderBottom: i < summaries.length - 1 ? '1px solid #f1f5f9' : 'none',
                  background: isSelected ? '#eff6ff' : '#fff',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#475569', fontSize: 13, flexShrink: 0 }}>
                      {s.supplierName?.[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{s.supplierName}</div>
                      {s.lastPurchaseDate && (
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                          Last buy: {dayjs(s.lastPurchaseDate).format('DD MMM YYYY')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{formatINR(s.totalPurchased)}</div>
                <div style={{ fontWeight: 600, color: '#059669', fontSize: 13 }}>{formatINR(s.totalPaid)}</div>
                <div style={{ fontWeight: 800, color: hasOutstanding ? '#dc2626' : '#059669', fontSize: 13 }}>
                  {formatINR(s.outstanding)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Payment History Panel */}
        {selectedSupplier && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Summary card */}
            {selected && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{selected.supplierName}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {selected.lastPaymentDate
                        ? `Last paid: ${dayjs(selected.lastPaymentDate).format('DD MMM YYYY')}`
                        : 'No payments recorded yet'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    {[
                      { label: 'Purchased', value: formatINR(selected.totalPurchased), color: '#0f172a' },
                      { label: 'Paid',      value: formatINR(selected.totalPaid),      color: '#059669' },
                      { label: 'Pending',   value: formatINR(selected.outstanding),    color: Number(selected.outstanding) > 0 ? '#dc2626' : '#059669' },
                    ].map(stat => (
                      <div key={stat.label} style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: stat.color, marginTop: 2 }}>{stat.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Payment list header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>Payment History</div>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => { form.setFieldValue('paymentDate', dayjs()); setShowPaymentModal(true); }}
                style={{ borderRadius: 8 }}
              >
                Record Payment
              </Button>
            </div>

            {paymentsLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 1fr 40px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '11px 16px' }}>
                  {['Date', 'Amount', 'Method', 'Reference', ''].map(h => (
                    <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
                  ))}
                </div>
                {payments.length === 0 ? (
                  <div style={{ padding: '40px 16px', textAlign: 'center', color: '#94a3b8' }}>No payments recorded</div>
                ) : payments.map((p: any, i: number) => (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 1fr 40px', padding: '12px 16px', alignItems: 'center', borderBottom: i < payments.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{dayjs(p.paymentDate).format('DD MMM YYYY')}</div>
                    <div style={{ fontWeight: 800, color: '#059669', fontSize: 14 }}>{formatINR(p.amount)}</div>
                    <div style={{ fontSize: 12, color: '#475569' }}>{p.paymentMethod}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{p.referenceNumber || '—'}</div>
                    <Popconfirm
                      title="Delete this payment?"
                      onConfirm={() => handleDelete(p.id)}
                      okText="Delete" okButtonProps={{ danger: true }}
                    >
                      <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                    </Popconfirm>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      <Modal
        title={`Record Payment — ${selectedSupplier}`}
        open={showPaymentModal}
        onCancel={() => setShowPaymentModal(false)}
        footer={null}
        width={460}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
          <Form.Item name="amount" label="Amount Paid *" rules={[{ required: true, message: 'Enter amount' }]}>
            <InputNumber
              prefix="₹" style={{ width: '100%' }} min={0.01} precision={2}
              placeholder="0.00"
            />
          </Form.Item>
          <Form.Item name="paymentDate" label="Payment Date *" rules={[{ required: true, message: 'Select date' }]}>
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" allowClear={false} />
          </Form.Item>
          <Form.Item name="paymentMethod" label="Payment Method *" rules={[{ required: true, message: 'Select method' }]}>
            <Select placeholder="Select method" options={PAYMENT_METHODS.map(m => ({ value: m, label: m }))} />
          </Form.Item>
          <Form.Item name="referenceNumber" label="Reference / Cheque No.">
            <Input placeholder="Optional" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Optional" />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setShowPaymentModal(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={creating}>Save Payment</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default SupplierPaymentsPage;
