import React, { useState } from 'react';
import {
  Table, Button, Select, Space, message, Tag, Popconfirm, Modal, Tooltip,
} from 'antd';
import {
  CalculatorOutlined, CheckCircleOutlined, TrophyOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetCreditsQuery,
  useCalculateIncentivesMutation,
  useMarkCreditedMutation,
} from '../../store/api/incentiveApi';
import PageHeader from '../../components/PageHeader';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmt = (v: any) =>
  `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_CFG: Record<string, { color: string; label: string }> = {
  PENDING:  { color: 'orange', label: 'Pending'  },
  CREDITED: { color: 'green',  label: 'Credited' },
};

const IncentiveCreditsPage: React.FC = () => {
  const now = dayjs();
  const [month, setMonth] = useState(now.month() + 1);
  const [year, setYear] = useState(now.year());
  const [calcModalOpen, setCalcModalOpen] = useState(false);

  const { data, isLoading, refetch } = useGetCreditsQuery({ month, year });
  const [calculate, { isLoading: calculating }] = useCalculateIncentivesMutation();
  const [markCredited, { isLoading: crediting }] = useMarkCreditedMutation();

  const summary = data?.data;
  const credits: any[] = summary?.credits || [];
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.year() - 1 + i);

  const handleCalculate = async () => {
    try {
      await calculate({ targetMonth: month, targetYear: year }).unwrap();
      message.success(`Incentives calculated for ${MONTHS[month - 1]} ${year}`);
      setCalcModalOpen(false);
      refetch();
    } catch (err: any) {
      message.error(err?.data?.message || 'Calculation failed');
    }
  };

  const handleMarkCredited = async (id: string, name: string, brand: string) => {
    try {
      await markCredited(id).unwrap();
      message.success(`Incentive credited to ${name} — ${brand}`);
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to mark as credited');
    }
  };

  const pendingCount = credits.filter(c => c.status === 'PENDING').length;
  const creditedCount = credits.filter(c => c.status === 'CREDITED').length;

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
      title: 'Brand',
      dataIndex: 'brand',
      width: 140,
      render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: 'Target',
      dataIndex: 'targetValue',
      width: 130,
      align: 'right' as const,
      render: (v: any) => <span style={{ fontFamily: 'monospace' }}>{fmt(v)}</span>,
    },
    {
      title: 'Achieved',
      dataIndex: 'achievedValue',
      width: 130,
      align: 'right' as const,
      render: (v: any) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmt(v)}</span>,
    },
    {
      title: 'Achievement %',
      dataIndex: 'achievementPct',
      width: 120,
      align: 'right' as const,
      render: (v: any) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: Number(v) >= 100 ? '#059669' : Number(v) >= 80 ? '#2563eb' : '#d97706' }}>
          {Number(v || 0).toFixed(1)}%
        </span>
      ),
    },
    {
      title: 'Incentive',
      dataIndex: 'incentiveAmount',
      width: 130,
      align: 'right' as const,
      render: (v: any) => (
        <span style={{ fontWeight: 700, color: Number(v) > 0 ? '#059669' : '#94a3b8', fontFamily: 'monospace' }}>
          {fmt(v)}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (v: string, r: any) => {
        const cfg = STATUS_CFG[v] || { color: 'default', label: v };
        return (
          <div>
            <Tag color={cfg.color} style={{ margin: 0 }}>{cfg.label}</Tag>
            {v === 'CREDITED' && r.creditedAt && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                {dayjs(r.creditedAt).format('DD MMM YYYY')}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_: any, r: any) =>
        r.status === 'PENDING' && Number(r.incentiveAmount) > 0 ? (
          <Popconfirm
            title={`Mark ₹${Number(r.incentiveAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} as credited to ${r.salesPersonName}?`}
            onConfirm={() => handleMarkCredited(r.id, r.salesPersonName, r.brand)}
            okText="Credit"
            okButtonProps={{ type: 'primary' }}
          >
            <Button size="small" icon={<CheckCircleOutlined />} type="primary" ghost loading={crediting}>
              Mark Credited
            </Button>
          </Popconfirm>
        ) : r.status === 'PENDING' ? (
          <span style={{ fontSize: 12, color: '#94a3b8' }}>No incentive</span>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Incentive Credits"
        subtitle="Calculate and disburse monthly incentives to the sales team"
        action={
          <Space>
            <Select value={month} onChange={setMonth} style={{ width: 90 }}>
              {MONTHS.map((m, i) => <Select.Option key={i + 1} value={i + 1}>{m}</Select.Option>)}
            </Select>
            <Select value={year} onChange={setYear} style={{ width: 90 }}>
              {yearOptions.map(y => <Select.Option key={y} value={y}>{y}</Select.Option>)}
            </Select>
            <Button
              type="primary"
              icon={<CalculatorOutlined />}
              onClick={() => setCalcModalOpen(true)}
            >
              Calculate Incentives
            </Button>
          </Space>
        }
      />

      {credits.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          {[
            { label: 'Total Incentive', value: fmt(summary?.totalIncentive), color: '#059669' },
            { label: 'Credits Pending', value: pendingCount, color: '#d97706' },
            { label: 'Credits Disbursed', value: creditedCount, color: '#059669' },
            { label: 'Total Records', value: credits.length, color: '#6b7280' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 18px', minWidth: 150 }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {pendingCount > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <InfoCircleOutlined style={{ color: '#d97706', marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
            <strong>{pendingCount} incentive{pendingCount > 1 ? 's' : ''} pending disbursement.</strong>{' '}
            Review each record and click "Mark Credited" after transferring the incentive to the salesperson.
          </div>
        </div>
      )}

      <Table
        columns={columns}
        dataSource={credits}
        rowKey="id"
        loading={isLoading}
        size="middle"
        pagination={false}
        locale={{ emptyText: `No incentive records for ${MONTHS[month - 1]} ${year}. Click "Calculate Incentives" to generate.` }}
      />

      <Modal
        open={calcModalOpen}
        onCancel={() => setCalcModalOpen(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrophyOutlined style={{ color: '#059669' }} />
            <span>Calculate Incentives — {MONTHS[month - 1]} {year}</span>
          </div>
        }
        onOk={handleCalculate}
        okText="Calculate & Generate Records"
        okButtonProps={{ loading: calculating, type: 'primary' }}
        cancelText="Cancel"
      >
        <div style={{ padding: '8px 0' }}>
          <p style={{ color: '#374151', marginBottom: 12 }}>
            This will calculate achievement percentages for all brand targets in{' '}
            <strong>{MONTHS[month - 1]} {year}</strong> and generate incentive credit records.
          </p>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#166534' }}>
            <strong>Note:</strong> If records already exist for this period, they will be recalculated with the latest sales data.
            Only PENDING records are updated — already CREDITED incentives are preserved.
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default IncentiveCreditsPage;
