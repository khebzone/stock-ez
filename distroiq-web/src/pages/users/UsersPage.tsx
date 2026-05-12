import React, { useState } from 'react';
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
  { value: 'ADMIN',      label: 'Admin',           color: '#ef4444', bg: '#fef2f2' },
  { value: 'SALES',      label: 'Sales',            color: '#059669', bg: '#ecfdf5' },
  { value: 'INVOICE',    label: 'Invoice',          color: '#f59e0b', bg: '#fffbeb' },
  { value: 'WAREHOUSE',  label: 'Warehouse',        color: '#06b6d4', bg: '#ecfeff' },
  { value: 'DELIVERY',   label: 'Delivery',         color: '#10b981', bg: '#ecfdf5' },
  { value: 'ACCOUNTANT', label: 'Accountant',       color: '#8b5cf6', bg: '#f5f3ff' },
];

const roleLabel = (role: string) => ROLES.find(r => r.value === role)?.label || role;
const roleCfg = (role: string) => ROLES.find(r => r.value === role) || { color: '#6b7280', bg: '#f3f4f6', label: role, value: role };

const UsersPage: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useGetUsersQuery({ includeInactive });
  const [createUser, { isLoading: creating }] = useCreateUserMutation();
  const [updateUser, { isLoading: updating }] = useUpdateUserMutation();
  const [deleteUser] = useDeleteUserMutation();
  const [reactivateUser] = useReactivateUserMutation();

  const users = (data?.data?.content || data?.data || []).filter((u: any) => u.role !== 'SUPER_ADMIN');

  const openAdd = () => { setEditingUser(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (user: any) => {
    setEditingUser(user);
    form.setFieldsValue({
      ...user,
      password: undefined,
      salary: user.salary ?? null,
      employmentType: user.employmentType ?? null,
    });
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
    try {
      await deleteUser(id).unwrap();
      message.success('User deactivated');
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to deactivate user');
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      await reactivateUser(id).unwrap();
      message.success('User reactivated');
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to reactivate user');
    }
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
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 160,
      render: (role: string, r: any) => {
        const cfg = roleCfg(role);
        return (
          <span style={{
            background: cfg.bg, color: cfg.color,
            fontSize: 12, fontWeight: 700,
            padding: '3px 10px', borderRadius: 20,
            opacity: r.active ? 1 : 0.5,
          }}>
            {roleLabel(role)}
          </span>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      width: 90,
      render: (v: boolean) => <Badge status={v ? 'success' : 'error'} text={v ? 'Active' : 'Inactive'} />,
    },
    {
      title: 'Employment',
      dataIndex: 'employmentType',
      key: 'employmentType',
      width: 110,
      render: (v: string, r: any) => (v
        ? <span style={{ fontSize: 13, color: '#374151', opacity: r.active ? 1 : 0.5 }}>{v === 'PERMANENT' ? 'Permanent' : 'Temporary'}</span>
        : <span style={{ color: '#9ca3af', fontSize: 13, opacity: r.active ? 1 : 0.5 }}>—</span>),
    },
    {
      title: 'Salary',
      dataIndex: 'salary',
      key: 'salary',
      width: 110,
      align: 'right' as const,
      render: (v: number, r: any) => (v != null
        ? <span style={{ fontSize: 13, color: '#374151', opacity: r.active ? 1 : 0.5 }}>₹{Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        : <span style={{ color: '#9ca3af', fontSize: 13, opacity: r.active ? 1 : 0.5 }}>—</span>),
    },
    {
      title: '',
      key: 'actions',
      width: 130,
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
        subtitle="Manage staff and access roles"
        count={users.length}
        countLabel="users"
        action={
          <Space>
            <Button
              type={includeInactive ? 'primary' : 'default'}
              onClick={() => setIncludeInactive(!includeInactive)}
              style={{ borderRadius: 8 }}
            >
              {includeInactive ? 'Showing All' : 'Show Inactive'}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} size="middle">Add User</Button>
          </Space>
        }
      />

      {/* Role summary strip */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        {ROLES.map(r => {
          const count = users.filter((u: any) => u.role === r.value).length;
          return (
            <Col key={r.value} xs={12} sm={8} md={4}>
              <Card style={{ borderRadius: 12, textAlign: 'center', border: `1.5px solid ${r.bg}` }} bodyStyle={{ padding: '14px 8px' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: r.color }}>{count}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, fontWeight: 500 }}>{r.label}</div>
              </Card>
            </Col>
          );
        })}
      </Row>

      <Card style={{ borderRadius: 12, padding: 0 }} bodyStyle={{ padding: 0 }}>
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

      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 16 }}>{editingUser ? 'Edit User' : 'Add Team Member'}</span>}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={creating || updating}
        width={560}
        okText={editingUser ? 'Update' : 'Create User'}
        okButtonProps={{ size: 'middle' }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} onFinish={handleSubmit}>
          <Form.Item name="fullName" label="Full Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Ravi Kumar" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="phone" label="Phone" rules={[{ required: true }, { len: 10, message: '10 digits' }]}>
                <Input placeholder="9876543210" maxLength={10} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="role" label="Role" rules={[{ required: true }]}>
                <Select placeholder="Select role">
                  {ROLES.map(r => (
                    <Option key={r.value} value={r.value}>
                      <span style={{ color: r.color, fontWeight: 600 }}>{r.label}</span>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="email" label="Email">
            <Input placeholder="Optional" />
          </Form.Item>
          {!editingUser && (
            <Form.Item name="password" label="Password" rules={[{ required: true }, { min: 8, message: 'Minimum 8 characters' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Minimum 8 characters" />
            </Form.Item>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="employmentType" label="Employment Type">
                <Select placeholder="Select type" allowClear>
                  <Option value="PERMANENT">Permanent</Option>
                  <Option value="TEMPORARY">Temporary</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="salary" label="Monthly Salary (₹)">
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="e.g. 15000"
                  min={0}
                  precision={2}
                  formatter={(v) => v ? `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                  parser={(v) => v ? v.replace(/₹\s?|(,*)/g, '') as any : ''}
                />
              </Form.Item>
            </Col>
          </Row>
          {editingUser && (
            <>
              <Form.Item name="active" label="Status">
                <Select>
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
                <Input.Password prefix={<LockOutlined />} placeholder="Enter to change password" />
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
