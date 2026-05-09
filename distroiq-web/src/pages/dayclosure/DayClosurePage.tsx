import React, { useState } from 'react';
import { Button, InputNumber, Input, Modal, Skeleton, message, Tabs } from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, LockOutlined,
  UserOutlined, AlertOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetTodayCounterQuery, useCloseDayMutation, useGetDayClosureHistoryQuery } from '../../store/api/dayClosureApi';

const fmt = (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtShort = (v: number) => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(1)}K` : `₹${v || 0}`;

/* ── KPI Card ── */
const KpiCard: React.FC<{ label: string; value: string; sub?: string; color: string; bg: string; border?: string }> = ({
  label, value, sub, color, bg, border,
}) => (
  <div style={{
    background: bg, borderRadius: 14,
    border: `1px solid ${border || color + '30'}`,
    padding: '16px 20px',
  }}>
    <div style={{ fontSize: 11, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginTop: 6, letterSpacing: -0.5 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{sub}</div>}
  </div>
);

/* ── Today's Counter ── */
const TodayCounter: React.FC = () => {
  const { data, isLoading, refetch } = useGetTodayCounterQuery();
  const [closeDay, { isLoading: isClosing }] = useCloseDayMutation();
  const [physicalCash, setPhysicalCash] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const counter: any = data?.data || {};
  const alreadyClosed: boolean = counter.alreadyClosed === true;
  const closure: any = counter.existingClosure || {};
  const collectors: any[] = counter.collectors || [];

  const openingCash = Number(counter.openingCash || 0);
  const totalCash   = Number(counter.totalCash || 0);
  const totalUpi    = Number(counter.totalUpi || 0);
  const totalCheque = Number(counter.totalCheque || 0);
  const totalNeft   = Number(counter.totalNeft || 0);
  const totalCollected   = Number(counter.totalCollected || 0);
  const expectedCash     = Number(counter.expectedCashClosing || 0);

  const diff = physicalCash !== null ? physicalCash - expectedCash : null;
  const diffColor = diff === null ? '#64748b' : diff === 0 ? '#059669' : diff > 0 ? '#d97706' : '#dc2626';
  const diffLabel = diff === null ? '—' : diff === 0 ? 'Perfect match!' : diff > 0 ? `₹${Math.abs(diff).toLocaleString('en-IN')} excess` : `₹${Math.abs(diff).toLocaleString('en-IN')} short`;

  const handleClose = async () => {
    if (physicalCash === null) return;
    try {
      await closeDay({ physicalCashEntered: physicalCash, notes: notes || undefined }).unwrap();
      message.success('Day closed successfully!');
      setConfirmOpen(false);
      setPhysicalCash(null);
      setNotes('');
      refetch();
    } catch (e: any) {
      message.error(e?.data?.message || 'Failed to close day');
    }
  };

  if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Status Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: alreadyClosed ? '#ecfdf5' : '#fffbeb',
        border: `1px solid ${alreadyClosed ? '#059669' : '#d97706'}30`,
        borderRadius: 14, padding: '14px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {alreadyClosed
            ? <CheckCircleOutlined style={{ fontSize: 20, color: '#059669' }} />
            : <ClockCircleOutlined style={{ fontSize: 20, color: '#d97706' }} />}
          <div>
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
              {alreadyClosed ? 'Day Closed' : 'Day Open'} — {dayjs().format('dddd, DD MMMM YYYY')}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {alreadyClosed
                ? `Closed by ${closure.closedBy || 'Admin'} at ${closure.closedAt ? dayjs(closure.closedAt).format('hh:mm A') : ''}`
                : 'Counter not yet closed for today'}
            </div>
          </div>
        </div>
        {alreadyClosed && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Difference</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: Number(closure.difference || 0) === 0 ? '#059669' : '#dc2626' }}>
              {Number(closure.difference || 0) === 0 ? '₹0 — Perfect' : fmt(closure.difference)}
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        <KpiCard label="Opening Cash"    value={fmt(openingCash)}    sub="carry-forward"      color="#64748b" bg="#f8fafc" />
        <KpiCard label="Cash Collected"  value={fmt(totalCash)}      sub="physical cash"      color="#059669" bg="#ecfdf5" />
        <KpiCard label="UPI / Digital"   value={fmt(totalUpi)}       sub="already in bank"    color="#2563eb" bg="#eff6ff" />
        <KpiCard label="Cheque / NEFT"   value={fmt(totalCheque + totalNeft)} sub="pending clearance" color="#7c3aed" bg="#f5f3ff" />
        <KpiCard label="Total Collected" value={fmt(totalCollected)} sub="all modes"          color="#d97706" bg="#fffbeb" />
      </div>

      {/* Collectors breakdown */}
      {collectors.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
            Collections by Person
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '10px 20px' }}>
            {['Person', 'Cash', 'UPI', 'Cheque/NEFT', 'Total'].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
            ))}
          </div>
          {collectors.map((c: any, i: number) => (
            <div key={c.collectorName} style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
              padding: '13px 20px', alignItems: 'center',
              borderBottom: i < collectors.length - 1 ? '1px solid #f1f5f9' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                  {(c.collectorName || '?')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{c.collectorName}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                    {c.role} · {c.submittedCount}/{c.totalCount} submitted
                  </div>
                </div>
              </div>
              <div style={{ fontWeight: 700, color: '#059669' }}>{c.cashAmount > 0 ? fmt(c.cashAmount) : '—'}</div>
              <div style={{ fontWeight: 700, color: '#2563eb' }}>{c.upiAmount > 0 ? fmt(c.upiAmount) : '—'}</div>
              <div style={{ fontWeight: 700, color: '#7c3aed' }}>{(c.chequeAmount + c.neftAmount) > 0 ? fmt(c.chequeAmount + c.neftAmount) : '—'}</div>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 14 }}>{fmt(c.totalAmount)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Close Day Section */}
      {!alreadyClosed && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 16, marginBottom: 4 }}>
            <LockOutlined style={{ marginRight: 8, color: '#2563eb' }} />
            Close Day Counter
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
            Count physical cash in hand and enter below to close today's counter.
          </div>

          {/* Expected vs Physical */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Opening Cash</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 6 }}>{fmt(openingCash)}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>+ {fmt(totalCash)} collected</div>
            </div>
            <div style={{ background: '#eff6ff', borderRadius: 12, padding: '16px 18px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Expected Cash</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 6 }}>{fmt(expectedCash)}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>opening + cash in</div>
            </div>
            <div style={{ background: diff === null ? '#f8fafc' : diff === 0 ? '#ecfdf5' : diff > 0 ? '#fffbeb' : '#fef2f2', borderRadius: 12, padding: '16px 18px', border: `1px solid ${diffColor}30` }}>
              <div style={{ fontSize: 11, color: diffColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Difference</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: diffColor, marginTop: 6 }}>
                {diff === null ? '—' : (diff >= 0 ? '+' : '') + fmt(diff)}
              </div>
              <div style={{ fontSize: 12, color: diffColor, marginTop: 2, fontWeight: 600 }}>{diffLabel}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '0 0 260px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Physical Cash in Hand (₹)</div>
              <InputNumber
                value={physicalCash}
                onChange={v => setPhysicalCash(v as number | null)}
                style={{ width: '100%' }}
                size="large"
                formatter={v => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={v => v!.replace(/₹\s?|(,*)/g, '') as any}
                min={0}
                placeholder="Enter physical cash count"
              />
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Notes (optional)</div>
              <Input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                size="large"
                placeholder="Any remarks for today..."
              />
            </div>
            <Button
              type="primary"
              size="large"
              icon={<LockOutlined />}
              disabled={physicalCash === null}
              onClick={() => setConfirmOpen(true)}
              style={{ borderRadius: 10, background: '#2563eb', fontWeight: 700, height: 40 }}
            >
              Close Day
            </Button>
          </div>
        </div>
      )}

      {/* Already closed — show summary */}
      {alreadyClosed && (
        <div style={{ background: '#ecfdf5', borderRadius: 16, border: '1px solid #059669', padding: '20px 24px' }}>
          <div style={{ fontWeight: 700, color: '#059669', fontSize: 15, marginBottom: 12 }}>
            <CheckCircleOutlined style={{ marginRight: 8 }} />Today's Counter is Closed
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { label: 'Physical Cash Entered', value: fmt(closure.physicalCashEntered || 0) },
              { label: 'Expected Cash',         value: fmt(closure.expectedCashClosing || 0) },
              { label: 'Difference',            value: fmt(closure.difference || 0) },
              { label: 'Total Collected',       value: fmt(closure.totalCollected || 0) },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{s.value}</div>
              </div>
            ))}
          </div>
          {closure.notes && (
            <div style={{ marginTop: 12, fontSize: 13, color: '#374151' }}>
              <strong>Notes:</strong> {closure.notes}
            </div>
          )}
        </div>
      )}

      {/* Confirm Modal */}
      <Modal
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onOk={handleClose}
        confirmLoading={isClosing}
        title={<div style={{ fontSize: 16, fontWeight: 700 }}>Confirm Day Closing</div>}
        okText="Yes, Close Day"
        okButtonProps={{ style: { background: '#2563eb' } }}
        width={440}
      >
        <div style={{ padding: '12px 0' }}>
          <div style={{ fontSize: 14, color: '#374151', marginBottom: 16 }}>
            You are closing the counter for <strong>{dayjs().format('DD MMMM YYYY')}</strong>.
            This action cannot be undone.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Expected Cash</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{fmt(expectedCash)}</div>
            </div>
            <div style={{ background: diff === 0 ? '#ecfdf5' : '#fef2f2', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: diffColor, fontWeight: 700, textTransform: 'uppercase' }}>Physical Cash</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: diffColor, marginTop: 4 }}>{fmt(physicalCash || 0)}</div>
            </div>
          </div>
          {diff !== 0 && diff !== null && (
            <div style={{ marginTop: 12, background: '#fef2f2', borderRadius: 10, padding: '12px 16px', border: '1px solid #fca5a5' }}>
              <AlertOutlined style={{ color: '#dc2626', marginRight: 8 }} />
              <span style={{ fontWeight: 600, color: '#dc2626' }}>
                {diff > 0 ? `Excess of ${fmt(diff)} will be recorded.` : `Shortage of ${fmt(Math.abs(diff))} will be recorded.`}
              </span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

/* ── History Tab ── */
const ClosureHistory: React.FC = () => {
  const { data, isLoading } = useGetDayClosureHistoryQuery();
  const history: any[] = data?.data || [];

  if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {history.length === 0 ? (
        <div style={{ background: '#f8fafc', borderRadius: 16, padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
          <ClockCircleOutlined style={{ fontSize: 40, marginBottom: 12, display: 'block' }} />
          No closure history yet
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr 1fr 1fr 1fr 120px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 20px' }}>
            {['Date', 'Opening', 'Cash In', 'Digital', 'Expected', 'Physical', 'Difference'].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
            ))}
          </div>

          {history.map((h: any, i: number) => {
            const diff = Number(h.difference || 0);
            const diffColor = diff === 0 ? '#059669' : diff > 0 ? '#d97706' : '#dc2626';
            const rowBg = diff === 0 ? '#fff' : diff > 0 ? '#fffbf0' : '#fff5f5';

            return (
              <div key={h.id} style={{
                display: 'grid', gridTemplateColumns: '130px 1fr 1fr 1fr 1fr 1fr 120px',
                padding: '14px 20px', alignItems: 'center',
                borderBottom: i < history.length - 1 ? '1px solid #f1f5f9' : 'none',
                background: rowBg,
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>
                    {dayjs(h.closureDate).format('DD MMM YYYY')}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                    {h.closedAt ? dayjs(h.closedAt).format('hh:mm A') : '—'}
                  </div>
                </div>
                <div style={{ color: '#475569', fontWeight: 600 }}>{fmtShort(h.openingCash || 0)}</div>
                <div style={{ color: '#059669', fontWeight: 700 }}>{fmtShort(h.totalCash || 0)}</div>
                <div style={{ color: '#2563eb', fontWeight: 600 }}>{fmtShort((h.totalUpi || 0) + (h.totalCheque || 0) + (h.totalNeft || 0))}</div>
                <div style={{ color: '#0f172a', fontWeight: 700 }}>{fmtShort(h.expectedCashClosing || 0)}</div>
                <div style={{ color: '#0f172a', fontWeight: 700 }}>{fmtShort(h.physicalCashEntered || 0)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontWeight: 800, color: diffColor, fontSize: 14,
                  }}>
                    {diff === 0 ? '₹0' : (diff > 0 ? '+' : '') + fmtShort(diff)}
                  </span>
                  {diff === 0 && <CheckCircleOutlined style={{ color: '#059669', fontSize: 13 }} />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ── Page ── */
const DayClosurePage: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>Daily Cash Counter</div>
      <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>End-of-day cash reconciliation and closing</div>
    </div>
    <Tabs
      defaultActiveKey="today"
      items={[
        {
          key: 'today',
          label: <span><ClockCircleOutlined /> Today's Counter</span>,
          children: <TodayCounter />,
        },
        {
          key: 'history',
          label: <span><UserOutlined /> Closure History</span>,
          children: <ClosureHistory />,
        },
      ]}
    />
  </div>
);

export default DayClosurePage;
