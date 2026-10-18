import React from 'react';
import EditPaymentButton from './EditPaymentButton';
import VoidPaymentButton from './VoidPaymentButton';

type Props = React.ComponentProps<typeof EditPaymentButton> & { style?: React.CSSProperties };

const PaymentActions: React.FC<Props> = ({ payment, onDone, style }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
    <EditPaymentButton payment={payment} onDone={onDone} />
    <VoidPaymentButton payment={payment} onDone={onDone} style={style} />
  </span>
);

export default PaymentActions;
