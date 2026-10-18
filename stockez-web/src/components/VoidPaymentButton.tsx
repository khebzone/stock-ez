import React, { useState } from 'react';
import { Button, Input, Modal, Tooltip, message } from 'antd';
import { StopOutlined } from '@ant-design/icons';
import { useVoidPaymentMutation } from '../store/api/paymentApi';
import { isAdmin } from '../utils/permissions';

interface Props {
  payment: { id: string; amount: number | string; paymentMethodName?: string; paymentMode?: string; cleared?: boolean };
  onDone?: () => void;
  style?: React.CSSProperties;
}

const VoidPaymentButton: React.FC<Props> = ({ payment, onDone, style }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [voidPayment, { isLoading }] = useVoidPaymentMutation();

  const submit = async () => {
    if (reason.trim().length < 3) { message.warning('Enter a reason'); return; }
    try {
      await voidPayment({ id: payment.id, reason: reason.trim() }).unwrap();
      message.success('Payment voided');
      setOpen(false);
      setReason('');
      onDone?.();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to void payment');
    }
  };

  if (payment.cleared && !isAdmin()) return null;

  return (
    <>
      <Tooltip title="Void entry">
        <Button type="text" danger size="small" icon={<StopOutlined />} style={style}
          onClick={(e) => { e.stopPropagation(); setOpen(true); }} />
      </Tooltip>
      <Modal
        open={open}
        title="Void payment"
        okText="Void payment"
        okButtonProps={{ danger: true, loading: isLoading }}
        onOk={submit}
        onCancel={() => setOpen(false)}
        destroyOnClose
      >
        <div style={{ marginBottom: 12, fontSize: 13 }}>
          ₹{Number(payment.amount).toFixed(2)} via {payment.paymentMethodName || payment.paymentMode}. The order balance
          is restored and this entry no longer counts in collections.
        </div>
        <Input.TextArea
          rows={2} maxLength={300} autoFocus
          placeholder="Reason (e.g. wrong amount entered)"
          value={reason} onChange={(e) => setReason(e.target.value)}
        />
      </Modal>
    </>
  );
};

export default VoidPaymentButton;
