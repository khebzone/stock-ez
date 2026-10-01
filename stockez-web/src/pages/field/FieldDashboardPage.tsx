import React, { useState } from 'react';
import { Skeleton, Grid, Drawer, message } from 'antd';
import {
  UserOutlined, FileTextOutlined, WalletOutlined, RightOutlined,
  EnvironmentOutlined, PlusOutlined, ClockCircleOutlined, WarningOutlined,
  ShoppingOutlined, LockOutlined, ThunderboltOutlined, TruckOutlined,
  CheckCircleOutlined, ShareAltOutlined, UnorderedListOutlined,
  DownOutlined, UpOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { hasPermission } from '../../utils/permissions';
import { useGetMyAllocationQuery, useGetMyDeliveryAllocationQuery } from '../../store/api/salesApi';
import { useGetMyOrdersQuery, useGetMyDeliveriesQuery } from '../../store/api/orderApi';
import { useGetMyDayCollectionsQuery } from '../../store/api/paymentApi';
import { useGetNearExpiryAlertsQuery } from '../../store/api/purchaseApi';
import { useGetDeadStockQuery } from '../../store/api/reportApi';
import { useGetTodayStatusQuery } from '../../store/api/attendanceApi';
import { useGetWorkflowSettingsQuery } from '../../store/api/supplierApi';
import dayjs from 'dayjs';

const { useBreakpoint } = Grid;

const P  = '#059669';
const PD = '#047857';
const PL = '#ecfdf5';

const STATUS_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  SUBMITTED:        { color: '#f59e0b', bg: '#fffbeb', label: 'Submitted'   },
  PENDING_APPROVAL: { color: '#f59e0b', bg: '#fffbeb', label: 'Pending'     },
  APPROVED:         { color: P,         bg: PL,        label: 'Approved'    },
  PACKING:          { color: '#f97316', bg: '#fff7ed', label: 'Packing'     },
  PACKED:           { color: '#06b6d4', bg: '#ecfeff', label: 'Packed'      },
  DISPATCHED:       { color: '#8b5cf6', bg: '#f5f3ff', label: 'Dispatched'  },
  DELIVERED:        { color: P,         bg: PL,        label: 'Delivered'   },
  CANCELLED:        { color: '#ef4444', bg: '#fef2f2', label: 'Cancelled'   },
};

interface StatCardProps { icon: React.ReactNode; label: string; value: string | number; color: string; bg: string; small?: boolean; }
const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, bg, small }) => (
  <div style={{
    background: '#fff', borderRadius: 14,
    padding: small ? '12px 10px' : '16px 14px',
    border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    display: 'flex', flexDirection: 'column', gap: small ? 8 : 10,
  }}>
    <div style={{ width: small ? 32 : 38, height: small ? 32 : 38, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: small ? 15 : 18 }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: small ? 18 : 22, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: small ? 10 : 11, color: '#64748b', fontWeight: 500, marginTop: 2 }}>{label}</div>
    </div>
  </div>
);

