import React, { useState } from 'react';
import { Table, Button, Drawer, Form, Input, Select, Space, Popconfirm, message, Tooltip, Alert, DatePicker } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetVehiclesQuery, useCreateVehicleMutation,
  useUpdateVehicleMutation, useDeleteVehicleMutation,
  useGetInsuranceAlertsQuery,
} from '../../store/api/vehicleApi';
import PageHeader from '../../components/PageHeader';

const VEHICLE_TYPES = ['VAN', 'TRUCK', 'MINI TRUCK', 'BIKE', 'AUTO', 'CAR', 'OTHER'];
const DATE_FMT = 'DD MMM YYYY';
const VEHICLE_NUM_REGEX = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;

function normaliseVehicleNumber(raw: string): string {
  return raw.toUpperCase().replace(/[\s\-]/g, '');
}

const VehiclesPage: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useGetVehiclesQuery();
  const { data: alertsData } = useGetInsuranceAlertsQuery(30);
  const [createVehicle, { isLoading: creating }] = useCreateVehicleMutation();
  const [updateVehicle, { isLoading: updating }] = useUpdateVehicleMutation();
  const [deleteVehicle] = useDeleteVehicleMutation();

  const vehicles = data?.data || [];
  const alerts: any[] = alertsData?.data || [];
  const expired = alerts.filter((a: any) => a.daysToExpiry < 0);
  const nearExpiry = alerts.filter((a: any) => a.daysToExpiry >= 0);

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setDrawerOpen(true);
  };

  const openEdit = (v: any) => {
    setEditing(v);
    form.setFieldsValue({
      vehicleNumber: v.vehicleNumber,
      vehicleType: v.vehicleType,
      model: v.model,
      insuranceNumber: v.insuranceNumber,
      insuranceExpiryDate: v.insuranceExpiryDate ? dayjs(v.insuranceExpiryDate) : null,
      active: v.active,
    });
    setDrawerOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        vehicleNumber: normaliseVehicleNumber(values.vehicleNumber || ''),
        insuranceExpiryDate: values.insuranceExpiryDate
          ? values.insuranceExpiryDate.format('YYYY-MM-DD')
          : null,
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

  const insuranceStatusCell = (v: any) => {
    if (!v.insuranceExpiryDate) return <span style={{ color: '#9ca3af', fontSize: 13 }}>—</span>;
    if (v.insuranceExpired)
      return <span style={{ color: '#dc2626', fontWeight: 600, fontSize: 13 }}>Expired</span>;
    if (v.insuranceNearExpiry)
      return <span style={{ color: '#dc2626', fontWeight: 600, fontSize: 13 }}>Exp. in {v.insuranceDaysToExpiry}d</span>;
    return <span style={{ color: '#15803d', fontSize: 13 }}>Valid</span>;
  };

  const columns = [
    {
      title: 'Vehicle Number',
      dataIndex: 'vehicleNumber',
      key: 'vehicleNumber',
      render: (v: string) => <span style={{ fontWeight: 600, fontSize: 14, color: '#111827', fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: 'Type',
      dataIndex: 'vehicleType',
      key: 'vehicleType',
      width: 130,
      render: (v: string) => <span style={{ fontSize: 13, color: '#374151' }}>{v}</span>,
    },
    {
      title: 'Model',
      dataIndex: 'model',
      key: 'model',
      render: (v: string) => <span style={{ fontSize: 13, color: '#374151' }}>{v || '—'}</span>,
    },
    {
      title: 'Insurance No.',
      dataIndex: 'insuranceNumber',
      key: 'insuranceNumber',
      render: (v: string) => <span style={{ fontSize: 13, color: '#374151' }}>{v || '—'}</span>,
    },
    {
      title: 'Expiry Date',
      dataIndex: 'insuranceExpiryDate',
      key: 'insuranceExpiryDate',
      width: 130,
      render: (v: string) => v
        ? <span style={{ fontSize: 13 }}>{dayjs(v).format(DATE_FMT)}</span>
        : <span style={{ color: '#9ca3af', fontSize: 13 }}>—</span>,
    },
    {
      title: 'Insurance',
      key: 'insuranceStatus',
      width: 110,
      render: (_: any, r: any) => insuranceStatusCell(r),
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      width: 90,
      render: (v: boolean) => (
        <span style={{ fontSize: 13, color: v ? '#15803d' : '#6b7280' }}>{v ? 'Active' : 'Inactive'}</span>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: any, r: any) => (
        <Space>
          <Tooltip title="Edit"><Button icon={<EditOutlined />} size="small" shape="circle" onClick={() => openEdit(r)} /></Tooltip>
          <Popconfirm title="Deactivate this vehicle?" onConfirm={() => handleDelete(r.id)} okText="Yes" okButtonProps={{ danger: true }}>
            <Tooltip title="Deactivate"><Button icon={<DeleteOutlined />} size="small" shape="circle" danger /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Vehicles"
        subtitle="Fleet vehicles used for sales and delivery routes"
        count={vehicles.filter((v: any) => v.active).length}
        countLabel="active vehicles"
        action={<Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add Vehicle</Button>}
      />

      {expired.length > 0 && (
        <Alert
          type="error"
          icon={<WarningOutlined />}
          showIcon
          style={{ marginBottom: 12 }}
          message={
            <span>
              <strong>{expired.length} vehicle{expired.length > 1 ? 's' : ''} with expired insurance:</strong>{' '}
              {expired.map((a: any) => a.vehicleNumber).join(', ')}
            </span>
          }
        />
      )}

      {nearExpiry.length > 0 && (
        <Alert
          type="warning"
          icon={<WarningOutlined />}
          showIcon
          style={{ marginBottom: 12 }}
          message={
            <span>
              <strong>{nearExpiry.length} vehicle{nearExpiry.length > 1 ? 's' : ''} with insurance expiring within 30 days:</strong>{' '}
              {nearExpiry.map((a: any) => `${a.vehicleNumber} (${a.daysToExpiry}d)`).join(', ')}
            </span>
          }
        />
      )}

      <Table
        columns={columns}
        dataSource={vehicles}
        rowKey="id"
        loading={isLoading}
        size="middle"
        pagination={{ pageSize: 20, showTotal: (t) => `${t} vehicles` }}
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Vehicle' : 'Add Vehicle'}
        width={440}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={creating || updating} onClick={handleSubmit}>
              {editing ? 'Update' : 'Add Vehicle'}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Vehicle Details
          </div>
          <Form.Item
            name="vehicleNumber"
            label="Vehicle Number *"
            rules={[
              { required: true, message: 'Required' },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  const normalised = normaliseVehicleNumber(value);
                  if (!VEHICLE_NUM_REGEX.test(normalised)) {
                    return Promise.reject('Invalid format — expected TN45AB1234');
                  }
                  return Promise.resolve();
                },
              },
            ]}
            normalize={(v) => v ? v.toUpperCase().replace(/[\s\-]/g, '') : v}
          >
            <Input placeholder="e.g. TN45AB1234" maxLength={12} />
          </Form.Item>
          <Form.Item name="vehicleType" label="Vehicle Type *" rules={[{ required: true, message: 'Required' }]}>
            <Select placeholder="Select type">
              {VEHICLE_TYPES.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="model" label="Model / Description">
            <Input placeholder="e.g. Tata Ace, Hero Splendor" />
          </Form.Item>

          <div style={{ marginTop: 16, marginBottom: 8, fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Insurance
          </div>
          <Form.Item name="insuranceNumber" label="Insurance Number *" rules={[{ required: true, message: 'Insurance number is required' }]}>
            <Input placeholder="e.g. INS/2024/00123" maxLength={50} />
          </Form.Item>
          <Form.Item name="insuranceExpiryDate" label="Insurance Expiry Date *" rules={[{ required: true, message: 'Insurance expiry date is required' }]}>
            <DatePicker format={DATE_FMT} style={{ width: '100%' }} placeholder="Select expiry date" />
          </Form.Item>

          {editing && (
            <>
              <div style={{ marginTop: 16, marginBottom: 8, fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Status
              </div>
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
