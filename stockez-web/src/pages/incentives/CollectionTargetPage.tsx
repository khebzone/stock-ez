import React, { useState } from 'react';
import {
  Table, Button, Select, Form, InputNumber, Drawer, message,
  Tooltip, Progress,
} from 'antd';
import { PlusOutlined, EditOutlined, TrophyOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetCollectionTargetsSummaryQuery,
  useSaveCollectionTargetMutation,
} from '../../store/api/incentiveApi';
import { useGetUsersQuery } from '../../store/api/userApi';
import PageHeader from '../../components/PageHeader';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  ACHIEVED:         { color: '#059669', bg: '#ecfdf5', label: 'Achieved'    },
  NEAR_TARGET:      { color: '#2563eb', bg: '#eff6ff', label: 'Near Target' },
  NEEDS_ATTENTION:  { color: '#d97706', bg: '#fffbeb', label: 'Needs Attn' },
  AT_RISK:          { color: '#dc2626', bg: '#fef2f2', label: 'At Risk'     },
};

const StatusTag: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS_CFG[status] || { color: '#6b7280', bg: '#f3f4f6', label: status };
  return (
    <span style={{ background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: 11, padding: '2px 8px', borderRadius: 12 }}>
      {cfg.label}
    </span>
  );
};

const fmt = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CollectionTargetPage: React.FC = () => {
  const now = dayjs();
  const [month, setMonth] = useState(now.month() + 1);
  const [year, setYear]   = useState(now.year());
  const [filterPerson, setFilterPerson] = useState<string | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editRow, setEditRow] = useState<any>(null);
  const [form] = Form.useForm();

  const { data: targetsData, isLoading } = useGetCollectionTargetsSummaryQuery({ month, year, salesPersonId: filterPerson });
  const { data: usersData } = useGetUsersQuery();
  const [saveTarget, { isLoading: saving }] = useSaveCollectionTargetMutation();

  const targets: any[] = targetsData?.data?.targets || [];
  const users: any[] = (usersData?.data?.content || usersData?.data || []).filter((u: any) => u.roleName !== 'ADMIN' && u.active !== false);
  const summary = targetsData?.data;

  const openAdd = () => {
    setEditRow(null);
    form.resetFields();
    form.setFieldsValue({ targetMonth: month, targetYear: year });
    setDrawerOpen(true);
  };

  const openEdit = (row: any) => {
    setEditRow(row);
    form.setFieldsValue({
      salesPersonId: row.salesPersonId,
      targetMonth: row.targetMonth,
      targetYear: row.targetYear,
      targetValue: row.targetValue,
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await saveTarget(values).unwrap();
      message.success('Target saved');
      setDrawerOpen(false);
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to save');
    }
  };

  const columns = [
    {
      title: 'Sales Person',
      key: 'person',
      width: 180,
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.salesPersonName}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{r.salesPersonPhone}</div>
        </div>
      ),
    },
    {
      title: 'Collection Target',
      dataIndex: 'targetValue',
      width: 150,
      align: 'right' as const,
      render: (v: any) => <span style={{ fontFamily: 'monospace' }}>{fmt(v)}</span>,
    },
    {
      title: 'Collected',
      dataIndex: 'achievedValue',
      width: 150,
      align: 'right' as const,
      render: (v: any) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmt(v)}</span>,
    },
    {
      title: 'Achievement',
      key: 'pct',
      width: 200,
      render: (_: any, r: any) => {
        const pct = Math.min(Number(r.achievementPct || 0), 100);
        const cfg = STATUS_CFG[r.achievementStatus] || STATUS_CFG.AT_RISK;
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <StatusTag status={r.achievementStatus} />
              <span style={{ fontWeight: 700, color: cfg.color, fontSize: 13 }}>{Number(r.achievementPct || 0).toFixed(1)}%</span>
            </div>
            <Progress percent={pct} showInfo={false} strokeColor={cfg.color} trailColor="#e2e8f0" size="small" />
          </div>
        );
      },
    },
    {
      title: 'Incentive Earned',
      dataIndex: 'earnedIncentive',
      width: 140,
      align: 'right' as const,
      render: (v: any) => (
        <span style={{ fontWeight: 700, color: Number(v) > 0 ? '#059669' : '#94a3b8', fontFamily: 'monospace' }}>
          {fmt(v)}
        </span>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 48,
      render: (_: any, r: any) => (
        <Tooltip title="Edit target">
          <Button icon={<EditOutlined />} size="small" shape="circle" onClick={() => openEdit(r)} />
        </Tooltip>
      ),
    },
  ];

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.year() - 1 + i);

  return (
    <div>
      <PageHeader
        title="Collection Targets"
        subtitle="Set monthly payment collection targets and track achievement"
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Select value={month} onChange={setMonth} style={{ width: 90 }}>
              {MONTHS.map((m, i) => <Select.Option key={i+1} value={i+1}>{m}</Select.Option>)}
            </Select>
            <Select value={year} onChange={setYear} style={{ width: 90 }}>
              {yearOptions.map(y => <Select.Option key={y} value={y}>{y}</Select.Option>)}
            </Select>
            <Select allowClear placeholder="All salespersons" style={{ width: 190 }}
              value={filterPerson} onChange={setFilterPerson}
              showSearch optionFilterProp="label"
              options={users.map((u: any) => ({ value: u.id, label: u.roleName ? `${u.fullName} (${u.roleName})` : u.fullName }))} />
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Set Target</Button>
          </div>
        }
      />

      {summary && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          {[
            { label: 'Total Target',    value: fmt(summary.totalTarget),   color: '#0f172a' },
            { label: 'Total Collected', value: fmt(summary.totalAchieved), color: '#059669' },
            { label: 'Achievement',     value: summary.totalTarget > 0 ? `${(summary.totalAchieved * 100 / summary.totalTarget).toFixed(1)}%` : '—', color: '#2563eb' },
            { label: 'Targets Set',     value: targets.length,              color: '#6b7280' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 18px', minWidth: 140 }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <Table
        columns={columns}
        dataSource={targets}
        rowKey="id"
        loading={isLoading}
        size="middle"
        pagination={false}
        locale={{ emptyText: 'No collection targets set for this period. Click "Set Target" to begin.' }}
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editRow ? 'Edit Collection Target' : 'Set Collection Target'}
        width={420}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} icon={<TrophyOutlined />} onClick={handleSave}>Save Target</Button>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="salesPersonId" label="Sales Person *" rules={[{ required: true, message: 'Select a sales person' }]}>
            <Select placeholder="Select sales person" showSearch optionFilterProp="label"
              disabled={!!editRow}
              options={users.map((u: any) => ({ value: u.id, label: u.roleName ? `${u.fullName} (${u.roleName}) — ${u.phone}` : `${u.fullName} — ${u.phone}` }))} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="targetMonth" label="Month *" rules={[{ required: true }]}>
              <Select disabled={!!editRow}>
                {MONTHS.map((m, i) => <Select.Option key={i+1} value={i+1}>{m}</Select.Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="targetYear" label="Year *" rules={[{ required: true }]}>
              <Select disabled={!!editRow}>
                {yearOptions.map(y => <Select.Option key={y} value={y}>{y}</Select.Option>)}
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="targetValue" label="Collection Target (₹) *" rules={[{ required: true, message: 'Enter target value' }]}
            extra="Total payment amount the salesperson should collect this month">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="e.g. 200000"
              formatter={v => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(v: any) => v!.replace(/₹\s?|(,*)/g, '')} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default CollectionTargetPage;
