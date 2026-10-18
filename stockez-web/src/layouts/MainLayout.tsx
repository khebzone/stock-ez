import React, { useState, useEffect } from 'react';
import truckLogo from '../assets/logo-truck-light.png';
import { Layout, Menu, Avatar, Dropdown, Badge, Breadcrumb, Input, Tooltip, Modal, Form, message, Grid, Drawer } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined, ShoppingOutlined, UserOutlined, LogoutOutlined,
  GlobalOutlined, TeamOutlined, WalletOutlined, BarChartOutlined,
  FileTextOutlined, BellOutlined, SettingOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, QuestionCircleOutlined, TagsOutlined,
  InboxOutlined, AlertOutlined, LineChartOutlined, BookOutlined, TrophyOutlined,
  CalculatorOutlined, RollbackOutlined, CarOutlined, AuditOutlined, EyeOutlined,
  ShopOutlined, HddOutlined, LockOutlined, UploadOutlined, ClockCircleOutlined, ShoppingCartOutlined, DatabaseOutlined,
  BankOutlined, ProfileOutlined,
} from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import { useChangePasswordMutation } from '../store/api/userApi';
import { colors } from '../styles/tokens';
import { hasPermission, isAdmin } from '../utils/permissions';
import { hasPlan, type RequiredPlan } from '../utils/planGate';
import DailyKural from '../components/DailyKural';
import WelcomeGift from '../components/WelcomeGift';
import { useExportBranding } from '../utils/exportBranding';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

const { Header, Sider, Content } = Layout;

const SIDEBAR_W = 248;
const SIDEBAR_COLLAPSED_W = 68;
const HEADER_H = 56;

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: '#ef4444' },
  ADMIN: { label: 'Admin', color: '#4361ee' },
};

