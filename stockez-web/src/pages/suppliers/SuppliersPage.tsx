import React, { useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Space, Card, Popconfirm, message, Row, Col, Drawer, Grid,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import {
  useGetSuppliersQuery, useCreateSupplierMutation,
  useUpdateSupplierMutation, useDeleteSupplierMutation,
} from '../../store/api/supplierApi';
import PageHeader from '../../components/PageHeader';
import AuditHistoryButton from '../../components/AuditHistoryButton';

const SuppliersPage: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [search, setSearch]           = useState('');
  const [modalOpen, setModalOpen]     = useState(false);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [editing, setEditing]         = useState<any>(null);
  const [viewing, setViewing]         = useState<any>(null);
  const [form] = Form.useForm();

  const { data, isLoading, refetch } = useGetSuppliersQuery({ search });
  const [createSupplier, { isLoading: creating }] = useCreateSupplierMutation();
  const [updateSupplier, { isLoading: updating }] = useUpdateSupplierMutation();
  const [deleteSupplier] = useDeleteSupplierMutation();

  const handleExport = () => {
    const token    = localStorage.getItem('token');
    const tenantId = localStorage.getItem('tenantId');
    const a = document.createElement('a');
    a.href = `/api/v1/suppliers/export`;
    a.style.display = 'none';
    fetch('/api/v1/suppliers/export', {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId || '' },
    })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = `suppliers-${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      })
      .catch(() => message.error('Export failed'));
  };

  const suppliers = data?.data?.content || data?.data || [];

  const openAdd = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (s: any) => {
    setEditing(s); form.setFieldsValue({ ...s }); setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await updateSupplier({ id: editing.id, data: values }).unwrap();
        message.success('Supplier updated');
      } else {
        await createSupplier(values).unwrap();
        message.success('Supplier added');
      }
      setModalOpen(false);
      refetch();
    } catch (err: any) {
      if (err?.errorFields) {
        form.scrollToField(err.errorFields[0].name);
        return;
      }
      message.error(err?.data?.message || 'Failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSupplier(id).unwrap();
      message.success('Supplier removed');
      refetch();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed');
    }
  };

  const columns = [
    {
      title: 'Supplier',
      key: 'supplier',
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.name}</div>
          {r.contactPerson && <div style={{ fontSize: 12, color: '#64748b' }}>{r.contactPerson}</div>}
        </div>
      ),
    },
    {
      title: 'Phone',
      key: 'phone',
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontSize: 14 }}>{r.phone}</div>
          {r.altPhone && <div style={{ fontSize: 14, color: '#94a3b8' }}>{r.altPhone}</div>}
        </div>
      ),
    },
    {
      title: 'Location',
      key: 'location',
      render: (_: any, r: any) => (
        <span style={{ fontSize: 14, color: '#475569' }}>
          {[r.city, r.state].filter(Boolean).join(', ') || '—'}
        </span>
      ),
    },
    {
      title: 'GSTIN',
      dataIndex: 'gstin',
      key: 'gstin',
      render: (v: string) => <span style={{ fontSize: 14, fontFamily: 'monospace', color: '#374151' }}>{v || '—'}</span>,
    },
    {
      title: 'FSSAI',
      dataIndex: 'fssaiNumber',
      key: 'fssai',
      render: (v: string) => <span style={{ fontSize: 14, color: '#374151' }}>{v || '—'}</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 150,
      render: (_: any, r: any) => (
        <Space>
          <Button type="text" size="small" icon={<EyeOutlined />}
            onClick={() => { setViewing(r); setDrawerOpen(true); }} />
          <Button type="text" size="small" icon={<EditOutlined />}
            onClick={() => openEdit(r)} />
          <Popconfirm title="Remove this supplier?" onConfirm={() => handleDelete(r.id)}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
          <AuditHistoryButton entityType="SUPPLIER" entityId={r.id} title={`Audit — ${r.name}`} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle="Companies that supply your products"
        count={suppliers.length}
        countLabel="suppliers"
        action={
          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>Export Excel</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}
              style={{ background: '#059669', borderColor: '#059669', fontWeight: 700 }}>
              Add Supplier
            </Button>
          </Space>
        }
      />

      {isMobile ? (
        <>
          <div style={{ marginBottom: 12 }}>
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Search by name or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              allowClear
              size="large"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
            {suppliers.length === 0 && !isLoading && (
              <div style={{ padding: '40px 0', color: '#64748b', textAlign: 'center' }}>No suppliers yet. Add your first supplier.</div>
            )}
            {suppliers.map((r: any) => (
              <div key={r.id} style={{ background: '#fff', border: '2.5px solid #059669', borderRadius: 12, padding: '14px 14px 10px', boxShadow: '4px 4px 0 #059669' }}>
                {/* Top row: avatar + name + contact */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', background: '#059669',
                    color: '#fff', fontWeight: 700, fontSize: 16, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {r.name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{r.name}</div>
                    {r.contactPerson && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{r.contactPerson}</div>}
                  </div>
                </div>

                {/* Detail rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingLeft: 52, marginBottom: 10 }}>
                  {r.phone && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#94a3b8', width: 64, flexShrink: 0 }}>Phone</span>
                      <span style={{ fontSize: 12, color: '#1e293b', fontWeight: 500 }}>{r.phone}{r.altPhone ? ` / ${r.altPhone}` : ''}</span>
                    </div>
                  )}
                  {(r.city || r.state) && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#94a3b8', width: 64, flexShrink: 0 }}>Location</span>
                      <span style={{ fontSize: 12, color: '#1e293b' }}>{[r.city, r.state].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  {r.gstin && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#94a3b8', width: 64, flexShrink: 0 }}>GSTIN</span>
                      <span style={{ fontSize: 12, color: '#1e293b', fontFamily: 'monospace', wordBreak: 'break-all' }}>{r.gstin}</span>
                    </div>
                  )}
                  {r.fssaiNumber && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#94a3b8', width: 64, flexShrink: 0 }}>FSSAI</span>
                      <span style={{ fontSize: 12, color: '#1e293b', wordBreak: 'break-all' }}>{r.fssaiNumber}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                  <Button size="small" icon={<EyeOutlined />} onClick={() => { setViewing(r); setDrawerOpen(true); }}>View</Button>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Edit</Button>
                  <Popconfirm title="Remove this supplier?" onConfirm={() => handleDelete(r.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
                  </Popconfirm>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Card style={{ borderRadius: 12, padding: 0 }} styles={{ body: { padding: 0 } }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
            <Input.Search
              placeholder="Search by name or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onSearch={v => setSearch(v)}
              allowClear
              style={{ maxWidth: 320 }}
            />
          </div>
          <Table
            columns={columns} dataSource={suppliers} rowKey="id" loading={isLoading}
            pagination={{ pageSize: 20, showTotal: t => `${t} suppliers` }}
            size="middle" scroll={{ x: 800 }}
            locale={{ emptyText: <div style={{ padding: '40px 0', color: '#64748b' }}>No suppliers yet. Add your first supplier.</div> }}
          />
        </Card>
      )}

      {/* Add / Edit Modal */}
      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 16 }}>{editing ? 'Edit Supplier' : 'Add Supplier'}</span>}
        open={modalOpen} onOk={handleSubmit} onCancel={() => setModalOpen(false)}
        confirmLoading={creating || updating} width={isMobile ? '95vw' : 680}
        okText={editing ? 'Update' : 'Add Supplier'}
        okButtonProps={{ style: { background: '#059669', borderColor: '#059669' } }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
            Basic Info
          </div>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="name" label="Supplier / Company Name *" rules={[{ required: true }]}>
                <Input placeholder="e.g. Hindustan Unilever Ltd" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="contactPerson" label="Contact Person *" rules={[
                { required: true, message: 'Contact Person is required' },
                { pattern: /^[A-Za-z\s.]+$/, message: 'Only letters are allowed' },
              ]}>
                <Input placeholder="Sales representative name" maxLength={100} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="phone" label="Phone *" rules={[{ required: true }, { pattern: /^\d{10}$/, message: '10 digits' }]}>
                <Input placeholder="9876543210" maxLength={10} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="altPhone" label="Alt Phone"
                rules={[{ pattern: /^\d{10}$/, message: 'Must be exactly 10 digits' }]}>
                <Input placeholder="Optional" maxLength={10} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Enter a valid email (e.g. name@domain.com)' }]}>
                <Input placeholder="supplier@company.com" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, margin: '8px 0 12px' }}>
            Address
          </div>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="address" label="Address"
                rules={[{ pattern: /.*[a-zA-Z0-9].*/, message: 'Must contain at least one letter or number' }]}>
                <Input.TextArea rows={2} placeholder="Street, Area" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="city" label="City"
                rules={[{ pattern: /.*[a-zA-Z].*/, message: 'Must contain at least one letter' }]}>
                <Input placeholder="City" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="state" label="State"
                rules={[{ pattern: /.*[a-zA-Z].*/, message: 'Must contain at least one letter' }]}>
                <Input placeholder="State" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, margin: '8px 0 12px' }}>
            Regulatory
          </div>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="gstin" label="GSTIN"
                rules={[{ pattern: /^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][0-9A-Za-z][Zz][0-9A-Za-z]$/, message: 'Invalid GSTIN — expected format: 29AADCB2230M1ZV' }]}>
                <Input placeholder="22AAAAA0000A1Z5" maxLength={15}
                  onChange={e => form.setFieldValue('gstin', e.target.value.toUpperCase())}
                  style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="fssaiNumber" label="FSSAI License No."
                rules={[{ pattern: /^[0-9]{14}$/, message: 'Must be exactly 14 digits (e.g. 10012345678901)' }]}>
                <Input placeholder="10012345678901" maxLength={14} />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, margin: '8px 0 12px' }}>
            Bank Details (optional)
          </div>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="bankName" label="Bank Name"
                rules={[{ pattern: /.*[a-zA-Z].*/, message: 'Must contain at least one letter' }]}>
                <Input placeholder="e.g. SBI" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="bankIfsc" label="IFSC Code"
                rules={[{ pattern: /^[A-Za-z]{4}[0][A-Za-z0-9]{6}$/, message: 'Invalid IFSC — expected format: SBIN0001234' }]}>
                <Input placeholder="SBIN0001234" maxLength={11}
                  onChange={e => form.setFieldValue('bankIfsc', e.target.value.toUpperCase())}
                  style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="bankAccount" label="Account Number" style={{ marginBottom: 0 }}
                rules={[{ pattern: /^[0-9]{6,20}$/, message: 'Must be 6 to 20 digits' }]}>
                <Input placeholder="Account number" maxLength={20} />
              </Form.Item>
            </Col>
          </Row>
          <button type="submit" style={{ display: 'none' }} />
        </Form>
      </Modal>

      {/* View Drawer */}
      <Drawer
        title={<div style={{ fontWeight: 800, fontSize: 15 }}>{viewing?.name}</div>}
        open={drawerOpen} onClose={() => setDrawerOpen(false)} width={isMobile ? '100%' : 400}
        footer={
          <Space>
            <Button onClick={() => { setDrawerOpen(false); openEdit(viewing); }} icon={<EditOutlined />}>Edit</Button>
            <Button onClick={() => setDrawerOpen(false)}>Close</Button>
          </Space>
        }
      >
        {viewing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { label: 'Contact Person', value: viewing.contactPerson },
              { label: 'Phone',          value: viewing.phone },
              { label: 'Alt Phone',      value: viewing.altPhone },
              { label: 'Email',          value: viewing.email },
              { label: 'Address',        value: viewing.address },
              { label: 'City',           value: viewing.city },
              { label: 'State',          value: viewing.state },
              { label: 'GSTIN',          value: viewing.gstin },
              { label: 'FSSAI No.',      value: viewing.fssaiNumber },
              { label: 'Bank',           value: viewing.bankName },
              { label: 'Account',        value: viewing.bankAccount },
              { label: 'IFSC',           value: viewing.bankIfsc },
            ].map(row => row.value ? (
              <div key={row.label} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 3 }}>{row.label}</div>
                <div style={{ fontSize: 14, color: '#0f172a', wordBreak: 'break-all' }}>{row.value}</div>
              </div>
            ) : null)}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default SuppliersPage;
