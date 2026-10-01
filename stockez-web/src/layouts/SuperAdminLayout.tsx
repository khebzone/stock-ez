import React, { useState } from 'react';
import truckLogo from '../assets/logo-truck-light.png';
import { Layout, Menu, Avatar, Dropdown, Grid, Drawer } from 'antd';
import {
  CloudServerOutlined,
  LogoutOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { colors } from '../styles/tokens';

const { Header, Sider, Content } = Layout;
const SIDEBAR_W = 220;
const HEADER_H = 56;

const NAV_ITEMS = [
  { key: '/superadmin/tenants', icon: <CloudServerOutlined />, label: 'Tenants' },
];

const SuperAdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isDesktop = !!screens.lg;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => { ['token','refreshToken','tenantId','userId','user'].forEach(k => localStorage.removeItem(k)); navigate('/login'); };

  const userDropdown = [
    {
      key: 'profile',
      label: (
        <div style={{ padding: '8px 4px', minWidth: 180 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1d2e' }}>{user.fullName}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{user.phone}</div>
          <div style={{ marginTop: 8 }}>
            <span style={{ background: '#ef444418', color: '#ef4444', fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700 }}>
              Super Admin
            </span>
          </div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' as const },
    { key: 'logout', label: 'Sign Out', icon: <LogoutOutlined />, onClick: handleLogout, danger: true },
  ];

  const navMenu = (onLinkClick?: () => void) => (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[location.pathname]}
      items={NAV_ITEMS.map(item => ({
        key: item.key,
        icon: item.icon,
        label: <Link to={item.key} onClick={onLinkClick}>{item.label}</Link>,
      }))}
      style={{ background: 'transparent', border: 'none', padding: '0 10px', marginTop: 8 }}
    />
  );

  const sidebarContent = (onLinkClick?: () => void) => (
    <>
      <div style={{
        height: HEADER_H,
        display: 'flex', alignItems: 'center',
        padding: '0 22px',
        borderBottom: `1px solid ${colors.sidebarBorder}`,
        gap: 10,
      }}>
        <img src={truckLogo} alt="StockEz" style={{ height: 38, width: 'auto', flexShrink: 0, objectFit: 'contain', display: 'block' }} />
        <div>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, lineHeight: 1.2 }}>StockEz</div>
          <div style={{ color: colors.sidebarMuted, fontSize: 10, letterSpacing: 0.5 }}>Super Admin</div>
        </div>
        {!isDesktop && (
          <div
            onClick={onLinkClick}
            style={{ marginLeft: 'auto', cursor: 'pointer', color: colors.sidebarMuted, fontSize: 18, lineHeight: 1, padding: 4 }}
          >
            ✕
          </div>
        )}
      </div>

      <div style={{ padding: '10px 24px 4px', fontSize: 10, fontWeight: 700, color: colors.sidebarMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 4 }}>
        Platform
      </div>
      {navMenu(onLinkClick)}

      <div style={{
        position: isDesktop ? 'absolute' : 'relative',
        bottom: 0, left: 0, right: 0,
        height: 64,
        padding: '0 18px',
        borderTop: `1px solid ${colors.sidebarBorder}`,
        background: 'rgba(0,0,0,0.12)',
        display: 'flex', alignItems: 'center', gap: 10,
        marginTop: isDesktop ? 0 : 'auto',
      }}>
        <Avatar size={34} style={{ background: '#ef4444', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
          {user.fullName?.[0]}
        </Avatar>
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.fullName}
          </div>
          <div style={{ fontSize: 11, color: colors.sidebarMuted }}>Super Admin</div>
        </div>
      </div>
    </>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {isDesktop && (
        <Sider
          width={SIDEBAR_W}
          style={{
            background: colors.sidebar,
            position: 'fixed',
            height: '100vh',
            left: 0, top: 0,
            zIndex: 100,
            overflow: 'hidden',
            borderRight: '1px solid rgba(255,255,255,0.06)',
          }}
          trigger={null}
        >
          {sidebarContent()}
        </Sider>
      )}

      <Drawer
        open={!isDesktop && mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        placement="left"
        width={SIDEBAR_W}
        title={null}
        closable={false}
        styles={{ body: { padding: 0, background: colors.sidebar, display: 'flex', flexDirection: 'column', height: '100%' } }}
      >
        {sidebarContent(() => setMobileNavOpen(false))}
      </Drawer>

      <Layout style={{ marginLeft: isDesktop ? SIDEBAR_W : 0, minHeight: '100vh' }}>
        <Header style={{
          position: 'sticky', top: 0, zIndex: 99,
          background: '#fff',
          padding: `0 ${isDesktop ? 24 : 16}px`,
          height: HEADER_H,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #edf0f4',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!isDesktop && (
              <div
                onClick={() => setMobileNavOpen(true)}
                style={{ cursor: 'pointer', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, color: '#64748b', fontSize: 16 }}
              >
                <MenuUnfoldOutlined />
              </div>
            )}
            <span style={{ color: '#1e293b', fontWeight: 600, fontSize: 14 }}>Tenant Management</span>
          </div>

          <Dropdown menu={{ items: userDropdown }} placement="bottomRight" trigger={['click']}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 8px 4px 4px', borderRadius: 8 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <Avatar size={28} style={{ background: '#ef4444', fontWeight: 700, fontSize: 12 }}>
                {user.fullName?.[0] || <UserOutlined />}
              </Avatar>
              {isDesktop && (
                <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', lineHeight: 1.2 }}>
                  {user.fullName?.split(' ')[0]}
                </div>
              )}
            </div>
          </Dropdown>
        </Header>

        <Content style={{ padding: isDesktop ? '24px 28px' : '16px', minHeight: `calc(100vh - ${HEADER_H}px)`, background: colors.pageBg }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default SuperAdminLayout;
