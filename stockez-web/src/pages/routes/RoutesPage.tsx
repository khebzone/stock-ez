import React, { useState, useEffect } from 'react';
import {
  Button, Modal, Form, Input, Space,
  Row, Col, Card, message, Tooltip, Popconfirm,
  Drawer, Skeleton, Badge, Grid,
} from 'antd';
import {
  PlusOutlined, EnvironmentOutlined,
  PlusCircleOutlined, GlobalOutlined,
  ArrowUpOutlined, ArrowDownOutlined, UnorderedListOutlined,
  UserOutlined, PhoneOutlined, ShopOutlined, DeleteOutlined, EditOutlined, DownloadOutlined,
  WarningFilled, TeamOutlined, ArrowRightOutlined,
} from '@ant-design/icons';

/* ── Animated block error dialog ── */
const BlockedDeleteModal: React.FC<{
  open: boolean;
  routeName: string;
  message: string;
  onClose: () => void;
}> = ({ open, routeName, message: msg, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) setTimeout(() => setVisible(true), 10);
    else setVisible(false);
  }, [open]);

  // Parse customer count from message e.g. "...has 3 active customer(s)..."
  const match = msg.match(/has (\d+) active/);
  const count = match ? parseInt(match[1]) : null;
  const px = window.innerWidth < 480 ? 16 : 28;

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `rgba(15,23,42,${visible ? 0.55 : 0})`,
      transition: 'background 0.25s ease',
      backdropFilter: visible ? 'blur(3px)' : 'none',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(420px, calc(100vw - 64px))', borderRadius: 20, overflow: 'hidden',
          boxShadow: visible ? '0 32px 80px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.06)' : 'none',
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.88) translateY(32px)',
          opacity: visible ? 1 : 0,
          transition: 'all 0.32s cubic-bezier(0.34,1.56,0.64,1)',
          background: '#fff',
        }}
      >
        {/* Top accent bar */}
        <div style={{
          height: 5,
          background: 'linear-gradient(90deg, #f59e0b, #ef4444, #f59e0b)',
          backgroundSize: '200% 100%',
          animation: visible ? 'shimmer-bar 2s linear infinite' : 'none',
        }} />

        {/* Header */}
        <div style={{
          padding: `${px - 4}px ${px}px ${px - 8}px`,
          background: 'linear-gradient(135deg, #fffbeb, #fff7ed)',
          borderBottom: '1px solid #fde68a',
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          {/* Animated icon */}
          <div style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 20px rgba(245,158,11,0.4)',
            animation: visible ? 'bounce-icon 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.2s both' : 'none',
          }}>
            <WarningFilled style={{ color: '#fff', fontSize: 22 }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', lineHeight: 1.3 }}>
              Cannot Delete Route
            </div>
            <div style={{ fontSize: 13, color: '#92400e', marginTop: 4, fontWeight: 500 }}>
              <span style={{
                background: '#fef3c7', border: '1px solid #fde68a',
                borderRadius: 6, padding: '1px 8px', fontWeight: 700,
              }}>
                {routeName}
              </span>
              {' '}has active customers
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: `16px ${px}px` }}>
          {count !== null && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#fef2f2', border: '1.5px solid #fecaca',
              borderRadius: 12, padding: '12px 14px', marginBottom: 16,
              animation: visible ? 'slide-in-left 0.35s ease 0.25s both' : 'none',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(239,68,68,0.35)',
              }}>
                <TeamOutlined style={{ color: '#fff', fontSize: 18 }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 20, color: '#dc2626', lineHeight: 1 }}>
                  {count}
                </div>
                <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, marginTop: 2 }}>
                  Active Customer{count !== 1 ? 's' : ''} on this route
                </div>
              </div>
            </div>
          )}

          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, marginBottom: 16 }}>
            Deleting a route with active customers could disrupt deliveries and order history.
            To proceed, you need to:
          </div>

          {/* Steps */}
          {[
            { step: '1', text: 'Go to Customers page', sub: 'Filter by this route' },
            { step: '2', text: 'Move customers to another route', sub: 'Or mark them as inactive' },
            { step: '3', text: 'Come back and delete this route', sub: 'All stops will be removed too' },
          ].map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 0',
              borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none',
              animation: visible ? `slide-in-left 0.3s ease ${0.3 + i * 0.08}s both` : 'none',
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: 8, flexShrink: 0,
                background: '#f0fdf4', border: '1.5px solid #bbf7d0',
                color: '#059669', fontWeight: 800, fontSize: 11,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {s.step}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{s.text}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{s.sub}</div>
              </div>
              <ArrowRightOutlined style={{ color: '#cbd5e1', fontSize: 11 }} />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: `14px ${px}px 20px`,
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          borderTop: '1px solid #f1f5f9',
        }}>
          <Button
            type="primary"
            onClick={onClose}
            style={{
              borderRadius: 10, fontWeight: 700, height: 40, paddingInline: 24,
              background: 'linear-gradient(135deg, #059669, #047857)',
              border: 'none', boxShadow: '0 4px 14px rgba(5,150,105,0.35)',
            }}
          >
            Got it
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes bounce-icon {
          0%   { transform: scale(0) rotate(-15deg); }
          60%  { transform: scale(1.15) rotate(5deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes slide-in-left {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes shimmer-bar {
          0%   { background-position: 0% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
};
import {
  useGetRoutesQuery, useCreateRouteMutation, useUpdateRouteMutation,
  useAddPlaceMutation, useUpdatePlaceMutation,
  useReorderPlacesMutation, useGetRoutePlanQuery, useDeleteRouteMutation,
} from '../../store/api/routeApi';
import PageHeader from '../../components/PageHeader';
import { applyApiErrorToForm } from '../../utils/formError';

const downloadRouteExcel = (routeId: string, routeName: string) => {
  const token    = localStorage.getItem('token');
  const tenantId = localStorage.getItem('tenantId');
  fetch(`/api/v1/routes/${routeId}/export`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId || '' },
  })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${routeName}-customers-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a); a.click();
      URL.revokeObjectURL(a.href); document.body.removeChild(a);
    });
};

