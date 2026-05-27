import React from 'react';
import { Avatar, Dropdown, Badge } from 'antd';
import { Grid } from 'antd';
import {
  DashboardOutlined, EnvironmentOutlined,
  PlusCircleOutlined, WalletOutlined, LogoutOutlined, HistoryOutlined, ClockCircleOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const { useBreakpoint } = Grid;

const NAV = [
  { key: '/sales/dashboard',   icon: <DashboardOutlined />,    label: 'Dashboard'  },
  { key: '/sales/route',       icon: <EnvironmentOutlined />,  label: 'My Route'   },
  { key: '/sales/order',       icon: <PlusCircleOutlined />,   label: 'New Order'  },
  { key: '/sales/payments',    icon: <WalletOutlined />,       label: 'Payments'   },
  { key: '/sales/incentives',  icon: <TrophyOutlined />,       label: 'Incentives' },
  { key: '/sales/attendance',  icon: <ClockCircleOutlined />,  label: 'Attendance' },
];

const P = '#059669';
const PD = '#047857';
const PL = '#ecfdf5';
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const SalesLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const isMobile  = !screens.md;
  const isTablet  = !!screens.md && !screens.lg;
  const isDesktop = !!screens.lg;
  const sideW = isDesktop ? 228 : 68;

  const handleLogout = () => { localStorage.clear(); navigate('/login'); };

  const isActive = (key: string) =>
    location.pathname === key ||
    (key === '/sales/order' && location.pathname.startsWith('/sales/order')) ||
    (key === '/sales/incentives' && location.pathname.startsWith('/sales/incentives'));

  const userMenu = [
    {
      key: 'info', disabled: true,
      label: (
        <div style={{ padding: '10px 4px', minWidth: 200 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{user.fullName}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{user.phone || user.email}</div>
          <div style={{ marginTop: 10 }}>
            <span style={{ background: PL, color: P, fontSize: 11, padding: '3px 12px', borderRadius: 20, fontWeight: 700 }}>
              Sales Person
            </span>
          </div>
        </div>
      ),
    },
    { type: 'divider' as const },
    { key: 'logout', label: 'Sign Out', icon: <LogoutOutlined />, onClick: handleLogout, danger: true },
  ];

  /* ── Mobile layout ── */
  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc', fontFamily: FONT }}>
        {/* Header */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 200,
          background: '#fff',
          borderBottom: '1px solid #e2e8f0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          padding: '0 16px', height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: `linear-gradient(135deg, ${P}, ${PD})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(5,150,105,0.3)',
            }}>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>D</span>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', letterSpacing: -0.3, lineHeight: 1.2 }}>StockEz</div>
              <div style={{ fontSize: 10, color: P, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>Sales</div>
            </div>
          </div>
          <Dropdown menu={{ items: userMenu }} placement="bottomRight" trigger={['click']}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 8px', borderRadius: 10 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>{user.fullName?.split(' ')[0]}</div>
                <div style={{ fontSize: 10, color: P, fontWeight: 600 }}>Sales</div>
              </div>
              <Avatar size={32} style={{ background: P, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {user.fullName?.[0]}
              </Avatar>
            </div>
          </Dropdown>
        </header>

        {/* Content */}
        <main style={{ flex: 1, padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px calc(80px + env(safe-area-inset-bottom, 0px)) 16px', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
          {children}
        </main>

        {/* Bottom Tab Bar */}
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
          background: '#fff', borderTop: '1px solid #e2e8f0',
          boxShadow: '0 -2px 12px rgba(0,0,0,0.07)',
          display: 'flex',
          height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          alignItems: 'stretch',
        }}>
          {NAV.map(tab => {
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
        </nav>
      </div>
    );
  }

  /* ── Tablet / Desktop sidebar layout ── */
  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#f8fafc', fontFamily: FONT }}>
      {/* Sidebar */}
      <aside style={{
        width: sideW, flexShrink: 0,
        position: 'fixed', top: 0, left: 0, bottom: 0,
        background: '#fff', borderRight: '1px solid #e2e8f0',
        boxShadow: '2px 0 8px rgba(0,0,0,0.04)',
        zIndex: 100, display: 'flex', flexDirection: 'column',
        transition: 'width 0.25s',
      }}>
        {/* Logo */}
        <div style={{
          height: 64, display: 'flex', alignItems: 'center',
          padding: isDesktop ? '0 20px' : '0 16px',
          gap: 12, borderBottom: '1px solid #e2e8f0',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: `linear-gradient(135deg, ${P}, ${PD})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(5,150,105,0.3)',
          }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 17 }}>D</span>
          </div>
          {isDesktop && (
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', letterSpacing: -0.4 }}>StockEz</div>
              <div style={{ fontSize: 10, color: P, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>Sales</div>
            </div>
          )}
        </div>

        {/* Nav */}
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

        {/* User */}
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
                  <div style={{ fontSize: 11, color: '#64748b' }}>Sales Person</div>
                </div>
              )}
            </div>
          </Dropdown>
        </div>
      </aside>

      {/* Main Content */}
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

export default SalesLayout;
