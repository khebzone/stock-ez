import React, { useEffect } from 'react';
import { Row, Col, Skeleton, Card, Table, Tag, Alert, Button } from 'antd';
import {
  ShoppingOutlined, TeamOutlined, WalletOutlined,
  RiseOutlined, ClockCircleOutlined, CheckCircleOutlined, TruckOutlined,
  ArrowUpOutlined, ArrowDownOutlined, WarningOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useGetAdminDashboardQuery } from '../../store/api/dashboardApi';
import { useGetSalesReportQuery } from '../../store/api/dashboardApi';
import { useGetOrdersQuery } from '../../store/api/orderApi';
import { useGetNearExpiryAlertsQuery } from '../../store/api/purchaseApi';
import SalesTrendChart from '../../components/charts/SalesTrendChart';
import OrderStatusChart from '../../components/charts/OrderStatusChart';
import dayjs from 'dayjs';

/* ── KPI Card ── */
interface KpiProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  bg: string;
  prefix?: string;
  subtitle?: string;
  trend?: { value: number; label: string };
  loading?: boolean;
}

const KpiCard: React.FC<KpiProps> = ({ title, value, icon, color, bg, prefix, subtitle, trend, loading }) => (
  <div style={{
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #edf0f4',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    padding: '20px',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    transition: 'box-shadow 0.2s, transform 0.15s',
    cursor: 'default',
    height: '100%',
  }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
      (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
      (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
    }}
  >
    <div style={{ flex: 1 }}>
      {loading ? <Skeleton active paragraph={{ rows: 1 }} title={{ width: 80 }} /> : (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {title}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
            {prefix}{typeof value === 'number' ? value.toLocaleString('en-IN') : value}
          </div>
          {subtitle && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>{subtitle}</div>}
          {trend && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
              <span style={{
                color: trend.value >= 0 ? '#10b981' : '#ef4444',
                fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2,
              }}>
                {trend.value >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                {Math.abs(trend.value)}%
              </span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{trend.label}</span>
            </div>
          )}
        </>
      )}
    </div>
    <div style={{
      width: 48, height: 48, borderRadius: 12, flexShrink: 0,
      background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 22, color: color,
    }}>
      {icon}
    </div>
  </div>
);

/* ── Order Status config ── */
const STATUS_CFG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  DRAFT:      { color: '#94a3b8', icon: <ClockCircleOutlined />, label: 'Draft' },
  SUBMITTED:  { color: '#f59e0b', icon: <ClockCircleOutlined />, label: 'Submitted' },
  APPROVED:   { color: '#059669', icon: <CheckCircleOutlined />, label: 'Approved' },
  PREPARING:  { color: '#0891b2', icon: <ShoppingOutlined />,    label: 'Preparing' },
  PREPARED:   { color: '#06b6d4', icon: <ShoppingOutlined />,    label: 'Prepared' },
  DISPATCHED: { color: '#8b5cf6', icon: <TruckOutlined />,       label: 'Dispatched' },
  DELIVERED:  { color: '#10b981', icon: <CheckCircleOutlined />, label: 'Delivered' },
  CANCELLED:  { color: '#ef4444', icon: <ClockCircleOutlined />, label: 'Cancelled' },
};

