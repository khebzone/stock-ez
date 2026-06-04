import React, { useState } from 'react';
import { Table, DatePicker, Select, Input, Button, Space, Tag } from 'antd';
import { SearchOutlined, FileExcelOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetAuditReportQuery } from '../../store/api/auditApi';
import PageHeader from '../../components/PageHeader';
import { exportToXLSX } from '../../components/TableToolbar';

const { RangePicker } = DatePicker;

const ENTITY_TYPES = [
  { value: '',              label: 'All Types' },
  { value: 'ORDER',         label: 'Order' },
  { value: 'CUSTOMER',      label: 'Customer' },
  { value: 'PRODUCT',       label: 'Product' },
  { value: 'GOODS_RETURN',  label: 'Goods Return' },
  { value: 'PAYMENT',       label: 'Payment' },
  { value: 'USER',          label: 'User' },
  { value: 'EXPENSE',       label: 'Expense' },
  { value: 'SUPPLIER',      label: 'Supplier' },
];

const ENTITY_TAG_COLOR: Record<string, string> = {
  ORDER:        'blue',
  CUSTOMER:     'green',
  PRODUCT:      'orange',
  GOODS_RETURN: 'red',
  PAYMENT:      'cyan',
  USER:         'purple',
  EXPENSE:      'geekblue',
  SUPPLIER:     'volcano',
};

const ACTION_COLOR: Record<string, string> = {
  CREATED:           '#059669',
  APPROVED:          '#059669',
  DELIVERED:         '#059669',
  PAYMENT_COLLECTED: '#059669',
  PAYMENT_CLEARED:   '#059669',
  COUNTER_SALE:      '#059669',
  UPDATED:           '#2563eb',
  ASSIGNED:          '#2563eb',
  PREPARING:         '#2563eb',
  PREPARED:          '#2563eb',
  DISPATCHED:        '#2563eb',
  CANCELLED:         '#dc2626',
  DELETED:           '#dc2626',
  DEACTIVATED:       '#dc2626',
  REACTIVATED:       '#d97706',
};