// permission: undefined = admin-only; permission: string = shown when user has that permission
// hideForAdmin: true = hidden from admin (non-admin only item)
// minPlan: feature requires this plan or higher (soft lock — still visible, upgrade overlay on click)
const NAV_SECTIONS = [
  {
    section: 'MAIN',
    items: [
      { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard', permission: undefined as string | undefined, minPlan: undefined as RequiredPlan | undefined, showToAll: true },
    ],
  },
  {
    section: 'ORDERS',
    items: [
      { key: '/orders', icon: <FileTextOutlined />, label: 'Orders', permission: 'ORDERS_VIEW', minPlan: undefined as RequiredPlan | undefined },
      { key: '/counter-sale', icon: <ShoppingCartOutlined />, label: 'Counter Sale', permission: 'COUNTER_SALE_VIEW', minPlan: undefined as RequiredPlan | undefined },
      { key: '/invoice/approver', icon: <AuditOutlined />, label: 'Approve Orders', permission: 'INVOICE_VIEW', minPlan: undefined as RequiredPlan | undefined },
    ],
  },
  {
    section: 'WAREHOUSE',
    items: [
      { key: '/warehouse/picklist', icon: <InboxOutlined />, label: 'Route Pick List', permission: 'PICKLIST_VIEW' as string | undefined, minPlan: 'PROFESSIONAL' as RequiredPlan | undefined, hideForAdmin: false },
      { key: '/warehouse/my-tasks', icon: <InboxOutlined />, label: 'My Tasks', permission: 'PICKLIST_VIEW', minPlan: 'PROFESSIONAL' as RequiredPlan | undefined, hideForAdmin: false },
      { key: '/warehouse/returns', icon: <RollbackOutlined />, label: 'Delivery Returns', permission: 'PICKLIST_VIEW' as string | undefined, minPlan: undefined, hideForAdmin: false },
    ],
  },
  {
    section: 'INVENTORY',
    items: [
      { key: '/purchases', icon: <InboxOutlined />, label: 'Purchases', permission: 'PURCHASES_VIEW', minPlan: undefined as RequiredPlan | undefined },
      { key: '/stock-batches', icon: <HddOutlined />, label: 'Stock Batches', permission: 'STOCK_VIEW', minPlan: undefined as RequiredPlan | undefined },
      { key: '/goods-return', icon: <RollbackOutlined />, label: 'Goods Return', permission: 'RETURNS_VIEW', minPlan: undefined as RequiredPlan | undefined },
      { key: '/stock-adjustments', icon: <AlertOutlined />, label: 'Stock Adjustment', permission: 'STOCK_ADJUSTMENT_VIEW' as string | undefined, minPlan: undefined as RequiredPlan | undefined },
      { key: '/closing-stock', icon: <DatabaseOutlined />, label: 'Closing Stock', permission: 'CLOSING_STOCK_VIEW' as string | undefined, minPlan: 'PROFESSIONAL' as RequiredPlan | undefined },
      { key: '/gate-pass', icon: <EyeOutlined />, label: 'Gate Pass', permission: 'GATE_PASS_VIEW', minPlan: 'PROFESSIONAL' as RequiredPlan | undefined },
    ],
  },
  {
    section: 'CRM',
    items: [
      { key: '/customers', icon: <TeamOutlined />, label: 'Customers', permission: 'CUSTOMERS_VIEW', minPlan: undefined as RequiredPlan | undefined },
      { key: '/suppliers', icon: <ShopOutlined />, label: 'Suppliers', permission: 'SUPPLIERS_VIEW', minPlan: undefined as RequiredPlan | undefined },
      { key: '/products', icon: <ShoppingOutlined />, label: 'Products', permission: 'PRODUCTS_VIEW', minPlan: undefined as RequiredPlan | undefined },
    ],
  },
  {
    section: 'FINANCE',
    items: [
      { key: '/payments', icon: <WalletOutlined />, label: 'Collections', permission: 'PAYMENTS_VIEW', minPlan: undefined as RequiredPlan | undefined },
      { key: '/customer-outstanding', icon: <WalletOutlined />, label: 'Customer Outstanding', permission: 'CUSTOMER_OUTSTANDING_VIEW', minPlan: undefined as RequiredPlan | undefined },
      { key: '/refunds-claims', icon: <RollbackOutlined />, label: 'Refunds & Claims', permission: 'PAYMENTS_VIEW', minPlan: undefined as RequiredPlan | undefined },
      { key: '/supplier-payments', icon: <WalletOutlined />, label: 'Supplier Payments', permission: 'SUPPLIER_PAYMENTS_VIEW', minPlan: undefined as RequiredPlan | undefined },
      { key: '/bank-clearance', icon: <BankOutlined />, label: 'Bank Clearance', permission: 'BANK_CLEARANCE_VIEW', minPlan: undefined as RequiredPlan | undefined },
      { key: '/expenses', icon: <FileTextOutlined />, label: 'Expenses', permission: 'EXPENSES_VIEW', minPlan: undefined as RequiredPlan | undefined },
      { key: '/day-closure', icon: <CalculatorOutlined />, label: 'Day Counter', permission: 'DAY_CLOSURE_VIEW', minPlan: undefined as RequiredPlan | undefined },
    ],
  },
  {
    section: 'REPORTS',
    items: [
      { key: '/reports', icon: <BarChartOutlined />, label: 'Reports Hub', permission: 'REPORTS_VIEW', minPlan: 'PROFESSIONAL' as RequiredPlan | undefined },
      { key: '/reports/daily', icon: <FileTextOutlined />, label: 'Daily Report', permission: 'REPORTS_VIEW', minPlan: 'PROFESSIONAL' as RequiredPlan | undefined },
      { key: '/reports/aging', icon: <AlertOutlined />, label: 'Aging Report', permission: 'REPORTS_AGING_VIEW' as string | undefined, minPlan: 'PROFESSIONAL' as RequiredPlan | undefined },
      { key: '/reports/sales', icon: <LineChartOutlined />, label: 'Sales Analysis', permission: 'REPORTS_SALES_VIEW' as string | undefined, minPlan: 'PROFESSIONAL' as RequiredPlan | undefined },
      { key: '/reports/customer-sales', icon: <LineChartOutlined />, label: 'Customer Sales', permission: 'REPORTS_SALES_VIEW' as string | undefined, minPlan: 'PROFESSIONAL' as RequiredPlan | undefined },
      { key: '/reports/customer-item', icon: <ProfileOutlined />, label: 'Customer Item Report', permission: 'REPORTS_SALES_VIEW' as string | undefined, minPlan: 'PROFESSIONAL' as RequiredPlan | undefined },
      { key: '/reports/route-item', icon: <ProfileOutlined />, label: 'Route Item Report', permission: 'REPORTS_SALES_VIEW' as string | undefined, minPlan: 'PROFESSIONAL' as RequiredPlan | undefined },
      { key: '/reports/item-history', icon: <ProfileOutlined />, label: 'Item History', permission: 'REPORTS_SALES_VIEW' as string | undefined, minPlan: 'PROFESSIONAL' as RequiredPlan | undefined },
      { key: '/reports/route-outstanding', icon: <AlertOutlined />, label: 'Route Outstanding', permission: 'REPORTS_AGING_VIEW' as string | undefined, minPlan: 'PROFESSIONAL' as RequiredPlan | undefined },
      { key: '/reports/ledger', icon: <BookOutlined />, label: 'Ledger', permission: 'REPORTS_LEDGER_VIEW' as string | undefined, minPlan: 'PROFESSIONAL' as RequiredPlan | undefined },
      { key: '/reports/targets', icon: <TrophyOutlined />, label: 'Targets', permission: 'INCENTIVES_VIEW' as string | undefined, minPlan: 'PROFESSIONAL' as RequiredPlan | undefined },
      { key: '/reports/audit', icon: <AuditOutlined />, label: 'Audit Report', permission: undefined, minPlan: 'PROFESSIONAL' as RequiredPlan | undefined },
      { key: '/reports/dead-stock', icon: <InboxOutlined />, label: 'Dead Stock', permission: 'REPORTS_DEADSTOCK_VIEW' as string | undefined, minPlan: 'PROFESSIONAL' as RequiredPlan | undefined },
    ],
  },
  {
    section: 'INCENTIVES',
    items: [
      { key: '/incentives/targets', icon: <TrophyOutlined />, label: 'Brand Targets', permission: 'INCENTIVES_VIEW', minPlan: 'PREMIUM' as RequiredPlan | undefined },
      { key: '/incentives/collection/targets', icon: <WalletOutlined />, label: 'Collection Targets', permission: 'INCENTIVES_VIEW', minPlan: 'PREMIUM' as RequiredPlan | undefined },
      { key: '/incentives/slabs', icon: <LineChartOutlined />, label: 'Incentive Slabs', permission: 'INCENTIVES_VIEW', minPlan: 'PREMIUM' as RequiredPlan | undefined },
      { key: '/incentives/credits', icon: <WalletOutlined />, label: 'Incentive Credits', permission: 'INCENTIVES_VIEW', minPlan: 'PREMIUM' as RequiredPlan | undefined },
    ],
  },
  {
    section: 'FIELD OPS',
    items: [
      { key: '/attendance', icon: <ClockCircleOutlined />, label: 'Attendance', permission: 'ATTENDANCE_VIEW', minPlan: 'PROFESSIONAL' as RequiredPlan | undefined },
      { key: '/field-monitor', icon: <GlobalOutlined />, label: 'Field Monitor', permission: 'FIELD_MONITOR_VIEW', minPlan: 'PROFESSIONAL' as RequiredPlan | undefined },
    ],
  },
  {
    section: 'SETUP',
    items: [
      { key: '/vehicles', icon: <CarOutlined />, label: 'Vehicles', permission: 'VEHICLES_VIEW', minPlan: 'PROFESSIONAL' as RequiredPlan | undefined },
      { key: '/routes', icon: <GlobalOutlined />, label: 'Routes', permission: 'ROUTES_VIEW' as string | undefined, minPlan: 'PROFESSIONAL' as RequiredPlan | undefined },
      { key: '/users', icon: <UserOutlined />, label: 'Team', permission: undefined, minPlan: undefined as RequiredPlan | undefined },
      { key: '/roles', icon: <SettingOutlined />, label: 'Roles', permission: undefined, minPlan: 'PREMIUM' as RequiredPlan | undefined },
      { key: '/masters', icon: <TagsOutlined />, label: 'Product Masters', permission: 'MASTERS_MANAGE' as string | undefined, minPlan: undefined as RequiredPlan | undefined },
      { key: '/import', icon: <UploadOutlined />, label: 'Data Import', permission: 'IMPORT_VIEW', minPlan: undefined as RequiredPlan | undefined },
      { key: '/settings/company', icon: <SettingOutlined />, label: 'Company Settings', permission: undefined, minPlan: undefined as RequiredPlan | undefined },
    ],
  },
];

const SECTION_META: Record<string, { label: string; icon: React.ReactNode }> = {
  ORDERS:      { label: 'Orders',     icon: <FileTextOutlined /> },
  WAREHOUSE:   { label: 'Warehouse',  icon: <DatabaseOutlined /> },
  INVENTORY:   { label: 'Inventory',  icon: <InboxOutlined /> },
  CRM:         { label: 'CRM',        icon: <TeamOutlined /> },
  FINANCE:     { label: 'Finance',    icon: <WalletOutlined /> },
  REPORTS:     { label: 'Reports',    icon: <BarChartOutlined /> },
  INCENTIVES:  { label: 'Incentives', icon: <TrophyOutlined /> },
  'FIELD OPS': { label: 'Field Ops',  icon: <GlobalOutlined /> },
  SETUP:       { label: 'Setup',      icon: <SettingOutlined /> },
};

const BREADCRUMBS: Record<string, string[]> = {
  '/dashboard': ['Dashboard'],
  '/products': ['Catalog', 'Products'],
  '/orders': ['Operations', 'Orders'],
  '/counter-sale': ['Operations', 'Counter Sale'],
  '/customers': ['CRM', 'Customers'],
  '/routes': ['Setup', 'Routes'],
  '/users': ['Setup', 'Team'],
  '/payments': ['Finance', 'Collections'],
  '/expenses': ['Finance', 'Expenses'],
  '/customer-outstanding': ['Finance', 'Customer Outstanding'],
  '/refunds-claims': ['Finance', 'Refunds & Claims'],
  '/supplier-payments': ['Finance', 'Supplier Payments'],
  '/bank-clearance': ['Finance', 'Bank Clearance'],
  '/reports': ['Finance', 'Reports'],
  '/masters': ['Setup', 'Product Masters'],
  '/invoice/approver': ['Operations', 'Approve Orders'],
  '/purchases': ['Operations', 'Purchases'],
  '/purchases/new': ['Operations', 'Purchases', 'New Entry'],
  '/warehouse/picklist': ['Operations', 'Route Pick List'],
  '/warehouse/my-tasks': ['Operations', 'My Tasks'],
  '/warehouse/returns':  ['Warehouse', 'Delivery Returns'],
  '/goods-return': ['Operations', 'Goods Return & Damage'],
  '/stock-adjustments': ['Inventory', 'Stock Adjustment'],
  '/day-closure': ['Finance', 'Day Counter'],
  '/attendance': ['Field Ops', 'Attendance'],
  '/gate-pass': ['Field Ops', 'Gate Pass'],
  '/field-monitor': ['Field Ops', 'Field Monitor'],
  '/vehicles': ['Setup', 'Vehicles'],
  '/reports/aging': ['Finance', 'Reports', 'Aging Report'],
  '/reports/sales': ['Finance', 'Reports', 'Sales Analysis'],
  '/reports/customer-sales': ['Finance', 'Reports', 'Customer Sales'],
  '/reports/customer-item': ['Finance', 'Reports', 'Customer Item Report'],
  '/reports/route-item': ['Finance', 'Reports', 'Route Item Report'],
  '/reports/item-history': ['Finance', 'Reports', 'Item History'],
  '/reports/route-outstanding': ['Finance', 'Reports', 'Route Outstanding'],
  '/reports/ledger': ['Finance', 'Reports', 'Ledger'],
  '/reports/targets': ['Finance', 'Reports', 'Targets'],
  '/reports/audit': ['Reports', 'Audit Report'],
  '/reports/dead-stock': ['Finance', 'Reports', 'Dead Stock'],
  '/closing-stock': ['Inventory', 'Closing Stock'],
  '/incentives/targets': ['Incentives', 'Brand Targets'],
  '/incentives/collection/targets': ['Incentives', 'Collection Targets'],
  '/incentives/slabs': ['Incentives', 'Incentive Slabs'],
  '/incentives/credits': ['Incentives', 'Incentive Credits'],
  '/suppliers': ['Setup', 'Suppliers'],
  '/import': ['Setup', 'Data Import'],
  '/settings/company': ['Settings', 'Company Profile'],
};

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useExportBranding();
  useRealtimeSync();
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
  const roleName = user.roleName || role;
  const roleCfg = ROLE_CONFIG[role] || { label: roleName, color: '#4361ee' };
  const sideW = collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_W;

  const isItemVisible = (item: { key?: string; permission?: string; hideForAdmin?: boolean; showToAll?: boolean }) => {
    if (item.showToAll) return true;
    if (item.hideForAdmin && isAdmin()) return false;
    // Attendance is reachable by staff who can only self check-in, not just those who can view everyone's report
    if (item.key === '/attendance') return hasPermission('ATTENDANCE_VIEW') || hasPermission('ATTENDANCE_CHECKIN');
    return item.permission === undefined ? isAdmin() : hasPermission(item.permission);
  };

  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    const active = NAV_SECTIONS.find(s =>
      s.items.some(i => location.pathname === i.key || location.pathname.startsWith(i.key + '/'))
    )?.section;
    return active && active !== 'MAIN' ? [active] : [];
  });

  useEffect(() => {
    const active = NAV_SECTIONS.find(s =>
      s.items.some(i => location.pathname === i.key || location.pathname.startsWith(i.key + '/'))
    )?.section;
    if (active && active !== 'MAIN') {
      setOpenKeys(prev => prev.includes(active) ? prev : [...prev, active]);
    }
  }, [location.pathname]);

  const buildMenuItems = (onLinkClick?: () => void): MenuProps['items'] => {
    const result: NonNullable<MenuProps['items']> = [];
    for (const section of NAV_SECTIONS) {
      const filtered = section.items.filter(isItemVisible);
      if (filtered.length === 0) continue;
      const children = filtered.map(item => {
        const locked = !!item.minPlan && !hasPlan(item.minPlan);
        return {
          key: item.key,
          icon: item.icon,
          label: (
            <Link to={item.key} onClick={onLinkClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{item.label}</span>
              {locked && <LockOutlined style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 6, flexShrink: 0 }} />}
            </Link>
          ),
        };
      });
      if (section.section === 'MAIN') {
        result.push(...children);
      } else {
        const meta = SECTION_META[section.section];
        result.push({ key: section.section, icon: meta?.icon, label: meta?.label, children });
      }
    }
    return result;
  };

  const handleLogout = () => { ['token','refreshToken','tenantId','userId','user'].forEach(k => localStorage.removeItem(k)); navigate('/login'); };

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
            padding: collapsed ? 0 : '0 22px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderBottom: `1px solid ${colors.sidebarBorder}`,
            gap: 11,
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            <img src={truckLogo} alt="StockEz" style={{ height: 40, width: 'auto', flexShrink: 0, objectFit: 'contain', display: 'block' }} />
            {!collapsed && (
              <div style={{ overflow: 'hidden' }}>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, lineHeight: 1.2, whiteSpace: 'nowrap' }}>StockEz</div>
                <div style={{ color: colors.sidebarMuted, fontSize: 10, letterSpacing: 0.5, fontWeight: 500 }}>Distribution Platform</div>
              </div>
            )}
          </div>

          {/* Nav */}
          <div style={{ overflowY: 'auto', height: `calc(100vh - ${HEADER_H}px - 64px)` }}>
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[location.pathname]}
              openKeys={collapsed ? [] : openKeys}
              onOpenChange={keys => setOpenKeys(keys as string[])}
              inlineCollapsed={collapsed}
              items={buildMenuItems()}
              style={{ background: 'transparent', border: 'none' }}
            />
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <img src={truckLogo} alt="StockEz" style={{ height: 40, width: 'auto', objectFit: 'contain', display: 'block' }} />
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>StockEz</div>
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
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            openKeys={openKeys}
            onOpenChange={keys => setOpenKeys(keys as string[])}
            items={buildMenuItems(() => setMobileNavOpen(false))}
            style={{ background: 'transparent', border: 'none' }}
          />
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

                <NotificationBell />

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

      <WelcomeGift />
      <DailyKural />

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
