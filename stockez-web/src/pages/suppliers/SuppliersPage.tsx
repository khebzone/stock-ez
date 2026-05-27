import React, { useRef, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Space, Card, Popconfirm, message, Row, Col, Drawer, Alert, Grid,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, DownloadOutlined, UploadOutlined, FileExcelOutlined, SearchOutlined } from '@ant-design/icons';
import {
  useGetSuppliersQuery, useCreateSupplierMutation,
  useUpdateSupplierMutation, useDeleteSupplierMutation, useImportSuppliersMutation,
} from '../../store/api/supplierApi';
import PageHeader from '../../components/PageHeader';
import AuditHistoryButton from '../../components/AuditHistoryButton';

const SuppliersPage: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [search, setSearch]           = useState('');
  const [modalOpen, setModalOpen]     = useState(false);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [importOpen, setImportOpen]   = useState(false);
  const [importing, setImporting]     = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [editing, setEditing]         = useState<any>(null);
  const [viewing, setViewing]         = useState<any>(null);
  const [form] = Form.useForm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch } = useGetSuppliersQuery({ search });
  const [createSupplier, { isLoading: creating }] = useCreateSupplierMutation();
  const [updateSupplier, { isLoading: updating }] = useUpdateSupplierMutation();
  const [deleteSupplier] = useDeleteSupplierMutation();
  const [importSuppliers] = useImportSuppliersMutation();

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

  const handleTemplateDownload = () => {
    const token    = localStorage.getItem('token');
    const tenantId = localStorage.getItem('tenantId');
    fetch('/api/v1/suppliers/import/template', {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId || '' },
    })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'supplier-import-template.xlsx';
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(a.href);
        document.body.removeChild(a);
      })
      .catch(() => message.error('Download failed'));
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await importSuppliers(fd).unwrap();
      setImportResult(res.data);
      refetch();
    } catch (err: any) {
      message.error(err?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
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
      if (err?.errorFields) return;
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
            <Button icon={<UploadOutlined />} onClick={() => { setImportResult(null); setImportOpen(true); }}>Import</Button>
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
              <Form.Item name="contactPerson" label="Contact Person">
                <Input placeholder="Sales representative name" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="phone" label="Phone *" rules={[{ required: true }, { pattern: /^\d{10}$/, message: '10 digits' }]}>
                <Input placeholder="9876543210" maxLength={10} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="altPhone" label="Alt Phone">
                <Input placeholder="Optional" maxLength={15} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Valid email' }]}>
                <Input placeholder="supplier@company.com" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, margin: '8px 0 12px' }}>
            Address
          </div>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="address" label="Address">
                <Input.TextArea rows={2} placeholder="Street, Area" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="city" label="City">
                <Input placeholder="City" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="state" label="State">
                <Input placeholder="State" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, margin: '8px 0 12px' }}>
            Regulatory
          </div>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="gstin" label="GSTIN">
                <Input placeholder="22AAAAA0000A1Z5" maxLength={15}
                  onChange={e => form.setFieldValue('gstin', e.target.value.toUpperCase())}
                  style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="fssaiNumber" label="FSSAI License No.">
                <Input placeholder="10012345678901" maxLength={20} />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, margin: '8px 0 12px' }}>
            Bank Details (optional)
          </div>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="bankName" label="Bank Name">
                <Input placeholder="e.g. SBI" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="bankIfsc" label="IFSC Code">
                <Input placeholder="SBIN0001234" maxLength={15}
                  onChange={e => form.setFieldValue('bankIfsc', e.target.value.toUpperCase())}
                  style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="bankAccount" label="Account Number" style={{ marginBottom: 0 }}>
                <Input placeholder="Account number" maxLength={30} />
              </Form.Item>
            </Col>
          </Row>
          <button type="submit" style={{ display: 'none' }} />
        </Form>
      </Modal>

      {/* Import Modal */}
      <Modal
        title={<span style={{ fontWeight: 700 }}>Import Suppliers from Excel</span>}
        open={importOpen}
        onCancel={() => { setImportOpen(false); setImportResult(null); }}
        footer={null}
        width={520}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Before you start</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#64748b', lineHeight: 1.8 }}>
              <li>Download the template, fill in your supplier data, then upload.</li>
              <li>Columns marked <strong>*</strong> (Name, Phone) are required.</li>
              <li>Phone must be 10–15 digits. Duplicate phones are skipped.</li>
              <li>Row 2 in the template is a sample — delete it before uploading.</li>
            </ul>
            <Button
              size="small" icon={<FileExcelOutlined />}
              onClick={handleTemplateDownload}
              style={{ marginTop: 10, fontSize: 12 }}
            >
              Download Template
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = '';
            }}
          />

          <Button
            type="primary" icon={<UploadOutlined />} size="large" block
            loading={importing}
            onClick={() => fileInputRef.current?.click()}
            style={{ background: '#059669', borderColor: '#059669', fontWeight: 700 }}
          >
            {importing ? 'Importing…' : 'Choose Excel File & Import'}
          </Button>

          {importResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Alert
                type={importResult.skipped > 0 ? 'warning' : 'success'}
                message={`${importResult.created} supplier(s) imported${importResult.skipped > 0 ? `, ${importResult.skipped} skipped` : ''}`}
                showIcon
              />
              {importResult.errors?.length > 0 && (
                <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', maxHeight: 160, overflowY: 'auto' }}>
                  {importResult.errors.map((e: string, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: '#dc2626', marginBottom: 3 }}>{e}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
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
