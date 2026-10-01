import React, { useState, useEffect } from 'react';
import {
  Table, Button, Select, Form, InputNumber, Space, message,
  Popconfirm, Modal, Tag,
} from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { hasPermission } from '../../utils/permissions';
import {
  useGetAllSlabsQuery,
  useGetDistinctBrandsQuery,
  useSaveSlabsMutation,
} from '../../store/api/incentiveApi';
import PageHeader from '../../components/PageHeader';

const fmt = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const IncentiveSlabPage: React.FC = () => {
  const [selectedBrand, setSelectedBrand] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editSlabs, setEditSlabs] = useState<{ fromPct: number | null; toPct: number | null; incentiveAmount: number | null }[]>([]);

  const { data: brandsData } = useGetDistinctBrandsQuery();
  const { data: allSlabsData, isLoading } = useGetAllSlabsQuery();
  const [saveSlabs, { isLoading: saving }] = useSaveSlabsMutation();

  const brands: Array<{ id: string; name: string }> = brandsData?.data || [];
  const allSlabs: any[] = allSlabsData?.data || [];

  const selectedSummary = allSlabs.find((s: any) => s.brandId === selectedBrand);

  const openEdit = (brandId: string) => {
    setSelectedBrand(brandId);
    const existing = allSlabs.find((s: any) => s.brandId === brandId);
    setEditSlabs(existing?.slabs?.map((s: any) => ({
      fromPct: s.fromPct,
      toPct: s.toPct,
      incentiveAmount: s.incentiveAmount,
    })) || [{ fromPct: 0, toPct: 79, incentiveAmount: 0 }]);
    setModalOpen(true);
  };

  const openNew = () => {
    setSelectedBrand(undefined);
    setEditSlabs([
      { fromPct: 0,   toPct: 79,   incentiveAmount: 0    },
      { fromPct: 80,  toPct: 99,   incentiveAmount: null },
      { fromPct: 100, toPct: 119,  incentiveAmount: null },
      { fromPct: 120, toPct: null, incentiveAmount: null },
    ]);
    setModalOpen(true);
  };

  const addRow = () => setEditSlabs(prev => [...prev, { fromPct: null, toPct: null, incentiveAmount: null }]);
  const removeRow = (i: number) => setEditSlabs(prev => prev.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: string, val: any) => {
    setEditSlabs(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  };

  const handleSave = async () => {
    if (!selectedBrand) { message.error('Select a brand'); return; }
    for (const s of editSlabs) {
      if (s.fromPct == null || s.incentiveAmount == null) {
        message.error('All slab rows must have From % and Incentive Amount');
        return;
      }
    }
    try {
      const brandName = brands.find(b => b.id === selectedBrand)?.name || selectedBrand;
      await saveSlabs({ brandId: selectedBrand, slabs: editSlabs }).unwrap();
      message.success(`Incentive slabs saved for ${brandName}`);
      setModalOpen(false);
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to save');
    }
  };

  const summaryColumns = [
    {
      title: 'Brand',
      dataIndex: 'brand',
      width: 200,
      render: (v: string) => <span style={{ fontWeight: 700 }}>{v}</span>,
    },
    {
      title: 'Incentive Slabs',
      key: 'slabs',
      render: (_: any, r: any) => (
        <Space size={6} wrap>
          {r.slabs?.map((s: any, i: number) => (
            <Tag key={i} color="blue" style={{ fontFamily: 'monospace', margin: 0 }}>
              {s.fromPct}%{s.toPct != null ? `–${s.toPct}%` : '+'} → {fmt(s.incentiveAmount)}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Max Incentive',
      key: 'max',
      width: 140,
      align: 'right' as const,
      render: (_: any, r: any) => {
        const max = Math.max(...(r.slabs?.map((s: any) => Number(s.incentiveAmount)) || [0]));
        return <span style={{ fontWeight: 700, color: '#059669', fontFamily: 'monospace' }}>{fmt(max)}</span>;
      },
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: any, r: any) => (
        <Button size="small" onClick={() => openEdit(r.brandId)}>Edit</Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Incentive Slabs"
        subtitle="Configure brand-wise incentive tiers based on achievement percentage"
        action={hasPermission('INCENTIVES_MANAGE') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
            Add Brand Slabs
          </Button>
        )}
      />

      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <InfoCircleOutlined style={{ color: '#2563eb', marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 13, color: '#1e40af', lineHeight: 1.6 }}>
          Define achievement percentage tiers per brand. When a salesperson's monthly sales hit a tier, they earn the corresponding incentive.
          Example: 80–99% achievement → ₹500 bonus, 100%+ → ₹1,500 bonus.
        </div>
      </div>

      <Table
        columns={summaryColumns}
        dataSource={allSlabs}
        rowKey="brand"
        loading={isLoading}
        size="middle"
        pagination={false}
        locale={{ emptyText: 'No incentive slabs configured. Click "Add Brand Slabs" to set up incentive tiers.' }}
      />

      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        title="Configure Incentive Slabs"
        width={640}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
              Save Slabs
            </Button>
          </div>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: '#374151' }}>Brand *</div>
          <Select
            value={selectedBrand}
            onChange={setSelectedBrand}
            placeholder="Select brand"
            showSearch
            style={{ width: '100%' }}
            options={brands.map((b) => ({ value: b.id, label: b.name }))}
          />
        </div>

        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 100px 1fr 40px', gap: 0, background: '#f8fafc', padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>
            {['From %', 'To %', 'Incentive Amount (₹)', ''].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</div>
            ))}
          </div>
          {editSlabs.map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 100px 1fr 40px', gap: 8, padding: '8px 12px', borderBottom: i < editSlabs.length - 1 ? '1px solid #f1f5f9' : 'none', alignItems: 'center' }}>
              <InputNumber
                value={row.fromPct}
                onChange={v => updateRow(i, 'fromPct', v)}
                min={0} max={999} placeholder="e.g. 80"
                style={{ width: '100%' }}
                formatter={v => `${v}%`}
                parser={(v: any) => v!.replace('%', '')}
              />
              <InputNumber
                value={row.toPct}
                onChange={v => updateRow(i, 'toPct', v)}
                min={0} max={999} placeholder="∞ (blank = max)"
                style={{ width: '100%' }}
                formatter={v => v != null ? `${v}%` : ''}
                parser={(v: any) => v ? v.replace('%', '') : null}
              />
              <InputNumber
                value={row.incentiveAmount}
                onChange={v => updateRow(i, 'incentiveAmount', v)}
                min={0} precision={2} placeholder="₹ 0.00"
                style={{ width: '100%' }}
                formatter={v => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(v: any) => v!.replace(/₹\s?|(,*)/g, '')}
              />
              <Popconfirm title="Remove this slab?" onConfirm={() => removeRow(i)} okText="Remove" okButtonProps={{ danger: true }}>
                <Button size="small" icon={<DeleteOutlined />} danger type="text" />
              </Popconfirm>
            </div>
          ))}
        </div>

        <Button type="dashed" block icon={<PlusOutlined />} onClick={addRow} style={{ marginTop: 12 }}>
          Add Tier
        </Button>

        <div style={{ marginTop: 12, fontSize: 12, color: '#64748b', lineHeight: 1.7 }}>
          <strong>Tip:</strong> Leave "To %" blank for the highest tier (unlimited achievement). Example: 120%+ → ₹3,000.
        </div>
      </Modal>
    </div>
  );
};

export default IncentiveSlabPage;
