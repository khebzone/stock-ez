import React, { useState } from 'react';
import { Modal, Descriptions, InputNumber, Select, Button, message, Space } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useCreateGoodsReturnMutation } from '../store/api/goodsReturnApi';

const DAMAGE_REASONS = [
  { value: 'Expired', label: 'Expired' },
  { value: 'Damaged', label: 'Damaged' },
  { value: 'Theft', label: 'Theft' },
  { value: 'Breakage', label: 'Breakage' },
  { value: 'Other', label: 'Other' },
];

interface Props {
  batch: any;
  open: boolean;
  onClose: () => void;
}

const WriteOffModal: React.FC<Props> = ({ batch, open, onClose }) => {
  const [qty, setQty] = useState<number>(0);
  const [reason, setReason] = useState<string | undefined>(undefined);
  const [createReturn, { isLoading }] = useCreateGoodsReturnMutation();

  const handleClose = () => {
    setQty(0);
    setReason(undefined);
    onClose();
  };

  const handleConfirm = async () => {
    if (!qty || qty <= 0) {
      message.warning('Enter write-off quantity');
      return;
    }
    if (!reason) {
      message.warning('Select a reason for the write-off');
      return;
    }
    try {
      await createReturn({
        type: 'DAMAGE',
        returnDate: dayjs().format('YYYY-MM-DD'),
        reason,
        items: [{
          productId: batch.product.id,
          batchNumber: batch.batchNumber,
          quantity: qty,
          unitRate: batch.purchaseRate,
        }],
      }).unwrap();
      message.success('Stock written off — inventory updated');
      handleClose();
    } catch (e: any) {
      message.error(e?.data?.message || 'Failed to process write-off');
    }
  };

  const totalValue = qty * Number(batch?.purchaseRate || 0);

  return (
    <Modal
      title={
        <span style={{ fontWeight: 700 }}>
          <DeleteOutlined style={{ marginRight: 8, color: '#dc2626' }} />
          Write Off / Damage
        </span>
      }
      open={open}
      onCancel={handleClose}
      width={480}
      footer={[
        <Button key="cancel" onClick={handleClose}>Cancel</Button>,
        <Button
          key="confirm"
          type="primary"
          danger
          loading={isLoading}
          disabled={!qty || qty <= 0 || !reason}
          onClick={handleConfirm}
        >
          Confirm Write-Off{totalValue > 0 ? ` — ₹${totalValue.toFixed(2)}` : ''}
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#b91c1c' }}>
        Stock will be permanently deducted (FIFO) and recorded as a loss.
      </div>
      <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Product">{batch?.product?.name}</Descriptions.Item>
        <Descriptions.Item label="Batch No.">{batch?.batchNumber}</Descriptions.Item>
        <Descriptions.Item label="Available Qty">{batch?.quantityAvailable} {batch?.product?.unit}</Descriptions.Item>
        <Descriptions.Item label="Purchase Rate">₹{Number(batch?.purchaseRate || 0).toFixed(2)}</Descriptions.Item>
        {batch?.expiryDate && (
          <Descriptions.Item label="Expiry Date">{batch.expiryDate}</Descriptions.Item>
        )}
      </Descriptions>
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>
            Write-Off Quantity <span style={{ color: '#dc2626' }}>*</span>
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
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>
            Reason <span style={{ color: '#dc2626' }}>*</span>
          </div>
          <Select
            options={DAMAGE_REASONS}
            value={reason}
            onChange={(v) => setReason(v)}
            placeholder="Select reason"
            style={{ width: '100%' }}
          />
        </div>
      </Space>
      {totalValue > 0 && (
        <div style={{ textAlign: 'right', marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9', fontSize: 14, fontWeight: 700, color: '#dc2626' }}>
          Loss Value: ₹{totalValue.toFixed(2)}
        </div>
      )}
    </Modal>
  );
};

export default WriteOffModal;