const fmt = (v: number) => `₹${(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

/* ── Main ── */
const DashboardPage: React.FC = () => {
  const { data: statsResponse, isLoading, isError, refetch } = useGetAdminDashboardQuery();
  const { data: salesReport, isLoading: trendLoading } = useGetSalesReportQuery({
    from: new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });
  const { data: recentOrdersData } = useGetOrdersQuery({ page: 0, size: 5 });
  const { data: alertsData } = useGetNearExpiryAlertsQuery({ days: 30 });

  const stats = statsResponse?.data;
  const trendData = (salesReport?.data?.dailyBreakdown || []).map((d: any) => ({
    date: d.date,
    totalAmount: Number(d.totalAmount || 0),
  }));
  const recentOrders = recentOrdersData?.data?.content || recentOrdersData?.data || [];

  const allAlerts: any[] = alertsData?.data || [];
  const expiredAlerts  = allAlerts.filter((a: any) => a.daysToExpiry <= 0);
  const nearExpiryAlerts = allAlerts.filter((a: any) => a.daysToExpiry > 0);

  const orderStatusEntries = Object.entries(stats?.ordersByStatus || {}).filter(([, v]) => Number(v) > 0);
  const totalInPipeline = orderStatusEntries.reduce((s, [, v]) => s + Number(v), 0);

  useEffect(() => {
    if (!isError) return;
    const t = setTimeout(() => refetch(), 5000);
    return () => clearTimeout(t);
  }, [isError, refetch]);

  return (
    <div>
      {isError && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Cannot reach server"
          description="Retrying in a few seconds… Make sure the backend is running."
          action={<Button size="small" onClick={() => refetch()}>Retry Now</Button>}
        />
      )}
      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: -0.3 }}>Dashboard</div>
            <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
              Welcome back, {JSON.parse(localStorage.getItem('user') || '{}').fullName?.split(' ')[0] || 'User'} — here&apos;s your business at a glance.
            </div>
          </div>
          <div style={{
            background: '#fff', border: '1px solid #edf0f4', borderRadius: 10,
            padding: '8px 16px', fontSize: 13, color: '#64748b', fontWeight: 500,
          }}>
            {dayjs().format('ddd, DD MMM YYYY')}
          </div>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            title="Today's Revenue"
            value={stats?.todaySales || 0}
            prefix="₹"
            icon={<RiseOutlined />}
            color="#059669" bg="#eef2ff"
            subtitle="Total sales today"
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            title="Today's Orders"
            value={stats?.todayOrders || 0}
            icon={<ShoppingOutlined />}
            color="#f59e0b" bg="#fffbeb"
            subtitle="Orders placed today"
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            title="Collections"
            value={stats?.todayCollection || 0}
            prefix="₹"
            icon={<WalletOutlined />}
            color="#10b981" bg="#ecfdf5"
            subtitle="Payments received today"
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            title="Active Customers"
            value={stats?.activeCustomers || 0}
            icon={<TeamOutlined />}
            color="#8b5cf6" bg="#f5f3ff"
            subtitle="Across all routes"
            loading={isLoading}
          />
        </Col>
      </Row>

      {/* ── Stock Health Alerts ── */}
      {(expiredAlerts.length > 0 || nearExpiryAlerts.length > 0) && (
        <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {expiredAlerts.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{
                background: '#fef2f2', borderBottom: '1px solid #fecaca',
                padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <ExclamationCircleOutlined style={{ color: '#ef4444', fontSize: 15 }} />
                <span style={{ fontWeight: 700, color: '#b91c1c', fontSize: 13 }}>
                  Expired Stock — {expiredAlerts.length} {expiredAlerts.length === 1 ? 'batch' : 'batches'} with remaining inventory
                </span>
                <a href="/stock-batches" style={{ marginLeft: 'auto', fontSize: 12, color: '#ef4444', fontWeight: 600 }}>View All</a>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#fef2f2' }}>
                    <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>Product</th>
                    <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>Batch</th>
                    <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>Qty</th>
                    <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>Expired</th>
                  </tr>
                </thead>
                <tbody>
                  {expiredAlerts.slice(0, 5).map((a: any) => (
                    <tr key={a.batchId} style={{ borderTop: '1px solid #fee2e2' }}>
                      <td style={{ padding: '9px 16px', color: '#111827', fontWeight: 500 }}>{a.product?.name}</td>
                      <td style={{ padding: '9px 16px', color: '#6b7280', fontSize: 12 }}>{a.batchNumber}</td>
                      <td style={{ padding: '9px 16px', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{a.quantityAvailable}</td>
                      <td style={{ padding: '9px 16px', textAlign: 'right', color: '#ef4444', fontSize: 12 }}>
                        {dayjs(a.expiryDate).format('DD MMM YYYY')}
                        <span style={{ marginLeft: 6, color: '#9ca3af' }}>({Math.abs(a.daysToExpiry)}d ago)</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {expiredAlerts.length > 5 && (
                <div style={{ padding: '8px 16px', background: '#fef2f2', borderTop: '1px solid #fecaca', fontSize: 12, color: '#9ca3af' }}>
                  + {expiredAlerts.length - 5} more expired batches — <a href="/stock-batches" style={{ color: '#ef4444' }}>view all</a>
                </div>
              )}
            </div>
          )}

          {nearExpiryAlerts.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{
                background: '#fffbeb', borderBottom: '1px solid #fde68a',
                padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <WarningOutlined style={{ color: '#d97706', fontSize: 15 }} />
                <span style={{ fontWeight: 700, color: '#92400e', fontSize: 13 }}>
                  Expiring Soon — {nearExpiryAlerts.length} {nearExpiryAlerts.length === 1 ? 'batch' : 'batches'} within 30 days
                </span>
                <a href="/stock-batches" style={{ marginLeft: 'auto', fontSize: 12, color: '#d97706', fontWeight: 600 }}>View All</a>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#fffbeb' }}>
                    <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>Product</th>
                    <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>Batch</th>
                    <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>Qty</th>
                    <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {nearExpiryAlerts.slice(0, 5).map((a: any) => (
                    <tr key={a.batchId} style={{ borderTop: '1px solid #fef3c7' }}>
                      <td style={{ padding: '9px 16px', color: '#111827', fontWeight: 500 }}>{a.product?.name}</td>
                      <td style={{ padding: '9px 16px', color: '#6b7280', fontSize: 12 }}>{a.batchNumber}</td>
                      <td style={{ padding: '9px 16px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{a.quantityAvailable}</td>
                      <td style={{ padding: '9px 16px', textAlign: 'right', fontSize: 12 }}>
                        <span style={{ color: a.daysToExpiry <= 7 ? '#ef4444' : a.daysToExpiry <= 14 ? '#d97706' : '#374151' }}>
                          {dayjs(a.expiryDate).format('DD MMM YYYY')}
                        </span>
                        <span style={{ marginLeft: 6, color: a.daysToExpiry <= 7 ? '#ef4444' : '#d97706', fontWeight: 600 }}>
                          {a.daysToExpiry}d
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {nearExpiryAlerts.length > 5 && (
                <div style={{ padding: '8px 16px', background: '#fffbeb', borderTop: '1px solid #fde68a', fontSize: 12, color: '#9ca3af' }}>
                  + {nearExpiryAlerts.length - 5} more — <a href="/stock-batches" style={{ color: '#d97706' }}>view all</a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Charts Row ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={15}>
          <div className="chart-card" style={{ height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div className="chart-title">Revenue Trend</div>
                <div className="chart-sub" style={{ marginBottom: 0 }}>Last 7 days performance</div>
              </div>
            </div>
            {trendLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : trendData.length === 0 ? (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
                No sales data for the last 7 days
              </div>
            ) : (
              <SalesTrendChart data={trendData} height={260} />
            )}
          </div>
        </Col>
        <Col xs={24} lg={9}>
          <div className="chart-card" style={{ height: '100%' }}>
            <div className="chart-title">Order Status</div>
            <div className="chart-sub">Today&apos;s order distribution</div>
            {isLoading ? (
              <Skeleton active paragraph={{ rows: 5 }} />
            ) : (
              <OrderStatusChart data={stats?.ordersByStatus || {}} height={260} />
            )}
          </div>
        </Col>
      </Row>

      {/* ── Bottom Row ── */}
      <Row gutter={[16, 16]}>
        {/* Order Pipeline */}
        <Col xs={24} lg={10}>
          <Card
            title={<span style={{ fontWeight: 700, fontSize: 15 }}>Order Pipeline</span>}
            extra={<span style={{ fontSize: 12, color: '#94a3b8' }}>{totalInPipeline} orders today</span>}
            style={{ borderRadius: 12, height: '100%' }}
            styles={{ body: { padding: '16px 20px' } }}
          >
            {isLoading ? (
              <Skeleton active paragraph={{ rows: 5 }} />
            ) : orderStatusEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 0', color: '#94a3b8' }}>
                <ShoppingOutlined style={{ fontSize: 40, marginBottom: 12, display: 'block', opacity: 0.4 }} />
                <div style={{ fontSize: 13 }}>No orders yet today</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {orderStatusEntries.map(([status, count]) => {
                  const cfg = STATUS_CFG[status] || { color: '#6b7280', icon: null, label: status };
                  const pct = totalInPipeline > 0 ? Math.round((Number(count) / totalInPipeline) * 100) : 0;
                  return (
                    <div key={status}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: cfg.color, fontSize: 14 }}>{cfg.icon}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{cfg.label}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>{pct}%</span>
                          <span style={{
                            background: cfg.color, color: '#fff',
                            borderRadius: 6, padding: '2px 10px',
                            fontSize: 12, fontWeight: 700, minWidth: 32, textAlign: 'center',
                          }}>{String(count)}</span>
                        </div>
                      </div>
                      <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: cfg.color, borderRadius: 3, transition: 'width 0.8s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>

        {/* Recent Orders */}
        <Col xs={24} lg={14}>
          <Card
            title={<span style={{ fontWeight: 700, fontSize: 15 }}>Recent Orders</span>}
            extra={<a href="/orders" style={{ fontSize: 12, fontWeight: 600 }}>View All</a>}
            style={{ borderRadius: 12, height: '100%' }}
            styles={{ body: { padding: 0 } }}
          >
            <Table
              dataSource={Array.isArray(recentOrders) ? recentOrders.slice(0, 5) : []}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: <div style={{ padding: '28px 0', color: '#94a3b8' }}>No orders yet</div> }}
              columns={[
                {
                  title: 'Order', dataIndex: 'orderNumber', key: 'order', width: 130,
                  render: (v: string) => <span style={{ fontWeight: 600, color: '#059669', fontSize: 13 }}>{v}</span>,
                },
                {
                  title: 'Customer', key: 'customer',
                  render: (_: any, r: any) => (
                    <span style={{ fontSize: 13 }}>{r.customer?.businessName || r.customerName || '—'}</span>
                  ),
                },
                {
                  title: 'Amount', dataIndex: 'totalAmount', key: 'amount', width: 110,
                  render: (v: number) => <span style={{ fontWeight: 700, color: '#0f172a' }}>{fmt(v)}</span>,
                },
                {
                  title: 'Status', dataIndex: 'status', key: 'status', width: 130,
                  render: (v: string) => {
                    const cfg = STATUS_CFG[v] || { color: '#6b7280', label: v };
                    return (
                      <Tag style={{
                        background: cfg.color + '15', color: cfg.color,
                        border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 11,
                      }}>
                        {cfg.label}
                      </Tag>
                    );
                  },
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* ── Quick Stats ── */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        {[
          { label: 'Total Products', value: stats?.totalProducts || 0, color: '#059669', bg: '#eef2ff', icon: <ShoppingOutlined /> },
          { label: 'Total Routes',   value: stats?.totalRoutes || 0,   color: '#10b981', bg: '#ecfdf5', icon: <TruckOutlined /> },
          { label: 'Pending Orders', value: stats?.pendingOrders || 0, color: '#f59e0b', bg: '#fffbeb', icon: <ClockCircleOutlined /> },
          { label: 'Team Members',   value: stats?.totalUsers || 0,    color: '#8b5cf6', bg: '#f5f3ff', icon: <TeamOutlined /> },
        ].map(item => (
          <Col xs={12} sm={6} key={item.label}>
            <div style={{
              background: '#fff', borderRadius: 12,
              border: '1px solid #edf0f4',
              padding: '18px 16px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: item.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: item.color,
              }}>
                {item.icon}
              </div>
              <div>
                {isLoading ? (
                  <Skeleton active paragraph={false} title={{ width: 40 }} />
                ) : (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
                      {item.value.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{item.label}</div>
                  </>
                )}
              </div>
            </div>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default DashboardPage;
