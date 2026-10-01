import React, { useState } from 'react';
import {
  Card, Table, Button, Drawer, Form, Input, Select, DatePicker,
  message, Space, Row, Col, Divider, Tooltip, Dropdown,
  InputNumber, Modal,
} from 'antd';
import {
  PlusOutlined, EditOutlined, StopOutlined, CheckCircleOutlined,
  CloudServerOutlined, ClockCircleOutlined, CheckOutlined,
  ExclamationCircleOutlined, EyeOutlined, MoreOutlined,
  DollarCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetTenantsQuery,
  useGetTenantStatsQuery,
  useCreateTenantMutation,
  useUpdateTenantMutation,
  useSuspendTenantMutation,
  useActivateTenantMutation,
  useSetReadOnlyMutation,
  useExtendTrialMutation,
} from '../../store/api/tenantApi';

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  ACTIVE:    { color: '#059669', bg: '#f0fdf4', label: 'Active' },
  TRIAL:     { color: '#2563eb', bg: '#eff6ff', label: 'Trial' },
  READ_ONLY: { color: '#ea580c', bg: '#fff7ed', label: 'Read-Only' },
  SUSPENDED: { color: '#dc2626', bg: '#fef2f2', label: 'Suspended' },
  INACTIVE:  { color: '#6b7280', bg: '#f8fafc', label: 'Inactive' },
};

