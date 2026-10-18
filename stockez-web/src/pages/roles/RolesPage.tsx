import React, { useState } from 'react';
import {
  Table, Button, Drawer, Form, Input, Checkbox, Tag, Popconfirm,
  message, Space, Typography, Grid, Card, Switch,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined, TeamOutlined, MobileOutlined, DesktopOutlined } from '@ant-design/icons';
import {
  useGetRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
} from '../../store/api/roleApi';
import PageHeader from '../../components/PageHeader';

const { Text } = Typography;
const { useBreakpoint } = Grid;

interface ModuleAction { perm: string; label: string; }
interface Module { module: string; actions: ModuleAction[]; }
interface ModuleGroup { group: string; modules: Module[]; }

const MODULE_GROUPS: ModuleGroup[] = [
  {
    group: 'Field Operations',
    modules: [
      { module: 'Sales Orders', actions: [{ perm: 'ORDERS_VIEW', label: 'View' }, { perm: 'ORDERS_CREATE', label: 'Create' }, { perm: 'ORDERS_EDIT', label: 'Edit' }, { perm: 'ORDERS_CANCEL', label: 'Cancel' }] },
      { module: 'Counter Sale', actions: [{ perm: 'COUNTER_SALE_VIEW', label: 'Access' }] },
      { module: 'Delivery',     actions: [{ perm: 'DELIVERY_VIEW', label: 'View' }, { perm: 'DELIVERY_UPDATE', label: 'Update Status' }] },
      { module: 'Routes',       actions: [{ perm: 'ROUTES_VIEW', label: 'View' }, { perm: 'ROUTES_CREATE', label: 'Create' }, { perm: 'ROUTES_EDIT', label: 'Edit' }] },
      { module: 'Attendance',   actions: [{ perm: 'ATTENDANCE_VIEW', label: 'View' }, { perm: 'ATTENDANCE_CHECKIN', label: 'Check In/Out' }] },
    ],
  },
  {
    group: 'Finance',
    modules: [
      { module: 'Customer Payments',     actions: [{ perm: 'PAYMENTS_VIEW', label: 'View' }, { perm: 'PAYMENTS_CREATE', label: 'Collect' }, { perm: 'PAYMENTS_DELETE', label: 'Delete' }] },
      { module: 'Customer Outstanding',  actions: [{ perm: 'CUSTOMER_OUTSTANDING_VIEW', label: 'View' }, { perm: 'OPENING_BALANCE_DELETE', label: 'Delete Opening Balance' }] },
      { module: 'Supplier Payments',     actions: [{ perm: 'SUPPLIER_PAYMENTS_VIEW', label: 'View' }, { perm: 'SUPPLIER_PAYMENTS_CREATE', label: 'Create' }, { perm: 'SUPPLIER_PAYMENTS_DELETE', label: 'Delete' }] },
      { module: 'Expenses',              actions: [{ perm: 'EXPENSES_VIEW', label: 'View' }, { perm: 'EXPENSES_CREATE', label: 'Create' }, { perm: 'EXPENSES_DELETE', label: 'Delete' }] },
      { module: 'Day Closure',           actions: [{ perm: 'DAY_CLOSURE_VIEW', label: 'View' }, { perm: 'DAY_CLOSURE_CREATE', label: 'Close Day' }] },
      { module: 'Bank Clearance',        actions: [{ perm: 'BANK_CLEARANCE_VIEW', label: 'View' }, { perm: 'BANK_CLEARANCE_UPDATE', label: 'Update' }] },
    ],
  },
  {
    group: 'Inventory',
    modules: [
      { module: 'Products',           actions: [{ perm: 'PRODUCTS_VIEW', label: 'View' }, { perm: 'PRODUCTS_CREATE', label: 'Create' }, { perm: 'PRODUCTS_EDIT', label: 'Edit' }, { perm: 'PRODUCTS_DELETE', label: 'Delete' }] },
      { module: 'Purchases',          actions: [{ perm: 'PURCHASES_VIEW', label: 'View' }, { perm: 'PURCHASES_CREATE', label: 'Create' }, { perm: 'PURCHASES_EDIT', label: 'Edit' }] },
      { module: 'Stock Batches',      actions: [{ perm: 'STOCK_VIEW', label: 'View' }] },
      { module: 'Closing Stock',      actions: [{ perm: 'CLOSING_STOCK_VIEW', label: 'View' }] },
      { module: 'Goods Return',       actions: [{ perm: 'RETURNS_VIEW', label: 'View' }, { perm: 'RETURNS_CREATE', label: 'Create' }, { perm: 'RETURNS_DAMAGE', label: 'Damage / Loss' }, { perm: 'RETURNS_APPROVE', label: 'Approve' }] },
      { module: 'Gate Pass',          actions: [{ perm: 'GATE_PASS_VIEW', label: 'View' }, { perm: 'GATE_PASS_CREATE', label: 'Create' }] },
      { module: 'Warehouse Picklist', actions: [{ perm: 'PICKLIST_VIEW', label: 'View' }, { perm: 'PICKLIST_UPDATE', label: 'Update' }] },
      { module: 'Stock Adjustment',  actions: [{ perm: 'STOCK_ADJUSTMENT_VIEW', label: 'View' }, { perm: 'STOCK_ADJUSTMENT_CREATE', label: 'Adjust' }] },
    ],
  },
  {
    group: 'Customers & Suppliers',
    modules: [
      { module: 'Customers', actions: [{ perm: 'CUSTOMERS_VIEW', label: 'View' }, { perm: 'CUSTOMERS_CREATE', label: 'Create' }, { perm: 'CUSTOMERS_EDIT', label: 'Edit' }, { perm: 'CUSTOMERS_DELETE', label: 'Delete' }] },
      { module: 'Suppliers', actions: [{ perm: 'SUPPLIERS_VIEW', label: 'View' }, { perm: 'SUPPLIERS_CREATE', label: 'Create' }, { perm: 'SUPPLIERS_EDIT', label: 'Edit' }, { perm: 'SUPPLIERS_DELETE', label: 'Delete' }] },
    ],
  },
  {
    group: 'Admin & Reports',
    modules: [
      { module: 'Invoice Approval',  actions: [{ perm: 'INVOICE_VIEW', label: 'View' }, { perm: 'INVOICE_APPROVE', label: 'Approve' }] },
      { module: 'Incentives',        actions: [{ perm: 'INCENTIVES_VIEW', label: 'View' }, { perm: 'INCENTIVES_MANAGE', label: 'Manage' }] },
      { module: 'Field Monitor',     actions: [{ perm: 'FIELD_MONITOR_VIEW', label: 'View' }] },
      { module: 'Vehicles',          actions: [{ perm: 'VEHICLES_VIEW', label: 'View' }, { perm: 'VEHICLES_CREATE', label: 'Create' }, { perm: 'VEHICLES_EDIT', label: 'Edit' }] },
      { module: 'Reports Hub & Daily', actions: [{ perm: 'REPORTS_VIEW', label: 'View' }, { perm: 'REPORTS_EXPORT', label: 'Export' }] },
      { module: 'Aging Report',        actions: [{ perm: 'REPORTS_AGING_VIEW', label: 'View' }] },
      { module: 'Sales Analysis',      actions: [{ perm: 'REPORTS_SALES_VIEW', label: 'View' }] },
      { module: 'Ledger',              actions: [{ perm: 'REPORTS_LEDGER_VIEW', label: 'View' }] },
      { module: 'Dead Stock',          actions: [{ perm: 'REPORTS_DEADSTOCK_VIEW', label: 'View' }] },
      { module: 'Product Masters',   actions: [{ perm: 'MASTERS_MANAGE', label: 'Manage' }] },
      { module: 'Data Import',       actions: [{ perm: 'IMPORT_VIEW', label: 'View' }, { perm: 'IMPORT_EXECUTE', label: 'Execute' }] },
    ],
  },
];

