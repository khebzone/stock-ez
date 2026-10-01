import React, { useState } from 'react';
import {
  Table, Button, Drawer, Form, Input, Select, Space, Popconfirm,
  message, Tooltip, DatePicker, InputNumber, Row, Col, Card, Statistic,
  Divider, Tag, Modal, Grid,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  AppstoreAddOutlined, CarOutlined, TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import PageHeader from '../../components/PageHeader';
import { hasPermission } from '../../utils/permissions';
import AuditHistoryButton from '../../components/AuditHistoryButton';
import {
  useGetExpenseCategoriesQuery, useCreateExpenseCategoryMutation,
  useDeleteExpenseCategoryMutation, useGetExpensesQuery,
  useGetExpenseSummaryQuery, useCreateExpenseMutation,
  useUpdateExpenseMutation, useDeleteExpenseMutation,
} from '../../store/api/expenseApi';

const { RangePicker } = DatePicker;
const { Option } = Select;
const DATE_FMT = 'DD MMM YYYY';

const PAYMENT_MODES = [
  { value: 'CASH',          label: 'Cash' },
  { value: 'UPI',           label: 'UPI' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE',        label: 'Cheque' },
];

const paymentLabel = (v: string) => PAYMENT_MODES.find(m => m.value === v)?.label || v;

const fmt = (v: number | null | undefined) =>
  v != null ? `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00';

const ExpensesPage: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const today = dayjs();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    today.startOf('month'), today,
  ]);
  const [filterCategory, setFilterCategory] = useState<string | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catForm] = Form.useForm();

  const from = dateRange[0].format('YYYY-MM-DD');
  const to = dateRange[1].format('YYYY-MM-DD');

  const { data: catData } = useGetExpenseCategoriesQuery();
  const { data: expData, isLoading } = useGetExpensesQuery({ from, to, categoryId: filterCategory });
  const { data: summaryData } = useGetExpenseSummaryQuery();
  const [createExpense, { isLoading: creating }] = useCreateExpenseMutation();
  const [updateExpense, { isLoading: updating }] = useUpdateExpenseMutation();
  const [deleteExpense] = useDeleteExpenseMutation();
  const [createCategory, { isLoading: creatingCat }] = useCreateExpenseCategoryMutation();
  const [deleteCategory] = useDeleteExpenseCategoryMutation();

  const categories: any[] = catData?.data || [];
  const expenses: any[] = expData?.data || [];
  const summary = summaryData?.data;

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ expenseDate: today, paymentMode: 'CASH' });
    setDrawerOpen(true);
  };

  const openEdit = (r: any) => {
    setEditing(r);
    form.setFieldsValue({
      expenseDate: dayjs(r.expenseDate),
      categoryId: r.categoryId,
      description: r.description,
      amount: r.amount,
      paymentMode: r.paymentMode,
      referenceNumber: r.referenceNumber,
    });
    setDrawerOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        expenseDate: values.expenseDate.format('YYYY-MM-DD'),
      };
      if (editing) {
        await updateExpense({ id: editing.id, data: payload }).unwrap();
        message.success('Expense updated');
      } else {
        await createExpense(payload).unwrap();
        message.success('Expense recorded');
      }
      setDrawerOpen(false);
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.data?.message || 'Failed to save expense');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteExpense(id).unwrap();
      message.success('Expense deleted');
    } catch { message.error('Failed'); }
  };

  const handleAddCategory = async () => {
    try {
      const { name } = await catForm.validateFields();
      await createCategory({ name }).unwrap();
      message.success('Category added');
      catForm.resetFields();
      setCatModalOpen(false);
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.data?.message || 'Failed');
    }
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'expenseDate',
      key: 'expenseDate',
      width: 120,
      render: (v: string) => <span style={{ fontSize: 13 }}>{dayjs(v).format(DATE_FMT)}</span>,
    },
    {
      title: 'Category',
      dataIndex: 'categoryName',
      key: 'categoryName',
      width: 160,
      render: (v: string) => <Tag color="blue" style={{ fontSize: 12 }}>{v}</Tag>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (v: string) => <span style={{ fontSize: 13, color: '#374151' }}>{v || '—'}</span>,
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{fmt(v)}</span>
      ),
    },
    {
      title: 'Payment',
      dataIndex: 'paymentMode',
      key: 'paymentMode',
      width: 120,
      render: (v: string) => <span style={{ fontSize: 13, color: '#374151' }}>{paymentLabel(v)}</span>,
    },
    {
      title: 'Reference',
      dataIndex: 'referenceNumber',
      key: 'referenceNumber',
      width: 130,
      render: (v: string) => <span style={{ fontSize: 12, color: '#6b7280' }}>{v || '—'}</span>,
    },
    {
      title: 'Recorded By',
      dataIndex: 'recordedByName',
      key: 'recordedByName',
      width: 130,
      render: (v: string) => <span style={{ fontSize: 13, color: '#374151' }}>{v || '—'}</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      render: (_: any, r: any) => (
        <Space>
          {hasPermission('EXPENSES_CREATE') && (
            <Tooltip title="Edit">
              <Button icon={<EditOutlined />} size="small" shape="circle" onClick={() => openEdit(r)} />
            </Tooltip>
          )}
          {hasPermission('EXPENSES_DELETE') && (
            <Popconfirm title="Delete this expense?" onConfirm={() => handleDelete(r.id)} okText="Yes" okButtonProps={{ danger: true }}>
              <Tooltip title="Delete">
                <Button icon={<DeleteOutlined />} size="small" shape="circle" danger />
              </Tooltip>
            </Popconfirm>
          )}
          <AuditHistoryButton entityType="EXPENSE" entityId={r.id} title={`Audit — ${r.categoryName}`} />
        </Space>
      ),
    },
  ];

  const totalFiltered = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);

  return (
    <div>
      <PageHeader
        title="Office Expenses"
        subtitle="Track all business expenses by category"
        count={expenses.length}
        countLabel="entries"
        action={
          <Space>
            {hasPermission('EXPENSES_CREATE') && (
              <Button icon={<AppstoreAddOutlined />} onClick={() => setCatModalOpen(true)}>
                Manage Categories
              </Button>
            )}
            {hasPermission('EXPENSES_CREATE') && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
                Add Expense
              </Button>
            )}
          </Space>
        }
      />

      {/* Summary Cards */}
      <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
        {[
          { label: 'Today',      value: summary?.todayTotal,      color: '#111827' },
          { label: 'This Month', value: summary?.thisMonthTotal,  color: '#1d4ed8' },
          { label: 'This Year',  value: summary?.thisYearTotal,   color: '#6b7280' },
        ].map(s => (
          <Col xs={8} sm={8} key={s.label}>
            <Card bodyStyle={{ padding: isMobile ? '10px 10px' : '16px 20px' }}>
              <div style={{ fontSize: isMobile ? 14 : 20, fontWeight: 800, color: s.color, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {fmt(Number(s.value || 0))}
              </div>
              <div style={{ fontSize: isMobile ? 10 : 12, color: '#6b7280', fontWeight: 500, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.label}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* This month breakdown by category */}
      {summary?.byCategory?.length > 0 && (
        <Card
          size="small"
          style={{ marginBottom: 16 }}
          bodyStyle={{ padding: '12px 16px' }}
        >
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              This Month by Category
            </span>
            {summary.byCategory.map((c: any) => (
              <div key={c.categoryName} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#374151' }}>{c.categoryName}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{fmt(c.totalAmount)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 12 }} bodyStyle={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <RangePicker
            format={DATE_FMT}
            value={dateRange}
            onChange={(v) => v && setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs])}
            allowClear={false}
            style={{ flex: isMobile ? '1 1 100%' : undefined }}
          />
          <Select
            placeholder="All Categories"
            allowClear
            style={{ flex: isMobile ? '1 1 100%' : undefined, minWidth: 160 }}
            value={filterCategory}
            onChange={setFilterCategory}
          >
            {categories.map((c: any) => (
              <Option key={c.id} value={c.id}>{c.name}</Option>
            ))}
          </Select>
        </div>
      </Card>

      {isMobile ? (
        <>
          {expenses.length === 0 && !isLoading && (
            <div style={{ padding: '48px 0', color: '#64748b', textAlign: 'center', fontSize: 14 }}>
              No expenses found
            </div>
          )}
          {expenses.map((r: any) => (
            <div key={r.id} style={{
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #e8ecf0',
              marginBottom: 12,
              overflow: 'hidden',
            }}>
              {/* Card header */}
              <div style={{
                padding: '12px 16px',
                background: '#f8fafc',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <Tag color="blue" style={{ fontSize: 11, fontWeight: 700, margin: 0 }}>{r.categoryName}</Tag>
                <span style={{ fontWeight: 800, color: '#111827', fontSize: 15 }}>{fmt(r.amount)}</span>
              </div>

              {/* Card body */}
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {r.description && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, width: 80, flexShrink: 0 }}>Description</span>
                    <span style={{ fontSize: 12, color: '#1a1d2e', fontWeight: 500 }}>{r.description}</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, width: 80, flexShrink: 0 }}>Date</span>
                  <span style={{ fontSize: 12, color: '#1a1d2e' }}>{dayjs(r.expenseDate).format(DATE_FMT)}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, width: 80, flexShrink: 0 }}>Mode</span>
                  <span style={{ fontSize: 12, color: '#1a1d2e' }}>{paymentLabel(r.paymentMode)}</span>
                </div>
                {r.referenceNumber && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, width: 80, flexShrink: 0 }}>Reference</span>
                    <span style={{ fontSize: 12, color: '#1a1d2e' }}>{r.referenceNumber}</span>
                  </div>
                )}
                {r.recordedByName && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, width: 80, flexShrink: 0 }}>Recorded By</span>
                    <span style={{ fontSize: 12, color: '#1a1d2e' }}>{r.recordedByName}</span>
                  </div>
                )}
              </div>

              {/* Card actions */}
              <div style={{
                padding: '10px 16px',
                borderTop: '1px solid #f0f0f0',
                display: 'flex',
                gap: 8,
              }}>
                {hasPermission('EXPENSES_CREATE') && (
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} style={{ flex: 1 }}>
                    Edit
                  </Button>
                )}
                {hasPermission('EXPENSES_DELETE') && (
                <Popconfirm title="Delete this expense?" onConfirm={() => handleDelete(r.id)} okText="Yes" okButtonProps={{ danger: true }}>
                  <Button size="small" icon={<DeleteOutlined />} danger style={{ flex: 1 }}>
                    Delete
                  </Button>
                </Popconfirm>
                )}
                <AuditHistoryButton entityType="EXPENSE" entityId={r.id} title={`Audit — ${r.categoryName}`} />
              </div>
            </div>
          ))}
          {expenses.length > 0 && (
            <div style={{ textAlign: 'right', padding: '8px 4px', fontWeight: 700, fontSize: 14, color: '#111827' }}>
              Total: {fmt(totalFiltered)}
            </div>
          )}
        </>
      ) : (
        <Table
          columns={columns}
          dataSource={expenses}
          rowKey="id"
          loading={isLoading}
                   pagination={{ pageSize: 25, showTotal: (t) => `${t} entries` }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={3}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Total</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">
                <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{fmt(totalFiltered)}</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} colSpan={4} />
            </Table.Summary.Row>
          )}
        />
      )}

      {/* Add / Edit Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Expense' : 'Add Expense'}
        width={460}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={creating || updating} onClick={handleSubmit}>
              {editing ? 'Update' : 'Save Expense'}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Expense Details
          </div>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="expenseDate" label="Date *" rules={[{ required: true, message: 'Required' }]}>
                <DatePicker format={DATE_FMT} style={{ width: '100%' }} size="middle" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="categoryId" label="Category *" rules={[{ required: true, message: 'Required' }]}>
                <Select placeholder="Select category" showSearch optionFilterProp="children" size="middle">
                  {categories.map((c: any) => (
                    <Option key={c.id} value={c.id}>{c.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input placeholder="What was this expense for?" maxLength={500} size="middle" />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="amount" label="Amount (₹) *" rules={[{ required: true, message: 'Required' }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="0.00"
                  min={0.01}
                  precision={2}
                                 />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="paymentMode" label="Payment Mode *" rules={[{ required: true, message: 'Required' }]}>
                <Select placeholder="Select mode" size="middle">
                  {PAYMENT_MODES.map(m => <Option key={m.value} value={m.value}>{m.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="referenceNumber" label="Reference / Receipt No.">
            <Input placeholder="e.g. Bill no., UPI ref, Cheque no." maxLength={100} size="middle" />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Manage Categories Modal */}
      <Modal
        title="Manage Expense Categories"
        open={catModalOpen}
        onCancel={() => setCatModalOpen(false)}
        footer={null}
        width={440}
      >
        <Form form={catForm} layout="inline" style={{ marginBottom: 16 }} onFinish={handleAddCategory}>
          <Form.Item
            name="name"
            rules={[
              { required: true, message: 'Required' },
              { pattern: /^(?=.*[a-zA-Z])[a-zA-Z0-9\s&\-(),/.'+]+$/, message: 'Must contain letters (e.g. Tea & Refreshments)' },
            ]}
            style={{ flex: 1 }}
          >
            <Input placeholder="e.g. Tea & Refreshments" maxLength={100} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={creatingCat} icon={<PlusOutlined />}>
              Add
            </Button>
          </Form.Item>
        </Form>
        <Divider style={{ margin: '8px 0 12px' }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {categories.map((c: any) => (
            <Tag
              key={c.id}
              closable
              onClose={() => deleteCategory(c.id)}
              style={{ fontSize: 13, padding: '3px 10px' }}
            >
              {c.name}
            </Tag>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default ExpensesPage;
