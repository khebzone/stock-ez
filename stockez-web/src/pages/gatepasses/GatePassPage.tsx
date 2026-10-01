import React, { useState, useEffect } from 'react';
import {
  Table, Button, Tabs, DatePicker, Form, Select, InputNumber,
  Space, Drawer, message, Tooltip, Input, Tag, Spin, Alert, Modal,
} from 'antd';
import {
  EditOutlined, PlusOutlined, CheckCircleOutlined, UserOutlined, PrinterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetAllocationsForDateQuery,
  useAllocateSalesMutation,
  useAllocateDeliveryMutation,
  useAllocateWarehouseMutation,
  useGetDeliveryRouteSummaryQuery,
  useGetWarehouseSummaryQuery,
  useDispatchPackedOrdersMutation,
  useMarkSalesCompleteMutation,
  useMarkDeliveryCompleteMutation,
  useMarkWarehouseCompleteMutation,
} from '../../store/api/routeAllocationApi';
import { useGetRoutesQuery } from '../../store/api/routeApi';
import { useGetUsersQuery } from '../../store/api/userApi';
import { useGetActiveVehiclesQuery } from '../../store/api/vehicleApi';
import { useLazyGetDeliveryRunInvoicesQuery } from '../../store/api/orderApi';
import { useGetCompanyProfileQuery } from '../../store/api/supplierApi';
import PageHeader from '../../components/PageHeader';
import AuditHistoryButton from '../../components/AuditHistoryButton';
import { BulkInvoicePrint } from '../../components/InvoicePrint';
import { hasPermission } from '../../utils/permissions';

const GatePassPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  // Order/Preparing/Assigned/Value counts reflect live status right now, not a historical
  // snapshot of the selected date — the backend has no per-day order-status history to draw
  // from. Only trust/show them when looking at today; a past/future date only carries
  // accurate info for who was assigned, not order counts.
  const isToday = selectedDate === dayjs().format('YYYY-MM-DD');
  const [activeTab, setActiveTab] = useState('warehouse');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<'sales' | 'delivery' | 'warehouse'>('sales');
  const [editingAlloc, setEditingAlloc] = useState<any>(null);
  const [inlineDelivery, setInlineDelivery] = useState<Record<string, { personId?: string; vehicleId?: string }>>({});
  const [inlineWarehouse, setInlineWarehouse] = useState<Record<string, { personId?: string }>>({});
  const [form] = Form.useForm();

  const { data: allocData, isLoading } = useGetAllocationsForDateQuery(selectedDate, { refetchOnMountOrArgChange: true });
  const { data: deliverySummaryData, isLoading: summaryLoading, refetch: refetchSummary } =
    useGetDeliveryRouteSummaryQuery(selectedDate, { refetchOnMountOrArgChange: true });
  const { data: warehouseSummaryData, isLoading: warehouseLoading, refetch: refetchWarehouse } =
    useGetWarehouseSummaryQuery(selectedDate, { refetchOnMountOrArgChange: true });
  const { data: routesData } = useGetRoutesQuery(undefined, { refetchOnMountOrArgChange: true });
  const { data: usersData } = useGetUsersQuery();
  const { data: vehiclesData } = useGetActiveVehiclesQuery();

  const [allocateSales, { isLoading: savingSales }] = useAllocateSalesMutation();
  const [allocateDelivery, { isLoading: savingDelivery }] = useAllocateDeliveryMutation();
  const [allocateWarehouse, { isLoading: savingWarehouse }] = useAllocateWarehouseMutation();
  const [dispatchPacked, { isLoading: dispatching }] = useDispatchPackedOrdersMutation();
  const [markSalesComplete, { isLoading: completingSales }] = useMarkSalesCompleteMutation();
  const [markDeliveryComplete, { isLoading: completingDelivery }] = useMarkDeliveryCompleteMutation();
  const [markWarehouseComplete, { isLoading: completingWarehouse }] = useMarkWarehouseCompleteMutation();

  // ── Bulk invoice printing for a whole delivery run ──
  const { data: companyProfileData } = useGetCompanyProfileQuery();
  const companyProfile = companyProfileData?.data;
  const [fetchRunInvoices] = useLazyGetDeliveryRunInvoicesQuery();
  const [printOrders, setPrintOrders] = useState<any[]>([]);
  const [printingRouteId, setPrintingRouteId] = useState<string | null>(null);

  const handlePrintRun = async (row: any) => {
    if (!row.allocationId) return;
    setPrintingRouteId(row.routeId);
    try {
      const res = await fetchRunInvoices(row.allocationId).unwrap();
      const orders: any[] = res?.data || [];
      if (orders.length === 0) {
        message.info('No dispatched orders to print — click "Dispatch Now" first');
        return;
      }
      setPrintOrders(orders);
    } catch (e: any) {
      message.error(e?.data?.message || 'Failed to load invoices for this run');
    } finally {
      setPrintingRouteId(null);
    }
  };

  useEffect(() => {
    if (printOrders.length === 0) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [printOrders]);

  const allocations: any[] = allocData?.data?.allocations || [];
  const deliveryRows: any[] = deliverySummaryData?.data?.routes || [];
  const warehouseRows: any[] = warehouseSummaryData?.data?.routes || [];
  const routes: any[] = routesData?.data || [];
  const users: any[] = usersData?.data?.content || usersData?.data || [];
  const vehicles: any[] = vehiclesData?.data || [];

  const editingAllocId = editingAlloc?.id;

  const allocatedAsSalesVehicleIds = new Set(
    allocations.filter((a: any) => a.salesVehicle && a.id !== editingAllocId).map((a: any) => a.salesVehicle.id)
  );
  const allocatedAsDeliveryVehicleIds = new Set(
    allocations.filter((a: any) => a.deliveryVehicle && a.id !== editingAllocId).map((a: any) => a.deliveryVehicle.id)
  );
  const allocatedSalesRouteIds = new Set(
    allocations.filter((a: any) => a.salesPerson && a.id !== editingAllocId).map((a: any) => a.routeId)
  );
  const allocatedDeliveryRouteIds = new Set(
    allocations.filter((a: any) => a.deliveryPerson && a.id !== editingAllocId).map((a: any) => a.routeId)
  );
  const allocatedSalesPersonIds = new Set(
    allocations.filter((a: any) => a.salesPerson && a.id !== editingAllocId && !a.salesCompleted).map((a: any) => a.salesPerson.id)
  );
  const allocatedDeliveryPersonIds = new Set(
    allocations.filter((a: any) => a.deliveryPerson && a.id !== editingAllocId && !a.deliveryCompleted).map((a: any) => a.deliveryPerson.id)
  );
  const allocatedWarehousePersonIds = new Set(
    allocations.filter((a: any) => a.warehousePerson && a.id !== editingAllocId && !a.warehouseCompleted).map((a: any) => a.warehousePerson.id)
  );

  const fieldUsers = users.filter((u: any) => u.active && u.roleName !== 'ADMIN' && u.roleName !== 'SUPER_ADMIN');
  const salesPersons    = fieldUsers.filter((u: any) => !allocatedSalesPersonIds.has(u.id));
  const deliveryPersons = fieldUsers.filter((u: any) => !allocatedDeliveryPersonIds.has(u.id));
  const warehousePersons = fieldUsers.filter((u: any) => !allocatedWarehousePersonIds.has(u.id));
  const allAllocatedVehicleIds = new Set([...allocatedAsSalesVehicleIds, ...allocatedAsDeliveryVehicleIds]);
  const salesVehicles = vehicles.filter((v: any) => !allAllocatedVehicleIds.has(v.id));
  const deliveryVehicles = vehicles.filter((v: any) => !allAllocatedVehicleIds.has(v.id));

  const openAdd = (type: 'sales' | 'delivery' | 'warehouse') => {
    setDrawerType(type);
    setEditingAlloc(null);
    form.resetFields();
    form.setFieldValue('allocationDate', dayjs(selectedDate));
    setDrawerOpen(true);
  };

  const openEdit = (alloc: any, type: 'sales' | 'delivery' | 'warehouse') => {
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
      const payload = { ...values, allocationDate: dayjs(values.allocationDate).format('YYYY-MM-DD') };
      if (drawerType === 'sales') {
        await allocateSales(payload).unwrap();
      } else if (drawerType === 'warehouse') {
        await allocateWarehouse(payload).unwrap();
        refetchWarehouse();
      } else {
        await allocateDelivery(payload).unwrap();
        refetchSummary();
      }
      message.success(`${drawerType === 'sales' ? 'Sales' : drawerType === 'warehouse' ? 'Warehouse' : 'Delivery'} gate pass saved`);
      setDrawerOpen(false);
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to save');
    }
  };

  const handleInlineWarehouseAssign = async (row: any) => {
    const sel = inlineWarehouse[row.routeId] || {};
    if (!sel.personId) { message.warning('Select a warehouse person first'); return; }
    try {
      await allocateWarehouse({
        routeId: row.routeId,
        allocationDate: selectedDate,
        warehousePersonId: sel.personId,
      }).unwrap();
      message.success(`Warehouse person assigned to ${row.routeName}`);
      setInlineWarehouse(prev => { const n = { ...prev }; delete n[row.routeId]; return n; });
      refetchWarehouse();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to assign');
    }
  };

  const handleCompleteDelivery = async (r: any, force = false) => {
    try {
      await markDeliveryComplete(force ? { allocationId: r.allocationId, force: true } : r.allocationId).unwrap();
      message.success('Delivery run marked complete');
      refetchSummary();
    } catch (e: any) {
      if (e?.data?.errorCode === 'PENDING_DELIVERIES') {
        Modal.confirm({
          title: 'Undelivered orders remain',
          content: `${e?.data?.message}. Complete this run anyway? It will be recorded as closed with pending deliveries.`,
          okText: 'Complete anyway',
          okButtonProps: { danger: true },
          onOk: () => handleCompleteDelivery(r, true),
        });
      } else {
        message.error(e?.data?.message || 'Failed to complete');
      }
    }
  };

  const deliveryCompletedTag = (r: any) => {
    if (r.deliveryTotalCount == null) return <Tag color="green">Completed</Tag>; // legacy runs (no snapshot)
    const pending = r.deliveryPendingCount || 0;
    const label = `Completed · ${r.deliveryDeliveredCount ?? 0}/${r.deliveryTotalCount}${pending ? ` · ${pending} pending` : ''}`;
    const tag = <Tag color={pending ? 'orange' : 'green'} style={{ margin: 0 }}>{label}</Tag>;
    return r.deliveryCompletedAt
      ? <Tooltip title={`Completed ${dayjs(r.deliveryCompletedAt).format('DD MMM YYYY, hh:mm A')}`}>{tag}</Tooltip>
      : tag;
  };

  const handleInlineAssign = async (row: any) => {
    const sel = inlineDelivery[row.routeId] || {};
    if (!sel.personId) { message.warning('Select a delivery person first'); return; }
    try {
      await allocateDelivery({
        routeId: row.routeId,
        allocationDate: selectedDate,
        deliveryPersonId: sel.personId,
        deliveryVehicleId: sel.vehicleId || undefined,
      }).unwrap();
      message.success(`Delivery person assigned to ${row.routeName}`);
      setInlineDelivery(prev => { const n = { ...prev }; delete n[row.routeId]; return n; });
      refetchSummary();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to assign');
    }
  };

  // ── Warehouse summary tab columns ─────────────────────────────────────────
  // Warehouse persons stay in the warehouse and can handle multiple routes — no exclusion needed.

  const warehouseColumns = [
    {
      title: 'Route',
      key: 'route',
      render: (_: any, r: any) => <span style={{ fontWeight: 600 }}>{r.routeName}</span>,
    },
    {
      title: 'Orders',
      key: 'orders',
      width: 220,
      render: (_: any, r: any) => {
        if (!isToday) {
          return <span style={{ color: '#c0c6cf', fontSize: 13 }}>—</span>;
        }
        if (!r.pendingCount) {
          return <span style={{ color: '#9ca3af', fontSize: 13 }}>No pending orders</span>;
        }
        return <Tag color="orange" style={{ margin: 0 }}>{r.pendingCount} to pack</Tag>;
      },
    },
    {
      title: 'Warehouse Person',
      key: 'warehousePerson',
      width: 260,
      render: (_: any, r: any) => {
        if (r.warehousePerson) {
          return (
            <Space size={8}>
              {!r.warehouseCompleted && <CheckCircleOutlined style={{ color: '#16a34a' }} />}
              <div>
                <div style={{ fontWeight: 500 }}>{r.warehousePerson.fullName}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{r.warehousePerson.phone}</div>
              </div>
              {r.warehouseCompleted && <Tag color="green">Completed</Tag>}
            </Space>
          );
        }

        // Assignment only for today (past = read-only history).
        if (!isToday || !r.pendingCount) {
          return <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>;
        }

        if (!hasPermission('GATE_PASS_CREATE')) {
          return <span style={{ color: '#9ca3af', fontSize: 12 }}>Awaiting assignment</span>;
        }

        const sel = inlineWarehouse[r.routeId] || {};

        return (
          <Space size={4}>
            <Select
              placeholder={<span><UserOutlined /> Assign person</span>}
              style={{ width: 200 }}
              value={sel.personId}
              onChange={val => setInlineWarehouse(prev => ({ ...prev, [r.routeId]: { personId: val } }))}
              showSearch
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().startsWith(input.toLowerCase())}
              options={warehousePersons.map((u: any) => ({ value: u.id, label: u.fullName }))}
              size="small"
            />
            <Button
              type="primary" size="small"
              loading={savingWarehouse}
              onClick={() => handleInlineWarehouseAssign(r)}
            >
              Assign
            </Button>
          </Space>
        );
      },
    },
    {
      title: '',
      key: 'actions',
      width: 180,
      align: 'right' as const,
      render: (_: any, r: any) => {
        // Past dates read-only; actions only on assigned, not-yet-completed rows for today.
        if (!isToday || !r.warehousePerson || r.warehouseCompleted) {
          return r.allocationId ? <AuditHistoryButton entityType="ROUTE_ALLOCATION" entityId={r.allocationId} title={`Warehouse Gate Pass — ${r.routeName}`} /> : null;
        }
        return (
          <Space size={4}>
            {hasPermission('GATE_PASS_CREATE') && (
              <Tooltip title="Change assignment">
                <Button icon={<EditOutlined />} size="small" shape="circle"
                  onClick={() => {
                    form.resetFields();
                    form.setFieldsValue({ allocationDate: dayjs(selectedDate), routeId: r.routeId, warehousePersonId: r.warehousePerson.id });
                    setDrawerType('warehouse');
                    setEditingAlloc({ id: r.allocationId });
                    setDrawerOpen(true);
                  }}
                />
              </Tooltip>
            )}
            {hasPermission('GATE_PASS_CREATE') && (
              <Tooltip title="Mark this warehouse task complete — frees this person for a different route">
                <Button
                  size="small"
                  loading={completingWarehouse}
                  onClick={async () => {
                    try {
                      await markWarehouseComplete(r.allocationId).unwrap();
                      message.success('Warehouse task marked complete');
                      refetchWarehouse();
                    } catch (e: any) {
                      message.error(e?.data?.message || 'Failed to complete');
                    }
                  }}
                >
                  Complete
                </Button>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  // ── Sales tab columns ──────────────────────────────────────────────────────
  const salesColumns = [
    {
      title: 'Route',
      key: 'route',
      render: (_: any, r: any) => <span style={{ fontWeight: 600 }}>{r.routeName}</span>,
    },
    {
      title: 'Sales Person',
      key: 'salesPerson',
      render: (_: any, r: any) => r.salesPerson
        ? <div><div style={{ fontWeight: 500 }}>{r.salesPerson.fullName}</div><div style={{ fontSize: 12, color: '#6b7280' }}>{r.salesPerson.phone}</div></div>
        : <span style={{ color: '#9ca3af', fontSize: 13 }}>Not assigned</span>,
    },
    {
      title: 'Vehicle',
      key: 'vehicle',
      render: (_: any, r: any) => r.salesVehicle
        ? <div><div style={{ fontWeight: 500 }}>{r.salesVehicle.vehicleNumber}</div><div style={{ fontSize: 12, color: '#6b7280' }}>{r.salesVehicle.vehicleType}</div></div>
        : <span style={{ color: '#9ca3af' }}>—</span>,
    },
    { title: 'Start KM', key: 'startKm', width: 100, align: 'right' as const, render: (_: any, r: any) => r.salesStartKm ?? '—' },
    { title: 'End KM', key: 'endKm', width: 100, align: 'right' as const, render: (_: any, r: any) => r.salesEndKm ?? '—' },
    {
      title: 'KM Driven', key: 'km', width: 110, align: 'right' as const,
      render: (_: any, r: any) => r.salesStartKm != null && r.salesEndKm != null
        ? <span style={{ fontWeight: 600 }}>{r.salesEndKm - r.salesStartKm} km</span>
        : <span style={{ color: '#9ca3af' }}>—</span>,
    },
    {
      title: 'Status', key: 'status', width: 110,
      render: (_: any, r: any) => r.salesCompleted
        ? <Tag color="green">Completed</Tag>
        : isToday
          ? <Tag color="blue">Active</Tag>
          : <Tag>Not completed</Tag>,
    },
    {
      title: '', key: 'actions', width: 160,
      render: (_: any, r: any) => {
        // Past dates are read-only history — no editing/completing an old day's gate pass.
        if (!isToday || r.salesCompleted) {
          return r.id ? <AuditHistoryButton entityType="ROUTE_ALLOCATION" entityId={r.id} title={`Sales Gate Pass — ${r.routeName}`} /> : null;
        }
        return (
          <Space size={4}>
            {hasPermission('GATE_PASS_CREATE') && (
              <Tooltip title="Edit Sales Gate Pass">
                <Button icon={<EditOutlined />} size="small" shape="circle" onClick={() => openEdit(r, 'sales')} />
              </Tooltip>
            )}
            {hasPermission('GATE_PASS_CREATE') && (
              <Button
                size="small" type="primary"
                loading={completingSales}
                onClick={async () => {
                  try {
                    await markSalesComplete(r.id).unwrap();
                    message.success('Route marked as completed');
                  } catch (e: any) {
                    message.error(e?.data?.message || 'Failed to complete');
                  }
                }}
              >
                Complete
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  // ── Delivery summary tab ───────────────────────────────────────────────────
  const deliveryColumns = [
    {
      title: 'Route',
      key: 'route',
      render: (_: any, r: any) => <span style={{ fontWeight: 600 }}>{r.routeName}</span>,
    },
    {
      title: 'Assigned',
      key: 'assigned',
      width: 110,
      align: 'center' as const,
      render: (_: any, r: any) => {
        const n = r.assignedCount || 0;
        return (
          <Tooltip title={n > 0 ? `${n} order(s) assigned to this route's delivery run` : 'No orders assigned'}>
            <Tag color={n > 0 ? 'blue' : 'default'} style={{ margin: 0 }}>{n}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Order Value',
      key: 'value',
      width: 180,
      align: 'right' as const,
      render: (_: any, r: any) => {
        const hasAssigned = (r.assignedCount || 0) > 0;
        const showBacklog = isToday && (r.unassignedPackedCount || 0) > 0;
        if (!hasAssigned && !showBacklog) {
          return <span style={{ color: '#9ca3af' }}>—</span>;
        }
        const assignedPacked = r.assignedPackedCount || 0;
        const assignedDispatched = r.assignedDispatchedCount || 0;
        return (
          <div>
            {hasAssigned && (
              <div>
                <div style={{ fontWeight: 600 }}>₹{Number(r.assignedValue || 0).toFixed(2)}</div>
                {(assignedPacked > 0 || assignedDispatched > 0) && (
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    {[
                      assignedPacked > 0 ? `${assignedPacked} packed` : null,
                      assignedDispatched > 0 ? `${assignedDispatched} dispatched` : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            )}
            {showBacklog && (
              <div style={{ fontSize: 11, color: '#d97706' }}>
                {r.unassignedPackedCount} packed · ₹{Number(r.unassignedPackedValue || 0).toFixed(2)} unassigned
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Delivery Person',
      key: 'deliveryPerson',
      width: 240,
      render: (_: any, r: any) => {
        if (r.deliveryPerson) {
          return (
            <div>
              <div style={{ fontWeight: 500 }}>{r.deliveryPerson.fullName}</div>
              {r.deliveryVehicle && <div style={{ fontSize: 12, color: '#6b7280' }}>{r.deliveryVehicle.vehicleNumber}</div>}
            </div>
          );
        }

        // Unassigned: assignment is only possible for today (past = read-only history).
        if (!isToday || r.unassignedPackedCount === 0) {
          return <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>;
        }

        if (!hasPermission('GATE_PASS_CREATE')) {
          return <span style={{ color: '#9ca3af', fontSize: 12 }}>Awaiting assignment</span>;
        }

        const sel = inlineDelivery[r.routeId] || {};
        const availablePersons = deliveryPersons.filter((u: any) =>
          !allocatedDeliveryPersonIds.has(u.id) || u.id === sel.personId
        );
        const availableVehicles = vehicles.filter((v: any) =>
          !allAllocatedVehicleIds.has(v.id) || v.id === sel.vehicleId
        );

        return (
          <Space size={4}>
            <Select
              placeholder={<span><UserOutlined /> Assign person</span>}
              style={{ width: 170 }}
              value={sel.personId}
              onChange={val => setInlineDelivery(prev => ({ ...prev, [r.routeId]: { ...prev[r.routeId], personId: val } }))}
              showSearch
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().startsWith(input.toLowerCase())}
              options={availablePersons.map((u: any) => ({ value: u.id, label: u.fullName }))}
              size="small"
            />
            <Select
              placeholder="Vehicle"
              style={{ width: 110 }}
              value={sel.vehicleId}
              onChange={val => setInlineDelivery(prev => ({ ...prev, [r.routeId]: { ...prev[r.routeId], vehicleId: val } }))}
              allowClear
              options={availableVehicles.map((v: any) => ({ value: v.id, label: v.vehicleNumber }))}
              size="small"
            />
            <Button
              type="primary" size="small"
              loading={savingDelivery}
              onClick={() => handleInlineAssign(r)}
            >
              Assign
            </Button>
          </Space>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 170,
      render: (_: any, r: any) => {
        if (!r.deliveryPerson) return <span style={{ color: '#9ca3af' }}>—</span>;
        if (r.deliveryCompleted) return deliveryCompletedTag(r);
        return isToday ? <Tag color="blue">Active</Tag> : <Tag>Not completed</Tag>;
      },
    },
    {
      title: '',
      key: 'actions',
      width: 320,
      align: 'right' as const,
      render: (_: any, r: any) => {
        const runToPrint = (r.assignedDispatchedCount || 0) > 0;
        const printBtn = r.allocationId && runToPrint ? (
          <Tooltip title="Print all dispatched invoices for this delivery run">
            <Button size="small" icon={<PrinterOutlined />} loading={printingRouteId === r.routeId}
              onClick={() => handlePrintRun(r)}>Print Invoices</Button>
          </Tooltip>
        ) : null;
        // Past dates are read-only history; only assigned, not-yet-completed rows for today
        // carry actions. Unassigned rows handle assignment in the Delivery Person column.
        if (!isToday || !r.deliveryPerson || r.deliveryCompleted) {
          return (
            <Space size={4}>
              {printBtn}
              {r.allocationId ? <AuditHistoryButton entityType="ROUTE_ALLOCATION" entityId={r.allocationId} title={`Delivery Gate Pass — ${r.routeName}`} /> : null}
            </Space>
          );
        }
        return (
          <Space size={4}>
            {printBtn}
            {hasPermission('GATE_PASS_CREATE') && (
              <Tooltip title="Change assignment">
                <Button icon={<EditOutlined />} size="small" shape="circle"
                  onClick={() => {
                    const alloc = allocations.find((a: any) => a.routeId === r.routeId && a.deliveryPerson);
                    if (alloc) openEdit(alloc, 'delivery');
                    else {
                      form.resetFields();
                      form.setFieldsValue({ allocationDate: dayjs(selectedDate), routeId: r.routeId, deliveryPersonId: r.deliveryPerson.id, deliveryVehicleId: r.deliveryVehicle?.id });
                      setDrawerType('delivery');
                      setEditingAlloc({ id: r.allocationId });
                      setDrawerOpen(true);
                    }
                  }}
                />
              </Tooltip>
            )}
            {r.assignedPackedCount > 0 && (
              <Tooltip title={`Dispatch all ${r.assignedPackedCount} assigned packed orders now`}>
                <Button
                  size="small" type="primary"
                  loading={dispatching}
                  onClick={async () => {
                    try {
                      const res = await dispatchPacked(r.allocationId).unwrap();
                      message.success(res?.message || 'Orders dispatched');
                      refetchSummary();
                    } catch (e: any) {
                      message.error(e?.data?.message || 'Failed to dispatch');
                    }
                  }}
                >
                  Dispatch Now
                </Button>
              </Tooltip>
            )}
            {hasPermission('GATE_PASS_CREATE') && (
              <Tooltip title="Mark this delivery run complete — frees this person for a different route">
                <Button
                  size="small"
                  loading={completingDelivery}
                  onClick={() => handleCompleteDelivery(r)}
                >
                  Complete
                </Button>
              </Tooltip>
            )}
          </Space>
        );
      },
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
              disabledDate={(d) => d && d.isAfter(dayjs(), 'day')}
            />
            {hasPermission('GATE_PASS_CREATE') && (
              <Button type="primary" icon={<PlusOutlined />}
                onClick={() => openAdd(activeTab === 'sales' ? 'sales' : activeTab === 'warehouse' ? 'warehouse' : 'delivery')}>
                New {activeTab === 'sales' ? 'Sales' : activeTab === 'warehouse' ? 'Warehouse' : 'Delivery'} Gate Pass
              </Button>
            )}
          </Space>
        }
      />

      {!isToday && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Viewing a past date (read-only)"
          description="This is the historical record for the selected date — who was assigned to each route and how many orders were on their run. Assignments cannot be changed for past dates."
        />
      )}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'warehouse',
            label: 'Warehouse Gate Pass',
            children: (
              <Spin spinning={warehouseLoading}>
                <Table
                  columns={warehouseColumns}
                  dataSource={warehouseRows.filter((r: any) =>
                    isToday ? r.pendingCount > 0 : !!r.warehousePerson
                  )}
                  rowKey="routeId"
                  size="middle"
                  pagination={false}
                  locale={{ emptyText: isToday ? 'No routes with pending orders today' : 'No warehouse assignments on this date' }}
                />
              </Spin>
            ),
          },
          {
            key: 'delivery',
            label: 'Delivery Gate Pass',
            children: (
              <Spin spinning={summaryLoading}>
                <Table
                  columns={deliveryColumns}
                  dataSource={deliveryRows.filter((r: any) =>
                    r.deliveryPerson || r.assignedCount > 0 || (isToday && r.unassignedPackedCount > 0)
                  )}
                  rowKey="routeId"
                  size="middle"
                  pagination={false}
                  locale={{ emptyText: isToday ? 'No routes with packed orders today' : 'No delivery assignments on this date' }}
                />
              </Spin>
            ),
          },
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
        ]}
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={`${drawerType === 'sales' ? 'Sales' : drawerType === 'warehouse' ? 'Warehouse' : 'Delivery'} Gate Pass`}
        width={460}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={savingSales || savingDelivery || savingWarehouse} onClick={handleSubmit}>
              Save Gate Pass
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="allocationDate" label="Date *" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY"
              disabledDate={(d) => d && d.isAfter(dayjs(), 'day')} />
          </Form.Item>
          <Form.Item name="routeId" label="Route *" rules={[{ required: true, message: 'Select a route' }]}>
            <Select placeholder="Select route" showSearch filterOption={(input, option) => (option?.label as string)?.toLowerCase().startsWith(input.toLowerCase())}
              options={routes
                .filter((r: any) => drawerType === 'sales'
                  ? !allocatedSalesRouteIds.has(r.id)
                  : !allocatedDeliveryRouteIds.has(r.id))
                .map((r: any) => ({ value: r.id, label: r.name }))} />
          </Form.Item>

          {drawerType === 'sales' ? (
            <>
              <Form.Item name="salesPersonId" label="Sales Person *" rules={[{ required: true, message: 'Select a sales person' }]}>
                <Select placeholder="Select sales person" showSearch filterOption={(input, option) => (option?.label as string)?.toLowerCase().startsWith(input.toLowerCase())}
                  options={salesPersons.map((u: any) => ({ value: u.id, label: `${u.fullName} — ${u.phone}` }))} />
              </Form.Item>
              <Form.Item name="salesVehicleId" label="Vehicle">
                <Select placeholder="Select vehicle" allowClear showSearch filterOption={(input, option) => (option?.label as string)?.toLowerCase().startsWith(input.toLowerCase())}
                  options={salesVehicles.map((v: any) => ({ value: v.id, label: `${v.vehicleNumber} (${v.vehicleType})` }))} />
              </Form.Item>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Form.Item name="salesStartKm" label="Start KM">
                  <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 45230" />
                </Form.Item>
                <Form.Item name="salesEndKm" label="End KM"
                  dependencies={['salesStartKm']}
                  rules={[({ getFieldValue }) => ({
                    validator(_, value) {
                      const start = getFieldValue('salesStartKm');
                      if (value == null || start == null) return Promise.resolve();
                      if (value < start) return Promise.reject('End KM must be ≥ Start KM');
                      return Promise.resolve();
                    },
                  })]}>
                  <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 45380" />
                </Form.Item>
              </div>
            </>
          ) : drawerType === 'warehouse' ? (
            <>
              <Form.Item name="warehousePersonId" label="Warehouse Person *" rules={[{ required: true, message: 'Select a warehouse person' }]}>
                <Select placeholder="Select warehouse person" showSearch filterOption={(input, option) => (option?.label as string)?.toLowerCase().startsWith(input.toLowerCase())}
                  options={warehousePersons.map((u: any) => ({ value: u.id, label: `${u.fullName} — ${u.phone}` }))} />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item name="deliveryPersonId" label="Delivery Person *" rules={[{ required: true, message: 'Select a delivery person' }]}>
                <Select placeholder="Select delivery person" showSearch filterOption={(input, option) => (option?.label as string)?.toLowerCase().startsWith(input.toLowerCase())}
                  options={deliveryPersons.map((u: any) => ({ value: u.id, label: `${u.fullName} — ${u.phone}` }))} />
              </Form.Item>
              <Form.Item name="deliveryVehicleId" label="Vehicle">
                <Select placeholder="Select vehicle" allowClear showSearch filterOption={(input, option) => (option?.label as string)?.toLowerCase().startsWith(input.toLowerCase())}
                  options={deliveryVehicles.map((v: any) => ({ value: v.id, label: `${v.vehicleNumber} (${v.vehicleType})` }))} />
              </Form.Item>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Form.Item name="deliveryStartKm" label="Start KM">
                  <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 45230" />
                </Form.Item>
                <Form.Item name="deliveryEndKm" label="End KM"
                  dependencies={['deliveryStartKm']}
                  rules={[({ getFieldValue }) => ({
                    validator(_, value) {
                      const start = getFieldValue('deliveryStartKm');
                      if (value == null || start == null) return Promise.resolve();
                      if (value < start) return Promise.reject('End KM must be ≥ Start KM');
                      return Promise.resolve();
                    },
                  })]}>
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

      {/* Hidden bulk invoices — shown only when printing (see .print-invoice in index.css) */}
      <BulkInvoicePrint orders={printOrders} company={companyProfile} />
    </div>
  );
};

export default GatePassPage;
