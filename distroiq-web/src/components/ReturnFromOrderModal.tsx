import React, { useState, useMemo } from 'react';
import { Modal, Table, InputNumber, Button, message, Typography } from 'antd';
import { RollbackOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useCreateGoodsReturnMutation } from '../store/api/goodsReturnApi';

const { Text } = Typography;

interface Props {
  order: any;
  open: boolean;
  onClose: () => void;
}

const ReturnFromOrderModal: React.FC<Props> = ({ order, open, onClose }) => {
  const items: any[] = order?.items || [];
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [createReturn, { isLoading }] = useCreateGoodsReturnMutation();

  const handleClose = () => {
    setReturnQty({});
    onClose();
  };

  const returnLines = useMemo(
    () => items.filter((item: any) => (returnQty[item.id] || 0) > 0),
    [items, returnQty],
  );

  const returnTotal = useMemo(
    () => returnLines.reduce((sum: number, item: any) => sum + (returnQty[item.id] || 0) * Number(item.unitPrice), 0),
    [returnLines, returnQty],
  );

  const handleConfirm = async () => {
    if (returnLines.length === 0) {
      message.warning('Set return quantity for at least one item');
      return;
    }
    try {
      await createReturn({
        type: 'SALES_RETURN',
        orderId: order.id,
        returnDate: dayjs().format('YYYY-MM-DD'),
        items: returnLines.map((item: any) => ({
          productId: item.product.id,
          batchNumber: item.batchNumber || null,
          quantity: returnQty[item.id],
          unitRate: item.unitPrice,
        })),
      }).unwrap();
      message.success('Return processed — stock restored and order balance updated');
      handleClose();
    } catch (e: any) {
      message.error(e?.data?.message || 'Failed to process return');
    }
  };

  const columns = [
    {
      title: 'Product',
      key: 'product',
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{r.product?.name}</div>
          {r.batchNumber && (
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
              Batch: <strong>{r.batchNumber}</strong>
              {r.batchExpiryDate && <> · Exp: {dayjs(r.batchExpiryDate).format('DD MMM YYYY')}</>}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Delivered',
      dataIndex: 'quantity',
      key: 'qty',
      width: 90,
      align: 'center' as const,
      render: (v: number, r: any) => `${v} ${r.product?.unit || ''}`,
    },
    {
      title: 'Rate',
      dataIndex: 'unitPrice',
      key: 'rate',
      width: 90,
      align: 'right' as const,
      render: (v: number) => `₹${Number(v).toFixed(2)}`,
    },
    {
      title: 'Return Qty',
      key: 'returnQty',
      width: 115,
      align: 'center' as const,
      render: (_: any, r: any) => (
        <InputNumber
          min={0}
          max={r.quantity}
          precision={0}
          value={returnQty[r.id] || 0}
          onChange={(v) => setReturnQty(prev => ({ ...prev, [r.id]: v || 0 }))}
          style={{ width: 80 }}
          size="small"
        />
      ),
    },
    {
      title: 'Return Value',
      key: 'returnValue',
      width: 110,
      align: 'right' as const,
      render: (_: any, r: any) => {
        const val = (returnQty[r.id] || 0) * Number(r.unitPrice);
        return val > 0
          ? <Text style={{ color: '#dc2626', fontWeight: 700 }}>-₹{val.toFixed(2)}</Text>
          : <Text type="secondary">—</Text>;
      },
    },
  ];

  return (
    <Modal
      title={
        <span style={{ fontWeight: 700 }}>
          <RollbackOutlined style={{ marginRight: 8, color: '#dc2626' }} />
          Return Items — Order #{order?.orderNumber}
        </span>
      }
      open={open}
      onCancel={handleClose}
      width={700}
      footer={[
        <Button key="cancel" onClick={handleClose}>Cancel</Button>,
        <Button
          key="confirm"
          type="primary"
          danger
          loading={isLoading}
          disabled={returnTotal === 0}
          onClick={handleConfirm}
        >
          Confirm Return{returnTotal > 0 ? ` — ₹${returnTotal.toFixed(2)}` : ''}
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#b91c1c' }}>
        Stock will be restored to the original batches. Order total and balance will be reduced automatically.
      </div>
      <Table
        dataSource={items}
        columns={columns}
        rowKey="id"
        pagination={false}
        size="small"
      />
      {returnTotal > 0 && (
        <div style={{ textAlign: 'right', marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9', fontSize: 15, fontWeight: 700, color: '#dc2626' }}>
          Total Return Value: ₹{returnTotal.toFixed(2)}
        </div>
      )}
    </Modal>
  );
};

export default ReturnFromOrderModal;
