import React, { useState } from 'react';
import { Select, Modal, InputNumber, Form, Button, Skeleton, Progress, message } from 'antd';
import { TrophyOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetTargetsQuery, useCreateTargetMutation } from '../../store/api/reportApi';
import { useGetUsersQuery } from '../../store/api/userApi';
import { hasPermission } from '../../utils/permissions';

const fmt = (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
const fmtShort = (v: number) => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(1)}K` : `₹${v}`;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const achievementColor = (pct: number) =>
  pct >= 100 ? '#059669' : pct >= 75 ? '#2563eb' : pct >= 50 ? '#d97706' : '#dc2626';

const achievementBg = (pct: number) =>
  pct >= 100 ? '#ecfdf5' : pct >= 75 ? '#eff6ff' : pct >= 50 ? '#fffbeb' : '#fef2f2';

const achievementLabel = (pct: number) =>
  pct >= 100 ? 'Achieved' : pct >= 75 ? 'On Track' : pct >= 50 ? 'Needs Attention' : 'At Risk';

interface SetTargetModalProps {
  open: boolean;
  onClose: () => void;
  month: number;
  year: number;
  existing?: any;
}

const SetTargetModal: React.FC<SetTargetModalProps> = ({ open, onClose, month, year, existing }) => {
  const [form] = Form.useForm();
  const [createTarget, { isLoading }] = useCreateTargetMutation();
  const { data: usersData } = useGetUsersQuery();
  const allUsers: any[] = usersData?.data?.content || usersData?.data || [];
  const salesUsers = allUsers.filter((u: any) => u.active !== false && u.roleName !== 'ADMIN' && u.roleName !== 'SUPER_ADMIN');

  React.useEffect(() => {
    if (open && existing) {
      form.setFieldsValue({
        userId: existing.userId,
        targetAmount: existing.targetAmount,
        targetOrders: existing.targetOrders,
      });
    } else if (open) {
      form.resetFields();
    }
  }, [open, existing, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      await createTarget({ ...values, month, year }).unwrap();
      message.success('Target saved successfully');
      form.resetFields();
      onClose();
    } catch (e: any) {
      message.error(e?.data?.message || 'Failed to save target');
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={isLoading}
      title={
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
          {existing ? 'Edit Target' : 'Set New Target'} — {MONTHS[month - 1]} {year}
        </div>
      }
      okText="Save Target"
      width={440}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="userId" label="Salesperson" rules={[{ required: true, message: 'Required' }]}>
          <Select
            showSearch
            filterOption={(input, option) => (option?.label as string)?.toLowerCase().startsWith(input.toLowerCase())}
            placeholder="Select salesperson"
            disabled={!!existing}
            options={salesUsers.map((u: any) => ({ value: u.id, label: u.fullName || u.name }))}
          />
        </Form.Item>
        <Form.Item name="targetAmount" label="Revenue Target (₹)" rules={[{ required: true, message: 'Required' }]}>
          <InputNumber
            style={{ width: '100%' }}
            formatter={v => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={v => v!.replace(/₹\s?|(,*)/g, '') as any}
            min={0}
            step={10000}
            placeholder="e.g. 500000"
          />
        </Form.Item>
        <Form.Item name="targetOrders" label="Order Count Target" rules={[{ required: true, message: 'Required' }]}>
          <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 100" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

const TargetsPage: React.FC = () => {
  const now = dayjs();
  const [month, setMonth] = useState(now.month() + 1);
  const [year, setYear]   = useState(now.year());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<any>(null);

  const { data, isLoading } = useGetTargetsQuery({ month, year });
  const targets: any[] = data?.data?.targets || [];

  const totalTarget  = targets.reduce((s, t) => s + Number(t.targetAmount || 0), 0);
  const totalActual  = targets.reduce((s, t) => s + Number(t.achievedAmount || 0), 0);
  const overallPct   = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

  const yearOptions = Array.from({ length: 5 }, (_, i) => ({
    value: now.year() - 2 + i,
    label: String(now.year() - 2 + i),
  }));

  const openNew = () => { setEditingTarget(null); setModalOpen(true); };
  const openEdit = (t: any) => { setEditingTarget(t); setModalOpen(true); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>Sales Targets</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>Monthly achievement tracking for salesmen</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Select
            value={month}
            onChange={setMonth}
            style={{ width: 140 }}
            options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
          />
          <Select
            value={year}
            onChange={setYear}
            style={{ width: 100 }}
            options={yearOptions}
          />
          {hasPermission('INCENTIVES_MANAGE') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openNew}
              style={{ borderRadius: 8, background: '#2563eb', fontWeight: 600 }}>
              Set Target
            </Button>
          )}
        </div>
      </div>

      {/* Overall summary card */}
      {!isLoading && targets.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Overall Achievement — {MONTHS[month - 1]} {year}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: achievementColor(overallPct), marginTop: 4, letterSpacing: -0.5 }}>
                {overallPct}%
              </div>
            </div>
            <div style={{ display: 'flex', gap: 32 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Target</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{fmtShort(totalTarget)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Achieved</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: achievementColor(overallPct), marginTop: 2 }}>{fmtShort(totalActual)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Remaining</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#64748b', marginTop: 2 }}>{fmtShort(Math.max(0, totalTarget - totalActual))}</div>
              </div>
            </div>
          </div>
          <Progress
            percent={Math.min(overallPct, 100)}
            strokeColor={achievementColor(overallPct)}
            trailColor="#f1f5f9"
            strokeWidth={10}
            showInfo={false}
            style={{ marginBottom: 0 }}
          />
        </div>
      )}

      {/* Salesman cards grid */}
      {isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : (
        targets.length === 0 ? (
          <div style={{ background: '#f8fafc', borderRadius: 16, padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
            <TrophyOutlined style={{ fontSize: 48, marginBottom: 14, display: 'block', color: '#cbd5e1' }} />
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: '#64748b' }}>No targets set for {MONTHS[month - 1]} {year}</div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>Set monthly targets for your sales team to track performance</div>
            {hasPermission('INCENTIVES_MANAGE') && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openNew}
                style={{ borderRadius: 8, background: '#2563eb' }}>
                Set First Target
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Table */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 20px' }}>
                {['Salesman', 'Target', 'Achieved', 'Orders', 'Achievement %', ''].map(h => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
                ))}
              </div>

              {targets.map((t: any, i: number) => {
                const pct   = t.targetAmount > 0 ? Math.round((t.achievedAmount / t.targetAmount) * 100) : 0;
                const color = achievementColor(pct);
                const bg    = achievementBg(pct);
                return (
                  <div key={t.id || t.userName} style={{
                    display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px',
                    padding: '16px 20px', alignItems: 'center',
                    borderBottom: i < targets.length - 1 ? '1px solid #f1f5f9' : 'none',
                  }}>
                    {/* Salesman */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 10,
                        background: `${color}18`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, color, fontSize: 15, flexShrink: 0,
                      }}>
                        {(t.userName || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{t.userName}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{t.userRole}</div>
                      </div>
                    </div>

                    {/* Target */}
                    <div style={{ fontWeight: 700, color: '#475569', fontSize: 14 }}>{fmt(t.targetAmount)}</div>

                    {/* Achieved */}
                    <div style={{ fontWeight: 800, color, fontSize: 14 }}>{fmt(t.achievedAmount || 0)}</div>

                    {/* Orders */}
                    <div>
                      <div style={{ fontWeight: 600, color: '#475569' }}>
                        {t.achievedOrders || 0}
                        {t.targetOrders > 0 && (
                          <span style={{ color: '#94a3b8', fontWeight: 400 }}> / {t.targetOrders}</span>
                        )}
                      </div>
                    </div>

                    {/* Achievement % + progress */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{
                          fontSize: 16, fontWeight: 900, color,
                        }}>
                          {pct}%
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, color,
                          background: bg, borderRadius: 20,
                          padding: '2px 8px', letterSpacing: 0.3,
                        }}>
                          {achievementLabel(pct)}
                        </span>
                      </div>
                      <Progress
                        percent={Math.min(pct, 100)}
                        strokeColor={color}
                        trailColor="#f1f5f9"
                        strokeWidth={6}
                        showInfo={false}
                        style={{ marginBottom: 0 }}
                      />
                    </div>

                    {/* Edit */}
                    {hasPermission('INCENTIVES_MANAGE') && (
                      <div style={{ textAlign: 'right' }}>
                        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(t)}
                          style={{ borderRadius: 6, fontSize: 12 }}>
                          Edit
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Footer */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px', padding: '14px 20px', borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>Total ({targets.length} salesmen)</div>
                <div style={{ fontWeight: 800, color: '#475569', fontSize: 14 }}>{fmt(totalTarget)}</div>
                <div style={{ fontWeight: 800, color: achievementColor(overallPct), fontSize: 14 }}>{fmt(totalActual)}</div>
                <div style={{ fontWeight: 600, color: '#475569' }}>
                  {targets.reduce((s, t) => s + (t.achievedOrders || 0), 0)}
                </div>
                <div style={{ fontWeight: 900, color: achievementColor(overallPct), fontSize: 16 }}>{overallPct}%</div>
                <div />
              </div>
            </div>

            {/* Achievement breakdown bar */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15, marginBottom: 16 }}>Achievement Distribution</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[
                  { label: '≥ 100%', color: '#059669', bg: '#ecfdf5', count: targets.filter(t => t.targetAmount > 0 && (t.achievedAmount / t.targetAmount) >= 1).length },
                  { label: '75–99%', color: '#2563eb', bg: '#eff6ff', count: targets.filter(t => { const p = t.targetAmount > 0 ? t.achievedAmount / t.targetAmount : 0; return p >= 0.75 && p < 1; }).length },
                  { label: '50–74%', color: '#d97706', bg: '#fffbeb', count: targets.filter(t => { const p = t.targetAmount > 0 ? t.achievedAmount / t.targetAmount : 0; return p >= 0.5 && p < 0.75; }).length },
                  { label: '< 50%',  color: '#dc2626', bg: '#fef2f2', count: targets.filter(t => t.targetAmount > 0 && (t.achievedAmount / t.targetAmount) < 0.5).length },
                ].map(b => (
                  <div key={b.label} style={{ background: b.bg, borderRadius: 12, border: `1px solid ${b.color}30`, padding: '14px 20px', flex: 1, minWidth: 100 }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: b.color }}>{b.count}</div>
                    <div style={{ fontSize: 12, color: b.color, fontWeight: 600, marginTop: 2 }}>{b.label}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>salesmen</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )
      )}

      <SetTargetModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTarget(null); }}
        month={month}
        year={year}
        existing={editingTarget}
      />
    </div>
  );
};

export default TargetsPage;
