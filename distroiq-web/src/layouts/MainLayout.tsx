import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Badge, Breadcrumb, Input, Tooltip, Modal, Form, message, Grid, Drawer } from 'antd';
import {
  DashboardOutlined, ShoppingOutlined, UserOutlined, LogoutOutlined,
  GlobalOutlined, TeamOutlined, WalletOutlined, BarChartOutlined,
  FileTextOutlined, BellOutlined, SearchOutlined, SettingOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, QuestionCircleOutlined, TagsOutlined,
  InboxOutlined, AlertOutlined, LineChartOutlined, BookOutlined, TrophyOutlined,
  CalculatorOutlined, RollbackOutlined, CarOutlined, AuditOutlined, EyeOutlined,
  ShopOutlined, HddOutlined, LockOutlined, UploadOutlined,
} from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useChangePasswordMutation } from '../store/api/userApi';
import { colors } from '../styles/tokens';

const { Header, Sider, Content } = Layout;

const SIDEBAR_W = 248;
const SIDEBAR_COLLAPSED_W = 68;
const HEADER_H = 56;

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: '#ef4444' },
  ADMIN: { label: 'Admin', color: '#4361ee' },
  SALES: { label: 'Sales', color: '#0ea5e9' },
  INVOICE: { label: 'Invoice', color: '#f59e0b' },
  WAREHOUSE: { label: 'Warehouse', color: '#06b6d4' },
  DELIVERY: { label: 'Delivery', color: '#10b981' },
  ACCOUNTANT: { label: 'Accountant', color: '#8b5cf6' },
};

