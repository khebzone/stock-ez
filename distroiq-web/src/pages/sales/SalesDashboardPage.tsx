import React from 'react';
import { Skeleton, Grid } from 'antd';
import {
  UserOutlined, FileTextOutlined, WalletOutlined,
  RightOutlined, EnvironmentOutlined, PlusOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useGetMyAllocationQuery } from '../../store/api/salesApi';
import { useGetMyOrdersQuery } from '../../store/api/orderApi';
import { useGetMyDayCollectionsQuery } from '../../store/api/paymentApi';

const { useBreakpoint } = Grid;

const P = '#059669';
const PD = '#047857';
const PL = '#ecfdf5';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  bg: string;
  small?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, bg, small }) => (
  <div style={{
    background: '#fff', borderRadius: 14,
    padding: small ? '12px 10px' : '16px 14px',
    border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    display: 'flex', flexDirection: 'column', gap: small ? 8 : 10,
  }}>
    <div style={{
      width: small ? 32 : 38, height: small ? 32 : 38, borderRadius: 10,
      background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color, fontSize: small ? 15 : 18, flexShrink: 0,
    }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: small ? 18 : 22, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: small ? 10 : 11, color: '#64748b', fontWeight: 500, marginTop: 2 }}>{label}</div>
    </div>
  </div>
);

const SalesDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isSmallPhone = !screens.sm;
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const { data: allocData, isLoading: allocLoading } = useGetMyAllocationQuery();
  const { data: ordersData, isLoading: ordersLoading } = useGetMyOrdersQuery();
  const { data: dayData } = useGetMyDayCollectionsQuery();

  const allocation = allocData?.data;
  const orders: any[] = ordersData?.data || [];
  const daySummary = dayData?.data;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const totalCustomers = allocation?.customers?.length || 0;
  const totalOrders = orders.length;
  const totalCollected = Number(daySummary?.totalCollected || 0);
  const pendingSubmit = (daySummary?.payments || []).filter((p: any) => !p.submitted).length;

  const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
    SUBMITTED:        { color: '#f59e0b', bg: '#fffbeb' },
    PENDING_APPROVAL: { color: '#f59e0b', bg: '#fffbeb' },
    APPROVED:         { color: P,         bg: PL        },
    PREPARING:        { color: '#f97316', bg: '#fff7ed' },
    PREPARED:         { color: '#06b6d4', bg: '#ecfeff' },
    DISPATCHED:       { color: '#8b5cf6', bg: '#f5f3ff' },
    DELIVERED:        { color: P,         bg: PL        },
    CANCELLED:        { color: '#ef4444', bg: '#fef2f2' },
  };

  const collectedLabel = totalCollected >= 1000
    ? `₹${(totalCollected / 1000).toFixed(1)}k`
    : `₹${totalCollected.toFixed(0)}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Hero greeting */}
      <div style={{
        background: `linear-gradient(135deg, ${P} 0%, ${PD} 100%)`,
        borderRadius: 18, padding: '22px 20px',
        boxShadow: '0 6px 24px rgba(5,150,105,0.28)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 40, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 4 }}>{greeting},</div>
        <div style={{ color: '#fff', fontSize: 24, fontWeight: 800, lineHeight: 1.2, letterSpacing: -0.5 }}>
          {user.fullName?.split(' ')[0] || 'Sales'}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>

        {allocLoading ? (
          <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 14px' }}>
            <Skeleton.Input active style={{ width: 180, height: 14, background: 'rgba(255,255,255,0.2)' }} />
          </div>
        ) : allocation ? (
          <div style={{
            marginTop: 14, background: 'rgba(255,255,255,0.14)',
            borderRadius: 12, padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <EnvironmentOutlined style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Today's Route</div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{allocation.routeName}</div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.2)', borderRadius: 20, flexShrink: 0,
              padding: '3px 12px', fontSize: 11, color: '#fff', fontWeight: 700,
            }}>
              {totalCustomers} stops
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
            No route allocated for today
          </div>
        )}
      </div>

      {/* Stats */}
      {ordersLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: isSmallPhone ? 8 : 12 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} active paragraph={{ rows: 2 }} title={false} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: isSmallPhone ? 8 : 12 }}>
          <StatCard icon={<UserOutlined />}     label="Customers" value={totalCustomers} color={P}        bg={PL}       small={isSmallPhone} />
          <StatCard icon={<FileTextOutlined />} label="Orders"    value={totalOrders}    color="#8b5cf6"  bg="#f5f3ff"  small={isSmallPhone} />
          <StatCard icon={<WalletOutlined />}   label="Collected" value={collectedLabel} color="#d97706" bg="#fffbeb"   small={isSmallPhone} />
        </div>
      )}

      {/* Submit reminder */}
      {pendingSubmit > 0 && !daySummary?.allSubmitted && (
        <div
          onClick={() => navigate('/sales/payments')}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'New Order', sub: 'Create order for a customer', icon: <PlusOutlined />, color: P, bg: PL, path: '/sales/order' },
            { label: 'My Route',  sub: 'View today\'s customer list',  icon: <EnvironmentOutlined />, color: '#8b5cf6', bg: '#f5f3ff', path: '/sales/route' },
            { label: 'Payments',  sub: 'Collect & submit payments',    icon: <WalletOutlined />, color: '#d97706', bg: '#fffbeb', path: '/sales/payments' },
          ].map(action => (
            <div
              key={action.path}
              onClick={() => navigate(action.path)}
              className="card-clickable"
              style={{
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
                padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 12, background: action.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color, fontSize: 18, flexShrink: 0 }}>
                {action.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{action.label}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{action.sub}</div>
              </div>
              <RightOutlined style={{ color: '#cbd5e1', fontSize: 12, flexShrink: 0 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Recent Orders */}
      {orders.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Today's Orders
            </div>
            <span
              onClick={() => navigate('/sales/route')}
              style={{ fontSize: 12, color: P, fontWeight: 600, cursor: 'pointer' }}
            >
              View all
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {orders.slice(0, 4).map((order: any) => {
              const sc = STATUS_COLORS[order.status] || { color: '#6b7280', bg: '#f3f4f6' };
              return (
                <div key={order.id} style={{
                  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
                  padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {order.customer?.businessName}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>#{order.orderNumber}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                    <div style={{ fontWeight: 800, color: P, fontSize: 14 }}>₹{order.totalAmount?.toFixed(0)}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color }}>
                      {order.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {orders.length === 0 && !ordersLoading && (
        <div style={{
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16,
          padding: '40px 20px', textAlign: 'center',
        }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: PL, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 28, color: P }}>
            <FileTextOutlined />
          </div>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>No orders yet today</div>
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Start by visiting your route customers</div>
          <div
            onClick={() => navigate('/sales/order')}
            style={{
              display: 'inline-block', marginTop: 16, background: P, color: '#fff',
              fontWeight: 700, fontSize: 13, padding: '10px 24px', borderRadius: 10, cursor: 'pointer',
            }}
          >
            Create First Order
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesDashboardPage;
