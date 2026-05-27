import React, { useState } from 'react';
import {
  Table, Button, Form, Input, Select, Space, Switch, Steps,
  Row, Col, Card, Popconfirm, message, Tooltip, Drawer,
  InputNumber, Badge, Segmented, Upload, Spin, Grid,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  EnvironmentOutlined, UnorderedListOutlined, AppstoreOutlined,
  ArrowUpOutlined, ArrowDownOutlined, PhoneOutlined,
  UserOutlined, ShopOutlined, CameraOutlined, AimOutlined,
  CheckCircleFilled, LinkOutlined, LoadingOutlined,
} from '@ant-design/icons';
import {
  useGetCustomersQuery, useCreateCustomerMutation,
  useUpdateCustomerMutation, useDeleteCustomerMutation,
  useReorderCustomersMutation,
} from '../../store/api/customerApi';
import { useGetRoutesQuery, useGetRoutePlanQuery } from '../../store/api/routeApi';
import PageHeader from '../../components/PageHeader';
import AuditHistoryButton from '../../components/AuditHistoryButton';
import { applyApiErrorToForm } from '../../utils/formError';

const { Option } = Select;
const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/v1`;

const uploadImage = async (file: File, token: string): Promise<string> => {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/upload/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Upload failed');
  return json.data.url;
};

const LocationPicker: React.FC<{
  lat?: number; lng?: number;
  onChange: (lat: number, lng: number) => void;
}> = ({ lat, lng, onChange }) => {
  const [mapLink, setMapLink] = useState('');
  const [resolving, setResolving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const token = localStorage.getItem('token') || '';

  const handleGPS = () => {
    if (!navigator.geolocation) { message.error('Geolocation not supported'); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude);
        setGpsLoading(false);
        message.success('Location captured via GPS');
      },
      () => {
        setGpsLoading(false);
        message.error('Could not get location. Try pasting a Google Maps link.');
      },
      { timeout: 10000 }
    );
  };

  const handleResolveLink = async () => {
    if (!mapLink.trim()) return;
    setResolving(true);
    try {
      const res = await fetch(
        `${API_BASE}/util/resolve-location?url=${encodeURIComponent(mapLink.trim())}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      if (json.success && json.data) {
        onChange(json.data.latitude, json.data.longitude);
        setMapLink('');
        message.success('Location extracted from link');
      } else {
        message.error(json.message || 'Could not extract location from this link');
      }
    } catch {
      message.error('Could not reach the server. Check your internet connection or try GPS instead.');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>Use GPS</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Capture current location — salesperson must be standing at the shop.</div>
        </div>
        <Button icon={gpsLoading ? <Spin indicator={<LoadingOutlined spin />} /> : <AimOutlined />}
          onClick={handleGPS} loading={gpsLoading}>
          {gpsLoading ? 'Getting...' : 'Capture GPS'}
        </Button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>OR</span>
        <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
      </div>

      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 16px' }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 4 }}>Paste Google Maps Link</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>Open Google Maps → search the shop → share link → paste here.</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            value={mapLink} onChange={(e) => setMapLink(e.target.value)}
            placeholder="https://maps.app.goo.gl/..."
            style={{ borderRadius: 6, flex: 1 }}
            onPressEnter={handleResolveLink}
            prefix={<LinkOutlined style={{ color: '#9ca3af' }} />}
            allowClear
          />
          <Button onClick={handleResolveLink} loading={resolving} disabled={!mapLink.trim()}>
            {resolving ? 'Extracting...' : 'Extract'}
          </Button>
        </div>
      </div>

      {lat && lng ? (
        <div style={{ background: '#f9fafb', border: '1px solid #d1d5db', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <CheckCircleFilled style={{ color: '#16a34a', fontSize: 18, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>Location Set</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>{lat.toFixed(6)}, {lng.toFixed(6)}</div>
          </div>
          <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: '#374151', textDecoration: 'underline' }}>
            Verify on Map
          </a>
        </div>
      ) : (
        <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
          No location set yet
        </div>
      )}
    </div>
  );
};

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 };