const FIELD_APP_GROUPS: ModuleGroup[] = [
  {
    group: 'Sales App',
    modules: [
      { module: 'Sales Orders', actions: [{ perm: 'ORDERS_VIEW', label: 'View' }, { perm: 'ORDERS_CREATE', label: 'Create' }, { perm: 'ORDERS_EDIT', label: 'Edit' }, { perm: 'ORDERS_CANCEL', label: 'Cancel' }] },
      { module: 'Counter Sale', actions: [{ perm: 'COUNTER_SALE_VIEW', label: 'Access' }] },
      { module: 'My Route',     actions: [{ perm: 'ROUTES_VIEW', label: 'View' }] },
    ],
  },
  {
    group: 'Delivery App',
    modules: [
      { module: 'Deliveries', actions: [{ perm: 'DELIVERY_VIEW', label: 'View' }, { perm: 'DELIVERY_UPDATE', label: 'Update Status' }] },
    ],
  },
  {
    group: 'Warehouse App',
    modules: [
      { module: 'Route Pick List', actions: [{ perm: 'PICKLIST_VIEW', label: 'View' }, { perm: 'PICKLIST_UPDATE', label: 'Update' }] },
      { module: 'Gate Pass',       actions: [{ perm: 'GATE_PASS_VIEW', label: 'View' }, { perm: 'GATE_PASS_CREATE', label: 'Create' }] },
      { module: 'Stock Batches',   actions: [{ perm: 'STOCK_VIEW', label: 'View' }] },
    ],
  },
  {
    group: 'Common',
    modules: [
      { module: 'Customer Payments',    actions: [{ perm: 'PAYMENTS_VIEW', label: 'View' }, { perm: 'PAYMENTS_CREATE', label: 'Collect' }] },
      { module: 'Customer Outstanding', actions: [{ perm: 'CUSTOMER_OUTSTANDING_VIEW', label: 'View' }] },
      { module: 'Goods Return',         actions: [{ perm: 'RETURNS_VIEW', label: 'View' }, { perm: 'RETURNS_CREATE', label: 'Create' }, { perm: 'RETURNS_DAMAGE', label: 'Damage / Loss' }] },
      { module: 'Customers',            actions: [{ perm: 'CUSTOMERS_VIEW', label: 'View' }, { perm: 'CUSTOMERS_CREATE', label: 'Create' }, { perm: 'CUSTOMERS_EDIT', label: 'Edit' }] },
      { module: 'Products',             actions: [{ perm: 'PRODUCTS_VIEW', label: 'View' }] },
      { module: 'Attendance',           actions: [{ perm: 'ATTENDANCE_VIEW', label: 'View' }, { perm: 'ATTENDANCE_CHECKIN', label: 'Check In/Out' }] },
      { module: 'Incentives',           actions: [{ perm: 'INCENTIVES_VIEW', label: 'View' }] },
    ],
  },
];
const FIELD_APP_PERMISSIONS = new Set(FIELD_APP_GROUPS.flatMap(g => g.modules.flatMap(m => m.actions.map(a => a.perm))));

