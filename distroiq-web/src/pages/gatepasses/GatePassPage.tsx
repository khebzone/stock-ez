import React, { useState } from 'react';
import {
  Table, Button, Tabs, DatePicker, Form, Select, InputNumber,
  Space, Drawer, message, Tooltip, Input,
} from 'antd';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetAllocationsForDateQuery,
  useAllocateSalesMutation,
  useAllocateDeliveryMutation,
} from '../../store/api/routeAllocationApi';
import { useGetRoutesQuery } from '../../store/api/routeApi';
import { useGetUsersQuery } from '../../store/api/userApi';
import { useGetActiveVehiclesQuery } from '../../store/api/vehicleApi';
import PageHeader from '../../components/PageHeader';

const GatePassPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [activeTab, setActiveTab] = useState('sales');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<'sales' | 'delivery'>('sales');
  const [editingAlloc, setEditingAlloc] = useState<any>(null);
  const [form] = Form.useForm();

  const { data: allocData, isLoading } = useGetAllocationsForDateQuery(selectedDate);
  const { data: routesData } = useGetRoutesQuery();
  const { data: usersData } = useGetUsersQuery();
  const { data: vehiclesData } = useGetActiveVehiclesQuery();

  const [allocateSales, { isLoading: savingSales }] = useAllocateSalesMutation();
  const [allocateDelivery, { isLoading: savingDelivery }] = useAllocateDeliveryMutation();

  const allocations: any[] = allocData?.data?.allocations || [];
  const routes: any[] = routesData?.data || [];
  const users: any[] = usersData?.data?.content || usersData?.data || [];
  const vehicles: any[] = vehiclesData?.data || [];

  const editingAllocId = editingAlloc?.id;

  // IDs already committed on this date — exclude current editing allocation so it can keep its own assignments
  const allocatedAsSalesVehicleIds = new Set(
    allocations.filter((a: any) => a.salesVehicle && a.id !== editingAllocId).map((a: any) => a.salesVehicle.id)
  );
  const allocatedAsDeliveryVehicleIds = new Set(
    allocations.filter((a: any) => a.deliveryVehicle && a.id !== editingAllocId).map((a: any) => a.deliveryVehicle.id)
  );
  // Routes already assigned a Sales person — hide from Sales dropdown
  const allocatedSalesRouteIds = new Set(
    allocations.filter((a: any) => a.salesPerson && a.id !== editingAllocId).map((a: any) => a.routeId)
  );
  // Routes already assigned a Delivery person — hide from Delivery dropdown
  const allocatedDeliveryRouteIds = new Set(
    allocations.filter((a: any) => a.deliveryPerson && a.id !== editingAllocId).map((a: any) => a.routeId)
  );

  const allocatedSalesPersonIds = new Set(
    allocations.filter((a: any) => a.salesPerson && a.id !== editingAllocId).map((a: any) => a.salesPerson.id)
  );
  const allocatedDeliveryPersonIds = new Set(
    allocations.filter((a: any) => a.deliveryPerson && a.id !== editingAllocId).map((a: any) => a.deliveryPerson.id)
  );

  const salesPersons = users.filter((u: any) => u.role === 'SALES' && u.active && !allocatedSalesPersonIds.has(u.id));
  const deliveryPersons = users.filter((u: any) => u.role === 'DELIVERY' && u.active && !allocatedDeliveryPersonIds.has(u.id));

  // Any vehicle already in any allocation on this date is hidden from all dropdowns
  const allAllocatedVehicleIds = new Set([...allocatedAsSalesVehicleIds, ...allocatedAsDeliveryVehicleIds]);
  const salesVehicles = vehicles.filter((v: any) => !allAllocatedVehicleIds.has(v.id));
  const deliveryVehicles = vehicles.filter((v: any) => !allAllocatedVehicleIds.has(v.id));

  const openAdd = (type: 'sales' | 'delivery') => {
    setDrawerType(type);
    setEditingAlloc(null);
    form.resetFields();
    form.setFieldValue('allocationDate', dayjs(selectedDate));
    setDrawerOpen(true);
  };

  const openEdit = (alloc: any, type: 'sales' | 'delivery') => {
    setDrawerType(type);
    setEditingAlloc(alloc);
    if (type === 'sales') {
      form.setFieldsValue({
        allocationDate: dayjs(alloc.allocationDate),
        routeId: alloc.routeId,
        salesPersonId: alloc.salesPerson?.id,
        salesVehicleId: alloc.salesVehicle?.id,
        salesStartKm: alloc.salesStartKm,
        salesEndKm: alloc.salesEndKm,
        notes: alloc.notes,
      });
    } else {
      form.setFieldsValue({
        allocationDate: dayjs(alloc.allocationDate),
        routeId: alloc.routeId,
        deliveryPersonId: alloc.deliveryPerson?.id,
        deliveryVehicleId: alloc.deliveryVehicle?.id,
        deliveryStartKm: alloc.deliveryStartKm,
        deliveryEndKm: alloc.deliveryEndKm,
        notes: alloc.notes,
      });
    }
    setDrawerOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        allocationDate: dayjs(values.allocationDate).format('YYYY-MM-DD'),
      };
      if (drawerType === 'sales') {
        await allocateSales(payload).unwrap();
      } else {
        await allocateDelivery(payload).unwrap();
      }
      message.success(`${drawerType === 'sales' ? 'Sales' : 'Delivery'} gate pass saved`);
      setDrawerOpen(false);
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to save');
    }
  };

  const salesColumns = [
    {
      title: 'Route',
      key: 'route',
      render: (_: any, r: any) => <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{r.routeName}</span>,
    },
    {
      title: 'Sales Person',
      key: 'salesPerson',
      render: (_: any, r: any) => r.salesPerson ? (
        <div>
          <div style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>{r.salesPerson.fullName}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{r.salesPerson.phone}</div>
        </div>
      ) : <span style={{ color: '#9ca3af', fontSize: 13 }}>Not assigned</span>,
    },
    {
      title: 'Vehicle',
      key: 'vehicle',
      render: (_: any, r: any) => r.salesVehicle ? (
        <div>
          <div style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>{r.salesVehicle.vehicleNumber}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{r.salesVehicle.vehicleType}</div>
        </div>
      ) : <span style={{ color: '#9ca3af', fontSize: 13 }}>—</span>,
    },
    {
      title: 'Start KM',
      key: 'startKm',
      width: 100,
      align: 'right' as const,
      render: (_: any, r: any) => <span style={{ fontSize: 14 }}>{r.salesStartKm ?? '—'}</span>,
    },
    {
      title: 'End KM',
      key: 'endKm',
      width: 100,
      align: 'right' as const,
      render: (_: any, r: any) => <span style={{ fontSize: 14 }}>{r.salesEndKm ?? '—'}</span>,
    },
    {
      title: 'KM Driven',
      key: 'kmDriven',
      width: 110,
      align: 'right' as const,
      render: (_: any, r: any) => {
        if (r.salesStartKm != null && r.salesEndKm != null) {
          const km = r.salesEndKm - r.salesStartKm;
          return <span style={{ fontSize: 14, fontWeight: 600 }}>{km} km</span>;
        }
        return <span style={{ color: '#9ca3af', fontSize: 13 }}>—</span>;
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 90,
      render: (_: any, r: any) => (
        <span style={{ fontSize: 14, color: r.status === 'ACTIVE' ? '#15803d' : '#6b7280' }}>{r.status}</span>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 70,
      render: (_: any, r: any) => (
        <Tooltip title="Edit Sales Gate Pass">
          <Button icon={<EditOutlined />} size="small" shape="circle" onClick={() => openEdit(r, 'sales')} />
        </Tooltip>
      ),
    },
  ];

  const deliveryColumns = [
    {
      title: 'Route',
      key: 'route',
      render: (_: any, r: any) => <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{r.routeName}</span>,
    },
    {
      title: 'Delivery Person',
      key: 'deliveryPerson',
      render: (_: any, r: any) => r.deliveryPerson ? (
        <div>
          <div style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>{r.deliveryPerson.fullName}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{r.deliveryPerson.phone}</div>
        </div>
      ) : <span style={{ color: '#9ca3af', fontSize: 13 }}>Not assigned</span>,
    },
    {
      title: 'Vehicle',
      key: 'vehicle',
      render: (_: any, r: any) => r.deliveryVehicle ? (
        <div>
          <div style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>{r.deliveryVehicle.vehicleNumber}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{r.deliveryVehicle.vehicleType}</div>
        </div>
      ) : <span style={{ color: '#9ca3af', fontSize: 13 }}>—</span>,
    },
    {
      title: 'Start KM',
      key: 'startKm',
      width: 100,
      align: 'right' as const,
      render: (_: any, r: any) => <span style={{ fontSize: 14 }}>{r.deliveryStartKm ?? '—'}</span>,
    },
    {
      title: 'End KM',
      key: 'endKm',
      width: 100,
      align: 'right' as const,
      render: (_: any, r: any) => <span style={{ fontSize: 14 }}>{r.deliveryEndKm ?? '—'}</span>,
    },
    {
      title: 'KM Driven',
      key: 'kmDriven',
      width: 110,
      align: 'right' as const,
      render: (_: any, r: any) => {
        if (r.deliveryStartKm != null && r.deliveryEndKm != null) {
          const km = r.deliveryEndKm - r.deliveryStartKm;
          return <span style={{ fontSize: 14, fontWeight: 600 }}>{km} km</span>;
        }
        return <span style={{ color: '#9ca3af', fontSize: 13 }}>—</span>;
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 90,
      render: (_: any, r: any) => (
        <span style={{ fontSize: 14, color: r.status === 'ACTIVE' ? '#15803d' : '#6b7280' }}>{r.status}</span>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 70,
      render: (_: any, r: any) => (
        <Tooltip title="Edit Delivery Gate Pass">
          <Button icon={<EditOutlined />} size="small" shape="circle" onClick={() => openEdit(r, 'delivery')} />
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Gate Pass"
        subtitle="Assign sales and delivery personnel to routes for the day"
        action={
          <Space>
            <DatePicker
              value={dayjs(selectedDate)}
              onChange={(d) => d && setSelectedDate(d.format('YYYY-MM-DD'))}
              format="DD MMM YYYY"
              allowClear={false}
            />
            <Button type="primary" icon={<PlusOutlined />}
              onClick={() => openAdd(activeTab === 'sales' ? 'sales' : 'delivery')}>
              New {activeTab === 'sales' ? 'Sales' : 'Delivery'} Gate Pass
            </Button>
          </Space>
        }
      />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'sales',
            label: 'Sales Gate Pass',
            children: (
              <Table
                columns={salesColumns}
                dataSource={allocations.filter((a: any) => a.salesPerson != null)}
                rowKey="id"
                loading={isLoading}
                size="middle"
                pagination={false}
                locale={{ emptyText: 'No sales gate passes for this date' }}
              />
            ),
          },
          {
            key: 'delivery',
            label: 'Delivery Gate Pass',
            children: (
              <Table
                columns={deliveryColumns}
                dataSource={allocations.filter((a: any) => a.deliveryPerson != null)}
                rowKey="id"
                loading={isLoading}
                size="middle"
                pagination={false}
                locale={{ emptyText: 'No delivery gate passes for this date' }}
              />
            ),
          },
        ]}
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={`${drawerType === 'sales' ? 'Sales' : 'Delivery'} Gate Pass`}
        width={460}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={savingSales || savingDelivery} onClick={handleSubmit}>
              Save Gate Pass
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="allocationDate" label="Date *" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
          </Form.Item>
          <Form.Item name="routeId" label="Route *" rules={[{ required: true, message: 'Select a route' }]}>
            <Select placeholder="Select route" showSearch optionFilterProp="label"
              options={routes
                .filter((r: any) => drawerType === 'sales'
                  ? !allocatedSalesRouteIds.has(r.id)
                  : !allocatedDeliveryRouteIds.has(r.id))
                .map((r: any) => ({ value: r.id, label: r.name }))} />
          </Form.Item>

          {drawerType === 'sales' ? (
            <>
              <Form.Item name="salesPersonId" label="Sales Person *" rules={[{ required: true, message: 'Select a sales person' }]}>
                <Select placeholder="Select sales person" showSearch optionFilterProp="label"
                  options={salesPersons.map((u: any) => ({ value: u.id, label: `${u.fullName} — ${u.phone}` }))} />
              </Form.Item>
              <Form.Item name="salesVehicleId" label="Vehicle">
                <Select placeholder="Select vehicle" allowClear showSearch optionFilterProp="label"
                  options={salesVehicles.map((v: any) => ({ value: v.id, label: `${v.vehicleNumber} (${v.vehicleType})` }))} />
              </Form.Item>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Form.Item name="salesStartKm" label="Start KM (Odometer)">
                  <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 45230"
                    onChange={() => form.validateFields(['salesEndKm'])} />
                </Form.Item>
                <Form.Item name="salesEndKm" label="End KM (on return)"
                  dependencies={['salesStartKm']}
                  rules={[
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const start = getFieldValue('salesStartKm');
                        if (value == null || start == null) return Promise.resolve();
                        if (value < start) return Promise.reject('End KM must be ≥ Start KM');
                        return Promise.resolve();
                      },
                    }),
                  ]}>
                  <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 45380" />
                </Form.Item>
              </div>
            </>
          ) : (
            <>
              <Form.Item name="deliveryPersonId" label="Delivery Person *" rules={[{ required: true, message: 'Select a delivery person' }]}>
                <Select placeholder="Select delivery person" showSearch optionFilterProp="label"
                  options={deliveryPersons.map((u: any) => ({ value: u.id, label: `${u.fullName} — ${u.phone}` }))} />
              </Form.Item>
              <Form.Item name="deliveryVehicleId" label="Vehicle">
                <Select placeholder="Select vehicle" allowClear showSearch optionFilterProp="label"
                  options={deliveryVehicles.map((v: any) => ({ value: v.id, label: `${v.vehicleNumber} (${v.vehicleType})` }))} />
              </Form.Item>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Form.Item name="deliveryStartKm" label="Start KM (Odometer)">
                  <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 45230"
                    onChange={() => form.validateFields(['deliveryEndKm'])} />
                </Form.Item>
                <Form.Item name="deliveryEndKm" label="End KM (on return)"
                  dependencies={['deliveryStartKm']}
                  rules={[
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const start = getFieldValue('deliveryStartKm');
                        if (value == null || start == null) return Promise.resolve();
                        if (value < start) return Promise.reject('End KM must be ≥ Start KM');
                        return Promise.resolve();
                      },
                    }),
                  ]}>
                  <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 45380" />
                </Form.Item>
              </div>
            </>
          )}

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Optional notes..." />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default GatePassPage;