const AuditReportPage: React.FC = () => {
  const [range, setRange]               = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().subtract(30, 'day'), dayjs()]);
  const [entityType, setEntityType]     = useState('');
  const [performedBy, setPerformedBy]   = useState('');
  const [action, setAction]             = useState('');
  const [currentPage, setCurrentPage]   = useState(0);

  const [activeFilters, setActiveFilters] = useState({
    from: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    to:   dayjs().format('YYYY-MM-DD'),
    entityType: '', performedBy: '', action: '', page: 0,
  });

  const { data, isLoading, isFetching } = useGetAuditReportQuery(activeFilters);
  const paged = data?.data;
  const rows: any[] = paged?.content || [];

  const applyFilters = () => {
    const filters = {
      from: range[0].format('YYYY-MM-DD'),
      to:   range[1].format('YYYY-MM-DD'),
      entityType: entityType || '',
      performedBy: performedBy.trim(),
      action: action.trim(),
      page: 0,
    };
    setCurrentPage(0);
    setActiveFilters(filters);
  };

  const changePage = (newPage: number) => {
    setCurrentPage(newPage - 1);
    setActiveFilters(f => ({ ...f, page: newPage - 1 }));
  };

  const exportCols = [
    { title: 'Timestamp',    key: 'performedAt',  dataIndex: 'performedAt' },
    { title: 'Entity Type',  key: 'entityType',   dataIndex: 'entityType' },
    { title: 'Action',       key: 'action',       dataIndex: 'action' },
    { title: 'Description',  key: 'description',  dataIndex: 'description' },
    { title: 'Performed By', key: 'performedBy',  dataIndex: 'performedBy' },
  ];

  const exportRows = rows.map(r => ({
    ...r,
    performedAt: dayjs(r.performedAt).format('DD MMM YYYY HH:mm:ss'),
  }));

  return (
    <div>
      <PageHeader
        title="Audit Report"
        subtitle="Complete activity log — who did what and when"
        action={
          <Button
            icon={<FileExcelOutlined />}
            onClick={() => exportToXLSX(exportRows, exportCols, `audit-${activeFilters.from}`, 'Audit Log')}
            disabled={rows.length === 0}
            style={{ color: '#059669', borderColor: '#059669' }}
          >
            Export Excel
          </Button>
        }
      />

      {/* Filters */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
        padding: '16px 20px', marginBottom: 16,
        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Date Range</div>
          <RangePicker
            value={range}
            onChange={v => v && setRange(v as [dayjs.Dayjs, dayjs.Dayjs])}
            format="DD MMM YYYY"
            allowClear={false}
            style={{ borderRadius: 8 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Entity Type</div>
          <Select
            value={entityType} onChange={setEntityType}
            style={{ width: 150 }} options={ENTITY_TYPES}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Performed By</div>
          <Input
            placeholder="Name..." value={performedBy}
            onChange={e => setPerformedBy(e.target.value)}
            style={{ width: 160 }} allowClear
            onPressEnter={applyFilters}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Action</div>
          <Input
            placeholder="e.g. APPROVED" value={action}
            onChange={e => setAction(e.target.value.toUpperCase())}
            style={{ width: 140 }} allowClear
            onPressEnter={applyFilters}
          />
        </div>
        <Space>
          <Button type="primary" icon={<SearchOutlined />} onClick={applyFilters}>
            Search
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => {
            setRange([dayjs().subtract(30, 'day'), dayjs()]);
            setEntityType('');
            setPerformedBy('');
            setAction('');
            const reset = { from: dayjs().subtract(30, 'day').format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD'), entityType: '', performedBy: '', action: '', page: 0 };
            setCurrentPage(0);
            setActiveFilters(reset);
          }}>
            Reset
          </Button>
        </Space>
      </div>

      <Table
        size="small"
        dataSource={rows}
        rowKey="id"
        loading={isLoading || isFetching}
        pagination={{
          current: currentPage + 1,
          pageSize: 50,
          total: paged?.totalElements || 0,
          onChange: changePage,
          showSizeChanger: false,
          showTotal: (total) => `${total} entries`,
        }}
        locale={{ emptyText: <div style={{ padding: '32px 0', color: '#94a3b8' }}>No audit entries for selected filters</div> }}
        columns={[
          {
            title: 'Timestamp',
            dataIndex: 'performedAt',
            key: 'time',
            width: 165,
            render: (v: string) => (
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#374151' }}>
                {dayjs(v).format('DD MMM YYYY HH:mm:ss')}
              </span>
            ),
          },
          {
            title: 'Entity Type',
            dataIndex: 'entityType',
            key: 'entity',
            width: 130,
            render: (v: string) => (
              <Tag color={ENTITY_TAG_COLOR[v] || 'default'} style={{ fontWeight: 600, borderRadius: 6 }}>
                {v?.replace('_', ' ')}
              </Tag>
            ),
          },
          {
            title: 'Action',
            dataIndex: 'action',
            key: 'action',
            width: 160,
            render: (v: string) => (
              <span style={{
                fontWeight: 700, fontSize: 12,
                color: ACTION_COLOR[v] || '#374151',
              }}>
                {v?.replace(/_/g, ' ')}
              </span>
            ),
          },
          {
            title: 'Description',
            dataIndex: 'description',
            key: 'desc',
            render: (v: string) => (
              <span style={{ fontSize: 13, color: '#0f172a' }}>{v}</span>
            ),
          },
          {
            title: 'Performed By',
            dataIndex: 'performedBy',
            key: 'by',
            width: 160,
            render: (v: string) => (
              <span style={{ fontSize: 12, color: '#4b5563', fontWeight: 500 }}>{v || '—'}</span>
            ),
          },
        ]}
      />
    </div>
  );
};

export default AuditReportPage;