const ALL_MODULES: Module[] = MODULE_GROUPS.flatMap(g => g.modules);
const ALL_PERMISSIONS = Array.from(new Set(ALL_MODULES.flatMap(m => m.actions.map(a => a.perm))));

const permLabel = (perm: string): string => {
  for (const m of ALL_MODULES) {
    const a = m.actions.find(x => x.perm === perm);
    if (a) return a.label;
  }
  return perm;
};

const moduleLabel = (perm: string): string => {
  for (const m of ALL_MODULES) {
    if (m.actions.some(x => x.perm === perm)) return m.module;
  }
  return perm;
};

const buildPermSummary = (perms: string[]): { module: string; actions: string[] }[] => {
  const map = new Map<string, string[]>();
  for (const p of perms) {
    const mod = moduleLabel(p);
    if (!map.has(mod)) map.set(mod, []);
    map.get(mod)!.push(permLabel(p));
  }
  return Array.from(map.entries()).map(([module, actions]) => ({ module, actions }));
};

const validateRoleName = (name: string, existing: any[], editingId: string | null): string => {
  if (!name) return 'Role name is required';
  if (name.length < 2) return 'Must be at least 2 characters';
  if (!/[a-zA-Z]/.test(name)) return 'Role name must contain at least one letter';
  if (!/^[a-zA-Z0-9\s\-]+$/.test(name)) return 'Only letters, numbers, spaces and hyphens are allowed';
  if (existing.some((r: any) => r.name.toLowerCase() === name.toLowerCase() && r.id !== editingId))
    return `"${name}" already exists`;
  return '';
};