const ImageUploadCard: React.FC<{
  label: string; icon: React.ReactNode; url?: string;
  onUpload: (url: string) => void;
}> = ({ label, icon, url, onUpload }) => {
  const token = localStorage.getItem('token') || '';

  return (
    <div style={{ textAlign: 'center' }}>
      <label style={{ ...labelStyle, marginBottom: 8, display: 'block' }}>{label}</label>
      <Upload
        showUploadList={false}
        accept="image/*"
        customRequest={async ({ file, onSuccess, onError }) => {
          try {
            const imageUrl = await uploadImage(file as File, token);
            onUpload(imageUrl);
            (onSuccess as any)('ok');
          } catch (err: any) {
            message.error(err.message || 'Upload failed');
            (onError as any)(err);
          }
        }}
      >
        <div style={{
          width: 120, height: 120, borderRadius: 8, border: '1px dashed #d1d5db',
          background: url ? 'transparent' : '#f9fafb',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', overflow: 'hidden',
        }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#374151')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#d1d5db')}
        >
          {url ? (
            <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <>
              <div style={{ fontSize: 24, color: '#9ca3af', marginBottom: 4 }}>{icon}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>Click to upload</div>
            </>
          )}
        </div>
      </Upload>
      {url && (
        <Button type="link" size="small" danger style={{ marginTop: 4, fontSize: 11 }} onClick={() => onUpload('')}>
          Remove
        </Button>
      )}
    </div>
  );
};

const GroupedView: React.FC<{ routes: any[] }> = ({ routes }) => {
  const [selectedRouteId, setSelectedRouteId] = useState<string>(routes[0]?.id || '');
  const { data: planData, isLoading } = useGetRoutePlanQuery(selectedRouteId, { skip: !selectedRouteId });
  const [reorderCustomers] = useReorderCustomersMutation();
  const plan = planData?.data;

  const handleMove = async (place: any, custIdx: number, dir: 'up' | 'down') => {
    const custs = [...place.customers];
    const newIdx = dir === 'up' ? custIdx - 1 : custIdx + 1;
    if (newIdx < 0 || newIdx >= custs.length) return;
    [custs[custIdx], custs[newIdx]] = [custs[newIdx], custs[custIdx]];
    try {
      await reorderCustomers({ placeId: place.id, customerIds: custs.map((c: any) => c.id) }).unwrap();
    } catch {
      message.error('Failed to reorder');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {routes.map((r: any) => (
          <button key={r.id} onClick={() => setSelectedRouteId(r.id)}
            style={{
              padding: '5px 14px', borderRadius: 6, border: '1px solid',
              borderColor: selectedRouteId === r.id ? '#374151' : '#e5e7eb',
              background: selectedRouteId === r.id ? '#111827' : '#fff',
              color: selectedRouteId === r.id ? '#fff' : '#374151',
              fontWeight: 500, fontSize: 13, cursor: 'pointer',
            }}>
            {r.name}
          </button>
        ))}
      </div>
      {isLoading ? (
        <Card loading style={{ borderRadius: 8 }} />
      ) : !plan?.plan?.length ? (
        <Card style={{ borderRadius: 8, textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
          No stops configured for this route.
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {plan.plan.map((place: any, pi: number) => (
            <Col key={place.id} xs={24} md={12} xl={8}>
              <Card style={{ borderRadius: 8, border: '1px solid #e5e7eb' }} styles={{ body: { padding: 0 } }}>
                <div style={{
                  padding: '10px 14px', background: '#fafafa',
                  borderBottom: '1px solid #f0f0f0', borderRadius: '8px 8px 0 0',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6, background: '#e5e7eb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#374151', fontWeight: 700, fontSize: 12, flexShrink: 0,
                  }}>{pi + 1}</div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', flex: 1 }}>{place.name}</div>
                  <Badge count={place.customers?.length || 0} style={{ background: '#6b7280' }} showZero />
                </div>
                <div style={{ padding: '10px 14px' }}>
                  {!place.customers?.length ? (
                    <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '10px 0' }}>No customers at this stop</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {place.customers.map((c: any, ci: number) => (
                        <div key={c.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '7px 8px', border: '1px solid #f3f4f6', borderRadius: 6,
                        }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                            background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#374151', fontSize: 13, fontWeight: 600, overflow: 'hidden',
                          }}>
                            {c.shopImageUrl
                              ? <img src={c.shopImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                              : c.businessName?.[0]?.toUpperCase()
                            }
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500, fontSize: 13, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {c.businessName}
                            </div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>{c.phone}</div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <button disabled={ci === 0} onClick={() => handleMove(place, ci, 'up')}
                              style={{ width: 20, height: 20, borderRadius: 4, border: '1px solid #e5e7eb', background: ci === 0 ? '#f9fafb' : '#fff', cursor: ci === 0 ? 'not-allowed' : 'pointer', color: ci === 0 ? '#d1d5db' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, padding: 0 }}>
                              <ArrowUpOutlined />
                            </button>
                            <button disabled={ci === place.customers.length - 1} onClick={() => handleMove(place, ci, 'down')}
                              style={{ width: 20, height: 20, borderRadius: 4, border: '1px solid #e5e7eb', background: ci === place.customers.length - 1 ? '#f9fafb' : '#fff', cursor: ci === place.customers.length - 1 ? 'not-allowed' : 'pointer', color: ci === place.customers.length - 1 ? '#d1d5db' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, padding: 0 }}>
                              <ArrowDownOutlined />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

// ─── Mobile customer card ─────────────────────────────────────────────────────

const CustomerCard: React.FC<{
  customer: any;
  onEdit: (c: any) => void;
  onDelete: (id: string) => void;
}> = ({ customer: c, onEdit, onDelete }) => (
  <div style={{ background: '#fff', border: '1px solid #e8ecf0', borderRadius: 12, padding: '14px 14px 10px', marginBottom: 10 }}>
    {/* Top: avatar + name + owner */}
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
      <div style={{
        width: 44, height: 44, borderRadius: 8, flexShrink: 0,
        background: '#f3f4f6', border: '1px solid #e5e7eb',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#374151', fontWeight: 700, fontSize: 18, overflow: 'hidden',
      }}>
        {c.shopImageUrl
          ? <img src={c.shopImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : c.businessName?.[0]?.toUpperCase()
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{c.businessName}</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{c.ownerName}</div>
      </div>
      <span style={{
        fontSize: 11, fontWeight: 600,
        color: c.active !== false ? '#059669' : '#6b7280',
        background: c.active !== false ? '#ecfdf5' : '#f3f4f6',
        padding: '2px 8px', borderRadius: 20, flexShrink: 0,
      }}>
        {c.active !== false ? 'Active' : 'Inactive'}
      </span>
    </div>

    {/* Detail rows */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 8, borderTop: '1px solid #f1f5f9', marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#94a3b8', width: 56, flexShrink: 0 }}>Phone</span>
        <span style={{ fontSize: 12, color: '#1e293b', fontWeight: 500 }}>
          {c.phone}{c.altPhone ? ` / ${c.altPhone}` : ''}
        </span>
      </div>
      {c.route?.name && (
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#94a3b8', width: 56, flexShrink: 0 }}>Route</span>
          <span style={{ fontSize: 12, color: '#1e293b' }}>
            {c.route.name}{c.routePlace?.name ? ` › ${c.routePlace.name}` : ''}
          </span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#94a3b8', width: 56, flexShrink: 0 }}>Credit</span>
        <span style={{ fontSize: 12, color: '#1e293b' }}>
          {c.creditAllowed ? `${c.creditDays} days · ₹${Number(c.creditLimit || 0).toLocaleString('en-IN')}` : 'Cash only'}
        </span>
      </div>
      {c.address && (
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#94a3b8', width: 56, flexShrink: 0 }}>Address</span>
          <span style={{ fontSize: 12, color: '#1e293b', wordBreak: 'break-word' }}>{c.address}</span>
        </div>
      )}
    </div>

    {/* Actions */}
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
      <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(c)}>Edit</Button>
      <Popconfirm title="Deactivate this customer?" onConfirm={() => onDelete(c.id)} okText="Yes" okButtonProps={{ danger: true }}>
        <Button size="small" danger icon={<DeleteOutlined />}>Deactivate</Button>
      </Popconfirm>
      <AuditHistoryButton entityType="CUSTOMER" entityId={c.id} title={`Audit — ${c.businessName}`} />
    </div>
  </div>
);

const STEPS = ['Basic Info', 'Route & Stop', 'Location', 'Photos', 'Credit'];

const CustomersPage: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [search, setSearch] = useState('');
  const [routeFilter, setRouteFilter] = useState<string | undefined>();
  const [placeFilter, setPlaceFilter] = useState<string | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const [currentStep, setCurrentStep] = useState(0);
  const [viewMode, setViewMode] = useState<'table' | 'grouped'>('table');
  const [form] = Form.useForm();
  const [ownerImageUrl, setOwnerImageUrl] = useState('');
  const [shopImageUrl, setShopImageUrl] = useState('');
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();

  const { data, isLoading } = useGetCustomersQuery({ search, routeId: routeFilter, placeId: placeFilter });
  const { data: routesData } = useGetRoutesQuery();
  const [createCustomer, { isLoading: creating }] = useCreateCustomerMutation();
  const [updateCustomer, { isLoading: updating }] = useUpdateCustomerMutation();
  const [deleteCustomer] = useDeleteCustomerMutation();

  const customers = data?.data?.content || data?.data || [];
  const routes = routesData?.data || [];

  const getPlacesForRoute = (routeId: string) => {
    const route = routes.find((r: any) => r.id === routeId);
    return [...(route?.places || [])].sort((a: any, b: any) => a.sortOrder - b.sortOrder);
  };

  const openAdd = () => {
    setEditingCustomer(null);
    setSelectedRouteId(undefined);
    setOwnerImageUrl('');
    setShopImageUrl('');
    setLat(undefined);
    setLng(undefined);
    setCurrentStep(0);
    form.resetFields();
    setDrawerOpen(true);
  };

  const openEdit = (customer: any) => {
    setEditingCustomer(customer);
    const routeId = customer.route?.id || customer.routeId;
    setSelectedRouteId(routeId);
    setOwnerImageUrl(customer.ownerImageUrl || '');
    setShopImageUrl(customer.shopImageUrl || '');
    setLat(customer.latitude);
    setLng(customer.longitude);
    setCurrentStep(0);
    form.setFieldsValue({
      businessName: customer.businessName,
      ownerName: customer.ownerName,
      phone: customer.phone,
      altPhone: customer.altPhone,
      email: customer.email,
      address: customer.address,
      gstin: customer.gstin,
      routeId,
      routePlaceId: customer.routePlace?.id || customer.routePlaceId,
      creditAllowed: customer.creditAllowed,
      creditDays: customer.creditDays,
      creditLimit: customer.creditLimit,
    });
    setDrawerOpen(true);
  };

  const stepFields: Record<number, string[]> = {
    0: ['businessName', 'ownerName', 'phone', 'altPhone', 'email', 'address', 'gstin'],
    1: ['routeId', 'routePlaceId'],
    2: [],
    3: [],
    4: ['creditDays', 'creditLimit'],
  };

  const handleNext = async () => {
    try {
      await form.validateFields(stepFields[currentStep]);
      setCurrentStep(s => s + 1);
    } catch {
      // validation errors shown inline
    }
  };

  const handleSubmit = async () => {
    try {
      await form.validateFields();
      const allValues = form.getFieldsValue(true);

      if (!allValues.businessName?.trim()) {
        setCurrentStep(0);
        form.setFields([{ name: 'businessName', errors: ['Business name is required'] }]);
        return;
      }
      if (!allValues.phone?.trim()) {
        setCurrentStep(0);
        form.setFields([{ name: 'phone', errors: ['Phone is required'] }]);
        return;
      }
      if (!allValues.routeId) {
        setCurrentStep(1);
        form.setFields([{ name: 'routeId', errors: ['Please select a route'] }]);
        return;
      }
      if (!allValues.routePlaceId) {
        setCurrentStep(1);
        form.setFields([{ name: 'routePlaceId', errors: ['Please select a stop'] }]);
        return;
      }

      const payload = { ...allValues, latitude: lat, longitude: lng, ownerImageUrl, shopImageUrl };

      if (editingCustomer) {
        await updateCustomer({ id: editingCustomer.id, data: payload }).unwrap();
        message.success('Customer updated');
      } else {
        await createCustomer(payload).unwrap();
        message.success('Customer onboarded successfully');
      }
      setDrawerOpen(false);
    } catch (err: any) {
      if (err?.errorFields) {
        const errFields = err.errorFields.map((f: any) => f.name[0]);
        for (let s = 0; s < STEPS.length; s++) {
          if (stepFields[s].some((f) => errFields.includes(f))) { setCurrentStep(s); break; }
        }
        return;
      }
      const msg = applyApiErrorToForm(err, form, 'phone');
      if (msg) message.error(msg);
      else message.error('Something went wrong. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCustomer(id).unwrap();
      message.success('Customer deactivated');
    } catch { message.error('Failed'); }
  };

  const stepContent: Record<number, React.ReactNode> = {
    0: (
      <div>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="businessName" label="Business / Shop Name" rules={[{ required: true, message: 'Required' }]}>
              <Input prefix={<ShopOutlined style={{ color: '#94a3b8' }} />} placeholder="e.g. Sri Krishna Stores" size="large" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="ownerName" label="Owner Name" rules={[{ required: true, message: 'Required' }]}>
              <Input prefix={<UserOutlined style={{ color: '#94a3b8' }} />} placeholder="e.g. Murugan" size="large" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="phone" label="Mobile Number" rules={[{ required: true }, { len: 10, message: '10 digits required' }]}>
              <Input prefix={<PhoneOutlined style={{ color: '#94a3b8' }} />} placeholder="9876543210" maxLength={10} size="large" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="altPhone" label="Alt Mobile">
              <Input prefix={<PhoneOutlined style={{ color: '#94a3b8' }} />} placeholder="Optional" maxLength={10} size="large" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="address" label="Shop Address">
          <Input.TextArea rows={3} placeholder="Full shop address with landmark" />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="gstin" label="GSTIN">
              <Input placeholder="Optional" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="email" label="Email">
              <Input placeholder="Optional" />
            </Form.Item>
          </Col>
        </Row>
      </div>
    ),
    1: (
      <div>
        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 14px', marginBottom: 20, border: '1px solid #e5e7eb', fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
          A route (e.g. "Cholapuram") is the main delivery path. Each stop (e.g. "Kovilacheri") is a place along the route.
          Assign this customer to the correct stop — they will appear in the beat plan in visit order.
        </div>
        <Form.Item name="routeId" label="Route" rules={[{ required: true, message: 'Select a route' }]}>
          <Select placeholder="Select route" size="large" showSearch optionFilterProp="children"
            onChange={(v) => { setSelectedRouteId(v); form.setFieldValue('routePlaceId', undefined); }}>
            {routes.map((r: any) => (
              <Option key={r.id} value={r.id}>
                <EnvironmentOutlined style={{ color: '#9ca3af', marginRight: 8 }} />{r.name}
              </Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="routePlaceId" label="Stop / Place" rules={[{ required: true, message: 'Select a stop' }]}>
          <Select placeholder={selectedRouteId ? 'Select stop' : 'Select a route first'} disabled={!selectedRouteId} size="large">
            {getPlacesForRoute(selectedRouteId || '').map((p: any) => (
              <Option key={p.id} value={p.id}>
                <span style={{ color: '#9ca3af', marginRight: 8 }}>{p.sortOrder + 1}.</span>{p.name}
              </Option>
            ))}
          </Select>
        </Form.Item>
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          The customer will be added at the end of the stop's visit list. You can reorder later from the Beat Plan view.
        </div>
      </div>
    ),
    2: (
      <div>
        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 14px', marginBottom: 20, border: '1px solid #e5e7eb', fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
          The delivery person sees this shop on the map during delivery. Use GPS to capture the exact location.
        </div>
        <LocationPicker lat={lat} lng={lng} onChange={(la, lo) => { setLat(la); setLng(lo); }} />
      </div>
    ),
    3: (
      <div>
        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 14px', marginBottom: 24, border: '1px solid #e5e7eb', fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
          Upload the owner's photo and shop front photo. These help the delivery person identify the correct shop.
        </div>
        <Row gutter={32} justify="center">
          <Col>
            <ImageUploadCard label="Owner Photo" icon={<UserOutlined />} url={ownerImageUrl} onUpload={setOwnerImageUrl} />
          </Col>
          <Col>
            <ImageUploadCard label="Shop Photo" icon={<CameraOutlined />} url={shopImageUrl} onUpload={setShopImageUrl} />
          </Col>
        </Row>
      </div>
    ),
    4: (
      <div>
        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 14px', marginBottom: 20, border: '1px solid #e5e7eb', fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
          Credit settings define if the shop can take goods on credit. Leave credit off for cash-on-delivery customers.
        </div>
        <Form.Item name="creditAllowed" label="Allow Credit" valuePropName="checked">
          <Switch checkedChildren="Credit On" unCheckedChildren="Cash Only" />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="creditDays" label="Credit Days">
              <InputNumber style={{ width: '100%' }} min={0} max={365} placeholder="e.g. 30" size="large" addonAfter="days" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="creditLimit" label="Credit Limit">
              <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 50000" size="large" addonBefore="₹" />
            </Form.Item>
          </Col>
        </Row>
      </div>
    ),
  };

  const columns = [
    {
      title: 'Store Name',
      key: 'businessName',
      render: (_: any, r: any) => (
        <Space size={10}>
          <div style={{
            width: 38, height: 38, borderRadius: 8, flexShrink: 0,
            background: '#f3f4f6', border: '1px solid #e5e7eb',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#374151', fontWeight: 700, fontSize: 16, overflow: 'hidden',
          }}>
            {r.shopImageUrl
              ? <img src={r.shopImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : r.businessName?.[0]?.toUpperCase()
            }
          </div>
          <span style={{ fontWeight: 600, color: '#111827', fontSize: 14 }}>{r.businessName}</span>
        </Space>
      ),
    },
    {
      title: 'Owner Name',
      key: 'ownerName',
      render: (_: any, r: any) => (
        <span style={{ color: '#374151', fontSize: 14 }}>{r.ownerName}</span>
      ),
    },
    {
      title: 'Phone',
      key: 'phone',
      width: 140,
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontSize: 14, color: '#111827' }}>{r.phone}</div>
          {r.altPhone && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{r.altPhone}</div>}
        </div>
      ),
    },
    {
      title: 'Route',
      key: 'route',
      width: 150,
      render: (_: any, r: any) => (
        <span style={{ fontSize: 14, color: '#374151' }}>{r.route?.name || '—'}</span>
      ),
    },
    {
      title: 'Stop',
      key: 'stop',
      width: 150,
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontSize: 14, color: '#374151' }}>{r.routePlace?.name || '—'}</div>
          {r.routePlace?.name && (
            <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>Visit #{(r.visitOrder ?? 0) + 1}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Credit',
      key: 'credit',
      width: 150,
      render: (_: any, r: any) => r.creditAllowed ? (
        <div>
          <div style={{ fontSize: 14, color: '#111827' }}>{r.creditDays} days</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>₹{Number(r.creditLimit || 0).toLocaleString('en-IN')}</div>
        </div>
      ) : (
        <span style={{ fontSize: 14, color: '#6b7280' }}>Cash only</span>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 90,
      dataIndex: 'active',
      render: (v: boolean) => (
        <span style={{ color: v !== false ? '#15803d' : '#6b7280', fontSize: 14 }}>
          {v !== false ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      render: (_: any, r: any) => (
        <Space>
          <Tooltip title="Edit"><Button icon={<EditOutlined />} size="small" shape="circle" onClick={() => openEdit(r)} /></Tooltip>
          <Popconfirm title="Deactivate this customer?" onConfirm={() => handleDelete(r.id)} okText="Yes" okButtonProps={{ danger: true }}>
            <Tooltip title="Deactivate"><Button icon={<DeleteOutlined />} size="small" shape="circle" danger /></Tooltip>
          </Popconfirm>
          <AuditHistoryButton entityType="CUSTOMER" entityId={r.id} title={`Audit — ${r.businessName}`} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Manage customers by route and visit sequence"
        count={customers.length}
        countLabel="customers"
        action={
          <Space>
            <Segmented
              value={viewMode}
              onChange={(v) => setViewMode(v as any)}
              options={[
                { value: 'table', icon: <UnorderedListOutlined /> },
                { value: 'grouped', icon: <AppstoreOutlined /> },
              ]}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add Customer</Button>
          </Space>
        }
      />

      {viewMode === 'table' ? (
        <>
          <Card style={{ marginBottom: 16, borderRadius: 8 }}>
            <Row gutter={[12, 8]}>
              <Col xs={24} md={12} lg={10}>
                <Input
                  prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="Search by business name or phone..."
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  allowClear style={{ borderRadius: 6 }}
                />
              </Col>
              <Col xs={routeFilter ? 12 : 24} md={6} lg={7}>
                <Select placeholder="All routes" style={{ width: '100%' }} allowClear value={routeFilter}
                  onChange={(v) => { setRouteFilter(v); setPlaceFilter(undefined); }}>
                  {routes.map((r: any) => <Option key={r.id} value={r.id}>{r.name}</Option>)}
                </Select>
              </Col>
              {routeFilter && (
                <Col xs={12} md={6} lg={7}>
                  <Select placeholder="All stops" style={{ width: '100%' }} allowClear value={placeFilter} onChange={setPlaceFilter}>
                    {getPlacesForRoute(routeFilter).map((p: any) => (
                      <Option key={p.id} value={p.id}>
                        <span style={{ color: '#9ca3af', marginRight: 4 }}>{p.sortOrder + 1}.</span>{p.name}
                      </Option>
                    ))}
                  </Select>
                </Col>
              )}
            </Row>
          </Card>
          {isMobile ? (
            <div>
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading...</div>
              ) : customers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No customers found</div>
              ) : (
                customers.map((c: any) => (
                  <CustomerCard key={c.id} customer={c} onEdit={openEdit} onDelete={handleDelete} />
                ))
              )}
            </div>
          ) : (
          <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
            <Table
              columns={columns}
              dataSource={customers}
              rowKey="id"
              loading={isLoading}
              pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} customers` }}
              size="middle"
              scroll={{ x: 1100 }}
              expandable={{
                expandedRowRender: (r: any) => (
                  <div style={{ padding: '12px 20px', background: '#f9fafb', display: 'flex', flexWrap: 'wrap', gap: 24 }}>
                    {r.address && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Address</div>
                        <div style={{ fontSize: 13, color: '#374151', maxWidth: 280 }}>{r.address}</div>
                      </div>
                    )}
                    {r.email && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Email</div>
                        <div style={{ fontSize: 13, color: '#374151' }}>{r.email}</div>
                      </div>
                    )}
                    {r.gstin && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>GSTIN</div>
                        <div style={{ fontSize: 13, color: '#374151' }}>{r.gstin}</div>
                      </div>
                    )}
                    {r.latitude && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Location</div>
                        <a href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`} target="_blank" rel="noreferrer"
                          style={{ fontSize: 13, color: '#374151', textDecoration: 'underline' }}>
                          <EnvironmentOutlined style={{ marginRight: 4 }} />View on Map
                        </a>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Visit Order</div>
                      <div style={{ fontSize: 13, color: '#374151' }}>Stop #{(r.visitOrder ?? 0) + 1} on {r.routePlace?.name}</div>
                    </div>
                  </div>
                ),
                rowExpandable: (r: any) => !!(r.address || r.email || r.gstin || r.latitude),
              }}
            />
          </Card>
          )}
        </>
      ) : (
        routes.length === 0 ? (
          <Card style={{ borderRadius: 8, textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
            No routes found. Create a route first.
          </Card>
        ) : <GroupedView routes={routes} />
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>
              {editingCustomer ? 'Edit Customer' : 'Onboard New Customer'}
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>
              {editingCustomer ? editingCustomer.businessName : 'Fill in details to add a new shop customer'}
            </div>
          </div>
        }
        width={isMobile ? '100%' : 620}
        styles={{ body: { padding: 0, background: '#f9fafb' } }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 24px' }}>
            <Space>
              {currentStep > 0 && <Button onClick={() => setCurrentStep(s => s - 1)}>← Back</Button>}
            </Space>
            <Space>
              <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
              {currentStep < STEPS.length - 1 ? (
                <Button type="primary" onClick={handleNext}>Next →</Button>
              ) : (
                <Button type="primary" loading={creating || updating} onClick={handleSubmit}>
                  {editingCustomer ? 'Update Customer' : 'Onboard Customer'}
                </Button>
              )}
            </Space>
          </div>
        }
      >
        <div style={{ padding: '20px 24px 0', background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
          <Steps
            current={currentStep}
            size="small"
            items={STEPS.map((s, i) => ({
              title: <span style={{ fontSize: 12 }}>{s}</span>,
              status: i < currentStep ? 'finish' : i === currentStep ? 'process' : 'wait',
            }))}
            onChange={setCurrentStep}
          />
        </div>
        <div style={{ padding: '24px' }}>
          <Form form={form} layout="vertical" requiredMark={false}>
            {stepContent[currentStep]}
          </Form>
        </div>
      </Drawer>
    </div>
  );
};

export default CustomersPage;
