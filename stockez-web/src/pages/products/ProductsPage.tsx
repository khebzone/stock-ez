import React, { useState } from 'react';
import {
  Table, Button, Drawer, Form, Input, InputNumber, Select, Space,
  Popconfirm, message, Tooltip, Card, Row, Col, DatePicker,
  Upload, Modal, Grid,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  CalendarOutlined, WarningOutlined, CameraOutlined,
  InboxOutlined, LoadingOutlined, HddOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { UploadChangeParam } from 'antd/es/upload';
import {
  useGetProductsQuery, useCreateProductMutation, useUpdateProductMutation,
  useDeleteProductMutation,
} from '../../store/api/productApi';
import { useGetBatchesByProductQuery } from '../../store/api/purchaseApi';
import { useGetMastersQuery } from '../../store/api/productMasterApi';
import PageHeader from '../../components/PageHeader';
import { hasPermission } from '../../utils/permissions';
import AuditHistoryButton from '../../components/AuditHistoryButton';
import { applyApiErrorToForm } from '../../utils/formError';

const { Option } = Select;


// ─── Image uploader component ─────────────────────────────────────────────────

const ProductImageUpload: React.FC<{
  value?: string;
  onChange?: (url: string) => void;
}> = ({ value, onChange }) => {
  const [uploading, setUploading] = useState(false);
  const token = localStorage.getItem('token');

  const handleChange = (info: UploadChangeParam) => {
    if (info.file.status === 'uploading') { setUploading(true); return; }
    if (info.file.status === 'done') {
      setUploading(false);
      const url = info.file.response?.data?.url;
      if (url && onChange) onChange(url);
    }
    if (info.file.status === 'error') {
      setUploading(false);
      message.error('Image upload failed');
    }
  };

  return (
    <Upload
      name="file"
      action="/api/v1/upload/image"
      headers={{ Authorization: `Bearer ${token}` }}
      showUploadList={false}
      accept="image/jpeg,image/png,image/webp"
      onChange={handleChange}
    >
      {value ? (
        <div style={{ position: 'relative', width: 120, height: 120, borderRadius: 12, overflow: 'hidden', border: '2px solid #e2e8f0', cursor: 'pointer' }}>
          <img src={value} alt="product" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            opacity: 0, transition: 'opacity 0.2s', color: '#fff', fontSize: 12, fontWeight: 600, gap: 4,
          }}
            className="img-hover-overlay"
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
          >
            <CameraOutlined style={{ fontSize: 20 }} />
            Change
          </div>
        </div>
      ) : (
        <div style={{
          width: 120, height: 120, borderRadius: 12, border: '2px dashed #d1d5db',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', background: '#f8fafc', gap: 6, color: '#94a3b8',
          transition: 'border-color 0.2s, background 0.2s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#059669'; (e.currentTarget as HTMLDivElement).style.background = '#ecfdf5'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#d1d5db'; (e.currentTarget as HTMLDivElement).style.background = '#f8fafc'; }}
        >
          {uploading ? <LoadingOutlined style={{ fontSize: 22, color: '#059669' }} /> : <CameraOutlined style={{ fontSize: 22 }} />}
          <span style={{ fontSize: 12, fontWeight: 600 }}>{uploading ? 'Uploading…' : 'Upload Photo'}</span>
        </div>
      )}
    </Upload>
  );
};

// ─── Mobile product card ──────────────────────────────────────────────────────

const ProductCard: React.FC<{
  product: any;
  onEdit: (p: any) => void;
  onDelete: (id: string) => void;
  onViewBatches: (id: string) => void;
  onPreviewImage: (url: string) => void;
}> = ({ product: p, onEdit, onDelete, onViewBatches, onPreviewImage }) => {
  const stock = p.stockQuantity ?? 0;
  const stockColor = stock === 0 ? '#dc2626' : stock <= 10 ? '#d97706' : '#059669';

  return (
    <div style={{ background: '#fff', border: '1px solid #e8ecf0', borderRadius: 12, padding: '14px 14px 10px', marginBottom: 10 }}>
      {/* Top: image + name + brand + stock badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        {p.imageUrl ? (
          <img src={p.imageUrl} alt={p.name} onClick={() => onPreviewImage(p.imageUrl)}
            style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: '1px solid #e5e7eb', flexShrink: 0, cursor: 'pointer' }} />
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#f3f4f6', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <InboxOutlined style={{ color: '#9ca3af', fontSize: 18 }} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{p.name}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: stockColor, background: stock === 0 ? '#fef2f2' : stock <= 10 ? '#fffbeb' : '#ecfdf5', padding: '2px 8px', borderRadius: 20 }}>
              {stock === 0 ? 'Out of Stock' : `${stock} units`}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            {[p.brand, p.category, p.unit].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>

      {/* Price grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px 4px', marginBottom: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
        {[
          { label: 'MRP',      value: `₹${Number(p.mrp || 0).toFixed(2)}` },
          { label: 'Purchase', value: `₹${Number(p.purchaseRate || 0).toFixed(2)}` },
          { label: 'Min Rate', value: p.minSaleRate ? `₹${Number(p.minSaleRate).toFixed(2)}` : '—' },
          { label: 'Max Rate', value: p.maxSaleRate ? `₹${Number(p.maxSaleRate).toFixed(2)}` : '—' },
        ].map(f => (
          <div key={f.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{f.label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{f.value}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
        <Button size="small" icon={<HddOutlined />} onClick={() => onViewBatches(p.id)}>Batches</Button>
        {hasPermission('PRODUCTS_EDIT') && <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(p)}>Edit</Button>}
        {hasPermission('PRODUCTS_DELETE') && (
          <Popconfirm title="Remove this product?" onConfirm={() => onDelete(p.id)} okText="Remove" okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        )}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const ProductsPage: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [brandFilter, setBrandFilter] = useState<string | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [batchProductId, setBatchProductId]     = useState<string | null>(null);
  const [form] = Form.useForm();

  const PAGE_SIZE = 20;
  const { data, isLoading } = useGetProductsQuery({ page: currentPage - 1, size: PAGE_SIZE, search: debouncedSearch, categoryId: categoryFilter, brandId: brandFilter });

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => { setCurrentPage(1); }, [debouncedSearch, categoryFilter, brandFilter]);
  const { data: batchData, isLoading: batchLoading } = useGetBatchesByProductQuery(batchProductId!, { skip: !batchProductId });
  const { data: brandsData } = useGetMastersQuery('BRAND');
  const { data: categoriesData } = useGetMastersQuery('CATEGORY');
  const { data: subCategoriesData } = useGetMastersQuery('SUB_CATEGORY');
  const { data: unitsData } = useGetMastersQuery('UNIT');
  const { data: taxRatesData } = useGetMastersQuery('TAX_RATE');

  const [createProduct, { isLoading: creating }] = useCreateProductMutation();
  const [updateProduct, { isLoading: updating }] = useUpdateProductMutation();
  const [deleteProduct] = useDeleteProductMutation();

  const brands = brandsData?.data || [];
  const categories = categoriesData?.data || [];
  const allSubCategories: any[] = subCategoriesData?.data || [];
  const subCategories = selectedCategory
    ? allSubCategories.filter((s: any) => s.parentName === selectedCategory)
    : [];
  const units = unitsData?.data || [];
  const taxRates = taxRatesData?.data || [];

  const pagedData = data?.data;
  let products = pagedData?.content || (Array.isArray(pagedData) ? pagedData : []);
  const totalProducts: number = pagedData?.totalElements ?? products.length;

  const checkDuplicate = (name: string) => {
    if (!name || name.trim().length < 2) { setDuplicateWarning(null); return; }
    const trimmed = name.trim().toLowerCase();
    const match = products.find((p: any) =>
      p.name.toLowerCase() === trimmed && p.id !== editingProduct?.id
    );
    if (match) {
      setDuplicateWarning(`"${match.name}" already exists in your product list.`);
    } else {
      // also check partial close match
      const close = products.find((p: any) =>
        p.name.toLowerCase().includes(trimmed) && trimmed.length >= 5 && p.id !== editingProduct?.id
      );
      setDuplicateWarning(close ? `Similar product found: "${close.name}" — please verify it's not a duplicate.` : null);
    }
  };

  const openAdd = () => {
    setEditingProduct(null);
    setSelectedCategory(undefined);
    setDuplicateWarning(null);
    form.resetFields();
    setDrawerOpen(true);
  };

  const openEdit = (p: any) => {
    setEditingProduct(p);
    setSelectedCategory(p.category || undefined);
    setDuplicateWarning(null);
    form.setFieldsValue({
      ...p,
      brandId: p.brandId,
      categoryId: p.categoryId,
      subCategoryId: p.subCategoryId,
      unitId: p.unitId,
      purchaseGstPercent: Number(p.purchaseGstPercent || 0),
      salesGstPercent: Number(p.salesGstPercent),
      mfgDate: p.mfgDate ? dayjs(p.mfgDate) : undefined,
      expiryDate: p.expiryDate ? dayjs(p.expiryDate) : undefined,
    });
    setDrawerOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      // Block exact duplicate
      const exactMatch = products.find((p: any) =>
        p.name.toLowerCase() === values.name?.trim().toLowerCase() && p.id !== editingProduct?.id
      );
      if (exactMatch) {
        form.setFields([{ name: 'name', errors: [`"${exactMatch.name}" already exists. Please use a different name.`] }]);
        return;
      }
      const payload = {
        ...values,
        mfgDate: values.mfgDate ? values.mfgDate.format('YYYY-MM-DD') : undefined,
        expiryDate: values.expiryDate ? values.expiryDate.format('YYYY-MM-DD') : undefined,
      };
      if (editingProduct) {
        await updateProduct({ id: editingProduct.id, data: payload }).unwrap();
        message.success('Product updated');
      } else {
        await createProduct(payload).unwrap();
        message.success('Product added');
      }
      setDrawerOpen(false);
    } catch (err: any) {
      if (err?.errorFields) return;
      const msg = applyApiErrorToForm(err, form, 'name');
      if (msg) message.error(msg);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct(id).unwrap();
      message.success('Product removed');
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed');
    }
  };

  const sectionLabel = (text: string) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, marginTop: 4 }}>
      {text}
    </div>
  );

  // ─── Table columns ──────────────────────────────────────────────────────────

  const columns = [
    {
      title: 'Product',
      key: 'product',
      width: 280,
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {r.imageUrl ? (
            <img src={r.imageUrl} alt={r.name} onClick={() => setPreviewImage(r.imageUrl)}
              style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover', border: '1px solid #e5e7eb', cursor: 'pointer', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: 4, background: '#f3f4f6', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <InboxOutlined style={{ color: '#9ca3af' }} />
            </div>
          )}
          <div>
            <div style={{ fontWeight: 600, color: '#111827' }}>{r.name}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {[r.brand, r.unit, r.hsnCode ? `HSN ${r.hsnCode}` : null].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Category',
      key: 'category',
      width: 140,
      render: (_: any, r: any) => (
        <span style={{ color: '#374151' }}>{[r.category, r.subCategory].filter(Boolean).join(' / ') || '—'}</span>
      ),
    },
    {
      title: 'MRP',
      key: 'mrp',
      width: 90,
      align: 'right' as const,
      render: (_: any, r: any) => `₹${Number(r.mrp || 0).toFixed(2)}`,
    },
    {
      title: 'Purchase Rate (incl. GST)',
      key: 'purchaseIncl',
      width: 150,
      align: 'right' as const,
      render: (_: any, r: any) => `₹${Number(r.purchaseRate || 0).toFixed(2)}`,
    },
    {
      title: 'Min Rate',
      key: 'minRate',
      width: 100,
      align: 'right' as const,
      render: (_: any, r: any) => r.minSaleRate ? `₹${Number(r.minSaleRate).toFixed(2)}` : '—',
    },
    {
      title: 'Max Rate',
      key: 'maxRate',
      width: 100,
      align: 'right' as const,
      render: (_: any, r: any) => r.maxSaleRate ? `₹${Number(r.maxSaleRate).toFixed(2)}` : '—',
    },
    {
      title: 'Sales GST',
      key: 'gst',
      width: 90,
      align: 'center' as const,
      render: (_: any, r: any) => `${Number(r.salesGstPercent || 0)}%`,
    },
    {
      title: 'Stock',
      key: 'stock',
      width: 80,
      align: 'center' as const,
      render: (_: any, r: any) => {
        const qty = r.stockQuantity ?? 0;
        const color = qty === 0 ? '#dc2626' : qty <= 10 ? '#d97706' : '#111827';
        return <span style={{ color, fontWeight: qty <= 10 ? 600 : 400 }}>{qty}</span>;
      },
    },
    {
      title: 'Status',
      key: 'status',
      dataIndex: 'active',
      width: 80,
      align: 'center' as const,
      render: (v: boolean) => (
        <span style={{ color: v ? '#15803d' : '#6b7280' }}>{v ? 'Active' : 'Inactive'}</span>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, r: any) => (
        <Space size={4}>
          <Tooltip title="View Batches">
            <Button icon={<HddOutlined />} size="small" type="text" onClick={() => setBatchProductId(r.id)} />
          </Tooltip>
          {hasPermission('PRODUCTS_EDIT') && <Button icon={<EditOutlined />} size="small" type="text" onClick={() => openEdit(r)} />}
          {hasPermission('PRODUCTS_DELETE') && (
            <Popconfirm title="Remove this product?" onConfirm={() => handleDelete(r.id)} okText="Remove" okButtonProps={{ danger: true }}>
              <Button icon={<DeleteOutlined />} size="small" type="text" danger />
            </Popconfirm>
          )}
          <AuditHistoryButton entityType="PRODUCT" entityId={r.id} title={`Audit — ${r.name}`} />
        </Space>
      ),
    },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Manage your product catalogue"
        count={totalProducts}
        countLabel="products"
        action={
          hasPermission('PRODUCTS_CREATE') ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} size="middle">
              Add Product
            </Button>
          ) : null
        }
      />

      {/* Filters */}
      <Card style={{ marginBottom: 16, borderRadius: 12 }}>
        <Row gutter={[12, 8]}>
          <Col xs={24} md={12} lg={10}>
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Search by product name, brand or HSN code..."
              value={search} onChange={e => setSearch(e.target.value)}
              allowClear style={{ borderRadius: 8 }}
            />
          </Col>
          <Col xs={12} md={6} lg={7}>
            <Select
              placeholder="All categories" style={{ width: '100%' }} allowClear value={categoryFilter} onChange={setCategoryFilter}
              showSearch
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().startsWith(input.toLowerCase())}
              options={categories.map((c: any) => ({ value: c.id, label: c.name }))}
            />
          </Col>
          <Col xs={12} md={6} lg={7}>
            <Select
              placeholder="All brands" style={{ width: '100%' }} allowClear value={brandFilter} onChange={setBrandFilter}
              showSearch
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().startsWith(input.toLowerCase())}
              options={brands.map((b: any) => ({ value: b.id, label: b.name }))}
            />
          </Col>
        </Row>
      </Card>

      {/* Product list */}
      {isMobile ? (
        <div>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading...</div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No products found</div>
          ) : (
            products.map((p: any) => (
              <ProductCard
                key={p.id}
                product={p}
                onEdit={openEdit}
                onDelete={handleDelete}
                onViewBatches={setBatchProductId}
                onPreviewImage={setPreviewImage}
              />
            ))
          )}
        </div>
      ) : (
        <Card style={{ borderRadius: 12, border: '1px solid #e5e7eb' }} styles={{ body: { padding: 0 } }}>
          <Table
            columns={columns}
            dataSource={products}
            rowKey="id"
            loading={isLoading}
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: totalProducts,
              onChange: (page) => setCurrentPage(page),
              showSizeChanger: false,
              showTotal: (t: number) => `${t} products`,
            }}
            size="large"
            scroll={{ x: 1400, y: 550 }}
            rowClassName={() => 'product-row'}
            style={{ fontSize: 14 }}
          />
        </Card>
      )}

      {/* Full image preview */}
      <Modal
        open={!!previewImage}
        onCancel={() => setPreviewImage(null)}
        footer={null}
        centered
        width={600}
        styles={{ body: { padding: 0, background: '#000', borderRadius: 12, overflow: 'hidden', textAlign: 'center' } }}
      >
        {previewImage && (
          <img
            src={previewImage}
            alt="product preview"
            style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block', margin: '0 auto' }}
          />
        )}
      </Modal>

      {/* Product Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#0f172a' }}>
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>
              {editingProduct ? editingProduct.name : 'Fill in the product details below'}
            </div>
          </div>
        }
        width={isMobile ? '100%' : 720}
  styles={{ body: { background: '#f8fafc', padding: '24px' } }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 24px' }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button
              type="primary" loading={creating || updating} onClick={handleSubmit}
              style={{ background: 'linear-gradient(135deg, #059669, #047857)', border: 'none', fontWeight: 700 }}
            >
              {editingProduct ? 'Update Product' : 'Add Product'}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" scrollToFirstError>

          {/* Section 1 — Product Image */}
          <Card style={{ borderRadius: 12, marginBottom: 16 }} styles={{ body: { padding: '16px 20px' } }}>
            {sectionLabel('Product Image')}
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <Form.Item name="imageUrl" noStyle>
                <ProductImageUpload />
              </Form.Item>
              <div style={{ flex: 1, paddingTop: 4 }}>
                <div style={{ fontSize: 13, color: '#374151', fontWeight: 600, marginBottom: 4 }}>Upload Product Photo</div>
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
                  Upload a clear photo of the product. Sales persons and customers will see this image.<br />
                  Accepted: JPG, PNG, WEBP • Max 5MB
                </div>
              </div>
            </div>
          </Card>

          {/* Section 2 — Basic Info */}
          <Card style={{ borderRadius: 12, marginBottom: 16 }} styles={{ body: { padding: '16px 20px' } }}>
            {sectionLabel('Basic Information')}
            <Row gutter={16}>
              <Col xs={24} sm={16}>
                <Form.Item
                  name="name"
                  label="Product Name"
                  rules={[{ required: true, message: 'Product name is required' }]}
                  extra={
                    duplicateWarning ? (
                      <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <WarningOutlined /> {duplicateWarning}
                      </span>
                    ) : null
                  }
                >
                  <Input
                    placeholder="e.g. AACHI BRIYANI RS12 (100U)"
                    size="large"
                    onChange={e => checkDuplicate(e.target.value)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="hsnCode" label="HSN Code" rules={[{ required: true, message: 'HSN code is required' }]}>
                  <Input placeholder="e.g. 9103030" size="large" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item name="brandId" label="Brand" rules={[{ required: true, message: 'Required' }]}>
                  <Select placeholder="Select brand" size="large" showSearch>
                    {brands.map((b: any) => <Option key={b.id} value={b.id}>{b.name}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="categoryId" label="Category" rules={[{ required: true, message: 'Required' }]}>
                  <Select
                    placeholder="Select category" size="large" showSearch
                    onChange={(val: string) => {
                      const cat = categories.find((c: any) => c.id === val);
                      setSelectedCategory(cat?.name || undefined);
                      form.setFieldValue('subCategoryId', undefined);
                    }}
                  >
                    {categories.map((c: any) => <Option key={c.id} value={c.id}>{c.name}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="subCategoryId" label="Sub Category" rules={[{ required: true, message: 'Required' }]}>
                  <Select
                    placeholder={selectedCategory ? 'Select sub-category' : 'Select category first'}
                    size="large" showSearch allowClear
                    disabled={!selectedCategory}
                    notFoundContent={selectedCategory ? 'No sub-categories for this category' : 'Select a category first'}
                  >
                    {subCategories.map((s: any) => <Option key={s.id} value={s.id}>{s.name}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item name="unitId" label="Unit" rules={[{ required: true, message: 'Required' }]}>
                  <Select placeholder="Select unit" size="large">
                    {units.map((u: any) => <Option key={u.id} value={u.id}>{u.name}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="stockQuantity" label="Opening Stock" initialValue={0}
                  tooltip={editingProduct ? 'To change stock, use Inventory → Stock Adjustment.' : undefined}>
                  <InputNumber
                    style={{ width: '100%' }} min={0} precision={0}
                    size="large" addonAfter="units" disabled={!!editingProduct}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* Section 3 — Pricing */}
          <Card style={{ borderRadius: 12, marginBottom: 16 }} styles={{ body: { padding: '16px 20px' } }}>
            {sectionLabel('Pricing')}
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item name="mrp" label="MRP (Printed on packet)" rules={[{ required: true, message: 'MRP is required' }]}>
                  <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="0.00" size="large" prefix="₹" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="purchaseRate"
                  label="Purchase Rate (Your cost)"
                  rules={[
                    { required: true, message: 'Purchase rate is required' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const min = getFieldValue('minSaleRate');
                        if (value && min && Number(value) > Number(min)) {
                          return Promise.reject('Purchase Rate cannot exceed Min Sale Rate');
                        }
                        return Promise.resolve();
                      },
                    }),
                  ]}
                >
                  <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="0.00" size="large" prefix="₹" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <div style={{ paddingTop: 30 }}>
                  <div style={{ background: '#f0fdf9', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#065f46', border: '1px solid #a7f3d0' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>How rates work</div>
                    <div>Set Min &amp; Max below. Salesperson picks any price within that range per order.</div>
                  </div>
                </div>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="minSaleRate"
                  label="Min Sale Rate (Salesperson floor)"
                  tooltip="Salesperson cannot charge the customer below this price"
                  rules={[
                    { required: true, message: 'Min sale rate is required' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const max = getFieldValue('maxSaleRate');
                        const pr = getFieldValue('purchaseRate');
                        if (value && pr && Number(value) < Number(pr)) return Promise.reject('Min Sale Rate must be above Purchase Rate');
                        if (value && max && value > max) return Promise.reject('Min cannot exceed Max');
                        return Promise.resolve();
                      },
                    }),
                  ]}
                >
                  <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="e.g. 60.00" size="large" prefix="₹" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="maxSaleRate"
                  label="Max Sale Rate (Salesperson ceiling)"
                  tooltip="Salesperson cannot charge the customer above this price — usually set to MRP"
                  rules={[
                    { required: true, message: 'Max sale rate is required' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const min = getFieldValue('minSaleRate');
                        if (value && min && value < min) return Promise.reject('Max cannot be less than Min');
                        return Promise.resolve();
                      },
                    }),
                  ]}
                >
                  <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="e.g. 80.00" size="large" prefix="₹" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* Section 4 — Tax & Dates */}
          <Card style={{ borderRadius: 12, marginBottom: 16 }} styles={{ body: { padding: '16px 20px' } }}>
            {sectionLabel('Tax & Expiry')}
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item name="purchaseGstPercent" label="Purchase GST" tooltip="GST you pay when buying from supplier (input tax credit)" rules={[{ required: true, message: 'Required' }]}>
                  <Select placeholder="Select GST %" size="large">
                    {taxRates.map((t: any) => (
                      <Option key={t.id} value={Number(t.value || t.name.match(/\d+/)?.[0] || 0)}>
                        {t.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="salesGstPercent" label="Sales GST" tooltip="GST you charge when selling to customers (output tax)" rules={[{ required: true, message: 'Required' }]}>
                  <Select placeholder="Select GST %" size="large">
                    {taxRates.map((t: any) => (
                      <Option key={t.id} value={Number(t.value || t.name.match(/\d+/)?.[0] || 0)}>
                        {t.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="mfgDate"
                  label="Manufacturing Date"
                  rules={[
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const exp = getFieldValue('expiryDate');
                        if (value && exp && !exp.isAfter(value)) {
                          return Promise.reject('Mfg date must be before expiry date');
                        }
                        return Promise.resolve();
                      },
                    }),
                  ]}
                >
                  <DatePicker style={{ width: '100%' }} size="large" format="DD MMM YYYY"
                    suffixIcon={<CalendarOutlined />} placeholder="Select date"
                    disabledDate={d => d && d.isAfter(dayjs())}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="expiryDate"
                  label="Expiry Date"
                  rules={[
                    { required: true, message: 'Expiry date is required' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const mfg = getFieldValue('mfgDate');
                        if (value && mfg && !value.isAfter(mfg)) {
                          return Promise.reject('Expiry must be after manufacturing date');
                        }
                        return Promise.resolve();
                      },
                    }),
                  ]}
                >
                  <DatePicker style={{ width: '100%' }} size="large" format="DD MMM YYYY"
                    suffixIcon={<CalendarOutlined />} placeholder="Select date"
                    disabledDate={d => d && d.isBefore(dayjs())}
                  />
                </Form.Item>
              </Col>
            </Row>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e', marginTop: 4 }}>
              <WarningOutlined style={{ marginRight: 6 }} />
              Products nearing expiry will be highlighted in the table. Sell expiring items first to avoid stock loss.
            </div>
          </Card>

          {/* Section 5 — Status (edit only) */}
          {editingProduct && (
            <Card style={{ borderRadius: 12 }} styles={{ body: { padding: '16px 20px' } }}>
              {sectionLabel('Status')}
              <Form.Item name="active" label="Product Status">
                <Select size="large">
                  <Option value={true}>Active</Option>
                  <Option value={false}>Inactive</Option>
                </Select>
              </Form.Item>
            </Card>
          )}
        </Form>
      </Drawer>

      {/* Batch Drawer */}
      <Drawer
        title={`Stock Batches`}
        open={!!batchProductId}
        onClose={() => setBatchProductId(null)}
        width={isMobile ? '100%' : 720}
>
        {batchLoading ? (
          <div style={{ padding: 24 }}><InboxOutlined style={{ fontSize: 24, color: '#cbd5e1' }} /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(batchData?.data || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>No batches found for this product</div>
            ) : (batchData?.data || []).map((b: any) => {
              const isExpired = b.expired;
              const isNear    = b.nearExpiry;
              return (
                <div key={b.id} style={{ border: `1px solid ${isExpired ? '#fecaca' : isNear ? '#fde68a' : '#e2e8f0'}`, borderRadius: 10, padding: '12px 16px', background: isExpired ? '#fff5f5' : isNear ? '#fffbf0' : '#fafafa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#374151' }}>{b.batchNumber}</span>
                    <span style={{ fontWeight: 800, color: b.quantityAvailable === 0 ? '#dc2626' : '#059669', fontSize: 14 }}>
                      {b.quantityAvailable} {b.product?.unit} available
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px 12px' }}>
                    {[
                      { label: 'MRP',           value: `₹${Number(b.mrp || 0).toFixed(2)}` },
                      { label: 'Purchase Rate', value: `₹${Number(b.purchaseRate || 0).toFixed(2)}` },
                      { label: 'Min Sale Rate', value: b.minSaleRate != null ? `₹${Number(b.minSaleRate).toFixed(2)}` : '—', color: '#059669' },
                      { label: 'Max Sale Rate', value: b.maxSaleRate != null ? `₹${Number(b.maxSaleRate).toFixed(2)}` : '—' },
                      { label: 'Expiry',        value: b.expiryDate || '—', color: isExpired ? '#dc2626' : isNear ? '#d97706' : undefined },
                      { label: 'Mfg Date',      value: b.mfgDate    || '—' },
                      { label: 'Received',      value: b.receivedDate || '—' },
                      { label: 'Qty Received',  value: String(b.quantityReceived || 0) },
                    ].map(f => (
                      <div key={f.label}>
                        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>{f.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: (f as any).color || '#0f172a', marginTop: 2 }}>{f.value}</div>
                      </div>
                    ))}
                  </div>
                  {isExpired && <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginTop: 8, display: 'block' }}>⛔ Expired</span>}
                  {isNear && !isExpired && <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600, marginTop: 8, display: 'block' }}>⚠ Near Expiry</span>}
                </div>
              );
            })}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default ProductsPage;
