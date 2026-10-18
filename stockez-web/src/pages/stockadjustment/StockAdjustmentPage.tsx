import React, { useState, useMemo } from 'react';
import { Select, Button, Table, InputNumber, message, Card, Row, Col, Space, Tag, Tabs, Tooltip, Alert } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useGetAllProductsQuery } from '../../store/api/productApi';
import { useGetMastersQuery } from '../../store/api/productMasterApi';
import {
  useLazyGetBatchesForAdjustmentQuery,
  useAdjustStockMutation,
  useGetAllAdjustmentsQuery,
} from '../../store/api/stockAdjustmentApi';
import { hasPermission } from '../../utils/permissions';

const { Option } = Select;
const canAdjustStock = hasPermission('STOCK_ADJUSTMENT_CREATE');

const StockAdjustmentPage: React.FC = () => {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number | null>>({});
  const [filterBrand, setFilterBrand] = useState<string | undefined>();
  const [filterCategory, setFilterCategory] = useState<string | undefined>();
  const [filterSubCategory, setFilterSubCategory] = useState<string | undefined>();

  const { data: productsData } = useGetAllProductsQuery(undefined, { refetchOnMountOrArgChange: true });
  const allProducts: any[] = productsData?.data || [];

  const { data: brandsData } = useGetMastersQuery('BRAND', { refetchOnMountOrArgChange: true });
  const { data: categoriesData } = useGetMastersQuery('CATEGORY', { refetchOnMountOrArgChange: true });
  const { data: subCategoriesData } = useGetMastersQuery('SUB_CATEGORY', { refetchOnMountOrArgChange: true });
  const brands: any[] = brandsData?.data || [];
  const categories: any[] = categoriesData?.data || [];
  const allSubCategories: any[] = subCategoriesData?.data || [];
  const subCategories = filterCategory
    ? allSubCategories.filter((s: any) => s.parentName === filterCategory)
    : allSubCategories;

  const products = useMemo(() => {
    let list = allProducts.filter((p: any) => p.stockQuantity > 0);
    if (filterBrand) list = list.filter((p: any) => p.brand === filterBrand);
    if (filterCategory) list = list.filter((p: any) => p.category === filterCategory);
    if (filterSubCategory) list = list.filter((p: any) => p.subCategory === filterSubCategory);
    return list;
  }, [allProducts, filterBrand, filterCategory, filterSubCategory]);

  const [fetchBatches, { data: batchesData, isFetching: loadingBatches }] =
    useLazyGetBatchesForAdjustmentQuery();
  const batches: any[] = batchesData?.data || [];

  const [adjustStock, { isLoading: adjusting }] = useAdjustStockMutation();

  const { data: historyData, isFetching: loadingHistory } = useGetAllAdjustmentsQuery(undefined, { refetchOnMountOrArgChange: true });
  const history: any[] = historyData?.data || [];

  const handleShow = () => {
    if (!selectedProductId) return;
    setQuantities({});
    fetchBatches(selectedProductId);
  };

  const handleAdjust = async (batchId: string, type: 'EXCESS' | 'SHORTAGE') => {
    const qty = quantities[batchId];
    if (!qty || qty <= 0) {
      message.warning('Enter a quantity before adjusting');
      return;
    }
    try {
      await adjustStock({ batchId, type, quantity: qty }).unwrap();
      message.success(type === 'EXCESS' ? 'Stock increased' : 'Stock decreased');
      setQuantities(prev => ({ ...prev, [batchId]: null }));
      if (selectedProductId) fetchBatches(selectedProductId);
    } catch (err: any) {
      message.error(err?.data?.message || 'Adjustment failed');
    }
  };

  const batchColumns: ColumnsType<any> = [
    {
      title: 'Product',
      dataIndex: 'productName',
      key: 'productName',
      width: 200,
    },
    {
      title: 'Batch No',
      dataIndex: 'batchNumber',
      key: 'batchNumber',
      width: 130,
    },
    {
      title: 'MRP',
      dataIndex: 'mrp',
      key: 'mrp',
      width: 100,
      align: 'right',
      render: (v: number) => `₹${Number(v).toFixed(2)}`,
    },
    {
      title: 'Purchase Rate',
      dataIndex: 'purchaseRate',
      key: 'purchaseRate',
      width: 130,
      align: 'right',
      render: (v: number) => `₹${Number(v).toFixed(2)}`,
    },
    {
      title: 'Current Stock',
      dataIndex: 'currentStock',
      key: 'currentStock',
      width: 120,
      align: 'right',
      render: (v: number) => (
        <span style={{ color: v === 0 ? '#ef4444' : v <= 5 ? '#d97706' : undefined, fontWeight: 600 }}>
          {v}
        </span>
      ),
    },
    {
      title: 'Quantity',
      key: 'quantity',
      width: 120,
      render: (_: any, record: any) => (
        <InputNumber
          min={1}
          value={quantities[record.batchId] ?? undefined}
          onChange={(val) => setQuantities(prev => ({ ...prev, [record.batchId]: val }))}
          style={{ width: 90 }}
          size="small"
        />
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 200,
      render: (_: any, record: any) => (
        canAdjustStock ? (
        <Space size={8}>
          <Button
            size="small"
            type="primary"
            loading={adjusting}
            onClick={() => handleAdjust(record.batchId, 'EXCESS')}
          >
            Excess
          </Button>
          <Button
            size="small"
            danger
            loading={adjusting}
            onClick={() => handleAdjust(record.batchId, 'SHORTAGE')}
          >
            Shortage
          </Button>
        </Space>
        ) : <span style={{ color: '#9ca3af' }}>—</span>
      ),
    },
  ];

  const historyColumns: ColumnsType<any> = [
    {
      title: 'Product',
      dataIndex: 'productName',
      key: 'productName',
      width: 200,
    },
    {
      title: 'Batch No',
      dataIndex: 'batchNumber',
      key: 'batchNumber',
      width: 130,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (v: string) => (
        <Tag color={v === 'EXCESS' ? 'green' : 'red'} style={{ fontWeight: 600 }}>
          {v}
        </Tag>
      ),
    },
    {
      title: 'Qty Adjusted',
      dataIndex: 'quantityAdjusted',
      key: 'quantityAdjusted',
      width: 110,
      align: 'right',
    },
    {
      title: 'Before',
      dataIndex: 'quantityBefore',
      key: 'quantityBefore',
      width: 90,
      align: 'right',
    },
    {
      title: 'After',
      dataIndex: 'quantityAfter',
      key: 'quantityAfter',
      width: 90,
      align: 'right',
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: 'By',
      dataIndex: 'adjustedBy',
      key: 'adjustedBy',
      width: 44,
      align: 'center' as const,
      render: (name: string) => (
        <Tooltip title={name}>
          <span style={{ color: '#94a3b8', cursor: 'default', fontSize: 15 }}>
            <UserOutlined />
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 130,
      render: (v: string) => {
        if (!v) return '-';
        const d = new Date(v);
        const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        return (
          <div>
            <div style={{ fontSize: 13 }}>{date}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{time}</div>
          </div>
        );
      },
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
  ];

  return (
    <div>
      <Tabs
        defaultActiveKey="adjust"
        items={[
          {
            key: 'adjust',
            label: 'Adjust Stock',
            children: (
              <>
                <Alert
                  type="warning"
                  showIcon
                  message="Use this page only to correct stock counts during migration or physical stock verification."
                  description="If a product is actually lost or damaged, record it under Goods Return → Damage / Loss — not here. Stock Adjustment does not account for financial loss."
                  style={{ marginBottom: 16 }}
                />
                <Card style={{ marginBottom: 16 }}>
                  <Row gutter={[12, 10]}>
                    <Col xs={24} sm={8}>
                      <Select
                        placeholder="All Brands"
                        allowClear
                        showSearch
                        style={{ width: '100%' }}
                        value={filterBrand}
                        onChange={(v) => { setFilterBrand(v); setSelectedProductId(null); }}
                      >
                        {brands.map((b: any) => <Option key={b.id} value={b.name}>{b.name}</Option>)}
                      </Select>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Select
                        placeholder="All Categories"
                        allowClear
                        showSearch
                        style={{ width: '100%' }}
                        value={filterCategory}
                        onChange={(v) => { setFilterCategory(v); setFilterSubCategory(undefined); setSelectedProductId(null); }}
                      >
                        {categories.map((c: any) => <Option key={c.id} value={c.name}>{c.name}</Option>)}
                      </Select>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Select
                        placeholder="All Sub-Categories"
                        allowClear
                        showSearch
                        style={{ width: '100%' }}
                        value={filterSubCategory}
                        onChange={(v) => { setFilterSubCategory(v); setSelectedProductId(null); }}
                        disabled={subCategories.length === 0}
                      >
                        {subCategories.map((s: any) => <Option key={s.id} value={s.name}>{s.name}</Option>)}
                      </Select>
                    </Col>
                    <Col flex="auto">
                      <Select
                        showSearch
                        placeholder="Search and select a product"
                        style={{ width: '100%' }}
                        value={selectedProductId}
                        onChange={setSelectedProductId}
                        filterOption={(input, option) =>
                          String(option?.label ?? '')
                            .toLowerCase()
                            .includes(input.toLowerCase())
                        }
                        options={products.map((p: any) => ({
                          value: p.id,
                          label: `${p.name}${p.brand ? ` — ${p.brand}` : ''}`,
                        }))}
                      />
                    </Col>
                    <Col>
                      <Button
                        type="primary"
                        onClick={handleShow}
                        disabled={!selectedProductId}
                        loading={loadingBatches}
                      >
                        Show
                      </Button>
                    </Col>
                  </Row>
                </Card>

                {batches.length > 0 && (
                  <Table
                    dataSource={batches}
                    columns={batchColumns}
                    rowKey="batchId"
                    loading={loadingBatches}
                    pagination={false}
                    size="middle"
                    bordered={false}
                    locale={{ emptyText: 'No active batches for this product' }}
                  />
                )}

                {batchesData && batches.length === 0 && !loadingBatches && (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0', fontSize: 14 }}>
                    No batches found for this product
                  </div>
                )}
              </>
            ),
          },
          {
            key: 'history',
            label: 'Adjustment History',
            children: (
              <Table
                dataSource={history}
                columns={historyColumns}
                rowKey="id"
                loading={loadingHistory}
                pagination={{ pageSize: 20 }}
                size="middle"
                bordered={false}
                locale={{ emptyText: 'No adjustments recorded yet' }}
              />
            ),
          },
        ]}
      />
    </div>
  );
};

export default StockAdjustmentPage;
