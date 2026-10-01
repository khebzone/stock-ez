import React, { useState, useEffect } from 'react';
import {
  Card, Tabs, Input, Button, Popconfirm, message, Tag, Empty, Spin,
  Select, InputNumber,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, TagOutlined, AppstoreOutlined,
  CalculatorOutlined, InboxOutlined, RightOutlined, DownOutlined,
  FolderOutlined, WalletOutlined,
} from '@ant-design/icons';

import {
  useGetMastersQuery, useCreateMasterMutation, useDeleteMasterMutation,
} from '../../store/api/productMasterApi';
import { hasPermission } from '../../utils/permissions';
import {
  useGetPaymentMethodsQuery, useCreatePaymentMethodMutation, useDeletePaymentMethodMutation,
} from '../../store/api/paymentMethodApi';
import PageHeader from '../../components/PageHeader';

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 480);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 480);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hasLetter = (name: string) => /[a-zA-Z]/.test(name);
const hasOnlyAllowedChars = (name: string) => /^[a-zA-Z0-9\s\-\.&'\/,()]+$/.test(name);

// Auto-detect payment mode from display name
const detectMode = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes('neft') || n.includes('rtgs') || n.includes('imps') ||
      n.includes('transfer') || n.includes('online') || n.includes('bank'))  return 'NEFT';
  if (n.includes('gpay') || n.includes('google pay') || n.includes('phonepay') ||
      n.includes('phonepe') || n.includes('paytm') || n.includes('upi') ||
      n.includes('bhim'))                             return 'UPI';
  if (n.includes('cheque') || n.includes('check'))   return 'CHEQUE';
  if (n.includes('credit') || n.includes('due') || n.includes('udhar')) return 'CREDIT';
  return 'CASH';
};

const MODE_COLOR: Record<string, { color: string; bg: string }> = {
  CASH:   { color: '#059669', bg: '#ecfdf5' },
  UPI:    { color: '#7c3aed', bg: '#f5f3ff' },
  CHEQUE: { color: '#d97706', bg: '#fffbeb' },
  NEFT:   { color: '#0891b2', bg: '#ecfeff' },
  RTGS:   { color: '#2563eb', bg: '#eff6ff' },
  CREDIT: { color: '#ef4444', bg: '#fef2f2' },
};

// ─── Brands / Units tabs ──────────────────────────────────────────────────────

const SIMPLE_TYPES = [
  { key: 'BRAND', label: 'Brands', icon: <TagOutlined />,   color: '#7c3aed', bg: '#f5f3ff', placeholder: 'e.g. AACHI, MTR, Sakthi, Fortune' },
  { key: 'UNIT',  label: 'Units',  icon: <InboxOutlined />, color: '#d97706', bg: '#fffbeb', placeholder: 'e.g. PKT, KG, LITRE, BOX, BAG' },
];