const RolesPage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const { data, isLoading } = useGetRolesQuery();
  const [createRole, { isLoading: creating }] = useCreateRoleMutation();
  const [updateRole, { isLoading: updating }] = useUpdateRoleMutation();
  const [deleteRole] = useDeleteRoleMutation();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [checkedPerms, setCheckedPerms] = useState<Set<string>>(new Set());
  const [roleName, setRoleName] = useState('');
  const [roleNameError, setRoleNameError] = useState('');
  const [fieldStaff, setFieldStaff] = useState(false);
  const [showAllPerms, setShowAllPerms] = useState(false);

  const roles = data?.data || [];

  const openCreate = () => {
    setEditingId(null);
    setRoleName('');
    setRoleNameError('');
    setCheckedPerms(new Set());
    setFieldStaff(false);
    setShowAllPerms(false);
    setDrawerOpen(true);
  };

  const openEdit = (role: any) => {
    setEditingId(role.id);
    setRoleName(role.name);
    setRoleNameError('');
    setCheckedPerms(new Set(role.permissions || []));
    setFieldStaff(!!role.fieldStaff);
    setShowAllPerms(!!role.fieldStaff && (role.permissions || []).some((p: string) => !FIELD_APP_PERMISSIONS.has(p)));
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    const name = roleName.trim();
    const err = validateRoleName(name, roles, editingId);
    if (err) { setRoleNameError(err); return; }
    setRoleNameError('');
    if (checkedPerms.size === 0) {
      message.error('Assign at least one permission before saving the role');
      return;
    }
    try {
      const payload = { name, fieldStaff, permissions: Array.from(checkedPerms) };
      if (editingId) {
        await updateRole({ id: editingId, data: payload }).unwrap();
        message.success('Role updated');
      } else {
        await createRole(payload).unwrap();
        message.success('Role created');
      }
      setDrawerOpen(false);
    } catch (err: any) {
      const errMsg = err?.data?.message || '';
      if (errMsg.toLowerCase().includes('duplicate') || errMsg.toLowerCase().includes('exists')) {
        setRoleNameError(`"${name}" already exists`);
      } else {
        setRoleNameError(errMsg || 'Failed to save role');
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRole(id).unwrap();
      message.success('Role deleted');
    } catch (err: any) {
      message.error(err?.data?.message || 'Cannot delete role');
    }
  };

  const togglePerm = (perm: string) => {
    setCheckedPerms(prev => {
      const next = new Set(prev);
      next.has(perm) ? next.delete(perm) : next.add(perm);
      return next;
    });
  };

  const toggleModule = (module: Module) => {
    const allChecked = module.actions.every(a => checkedPerms.has(a.perm));
    setCheckedPerms(prev => {
      const next = new Set(prev);
      if (allChecked) module.actions.forEach(a => next.delete(a.perm));
      else module.actions.forEach(a => next.add(a.perm));
      return next;
    });
  };

  const toggleGroup = (group: ModuleGroup) => {
    const allPerms = group.modules.flatMap(m => m.actions.map(a => a.perm));
    const allChecked = allPerms.every(p => checkedPerms.has(p));
    setCheckedPerms(prev => {
      const next = new Set(prev);
      if (allChecked) allPerms.forEach(p => next.delete(p));
      else allPerms.forEach(p => next.add(p));
      return next;
    });
  };

  const columns = [
    {
      title: 'Role Name',
      dataIndex: 'name',
      width: 220,
      render: (name: string, record: any) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{name}</div>
          <Tag
            icon={record.fieldStaff ? <MobileOutlined /> : <DesktopOutlined />}
            style={{
              margin: '4px 0 0', fontSize: 11, border: 'none',
              color: record.fieldStaff ? '#059669' : '#64748b',
              background: record.fieldStaff ? '#ecfdf5' : '#f1f5f9',
            }}
          >
            {record.fieldStaff ? 'Mobile · Field' : 'Office'}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Permissions',
      dataIndex: 'permissions',
      render: (perms: string[]) => {
        if (!perms || perms.length === 0) {
          return <Text type="secondary" style={{ fontSize: 12 }}>No permissions assigned</Text>;
        }
        const summary = buildPermSummary(perms);
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {summary.map(s => (
              <Tag key={s.module} style={{ margin: 0, fontSize: 11, color: '#374151', borderColor: '#d1d5db', background: '#f9fafb' }}>
                {s.module}: {s.actions.join(', ')}
              </Tag>
            ))}
          </div>
        );
      },
    },
    {
      title: 'Users',
      dataIndex: 'userCount',
      width: 80,
      align: 'center' as const,
      render: (count: number) => (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: count > 0 ? '#0f172a' : '#94a3b8' }}>
          <TeamOutlined style={{ fontSize: 12 }} />
          <span style={{ fontWeight: 600 }}>{count}</span>
        </span>
      ),
    },
    {
      title: '',
      width: 80,
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm
            title="Delete this role?"
            description={record.userCount > 0 ? `${record.userCount} user(s) assigned — cannot delete.` : 'This action cannot be undone.'}
            onConfirm={() => handleDelete(record.id)}
            okText="Delete" okButtonProps={{ danger: true }}
            disabled={record.userCount > 0}
          >
            <Button size="small" icon={<DeleteOutlined />} danger disabled={record.userCount > 0} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const fieldAppView = fieldStaff && !showAllPerms;
  const visibleGroups = fieldAppView ? FIELD_APP_GROUPS : MODULE_GROUPS;
  const visiblePermissions = fieldAppView ? Array.from(FIELD_APP_PERMISSIONS) : ALL_PERMISSIONS;
  const visibleChecked = visiblePermissions.filter(p => checkedPerms.has(p)).length;

  const permissionMatrix = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {visibleGroups.map(group => {
        const groupPerms = group.modules.flatMap(m => m.actions.map(a => a.perm));
        const groupChecked = groupPerms.filter(p => checkedPerms.has(p)).length;
        const groupTotal = groupPerms.length;
        const groupAllChecked = groupChecked === groupTotal;
        const groupIndeterminate = groupChecked > 0 && groupChecked < groupTotal;

        return (
          <div key={group.group} style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{
              background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
              padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <Checkbox
                checked={groupAllChecked}
                indeterminate={groupIndeterminate}
                onChange={() => toggleGroup(group)}
              >
                <span style={{ fontWeight: 700, fontSize: 12, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {group.group}
                </span>
              </Checkbox>
              <Text type="secondary" style={{ fontSize: 11 }}>{groupChecked}/{groupTotal}</Text>
            </div>

            <div style={{ padding: '4px 0' }}>
              {group.modules.map((mod, idx) => {
                const modChecked = mod.actions.filter(a => checkedPerms.has(a.perm)).length;
                const modAllChecked = modChecked === mod.actions.length;
                const modIndeterminate = modChecked > 0 && modChecked < mod.actions.length;
                const isLast = idx === group.modules.length - 1;

                return (
                  <div key={mod.module} style={{
                    padding: '8px 14px',
                    borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    gap: isMobile ? 8 : 12,
                  }}>
                    <div style={{ minWidth: isMobile ? 'auto' : 180 }}>
                      <Checkbox
                        checked={modAllChecked}
                        indeterminate={modIndeterminate}
                        onChange={() => toggleModule(mod)}
                      >
                        <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{mod.module}</span>
                      </Checkbox>
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: isMobile ? 12 : 16,
                      flexWrap: 'wrap',
                      paddingLeft: isMobile ? 24 : 0,
                    }}>
                      {mod.actions.map(action => (
                        <Checkbox
                          key={action.perm}
                          checked={checkedPerms.has(action.perm)}
                          onChange={() => togglePerm(action.perm)}
                        >
                          <span style={{ fontSize: 12, color: '#6b7280' }}>{action.label}</span>
                        </Checkbox>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Define what each role can access. Assign roles to users."
        count={roles.length}
        action={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            New Role
          </Button>
        }
      />

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {isLoading ? (
            <div style={{ padding: 24, textAlign: 'center' }}><Text type="secondary">Loading...</Text></div>
          ) : roles.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center' }}><Text type="secondary">No roles yet. Create your first role.</Text></div>
          ) : roles.map((role: any) => {
            const summary = buildPermSummary(role.permissions || []);
            return (
              <Card
                key={role.id}
                size="small"
                styles={{ body: { padding: '12px 14px' } }}
                style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {role.name}
                      <Tag
                        icon={role.fieldStaff ? <MobileOutlined /> : <DesktopOutlined />}
                        style={{
                          margin: 0, fontSize: 10, border: 'none',
                          color: role.fieldStaff ? '#059669' : '#64748b',
                          background: role.fieldStaff ? '#ecfdf5' : '#f1f5f9',
                        }}
                      >
                        {role.fieldStaff ? 'Mobile · Field' : 'Office'}
                      </Tag>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <TeamOutlined style={{ fontSize: 12, color: '#64748b' }} />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {role.userCount} user{role.userCount !== 1 ? 's' : ''}
                      </Text>
                      <span style={{ color: '#d1d5db' }}>·</span>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {(role.permissions || []).length} permissions
                      </Text>
                    </div>
                    {summary.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {summary.map(s => (
                          <Tag key={s.module} style={{ margin: 0, fontSize: 11, color: '#374151', borderColor: '#d1d5db', background: '#f9fafb' }}>
                            {s.module}
                          </Tag>
                        ))}
                      </div>
                    )}
                  </div>
                  <Space style={{ marginLeft: 12, flexShrink: 0 }}>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(role)} />
                    <Popconfirm
                      title="Delete this role?"
                      description={role.userCount > 0 ? `${role.userCount} user(s) assigned — cannot delete.` : 'This action cannot be undone.'}
                      onConfirm={() => handleDelete(role.id)}
                      okText="Delete" okButtonProps={{ danger: true }}
                      disabled={role.userCount > 0}
                    >
                      <Button size="small" icon={<DeleteOutlined />} danger disabled={role.userCount > 0} />
                    </Popconfirm>
                  </Space>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Table
          dataSource={roles}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          size="middle"
        />
      )}

      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SafetyOutlined style={{ color: '#059669' }} />
            {editingId ? 'Edit Role' : 'New Role'}
          </div>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={isMobile ? '100%' : 680}
        footer={
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: isMobile ? 10 : 0,
          }}>
            <Space wrap>
              <Button size="small" onClick={() => setCheckedPerms(prev => new Set([...prev, ...visiblePermissions]))}>Select All</Button>
              <Button size="small" onClick={() => setCheckedPerms(prev => { const next = new Set(prev); visiblePermissions.forEach(p => next.delete(p)); return next; })}>Clear All</Button>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {visibleChecked} / {visiblePermissions.length} permissions
              </Text>
            </Space>
            <Space style={isMobile ? { display: 'flex', justifyContent: 'flex-end' } : {}}>
              <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
              <Button type="primary" onClick={handleSave} loading={creating || updating}>
                {editingId ? 'Save Changes' : 'Create Role'}
              </Button>
            </Space>
          </div>
        }
      >
        <Form layout="vertical">
          <Form.Item label="Role Name *" style={{ marginBottom: 20 }}>
            <Input
              value={roleName}
              onChange={e => {
                setRoleName(e.target.value);
                if (roleNameError) setRoleNameError(validateRoleName(e.target.value.trim(), roles, editingId));
              }}
              placeholder="e.g. Sales Executive, Delivery Boy, Back Office"
              maxLength={100}
              status={roleNameError ? 'error' : ''}
            />
            {roleNameError && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{roleNameError}</div>}
          </Form.Item>

          <Form.Item label="Screen Layout" style={{ marginBottom: 20 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 8,
              background: fieldStaff ? '#ecfdf5' : '#f8fafc',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {fieldStaff
                  ? <MobileOutlined style={{ fontSize: 18, color: '#059669' }} />
                  : <DesktopOutlined style={{ fontSize: 18, color: '#64748b' }} />}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                    {fieldStaff ? 'Field Staff — mobile app screen' : 'Office — admin sidebar'}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {fieldStaff
                      ? 'Salesman / delivery / warehouse staff. Gets the mobile field screen.'
                      : 'Office staff. Gets the full admin dashboard and sidebar.'}
                  </div>
                </div>
              </div>
              <Switch checked={fieldStaff} onChange={setFieldStaff} />
            </div>
          </Form.Item>
        </Form>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 1, textTransform: 'uppercase' }}>
            {fieldAppView ? 'What can this role do in the mobile app?' : 'Permissions'}
          </div>
          {fieldStaff && (
            <Checkbox checked={showAllPerms} onChange={e => setShowAllPerms(e.target.checked)}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Show all permissions</span>
            </Checkbox>
          )}
        </div>

        {permissionMatrix}
      </Drawer>
    </div>
  );
};

export default RolesPage;
