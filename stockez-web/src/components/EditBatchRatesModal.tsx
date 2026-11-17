import React, { useEffect } from 'react';
import { Form, InputNumber, Modal, DatePicker, message } from 'antd';
import dayjs from 'dayjs';
import { useUpdateBatchRatesMutation } from '../store/api/purchaseApi';

interface Props {
  batch: any | null;
  onClose: () => void;
}

const EditBatchRatesModal: React.FC<Props> = ({ batch, onClose }) => {
  const [form] = Form.useForm();
  const [updateRates, { isLoading }] = useUpdateBatchRatesMutation();

  useEffect(() => {
    if (batch) form.setFieldsValue({
      minSaleRate: batch.minSaleRate,
      maxSaleRate: batch.maxSaleRate,
      expiryDate: batch.expiryDate ? dayjs(batch.expiryDate) : null,
    });
  }, [batch, form]);

  const submit = async () => {
    try {
      const values = await form.validateFields();
      await updateRates({
        id: batch.id,
        minSaleRate: values.minSaleRate,
        maxSaleRate: values.maxSaleRate,
        expiryDate: values.expiryDate ? values.expiryDate.format('YYYY-MM-DD') : undefined,
      }).unwrap();
      message.success('Batch updated');
      onClose();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.data?.message || 'Failed to update batch');
    }
  };

  return (
    <Modal
      open={!!batch}
      title="Edit batch"
      okText="Save"
      okButtonProps={{ loading: isLoading }}
      onOk={submit}
      onCancel={onClose}
      destroyOnClose
    >
      {batch && (
        <div style={{ marginBottom: 16, fontSize: 13 }}>
          <div style={{ fontWeight: 600 }}>{batch.product?.name}</div>
          <div style={{ color: '#64748b' }}>Batch {batch.batchNumber} · MRP ₹{Number(batch.mrp).toFixed(2)}</div>
        </div>
      )}
      <Form form={form} layout="vertical">
        <Form.Item name="minSaleRate" label="Min Sale Rate (incl. GST)" rules={[{ required: true, message: 'Required' }]}>
          <InputNumber min={0.01} precision={2} prefix="₹" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="maxSaleRate" label="Max Sale Rate (incl. GST)" dependencies={['minSaleRate']}
          rules={[
            { required: true, message: 'Required' },
            ({ getFieldValue }) => ({
              validator: (_, v) =>
                v == null || getFieldValue('minSaleRate') == null || v >= getFieldValue('minSaleRate')
                  ? Promise.resolve()
                  : Promise.reject(new Error('Max cannot be below min')),
            }),
          ]}
        >
          <InputNumber min={0.01} precision={2} prefix="₹" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="expiryDate" label="Expiry Date">
          <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} allowClear={false} />
        </Form.Item>
      </Form>
      <div style={{ fontSize: 12, color: '#64748b' }}>
        Applies to this batch only. Bills already issued keep the rates they were billed at. Every change is recorded in the audit history.
      </div>
    </Modal>
  );
};

export default EditBatchRatesModal;