const FlatMasterTab: React.FC<{ masterType: typeof SIMPLE_TYPES[0] }> = ({ masterType }) => {
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState('');
  const { data, isLoading } = useGetMastersQuery(masterType.key);
  const [createMaster, { isLoading: creating }] = useCreateMasterMutation();
  const [deleteMaster] = useDeleteMasterMutation();
  const items = data?.data || [];
  const singular = masterType.label.slice(0, -1);
  const isMobile = useIsMobile();

  const validate = (name: string): string => {
    if (!name) return `${singular} name is required`;
    if (name.length < 2) return `Must be at least 2 characters`;
    if (!hasLetter(name)) return 'Name must contain letters — it cannot be only numbers';
    if (!hasOnlyAllowedChars(name)) return `Special characters like @, #, $, !, % are not allowed`;
    if (items.some((i: any) => i.name.toLowerCase() === name.toLowerCase())) return `"${name}" already exists`;
    return '';
  };

  const handleChange = (val: string) => {
    setNewName(val);
    if (nameError) setNameError(validate(val.trim()));
  };

  const handleAdd = async () => {
    const name = newName.trim();
    const err = validate(name);
    if (err) { setNameError(err); return; }
    setNameError('');
    try {
      await createMaster({ type: masterType.key, name }).unwrap();
      setNewName('');
      message.success(`${singular} "${name}" added`);
    } catch (e: any) {
      const errMsg = e?.data?.message || '';
      if (errMsg.toLowerCase().includes('duplicate') || errMsg.toLowerCase().includes('exists')) {
        setNameError(`"${name}" already exists`);
      } else {
        setNameError(errMsg || `Failed to add ${singular.toLowerCase()}`);
      }
    }
  };

  return (
    <div>
      <Card style={{ borderRadius: 12, marginBottom: 16, background: masterType.bg, border: `1.5px solid ${masterType.color}22` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: masterType.color, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Add New {masterType.label.slice(0, -1)}
        </div>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, width: '100%' }}>
            <Input
              value={newName} onChange={e => handleChange(e.target.value)}
              placeholder={masterType.placeholder}
              onPressEnter={handleAdd}
              size="large" style={{ borderRadius: 10 }}
              maxLength={100}
              status={nameError ? 'error' : ''}
            />
            {nameError && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{nameError}</div>}
          </div>
          {hasPermission('MASTERS_MANAGE') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} loading={creating} size="large"
              style={{ borderRadius: 10, background: masterType.color, border: 'none', fontWeight: 700, width: isMobile ? '100%' : 'auto', flexShrink: 0 }}>
              Add {singular}
            </Button>
          )}
        </div>
      </Card>

      <Card style={{ borderRadius: 12, border: '1px solid #e8ecf0' }} styles={{ body: { padding: 0 } }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
        ) : items.length === 0 ? (
          <Empty description={`No ${masterType.label.toLowerCase()} yet`} style={{ padding: '40px 0' }} />
        ) : (
          items.map((item: any, idx: number) => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px',
              borderBottom: idx < items.length - 1 ? '1px solid #f1f5f9' : 'none',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: masterType.bg, border: `1.5px solid ${masterType.color}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: masterType.color, fontSize: 13,
              }}>
                {masterType.icon}
              </div>
              <div style={{ flex: 1, fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{item.name}</div>
              {hasPermission('MASTERS_MANAGE') && (
                <Popconfirm title={`Remove "${item.name}"?`} description="This cannot be undone." okText="Remove" okButtonProps={{ danger: true }}
                  onConfirm={async () => {
                    try { await deleteMaster({ id: item.id, type: masterType.key }).unwrap(); message.success(`"${item.name}" removed`); }
                    catch (err: any) { message.error(err?.data?.message || `Cannot remove "${item.name}". It may be in use.`); }
                  }}>
                  <Button icon={<DeleteOutlined />} size="small" shape="circle" danger type="text" />
                </Popconfirm>
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  );
};

// ─── GST / Tax Rates tab ──────────────────────────────────────────────────────

const TaxRatesTab: React.FC = () => {
  const [rateValue, setRateValue] = useState<number | null>(null);
  const { data, isLoading } = useGetMastersQuery('TAX_RATE');
  const [createMaster, { isLoading: creating }] = useCreateMasterMutation();
  const [deleteMaster] = useDeleteMasterMutation();
  const items: any[] = data?.data || [];
  const existingValues = items.map((i: any) => Number(i.value));
  const isMobile = useIsMobile();

  const handleAdd = async () => {
    if (rateValue === null || rateValue === undefined) { message.warning('Please enter a GST rate percentage'); return; }
    if (rateValue < 0 || rateValue > 100) { message.warning('GST rate must be between 0% and 100%'); return; }
    if (existingValues.includes(rateValue)) { message.error(`${rateValue}% GST is already added. Each rate can only be added once.`); return; }
    const name = `${rateValue}%`;
    try {
      await createMaster({ type: 'TAX_RATE', name, value: String(rateValue) }).unwrap();
      setRateValue(null);
      message.success(`GST ${name} added successfully`);
    } catch (err: any) {
      const errMsg = err?.data?.message;
      if (errMsg?.toLowerCase().includes('duplicate') || errMsg?.toLowerCase().includes('exists')) {
        message.error(`${name} GST rate already exists.`);
      } else {
        message.error(errMsg || 'Failed to add GST rate. Please try again.');
      }
    }
  };

  return (
    <div>
      <Card style={{ borderRadius: 12, marginBottom: 16, background: '#fef2f2', border: '1.5px solid #dc262622' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Add GST Rate
        </div>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10 }}>
          <InputNumber
            value={rateValue} onChange={v => setRateValue(v as number | null)}
            placeholder="Enter rate e.g. 18"
            min={0} max={100} step={0.5}
            size="large" style={{ width: isMobile ? '100%' : 180, borderRadius: 10 }}
            addonAfter="%"
            onPressEnter={handleAdd}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} loading={creating} size="large"
            disabled={rateValue === null}
            style={{ borderRadius: 10, background: '#dc2626', border: 'none', fontWeight: 700, width: isMobile ? '100%' : 'auto' }}>
            Add Rate
          </Button>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: '#78350f' }}>
          Common rates: 0, 5, 12, 18, 28. You can also enter custom rates like 3 or 0.25.
        </div>
      </Card>

      <Card style={{ borderRadius: 12, border: '1px solid #e8ecf0' }} styles={{ body: { padding: 0 } }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
        ) : items.length === 0 ? (
          <Empty description="No GST rates added yet" style={{ padding: '40px 0' }} />
        ) : (
          items.map((item: any, idx: number) => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px',
              borderBottom: idx < items.length - 1 ? '1px solid #f1f5f9' : 'none',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{
                width: 44, height: 34, borderRadius: 9, flexShrink: 0,
                background: '#fef2f2', border: '1.5px solid #dc262633',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#dc2626', fontWeight: 800, fontSize: 14,
              }}>
                {item.name}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>GST {item.name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  {(() => { const v = item.value != null && item.value !== '' ? Number(item.value) : parseFloat(item.name); const half = v / 2; return `CGST ${half}% + SGST ${half}%`; })()}
                </div>
              </div>
              <Popconfirm title={`Remove ${item.name} GST?`} description="Products using this rate will not be affected." okText="Remove" okButtonProps={{ danger: true }}
                onConfirm={async () => {
                  try { await deleteMaster({ id: item.id, type: 'TAX_RATE' }).unwrap(); message.success(`GST ${item.name} removed`); }
                  catch (err: any) { message.error(err?.data?.message || `Cannot remove ${item.name} GST. It may be in use by products.`); }
                }}>
                <Button icon={<DeleteOutlined />} size="small" shape="circle" danger type="text" />
              </Popconfirm>
            </div>
          ))
        )}
      </Card>
    </div>
  );
};

// ─── Categories tab ───────────────────────────────────────────────────────────

const CategoryRow: React.FC<{
  category: any; subCategories: any[];
  onDeleteCategory: (item: any) => void;
}> = ({ category, subCategories, onDeleteCategory }) => {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [subName, setSubName] = useState('');
  const [subError, setSubError] = useState('');
  const [createMaster, { isLoading: creating }] = useCreateMasterMutation();
  const [deleteMaster] = useDeleteMasterMutation();
  const isMobile = useIsMobile();

  const validateSub = (name: string): string => {
    if (!name) return 'Sub-category name is required';
    if (name.length < 2) return 'Must be at least 2 characters';
    if (!hasLetter(name)) return 'Name must contain letters — it cannot be only numbers';
    if (!hasOnlyAllowedChars(name)) return `Special characters like @, #, $, !, % are not allowed`;
    if (subCategories.some((s: any) => s.name.toLowerCase() === name.toLowerCase())) return `"${name}" already exists under ${category.name}`;
    return '';
  };

  const handleAddSub = async () => {
    const name = subName.trim();
    const err = validateSub(name);
    if (err) { setSubError(err); return; }
    setSubError('');
    try {
      await createMaster({ type: 'SUB_CATEGORY', name, parentId: category.id }).unwrap();
      setSubName(''); setAdding(false);
      message.success(`"${name}" added under ${category.name}`);
    } catch (e: any) {
      const errMsg = e?.data?.message || '';
      setSubError(errMsg.toLowerCase().includes('duplicate') || errMsg.toLowerCase().includes('exists')
        ? `"${name}" already exists under ${category.name}`
        : errMsg || 'Failed to add sub-category');
    }
  };

  return (
    <div style={{ border: '1px solid #e8ecf0', borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
          background: expanded ? '#f0fdf9' : '#fff', cursor: 'pointer',
          borderBottom: expanded ? '1px solid #d1fae5' : 'none', transition: 'background 0.2s',
        }}
        onClick={() => setExpanded(v => !v)}
      >
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: '#ecfeff', border: '1.5px solid #0891b233',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#0891b2', fontSize: 14,
        }}>
          <AppstoreOutlined />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{category.name}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
            {subCategories.length} sub-categor{subCategories.length === 1 ? 'y' : 'ies'}
          </div>
        </div>
        {!isMobile && (
          <Button size="small" type="text" icon={<PlusOutlined />}
            style={{ color: '#059669', fontWeight: 600, fontSize: 12, marginRight: 4, flexShrink: 0 }}
            onClick={e => { e.stopPropagation(); setExpanded(true); setAdding(true); }}
          >
            Add Sub Category
          </Button>
        )}
        <Popconfirm
          title={`Remove category "${category.name}"?`}
          description={subCategories.length > 0 ? `This will also remove ${subCategories.length} sub-categorie(s)` : undefined}
          okText="Remove" okButtonProps={{ danger: true }}
          onConfirm={e => { (e as any)?.stopPropagation?.(); onDeleteCategory(category); }}
        >
          <Button icon={<DeleteOutlined />} size="small" shape="circle" danger type="text"
            onClick={e => e.stopPropagation()} />
        </Popconfirm>
        <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 2, flexShrink: 0 }}>
          {expanded ? <DownOutlined /> : <RightOutlined />}
        </span>
      </div>

      {expanded && (
        <div style={{ background: '#f8fafc', padding: isMobile ? '12px 14px' : '14px 18px 14px 56px' }}>
          {isMobile && !adding && (
            <Button size="small" type="dashed" icon={<PlusOutlined />}
              style={{ color: '#059669', borderColor: '#059669', borderRadius: 8, marginBottom: 12, width: '100%' }}
              onClick={() => setAdding(true)}
            >
              Add Sub-Category
            </Button>
          )}
          {adding && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <Input
                    value={subName}
                    onChange={e => { setSubName(e.target.value); if (subError) setSubError(validateSub(e.target.value.trim())); }}
                    placeholder={`Sub-category name under ${category.name}`}
                    onPressEnter={handleAddSub} autoFocus size="middle"
                    maxLength={100}
                    status={subError ? 'error' : ''}
                    style={{ borderRadius: 8, border: `1.5px solid ${subError ? '#ef4444' : '#059669'}` }}
                  />
                  {subError && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{subError}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button type="primary" size="middle" loading={creating} onClick={handleAddSub}
                    style={{ background: '#059669', border: 'none', borderRadius: 8, fontWeight: 600, flex: isMobile ? 1 : 'none' }}>
                    Add
                  </Button>
                  <Button size="middle" onClick={() => { setAdding(false); setSubName(''); setSubError(''); }}
                    style={{ borderRadius: 8, flex: isMobile ? 1 : 'none' }}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {subCategories.length === 0 && !adding ? (
            <div style={{ color: '#94a3b8', fontSize: 13, padding: '8px 0' }}>
              No sub-categories yet —{' '}
              {!isMobile && (
                <Button type="link" size="small" onClick={() => setAdding(true)}
                  style={{ color: '#059669', padding: '0 4px' }}>
                  Add one
                </Button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {subCategories.map((sub: any) => (
                <div key={sub.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: '#ecfdf5', border: '1px solid #a7f3d0',
                  borderRadius: 8, padding: '5px 10px 5px 12px',
                }}>
                  <FolderOutlined style={{ color: '#059669', fontSize: 11 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#065f46' }}>{sub.name}</span>
                  <Popconfirm title={`Remove "${sub.name}"?`} okText="Remove" okButtonProps={{ danger: true }}
                    onConfirm={async () => {
                      try { await deleteMaster({ id: sub.id, type: 'SUB_CATEGORY' }).unwrap(); message.success(`"${sub.name}" removed`); }
                      catch (err: any) { message.error(err?.data?.message || `Cannot remove "${sub.name}". Please try again.`); }
                    }}>
                    <Button icon={<DeleteOutlined />} type="text" size="small" danger
                      style={{ width: 18, height: 18, minWidth: 18, padding: 0, fontSize: 10 }} />
                  </Popconfirm>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CategoriesTab: React.FC = () => {
  const [newCatName, setNewCatName] = useState('');
  const [catError, setCatError] = useState('');
  const { data: catData, isLoading: catLoading } = useGetMastersQuery('CATEGORY');
  const { data: subData } = useGetMastersQuery('SUB_CATEGORY');
  const [createMaster, { isLoading: creating }] = useCreateMasterMutation();
  const [deleteMaster] = useDeleteMasterMutation();
  const isMobile = useIsMobile();

  const categories: any[] = catData?.data || [];
  const allSubCategories: any[] = subData?.data || [];

  const validateCat = (name: string): string => {
    if (!name) return 'Category name is required';
    if (name.length < 2) return 'Must be at least 2 characters';
    if (!hasLetter(name)) return 'Name must contain letters — it cannot be only numbers';
    if (!hasOnlyAllowedChars(name)) return `Special characters like @, #, $, !, % are not allowed`;
    if (categories.some((c: any) => c.name.toLowerCase() === name.toLowerCase())) return `"${name}" already exists`;
    return '';
  };

  const handleAddCategory = async () => {
    const name = newCatName.trim();
    const err = validateCat(name);
    if (err) { setCatError(err); return; }
    setCatError('');
    try {
      await createMaster({ type: 'CATEGORY', name }).unwrap();
      setNewCatName('');
      message.success(`Category "${name}" added`);
    } catch (e: any) {
      const errMsg = e?.data?.message || '';
      setCatError(errMsg.toLowerCase().includes('duplicate') || errMsg.toLowerCase().includes('exists')
        ? `"${name}" already exists`
        : errMsg || 'Failed to add category');
    }
  };

  const handleDeleteCategory = async (cat: any) => {
    try {
      await deleteMaster({ id: cat.id, type: 'CATEGORY' }).unwrap();
      const subs = allSubCategories.filter((s: any) => s.parentId === cat.id);
      await Promise.all(subs.map((s: any) => deleteMaster({ id: s.id, type: 'SUB_CATEGORY' }).unwrap()));
      message.success(`Category "${cat.name}" and its sub-categories removed`);
    } catch (err: any) { message.error(err?.data?.message || `Cannot remove "${cat.name}". Please try again.`); }
  };

  return (
    <div>
      <Card style={{ borderRadius: 12, marginBottom: 16, background: '#ecfeff', border: '1.5px solid #0891b222' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#0891b2', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Add New Category
        </div>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, width: '100%' }}>
            <Input
              value={newCatName}
              onChange={e => { setNewCatName(e.target.value); if (catError) setCatError(validateCat(e.target.value.trim())); }}
              placeholder="e.g. Masala, Oils, Rice, Pulses, Biscuits"
              onPressEnter={handleAddCategory} size="large"
              style={{ borderRadius: 10 }} maxLength={100}
              status={catError ? 'error' : ''}
            />
            {catError && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{catError}</div>}
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCategory} loading={creating} size="large"
            style={{ borderRadius: 10, background: '#0891b2', border: 'none', fontWeight: 700, width: isMobile ? '100%' : 'auto', flexShrink: 0 }}>
            Add Category
          </Button>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: '#64748b' }}>
          After adding a category, expand it to add sub-categories underneath.
        </div>
      </Card>

      {catLoading ? (
        <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
      ) : categories.length === 0 ? (
        <Empty description="No categories yet — add one above" style={{ padding: '40px 0' }} />
      ) : (
        categories.map((cat: any) => (
          <CategoryRow
            key={cat.id}
            category={cat}
            subCategories={allSubCategories.filter((s: any) => s.parentId === cat.id)}
            onDeleteCategory={handleDeleteCategory}
          />
        ))
      )}
    </div>
  );
};

// ─── Payment Methods tab ──────────────────────────────────────────────────────

const PaymentMethodsTab: React.FC = () => {
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState('');
  const [selectedMode, setSelectedMode] = useState<string>('CASH');
  const { data, isLoading } = useGetPaymentMethodsQuery();
  const [createMethod, { isLoading: creating }] = useCreatePaymentMethodMutation();
  const [deleteMethod] = useDeletePaymentMethodMutation();
  const items: any[] = data?.data || [];
  const isMobile = useIsMobile();

  const [modeManuallySet, setModeManuallySet] = useState(false);

  const validateName = (name: string): string => {
    if (!name) return 'Payment method name is required';
    if (name.length < 2) return 'Must be at least 2 characters';
    if (!hasLetter(name)) return 'Name must contain letters — it cannot be only numbers';
    if (!hasOnlyAllowedChars(name)) return 'Special characters like @, #, $, !, % are not allowed';
    if (items.some((i: any) => i.name.toLowerCase() === name.toLowerCase())) return `"${name}" already exists`;
    return '';
  };

  const handleNameChange = (val: string) => {
    setNewName(val);
    if (nameError) setNameError(validateName(val.trim()));
    if (!modeManuallySet) {
      setSelectedMode(val.trim() ? detectMode(val.trim()) : 'CASH');
    }
  };
  const handleModeChange = (val: string) => {
    setSelectedMode(val);
    setModeManuallySet(true);
  };

  const handleAdd = async () => {
    const name = newName.trim();
    const err = validateName(name);
    if (err) { setNameError(err); return; }
    setNameError('');
    try {
      await createMethod({ name, mode: selectedMode, sortOrder: items.length }).unwrap();
      setNewName('');
      setSelectedMode('CASH');
      setModeManuallySet(false);
      message.success(`"${name}" added as ${selectedMode} method`);
    } catch (err: any) {
      const errMsg = err?.data?.message;
      if (errMsg?.toLowerCase().includes('duplicate') || errMsg?.toLowerCase().includes('exists')) {
        setNameError(`"${name}" already exists`);
      } else {
        setNameError(errMsg || 'Failed to add payment method. Please try again.');
      }
    }
  };

  const modeCfg = MODE_COLOR[selectedMode] || MODE_COLOR.CASH;

  return (
    <div>
      <Card style={{ borderRadius: 12, marginBottom: 16, background: '#ecfdf5', border: '1.5px solid #05966922' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Add Payment Method
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Input
            value={newName} onChange={e => handleNameChange(e.target.value)}
            placeholder="e.g. Cash, GPay, PhonePe, Cheque, Credit"
            onPressEnter={handleAdd} size="large"
            style={{ borderRadius: 10 }} maxLength={100}
            status={nameError ? 'error' : ''}
          />
          {nameError && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{nameError}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <Select
              value={selectedMode}
              onChange={handleModeChange}
              size="large" style={{ flex: 1 }}
            >
              {Object.entries(MODE_COLOR).map(([mode, cfg]) => (
                <Select.Option key={mode} value={mode}>
                  <span style={{ color: cfg.color, fontWeight: 700 }}>{mode}</span>
                </Select.Option>
              ))}
            </Select>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} loading={creating} size="large"
              style={{ borderRadius: 10, background: '#059669', border: 'none', fontWeight: 700, flexShrink: 0 }}>
              Add
            </Button>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Tag style={{ background: modeCfg.bg, color: modeCfg.color, border: `1px solid ${modeCfg.color}44`, borderRadius: 20, fontWeight: 700, fontSize: 11, padding: '2px 10px' }}>
            {selectedMode}
          </Tag>
          <span>
            {selectedMode === 'CASH'   && 'Physical cash — counted and deposited daily'}
            {selectedMode === 'UPI'    && 'GPay / PhonePe / Paytm — UTR from app'}
            {selectedMode === 'CHEQUE' && 'Cheque — tracked until bank clearance'}
            {selectedMode === 'NEFT'   && 'Bank transfer — UTR number required'}
            {selectedMode === 'RTGS'   && 'High-value bank transfer — same-day settlement'}
            {selectedMode === 'CREDIT' && 'Credit / Due / Udhar — added to customer outstanding'}
          </span>
        </div>
      </Card>

      <Card style={{ borderRadius: 12, border: '1px solid #e8ecf0' }} styles={{ body: { padding: 0 } }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
        ) : items.length === 0 ? (
          <Empty description="No payment methods yet" style={{ padding: '40px 0' }} />
        ) : (
          items.map((item: any, idx: number) => {
            const cfg = MODE_COLOR[item.mode] || { color: '#6b7280', bg: '#f3f4f6' };
            return (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px',
                borderBottom: idx < items.length - 1 ? '1px solid #f1f5f9' : 'none',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: cfg.bg, border: `1.5px solid ${cfg.color}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: cfg.color, fontSize: 13,
                }}>
                  <WalletOutlined />
                </div>
                <div style={{ flex: 1, fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{item.name}</div>
                <Tag style={{
                  background: cfg.bg, color: cfg.color,
                  border: `1px solid ${cfg.color}33`,
                  borderRadius: 20, fontWeight: 700, fontSize: 11, padding: '3px 10px',
                }}>
                  {item.mode}
                </Tag>
                <Popconfirm title={`Remove "${item.name}"?`} description="Existing collections using this method will not be affected." okText="Remove" okButtonProps={{ danger: true }}
                  onConfirm={async () => {
                    try { await deleteMethod(item.id).unwrap(); message.success(`"${item.name}" removed`); }
                    catch (err: any) { message.error(err?.data?.message || `Cannot remove "${item.name}". It may be in use.`); }
                  }}>
                  <Button icon={<DeleteOutlined />} size="small" shape="circle" danger type="text" />
                </Popconfirm>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const MastersPage: React.FC = () => {
  const isMobile = useIsMobile();

  const { data: brandData }       = useGetMastersQuery('BRAND');
  const { data: categoryData }    = useGetMastersQuery('CATEGORY');
  const { data: subCategoryData } = useGetMastersQuery('SUB_CATEGORY');
  const { data: unitData }        = useGetMastersQuery('UNIT');
  const { data: taxRateData }     = useGetMastersQuery('TAX_RATE');

  const brandCount       = brandData?.data?.length ?? 0;
  const categoryCount    = categoryData?.data?.length ?? 0;
  const subCategoryCount = subCategoryData?.data?.length ?? 0;
  const unitCount        = unitData?.data?.length ?? 0;
  const taxRateCount     = taxRateData?.data?.length ?? 0;

  const countBadge = (n: number) =>
    n > 0 ? <span style={{ marginLeft: 5, fontSize: 11, fontWeight: 700, color: '#64748b' }}>({n})</span> : null;

  const tabs = [
    {
      key: 'BRAND',
      label: isMobile
        ? <span title="Brands"><TagOutlined /></span>
        : <span><TagOutlined style={{ marginRight: 6 }} />Brands{countBadge(brandCount)}</span>,
      children: <FlatMasterTab masterType={SIMPLE_TYPES[0]} />,
    },
    {
      key: 'CATEGORY',
      label: isMobile
        ? <span title="Categories"><AppstoreOutlined /></span>
        : <span><AppstoreOutlined style={{ marginRight: 6 }} />Categories{countBadge(categoryCount)}<span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 3 }}>{subCategoryCount > 0 ? `/ ${subCategoryCount} sub` : ''}</span></span>,
      children: <CategoriesTab />,
    },
    {
      key: 'UNIT',
      label: isMobile
        ? <span title="Units"><InboxOutlined /></span>
        : <span><InboxOutlined style={{ marginRight: 6 }} />Units{countBadge(unitCount)}</span>,
      children: <FlatMasterTab masterType={SIMPLE_TYPES[1]} />,
    },
    {
      key: 'TAX_RATE',
      label: isMobile
        ? <span title="GST Rates"><CalculatorOutlined /></span>
        : <span><CalculatorOutlined style={{ marginRight: 6 }} />GST Rates{countBadge(taxRateCount)}</span>,
      children: <TaxRatesTab />,
    },
    {
      key: 'PAYMENT_METHODS',
      label: isMobile
        ? <span title="Payment Methods"><WalletOutlined /></span>
        : <span><WalletOutlined style={{ marginRight: 6 }} />Payment Methods</span>,
      children: <PaymentMethodsTab />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Masters"
        subtitle={isMobile ? 'Brands, categories, units, GST & payments' : 'Manage brands, categories, units, GST rates and payment methods'}
      />
      <Card style={{ borderRadius: 12 }} styles={{ body: { padding: isMobile ? '12px 12px' : undefined } }}>
        <Tabs size={isMobile ? 'middle' : 'large'} defaultActiveKey="BRAND" items={tabs} />
      </Card>
    </div>
  );
};

export default MastersPage;
