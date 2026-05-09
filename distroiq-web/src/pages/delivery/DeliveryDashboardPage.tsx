import React from 'react';
import { Skeleton, Grid } from 'antd';
import {
  TruckOutlined, CheckCircleOutlined, WalletOutlined,
  ClockCircleOutlined, RightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useGetMyDeliveriesQuery } from '../../store/api/orderApi';
import { useGetMyDayCollectionsQuery } from '../../store/api/paymentApi';

const { useBreakpoint } = Grid;

const P = '#059669';
const PL = '#ecfdf5';

const DeliveryDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isSmallPhone = !screens.sm;
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const { data: deliveriesData, isLoading: deliveriesLoading } = useGetMyDeliveriesQuery();
  const { data: dayData } = useGetMyDayCollectionsQuery();

  const deliveries: any[] = deliveriesData?.data || [];
  const daySummary = dayData?.data;

  const prepared   = deliveries.filter(o => o.status === 'PREPARED').length;
  const dispatched = deliveries.filter(o => o.status === 'DISPATCHED').length;
  const delivered  = deliveries.filter(o => o.status === 'DELIVERED').length;
  const totalCollected = Number(daySummary?.totalCollected || 0);
  const pendingSubmit  = (daySummary?.payments || []).filter((p: any) => !p.submitted).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const stats = [
    { label: 'Pickup Ready', value: prepared,   icon: <TruckOutlined />,       color: '#d97706', bg: '#fef3c7' },
    { label: 'On the Way',   value: dispatched, icon: <TruckOutlined />,       color: P,         bg: PL       },
    { label: 'Delivered',    value: delivered,  icon: <CheckCircleOutlined />, color: '#059669', bg: '#ecfdf5' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, ${P} 0%, #047857 100%)`,
        borderRadius: 18, padding: '22px 20px',
        boxShadow: '0 6px 24px rgba(5,150,105,0.28)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 4 }}>{greeting},</div>
        <div style={{ color: '#fff', fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>
          {user.fullName?.split(' ')[0]}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 4 }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
        <div style={{ marginTop: 14, color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
          {deliveries.length === 0
            ? 'No deliveries assigned yet'
            : `${dispatched + prepared} pending · ${delivered} delivered today`}
        </div>
      </div>

      {/* Stats */}
      {deliveriesLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: isSmallPhone ? 8 : 10 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} active paragraph={{ rows: 2 }} title={false} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: isSmallPhone ? 8 : 10 }}>
          {stats.map(s => (
            <div key={s.label} style={{
              background: '#fff', borderRadius: 14,
              padding: isSmallPhone ? '12px 10px' : '14px 12px',
              border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{
                width: isSmallPhone ? 30 : 36, height: isSmallPhone ? 30 : 36,
                borderRadius: 10, background: s.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: s.color, fontSize: isSmallPhone ? 14 : 17,
              }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: isSmallPhone ? 20 : 24, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: isSmallPhone ? 9 : 10, color: '#64748b', fontWeight: 500, marginTop: 3 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submit reminder */}
      {pendingSubmit > 0 && !(daySummary?.allSubmitted) && (
        <div
          onClick={() => navigate('/delivery/payments')}
          style={{
            background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 14,
            padding: '14px 16px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ClockCircleOutlined style={{ color: '#d97706', fontSize: 18 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#92400e', fontSize: 13 }}>Submit Day Collections</div>
            <div style={{ fontSize: 12, color: '#78350f', marginTop: 1 }}>
              ₹{totalCollected.toFixed(2)} pending handover to accountant
            </div>
          </div>
          <RightOutlined style={{ color: '#d97706', fontSize: 12 }} />
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
          Quick Actions
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'My Deliveries', sub: 'Dispatch & mark delivered', icon: <TruckOutlined />, color: P, bg: PL, path: '/delivery/orders' },
            { label: 'Collections',   sub: 'Collect & submit payments',  icon: <WalletOutlined />, color: '#d97706', bg: '#fffbeb', path: '/delivery/payments' },
          ].map(a => (
            <div
              key={a.path}
              onClick={() => navigate(a.path)}
              className="card-clickable"
              style={{
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
                padding: '16px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 12, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: a.color, fontSize: 20, marginBottom: 10 }}>
                {a.icon}
              </div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{a.label}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{a.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Today's route preview */}
      {deliveries.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>Today's Route</div>
            <span onClick={() => navigate('/delivery/orders')} style={{ fontSize: 12, color: P, fontWeight: 600, cursor: 'pointer' }}>View all</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {deliveries.slice(0, 5).map((o: any) => {
              const isDelivered  = o.status === 'DELIVERED';
              const isDispatched = o.status === 'DISPATCHED';
              return (
                <div
                  key={o.id}
                  onClick={() => navigate('/delivery/orders')}
                  style={{
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
                    padding: '12px 16px', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.customer?.businessName}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>#{o.orderNumber} · ₹{o.totalAmount?.toFixed(0)}</div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, flexShrink: 0, marginLeft: 8,
                    background: isDelivered ? '#ecfdf5' : isDispatched ? '#eff6ff' : '#fffbeb',
                    color: isDelivered ? '#059669' : isDispatched ? P : '#d97706',
                  }}>
                    {isDelivered ? '✓ DONE' : isDispatched ? 'ON WAY' : 'PICKUP'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryDashboardPage;
