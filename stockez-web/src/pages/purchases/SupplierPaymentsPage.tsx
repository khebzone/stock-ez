import React, { useState } from 'react';
import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Skeleton, Popconfirm, message } from 'antd';
import { PlusOutlined, DeleteOutlined, FileExcelOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetUnpaidPurchaseEntriesQuery,
  useGetSupplierPaymentSummariesQuery,
  useGetSupplierPaymentsQuery,
  useCreateSupplierPaymentMutation,
  useDeleteSupplierPaymentMutation,
} from '../../store/api/purchaseApi';
import { exportToXLSX } from '../../components/TableToolbar';
import { formatINR } from '../../utils/format';
import { hasPermission } from '../../utils/permissions';

const PAYMENT_METHODS = ['CASH', 'UPI', 'NEFT', 'RTGS', 'CHEQUE', 'BANK_TRANSFER'];

const SupplierPaymentsPage: React.FC = () => {
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [form] = Form.useForm();

  const { data: summariesData, isLoading: summaryLoading } = useGetSupplierPaymentSummariesQuery();
  const summaries: any[] = summariesData?.data || [];

  const { data: paymentsData, isLoading: paymentsLoading } = useGetSupplierPaymentsQuery(
    { supplierName: selectedSupplier! },
    { skip: !selectedSupplier }
  );
  const payments: any[] = paymentsData?.data || [];

  const { data: unpaidData, isLoading: unpaidLoading } = useGetUnpaidPurchaseEntriesQuery(
    selectedSupplier!,
    { skip: !selectedSupplier }
  );
  const unpaidEntries: any[] = unpaidData?.data || [];

  const [createPayment, { isLoading: creating }] = useCreateSupplierPaymentMutation();
  const [deletePayment] = useDeleteSupplierPaymentMutation();

  const selected = summaries.find(s => s.supplierName === selectedSupplier);

  const openPayForEntry = (entry: any) => {
    setSelectedEntry(entry);
    form.resetFields();
    form.setFieldsValue({ amount: entry.balanceAmount, paymentDate: dayjs() });
    setShowPaymentModal(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      await createPayment({
        supplierName: selectedSupplier,
        purchaseEntryId: selectedEntry?.id || null,
        amount: values.amount,
        paymentDate: values.paymentDate.format('YYYY-MM-DD'),
        paymentMethod: values.paymentMethod,
        referenceNumber: values.referenceNumber || null,
        notes: values.notes || null,
      }).unwrap();
      message.success('Payment recorded');
      form.resetFields();
      setSelectedEntry(null);
      setShowPaymentModal(false);
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to record payment');
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
          icon={<FileExcelOutlined />}
          disabled={summaries.length === 0}
          onClick={() => exportToXLSX(
            summaries.map((s: any) => ({
              supplier: s.supplierName,
              purchased: s.totalPurchased,
              returns: s.returnCredit,
              paid: s.totalPaid,
              outstanding: s.outstanding,
              lastPurchase: s.lastPurchaseDate ? dayjs(s.lastPurchaseDate).format('DD MMM YYYY') : '',
              lastPayment: s.lastPaymentDate ? dayjs(s.lastPaymentDate).format('DD MMM YYYY') : '',
            })),
            [
              { title: 'Supplier',       key: 'supplier',    dataIndex: 'supplier' },
              { title: 'Total Purchased', key: 'purchased',  dataIndex: 'purchased' },
              { title: 'Returns Credit',  key: 'returns',    dataIndex: 'returns' },
              { title: 'Total Paid',      key: 'paid',       dataIndex: 'paid' },
              { title: 'Outstanding',     key: 'outstanding', dataIndex: 'outstanding' },
              { title: 'Last Purchase',   key: 'lastPurchase', dataIndex: 'lastPurchase' },
              { title: 'Last Payment',    key: 'lastPayment',  dataIndex: 'lastPayment' },
            ],
            `supplier-payables-${dayjs().format('YYYY-MM-DD')}`
          )}
          style={{ borderRadius: 8 }}
        >
          Export Excel
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedSupplier ? '1fr 1.4fr' : '1fr', gap: 16, alignItems: 'start' }}>

        {/* Supplier Summary Table */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, 1.8fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 1fr)', columnGap: 10, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 20px' }}>
            {['Supplier', 'Purchased', 'Returns', 'Paid', 'Outstanding'].map(h => (
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
                  display: 'grid', gridTemplateColumns: 'minmax(130px, 1.8fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 1fr)', columnGap: 10,
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
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{Number(s.returnCredit) > 0 ? `− ${formatINR(s.returnCredit)}` : '—'}</div>
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
                      { label: 'Returns',   value: Number(selected.returnCredit) > 0 ? `− ${formatINR(selected.returnCredit)}` : '—', color: '#0f172a' },
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

            {/* Unpaid Bills */}
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>Unpaid Bills</div>
            {unpaidLoading ? <Skeleton active paragraph={{ rows: 3 }} /> : (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr 65px 80px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '10px 16px', minWidth: 420 }}>
                  {['Date', 'Bill No.', 'Total', 'Balance', 'Days', ''].map(h => (
                    <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
                  ))}
                </div>
                {unpaidEntries.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8' }}>No unpaid bills</div>
                ) : unpaidEntries.map((e: any, i: number) => {
                  const days = dayjs().diff(dayjs(e.purchaseDate), 'day');
                  const daysColor = days > 30 ? '#dc2626' : days > 15 ? '#d97706' : '#64748b';
                  return (
                    <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr 65px 80px', padding: '11px 16px', alignItems: 'center', borderBottom: i < unpaidEntries.length - 1 ? '1px solid #f1f5f9' : 'none', minWidth: 420 }}>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{dayjs(e.purchaseDate).format('DD MMM YYYY')}</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 12 }}>{e.entryNumber}</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 12 }}>{formatINR(e.totalAmount)}</div>
                      <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 12 }}>{formatINR(e.balanceAmount)}</div>
                      <div style={{ fontWeight: 700, color: daysColor, fontSize: 12 }}>{days === 0 ? 'Today' : `${days}d`}</div>
                      {hasPermission('SUPPLIER_PAYMENTS_CREATE') && (
                        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openPayForEntry(e)}
                          style={{ borderRadius: 7, fontSize: 11, fontWeight: 700, background: '#059669', borderColor: '#059669', padding: '0 8px' }}>
                          Pay
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Payment list header */}
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>Payment History</div>

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
                    {hasPermission('SUPPLIER_PAYMENTS_DELETE') && (
                      <Popconfirm
                        title="Delete this payment?"
                        onConfirm={() => handleDelete(p.id)}
                        okText="Delete" okButtonProps={{ danger: true }}
                      >
                        <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                      </Popconfirm>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      <Modal
        title={
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>
              {selectedEntry ? `Pay Bill — ${selectedEntry.entryNumber}` : `Record Payment — ${selectedSupplier}`}
            </div>
            {selectedEntry && (
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginTop: 3 }}>
                {selectedSupplier} · Balance {formatINR(selectedEntry.balanceAmount)}
              </div>
            )}
          </div>
        }
        open={showPaymentModal}
        onCancel={() => { setShowPaymentModal(false); setSelectedEntry(null); }}
        footer={null}
        width={460}
      >
        {selectedEntry && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, margin: '16px 0' }}>
            {[
              { label: 'Bill Total', value: formatINR(selectedEntry.totalAmount), color: '#0f172a' },
              { label: 'Paid So Far', value: formatINR(selectedEntry.paidAmount), color: '#059669' },
              { label: 'Balance Due', value: formatINR(selectedEntry.balanceAmount), color: '#dc2626' },
            ].map(col => (
              <div key={col.label} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px', textAlign: 'center', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>{col.label}</div>
                <div style={{ fontWeight: 800, fontSize: 13, color: col.color }}>{col.value}</div>
              </div>
            ))}
          </div>
        )}
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: selectedEntry ? 0 : 16 }}>
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
