import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Space,
  Row, Col, Card, Popconfirm, message, Tooltip, Avatar, Badge, InputNumber,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined, ReloadOutlined } from '@ant-design/icons';
import { useGetUsersQuery, useCreateUserMutation, useUpdateUserMutation, useDeleteUserMutation, useReactivateUserMutation } from '../../store/api/userApi';
import PageHeader from '../../components/PageHeader';
import AuditHistoryButton from '../../components/AuditHistoryButton';
import { applyApiErrorToForm } from '../../utils/formError';

const { Option } = Select;

const ROLES = [
  { value: 'ADMIN',      label: 'Admin',      color: '#ef4444', bg: '#fef2f2' },
  { value: 'SALES',      label: 'Sales',       color: '#059669', bg: '#ecfdf5' },
  { value: 'INVOICE',    label: 'Invoice',     color: '#f59e0b', bg: '#fffbeb' },
  { value: 'WAREHOUSE',  label: 'Warehouse',   color: '#06b6d4', bg: '#ecfeff' },
  { value: 'DELIVERY',   label: 'Delivery',    color: '#10b981', bg: '#ecfdf5' },
  { value: 'ACCOUNTANT', label: 'Accountant',  color: '#8b5cf6', bg: '#f5f3ff' },
];

const roleLabel = (role: string) => ROLES.find(r => r.value === role)?.label || role;
const roleCfg   = (role: string) => ROLES.find(r => r.value === role) || { color: '#6b7280', bg: '#f3f4f6', label: role, value: role };

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 480);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 480);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
};

// ─── Mobile user card ─────────────────────────────────────────────────────────