const NAV_SECTIONS = [
  {
    section: 'MAIN',
    items: [
      { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard', roles: ['ADMIN', 'SUPER_ADMIN', 'WAREHOUSE', 'ACCOUNTANT'] },
    ],
  },
  {
    section: 'OPERATIONS',
    items: [
      { key: '/orders', icon: <FileTextOutlined />, label: 'Orders', roles: ['ADMIN', 'SALES', 'INVOICE', 'WAREHOUSE', 'DELIVERY'] },
      { key: '/invoice/approver', icon: <FileTextOutlined />, label: 'Approve Orders', roles: ['INVOICE', 'ADMIN'] },
      { key: '/warehouse/picklist', icon: <InboxOutlined />, label: 'Route Pick List', roles: ['ADMIN', 'WAREHOUSE'] },
      { key: '/purchases', icon: <InboxOutlined />, label: 'Purchases', roles: ['ADMIN', 'WAREHOUSE'] },
      { key: '/stock-batches', icon: <HddOutlined />, label: 'Stock Batches', roles: ['ADMIN', 'WAREHOUSE'] },
      { key: '/goods-return', icon: <RollbackOutlined />, label: 'Goods Return', roles: ['ADMIN', 'WAREHOUSE'] },
      { key: '/customers', icon: <TeamOutlined />, label: 'Customers', roles: ['ADMIN', 'SALES'] },
      { key: '/products', icon: <ShoppingOutlined />, label: 'Products', roles: ['ADMIN', 'SALES', 'INVOICE'] },
    ],
  },
  {
    section: 'FINANCE',
    items: [
      { key: '/payments', icon: <WalletOutlined />, label: 'Payments', roles: ['ADMIN', 'SALES', 'DELIVERY', 'ACCOUNTANT'] },
      { key: '/customer-outstanding', icon: <WalletOutlined />, label: 'Customer Outstanding', roles: ['ADMIN', 'ACCOUNTANT'] },
      { key: '/supplier-payments', icon: <WalletOutlined />, label: 'Supplier Payments', roles: ['ADMIN', 'ACCOUNTANT', 'WAREHOUSE'] },
      { key: '/expenses', icon: <FileTextOutlined />, label: 'Expenses', roles: ['ADMIN', 'ACCOUNTANT'] },
      { key: '/day-closure', icon: <CalculatorOutlined />, label: 'Day Counter', roles: ['ADMIN', 'ACCOUNTANT'] },
      { key: '/reports', icon: <BarChartOutlined />, label: 'Reports', roles: ['ADMIN', 'ACCOUNTANT'] },
      { key: '/reports/aging', icon: <AlertOutlined />, label: 'Aging Report', roles: ['ADMIN', 'ACCOUNTANT'] },
      { key: '/reports/sales', icon: <LineChartOutlined />, label: 'Sales Analysis', roles: ['ADMIN', 'ACCOUNTANT'] },
      { key: '/reports/ledger', icon: <BookOutlined />, label: 'Ledger', roles: ['ADMIN', 'ACCOUNTANT'] },
      { key: '/reports/targets', icon: <TrophyOutlined />, label: 'Targets', roles: ['ADMIN'] },
    ],
  },
  {
    section: 'FIELD OPS',
    items: [
      { key: '/gate-pass', icon: <AuditOutlined />, label: 'Gate Pass', roles: ['ADMIN'] },
      { key: '/field-monitor', icon: <EyeOutlined />, label: 'Field Monitor', roles: ['ADMIN'] },
    ],
  },
  {
    section: 'SETUP',
    items: [
      { key: '/suppliers', icon: <ShopOutlined />, label: 'Suppliers', roles: ['ADMIN'] },
      { key: '/vehicles', icon: <CarOutlined />, label: 'Vehicles', roles: ['ADMIN'] },
      { key: '/routes', icon: <GlobalOutlined />, label: 'Routes', roles: ['ADMIN'] },
      { key: '/users', icon: <UserOutlined />, label: 'Team', roles: ['ADMIN'] },
      { key: '/masters', icon: <TagsOutlined />, label: 'Product Masters', roles: ['ADMIN'] },
      { key: '/import', icon: <UploadOutlined />, label: 'Data Import', roles: ['ADMIN'] },
      { key: '/settings/company', icon: <SettingOutlined />, label: 'Company Settings', roles: ['ADMIN'] },
    ],
  },
];

const BREADCRUMBS: Record<string, string[]> = {
  '/dashboard': ['Dashboard'],
  '/products': ['Catalog', 'Products'],
  '/orders': ['Operations', 'Orders'],
  '/customers': ['CRM', 'Customers'],
  '/routes': ['Setup', 'Routes'],
  '/users': ['Setup', 'Team'],
  '/payments': ['Finance', 'Payments'],
  '/expenses': ['Finance', 'Expenses'],
  '/customer-outstanding': ['Finance', 'Customer Outstanding'],
  '/supplier-payments': ['Finance', 'Supplier Payments'],
  '/reports': ['Finance', 'Reports'],
  '/masters': ['Setup', 'Product Masters'],
  '/invoice/approver': ['Operations', 'Approve Orders'],
  '/purchases': ['Operations', 'Purchases'],
  '/purchases/new': ['Operations', 'Purchases', 'New Entry'],
  '/warehouse/picklist': ['Operations', 'Route Pick List'],
  '/goods-return': ['Operations', 'Goods Return & Damage'],
  '/day-closure': ['Finance', 'Day Counter'],
  '/gate-pass': ['Field Ops', 'Gate Pass'],
  '/field-monitor': ['Field Ops', 'Field Monitor'],
  '/vehicles': ['Setup', 'Vehicles'],
  '/reports/aging': ['Finance', 'Reports', 'Aging Report'],
  '/reports/sales': ['Finance', 'Reports', 'Sales Analysis'],
  '/reports/ledger': ['Finance', 'Reports', 'Ledger'],
  '/reports/targets': ['Finance', 'Reports', 'Targets'],
  '/suppliers': ['Setup', 'Suppliers'],
  '/import': ['Setup', 'Data Import'],
  '/settings/company': ['Settings', 'Company Profile'],
};

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isDesktop = !!screens.lg;

  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [pwdForm] = Form.useForm();
  const [changePassword, { isLoading: changingPwd }] = useChangePasswordMutation();

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const role = user.role || 'GUEST';
  const roleCfg = ROLE_CONFIG[role] || { label: role, color: '#6b7280' };
  const sideW = collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_W;

  const menuItems = NAV_SECTIONS.flatMap(section =>
    section.items
      .filter(item => !item.roles || item.roles.includes(role))
      .map(item => ({
        key: item.key,
        icon: item.icon,
        label: <Link to={item.key}>{item.label}</Link>,
      }))
  );

  const renderNavExpanded = (onLinkClick?: () => void) =>
    NAV_SECTIONS.map(section => {
      const filtered = section.items.filter(item => !item.roles || item.roles.includes(role));
      if (filtered.length === 0) return null;
      return (
        <div key={section.section} style={{ marginBottom: 4 }}>
          <div style={{
            padding: '10px 24px 6px',
            fontSize: 10, fontWeight: 700,
            color: colors.sidebarMuted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}>
            {section.section}
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            items={filtered.map(item => ({
              key: item.key,
              icon: item.icon,
              label: <Link to={item.key} onClick={onLinkClick}>{item.label}</Link>,
            }))}
            style={{ background: 'transparent', border: 'none', padding: '0 10px' }}
          />
        </div>
      );
    });

  const handleLogout = () => { localStorage.clear(); navigate('/login'); };

  const handleChangePwd = async (values: any) => {
    if (values.newPassword !== values.confirmPassword) {
      pwdForm.setFields([{ name: 'confirmPassword', errors: ['Passwords do not match'] }]);
      return;
    }
    try {
      await changePassword({ oldPassword: values.oldPassword, newPassword: values.newPassword }).unwrap();
      message.success('Password changed successfully');
      setChangePwdOpen(false);
      pwdForm.resetFields();
    } catch (err: any) {
      const msg = err?.data?.message || 'Failed to change password';
      if (msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('wrong')) {
        pwdForm.setFields([{ name: 'oldPassword', errors: ['Current password is incorrect'] }]);
      } else {
        message.error(msg);
      }
    }
  };

  const userDropdown = [
    {
      key: 'profile',
      label: (
        <div style={{ padding: '8px 4px', minWidth: 200 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1d2e' }}>{user.fullName}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{user.email || user.phone}</div>
          <div style={{ marginTop: 8 }}>
            <span style={{
              background: roleCfg.color + '18', color: roleCfg.color,
              fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700,
            }}>
              {roleCfg.label}
            </span>
          </div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' as const },
    { key: 'change-password', label: 'Change Password', icon: <LockOutlined />, onClick: () => setChangePwdOpen(true) },
    { type: 'divider' as const },
    { key: 'logout', label: 'Sign Out', icon: <LogoutOutlined />, onClick: handleLogout, danger: true },
  ];

  const breadcrumbs = BREADCRUMBS[location.pathname] || [];

  const sidebarUserStrip = (showText: boolean) => (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: 64,
      padding: '0 18px',
      borderTop: `1px solid ${colors.sidebarBorder}`,
      background: 'rgba(0,0,0,0.12)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <Avatar size={34} style={{ background: roleCfg.color, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
        {user.fullName?.[0]}
      </Avatar>
      {showText && (
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.fullName}
          </div>
          <div style={{ fontSize: 11, color: colors.sidebarMuted }}>{roleCfg.label}</div>
        </div>
      )}
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* ── Desktop Sidebar ── */}
      {isDesktop && (
        <Sider
          collapsed={collapsed}
          width={SIDEBAR_W}
          collapsedWidth={SIDEBAR_COLLAPSED_W}
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
          {/* Logo */}
          <div style={{
            height: HEADER_H,
            display: 'flex',
            alignItems: 'center',
            padding: collapsed ? '0 18px' : '0 22px',
            borderBottom: `1px solid ${colors.sidebarBorder}`,
            gap: 10,
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, #059669, #047857)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(5,150,105,0.4)',
            }}>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 15 }}>D</span>
            </div>
            {!collapsed && (
              <div style={{ overflow: 'hidden' }}>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, lineHeight: 1.2, whiteSpace: 'nowrap' }}>DistroIQ</div>
                <div style={{ color: colors.sidebarMuted, fontSize: 10, letterSpacing: 0.5, fontWeight: 500 }}>Distribution Platform</div>
              </div>
            )}
          </div>

          {/* Nav */}
          <div style={{ overflowY: 'auto', height: `calc(100vh - ${HEADER_H}px - 64px)`, padding: '12px 0' }}>
            {!collapsed
              ? renderNavExpanded()
              : (
                <Menu
                  theme="dark"
                  mode="inline"
                  selectedKeys={[location.pathname]}
                  items={menuItems}
                  style={{ background: 'transparent', border: 'none', padding: '0 10px' }}
                />
              )
            }
          </div>

          {sidebarUserStrip(!collapsed)}
        </Sider>
      )}

      {/* ── Mobile / Tablet Nav Drawer ── */}
      <Drawer
        open={!isDesktop && mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        placement="left"
        width={SIDEBAR_W}
        title={null}
        closable={false}
        styles={{ body: { padding: 0, background: colors.sidebar, display: 'flex', flexDirection: 'column', height: '100%' } }}
      >
        {/* Logo row */}
        <div style={{
          height: HEADER_H,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 22px',
          borderBottom: `1px solid ${colors.sidebarBorder}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #059669, #047857)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(5,150,105,0.4)',
            }}>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 15 }}>D</span>
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>DistroIQ</div>
              <div style={{ color: colors.sidebarMuted, fontSize: 10, fontWeight: 500 }}>Distribution Platform</div>
            </div>
          </div>
          <div
            onClick={() => setMobileNavOpen(false)}
            style={{ cursor: 'pointer', color: colors.sidebarMuted, fontSize: 20, lineHeight: 1, padding: 4 }}
          >
            ✕
          </div>
        </div>

        {/* Nav sections */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 0' }}>
          {renderNavExpanded(() => setMobileNavOpen(false))}
        </div>

        {/* User strip */}
        <div style={{
          height: 64, padding: '0 18px',
          borderTop: `1px solid ${colors.sidebarBorder}`,
          background: 'rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <Avatar size={34} style={{ background: roleCfg.color, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
            {user.fullName?.[0]}
          </Avatar>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.fullName}
            </div>
            <div style={{ fontSize: 11, color: colors.sidebarMuted }}>{roleCfg.label}</div>
          </div>
        </div>
      </Drawer>

      {/* ── Main content area ── */}
      <Layout style={{
        marginLeft: isDesktop ? sideW : 0,
        transition: 'margin-left 0.25s cubic-bezier(0.4,0,0.2,1)',
        minHeight: '100vh',
      }}>
        {/* ── Header ── */}
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
          gap: 12,
        }}>
          {/* Left: toggle + breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
            <Tooltip title={isDesktop ? (collapsed ? 'Expand sidebar' : 'Collapse sidebar') : 'Menu'}>
              <div
                onClick={() => isDesktop ? setCollapsed(!collapsed) : setMobileNavOpen(true)}
                style={{
                  cursor: 'pointer', width: 34, height: 34,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 8, color: '#64748b', fontSize: 16,
                  transition: 'all 0.2s', flexShrink: 0,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {isDesktop ? (collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />) : <MenuUnfoldOutlined />}
              </div>
            </Tooltip>

            {isDesktop && breadcrumbs.length > 0 && (
              <Breadcrumb
                items={breadcrumbs.map((crumb, i) => ({
                  title: i === breadcrumbs.length - 1
                    ? <span style={{ color: '#1e293b', fontWeight: 600 }}>{crumb}</span>
                    : <span style={{ color: '#94a3b8' }}>{crumb}</span>,
                }))}
                separator={<span style={{ color: '#cbd5e1', margin: '0 2px' }}>/</span>}
              />
            )}

            {!isDesktop && breadcrumbs.length > 0 && (
              <span style={{ color: '#1e293b', fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {breadcrumbs[breadcrumbs.length - 1]}
              </span>
            )}
          </div>

          {/* Center: Search (desktop only) */}
          {isDesktop && (
            <div style={{ flex: '0 0 320px' }}>
              <Input
                prefix={<SearchOutlined style={{ color: '#94a3b8', fontSize: 14 }} />}
                placeholder="Search orders, customers, products..."
                style={{
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #edf0f4',
                  fontSize: 13,
                  height: 36,
                }}
                styles={{ input: { background: '#f8fafc' } }}
              />
            </div>
          )}

          {/* Right: actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {isDesktop && (
              <>
                <Tooltip title="Help & Support">
                  <div style={{
                    cursor: 'pointer', width: 34, height: 34,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 8, color: '#94a3b8', fontSize: 16,
                    transition: 'all 0.2s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; (e.currentTarget as HTMLElement).style.color = '#64748b'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
                  >
                    <QuestionCircleOutlined />
                  </div>
                </Tooltip>

                <Tooltip title="Notifications">
                  <Badge count={3} size="small" offset={[-4, 4]}>
                    <div style={{
                      cursor: 'pointer', width: 34, height: 34,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 8, color: '#64748b', fontSize: 16,
                      transition: 'all 0.2s',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <BellOutlined />
                    </div>
                  </Badge>
                </Tooltip>

                <div style={{ width: 1, height: 28, background: '#edf0f4', margin: '0 4px' }} />
              </>
            )}

            <Dropdown menu={{ items: userDropdown }} placement="bottomRight" trigger={['click']}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                cursor: 'pointer', padding: '4px 8px 4px 4px',
                borderRadius: 8,
                transition: 'all 0.2s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <Avatar size={28} style={{ background: roleCfg.color, fontWeight: 700, fontSize: 12 }}>
                  {user.fullName?.[0]}
                </Avatar>
                {isDesktop && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', lineHeight: 1.2 }}>
                      {user.fullName?.split(' ')[0]}
                    </div>
                  </div>
                )}
              </div>
            </Dropdown>
          </div>
        </Header>

        {/* ── Page Content ── */}
        <Content style={{
          padding: isDesktop ? '24px 28px' : '16px',
          minHeight: `calc(100vh - ${HEADER_H}px)`,
          background: colors.pageBg,
        }}>
          <div className="page-enter">
            {children}
          </div>
        </Content>
      </Layout>

      {/* Change Password Modal */}
      <Modal
        title={<span style={{ fontWeight: 700 }}>Change Password</span>}
        open={changePwdOpen}
        onCancel={() => { setChangePwdOpen(false); pwdForm.resetFields(); }}
        footer={null}
        width={400}
        destroyOnClose
      >
        <Form form={pwdForm} layout="vertical" onFinish={handleChangePwd} style={{ marginTop: 16 }}>
          <Form.Item
            name="oldPassword"
            label="Current Password"
            rules={[{ required: true, message: 'Enter your current password' }]}
          >
            <Input.Password prefix={<LockOutlined style={{ color: '#94a3b8' }} />} placeholder="Current password" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="New Password"
            rules={[
              { required: true, message: 'Enter a new password' },
              { min: 8, message: 'Must be at least 8 characters' },
            ]}
          >
            <Input.Password prefix={<LockOutlined style={{ color: '#94a3b8' }} />} placeholder="New password (min 8 chars)" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Confirm New Password"
            rules={[{ required: true, message: 'Confirm your new password' }]}
          >
            <Input.Password prefix={<LockOutlined style={{ color: '#94a3b8' }} />} placeholder="Repeat new password" />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={() => { setChangePwdOpen(false); pwdForm.resetFields(); }}
              style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#374151' }}>
              Cancel
            </button>
            <button type="submit" disabled={changingPwd}
              style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: changingPwd ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: changingPwd ? 0.7 : 1 }}>
              {changingPwd ? 'Saving…' : 'Save Password'}
            </button>
          </div>
        </Form>
      </Modal>
    </Layout>
  );
};

export default MainLayout;
