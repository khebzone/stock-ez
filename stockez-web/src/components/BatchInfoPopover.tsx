import React, { useState } from 'react';
import { Popover, Spin } from 'antd';
import { InfoCircleFilled } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetBatchesByProductQuery } from '../store/api/purchaseApi';

interface Props {
  productId: string;
  unit?: string;
}

const fmtDate = (d?: string) => (d ? dayjs(d).format('DD MMM YYYY') : '—');

const BatchInfoPopover: React.FC<Props> = ({ productId, unit }) => {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { data, isFetching } = useGetBatchesByProductQuery(productId, { skip: !loaded });

  const batches = ((data?.data as any[]) || [])
    .filter(b => b.active && Number(b.quantityAvailable) > 0)
    .sort((a, b) => {
      const d = dayjs(a.receivedDate).valueOf() - dayjs(b.receivedDate).valueOf();
      return d !== 0 ? d : dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf();
    });

  const totalQty = batches.reduce((s, b) => s + Number(b.quantityAvailable || 0), 0);

  const content = (
    <div style={{ width: 300 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
        Available Batches (FIFO)
      </div>
      {isFetching ? (
        <div style={{ padding: '16px 0', textAlign: 'center' }}><Spin size="small" /></div>
      ) : batches.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px 0' }}>No stock in any batch.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 8, columnGap: 12 }}>
            {batches.map((b, idx) => {
              const expColor = b.expired ? '#dc2626' : b.nearExpiry ? '#d97706' : '#64748b';
              const hasRange = b.minSaleRate != null || b.maxSaleRate != null;
              return (
                <React.Fragment key={b.id}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {b.batchNumber}
                      </span>
                      {idx === 0 && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#059669', background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: 4, padding: '0 5px', lineHeight: '15px' }}>
                          NEXT
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: expColor, marginTop: 1 }}>
                      {b.expiryDate ? `Exp ${fmtDate(b.expiryDate)}` : 'No expiry'}
                      {b.expired ? ' · expired' : b.nearExpiry ? ' · near expiry' : ''}
                    </div>
                    {hasRange && (
                      <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginTop: 1 }}>
                        SR ₹{Number(b.minSaleRate ?? b.maxSaleRate).toFixed(2)}
                        {b.minSaleRate != null && b.maxSaleRate != null && b.maxSaleRate !== b.minSaleRate ? `–₹${Number(b.maxSaleRate).toFixed(2)}` : ''}
                      </div>
                    )}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#0f172a', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {b.quantityAvailable}<span style={{ fontSize: 10, fontWeight: 500, color: '#94a3b8' }}> {unit || 'pcs'}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
          <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>
              Total ({batches.length} batch{batches.length !== 1 ? 'es' : ''})
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 800, color: '#059669' }}>
              {totalQty}<span style={{ fontSize: 10, fontWeight: 500, color: '#94a3b8' }}> {unit || 'pcs'}</span>
            </span>
          </div>
        </>
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="hover"
      placement="bottomLeft"
      open={open}
      onOpenChange={next => { setOpen(next); if (next) setLoaded(true); }}
    >
      <span
        onClick={e => e.stopPropagation()}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 24, height: 24, borderRadius: '50%',
          background: '#fff', border: '1px solid #cbd5e1',
          boxShadow: '0 1px 2px rgba(0,0,0,0.12)', cursor: 'pointer',
        }}
      >
        <InfoCircleFilled style={{ fontSize: 17, color: '#059669' }} />
      </span>
    </Popover>
  );
};

export default BatchInfoPopover;