const UserCard: React.FC<{
  user: any;
  onEdit: (u: any) => void;
  onDelete: (id: string) => void;
  onReactivate: (id: string) => void;
}> = ({ user, onEdit, onDelete, onReactivate }) => {
  const cfg = roleCfg(user.role);
  const opacity = user.active ? 1 : 0.55;

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e8ecf0',
      borderRadius: 12,
      padding: '14px 14px 10px',
      marginBottom: 10,
    }}>
      {/* Top row: avatar + name + role badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <Avatar size={40} style={{ background: cfg.color, fontWeight: 700, fontSize: 15, flexShrink: 0, opacity }}>
          {user.fullName?.[0]}
        </Avatar>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', opacity }}>{user.fullName}</span>
            <span style={{
              background: cfg.bg, color: cfg.color,
              fontSize: 11, fontWeight: 700,
              padding: '2px 9px', borderRadius: 20,
              opacity,
            }}>
              {roleLabel(user.role)}
            </span>
            {!user.active && (
              <span style={{ background: '#f3f4f6', color: '#9ca3af', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>
                Inactive
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, opacity }}>{user.phone}</div>
        </div>
      </div>

      {/* Detail row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10, paddingLeft: 52 }}>
        {user.email && (
          <span style={{ fontSize: 12, color: '#6b7280', opacity }}>{user.email}</span>
        )}
        {user.employmentType && (
          <span style={{ fontSize: 12, color: '#374151', opacity }}>
            {user.employmentType === 'PERMANENT' ? 'Permanent' : 'Temporary'}
          </span>
        )}
        {user.salary != null && (
          <span style={{ fontSize: 12, color: '#374151', fontWeight: 600, opacity }}>
            ₹{Number(user.salary).toLocaleString('en-IN', { minimumFractionDigits: 0 })}/mo
          </span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
        {user.active ? (
          <>
            <Button icon={<EditOutlined />} size="small" onClick={() => onEdit(user)}>Edit</Button>
            <Popconfirm title="Deactivate this user?" onConfirm={() => onDelete(user.id)}>
              <Button icon={<DeleteOutlined />} size="small" danger>Deactivate</Button>
            </Popconfirm>
          </>
        ) : (
          <Popconfirm title="Reactivate this user?" onConfirm={() => onReactivate(user.id)}>
            <Button icon={<ReloadOutlined />} size="small" style={{ color: '#059669', borderColor: '#059669' }}>Reactivate</Button>
          </Popconfirm>
        )}
        <AuditHistoryButton entityType="USER" entityId={user.id} title={`Audit — ${user.fullName}`} />
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const UsersPage: React.FC = () => {
  const isMobile = useIsMobile();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useGetUsersQuery({ includeInactive });
  const [createUser, { isLoading: creating }] = useCreateUserMutation();
  const [updateUser, { isLoading: updating }] = useUpdateUserMutation();
  const [deleteUser] = useDeleteUserMutation();
  const [reactivateUser] = useReactivateUserMutation();

  const allUsers = (data?.data?.content || data?.data || []).filter((u: any) => u.role !== 'SUPER_ADMIN');
  const users = includeInactive ? allUsers.filter((u: any) => !u.active) : allUsers;
  const activeCount   = allUsers.filter((u: any) => u.active).length;
  const inactiveCount = allUsers.filter((u: any) => !u.active).length;

  const openAdd = () => { setEditingUser(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (user: any) => {
    setEditingUser(user);
    form.setFieldsValue({ ...user, password: undefined, salary: user.salary ?? null, employmentType: user.employmentType ?? null });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingUser) {
        await updateUser({ id: editingUser.id, data: values }).unwrap();
        message.success('User updated');
      } else {
        await createUser(values).unwrap();
        message.success('User created');
      }
      setModalOpen(false);
    } catch (err: any) {
      if (err?.errorFields) return;
      const msg = applyApiErrorToForm(err, form, 'phone');
      if (msg) message.error(msg);
    }
  };

  const handleDelete = async (id: string) => {
    try { await deleteUser(id).unwrap(); message.success('User deactivated'); }
    catch (err: any) { message.error(err?.data?.message || 'Failed to deactivate user'); }
  };

  const handleReactivate = async (id: string) => {
    try { await reactivateUser(id).unwrap(); message.success('User reactivated'); }
    catch (err: any) { message.error(err?.data?.message || 'Failed to reactivate user'); }
  };

  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (_: any, r: any) => {
        const cfg = roleCfg(r.role);
        return (
          <Space>
            <Avatar size={36} style={{ background: cfg.color, fontWeight: 700, fontSize: 14, flexShrink: 0, opacity: r.active ? 1 : 0.5 }}>
              {r.fullName?.[0]}
            </Avatar>
            <div style={{ opacity: r.active ? 1 : 0.5 }}>
              <div style={{ fontWeight: 600, color: '#1a1d2e', fontSize: 14 }}>{r.fullName}</div>
              <div style={{ color: '#9ca3af', fontSize: 12 }}>{r.email || r.phone}</div>
            </div>
          </Space>
        );
      },
    },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', width: 130,
      render: (v: string, r: any) => <span style={{ color: '#374151', opacity: r.active ? 1 : 0.5 }}>{v}</span> },
    {
      title: 'Role', dataIndex: 'role', key: 'role', width: 160,
      render: (role: string, r: any) => {
        const cfg = roleCfg(role);
        return (
          <span style={{ background: cfg.bg, color: cfg.color, fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, opacity: r.active ? 1 : 0.5 }}>
            {roleLabel(role)}
          </span>
        );
      },
    },
    { title: 'Status', dataIndex: 'active', key: 'active', width: 90,
      render: (v: boolean) => <Badge status={v ? 'success' : 'error'} text={v ? 'Active' : 'Inactive'} /> },
    { title: 'Employment', dataIndex: 'employmentType', key: 'employmentType', width: 110,
      render: (v: string, r: any) => (v
        ? <span style={{ fontSize: 13, color: '#374151', opacity: r.active ? 1 : 0.5 }}>{v === 'PERMANENT' ? 'Permanent' : 'Temporary'}</span>
        : <span style={{ color: '#9ca3af', fontSize: 13 }}>—</span>) },
    { title: 'Salary', dataIndex: 'salary', key: 'salary', width: 110, align: 'right' as const,
      render: (v: number, r: any) => (v != null
        ? <span style={{ fontSize: 13, color: '#374151', opacity: r.active ? 1 : 0.5 }}>₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        : <span style={{ color: '#9ca3af', fontSize: 13 }}>—</span>) },
    {
      title: '', key: 'actions', width: 130,
      render: (_: any, r: any) => (
        <Space>
          {r.active ? (
            <>
              <Tooltip title="Edit">
                <Button icon={<EditOutlined />} size="small" shape="circle" onClick={() => openEdit(r)} />
              </Tooltip>
              <Popconfirm title="Deactivate this user?" onConfirm={() => handleDelete(r.id)}>
                <Tooltip title="Deactivate">
                  <Button icon={<DeleteOutlined />} size="small" shape="circle" danger />
                </Tooltip>
              </Popconfirm>
            </>
          ) : (
            <Popconfirm title="Reactivate this user?" onConfirm={() => handleReactivate(r.id)}>
              <Tooltip title="Reactivate">
                <Button icon={<ReloadOutlined />} size="small" shape="circle" style={{ color: '#059669', borderColor: '#059669' }} />
              </Tooltip>
            </Popconfirm>
          )}
          <AuditHistoryButton entityType="USER" entityId={r.id} title={`Audit — ${r.fullName}`} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Team Members"
        subtitle={
          includeInactive
            ? `${activeCount} active · ${inactiveCount} inactive`
            : isMobile ? 'Manage staff' : 'Manage staff and access roles'
        }
        count={includeInactive ? users.length : activeCount}
        countLabel={includeInactive ? 'total' : 'active'}
        action={
          <Space size={8}>
            <Button
              type={includeInactive ? 'primary' : 'default'}
              onClick={() => setIncludeInactive(!includeInactive)}
              size="middle"
              style={{ borderRadius: 8 }}
            >
              {includeInactive ? 'Active Only' : 'Show Inactive'}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} size="middle">
              Add User
            </Button>
          </Space>
        }
      />

      {/* Role summary strip */}
      <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
        {ROLES.map(r => {
          const count = users.filter((u: any) => u.role === r.value).length;
          return (
            <Col key={r.value} xs={8} sm={8} md={4}>
              <Card
                style={{ borderRadius: 10, textAlign: 'center', border: `1.5px solid ${r.color}22` }}
                styles={{ body: { padding: isMobile ? '10px 4px' : '14px 8px' } }}
              >
                <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: r.color }}>{count}</div>
                <div style={{ fontSize: isMobile ? 10 : 11, color: '#6b7280', marginTop: 2, fontWeight: 500 }}>{r.label}</div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* User list */}
      {isMobile ? (
        <div>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading...</div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
              {includeInactive ? 'No inactive users found' : 'No users found'}
            </div>
          ) : (
            users.map((u: any) => (
              <UserCard key={u.id} user={u} onEdit={openEdit} onDelete={handleDelete} onReactivate={handleReactivate} />
            ))
          )}
        </div>
      ) : (
        <Card style={{ borderRadius: 12, padding: 0 }} styles={{ body: { padding: 0 } }}>
          <Table
            columns={columns}
            dataSource={users}
            rowKey="id"
            loading={isLoading}
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} users` }}
            size="middle"
            style={{ borderRadius: 12 }}
          />
        </Card>
      )}

      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 16 }}>{editingUser ? 'Edit User' : 'Add Team Member'}</span>}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={creating || updating}
        width={isMobile ? '95vw' : 560}
        okText={editingUser ? 'Update' : 'Create User'}
        okButtonProps={{ size: 'middle' }}
        style={isMobile ? { top: 20 } : {}}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} onFinish={handleSubmit}>
          <Form.Item name="fullName" label="Full Name" rules={[{ required: true }]}>
            <Input size={isMobile ? 'middle' : 'large'} placeholder="e.g. Ravi Kumar" style={{ width: '100%' }} onPressEnter={() => form.submit()} />
          </Form.Item>

          {isMobile ? (
            <>
              <Form.Item name="phone" label="Phone" rules={[{ required: true }, { len: 10, message: '10 digits' }]}>
                <Input size="middle" placeholder="9876543210" maxLength={10} style={{ width: '100%' }} onPressEnter={() => form.submit()} />
              </Form.Item>
              <Form.Item name="role" label="Role" rules={[{ required: true }]}>
                <Select size="middle" placeholder="Select role" style={{ width: '100%' }}>
                  {ROLES.map(r => (
                    <Option key={r.value} value={r.value}>
                      <span style={{ color: r.color, fontWeight: 600 }}>{r.label}</span>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          ) : (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="phone" label="Phone" rules={[{ required: true }, { len: 10, message: '10 digits' }]}>
                  <Input size="large" placeholder="9876543210" maxLength={10} style={{ width: '100%' }} onPressEnter={() => form.submit()} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="role" label="Role" rules={[{ required: true }]}>
                  <Select size="large" placeholder="Select role" style={{ width: '100%' }}>
                    {ROLES.map(r => (
                      <Option key={r.value} value={r.value}>
                        <span style={{ color: r.color, fontWeight: 600 }}>{r.label}</span>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          )}

          <Form.Item name="email" label="Email">
            <Input size={isMobile ? 'middle' : 'large'} placeholder="Optional" style={{ width: '100%' }} onPressEnter={() => form.submit()} />
          </Form.Item>

          {!editingUser && (
            <Form.Item name="password" label="Password" rules={[{ required: true }, { min: 8, message: 'Minimum 8 characters' }]}>
              <Input.Password size={isMobile ? 'middle' : 'large'} prefix={<LockOutlined />} placeholder="Minimum 8 characters" style={{ width: '100%' }} onPressEnter={() => form.submit()} />
            </Form.Item>
          )}

          {isMobile ? (
            <>
              <Form.Item name="employmentType" label="Employment Type">
                <Select size="middle" placeholder="Select type" allowClear style={{ width: '100%' }}>
                  <Option value="PERMANENT">Permanent</Option>
                  <Option value="TEMPORARY">Temporary</Option>
                </Select>
              </Form.Item>
              <Form.Item name="salary" label="Monthly Salary (₹)">
                <InputNumber
                  size="middle" style={{ width: '100%' }}
                  placeholder="e.g. 15000"
                  min={0} precision={2}
                  formatter={(v) => v ? `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                  parser={(v) => v ? v.replace(/₹\s?|(,*)/g, '') as any : ''}
                />
              </Form.Item>
            </>
          ) : (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="employmentType" label="Employment Type">
                  <Select size="large" placeholder="Select type" allowClear style={{ width: '100%' }}>
                    <Option value="PERMANENT">Permanent</Option>
                    <Option value="TEMPORARY">Temporary</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="salary" label="Monthly Salary (₹)">
                  <InputNumber
                    size="large" style={{ width: '100%' }}
                    placeholder="e.g. 15000"
                    min={0} precision={2}
                    formatter={(v) => v ? `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                    parser={(v) => v ? v.replace(/₹\s?|(,*)/g, '') as any : ''}
                  />
                </Form.Item>
              </Col>
            </Row>
          )}

          {editingUser && (
            <>
              <Form.Item name="active" label="Status">
                <Select size={isMobile ? 'middle' : 'large'} style={{ width: '100%' }}>
                  <Option value={true}>Active</Option>
                  <Option value={false}>Inactive</Option>
                </Select>
              </Form.Item>
              <Form.Item
                name="newPassword"
                label="New Password"
                extra="Leave blank to keep current password"
                rules={[{ min: 8, message: 'Minimum 8 characters' }]}
              >
                <Input.Password size={isMobile ? 'middle' : 'large'} prefix={<LockOutlined />} placeholder="Enter to change password" style={{ width: '100%' }} onPressEnter={() => form.submit()} />
              </Form.Item>
            </>
          )}
          <button type="submit" style={{ display: 'none' }} />
        </Form>
      </Modal>
    </div>
  );
};

export default UsersPage;
