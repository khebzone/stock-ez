import React, { useEffect } from 'react';
import { Form, InputNumber, Modal, message } from 'antd';
import { useUpdateBatchRatesMutation } from '../store/api/purchaseApi';

interface Props {
  batch: any | null;
  onClose: () => void;
}

const EditBatchRatesModal: React.FC<Props> = ({ batch, onClose }) => {
  const [form] = Form.useForm();
  const [updateRates, { isLoading }] = useUpdateBatchRatesMutation();

  useEffect(() => {
    if (batch) form.setFieldsValue({ minSaleRate: batch.minSaleRate, maxSaleRate: batch.maxSaleRate });
  }, [batch, form]);

  const submit = async () => {
    try {
      const values = await form.validateFields();
      await updateRates({ id: batch.id, minSaleRate: values.minSaleRate, maxSaleRate: values.maxSaleRate }).unwrap();
      message.success('Sale rates updated');
      onClose();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.data?.message || 'Failed to update sale rates');
    }
  };

  return (
    <Modal
      open={!!batch}
      title="Edit sale rates"
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
      </Form>
      <div style={{ fontSize: 12, color: '#64748b' }}>
        Applies to this batch only. Bills already issued keep the rates they were billed at.
      </div>
    </Modal>
  );
};

export default EditBatchRatesModal;