const FieldDashboardPage: React.FC = () => {
  const navigate   = useNavigate();
  const screens    = useBreakpoint();
  const isSmall    = !screens.sm;
  const user       = JSON.parse(localStorage.getItem('user') || '{}');
  const [viewOrder, setViewOrder] = useState<any>(null);
  const [sharing, setSharing]     = useState(false);
  const [showAllExpiry, setShowAllExpiry]       = useState(false);
  const [showAllDeadStock, setShowAllDeadStock] = useState(false);

  const hasSales    = hasPermission('ORDERS_CREATE') || hasPermission('ORDERS_VIEW');
  const hasDelivery = hasPermission('DELIVERY_VIEW') || hasPermission('DELIVERY_UPDATE');
  const paymentsPath = hasSales ? '/sales/payments' : '/delivery/payments';

  // Always fetch
  const { data: dayData }        = useGetMyDayCollectionsQuery(undefined, { refetchOnMountOrArgChange: true });
  const { data: attendanceData } = useGetTodayStatusQuery();
  const { data: workflowData }   = useGetWorkflowSettingsQuery();

  // Sales only
  const { data: allocData,  isLoading: allocLoading  } = useGetMyAllocationQuery(undefined, { skip: !hasSales, refetchOnMountOrArgChange: true });
  const { data: ordersData, isLoading: ordersLoading } = useGetMyOrdersQuery(undefined, { skip: !hasSales, refetchOnMountOrArgChange: true });
  const { data: nearExpiryData } = useGetNearExpiryAlertsQuery({ days: 30 }, { skip: !hasSales, refetchOnMountOrArgChange: true });
  const { data: deadStockData }  = useGetDeadStockQuery({ days: 15 }, { skip: !hasSales, refetchOnMountOrArgChange: true });

  // Delivery only
  const { data: deliveriesData, isLoading: deliveriesLoading } = useGetMyDeliveriesQuery(undefined, { skip: !hasDelivery, refetchOnMountOrArgChange: true });
  const { data: deliveryAllocData, isLoading: deliveryAllocLoading } = useGetMyDeliveryAllocationQuery(undefined, { skip: !hasDelivery || hasSales, refetchOnMountOrArgChange: true });

  const allocation        = allocData?.data;
  const deliveryAllocation = deliveryAllocData?.data;
  const orders: any[]     = ordersData?.data || [];
  const deliveries: any[] = deliveriesData?.data || [];
  const daySummary        = dayData?.data;
  const nearExpiry: any[] = nearExpiryData?.data || [];
  const deadStockAlerts: any[] = (deadStockData?.data || []).filter((i: any) => i.stockQty > 0);
  const billingLocked     = !!(workflowData?.data?.lockBillingAfterCheckout && attendanceData?.data?.checkedOut);

  const totalCollected = Number(daySummary?.totalCollected || 0);
  const pendingSubmit  = (daySummary?.payments || []).filter((p: any) => !p.submitted).length;

  const totalCustomers = allocation?.customers?.length || 0;
  const totalStops     = new Set((allocation?.customers || []).map((c: any) => c.placeId).filter(Boolean)).size;
  const totalDeliveryStops = new Set((deliveryAllocation?.customers || []).map((c: any) => c.placeId).filter(Boolean)).size;
  const totalOrders    = orders.length;
  const totalSales     = orders.reduce((s: number, o: any) => s + Number(o.totalAmount || 0), 0);

  const packed     = deliveries.filter(o => o.status === 'PACKED').length;
  const dispatched = deliveries.filter(o => o.status === 'DISPATCHED').length;
  const delivered  = deliveries.filter(o => o.status === 'DELIVERED').length;

  const formatAmt = (v: number) => v >= 1000 ? `₹${(v / 1000).toFixed(1)}k` : `₹${v.toFixed(0)}`;
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const shareInvoice = async (order: any) => {
    if (sharing) return;
    setSharing(true);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const res  = await fetch(`${API_BASE}/api/public/invoice/${order.id}/pdf`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], `${order.orderNumber}.pdf`, { type: 'application/pdf' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ title: `Invoice ${order.orderNumber}`, files: [file] });
          return;
        } catch (e: any) { if (e?.name === 'AbortError') return; }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${order.orderNumber}.pdf`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      message.info('Invoice PDF downloaded');
    } catch { message.error('Could not generate invoice PDF'); }
    finally { setSharing(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero ── */}
      <div style={{
        background: `linear-gradient(135deg, ${P} 0%, ${PD} 100%)`,
        borderRadius: 18, padding: '22px 20px',
        boxShadow: '0 6px 24px rgba(5,150,105,0.28)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 4 }}>{greeting},</div>
        <div style={{ color: '#fff', fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>{user.fullName?.split(' ')[0]}</div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>

        {hasSales && (
          allocLoading ? (
            <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 14px' }}>
              <Skeleton.Input active style={{ width: 180, height: 14, background: 'rgba(255,255,255,0.2)' }} />
            </div>
          ) : allocation ? (
            <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.14)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <EnvironmentOutlined style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Today's Route</div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{allocation.routeName}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '3px 12px', fontSize: 11, color: '#fff', fontWeight: 700, flexShrink: 0 }}>
                {totalStops} stops
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
              No route allocated for today
            </div>
          )
        )}

        {hasDelivery && !hasSales && (
          deliveryAllocLoading ? (
            <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 14px' }}>
              <Skeleton.Input active style={{ width: 180, height: 14, background: 'rgba(255,255,255,0.2)' }} />
            </div>
          ) : deliveryAllocation ? (
            <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.14)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <EnvironmentOutlined style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Today's Route</div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deliveryAllocation.routeName}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '3px 12px', fontSize: 11, color: '#fff', fontWeight: 700, flexShrink: 0 }}>
                {totalDeliveryStops} stops
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
              No route allocated for today
            </div>
          )
        )}

        {hasDelivery && !hasSales && (
          <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
            {deliveries.length === 0 ? 'No deliveries assigned yet' : `${dispatched + packed} pending · ${delivered} delivered today`}
          </div>
        )}

        {hasSales && hasDelivery && deliveries.length > 0 && (
          <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
            Deliveries: {dispatched + packed} pending · {delivered} done
          </div>
        )}
      </div>

      {/* ── Sales Stats ── */}
      {hasSales && (
        ordersLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isSmall ? 8 : 12 }}>
            {[1, 2, 3, 4].map(i => <Skeleton key={i} active paragraph={{ rows: 2 }} title={false} />)}
          </div>
        ) : (
          <div>
            {hasSales && hasDelivery && (
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Sales</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isSmall ? 8 : 12 }}>
              <StatCard icon={<UserOutlined />}     label="Customers"   value={totalCustomers}           color={P}       bg={PL}        small={isSmall} />
              <StatCard icon={<FileTextOutlined />} label="Orders"      value={totalOrders}              color="#8b5cf6" bg="#f5f3ff"   small={isSmall} />
              <StatCard icon={<ShoppingOutlined />} label="Sales Today" value={formatAmt(totalSales)}    color="#0ea5e9" bg="#e0f2fe"   small={isSmall} />
              <StatCard icon={<WalletOutlined />}   label="Collected"   value={formatAmt(totalCollected)} color="#d97706" bg="#fffbeb" small={isSmall} />
            </div>
          </div>
        )
      )}

      {/* ── Delivery Stats ── */}
      {hasDelivery && (
        deliveriesLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: isSmall ? 8 : 10 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} active paragraph={{ rows: 2 }} title={false} />)}
          </div>
        ) : (
          <div>
            {hasSales && hasDelivery && (
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Deliveries</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: isSmall ? 8 : 10 }}>
              <StatCard icon={<TruckOutlined />}        label="Pickup Ready" value={packed}     color="#d97706" bg="#fef3c7" small={isSmall} />
              <StatCard icon={<TruckOutlined />}        label="On the Way"   value={dispatched} color={P}       bg={PL}     small={isSmall} />
              <StatCard icon={<CheckCircleOutlined />}  label="Delivered"    value={delivered}  color={P}       bg={PL}     small={isSmall} />
            </div>
          </div>
        )
      )}

      {/* ── Near Expiry Alert ── */}
      {hasSales && nearExpiry.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <WarningOutlined style={{ color: '#d97706', fontSize: 17 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#92400e', fontSize: 13 }}>{nearExpiry.length} product{nearExpiry.length > 1 ? 's' : ''} expiring within 30 days</div>
              <div style={{ fontSize: 11, color: '#78350f', marginTop: 1 }}>Push these items in your orders</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(showAllExpiry ? nearExpiry : nearExpiry.slice(0, 5)).map((alert: any) => (
              <div key={alert.batchId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '7px 10px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.product?.name}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{alert.product?.brand} · Qty: {alert.quantityAvailable} {alert.product?.unit}</div>
                </div>
                <div style={{ flexShrink: 0, marginLeft: 8, textAlign: 'right' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: alert.daysToExpiry <= 7 ? '#dc2626' : '#d97706' }}>
                    {alert.daysToExpiry === 0 ? 'Expires today' : `${alert.daysToExpiry}d left`}
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{dayjs(alert.expiryDate).format('DD MMM YYYY')}</div>
                </div>
              </div>
            ))}
            {nearExpiry.length > 5 && (
              <div
                onClick={() => setShowAllExpiry(s => !s)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11, color: '#78350f', fontWeight: 600, textAlign: 'center', cursor: 'pointer', padding: '4px 0' }}
              >
                {showAllExpiry ? <>Show less <UpOutlined style={{ fontSize: 9 }} /></> : <>+{nearExpiry.length - 5} more <DownOutlined style={{ fontSize: 9 }} /></>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Dead Stock Alert ── */}
      {hasSales && deadStockAlerts.length > 0 && (
        <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ThunderboltOutlined style={{ color: '#2563eb', fontSize: 17 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#1e3a8a', fontSize: 13 }}>{deadStockAlerts.length} product{deadStockAlerts.length > 1 ? 's' : ''} not sold in 15+ days</div>
              <div style={{ fontSize: 11, color: '#1d4ed8', marginTop: 1 }}>Push these in your orders today</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(showAllDeadStock ? deadStockAlerts : deadStockAlerts.slice(0, 5)).map((item: any) => (
              <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '7px 10px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.productName}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{item.brand || 'No brand'} · Stock: {item.stockQty} {item.unit}</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: item.daysIdle > 60 ? '#dc2626' : item.daysIdle > 30 ? '#d97706' : '#2563eb', flexShrink: 0, marginLeft: 8 }}>
                  {item.lastBilledDate ? `${item.daysIdle}d idle` : 'Never sold'}
                </div>
              </div>
            ))}
            {deadStockAlerts.length > 5 && (
              <div
                onClick={() => setShowAllDeadStock(s => !s)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11, color: '#1d4ed8', fontWeight: 600, textAlign: 'center', cursor: 'pointer', padding: '4px 0' }}
              >
                {showAllDeadStock ? <>Show less <UpOutlined style={{ fontSize: 9 }} /></> : <>+{deadStockAlerts.length - 5} more <DownOutlined style={{ fontSize: 9 }} /></>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Submit Reminder (once) ── */}
      {pendingSubmit > 0 && !daySummary?.allSubmitted && (
        <div onClick={() => navigate(paymentsPath)} style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 14, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ClockCircleOutlined style={{ color: '#d97706', fontSize: 18 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#92400e', fontSize: 13 }}>Submit Day Collections</div>
            <div style={{ fontSize: 12, color: '#78350f', marginTop: 1 }}>₹{totalCollected.toFixed(2)} pending handover to accountant</div>
          </div>
          <RightOutlined style={{ color: '#d97706', fontSize: 12 }} />
        </div>
      )}

      {/* ── Quick Actions ── */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Quick Actions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            hasPermission('ORDERS_CREATE') && { label: 'New Order',      sub: 'Create order for a customer',  icon: <PlusOutlined />,            color: P,        bg: PL,        path: '/sales/order',       locked: billingLocked },
            hasPermission('ROUTES_VIEW')   && { label: 'My Route',       sub: "View today's customer list",   icon: <EnvironmentOutlined />,     color: '#8b5cf6', bg: '#f5f3ff', path: '/sales/route',       locked: false },
            hasPermission('DELIVERY_VIEW') && { label: 'My Deliveries',  sub: 'Dispatch & mark delivered',    icon: <UnorderedListOutlined />,   color: P,        bg: PL,        path: '/delivery/orders',   locked: false },
            hasPermission('PAYMENTS_CREATE') && { label: 'Payments',     sub: 'Collect & submit payments',    icon: <WalletOutlined />,          color: '#d97706', bg: '#fffbeb', path: paymentsPath,         locked: false },
          ].filter(Boolean).map((action: any) => (
            <div
              key={action.path}
              onClick={() => !action.locked && navigate(action.path)}
              className={action.locked ? undefined : 'card-clickable'}
              style={{ background: action.locked ? '#f8fafc' : '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: action.locked ? 'default' : 'pointer', opacity: action.locked ? 0.6 : 1, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 12, background: action.locked ? '#f1f5f9' : action.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.locked ? '#94a3b8' : action.color, fontSize: 18, flexShrink: 0 }}>
                {action.locked ? <LockOutlined /> : action.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: action.locked ? '#94a3b8' : '#0f172a', fontSize: 14 }}>{action.label}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{action.locked ? 'Locked — checked out for today' : action.sub}</div>
              </div>
              {!action.locked && <RightOutlined style={{ color: '#cbd5e1', fontSize: 12, flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      </div>

      {/* ── Today's Orders ── */}
      {hasSales && orders.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>Today's Orders</div>
            <span onClick={() => navigate('/sales/history')} style={{ fontSize: 12, color: P, fontWeight: 600, cursor: 'pointer' }}>View all</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {orders.slice(0, 4).map((order: any) => {
              const sc = STATUS_COLORS[order.status] || { color: '#6b7280', bg: '#f3f4f6', label: order.status };
              return (
                <div key={order.id} onClick={() => setViewOrder(order)} className="card-clickable"
                  style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', cursor: 'pointer' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.customer?.businessName}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>#{order.orderNumber} · {order.items?.length || 0} items</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                    <div style={{ fontWeight: 800, color: P, fontSize: 14 }}>₹{Number(order.totalAmount || 0).toFixed(0)}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color }}>{sc.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hasSales && orders.length === 0 && !ordersLoading && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: PL, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 28, color: P }}>
            <FileTextOutlined />
          </div>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>No orders yet today</div>
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{billingLocked ? 'Billing is locked after checkout' : 'Start by visiting your route customers'}</div>
          {!billingLocked && hasPermission('ORDERS_CREATE') && (
            <div onClick={() => navigate('/sales/order')} style={{ display: 'inline-block', marginTop: 16, background: P, color: '#fff', fontWeight: 700, fontSize: 13, padding: '10px 24px', borderRadius: 10, cursor: 'pointer' }}>
              Create First Order
            </div>
          )}
        </div>
      )}

      {/* ── Today's Deliveries ── */}
      {hasDelivery && deliveries.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>Today's Deliveries</div>
            <span onClick={() => navigate('/delivery/orders')} style={{ fontSize: 12, color: P, fontWeight: 600, cursor: 'pointer' }}>View all</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {deliveries.slice(0, 4).map((o: any) => {
              const isDelivered  = o.status === 'DELIVERED';
              const isDispatched = o.status === 'DISPATCHED';
              return (
                <div key={o.id} onClick={() => navigate('/delivery/orders')} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.customer?.businessName}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>#{o.orderNumber} · ₹{Number(o.totalAmount || 0).toFixed(0)}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, flexShrink: 0, marginLeft: 8, background: isDelivered ? '#ecfdf5' : isDispatched ? '#eff6ff' : '#fffbeb', color: isDelivered ? '#059669' : isDispatched ? P : '#d97706' }}>
                    {isDelivered ? '✓ DONE' : isDispatched ? 'ON WAY' : 'PICKUP'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Order Detail Drawer ── */}
      <Drawer open={!!viewOrder} onClose={() => setViewOrder(null)} placement="bottom" height="auto"
        styles={{ body: { padding: '0 0 24px', maxHeight: '82vh', overflowY: 'auto' }, header: { display: 'none' }, wrapper: { borderRadius: '20px 20px 0 0', overflow: 'hidden' } }}
        closable={false}>
        {viewOrder && (() => {
          const sc      = STATUS_COLORS[viewOrder.status] || { color: '#6b7280', bg: '#f3f4f6', label: viewOrder.status };
          const balance = Number(viewOrder.balanceAmount || 0);
          const paid    = Number(viewOrder.paidAmount    || 0);
          const total   = Number(viewOrder.totalAmount   || 0);
          return (
            <div>
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4 }}>
                <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e2e8f0' }} />
              </div>
              <div style={{ padding: '14px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 17, color: '#0f172a' }}>{viewOrder.customer?.businessName}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>#{viewOrder.orderNumber}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: sc.bg, color: sc.color }}>{sc.label}</span>
              </div>
              <div style={{ padding: '0 20px 14px', display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, background: '#f8fafc', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Total</div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a' }}>₹{total.toFixed(2)}</div>
                </div>
                {paid > 0 && (
                  <div style={{ flex: 1, background: PL, borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: '#064e3b' }}>Paid</div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: P }}>₹{paid.toFixed(2)}</div>
                  </div>
                )}
                {balance > 0 && (
                  <div style={{ flex: 1, background: '#fef2f2', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: '#7f1d1d' }}>Balance</div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#dc2626' }}>₹{balance.toFixed(2)}</div>
                  </div>
                )}
              </div>
              <div style={{ padding: '0 20px', borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>Items</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(viewOrder.items || []).map((item: any) => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.productName}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{item.quantity} × ₹{Number(item.unitPrice || 0).toFixed(2)}</div>
                      </div>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, flexShrink: 0, marginLeft: 8 }}>₹{Number(item.lineTotal || 0).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
              {hasPermission('ORDERS_CREATE') && (
                <div style={{ padding: '16px 20px 0', display: 'flex', gap: 10 }}>
                  <div onClick={() => { setViewOrder(null); shareInvoice(viewOrder); }}
                    style={{ flex: 1, background: P, color: '#fff', borderRadius: 12, padding: '13px', textAlign: 'center', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {sharing ? '...' : <><ShareAltOutlined /> Share Invoice</>}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Drawer>
    </div>
  );
};

export default FieldDashboardPage;