const PLAN_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  TRIAL:        { color: '#2563eb', bg: '#eff6ff', label: 'Trial' },
  ESSENTIALS:   { color: '#475569', bg: '#f1f5f9', label: 'Essentials' },
  PROFESSIONAL: { color: '#7c3aed', bg: '#faf5ff', label: 'Professional' },
  PREMIUM:      { color: '#b45309', bg: '#fffbeb', label: 'Premium' },
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { color: '#6b7280', bg: '#f8fafc', label: status };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.color}30`,
      borderRadius: 4, padding: '2px 8px',
      fontSize: 11, fontWeight: 700,
    }}>
      {cfg.label}
    </span>
  );
};

const PlanBadge: React.FC<{ plan: string; billingCycle?: string }> = ({ plan, billingCycle }) => {
  const cfg = PLAN_CONFIG[plan] || PLAN_CONFIG.TRIAL;
  return (
    <div>
      <span style={{
        background: cfg.bg, color: cfg.color,
        border: `1px solid ${cfg.color}30`,
        borderRadius: 4, padding: '2px 8px',
        fontSize: 11, fontWeight: 700,
      }}>
        {cfg.label}
      </span>
      {billingCycle && plan !== 'TRIAL' && (
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
          {billingCycle === 'ANNUAL' ? 'Annual' : 'Monthly'}
        </div>
      )}
    </div>
  );
};

const ExpiryCell: React.FC<{ planEndDate?: string; daysUntilExpiry?: number }> = ({ planEndDate, daysUntilExpiry }) => {
  if (!planEndDate) return <span style={{ color: '#94a3b8' }}>—</span>;
  const days = daysUntilExpiry ?? 0;
  const color = days < 0 ? '#dc2626' : days <= 7 ? '#dc2626' : days <= 30 ? '#d97706' : '#059669';
  return (
    <div>
      <div style={{ fontSize: 12, color: '#1e293b' }}>{dayjs(planEndDate).format('DD MMM YYYY')}</div>
      <div style={{ fontSize: 11, color, fontWeight: 600 }}>
        {days < 0 ? `Expired ${Math.abs(days)}d ago` : days === 0 ? 'Expires today' : `${days}d left`}
      </div>
    </div>
  );
};

const TenantsPage: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [extendModal, setExtendModal] = useState<{ open: boolean; tenant: any }>({ open: false, tenant: null });
  const [extendDays, setExtendDays] = useState(7);
  const [form] = Form.useForm();

  const { data: tenantsData, isLoading } = useGetTenantsQuery();
  const { data: statsData } = useGetTenantStatsQuery();
  const [createTenant, { isLoading: creating }] = useCreateTenantMutation();
  const [updateTenant, { isLoading: updating }] = useUpdateTenantMutation();
  const [suspendTenant] = useSuspendTenantMutation();
  const [activateTenant] = useActivateTenantMutation();
  const [setReadOnly] = useSetReadOnlyMutation();
  const [extendTrial, { isLoading: extending }] = useExtendTrialMutation();

  const tenants: any[] = tenantsData?.data?.content ?? [];
  const stats = statsData?.data;

  const filtered = tenants.filter(t => {
    const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || t.name?.toLowerCase().includes(q) || t.ownerName?.toLowerCase().includes(q)
      || t.phone?.includes(q) || t.email?.toLowerCase().includes(q) || t.subdomain?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const openCreate = () => {
    setEditingTenant(null);
    form.resetFields();
    form.setFieldsValue({ status: 'TRIAL', plan: 'TRIAL', trialDays: 7, billingCycle: 'MONTHLY' });
    setDrawerOpen(true);
  };

  const openEdit = (tenant: any) => {
    setEditingTenant(tenant);
    form.setFieldsValue({
      name: tenant.name,
      ownerName: tenant.ownerName,
      phone: tenant.phone,
      email: tenant.email,
      gstin: tenant.gstin,
      address: tenant.address,
      city: tenant.city,
      state: tenant.state,
      status: tenant.status,
      plan: tenant.plan || 'TRIAL',
      billingCycle: tenant.billingCycle || 'MONTHLY',
      planEndDate: tenant.planEndDate ? dayjs(tenant.planEndDate) : null,
      maxUsers: tenant.maxUsers,
      notes: tenant.notes,
    });
    setDrawerOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      const payload = {
        ...values,
        planEndDate: values.planEndDate ? values.planEndDate.format('YYYY-MM-DD') : null,
      };
      if (editingTenant) {
        await updateTenant({ id: editingTenant.id, data: payload }).unwrap();
        message.success('Tenant updated');
      } else {
        await createTenant(payload).unwrap();
        message.success('Tenant created — admin account is ready');
      }
      setDrawerOpen(false);
      form.resetFields();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to save tenant');
    }
  };

  const handleAction = async (action: string, tenant: any) => {
    try {
      if (action === 'activate') {
        await activateTenant(tenant.id).unwrap();
        message.success(`${tenant.name} activated`);
      } else if (action === 'readonly') {
        await setReadOnly(tenant.id).unwrap();
        message.success(`${tenant.name} set to read-only`);
      } else if (action === 'suspend') {
        await suspendTenant(tenant.id).unwrap();
        message.success(`${tenant.name} suspended`);
      } else if (action === 'extend') {
        setExtendDays(7);
        setExtendModal({ open: true, tenant });
      }
    } catch (err: any) {
      message.error(err?.data?.message || 'Action failed');
    }
  };

  const handleExtendTrial = async () => {
    try {
      await extendTrial({ id: extendModal.tenant.id, days: extendDays }).unwrap();
      message.success(`Trial extended by ${extendDays} days`);
      setExtendModal({ open: false, tenant: null });
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to extend trial');
    }
  };

  const getActionItems = (t: any) => {
    const items = [];
    if (t.status !== 'ACTIVE') items.push({ key: 'activate', label: 'Mark Active', icon: <CheckOutlined style={{ color: '#059669' }} /> });
    if (t.status !== 'READ_ONLY') items.push({ key: 'readonly', label: 'Set Read-Only', icon: <EyeOutlined style={{ color: '#ea580c' }} /> });
    if (t.status === 'TRIAL') items.push({ key: 'extend', label: 'Extend Trial', icon: <ClockCircleOutlined style={{ color: '#2563eb' }} /> });
    if (t.status !== 'SUSPENDED') items.push({ key: 'suspend', label: 'Suspend', icon: <StopOutlined />, danger: true });
    return items.map(item => ({
      ...item,
      onClick: () => handleAction(item.key, t),
    }));
  };

  const statCards = [
    { label: 'Total Clients', value: stats?.total ?? 0, icon: <CloudServerOutlined />, color: '#4361ee' },
    { label: 'Active', value: stats?.active ?? 0, icon: <CheckCircleOutlined />, color: '#059669' },
    { label: 'On Trial', value: stats?.trial ?? 0, icon: <ClockCircleOutlined />, color: '#2563eb' },
    { label: 'Expiring (30d)', value: stats?.expiringSoon ?? 0, icon: <ExclamationCircleOutlined />, color: '#d97706' },
    { label: 'Read-Only', value: stats?.readOnly ?? 0, icon: <EyeOutlined />, color: '#ea580c' },
  ];

  const columns = [
    {
      title: 'Company',
      key: 'company',
      render: (_: any, t: any) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{t.name}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.subdomain}.stockez.com</div>
        </div>
      ),
    },
    {
      title: 'Owner',
      key: 'owner',
      render: (_: any, t: any) => (
        <div>
          <div style={{ fontSize: 13, color: '#1e293b' }}>{t.ownerName}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{t.phone}</div>
        </div>
      ),
    },
    {
      title: 'Plan',
      key: 'plan',
      render: (_: any, t: any) => <PlanBadge plan={t.plan || 'TRIAL'} billingCycle={t.billingCycle} />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <StatusBadge status={v} />,
    },
    {
      title: 'Expiry',
      key: 'expiry',
      render: (_: any, t: any) => (
        <ExpiryCell planEndDate={t.planEndDate} daysUntilExpiry={t.daysUntilExpiry} />
      ),
    },
    {
      title: 'Users',
      key: 'users',
      render: (_: any, t: any) => {
        const max = t.maxUsers;
        const cur = t.currentUserCount ?? 0;
        const atLimit = cur >= max && max < 999;
        return (
          <span style={{ fontSize: 12, color: atLimit ? '#dc2626' : '#64748b' }}>
            {max >= 999 ? `${cur} / ∞` : `${cur} / ${max}`}
          </span>
        );
      },
    },
    {
      title: 'Joined',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{dayjs(v).format('DD MMM YYYY')}</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: any, t: any) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(t)} />
          </Tooltip>
          <Dropdown menu={{ items: getActionItems(t) }} trigger={['click']} placement="bottomRight">
            <Button type="text" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ];

  const watchPlan = Form.useWatch('plan', form);

  return (
    <>
      {/* Stats Row */}
      <Row gutter={[14, 14]} style={{ marginBottom: 20 }}>
        {statCards.map(s => (
          <Col xs={12} sm={8} md={4} key={s.label}>
            <Card size="small" styles={{ body: { padding: '14px 16px' } }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: s.color + '14', color: s.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                }}>
                  {s.icon}
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.label}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
        <Col xs={24} sm={8} md={4}>
          <Card size="small" styles={{ body: { padding: '14px 16px' } }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8,
                background: '#05966914', color: '#059669',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
              }}>
                <DollarCircleOutlined />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', lineHeight: 1 }}>
                  ₹{(stats?.mrr ?? 0).toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>MRR / Month</div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Main table */}
      <Card
        size="small"
        title={<span style={{ fontWeight: 700 }}>Clients</span>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#059669', borderColor: '#059669' }}>
            New Client
          </Button>
        }
      >
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <Input.Search
            placeholder="Search name, owner, phone, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 150 }}
            options={[
              { value: 'ALL', label: 'All Status' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'TRIAL', label: 'Trial' },
              { value: 'READ_ONLY', label: 'Read-Only' },
              { value: 'SUSPENDED', label: 'Suspended' },
              { value: 'INACTIVE', label: 'Inactive' },
            ]}
          />
        </div>

        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} clients` }}
        />
      </Card>

      {/* Create / Edit Drawer */}
      <Drawer
        title={<span style={{ fontWeight: 700 }}>{editingTenant ? 'Edit Client' : 'New Client'}</span>}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); form.resetFields(); }}
        width={580}
        destroyOnClose
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setDrawerOpen(false); form.resetFields(); }}>Cancel</Button>
            <Button
              type="primary"
              loading={creating || updating}
              onClick={() => form.submit()}
              style={{ background: '#059669', borderColor: '#059669' }}
            >
              {editingTenant ? 'Save Changes' : 'Create Client'}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>

          {/* Company Info */}
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
            Company Info
          </div>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="name" label="Company Name *" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g. Sri Murugan Distributors" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="subdomain"
                label={editingTenant ? 'Subdomain' : 'Subdomain *'}
                rules={editingTenant ? [] : [
                  { required: true, message: 'Required' },
                  { pattern: /^[a-z0-9-]+$/, message: 'Lowercase letters, numbers, hyphens only' },
                ]}
                extra={!editingTenant ? 'Login URL: subdomain.stockez.com' : undefined}
              >
                <Input placeholder="e.g. murugan" disabled={!!editingTenant} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="ownerName" label="Owner Name *" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="Full name" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="phone" label="Phone *"
                rules={[{ required: true, message: 'Required' }, { pattern: /^[6-9]\d{9}$/, message: 'Valid 10-digit number' }]}>
                <Input placeholder="9876543210" maxLength={10} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="email" label="Email *"
                rules={[{ required: true, message: 'Required' }, { type: 'email', message: 'Valid email' }]}>
                <Input placeholder="owner@company.com" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="gstin" label="GSTIN">
                <Input placeholder="22AAAAA0000A1Z5" maxLength={15} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="city" label="City">
                <Input placeholder="Chennai" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="state" label="State">
                <Input placeholder="Tamil Nadu" />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '4px 0 16px' }} />

          {/* Admin Account — create only */}
          {!editingTenant && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                Admin Account
              </div>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="adminPhone" label="Login Phone *"
                    rules={[{ required: true, message: 'Required' }, { pattern: /^[6-9]\d{9}$/, message: 'Valid 10-digit number' }]}
                    extra="Phone number used to log in">
                    <Input placeholder="9876543210" maxLength={10} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="adminPassword" label="Initial Password *"
                    rules={[{ required: true, message: 'Required' }, { min: 6, message: 'Min 6 characters' }]}>
                    <Input.Password placeholder="Min 6 characters" />
                  </Form.Item>
                </Col>
              </Row>
              <Divider style={{ margin: '4px 0 16px' }} />
            </>
          )}

          {/* Subscription */}
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
            Subscription
          </div>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="plan" label="Plan *" rules={[{ required: true, message: 'Required' }]}>
                <Select
                  options={[
                    { value: 'TRIAL',        label: 'Trial' },
                    { value: 'ESSENTIALS',   label: 'Essentials  —  ₹1,500/mo' },
                    { value: 'PROFESSIONAL', label: 'Professional  —  ₹2,500/mo' },
                    { value: 'PREMIUM',      label: 'Premium  —  ₹4,000/mo' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="maxUsers" label="User Limit *"
                rules={[{ required: true, message: 'Required' }, { type: 'number', min: 1, message: 'Min 1' }]}
                extra="Max staff users (excludes admin account)">
                <InputNumber min={1} max={9999} style={{ width: '100%' }} placeholder="e.g. 5" />
              </Form.Item>
            </Col>
            {editingTenant && (
              <Col xs={24} sm={12}>
                <Form.Item name="status" label="Status *" rules={[{ required: true, message: 'Required' }]}>
                  <Select
                    options={[
                      { value: 'ACTIVE',    label: 'Active' },
                      { value: 'TRIAL',     label: 'Trial' },
                      { value: 'READ_ONLY', label: 'Read-Only' },
                      { value: 'SUSPENDED', label: 'Suspended' },
                      { value: 'INACTIVE',  label: 'Inactive' },
                    ]}
                  />
                </Form.Item>
              </Col>
            )}
            {!editingTenant && watchPlan === 'TRIAL' && (
              <Col xs={24} sm={12}>
                <Form.Item name="trialDays" label="Trial Duration (days) *"
                  rules={[{ required: true, message: 'Required' }]}>
                  <InputNumber min={1} max={365} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            )}
            {watchPlan && watchPlan !== 'TRIAL' && (
              <>
                <Col xs={24} sm={12}>
                  <Form.Item name="billingCycle" label="Billing Cycle">
                    <Select
                      options={[
                        { value: 'MONTHLY', label: 'Monthly' },
                        { value: 'ANNUAL',  label: 'Annual (2 months free)' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="planEndDate" label="Plan Expiry Date">
                    <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
                  </Form.Item>
                </Col>
              </>
            )}
            {editingTenant && watchPlan === 'TRIAL' && (
              <Col xs={24} sm={12}>
                <Form.Item name="planEndDate" label="Trial Expiry Date">
                  <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
                </Form.Item>
              </Col>
            )}
            {editingTenant && (
              <>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="maxUsers"
                    label="User Limit"
                    extra="Max staff users allowed (excludes admin)"
                    rules={[{ required: true, message: 'Required' }, { type: 'number', min: 1, message: 'Min 1' }]}
                  >
                    <InputNumber min={1} max={9999} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item name="notes" label="Notes">
                    <Input.TextArea rows={2} placeholder="Internal notes about this client..." />
                  </Form.Item>
                </Col>
              </>
            )}
          </Row>
        </Form>
      </Drawer>

      {/* Extend Trial Modal */}
      <Modal
        title="Extend Trial"
        open={extendModal.open}
        onOk={handleExtendTrial}
        onCancel={() => setExtendModal({ open: false, tenant: null })}
        confirmLoading={extending}
        okText="Extend"
        okButtonProps={{ style: { background: '#059669', borderColor: '#059669' } }}
        width={360}
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
            Extend trial for <strong>{extendModal.tenant?.name}</strong> by:
          </div>
          <InputNumber
            value={extendDays}
            onChange={v => setExtendDays(v ?? 7)}
            min={1}
            max={365}
            addonAfter="days"
            style={{ width: '100%' }}
          />
        </div>
      </Modal>
    </>
  );
};

export default TenantsPage;
