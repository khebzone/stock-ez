import React, { useMemo, useState } from 'react';
import { Button, DatePicker, Input, InputNumber, Modal, Select, Tooltip, message } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useEditPaymentMutation } from '../store/api/paymentApi';
import { useGetPaymentMethodsQuery } from '../store/api/paymentMethodApi';
import { isAdmin } from '../utils/permissions';

interface Props {
  payment: {
    id: string;
    amount: number | string;
    paymentMethodName?: string;
    paymentMode?: string;
    referenceNumber?: string;
    instrumentDate?: string;
    draweeBank?: string;
    status?: string;
    cleared?: boolean;
    submitted?: boolean;
  };
  onDone?: () => void;
}

const INSTRUMENTS = ['CHEQUE', 'NEFT', 'RTGS'];

const EditPaymentButton: React.FC<Props> = ({ payment, onDone }) => {
  const [open, setOpen] = useState(false);
  const [methodId, setMethodId] = useState<string | undefined>();
  const [amount, setAmount] = useState<number | null>(Number(payment.amount));
  const [reference, setReference] = useState(payment.referenceNumber || '');
  const [instrumentDate, setInstrumentDate] = useState<dayjs.Dayjs | null>(
    payment.instrumentDate ? dayjs(payment.instrumentDate) : null);
  const [draweeBank, setDraweeBank] = useState(payment.draweeBank || '');
  const [reason, setReason] = useState('');
  const [editPayment, { isLoading }] = useEditPaymentMutation();
  const { data: methodsData } = useGetPaymentMethodsQuery();

  const methods: any[] = useMemo(
    () => (methodsData?.data || []).filter((m: any) => m.mode !== 'CREDIT'), [methodsData]);

  const currentMethod = methods.find((m) =>
    m.name === payment.paymentMethodName && (!payment.paymentMode || m.mode === payment.paymentMode))
    || methods.find((m) => m.mode === payment.paymentMode);
  const selected = methods.find((m) => m.id === (methodId ?? currentMethod?.id));
  const isInstrument = selected ? INSTRUMENTS.includes(selected.mode) : false;
  const needsReason = !!payment.submitted || !!payment.cleared;

  const wasInstrument = INSTRUMENTS.includes(payment.paymentMode || '');
  if (payment.cleared && !isAdmin()) return null;
  if (wasInstrument && payment.status && payment.status !== 'PENDING') return null;

  const submit = async () => {
    if (!selected) { message.warning('Select a payment method'); return; }
    if (!amount || amount <= 0) { message.warning('Enter the amount'); return; }
    if (isInstrument && !reference.trim()) { message.warning('Reference number is required'); return; }
    if (needsReason && reason.trim().length < 3) { message.warning('Enter a reason'); return; }
    try {
      await editPayment({
        id: payment.id,
        amount,
        paymentMethodId: selected.id,
        referenceNumber: reference.trim() || undefined,
        instrumentDate: isInstrument && instrumentDate ? instrumentDate.format('YYYY-MM-DD') : undefined,
        draweeBank: isInstrument ? draweeBank.trim() || undefined : undefined,
        reason: reason.trim() || undefined,
      }).unwrap();
      message.success('Payment updated');
      setOpen(false);
      setReason('');
      onDone?.();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to update payment');
    }
  };

  return (
    <>
      <Tooltip title="Edit entry">
        <Button type="text" size="small" icon={<EditOutlined />}
          onClick={(e) => { e.stopPropagation(); setOpen(true); }} />
      </Tooltip>
      <Modal
        open={open}
        title="Edit payment"
        okText="Save"
        okButtonProps={{ loading: isLoading }}
        onOk={submit}
        onCancel={() => setOpen(false)}
        destroyOnClose
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Method *</div>
            <Select
              style={{ width: '100%' }}
              value={methodId ?? currentMethod?.id}
              onChange={setMethodId}
              options={methods.map((m) => ({ value: m.id, label: m.name }))}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Amount *</div>
            <InputNumber
              style={{ width: '100%' }} min={0.01} precision={2} prefix="₹"
              value={amount} onChange={(v) => setAmount(v as number | null)}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>
              Reference / transaction no.{isInstrument ? ' *' : ''}
            </div>
            <Input maxLength={200} value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          {isInstrument && (
            <>
              <div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Instrument date</div>
                <DatePicker
                  style={{ width: '100%' }} format="DD MMM YYYY"
                  value={instrumentDate} onChange={setInstrumentDate}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Bank</div>
                <Input maxLength={150} value={draweeBank} onChange={(e) => setDraweeBank(e.target.value)} />
              </div>
            </>
          )}
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Reason{needsReason ? ' *' : ''}</div>
            <Input.TextArea
              rows={2} maxLength={300}
              placeholder="e.g. Selected GPay instead of Cash"
              value={reason} onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </>
  );
};

export default EditPaymentButton;
