import React, { useState } from 'react';
import {
  Card, Table, Button, Drawer, Form, Input, Select, DatePicker,
  message, Tag, Popconfirm, Space, Row, Col, Statistic, Divider, Tooltip,
} from 'antd';
import {
  PlusOutlined, EditOutlined, StopOutlined, CheckCircleOutlined,
  CloudServerOutlined, ClockCircleOutlined, CheckOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetTenantsQuery,
  useGetTenantStatsQuery,
  useCreateTenantMutation,
  useUpdateTenantMutation,
  useSuspendTenantMutation,
  useActivateTenantMutation,
} from '../../store/api/tenantApi';

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  ACTIVE:    { color: '#059669', label: 'Active' },
  TRIAL:     { color: '#2563eb', label: 'Trial' },
  SUSPENDED: { color: '#dc2626', label: 'Suspended' },
  INACTIVE:  { color: '#6b7280', label: 'Inactive' },
};

const TenantsPage: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [form] = Form.useForm();

  const { data: tenantsData, isLoading } = useGetTenantsQuery();
  const { data: statsData } = useGetTenantStatsQuery();
  const [createTenant, { isLoading: creating }] = useCreateTenantMutation();
  const [updateTenant, { isLoading: updating }] = useUpdateTenantMutation();
  const [suspendTenant] = useSuspendTenantMutation();
  const [activateTenant] = useActivateTenantMutation();

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
    form.setFieldsValue({ status: 'ACTIVE' });
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
      trialEndsAt: tenant.trialEndsAt ? dayjs(tenant.trialEndsAt) : null,
    });
    setDrawerOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      const payload = {
        ...values,
        trialEndsAt: values.trialEndsAt ? values.trialEndsAt.toISOString() : null,
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

  const handleSuspend = async (id: string, name: string) => {
    try {
      await suspendTenant(id).unwrap();
      message.success(`${name} suspended`);
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to suspend');
    }
  };

  const handleActivate = async (id: string, name: string) => {
    try {
      await activateTenant(id).unwrap();
      message.success(`${name} activated`);
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to activate');
    }
  };

  const statusValue = form.getFieldValue('status');

  const columns = [
    {
      title: 'Company',
      key: 'company',
      render: (_: any, t: any) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{t.name}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{t.subdomain}.stockez.com</div>
        </div>
      ),
    },
    {
      title: 'Owner',
      key: 'owner',
      render: (_: any, t: any) => (
        <div>
          <div style={{ fontSize: 13, color: '#1e293b' }}>{t.ownerName}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{t.phone}</div>
        </div>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (v: string) => <span style={{ fontSize: 13 }}>{v}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => {
        const cfg = STATUS_CONFIG[v] || { color: '#6b7280', label: v };
        return <Tag color={cfg.color} style={{ fontSize: 11, fontWeight: 600, borderRadius: 4 }}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Trial Ends',
      dataIndex: 'trialEndsAt',
      key: 'trialEndsAt',
      render: (v: string, t: any) => {
        if (t.status !== 'TRIAL' || !v) return <span style={{ color: '#94a3b8' }}>—</span>;
        const d = dayjs(v);
        const expired = d.isBefore(dayjs());
        return (
          <span style={{ fontSize: 12, color: expired ? '#dc2626' : '#d97706', fontWeight: 600 }}>
            {d.format('DD MMM YYYY')}
          </span>
        );
      },
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{dayjs(v).format('DD MMM YYYY')}</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_: any, t: any) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(t)} />
          </Tooltip>
          {t.status === 'SUSPENDED' || t.status === 'INACTIVE' ? (
            <Tooltip title="Activate">
              <Popconfirm
                title={`Activate ${t.name}?`}
                onConfirm={() => handleActivate(t.id, t.name)}
                okText="Activate"
                okButtonProps={{ style: { background: '#059669', borderColor: '#059669' } }}
              >
                <Button type="text" size="small" icon={<CheckCircleOutlined style={{ color: '#059669' }} />} />
              </Popconfirm>
            </Tooltip>
          ) : (
            <Tooltip title="Suspend">
              <Popconfirm
                title={`Suspend ${t.name}? Users will be locked out.`}
                onConfirm={() => handleSuspend(t.id, t.name)}
                okText="Suspend"
                okButtonProps={{ danger: true }}
              >
                <Button type="text" size="small" icon={<StopOutlined style={{ color: '#dc2626' }} />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      {/* Stats Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Tenants', value: stats?.total ?? 0, icon: <CloudServerOutlined />, color: '#4361ee' },
          { label: 'Active', value: stats?.active ?? 0, icon: <CheckOutlined />, color: '#059669' },
          { label: 'Trial', value: stats?.trial ?? 0, icon: <ClockCircleOutlined />, color: '#2563eb' },
          { label: 'Suspended', value: stats?.suspended ?? 0, icon: <ExclamationCircleOutlined />, color: '#dc2626' },
        ].map(s => (
          <Col xs={12} sm={6} key={s.label}>
            <Card size="small" bodyStyle={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: s.color + '14',
                  color: s.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16,
                }}>
                  {s.icon}
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.label}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Main table card */}
      <Card
        size="small"
        title={<span style={{ fontWeight: 700 }}>Tenants</span>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#059669', borderColor: '#059669' }}>
            New Tenant
          </Button>
        }
      >
        {/* Filters */}
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
            style={{ width: 140 }}
            options={[
              { value: 'ALL', label: 'All Status' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'TRIAL', label: 'Trial' },
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
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} tenants` }}
        />
      </Card>

      {/* Create / Edit Drawer */}
      <Drawer
        title={<span style={{ fontWeight: 700 }}>{editingTenant ? 'Edit Tenant' : 'New Tenant'}</span>}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); form.resetFields(); }}
        width={560}
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
              {editingTenant ? 'Save Changes' : 'Create Tenant'}
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
                extra={!editingTenant ? 'Used for login: subdomain.stockez.com' : undefined}
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
              <Form.Item
                name="phone"
                label="Owner Phone *"
                rules={[{ required: true, message: 'Required' }, { pattern: /^[6-9]\d{9}$/, message: 'Valid 10-digit number' }]}
              >
                <Input placeholder="9876543210" maxLength={10} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="email"
                label="Email *"
                rules={[{ required: true, message: 'Required' }, { type: 'email', message: 'Valid email' }]}
              >
                <Input placeholder="owner@company.com" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="gstin" label="GSTIN">
                <Input placeholder="22AAAAA0000A1Z5" maxLength={15} />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '4px 0 16px' }} />

          {/* Admin Account — only on create */}
          {!editingTenant && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                Admin Account (First Login)
              </div>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="adminPhone"
                    label="Admin Login Phone *"
                    rules={[{ required: true, message: 'Required' }, { pattern: /^[6-9]\d{9}$/, message: 'Valid 10-digit number' }]}
                    extra="This is the phone number used to log in"
                  >
                    <Input placeholder="9876543210" maxLength={10} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="adminPassword"
                    label="Initial Password *"
                    rules={[{ required: true, message: 'Required' }, { min: 6, message: 'Min 6 characters' }]}
                    extra="Admin must change on first login"
                  >
                    <Input.Password placeholder="Min 6 characters" />
                  </Form.Item>
                </Col>
              </Row>
              <Divider style={{ margin: '4px 0 16px' }} />
            </>
          )}

          {/* Location */}
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
            Location
          </div>
          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item name="address" label="Address">
                <Input.TextArea rows={2} placeholder="Street address" />
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

          {/* Subscription */}
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
            Subscription
          </div>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="status" label="Status *" rules={[{ required: true, message: 'Required' }]}>
                <Select
                  options={[
                    { value: 'ACTIVE', label: 'Active' },
                    { value: 'TRIAL', label: 'Trial' },
                    { value: 'SUSPENDED', label: 'Suspended' },
                    { value: 'INACTIVE', label: 'Inactive' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Form.Item shouldUpdate={(prev, curr) => prev.status !== curr.status} noStyle>
              {() => {
                const s = form.getFieldValue('status');
                if (s !== 'TRIAL') return null;
                return (
                  <Col xs={24} sm={12}>
                    <Form.Item name="trialEndsAt" label="Trial Ends On">
                      <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
                    </Form.Item>
                  </Col>
                );
              }}
            </Form.Item>
          </Row>
        </Form>
      </Drawer>
    </>
  );
};

export default TenantsPage;
