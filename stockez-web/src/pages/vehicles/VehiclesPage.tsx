import React, { useState } from 'react';
import { Button, Card, Drawer, Form, Input, Select, Popconfirm, message, Tooltip, Alert, DatePicker, Spin } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetVehiclesQuery, useCreateVehicleMutation,
  useUpdateVehicleMutation, useDeleteVehicleMutation,
  useGetExpiryAlertsQuery,
} from '../../store/api/vehicleApi';
import PageHeader from '../../components/PageHeader';

const VEHICLE_TYPES = ['VAN', 'TRUCK', 'MINI TRUCK', 'BIKE', 'AUTO', 'CAR', 'OTHER'];
const DATE_FMT = 'DD MMM YYYY';
const VEHICLE_NUM_REGEX = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
const COMMERCIAL_TYPES = ['VAN', 'TRUCK', 'MINI TRUCK', 'OTHER'];

function normaliseVehicleNumber(raw: string): string {
  return raw.toUpperCase().replace(/[\s\-]/g, '');
}

const sectionLabel = (text: string) => (
  <div style={{ marginTop: 16, marginBottom: 8, fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
    {text}
  </div>
);

const DocRow: React.FC<{ label: string; date: string | null; expired: boolean; nearExpiry: boolean; days: number | null }> = ({
  label, date, expired, nearExpiry, days,
}) => {
  const color = expired ? '#dc2626' : nearExpiry ? '#d97706' : '#15803d';
  const statusText = expired ? 'Expired' : nearExpiry ? `${days}d left` : 'Valid';
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f5f5f5', gap: 8 }}>
      <span style={{ fontSize: 14, color: '#374151', flex: 1 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#111827', flexShrink: 0 }}>{date ? dayjs(date).format(DATE_FMT) : <span style={{ color: '#9ca3af' }}>—</span>}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: date ? color : '#9ca3af', flexShrink: 0, minWidth: 52, textAlign: 'right' }}>{date ? statusText : ''}</span>
    </div>
  );
};

const VehiclesPage: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [form] = Form.useForm();

  const isCommercial = selectedType ? COMMERCIAL_TYPES.includes(selectedType) : false;

  const { data, isLoading } = useGetVehiclesQuery();
  const { data: alertsData } = useGetExpiryAlertsQuery(30);
  const [createVehicle, { isLoading: creating }] = useCreateVehicleMutation();
  const [updateVehicle, { isLoading: updating }] = useUpdateVehicleMutation();
  const [deleteVehicle] = useDeleteVehicleMutation();

  const vehicles = data?.data || [];
  const filtered = vehicles.filter((v: any) => {
    if (filterType && v.vehicleType !== filterType) return false;
    if (filterStatus === 'active' && !v.active) return false;
    if (filterStatus === 'inactive' && v.active) return false;
    return true;
  });
  const alerts: any[] = alertsData?.data || [];
  const expired = alerts.filter((a: any) => a.daysToExpiry < 0);
  const nearExpiry = alerts.filter((a: any) => a.daysToExpiry >= 0);

  const openAdd = () => {
    setEditing(null);
    setSelectedType(null);
    form.resetFields();
    setDrawerOpen(true);
  };

  const openEdit = (v: any) => {
    setEditing(v);
    setSelectedType(v.vehicleType);
    form.setFieldsValue({
      vehicleNumber: v.vehicleNumber,
      vehicleType: v.vehicleType,
      model: v.model,
      fcExpiryDate: v.fcExpiryDate ? dayjs(v.fcExpiryDate) : null,
      insuranceNumber: v.insuranceNumber,
      insuranceExpiryDate: v.insuranceExpiryDate ? dayjs(v.insuranceExpiryDate) : null,
      pucExpiryDate: v.pucExpiryDate ? dayjs(v.pucExpiryDate) : null,
      goodsPermitExpiryDate: v.goodsPermitExpiryDate ? dayjs(v.goodsPermitExpiryDate) : null,
      lastServiceDate: v.lastServiceDate ? dayjs(v.lastServiceDate) : null,
      nextServiceDueDate: v.nextServiceDueDate ? dayjs(v.nextServiceDueDate) : null,
      active: v.active,
    });
    setDrawerOpen(true);
  };

  const handleFinish = async (values: any) => {
    try {
      const payload = {
        ...values,
        vehicleNumber: normaliseVehicleNumber(values.vehicleNumber || ''),
        fcExpiryDate: values.fcExpiryDate ? values.fcExpiryDate.format('YYYY-MM-DD') : null,
        insuranceExpiryDate: values.insuranceExpiryDate ? values.insuranceExpiryDate.format('YYYY-MM-DD') : null,
        pucExpiryDate: values.pucExpiryDate ? values.pucExpiryDate.format('YYYY-MM-DD') : null,
        goodsPermitExpiryDate: values.goodsPermitExpiryDate ? values.goodsPermitExpiryDate.format('YYYY-MM-DD') : null,
        lastServiceDate: values.lastServiceDate ? values.lastServiceDate.format('YYYY-MM-DD') : null,
        nextServiceDueDate: values.nextServiceDueDate ? values.nextServiceDueDate.format('YYYY-MM-DD') : null,
      };
      if (editing) {
        await updateVehicle({ id: editing.id, data: payload }).unwrap();
        message.success('Vehicle updated');
      } else {
        await createVehicle(payload).unwrap();
        message.success('Vehicle added');
      }
      setDrawerOpen(false);
    } catch (err: any) {
      if (err?.data?.message) message.error(err.data.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteVehicle(id).unwrap();
      message.success('Vehicle deactivated');
    } catch { message.error('Failed'); }
  };

  const isVehicleCommercial = (type: string) => COMMERCIAL_TYPES.includes(type);

  return (
    <div>
      <PageHeader
        title="Vehicles"
        subtitle="Fleet vehicles — TN compliance tracking (FC, Insurance, PUC, Goods Permit)"
        count={vehicles.filter((v: any) => v.active).length}
        countLabel="active vehicles"
        action={<Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add Vehicle</Button>}
      />

      {expired.length > 0 && (
        <Alert
          type="error"
          icon={<WarningOutlined />}
          showIcon
          style={{ marginBottom: 10 }}
          message={
            <span>
              <strong>Expired documents — </strong>
              {Object.entries(
                expired.reduce((acc: Record<string, string[]>, a: any) => {
                  (acc[a.vehicleNumber] = acc[a.vehicleNumber] || []).push(a.documentType);
                  return acc;
                }, {})
              ).map(([vno, docs]) => `${vno}: ${docs.join(', ')}`).join(' · ')}
            </span>
          }
        />
      )}

      {nearExpiry.length > 0 && (
        <Alert
          type="warning"
          icon={<WarningOutlined />}
          showIcon
          style={{ marginBottom: 10 }}
          message={
            <span>
              <strong>Expiring within 30 days — </strong>
              {Object.entries(
                nearExpiry.reduce((acc: Record<string, { docs: string[]; days: number }>, a: any) => {
                  if (!acc[a.vehicleNumber]) acc[a.vehicleNumber] = { docs: [], days: a.daysToExpiry };
                  acc[a.vehicleNumber].docs.push(a.documentType);
                  return acc;
                }, {})
              ).map(([vno, { docs, days }]) => `${vno}: ${docs.join(', ')} (${days}d left)`).join(' · ')}
            </span>
          }
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Filter:</span>
        <Select
          placeholder="All Vehicle Types"
          allowClear
          size="middle"
          style={{ width: 220 }}
          value={filterType}
          onChange={(v) => setFilterType(v ?? null)}
        >
          {VEHICLE_TYPES.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
        </Select>
        <Select
          placeholder="All Status"
          allowClear
          size="middle"
          style={{ width: 180 }}
          value={filterStatus}
          onChange={(v) => setFilterStatus(v ?? null)}
        >
          <Select.Option value="active">Active</Select.Option>
          <Select.Option value="inactive">Inactive</Select.Option>
        </Select>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>No vehicles found</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 12 }}>
          {filtered.map((v: any) => {
            const commercial = isVehicleCommercial(v.vehicleType);
            return (
              <Card
                key={v.id}
                size="small"
                style={{ opacity: v.active ? 1 : 0.55, border: '2px solid #cbd5e1' }}
                styles={{ body: { padding: 12 } }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 15, color: '#111827' }}>{v.vehicleNumber}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginTop: 1 }}>
                      {v.vehicleType}{v.model ? ` · ${v.model}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: v.active ? '#15803d' : '#6b7280' }}>
                      {v.active ? 'Active' : 'Inactive'}
                    </span>
                    <Tooltip title="Edit">
                      <Button icon={<EditOutlined />} size="small" shape="circle" onClick={() => openEdit(v)} />
                    </Tooltip>
                    <Popconfirm title="Deactivate this vehicle?" onConfirm={() => handleDelete(v.id)} okText="Yes" okButtonProps={{ danger: true }}>
                      <Tooltip title="Deactivate">
                        <Button icon={<DeleteOutlined />} size="small" shape="circle" danger />
                      </Tooltip>
                    </Popconfirm>
                  </div>
                </div>

                {/* Compliance */}
                <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Compliance</div>
                  {commercial ? (
                    <>
                      <DocRow label="FC" date={v.fcExpiryDate} expired={v.fcExpired} nearExpiry={v.fcNearExpiry} days={v.fcDaysToExpiry} />
                      <DocRow label="Insurance" date={v.insuranceExpiryDate} expired={v.insuranceExpired} nearExpiry={v.insuranceNearExpiry} days={v.insuranceDaysToExpiry} />
                      <DocRow label="PUC" date={v.pucExpiryDate} expired={v.pucExpired} nearExpiry={v.pucNearExpiry} days={v.pucDaysToExpiry} />
                      <DocRow label="Goods Permit" date={v.goodsPermitExpiryDate} expired={v.goodsPermitExpired} nearExpiry={v.goodsPermitNearExpiry} days={v.goodsPermitDaysToExpiry} />
                    </>
                  ) : (
                    <>
                      <DocRow label="Insurance" date={v.insuranceExpiryDate} expired={v.insuranceExpired} nearExpiry={v.insuranceNearExpiry} days={v.insuranceDaysToExpiry} />
                      <DocRow label="PUC" date={v.pucExpiryDate} expired={v.pucExpired} nearExpiry={v.pucNearExpiry} days={v.pucDaysToExpiry} />
                    </>
                  )}
                </div>

                {/* Service */}
                {(v.lastServiceDate || v.nextServiceDueDate) && (
                  <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8, marginTop: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Service</div>
                    {v.lastServiceDate && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0' }}>
                        <span style={{ fontSize: 14, color: '#374151', flex: 1 }}>Last Service</span>
                        <span style={{ fontSize: 14, color: '#111827', flexShrink: 0 }}>{dayjs(v.lastServiceDate).format(DATE_FMT)}</span>
                      </div>
                    )}
                    {v.nextServiceDueDate && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0' }}>
                        <span style={{ fontSize: 14, color: '#374151', flex: 1 }}>Next Due</span>
                        <span style={{ fontSize: 14, color: '#111827', flexShrink: 0 }}>{dayjs(v.nextServiceDueDate).format(DATE_FMT)}</span>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Vehicle' : 'Add Vehicle'}
        width={480}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={creating || updating} onClick={() => form.submit()}>
              {editing ? 'Update' : 'Add Vehicle'}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" scrollToFirstError onFinish={handleFinish}>
          {sectionLabel('Vehicle Details')}
          <Form.Item
            name="vehicleNumber"
            label="Vehicle Number *"
            rules={[
              { required: true, message: 'Required' },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  if (!VEHICLE_NUM_REGEX.test(normaliseVehicleNumber(value)))
                    return Promise.reject('Invalid format — expected TN45AB1234');
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input
              placeholder="e.g. TN45AB1234"
              maxLength={12}
              style={{ textTransform: 'uppercase', fontFamily: 'monospace' }}
              onChange={e => form.setFieldValue('vehicleNumber', e.target.value.toUpperCase().replace(/[\s\-]/g, ''))}
            />
          </Form.Item>
          <Form.Item name="vehicleType" label="Vehicle Type *" rules={[{ required: true, message: 'Required' }]}>
            <Select placeholder="Select type" onChange={(v) => setSelectedType(v)}>
              {VEHICLE_TYPES.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item
            name="model"
            label="Model / Description"
            rules={[{ pattern: /^[A-Za-z0-9\s.\-]+$/, message: 'Only letters, numbers, spaces, . and - are allowed' }]}
          >
            <Input placeholder="e.g. Tata Ace, Hero Splendor" maxLength={100} />
          </Form.Item>

          {sectionLabel('TN Compliance')}
          {isCommercial && (
            <Form.Item name="fcExpiryDate" label="FC (Fitness Certificate) Expiry Date *" rules={[{ required: true, message: 'Required' }]}>
              <DatePicker format={DATE_FMT} style={{ width: '100%' }} placeholder="Select expiry date" />
            </Form.Item>
          )}
          <Form.Item
            name="insuranceNumber"
            label="Insurance Number *"
            rules={[
              { required: true, message: 'Required' },
              { pattern: /^[A-Za-z0-9\/\-]+$/, message: 'Only letters, numbers, / and - are allowed' },
            ]}
          >
            <Input placeholder="e.g. INS/2024/00123" maxLength={50} />
          </Form.Item>
          <Form.Item name="insuranceExpiryDate" label="Insurance Expiry Date *" rules={[{ required: true, message: 'Required' }]}>
            <DatePicker format={DATE_FMT} style={{ width: '100%' }} placeholder="Select expiry date" />
          </Form.Item>
          <Form.Item name="pucExpiryDate" label="PUC (Pollution Certificate) Expiry Date *" rules={[{ required: true, message: 'Required' }]}>
            <DatePicker format={DATE_FMT} style={{ width: '100%' }} placeholder="Select expiry date" />
          </Form.Item>
          {isCommercial && (
            <Form.Item name="goodsPermitExpiryDate" label="Goods Carriage Permit Expiry Date *" rules={[{ required: true, message: 'Required' }]}>
              <DatePicker format={DATE_FMT} style={{ width: '100%' }} placeholder="Select expiry date" />
            </Form.Item>
          )}

          {sectionLabel('Maintenance')}
          <Form.Item name="lastServiceDate" label="Last Service Date">
            <DatePicker format={DATE_FMT} style={{ width: '100%' }} placeholder="Select date" />
          </Form.Item>
          <Form.Item name="nextServiceDueDate" label="Next Service Due Date">
            <DatePicker format={DATE_FMT} style={{ width: '100%' }} placeholder="Select date" />
          </Form.Item>

          {editing && (
            <>
              {sectionLabel('Status')}
              <Form.Item name="active" label="Status">
                <Select>
                  <Select.Option value={true}>Active</Select.Option>
                  <Select.Option value={false}>Inactive</Select.Option>
                </Select>
              </Form.Item>
            </>
          )}
        </Form>
      </Drawer>
    </div>
  );
};

export default VehiclesPage;
