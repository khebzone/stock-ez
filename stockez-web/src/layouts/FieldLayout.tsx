import React, { useState } from 'react';
import truckLogo from '../assets/logo-truck.png';
import { Avatar, Dropdown, Spin, Drawer } from 'antd';
import { Grid } from 'antd';
import {
  DashboardOutlined, EnvironmentOutlined, PlusCircleOutlined,
  WalletOutlined, LogoutOutlined, ClockCircleOutlined,
  TrophyOutlined, UnorderedListOutlined, RollbackOutlined,
  TeamOutlined, ShoppingOutlined, HddOutlined, EyeOutlined,
  GlobalOutlined, InboxOutlined, ShopOutlined, FileTextOutlined,
  CalculatorOutlined, AuditOutlined, CarOutlined, BarChartOutlined,
  UploadOutlined, HistoryOutlined, AppstoreOutlined,
} from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useExportBranding } from '../utils/exportBranding';
import { hasPermission } from '../utils/permissions';
import { useGetMyTodayAllocationQuery } from '../store/api/routeAllocationApi';
import { useLocationReporting } from '../hooks/useLocationReporting';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

const { useBreakpoint } = Grid;

const P  = '#059669';
const PD = '#047857';
const PL = '#ecfdf5';
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";


const FieldLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useExportBranding();
  const location = useLocation();
  const navigate = useNavigate();
  const screens  = useBreakpoint();
  const user     = JSON.parse(localStorage.getItem('user') || '{}');
  const [moreOpen, setMoreOpen] = useState(false);

  const isMobile  = !screens.md;
  const isDesktop = !!screens.lg;
  const sideW     = isDesktop ? 228 : 68;

  const { data: allocationData, isLoading: allocationLoading } = useGetMyTodayAllocationQuery();
  const myAllocation = allocationData?.data;

  // Field staff only — the admin layout never reports a position.
  useLocationReporting(true);
  useRealtimeSync();

  // Fallback to permission-based if API hasn't responded yet
  const permSales    = hasPermission('ORDERS_VIEW') || hasPermission('ORDERS_CREATE');
  const permDelivery = hasPermission('DELIVERY_VIEW') || hasPermission('DELIVERY_UPDATE');

  // Once loaded, gate pass allocation drives visibility
  // Fall back to permission when allocation doesn't carry isSales/isDelivery flags
  const hasSales    = myAllocation != null ? (myAllocation.isSales    ?? myAllocation.sales    ?? permSales)    : permSales;
  const hasDelivery = myAllocation != null ? (myAllocation.isDelivery ?? myAllocation.delivery ?? permDelivery) : permDelivery;
  const allocated   = myAllocation != null ? myAllocation.allocated : null;
  const hasWarehouse = myAllocation != null ? (myAllocation.isWarehouse ?? myAllocation.warehouse ?? false) : false;
  const activeScope: Record<string, boolean> = { sales: hasSales, delivery: hasDelivery, warehouse: hasWarehouse };

  // Single-role users: always follow permission.
  // Dual-role users: let allocation decide (hasSales already incorporates the fallback above).
  const dashboardKey  = '/field/dashboard';
  const paymentsKey   = (permSales && !permDelivery) ? '/sales/payments'
    : (!permSales && permDelivery) ? '/delivery/payments'
    : hasSales ? '/sales/payments' : '/delivery/payments';
  const attendanceKey = (permSales && !permDelivery) ? '/sales/attendance'
    : (!permSales && permDelivery) ? '/delivery/attendance'
    : hasSales ? '/sales/attendance' : '/delivery/attendance';
  const historyKey = (permSales && !permDelivery) ? '/sales/history'
    : (!permSales && permDelivery) ? '/delivery/history'
    : hasSales ? '/sales/history' : '/delivery/history';
  const historyPermission = historyKey === '/sales/history' ? 'ORDERS_VIEW' : 'DELIVERY_VIEW';

  const ALL_NAV: { key: string; icon: React.ReactNode; label: string; permission: string | null; scope?: string }[] = [
    { key: dashboardKey,                   icon: <DashboardOutlined />,      label: 'Dashboard',        permission: null },
    { key: '/sales/route',                 icon: <EnvironmentOutlined />,    label: 'My Route',         permission: 'ROUTES_VIEW',   scope: 'sales' },
    { key: '/sales/order',                 icon: <PlusCircleOutlined />,     label: 'New Order',        permission: 'ORDERS_CREATE',  scope: 'sales' },
    { key: '/delivery/orders',             icon: <UnorderedListOutlined />,  label: 'Deliveries',       permission: 'DELIVERY_VIEW', scope: 'delivery' },
    { key: paymentsKey,                    icon: <WalletOutlined />,         label: 'Payments',         permission: 'PAYMENTS_CREATE' },
    { key: '/sales/goods-return',          icon: <RollbackOutlined />,       label: 'Returns',          permission: 'RETURNS_CREATE' },
    { key: '/sales/customers',             icon: <TeamOutlined />,           label: 'Customers',        permission: 'CUSTOMERS_VIEW' },
    { key: '/sales/products',              icon: <ShoppingOutlined />,       label: 'Products',         permission: 'PRODUCTS_VIEW' },
    { key: '/sales/stock-batches',         icon: <HddOutlined />,            label: 'Stock Batches',    permission: 'STOCK_VIEW' },
    { key: '/sales/purchases',             icon: <InboxOutlined />,          label: 'Purchases',        permission: 'PURCHASES_VIEW' },
    { key: '/sales/suppliers',             icon: <ShopOutlined />,           label: 'Suppliers',        permission: 'SUPPLIERS_VIEW' },
    { key: '/sales/supplier-payments',     icon: <WalletOutlined />,         label: 'Supplier Payments',permission: 'SUPPLIER_PAYMENTS_VIEW' },
    { key: '/sales/expenses',              icon: <FileTextOutlined />,       label: 'Expenses',         permission: 'EXPENSES_VIEW' },
    { key: '/sales/day-closure',           icon: <CalculatorOutlined />,     label: 'Day Counter',      permission: 'DAY_CLOSURE_VIEW' },
    { key: '/sales/invoice/approver',      icon: <AuditOutlined />,          label: 'Approve Orders',   permission: 'INVOICE_VIEW' },
    { key: '/sales/warehouse/picklist',    icon: <InboxOutlined />,          label: 'Route Pick List',  permission: 'PICKLIST_VIEW',  scope: 'warehouse' },
    { key: '/sales/gate-pass',             icon: <EyeOutlined />,            label: 'Gate Pass',        permission: 'GATE_PASS_VIEW' },
    { key: '/sales/field-monitor',         icon: <GlobalOutlined />,         label: 'Field Monitor',    permission: 'FIELD_MONITOR_VIEW' },
    { key: '/sales/vehicles',              icon: <CarOutlined />,            label: 'Vehicles',         permission: 'VEHICLES_VIEW' },
    { key: '/sales/reports',               icon: <BarChartOutlined />,       label: 'Reports',          permission: 'REPORTS_VIEW' },
    { key: '/sales/import',                icon: <UploadOutlined />,         label: 'Import',           permission: 'IMPORT_VIEW' },
    { key: historyKey,                     icon: <HistoryOutlined />,        label: 'History',          permission: historyPermission },
    { key: '/sales/incentives',            icon: <TrophyOutlined />,         label: 'Incentives',       permission: 'INCENTIVES_VIEW' },
    { key: attendanceKey,                  icon: <ClockCircleOutlined />,    label: 'Attendance',       permission: 'ATTENDANCE_CHECKIN' },
  ];

  // Work-specific items follow today's open allocation; with none open, permissions alone decide.
  const anyActiveAllocation = allocated === true;
  const NAV = ALL_NAV.filter(item =>
    (item.permission === null || hasPermission(item.permission)) &&
    (!item.scope || !anyActiveAllocation || activeScope[item.scope])
  );

  const handleLogout = () => { localStorage.clear(); navigate('/login'); };

  if (allocationLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <Spin size="large" />
      </div>
    );
  }

  const isActive = (key: string) =>
    location.pathname === key ||
    location.pathname.startsWith(key + '/')  ||
    (key === '/sales/order' && location.pathname.startsWith('/sales/order'));

  const userMenu = [
    {
      key: 'info', disabled: true,
      label: (
        <div style={{ padding: '10px 4px', minWidth: 200 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{user.fullName}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{user.phone || user.email}</div>
          <div style={{ marginTop: 10 }}>
            <span style={{ background: PL, color: P, fontSize: 11, padding: '3px 12px', borderRadius: 20, fontWeight: 700 }}>
              {user.roleName || (hasSales ? 'Sales Person' : 'Delivery Person')}
            </span>
          </div>
        </div>
      ),
    },
    { type: 'divider' as const },
    { key: 'logout', label: 'Sign Out', icon: <LogoutOutlined />, onClick: handleLogout, danger: true },
  ];

  if (isMobile) {
    const primaryNav = NAV.length > 5 ? NAV.slice(0, 4) : NAV;
    const moreNav    = NAV.length > 5 ? NAV.slice(4)    : [];
    const isMoreActive = moreNav.some(tab => isActive(tab.key));

    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc', fontFamily: FONT }}>
        {/* Header */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 200,
          background: '#fff', borderBottom: '1px solid #e2e8f0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          padding: '0 16px', height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={truckLogo} alt="StockEz" style={{ height: 34, width: 'auto', flexShrink: 0, objectFit: 'contain', display: 'block' }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', letterSpacing: -0.3, lineHeight: 1.2 }}>StockEz</div>
              <div style={{ fontSize: 10, color: P, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                {user.roleName || (hasSales ? 'Sales' : 'Delivery')}
              </div>
            </div>
          </div>
          <Dropdown menu={{ items: userMenu }} placement="bottomRight" trigger={['click']}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 8px', borderRadius: 10 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>{user.fullName?.split(' ')[0]}</div>
                <div style={{ fontSize: 10, color: P, fontWeight: 600 }}>{user.roleName || ''}</div>
              </div>
              <Avatar size={32} style={{ background: P, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {user.fullName?.[0]}
              </Avatar>
            </div>
          </Dropdown>
        </header>

        {/* Content */}
        <main style={{
          flex: 1,
          padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px calc(80px + env(safe-area-inset-bottom, 0px)) 16px',
          width: '100%', boxSizing: 'border-box', overflowX: 'hidden',
        }}>
          {children}
        </main>

        {/* Bottom Tab Bar — max 4 primary + More */}
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
          background: '#fff', borderTop: '1px solid #e2e8f0',
          boxShadow: '0 -2px 12px rgba(0,0,0,0.07)',
          display: 'flex',
          height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          alignItems: 'stretch',
        }}>
          {primaryNav.map(tab => {
            const active = isActive(tab.key);
            return (
              <Link key={tab.key} to={tab.key} style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 3,
                textDecoration: 'none', color: active ? P : '#94a3b8',
                position: 'relative', transition: 'color 0.15s',
              }}>
                {active && (
                  <span style={{
                    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                    width: 32, height: 3, borderRadius: '0 0 3px 3px', background: P,
                  }} />
                )}
                <span style={{ fontSize: 21, lineHeight: 1 }}>{tab.icon}</span>
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, lineHeight: 1 }}>{tab.label}</span>
              </Link>
            );
          })}

          {moreNav.length > 0 && (
            <div
              onClick={() => setMoreOpen(true)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 3,
                cursor: 'pointer', color: isMoreActive ? P : '#94a3b8',
                position: 'relative', transition: 'color 0.15s',
                userSelect: 'none',
              }}
            >
              {isMoreActive && (
                <span style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: 32, height: 3, borderRadius: '0 0 3px 3px', background: P,
                }} />
              )}
              <span style={{ fontSize: 21, lineHeight: 1 }}><AppstoreOutlined /></span>
              <span style={{ fontSize: 10, fontWeight: isMoreActive ? 700 : 500, lineHeight: 1 }}>More</span>
            </div>
          )}
        </nav>

        {/* More Drawer */}
        <Drawer
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          placement="bottom"
          height="auto"
          title={<span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>More</span>}
          styles={{ body: { padding: '12px 16px 24px' } }}
          closable
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {moreNav.map(tab => {
              const active = isActive(tab.key);
              return (
                <Link
                  key={tab.key}
                  to={tab.key}
                  onClick={() => setMoreOpen(false)}
                  style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '14px 8px', borderRadius: 14, textDecoration: 'none',
                    background: active ? PL : '#f8fafc',
                    color: active ? P : '#475569',
                    border: `1px solid ${active ? '#bbf7d0' : '#f1f5f9'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{tab.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, textAlign: 'center', lineHeight: 1.3 }}>
                    {tab.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </Drawer>
      </div>
    );
  }

  /* ── Tablet / Desktop sidebar layout ── */
  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#f8fafc', fontFamily: FONT }}>
      <aside style={{
        width: sideW, flexShrink: 0,
        position: 'fixed', top: 0, left: 0, bottom: 0,
        background: '#fff', borderRight: '1px solid #e2e8f0',
        boxShadow: '2px 0 8px rgba(0,0,0,0.04)',
        zIndex: 100, display: 'flex', flexDirection: 'column',
        transition: 'width 0.25s',
      }}>
        <div style={{
          height: 64, display: 'flex', alignItems: 'center',
          padding: isDesktop ? '0 20px' : '0 16px',
          gap: 12, borderBottom: '1px solid #e2e8f0',
          justifyContent: isDesktop ? 'flex-start' : 'center',
        }}>
          <img src={truckLogo} alt="StockEz" style={{ height: 36, width: 'auto', flexShrink: 0, objectFit: 'contain', display: 'block' }} />
          {isDesktop && (
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', letterSpacing: -0.4 }}>StockEz</div>
              <div style={{ fontSize: 10, color: P, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                {user.roleName || (hasSales ? 'Sales' : 'Delivery')}
              </div>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {NAV.map(tab => {
            const active = isActive(tab.key);
            return (
              <Link key={tab.key} to={tab.key} style={{
                display: 'flex', alignItems: 'center',
                gap: isDesktop ? 12 : 0,
                padding: isDesktop ? '11px 14px' : '12px',
                borderRadius: 10, textDecoration: 'none',
                justifyContent: isDesktop ? 'flex-start' : 'center',
                background: active ? PL : 'transparent',
                color: active ? P : '#64748b',
                fontWeight: active ? 700 : 500,
                fontSize: 14, transition: 'all 0.15s',
                borderLeft: active && isDesktop ? `3px solid ${P}` : '3px solid transparent',
              }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>{tab.icon}</span>
                {isDesktop && <span style={{ lineHeight: 1 }}>{tab.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '12px 8px', borderTop: '1px solid #e2e8f0' }}>
          <Dropdown menu={{ items: userMenu }} placement="topRight" trigger={['click']}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: isDesktop ? '10px 14px' : '10px',
              borderRadius: 10, cursor: 'pointer',
              justifyContent: isDesktop ? 'flex-start' : 'center',
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <Avatar size={34} style={{ background: P, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {user.fullName?.[0]}
              </Avatar>
              {isDesktop && (
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.fullName}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{user.roleName || ''}</div>
                </div>
              )}
            </div>
          </Dropdown>
        </div>
      </aside>

      <main style={{
        marginLeft: sideW, flex: 1,
        padding: '28px 32px', minHeight: '100vh',
        maxWidth: isDesktop ? 960 : 760,
        boxSizing: 'border-box',
        transition: 'margin-left 0.25s',
      }}>
        <div className="page-enter">{children}</div>
      </main>
    </div>
  );
};

export default FieldLayout;
