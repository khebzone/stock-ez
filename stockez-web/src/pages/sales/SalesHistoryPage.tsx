import React, { useState } from 'react';
import { DatePicker, Skeleton, Empty, Grid } from 'antd';
import {
  EnvironmentOutlined, FileTextOutlined, WalletOutlined,
  ShoppingOutlined, LeftOutlined, RightOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useGetMyHistoryQuery } from '../../store/api/salesApi';

const { useBreakpoint } = Grid;

const P = '#059669';
const PL = '#ecfdf5';

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

const fmt = (v?: number) =>
  v != null ? `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bg: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, bg }) => (
  <div style={{
    background: '#fff', borderRadius: 12,
    padding: '14px 12px', border: '1px solid #e2e8f0',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    display: 'flex', flexDirection: 'column', gap: 8,
  }}>
    <div style={{
      width: 34, height: 34, borderRadius: 9, background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color, fontSize: 16,
    }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 500, marginTop: 2 }}>{label}</div>
    </div>
  </div>
);

const SalesHistoryPage: React.FC = () => {
  const screens = useBreakpoint();
  const isSmall = !screens.sm;
  const [date, setDate] = useState<Dayjs>(dayjs());

  const dateStr = date.format('YYYY-MM-DD');
  const { data, isLoading } = useGetMyHistoryQuery(dateStr);
  const history = data?.data;

  const goBack = () => setDate(d => d.subtract(1, 'day'));
  const goForward = () => {
    if (!date.isSame(dayjs(), 'day')) setDate(d => d.add(1, 'day'));
  };
  const isToday = date.isSame(dayjs(), 'day');

  const totalSales = Number(history?.totalSales || 0);
  const totalCollected = Number(history?.totalCollected || 0);
  const cash = Number(history?.cashCollected || 0);
  const upi = Number(history?.upiCollected || 0);
  const other = Number(history?.otherCollected || 0);

  const collectedLabel = totalCollected >= 1000
    ? `₹${(totalCollected / 1000).toFixed(1)}k`
    : fmt(totalCollected);
  const salesLabel = totalSales >= 1000
    ? `₹${(totalSales / 1000).toFixed(1)}k`
    : fmt(totalSales);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Page Title */}
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: -0.3 }}>My History</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Daily activity summary</div>
      </div>

      {/* Date Navigator */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <button
          onClick={goBack}
          style={{
            width: 34, height: 34, borderRadius: 8, border: '1px solid #e2e8f0',
            background: '#f8fafc', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0,
          }}
        >
          <LeftOutlined style={{ fontSize: 12 }} />
        </button>

        <div style={{ flex: 1, textAlign: 'center' }}>
          <DatePicker
            value={date}
            onChange={(d) => d && setDate(d)}
            disabledDate={(d) => d.isAfter(dayjs(), 'day')}
            format="DD MMM YYYY"
            allowClear={false}
            suffixIcon={null}
            style={{ border: 'none', boxShadow: 'none', background: 'transparent', width: '100%' }}
            variant="borderless"
          />
        </div>

        <button
          onClick={goForward}
          disabled={isToday}
          style={{
            width: 34, height: 34, borderRadius: 8, border: '1px solid #e2e8f0',
            background: isToday ? '#f1f5f9' : '#f8fafc',
            cursor: isToday ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isToday ? '#cbd5e1' : '#64748b', flexShrink: 0,
          }}
        >
          <RightOutlined style={{ fontSize: 12 }} />
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[1, 2, 3, 4].map(i => <Skeleton key={i} active paragraph={{ rows: 2 }} title={false} />)}
          </div>
          <Skeleton active paragraph={{ rows: 4 }} />
        </div>
      ) : (
        <>
          {/* Route Banner */}
          <div style={{
            background: history?.routeName ? PL : '#f8fafc',
            border: `1px solid ${history?.routeName ? '#a7f3d0' : '#e2e8f0'}`,
            borderRadius: 12, padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: history?.routeName ? P : '#cbd5e1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 16, flexShrink: 0,
            }}>
              <EnvironmentOutlined />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Route</div>
              <div style={{
                fontWeight: 700, fontSize: 14,
                color: history?.routeName ? '#0f172a' : '#94a3b8',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {history?.routeName || 'No route allocated'}
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isSmall ? 8 : 10 }}>
            <StatCard icon={<FileTextOutlined />} label="Orders" value={String(history?.ordersCount || 0)} color="#8b5cf6" bg="#f5f3ff" />
            <StatCard icon={<ShoppingOutlined />} label="Sales Value" value={salesLabel} color={P} bg={PL} />
            <StatCard icon={<WalletOutlined />} label="Collected" value={collectedLabel} color="#d97706" bg="#fffbeb" />
            <div style={{
              background: '#fff', borderRadius: 12,
              padding: '14px 12px', border: '1px solid #e2e8f0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}>
              <div style={{ fontSize: 10, color: '#64748b', fontWeight: 500, marginBottom: 6 }}>Breakdown</div>
              {[
                { label: 'Cash', value: cash, color: '#16a34a' },
                { label: 'UPI',  value: upi,  color: '#7c3aed' },
                { label: 'Other', value: other, color: '#0369a1' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{row.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: row.value > 0 ? row.color : '#94a3b8' }}>
                    {fmt(row.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Orders List */}
          <div>
            <div style={{
              fontSize: 12, fontWeight: 700, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
            }}>
              Orders ({history?.ordersCount || 0})
            </div>

            {!history?.orders?.length ? (
              <div style={{
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16,
                padding: '36px 20px', textAlign: 'center',
              }}>
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>No orders on this day</span>
                  }
                />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {history.orders.map((order: any) => {
                  const sc = STATUS_COLORS[order.status] || { color: '#6b7280', bg: '#f3f4f6' };
                  const balance = Number(order.totalAmount || 0) - Number(order.paidAmount || 0);
                  return (
                    <div key={order.orderId} style={{
                      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
                      padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{
                            fontWeight: 700, color: '#0f172a', fontSize: 13,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {order.customerName}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                            #{order.orderNumber} · {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '3px 9px',
                          borderRadius: 20, background: sc.bg, color: sc.color,
                          flexShrink: 0, marginLeft: 8,
                        }}>
                          {order.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>Total</div>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 13 }}>{fmt(order.totalAmount)}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>Collected</div>
                          <div style={{ fontWeight: 700, color: P, fontSize: 13 }}>{fmt(order.paidAmount)}</div>
                        </div>
                        {balance > 0.01 && (
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>Balance</div>
                            <div style={{ fontWeight: 700, color: '#ef4444', fontSize: 13 }}>{fmt(balance)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SalesHistoryPage;
