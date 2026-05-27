import React, { useState } from 'react';
import { Modal, Descriptions, InputNumber, Input, Button, message, Space } from 'antd';
import { RollbackOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useCreateGoodsReturnMutation } from '../store/api/goodsReturnApi';

interface Props {
  batch: any;
  open: boolean;
  onClose: () => void;
}

const ReturnToSupplierModal: React.FC<Props> = ({ batch, open, onClose }) => {
  const [qty, setQty] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [createReturn, { isLoading }] = useCreateGoodsReturnMutation();

  const handleClose = () => {
    setQty(0);
    setReason('');
    onClose();
  };

  const handleConfirm = async () => {
    if (!qty || qty <= 0) {
      message.warning('Enter return quantity');
      return;
    }
    try {
      await createReturn({
        type: 'PURCHASE_RETURN',
        returnDate: dayjs().format('YYYY-MM-DD'),
        supplierName: batch.supplierName,
        reason: reason || undefined,
        items: [{
          productId: batch.product.id,
          batchNumber: batch.batchNumber,
          quantity: qty,
          unitRate: batch.purchaseRate,
        }],
      }).unwrap();
      message.success('Stock returned to supplier — inventory updated');
      handleClose();
    } catch (e: any) {
      message.error(e?.data?.message || 'Failed to process return');
    }
  };

  const totalValue = qty * Number(batch?.purchaseRate || 0);

  return (
    <Modal
      title={
        <span style={{ fontWeight: 700 }}>
          <RollbackOutlined style={{ marginRight: 8, color: '#1d4ed8' }} />
          Return to Supplier
        </span>
      }
      open={open}
      onCancel={handleClose}
      width={520}
      footer={[
        <Button key="cancel" onClick={handleClose}>Cancel</Button>,
        <Button
          key="confirm"
          type="primary"
          loading={isLoading}
          disabled={!qty || qty <= 0}
          onClick={handleConfirm}
        >
          Confirm Return{totalValue > 0 ? ` — ₹${totalValue.toFixed(2)}` : ''}
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 16, padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 13, color: '#1e40af' }}>
        Stock will be deducted (FIFO) and recorded as a purchase return.
      </div>
      <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Supplier">{batch?.supplierName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Purchase Entry">{batch?.purchaseEntryNumber || '—'}</Descriptions.Item>
        <Descriptions.Item label="Product">{batch?.product?.name}</Descriptions.Item>
        <Descriptions.Item label="Batch No.">{batch?.batchNumber}</Descriptions.Item>
        <Descriptions.Item label="Available Qty">{batch?.quantityAvailable} {batch?.product?.unit}</Descriptions.Item>
        <Descriptions.Item label="Purchase Rate">₹{Number(batch?.purchaseRate || 0).toFixed(2)}</Descriptions.Item>
      </Descriptions>
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>
            Return Quantity <span style={{ color: '#dc2626' }}>*</span>
          </div>
          <InputNumber
            min={1}
            max={batch?.quantityAvailable}
            precision={0}
            value={qty || undefined}
            onChange={(v) => setQty(v || 0)}
            style={{ width: '100%' }}
            addonAfter={batch?.product?.unit}
          />
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Reason</div>
          <Input.TextArea
            rows={2}
            placeholder="Reason for return (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
        </div>
      </Space>
      {totalValue > 0 && (
        <div style={{ textAlign: 'right', marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9', fontSize: 14, fontWeight: 700, color: '#1d4ed8' }}>
          Return Value: ₹{totalValue.toFixed(2)}
        </div>
      )}
    </Modal>
  );
};

export default ReturnToSupplierModal;