const downloadAllRoutesExcel = () => {
  const token    = localStorage.getItem('token');
  const tenantId = localStorage.getItem('tenantId');
  fetch('/api/v1/routes/export/all', {
    headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId || '' },
  })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `all-routes-customers-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a); a.click();
      URL.revokeObjectURL(a.href); document.body.removeChild(a);
    });
};

/* ── Beat Plan Drawer ── */
const BeatPlanDrawer: React.FC<{ routeId: string | null; onClose: () => void }> = ({ routeId, onClose }) => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { data, isLoading } = useGetRoutePlanQuery(routeId!, { skip: !routeId });
  const plan = data?.data;

  return (
    <Drawer
      title={
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>
            Beat Plan — {plan?.routeName || '...'}
          </div>
          {plan?.assignedSalesPerson && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: 500 }}>
              <UserOutlined style={{ marginRight: 4 }} />
              {plan.assignedSalesPerson.fullName} • {plan.assignedSalesPerson.phone}
            </div>
          )}
        </div>
      }
      open={!!routeId}
      onClose={onClose}
      width={isMobile ? '100%' : 480}
      styles={{ body: { padding: '16px 20px', background: '#f8fafc' } }}
    >
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : !plan?.plan?.length ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
          <EnvironmentOutlined style={{ fontSize: 40, opacity: 0.3, display: 'block', marginBottom: 8 }} />
          No places added to this route yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {plan.plan.map((place: any, pi: number) => (
            <div key={place.id}>
              {/* Place header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: 'linear-gradient(135deg, #059669, #047857)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 800, fontSize: 12,
                }}>
                  {pi + 1}
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{place.name}</div>
                <Badge
                  count={place.customers?.length || 0}
                  style={{ background: '#059669' }}
                  showZero
                />
              </div>

              {/* Customers */}
              {place.customers?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 38 }}>
                  {place.customers.map((c: any, ci: number) => (
                    <div key={c.id} style={{
                      background: '#fff', borderRadius: 8, padding: '10px 14px',
                      border: '1px solid #e8ecf0', display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 6, background: '#ecfdf5',
                        color: '#059669', fontWeight: 700, fontSize: 11,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {ci + 1}
                      </div>
                      <ShopOutlined style={{ color: '#8b5cf6', fontSize: 14, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.businessName}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          <PhoneOutlined style={{ marginRight: 4 }} />{c.phone}
                          {c.ownerName && ` • ${c.ownerName}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ paddingLeft: 38, fontSize: 12, color: '#94a3b8' }}>No customers at this stop</div>
              )}

              {pi < plan.plan.length - 1 && (
                <div style={{ paddingLeft: 13, marginTop: 8 }}>
                  <div style={{ borderLeft: '2px dashed #d1fae5', height: 8 }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
};

/* ── Main Page ── */
const RoutesPage: React.FC = () => {
  const [routeModal, setRouteModal]     = useState(false);
  const [placeModal, setPlaceModal]     = useState(false);
  const [editingRoute, setEditingRoute] = useState<any>(null);   // null = create, object = edit
  const [editingPlace, setEditingPlace] = useState<any>(null);   // { route, place } | null
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [planRouteId, setPlanRouteId]   = useState<string | null>(null);
  const [blockedDelete, setBlockedDelete] = useState<{ routeName: string; message: string } | null>(null);
  const [routeForm] = Form.useForm();
  const [placeForm] = Form.useForm();
  const [editPlaceForm] = Form.useForm();

  const screens = Grid.useBreakpoint();
  const [isXSmall, setIsXSmall] = useState(window.innerWidth <= 360);
  useEffect(() => {
    const handler = () => setIsXSmall(window.innerWidth <= 360);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const { data: routesData, isLoading } = useGetRoutesQuery();
  const [createRoute,  { isLoading: creating }]     = useCreateRouteMutation();
  const [updateRoute,  { isLoading: updatingRoute }] = useUpdateRouteMutation();
  const [addPlace,     { isLoading: addingPlace }]   = useAddPlaceMutation();
  const [updatePlace,  { isLoading: updatingPlace }] = useUpdatePlaceMutation();
  const [reorderPlaces] = useReorderPlacesMutation();
  const [deleteRoute]   = useDeleteRouteMutation();

  const handleDeleteRoute = async (routeId: string, routeName: string) => {
    try {
      await deleteRoute(routeId).unwrap();
      message.success('Route deleted');
    } catch (err: any) {
      const errMsg = err?.data?.message || 'Failed to delete route';
      if (err?.data?.errorCode === 'ROUTE_HAS_CUSTOMERS') {
        setBlockedDelete({ routeName, message: errMsg });
      } else {
        message.error(errMsg);
      }
    }
  };

  const routes = routesData?.data || [];

  const handleRouteSubmit = async () => {
    try {
      const values = await routeForm.validateFields();
      if (editingRoute) {
        await updateRoute({ id: editingRoute.id, data: values }).unwrap();
        message.success('Route renamed');
      } else {
        await createRoute(values).unwrap();
        message.success('Route created');
      }
      routeForm.resetFields();
      setRouteModal(false);
      setEditingRoute(null);
    } catch (err: any) {
      if (err?.errorFields) return;
      const msg = applyApiErrorToForm(err, routeForm, 'name');
      if (msg) message.error(msg);
    }
  };

  const handleEditPlaceSubmit = async () => {
    try {
      const values = await editPlaceForm.validateFields();
      await updatePlace({ routeId: editingPlace.route.id, placeId: editingPlace.place.id, data: values }).unwrap();
      message.success('Stop renamed');
      editPlaceForm.resetFields();
      setEditingPlace(null);
    } catch (err: any) {
      if (err?.errorFields) return;
      const msg = applyApiErrorToForm(err, editPlaceForm, 'name');
      if (msg) message.error(msg);
    }
  };

  const handleAddPlace = async () => {
    try {
      const values = await placeForm.validateFields();
      await addPlace({ routeId: selectedRoute.id, data: values }).unwrap();
      message.success('Stop added');
      placeForm.resetFields();
      setPlaceModal(false);
    } catch (err: any) {
      if (err?.errorFields) return;
      const msg = applyApiErrorToForm(err, placeForm, 'name');
      if (msg) message.error(msg);
    }
  };

  const handleMovePlace = async (route: any, placeIndex: number, direction: 'up' | 'down') => {
    const places = [...(route.places || [])].sort((a: any, b: any) => a.sortOrder - b.sortOrder);
    const newIndex = direction === 'up' ? placeIndex - 1 : placeIndex + 1;
    if (newIndex < 0 || newIndex >= places.length) return;

    const reordered = [...places];
    [reordered[placeIndex], reordered[newIndex]] = [reordered[newIndex], reordered[placeIndex]];
    const placeIds = reordered.map((p: any) => p.id);

    try {
      await reorderPlaces({ routeId: route.id, placeIds }).unwrap();
    } catch {
      message.error('Failed to reorder');
    }
  };

  return (
    <div>
      <PageHeader
        title="Routes & Places"
        subtitle="Define delivery routes, stops in sequence, and assign sales persons"
        count={routes.length}
        countLabel="routes"
        action={
          <Space>
            <Button icon={<DownloadOutlined />} onClick={downloadAllRoutesExcel}>
              Download All Routes
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRoute(null); routeForm.resetFields(); setRouteModal(true); }}>
              Add Route
            </Button>
          </Space>
        }
      />

      {isLoading ? (
        <Row gutter={[16, 16]}>
          {[1, 2].map(i => <Col key={i} xs={24} lg={12}><Card loading style={{ borderRadius: 12 }} /></Col>)}
        </Row>
      ) : routes.length === 0 ? (
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '60px 0' }}>
          <GlobalOutlined style={{ fontSize: 52, color: '#d1d5db' }} />
          <div style={{ marginTop: 16, color: '#9ca3af', fontSize: 15, fontWeight: 500 }}>No routes yet</div>
          <div style={{ color: '#cbd5e1', fontSize: 13, marginTop: 4 }}>Create your first delivery route to get started</div>
          <Button type="primary" style={{ marginTop: 20 }} onClick={() => { setEditingRoute(null); routeForm.resetFields(); setRouteModal(true); }}>
            Create First Route
          </Button>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {routes.map((route: any) => {
            const places = [...(route.places || [])].sort((a: any, b: any) => a.sortOrder - b.sortOrder);
            return (
              <Col key={route.id} xs={24} md={12}>
                <Card
                  style={{ borderRadius: 12, border: '1px solid #e8ecf0', height: '100%' }}
                  styles={{ body: { padding: 0 } }}
                >
                  {/* Route header */}
                  <div style={{
                    padding: isXSmall ? '12px 14px' : '16px 20px',
                    background: 'linear-gradient(135deg, rgba(5,150,105,0.06), rgba(5,150,105,0.02))',
                    borderBottom: '1px solid #f0f5f2',
                    borderRadius: '12px 12px 0 0',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
                  }}>
                    <Space size={10}>
                      <div style={{
                        width: isXSmall ? 32 : 40, height: isXSmall ? 32 : 40, borderRadius: 10,
                        background: 'linear-gradient(135deg, #059669, #047857)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(5,150,105,0.3)',
                      }}>
                        <EnvironmentOutlined style={{ color: '#fff', fontSize: isXSmall ? 14 : 18 }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: isXSmall ? 13 : 15, color: '#0f172a' }}>{route.name}</div>
                        <div style={{ fontSize: isXSmall ? 11 : 12, color: '#64748b', marginTop: 1 }}>
                          {places.length} stop{places.length !== 1 ? 's' : ''} along this route
                        </div>
                      </div>
                    </Space>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isXSmall ? 4 : 6 }}>
                      <Tooltip title="Beat Plan — View ordered stops & customers">
                        <Button size="small" icon={<UnorderedListOutlined />} onClick={() => setPlanRouteId(route.id)} style={{ borderRadius: 6, borderColor: '#059669', color: '#059669' }}>
                          {!isXSmall && 'Beat Plan'}
                        </Button>
                      </Tooltip>
                      <Tooltip title="Download customer list (Excel)">
                        <Button size="small" icon={<DownloadOutlined />} onClick={() => downloadRouteExcel(route.id, route.name)} style={{ borderRadius: 6 }} />
                      </Tooltip>
                      <Tooltip title="Add Stop">
                        <Button size="small" icon={<PlusCircleOutlined />} onClick={() => { setSelectedRoute(route); placeForm.resetFields(); setPlaceModal(true); }} style={{ borderRadius: 6 }}>
                          {!isXSmall && 'Add Stop'}
                        </Button>
                      </Tooltip>
                      <Tooltip title="Edit Route Name">
                        <Button size="small" icon={<EditOutlined />} shape="circle" style={{ borderRadius: 6 }}
                          onClick={() => { setEditingRoute(route); routeForm.setFieldsValue({ name: route.name, description: route.description }); setRouteModal(true); }} />
                      </Tooltip>
                      <Popconfirm title="Delete this route?" description="This will also deactivate all stops. Routes with active customers cannot be deleted."
                        onConfirm={() => handleDeleteRoute(route.id, route.name)} okText="Delete" okButtonProps={{ danger: true }} cancelText="Cancel">
                        <Button size="small" icon={<DeleteOutlined />} shape="circle" danger style={{ borderRadius: 6 }} />
                      </Popconfirm>
                    </div>
                  </div>

                  <div style={{ padding: isXSmall ? '12px 14px' : '16px 20px' }}>
                    {/* Ordered stops */}
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      Route Sequence
                    </div>

                    {places.length === 0 ? (
                      <div
                        onClick={() => { setSelectedRoute(route); placeForm.resetFields(); setPlaceModal(true); }}
                        style={{
                          border: '2px dashed #bbf7d0', borderRadius: 10,
                          padding: '20px', textAlign: 'center', cursor: 'pointer',
                          background: '#f0fdf4', transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#059669')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#bbf7d0')}
                      >
                        <PlusCircleOutlined style={{ fontSize: 28, color: '#059669', display: 'block', marginBottom: 6 }} />
                        <div style={{ fontWeight: 700, color: '#059669', fontSize: 14 }}>Add First Stop</div>
                        <div style={{ color: '#6ee7b7', fontSize: 12, marginTop: 2 }}>
                          e.g. Kovilacheri, Solapuram, Nagercoil
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {places.map((place: any, idx: number) => (
                          <div key={place.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {/* Connector line */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                              <div style={{
                                width: 20, height: 20, borderRadius: 6,
                                background: idx === 0 ? 'linear-gradient(135deg, #059669, #047857)' : '#e8ecf0',
                                color: idx === 0 ? '#fff' : '#64748b',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 10, fontWeight: 800,
                              }}>
                                {idx + 1}
                              </div>
                              {idx < places.length - 1 && (
                                <div style={{ width: 2, height: 12, background: '#d1d5db', marginTop: 2 }} />
                              )}
                            </div>

                            {/* Place name */}
                            <div style={{
                              flex: 1, background: '#f8fafc', borderRadius: 8,
                              padding: isXSmall ? '6px 10px' : '7px 12px', fontSize: isXSmall ? 12 : 13, fontWeight: 600,
                              color: '#374151', border: '1px solid #e8ecf0',
                            }}>
                              {place.name}
                            </div>

                            {/* Edit + Up/Down buttons */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <button
                                onClick={() => {
                                  setEditingPlace({ route, place });
                                  editPlaceForm.setFieldsValue({ name: place.name });
                                }}
                                style={{
                                  width: 22, height: 22, borderRadius: 4, border: '1px solid #e2e8f0',
                                  background: '#fff', cursor: 'pointer', color: '#64748b',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, padding: 0,
                                }}
                                title="Rename stop"
                              >
                                <EditOutlined />
                              </button>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <button
                                  disabled={idx === 0}
                                  onClick={() => handleMovePlace(route, idx, 'up')}
                                  style={{
                                    width: 22, height: 22, borderRadius: 4, border: '1px solid #e2e8f0',
                                    background: idx === 0 ? '#f8fafc' : '#fff', cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                    color: idx === 0 ? '#cbd5e1' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 10, padding: 0,
                                  }}
                                >
                                  <ArrowUpOutlined />
                                </button>
                                <button
                                  disabled={idx === places.length - 1}
                                  onClick={() => handleMovePlace(route, idx, 'down')}
                                  style={{
                                    width: 22, height: 22, borderRadius: 4, border: '1px solid #e2e8f0',
                                    background: idx === places.length - 1 ? '#f8fafc' : '#fff',
                                    cursor: idx === places.length - 1 ? 'not-allowed' : 'pointer',
                                    color: idx === places.length - 1 ? '#cbd5e1' : '#64748b',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 10, padding: 0,
                                  }}
                                >
                                  <ArrowDownOutlined />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {/* Add more stops button */}
                        <button
                          onClick={() => { setSelectedRoute(route); placeForm.resetFields(); setPlaceModal(true); }}
                          style={{
                            marginTop: 6, width: '100%', padding: '7px', borderRadius: 8,
                            border: '1.5px dashed #bbf7d0', background: '#f0fdf4',
                            color: '#059669', fontWeight: 600, fontSize: 12,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = '#059669')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = '#bbf7d0')}
                        >
                          <PlusCircleOutlined /> Add Another Stop
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Beat Plan Drawer */}
      <BeatPlanDrawer routeId={planRouteId} onClose={() => setPlanRouteId(null)} />

      {/* Blocked delete animated dialog */}
      <BlockedDeleteModal
        open={!!blockedDelete}
        routeName={blockedDelete?.routeName || ''}
        message={blockedDelete?.message || ''}
        onClose={() => setBlockedDelete(null)}
      />

      {/* Create / Edit Route Modal */}
      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 16 }}>{editingRoute ? 'Rename Route' : 'Create Route'}</span>}
        open={routeModal}
        onOk={handleRouteSubmit}
        onCancel={() => { setRouteModal(false); setEditingRoute(null); routeForm.resetFields(); }}
        confirmLoading={creating || updatingRoute}
        okText={editingRoute ? 'Save' : 'Create Route'}
        width={420}
      >
        {!editingRoute && (
          <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 14px', margin: '16px 0', fontSize: 13, color: '#065f46' }}>
            A route is the path your salesman and delivery vehicle takes from your godown to customer shops.
          </div>
        )}
        <Form form={routeForm} layout="vertical" style={{ marginTop: editingRoute ? 16 : 0 }}>
          <Form.Item name="name" label="Route Name" rules={[
            { required: true, message: 'Route name is required' },
            { min: 2, message: 'Must be at least 2 characters' },
            { pattern: /^[a-zA-Z\s\-.]+$/, message: 'Only letters, spaces or hyphens allowed — no numbers' },
          ]}>
            <Input
              placeholder="e.g. Cholapuram, Papanasam, Kumbakonam East"
              size="large" autoFocus
              onPressEnter={handleRouteSubmit}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Stop Modal */}
      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 16 }}>Add Stop — {selectedRoute?.name}</span>}
        open={placeModal}
        onOk={handleAddPlace}
        onCancel={() => { setPlaceModal(false); placeForm.resetFields(); }}
        confirmLoading={addingPlace}
        okText="Add Stop"
        width={420}
      >
        <div style={{ background: '#ecfdf5', borderRadius: 8, padding: '10px 14px', marginTop: 12, marginBottom: 16, fontSize: 13, color: '#065f46' }}>
          A stop is a village or area your vehicle passes through. Stops are visited in the order you add them — you can reorder anytime.
        </div>
        <Form form={placeForm} layout="vertical">
          <Form.Item name="name" label="Stop Name" rules={[
            { required: true, message: 'Stop name is required' },
            { min: 2, message: 'Must be at least 2 characters' },
            { pattern: /^[a-zA-Z\s\-.]+$/, message: 'Only letters, spaces or hyphens allowed — no numbers' },
          ]}>
            <Input
              placeholder="e.g. Kovilacheri, Solapuram, Papanasam"
              size="large" autoFocus
              onPressEnter={handleAddPlace}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Stop Modal */}
      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 16 }}>Rename Stop — {editingPlace?.place?.name}</span>}
        open={!!editingPlace}
        onOk={handleEditPlaceSubmit}
        onCancel={() => { setEditingPlace(null); editPlaceForm.resetFields(); }}
        confirmLoading={updatingPlace}
        okText="Save"
        width={420}
      >
        <Form form={editPlaceForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Stop Name" rules={[
            { required: true, message: 'Stop name is required' },
            { min: 2, message: 'Must be at least 2 characters' },
            { pattern: /^[a-zA-Z\s\-.]+$/, message: 'Only letters, spaces or hyphens allowed — no numbers' },
          ]}>
            <Input
              size="large" autoFocus
              onPressEnter={handleEditPlaceSubmit}
            />
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
};

export default RoutesPage;
