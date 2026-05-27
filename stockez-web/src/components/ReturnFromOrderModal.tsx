import React, { useState, useMemo } from 'react';
import { Modal, Table, InputNumber, Button, message, Typography, Grid } from 'antd';
import { RollbackOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useCreateGoodsReturnMutation } from '../store/api/goodsReturnApi';

const { Text } = Typography;

interface Props {
  order: any;
  open: boolean;
  onClose: () => void;
}

const ReturnFromOrderModal: React.FC<Props> = ({ order, open, onClose }) => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
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

  const setQty = (id: string, v: number, max: number) =>
    setReturnQty(prev => ({ ...prev, [id]: Math.min(Math.max(0, v), max) }));

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

  const notice = (
    <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#b91c1c' }}>
      Stock will be restored to the original batches. Order total and balance will be reduced automatically.
    </div>
  );

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
      width={isMobile ? '100vw' : 700}
      styles={isMobile ? { body: { padding: '12px 12px 0' } } : undefined}
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
      {notice}

      {isMobile ? (
        <div>
          {items.map((r: any) => {
            const qty = returnQty[r.id] || 0;
            const val = qty * Number(r.unitPrice);
            return (
              <div key={r.id} style={{
                border: `1px solid ${qty > 0 ? '#fca5a5' : '#e8ecf0'}`,
                borderRadius: 10,
                marginBottom: 10,
                overflow: 'hidden',
                background: qty > 0 ? '#fff5f5' : '#fff',
                transition: 'border-color 0.2s, background 0.2s',
              }}>
                {/* Product header */}
                <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1d2e', lineHeight: 1.3 }}>
                    {r.product?.name}
                  </div>
                  {r.batchNumber && (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      Batch: <strong>{r.batchNumber}</strong>
                      {r.batchExpiryDate && <> · Exp: {dayjs(r.batchExpiryDate).format('DD MMM YYYY')}</>}
                    </div>
                  )}
                </div>

                {/* Meta: single inline text line */}
                <div style={{ padding: '7px 12px', background: '#f8fafc', borderBottom: '1px solid #f0f0f0', fontSize: 12, color: '#64748b' }}>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{r.quantity}</span>
                  {' '}{r.product?.unit || 'pcs'} delivered
                  <span style={{ margin: '0 6px', color: '#d1d5db' }}>·</span>
                  ₹<span style={{ fontWeight: 600, color: '#374151' }}>{Number(r.unitPrice).toFixed(2)}</span>/unit
                </div>

                {/* Stepper */}
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>
                    Return Qty
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', flex: 1, border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden', minWidth: 0 }}>
                      <button
                        onClick={() => setQty(r.id, qty - 1, r.quantity)}
                        disabled={qty === 0}
                        style={{
                          width: 40, height: 40, border: 'none',
                          background: qty === 0 ? '#f3f4f6' : '#f8fafc',
                          cursor: qty === 0 ? 'not-allowed' : 'pointer',
                          color: qty === 0 ? '#d1d5db' : '#374151',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          borderRight: '1px solid #e5e7eb',
                        }}
                      >
                        <MinusOutlined style={{ fontSize: 14 }} />
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={r.quantity}
                        value={qty === 0 ? '' : qty}
                        placeholder="0"
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setQty(r.id, isNaN(v) ? 0 : v, r.quantity);
                        }}
                        style={{
                          flex: 1, minWidth: 0, height: 40, border: 'none', outline: 'none',
                          textAlign: 'center', fontSize: 16, fontWeight: 700,
                          color: qty > 0 ? '#dc2626' : '#374151',
                          background: '#fff',
                        }}
                      />
                      <button
                        onClick={() => setQty(r.id, qty + 1, r.quantity)}
                        disabled={qty >= r.quantity}
                        style={{
                          width: 40, height: 40, border: 'none',
                          background: qty >= r.quantity ? '#f3f4f6' : '#f8fafc',
                          cursor: qty >= r.quantity ? 'not-allowed' : 'pointer',
                          color: qty >= r.quantity ? '#d1d5db' : '#374151',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          borderLeft: '1px solid #e5e7eb',
                        }}
                      >
                        <PlusOutlined style={{ fontSize: 14 }} />
                      </button>
                    </div>
                    {val > 0 && (
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#dc2626', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        -₹{val.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {returnTotal > 0 && (
            <div style={{ marginTop: 4, marginBottom: 12, padding: '12px 14px', background: '#fef2f2', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#b91c1c' }}>
                {returnLines.length} item{returnLines.length !== 1 ? 's' : ''} selected
              </span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#dc2626' }}>
                -₹{returnTotal.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <>
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
        </>
      )}
    </Modal>
  );
};

export default ReturnFromOrderModal;
