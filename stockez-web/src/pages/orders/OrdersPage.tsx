import React, { useState, useMemo, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Select, Space, Row, Col,
  Card, message, Descriptions, InputNumber, Input, Popconfirm, DatePicker, Grid, Tooltip,
} from 'antd';
import {
  PlusOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ShoppingOutlined, PrinterOutlined, RollbackOutlined, EditOutlined,
  InboxOutlined, CheckSquareOutlined, CarOutlined, DollarOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { formatINR } from '../../utils/format';
import { noFutureDates } from '../../utils/date';
import {
  useGetOrdersQuery, useLazyGetOrdersQuery, useGetMyOrdersQuery, useGetMyDeliveriesQuery, useCreateOrderMutation,
  useCancelOrderMutation, useUpdateOrderMutation,
  useStartPackingMutation, useMarkPackedMutation, useVerifyItemsMutation,
  useDispatchOrderMutation, useMarkDeliveredMutation, useGetOrderSalespersonsQuery,
  useGetOrderQuery, useAdjustDeliveredPriceMutation, useChangeOrderStatusMutation,
} from '../../store/api/orderApi';
import { useGetOrderPaymentsQuery } from '../../store/api/paymentApi';
import { useGetReturnsByOrderQuery } from '../../store/api/goodsReturnApi';
import { useGetCustomersQuery } from '../../store/api/customerApi';
import { useGetAllProductsQuery } from '../../store/api/productApi';
import { useGetRoutesQuery } from '../../store/api/routeApi';
import PageHeader from '../../components/PageHeader';
import TableToolbar, { exportToXLSX } from '../../components/TableToolbar';
import InvoicePrint from '../../components/InvoicePrint';
import AuditHistoryButton from '../../components/AuditHistoryButton';
import ReturnFromOrderModal from '../../components/ReturnFromOrderModal';
import { hasPermission, isAdmin as isAdminFn } from '../../utils/permissions';
import { getProductRates, isPriceOutOfRange, defaultUnitPrice } from '../../utils/priceUtils';
import { useGetCompanyProfileQuery, useGetWorkflowSettingsQuery } from '../../store/api/supplierApi';

const { Option } = Select;

// Identity for "the same real-world product" — catches duplicate product records
// (same name/brand/unit under different IDs) so it can't be added to an order twice.
const sameProductKey = (p: any) =>
  [p?.name, p?.brand, p?.unit].map(v => String(v ?? '').trim().toLowerCase()).join('|');

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  DRAFT:      { color: '#6b7280', bg: '#f3f4f6',  label: 'Draft' },
  SUBMITTED:  { color: '#f59e0b', bg: '#fffbeb',  label: 'Pending Approval' },
  APPROVED:   { color: '#059669', bg: '#ecfdf5',  label: 'Approved' },
  PACKING:          { color: '#f97316', bg: '#fff7ed',  label: 'Packing' },
  PACKED:           { color: '#06b6d4', bg: '#ecfeff',  label: 'Packed' },
  DISPATCHED:       { color: '#8b5cf6', bg: '#f5f3ff',  label: 'Dispatched' },
  DELIVERED:        { color: '#10b981', bg: '#ecfdf5',  label: 'Delivered' },
  CANCELLED:        { color: '#ef4444', bg: '#fef2f2',  label: 'Cancelled' },
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { color: '#6b7280', bg: '#f3f4f6', label: status };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color, fontSize: 11,
      fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      border: `1px solid ${cfg.color}25`,
    }}>
      {cfg.label}
    </span>
  );
};

const OrdersPage: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const userRole    = JSON.parse(localStorage.getItem('user') || '{}').role as string;
  const isAdmin     = isAdminFn();
  const isSales     = !isAdmin && userRole === 'SALES';
  const isDelivery  = !isAdmin && userRole === 'DELIVERY';
  const canCreateOrders = !isDelivery && hasPermission('ORDERS_CREATE');
  const isWarehouse = hasPermission('PICKLIST_UPDATE');

  const [search, setSearch]               = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter]   = useState<string | undefined>();
  const [dateRange, setDateRange]         = useState<[Dayjs, Dayjs] | null>(null);
  const [salesPersonFilter, setSalesPersonFilter] = useState<string | null>(null);
  const [routeFilter, setRouteFilter]     = useState<string | null>(null);
  const [createModal, setCreateModal]   = useState(false);
  const [detailModal, setDetailModal]   = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderItems, setOrderItems]     = useState<any[]>([]);
  const [overallDisc, setOverallDisc]   = useState<{ type: 'PERCENT' | 'AMOUNT'; value: number | null }>({ type: 'PERCENT', value: null });
  const [editOverallDisc, setEditOverallDisc] = useState<number | null>(null);
  const [printOrder, setPrintOrder]     = useState<any>(null);
  const [verifyModal, setVerifyModal]   = useState(false);
  const [returnModal, setReturnModal]   = useState(false);
  const [verifyQtys, setVerifyQtys]     = useState<Record<string, number>>({});
  const [currentPage, setCurrentPage]   = useState(1);
  const [editModal, setEditModal]       = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [editItems, setEditItems]       = useState<any[]>([]);
  const [adjustPriceModal, setAdjustPriceModal] = useState(false);
  const [adjustPriceOrder, setAdjustPriceOrder] = useState<any>(null);
  const [adjustPriceItems, setAdjustPriceItems] = useState<any[]>([]);
  const [adjustOverallDisc, setAdjustOverallDisc] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const { data: profileData } = useGetCompanyProfileQuery();
  const companyProfile = profileData?.data;

  const { data: myOrdersData,     isLoading: loadingMy,       refetch: refetchMy }       = useGetMyOrdersQuery(undefined,    { skip: !isSales });
  const { data: myDeliveriesData, isLoading: loadingDelivery, refetch: refetchDelivery } = useGetMyDeliveriesQuery(undefined, { skip: !isDelivery });
  const { data: allOrdersData,    isLoading: loadingAll,      refetch: refetchAll }      = useGetOrdersQuery({
    status: statusFilter,
    from: dateRange?.[0]?.format('YYYY-MM-DD'),
    to:   dateRange?.[1]?.format('YYYY-MM-DD'),
    salesPersonId: salesPersonFilter || undefined,
    routeId: routeFilter || undefined,
    search: debouncedSearch || undefined,
    page: currentPage - 1,
    size: 20,
  }, { skip: isSales || isDelivery });

  const ordersData = isSales ? myOrdersData : isDelivery ? myDeliveriesData : allOrdersData;
  const isLoading  = isSales ? loadingMy    : isDelivery ? loadingDelivery  : loadingAll;
  const refetch    = isSales ? refetchMy    : isDelivery ? refetchDelivery  : refetchAll;
  const [fetchAllOrders] = useLazyGetOrdersQuery();
  const { data: customersData } = useGetCustomersQuery();
  const { data: productsData }  = useGetAllProductsQuery();
  const { data: salespersonsData } = useGetOrderSalespersonsQuery(undefined, { skip: isSales || isDelivery });
  const { data: routesData }       = useGetRoutesQuery(undefined, { skip: isSales || isDelivery });
  const { data: workflowData }     = useGetWorkflowSettingsQuery();
  const discountType: 'PERCENT' | 'AMOUNT' = workflowData?.data?.discountType ?? 'PERCENT';

  const [createOrder,   { isLoading: creating  }] = useCreateOrderMutation();
  const [updateOrder,   { isLoading: updating  }] = useUpdateOrderMutation();
  const [adjustDeliveredPrice, { isLoading: adjustingPrice }] = useAdjustDeliveredPriceMutation();
  const [changeOrderStatus, { isLoading: changingStatus }] = useChangeOrderStatusMutation();
  const [cancelOrder] = useCancelOrderMutation();

  const handleChangeStatus = (target: string) => {
    if (!selectedOrder) return;
    const label = (s: string) => STATUS_CONFIG[s]?.label || s;
    Modal.confirm({
      title: 'Change order status?',
      content: `Change ${selectedOrder.orderNumber} from "${label(selectedOrder.status)}" to "${label(target)}"? This is an admin override and will be logged. Stock and payments are not affected.`,
      okText: 'Change Status',
      onOk: async () => {
        try {
          await changeOrderStatus({ id: selectedOrder.id, status: target }).unwrap();
          message.success('Order status updated');
          setDetailModal(false);
          refetch();
        } catch (e: any) { message.error(e?.data?.message || 'Failed to change status'); }
      },
    });
  };
  const { data: orderPaymentsData } = useGetOrderPaymentsQuery(selectedOrder?.id, { skip: !selectedOrder?.id || !detailModal });
  const orderPayments: any[] = orderPaymentsData?.data || [];
  const { data: orderDetailData } = useGetOrderQuery(selectedOrder?.id || '', { skip: !selectedOrder?.id || !detailModal });
  const { data: orderReturnsData } = useGetReturnsByOrderQuery(selectedOrder?.id, { skip: !selectedOrder?.id || !detailModal });
  const orderReturns: any[] = orderReturnsData?.data || [];

  // Returns applied to this order — only warehouse-verified ones have actually reduced the bill.
  const returnInfo = useMemo(() => {
    const verified = orderReturns.filter((r: any) => r.warehouseStatus === 'VERIFIED');
    const pendingCount = orderReturns.length - verified.length;
    const qtyByProduct: Record<string, number> = {};
    let returnsValue = 0;
    verified.forEach((r: any) => (r.items || []).forEach((it: any) => {
      const rec = Number(it.receivedQty ?? 0);
      if (rec > 0 && it.productId) {
        qtyByProduct[it.productId] = (qtyByProduct[it.productId] || 0) + rec;
        returnsValue += rec * Number(it.unitRate || 0);
      }
    }));
    return { qtyByProduct, returnsValue, verified, pendingCount };
  }, [orderReturns]);

  const selectedOrderItems: any[] = selectedOrder?.items || [];
  const anyReturned = Object.keys(returnInfo.qtyByProduct).length > 0;
  const fullyReturned = anyReturned && selectedOrderItems.length > 0 &&
    selectedOrderItems.every((it: any) => (returnInfo.qtyByProduct[it.product?.id] || 0) >= (it.quantity || 0));
  const netTotal = Number(selectedOrder?.totalAmount || 0);
  const originalTotal = netTotal + returnInfo.returnsValue;

  const [startPacking]                             = useStartPackingMutation();
  const [verifyItems, { isLoading: verifying }]    = useVerifyItemsMutation();
  const [markPacked]                               = useMarkPackedMutation();
  const [dispatchOrder]                            = useDispatchOrderMutation();
  const [markDelivered]                            = useMarkDeliveredMutation();

  const orders          = ordersData?.data?.content   || ordersData?.data   || [];
  const totalOrders     = !isSales && !isDelivery ? (allOrdersData?.data?.totalElements || 0) : orders.length;
  const customers       = customersData?.data?.content || customersData?.data || [];
  const products        = productsData?.data?.content || productsData?.data || [];

  const salesPersonOptions = useMemo(() => {
    const list: any[] = salespersonsData?.data || [];
    return list.map((s: any) => [s.id, s.name] as [string, string]);
  }, [salespersonsData]);

  const routeOptions = useMemo(() => {
    const list: any[] = routesData?.data?.content || routesData?.data || [];
    return list
      .map((r: any) => ({ id: r.id as string, name: r.name as string }))
      .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
  }, [routesData]);

  // Debounce the search box so we hit the server at most once per pause in typing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Any filter change returns to the first page
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, salesPersonFilter, routeFilter, dateRange]);

  /* ── Order items helpers ── */
  const addItem = () => setOrderItems([...orderItems, { productId: undefined, quantity: 1, unitPrice: 0, gstPercent: 0, minSaleRate: null, maxSaleRate: null }]);
  const removeItem = (i: number) => setOrderItems(orderItems.filter((_, idx) => idx !== i));
  const updateItem = (index: number, field: string, value: any) => {
    if (field === 'productId' && value) {
      const picked = products.find((p: any) => p.id === value);
      const key = picked && sameProductKey(picked);
      const dup = key && orderItems.some((it, idx) => {
        if (idx === index || !it.productId) return false;
        const ip = products.find((x: any) => x.id === it.productId);
        return ip && sameProductKey(ip) === key;
      });
      if (dup) {
        message.warning(`"${picked.name}" is already added — increase its quantity instead of adding it again`);
        return;
      }
    }
    const updated = [...orderItems];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'productId') {
      const p = products.find((p: any) => p.id === value);
      if (p) {
        const { min, max } = getProductRates(p);
        updated[index].unitPrice = defaultUnitPrice(min, max);
        updated[index].gstPercent = p.salesGstPercent || p.sales_gst_percent;
        updated[index].minSaleRate = min;
        updated[index].maxSaleRate = max;
      }
    }
    setOrderItems(updated);
  };
  const calcTotal = () => orderItems.reduce((s, item) =>
    s + (item.unitPrice || 0) * (item.quantity || 0), 0);
  const calcDiscount = (gross: number, value: number | null, mode: 'PERCENT' | 'AMOUNT' = discountType) => {
    const v = value || 0;
    if (v <= 0 || gross <= 0) return 0;
    return mode === 'PERCENT'
      ? Math.round(gross * Math.min(v, 100)) / 100
      : Math.min(v, gross);
  };

  /* ── Handlers ── */
  const handleCreate = async () => {
    if (!orderItems.length) { message.error('Add at least one product'); return; }
    const priceErrors = orderItems.filter(i => isPriceOutOfRange(i.unitPrice, i.minSaleRate, i.maxSaleRate));
    if (priceErrors.length) { message.error('One or more items have prices outside the allowed min/max range'); return; }
    try {
      const values = await form.validateFields();
      await createOrder({
        ...values,
        items: orderItems,
        overallDiscountType: overallDisc.value && overallDisc.value > 0 ? discountType : null,
        overallDiscountValue: overallDisc.value && overallDisc.value > 0 ? overallDisc.value : null,
      }).unwrap();
      message.success('Order created'); setCreateModal(false); form.resetFields(); setOrderItems([]);
      setOverallDisc({ type: 'PERCENT', value: null }); refetch();
    } catch (err: any) { message.error(err?.data?.message || 'Failed'); }
  };
  const handleCancel = async (id: string) => {
    try { await cancelOrder({ id }).unwrap(); message.success('Order cancelled'); refetch(); }
    catch (err: any) { message.error(err?.data?.message || 'Failed'); }
  };

  const openEditModal = (record: any) => {
    setEditingOrder(record);
    setEditItems((record.items || []).map((item: any) => {
      const { min, max } = getProductRates(item.product);
      return {
        productId: item.product?.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gstPercent: item.gstPercent,
        discountPercent: item.discountPercent ?? 0,
        discountAmount: item.discountAmount ?? 0,
        minSaleRate: min,
        maxSaleRate: max,
      };
    }));
    editForm.setFieldsValue({ notes: record.notes });
    setEditOverallDisc(record.overallDiscountValue != null ? Number(record.overallDiscountValue) : null);
    setEditModal(true);
  };
  const addEditItem = () => setEditItems(prev => [...prev, { productId: undefined, quantity: 1, unitPrice: 0, gstPercent: 0, minSaleRate: null, maxSaleRate: null }]);
  const removeEditItem = (i: number) => setEditItems(prev => prev.filter((_, idx) => idx !== i));
  const updateEditItem = (index: number, field: string, value: any) => {
    if (field === 'productId' && value) {
      const picked = products.find((p: any) => p.id === value);
      const key = picked && sameProductKey(picked);
      const dup = key && editItems.some((it, idx) => {
        if (idx === index || !it.productId) return false;
        const ip = products.find((x: any) => x.id === it.productId);
        return ip && sameProductKey(ip) === key;
      });
      if (dup) {
        message.warning(`"${picked.name}" is already added — increase its quantity instead of adding it again`);
        return;
      }
    }
    setEditItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'productId') {
        const p = products.find((p: any) => p.id === value);
        if (p) {
          const { min, max } = getProductRates(p);
          updated[index].unitPrice = defaultUnitPrice(min, max);
          updated[index].gstPercent = p.salesGstPercent || p.sales_gst_percent;
          updated[index].minSaleRate = min;
          updated[index].maxSaleRate = max;
        }
      }
      return updated;
    });
  };
  const calcEditTotal = () => editItems.reduce((s, item) => {
    const gross = (item.unitPrice || 0) * (item.quantity || 0);
    const disc = discountType === 'AMOUNT'
      ? (item.discountAmount || 0)
      : gross * (item.discountPercent || 0) / 100;
    return s + Math.max(0, gross - disc);
  }, 0);

  const handleUpdate = async () => {
    if (!editItems.length) { message.error('Add at least one product'); return; }
    const priceErrors = editItems.filter(i => isPriceOutOfRange(i.unitPrice, i.minSaleRate, i.maxSaleRate));
    if (priceErrors.length) { message.error('One or more items have prices outside the allowed min/max range'); return; }
    try {
      const values = await editForm.validateFields();
      const items = editItems.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        ...(discountType === 'AMOUNT'
          ? { discountAmount: i.discountAmount || 0 }
          : { discountPercent: i.discountPercent || 0 }),
      }));
      await updateOrder({
        id: editingOrder.id,
        items,
        notes: values.notes,
        overallDiscountType: editOverallDisc && editOverallDisc > 0 ? (editingOrder.overallDiscountType || discountType) : null,
        overallDiscountValue: editOverallDisc && editOverallDisc > 0 ? editOverallDisc : null,
      }).unwrap();
      message.success('Order updated');
      setEditModal(false);
      refetch();
    } catch (err: any) { message.error(err?.data?.message || 'Failed to update order'); }
  };

  const openAdjustPriceModal = (record: any) => {
    setAdjustPriceOrder(record);
    setAdjustPriceItems((record.items || []).map((item: any) => {
      const { min, max } = getProductRates(item.product);
      return {
        itemId: item.id,
        productName: item.product?.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gstPercent: item.gstPercent,
        discountPercent: item.discountPercent ?? 0,
        discountAmount: item.discountAmount ?? 0,
        minSaleRate: min,
        maxSaleRate: max,
      };
    }));
    setAdjustOverallDisc(record.overallDiscountValue != null ? Number(record.overallDiscountValue) : null);
    setAdjustPriceModal(true);
  };
  const updateAdjustPriceItem = (index: number, field: string, value: any) => {
    setAdjustPriceItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };
  const calcAdjustPriceLinesTotal = () => adjustPriceItems.reduce((s, item) => {
    const gross = (item.unitPrice || 0) * (item.quantity || 0);
    const disc = discountType === 'AMOUNT'
      ? (item.discountAmount || 0)
      : gross * (item.discountPercent || 0) / 100;
    return s + Math.max(0, gross - disc);
  }, 0);
  const calcAdjustOverallDiscount = () => {
    const gross = calcAdjustPriceLinesTotal();
    const dv = adjustOverallDisc || 0;
    if (dv <= 0 || gross <= 0) return 0;
    return discountType === 'PERCENT'
      ? Math.round(gross * Math.min(dv, 100)) / 100
      : Math.min(dv, gross);
  };
  const calcAdjustPriceTotal = () => Math.max(0, calcAdjustPriceLinesTotal() - calcAdjustOverallDiscount());
  const handleAdjustPrice = async () => {
    const priceErrors = adjustPriceItems.filter(i => isPriceOutOfRange(i.unitPrice, i.minSaleRate, i.maxSaleRate));
    if (priceErrors.length) { message.error('One or more prices are outside the allowed min/max range'); return; }
    try {
      const items = adjustPriceItems.map(i => ({
        itemId: i.itemId,
        unitPrice: i.unitPrice,
        ...(discountType === 'AMOUNT'
          ? { discountAmount: i.discountAmount || 0 }
          : { discountPercent: i.discountPercent || 0 }),
      }));
      await adjustDeliveredPrice({
        id: adjustPriceOrder.id,
        items,
        overallDiscountType: adjustOverallDisc && adjustOverallDisc > 0 ? discountType : null,
        overallDiscountValue: adjustOverallDisc && adjustOverallDisc > 0 ? adjustOverallDisc : null,
      }).unwrap();
      message.success('Price adjusted');
      setAdjustPriceModal(false);
      refetch();
    } catch (err: any) { message.error(err?.data?.message || 'Failed to adjust price'); }
  };
  const handleStartPacking = async (id: string) => {
    try { await startPacking(id).unwrap(); message.success('Packing started'); refetch(); }
    catch (err: any) { message.error(err?.data?.message || 'Failed'); }
  };
  const handleDispatch = async (id: string) => {
    try { await dispatchOrder(id).unwrap(); message.success('Order dispatched'); refetch(); }
    catch (err: any) { message.error(err?.data?.message || 'Failed'); }
  };
  const handleMarkDelivered = async (id: string) => {
    try { await markDelivered(id).unwrap(); message.success('Order marked as delivered'); refetch(); }
    catch (err: any) { message.error(err?.data?.message || 'Failed'); }
  };
  const openVerifyModal = (order: any) => {
    setSelectedOrder(order);
    setVerifyModal(true);
  };
  const handleVerifyAndPrepare = async () => {
    if (!selectedOrder) return;
    try {
      const items = (selectedOrder.items || []).map((item: any) => ({
        itemId: item.id,
        verifiedQuantity: item.quantity,
      }));
      await verifyItems({ id: selectedOrder.id, items }).unwrap();
      await markPacked(selectedOrder.id).unwrap();
      message.success('Order marked as packed');
      setVerifyModal(false);
      refetch();
    } catch (err: any) { message.error(err?.data?.message || 'Failed'); }
  };
  const handlePrint = (order: any) => {
    setPrintOrder(orderDetailData?.data || order);
    setTimeout(() => window.print(), 400);
  };

  /* ── Columns ── */
  const titleCase = (s: string) => (s || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const exportColumns = [
    { title: 'Order #', key: 'orderNumber', dataIndex: 'orderNumber' },
    { title: 'Date', key: 'date', dataIndex: 'orderDate', type: 'date' as const },
    { title: 'Customer', key: 'customer', dataIndex: ['customer', 'businessName'] },
    { title: 'Phone', key: 'phone', dataIndex: ['customer', 'phone'] },
    { title: 'Sales Person', key: 'salesPerson', dataIndex: ['salesPerson', 'fullName'] },
    { title: 'Route', key: 'route', transform: (_: any, r: any) => titleCase(r.routeName || r.customer?.routeName || '') },
    { title: 'Items', key: 'items', type: 'number' as const, transform: (_: any, r: any) => r.items?.length || 0 },
    { title: 'Amount', key: 'amount', dataIndex: 'totalAmount', type: 'currency' as const },
    { title: 'Balance Due', key: 'balance', dataIndex: 'balanceAmount', type: 'currency' as const },
    { title: 'Status', key: 'status', dataIndex: 'status', transform: (v: any) => titleCase(String(v || '')) },
  ];

  const handleExportAll = async () => {
    try {
      const res = await fetchAllOrders({
        status: statusFilter,
        from: dateRange?.[0]?.format('YYYY-MM-DD'),
        to:   dateRange?.[1]?.format('YYYY-MM-DD'),
        salesPersonId: salesPersonFilter || undefined,
        routeId: routeFilter || undefined,
        search: debouncedSearch || undefined,
        page: 0,
        size: 100000,
      }).unwrap();
      const all: any[] = res?.data?.content || res?.data || [];
      if (!all.length) { message.warning('No orders to export'); return; }
      await exportToXLSX(all, exportColumns, `orders-${dayjs().format('YYYY-MM-DD')}`, 'Orders', {
        title: 'Orders',
        subtitle: `Generated ${dayjs().format('DD MMM YYYY')} · ${all.length} order${all.length === 1 ? '' : 's'}`,
        totals: true,
      });
    } catch {
      message.error('Failed to export orders');
    }
  };

  const columns = [
    {
      title: 'Order',
      key: 'order',
      sorter: (a: any, b: any) => (a.orderNumber || '').localeCompare(b.orderNumber || ''),
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 700, color: '#1a1d2e' }}>#{r.orderNumber}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{dayjs(r.orderDate).format('DD MMM YYYY')}</div>
        </div>
      ),
    },
    {
      title: 'Customer',
      key: 'customer',
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1a1d2e' }}>{r.customer?.businessName}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{r.customer?.phone}</div>
        </div>
      ),
    },
    {
      title: 'Sales Person',
      key: 'salesPerson',
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1a1d2e' }}>{r.salesPerson?.fullName || '—'}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{r.salesPerson?.phone}</div>
        </div>
      ),
    },
    {
      title: 'Route',
      key: 'route',
      render: (_: any, r: any) => {
        const route = r.routeName || r.customer?.routeName;
        return route
          ? <span style={{ color: '#1a1d2e', fontWeight: 600, textTransform: 'capitalize' }}>{route.toLowerCase()}</span>
          : <span style={{ color: '#9ca3af' }}>—</span>;
      },
    },
    {
      title: 'Items',
      key: 'items',
      width: 80,
      align: 'center' as const,
      render: (_: any, r: any) => (
        <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: '1px solid #bfdbfe' }}>
          {r.items?.length || 0}
        </span>
      ),
    },
    {
      title: 'Amount',
      key: 'amount',
      width: 130,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.totalAmount || 0) - (b.totalAmount || 0),
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 700, color: '#059669', fontSize: 14 }}>{formatINR(r.totalAmount)}</div>
          {r.balanceAmount > 0 && <div style={{ fontSize: 11, color: '#ef4444' }}>Due: {formatINR(r.balanceAmount)}</div>}
        </div>
      ),
    },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s: string) => <StatusPill status={s} /> },
    {
      title: 'Actions',
      key: 'actions',
      width: 132,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <span onClick={e => e.stopPropagation()}>
          <Space size={2}>
            {isWarehouse && record.status === 'APPROVED' && (
              <Tooltip title="Start Picking">
                <Button type="text" size="small" icon={<InboxOutlined />} style={{ color: '#f97316' }}
                  onClick={() => handleStartPacking(record.id)} />
              </Tooltip>
            )}
            {isWarehouse && record.status === 'PACKING' && (
              <Tooltip title="Verify & Prepare">
                <Button type="text" size="small" icon={<CheckSquareOutlined />} style={{ color: '#06b6d4' }}
                  onClick={() => openVerifyModal(record)} />
              </Tooltip>
            )}
            {isDelivery && record.status === 'PACKED' && (
              <Popconfirm title="Confirm pickup and dispatch?" onConfirm={() => handleDispatch(record.id)}>
                <Tooltip title="Dispatch">
                  <Button type="text" size="small" icon={<CarOutlined />} style={{ color: '#8b5cf6' }} />
                </Tooltip>
              </Popconfirm>
            )}
            {isDelivery && record.status === 'DISPATCHED' && (
              <Popconfirm title="Confirm delivery to customer?" onConfirm={() => handleMarkDelivered(record.id)}>
                <Tooltip title="Mark Delivered">
                  <Button type="text" size="small" icon={<CheckCircleOutlined />} style={{ color: '#10b981' }} />
                </Tooltip>
              </Popconfirm>
            )}
            {(isAdmin || canCreateOrders) && !['DISPATCHED', 'DELIVERED', 'CANCELLED'].includes(record.status) && (
              <Tooltip title="Edit">
                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
              </Tooltip>
            )}
            {isAdmin && record.status === 'DELIVERED' && (
              <Tooltip title="Adjust Price">
                <Button type="text" size="small" icon={<DollarOutlined />} style={{ color: '#059669' }} onClick={() => openAdjustPriceModal(record)} />
              </Tooltip>
            )}
            {(isAdmin || canCreateOrders) && ['DRAFT', 'SUBMITTED'].includes(record.status) && (
              <Popconfirm title="Cancel this order?" onConfirm={() => handleCancel(record.id)}>
                <Tooltip title="Cancel Order">
                  <Button type="text" size="small" danger icon={<CloseCircleOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        </span>
      ),
    },
  ];

  return (
    <div>
      {/* Hidden invoice for print */}
      {printOrder && <InvoicePrint order={printOrder} company={companyProfile} />}

      <PageHeader
        title="Orders"
        subtitle={isSales ? 'My sales orders' : isDelivery ? "Today's deliveries" : 'All orders across routes'}
        count={totalOrders}
        countLabel="orders"
        action={
          <Space wrap>
            {!isSales && !isDelivery && !isMobile && (
              <>
                <Input.Search
                  placeholder="Order #, customer, phone..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  allowClear
                  style={{ width: 260, borderRadius: 8 }}
                />
                <DatePicker.RangePicker
                  value={dateRange}
                  onChange={(vals) => { setDateRange(vals as [Dayjs, Dayjs] | null); setCurrentPage(1); }} disabledDate={noFutureDates}
                  format="DD MMM YYYY"
                  allowClear
                  style={{ borderRadius: 8 }}
                  placeholder={['From', 'To']}
                />
                <Select placeholder="All statuses" style={{ width: 160 }} allowClear value={statusFilter} onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
                </Select>
                {salesPersonOptions.length > 0 && (
                  <Select
                    allowClear placeholder="All salespersons" style={{ width: 160 }}
                    value={salesPersonFilter}
                    onChange={(v) => { setSalesPersonFilter(v ?? null); setRouteFilter(null); }}
                    options={salesPersonOptions.map(([id, name]: [string, string]) => ({ value: id, label: name }))}
                  />
                )}
                {routeOptions.length > 0 && (
                  <Select
                    allowClear placeholder="All routes" style={{ width: 150 }}
                    value={routeFilter}
                    onChange={(v) => setRouteFilter(v ?? null)}
                    options={routeOptions.map((r: any) => ({ value: r.id, label: r.name }))}
                  />
                )}
              </>
            )}
            {canCreateOrders && (
              <Button type="primary" icon={<PlusOutlined />} size="middle"
                onClick={() => { form.resetFields(); setOrderItems([]); setCreateModal(true); }}>
                New Order
              </Button>
            )}
          </Space>
        }
      />

      {!isSales && !isDelivery && isMobile && (
        <Card style={{ marginBottom: 12, borderRadius: 10 }} styles={{ body: { padding: '12px 14px' } }}>
          <Row gutter={[8, 8]}>
            <Col xs={24}>
              <Input.Search
                placeholder="Order #, customer, phone..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                allowClear
                style={{ width: '100%', borderRadius: 8 }}
              />
            </Col>
            <Col xs={24}>
              <DatePicker.RangePicker
                value={dateRange}
                onChange={(vals) => { setDateRange(vals as [Dayjs, Dayjs] | null); setCurrentPage(1); }} disabledDate={noFutureDates}
                format="DD MMM YY"
                allowClear
                style={{ width: '100%', borderRadius: 8 }}
                placeholder={['From', 'To']}
              />
            </Col>
            <Col xs={24}>
              <Select placeholder="All statuses" style={{ width: '100%' }} allowClear value={statusFilter} onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
              </Select>
            </Col>
            {salesPersonOptions.length > 0 && (
              <Col xs={24}>
                <Select
                  allowClear placeholder="All salespersons" style={{ width: '100%' }}
                  value={salesPersonFilter}
                  onChange={(v) => { setSalesPersonFilter(v ?? null); setRouteFilter(null); }}
                  options={salesPersonOptions.map(([id, name]: [string, string]) => ({ value: id, label: name }))}
                />
              </Col>
            )}
            {routeOptions.length > 0 && (
              <Col xs={24}>
                <Select
                  allowClear placeholder="All routes" style={{ width: '100%' }}
                  value={routeFilter}
                  onChange={(v) => setRouteFilter(v ?? null)}
                   options={routeOptions.map((r: { id: string; name: string }) => ({ value: r.id, label: r.name }))}
                />
              </Col>
            )}
          </Row>
        </Card>
      )}

      <Card style={{ borderRadius: 12, padding: 0 }} styles={{ body: { padding: 0 } }}>
        <TableToolbar
          total={!isSales && !isDelivery ? totalOrders : orders.length}
          label="orders"
          data={orders}
          columns={exportColumns}
          exportFilename={`orders-${new Date().toISOString().split('T')[0]}`}
          exportFormat="excel"
          sheetName="Orders"
          exportTitle="Orders"
          exportSubtitle={`Generated ${dayjs().format('DD MMM YYYY')} · ${orders.length} order${orders.length === 1 ? '' : 's'}`}
          exportTotals
          onExport={!isSales && !isDelivery ? handleExportAll : undefined}
        />
        <Table
          columns={columns} dataSource={orders} rowKey="id" loading={isLoading}
          pagination={!isSales && !isDelivery
            ? { total: totalOrders, current: currentPage, pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} orders`, onChange: (p) => setCurrentPage(p) }
            : { pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} orders` }
          }
          size="middle" virtual scroll={{ x: 1000, y: 550 }}
          onRow={(record: any) => ({
            onClick: () => { setSelectedOrder(record); setDetailModal(true); },
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      {/* ── Create Order Modal ── */}
      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 16 }}>Create New Order</span>}
        open={createModal} onOk={handleCreate} onCancel={() => setCreateModal(false)}
        confirmLoading={creating} width={isMobile ? '98vw' : 820} okText="Place Order" okButtonProps={{ size: 'middle' }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="customerId" label="Customer" rules={[{ required: true }]}>
                <Select showSearch placeholder="Select customer" optionFilterProp="children">
                  {customers.map((c: any) => <Option key={c.id} value={c.id}>{c.businessName} — {c.routePlace?.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="notes" label="Notes"><Input placeholder="Optional" /></Form.Item>
            </Col>
          </Row>
        </Form>
        <div style={{ borderTop: '1px solid #f0f0f0', margin: '4px 0 16px', paddingTop: 16 }}>
          <div style={{ fontWeight: 700, color: '#1a1d2e', marginBottom: 12 }}>Order Items</div>
          {orderItems.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af' }}>
              <ShoppingOutlined style={{ fontSize: 28, display: 'block', marginBottom: 8 }} />No items added
            </div>
          )}
          {orderItems.map((item, index) => {
            const priceError = isPriceOutOfRange(item.unitPrice, item.minSaleRate, item.maxSaleRate);
            const rangeLabel = item.minSaleRate != null || item.maxSaleRate != null
              ? `${item.minSaleRate != null ? `₹${Number(item.minSaleRate).toFixed(2)}` : ''}${item.minSaleRate != null && item.maxSaleRate != null ? ' – ' : ''}${item.maxSaleRate != null ? `₹${Number(item.maxSaleRate).toFixed(2)}` : ''}`
              : null;
            return (
              <Card key={index} size="small" style={{ marginBottom: 8, borderRadius: 8 }}
                extra={<Button size="small" danger type="text" onClick={() => removeItem(index)}>Remove</Button>}>
                <Row gutter={10} align="middle">
                  <Col span={10}>
                    <Select showSearch placeholder="Product" style={{ width: '100%' }} value={item.productId}
                      optionFilterProp="children" onChange={(v) => updateItem(index, 'productId', v)}>
                      {products.map((p: any) => <Option key={p.id} value={p.id}>{p.name} ({p.brand})</Option>)}
                    </Select>
                  </Col>
                  <Col span={4}>
                    <InputNumber placeholder="Qty" style={{ width: '100%' }} min={1} value={item.quantity}
                      onChange={(v) => updateItem(index, 'quantity', v)} />
                  </Col>
                  <Col span={5}>
                    <InputNumber placeholder="Rate ₹" precision={2} min={0} value={item.unitPrice}
                      style={{ width: '100%', borderColor: priceError ? '#ef4444' : undefined }}
                      onChange={(v) => updateItem(index, 'unitPrice', v ?? 0)} />
                    {rangeLabel && (
                      <div style={{ fontSize: 10, marginTop: 2, color: priceError ? '#ef4444' : '#9ca3af' }}>
                        {rangeLabel}
                      </div>
                    )}
                  </Col>
                  <Col span={3}><span style={{ color: '#9ca3af', fontSize: 12 }}>GST {item.gstPercent}%</span></Col>
                  <Col span={2}><span style={{ color: '#059669', fontWeight: 700, fontSize: 12 }}>
                    ₹{((item.unitPrice || 0) * (item.quantity || 0)).toFixed(0)}
                  </span></Col>
                </Row>
              </Card>
            );
          })}
          <Button icon={<PlusOutlined />} onClick={addItem} block style={{ borderStyle: 'dashed', borderRadius: 8, marginTop: 8 }}>
            Add Product
          </Button>
          {orderItems.length > 0 && (() => {
            const gross = calcTotal();
            const disc = calcDiscount(gross, overallDisc.value);
            return (
              <div style={{ marginTop: 12, background: '#ecfdf5', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: disc > 0 ? 8 : 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>
                    Overall Discount {discountType === 'PERCENT' ? '(%)' : '(₹)'}
                  </span>
                  <InputNumber size="small" min={0} style={{ width: 120 }} placeholder="0"
                    prefix={discountType === 'AMOUNT' ? '₹' : undefined}
                    value={overallDisc.value ?? undefined}
                    max={discountType === 'PERCENT' ? 100 : undefined}
                    onChange={(v) => setOverallDisc(d => ({ ...d, value: v as number }))} />
                  {disc > 0 && <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>− ₹{disc.toFixed(2)}</span>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#059669' }}>
                  <span>Total ({orderItems.length} items)</span>
                  <span>₹{(gross - disc).toFixed(2)}</span>
                </div>
              </div>
            );
          })()}
        </div>
      </Modal>

      {/* ── Edit Order Modal ── */}
      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 16 }}>Edit Order #{editingOrder?.orderNumber}</span>}
        open={editModal} onOk={handleUpdate} onCancel={() => setEditModal(false)}
        confirmLoading={updating} width={isMobile ? '98vw' : 820} okText="Save Changes" okButtonProps={{ size: 'middle' }}
        destroyOnClose
      >
        {editingOrder && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#374151' }}>
            <strong>{editingOrder.customer?.businessName}</strong>
            <span style={{ color: '#94a3b8', marginLeft: 8 }}>{editingOrder.orderNumber}</span>
            <span style={{ marginLeft: 8 }}><StatusPill status={editingOrder.status} /></span>
          </div>
        )}
        <Form form={editForm} layout="vertical">
          <Form.Item name="notes" label="Notes"><Input placeholder="Optional" /></Form.Item>
        </Form>
        <div style={{ borderTop: '1px solid #f0f0f0', marginBottom: 16, paddingTop: 16 }}>
          <div style={{ fontWeight: 700, color: '#1a1d2e', marginBottom: 12 }}>Order Items</div>
          {editItems.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af' }}>
              <ShoppingOutlined style={{ fontSize: 28, display: 'block', marginBottom: 8 }} />No items
            </div>
          )}
          {editItems.map((item, index) => {
            const priceError = isPriceOutOfRange(item.unitPrice, item.minSaleRate, item.maxSaleRate);
            const rangeLabel = item.minSaleRate != null || item.maxSaleRate != null
              ? `${item.minSaleRate != null ? `₹${Number(item.minSaleRate).toFixed(2)}` : ''}${item.minSaleRate != null && item.maxSaleRate != null ? ' – ' : ''}${item.maxSaleRate != null ? `₹${Number(item.maxSaleRate).toFixed(2)}` : ''}`
              : null;
            const gross = (item.unitPrice || 0) * (item.quantity || 0);
            const disc = discountType === 'AMOUNT' ? (item.discountAmount || 0) : gross * (item.discountPercent || 0) / 100;
            return (
              <Card key={index} size="small" style={{ marginBottom: 8, borderRadius: 8 }}
                extra={<Button size="small" danger type="text" onClick={() => removeEditItem(index)}>Remove</Button>}>
                <Row gutter={10} align="middle">
                  <Col span={8}>
                    <Select showSearch placeholder="Product" style={{ width: '100%' }} value={item.productId}
                      optionFilterProp="children" onChange={(v) => updateEditItem(index, 'productId', v)}>
                      {products.map((p: any) => <Option key={p.id} value={p.id}>{p.name} ({p.brand})</Option>)}
                    </Select>
                  </Col>
                  <Col span={3}>
                    <InputNumber placeholder="Qty" style={{ width: '100%' }} min={1} value={item.quantity}
                      onChange={(v) => updateEditItem(index, 'quantity', v)} />
                  </Col>
                  <Col span={5}>
                    <InputNumber placeholder="Rate ₹" precision={2} min={0} value={item.unitPrice}
                      style={{ width: '100%', borderColor: priceError ? '#ef4444' : undefined }}
                      onChange={(v) => updateEditItem(index, 'unitPrice', v ?? 0)} />
                    {rangeLabel && (
                      <div style={{ fontSize: 10, marginTop: 2, color: priceError ? '#ef4444' : '#9ca3af' }}>
                        {rangeLabel}
                      </div>
                    )}
                  </Col>
                  <Col span={4}>
                    {discountType === 'AMOUNT' ? (
                      <InputNumber placeholder="Disc ₹" precision={2} min={0} value={item.discountAmount}
                        style={{ width: '100%' }} prefix="₹" onChange={(v) => updateEditItem(index, 'discountAmount', v ?? 0)} />
                    ) : (
                      <InputNumber placeholder="Disc %" precision={2} min={0} max={100} value={item.discountPercent}
                        style={{ width: '100%' }} suffix="%" onChange={(v) => updateEditItem(index, 'discountPercent', v ?? 0)} />
                    )}
                  </Col>
                  <Col span={2}><span style={{ color: '#9ca3af', fontSize: 12 }}>GST {item.gstPercent}%</span></Col>
                  <Col span={2}><span style={{ color: '#059669', fontWeight: 700, fontSize: 12 }}>
                    ₹{Math.max(0, gross - disc).toFixed(0)}
                  </span></Col>
                </Row>
              </Card>
            );
          })}
          <Button icon={<PlusOutlined />} onClick={addEditItem} block style={{ borderStyle: 'dashed', borderRadius: 8, marginTop: 8 }}>
            Add Product
          </Button>
          {editItems.length > 0 && (() => {
            const gross = calcEditTotal();
            const editDiscType: 'PERCENT' | 'AMOUNT' = editingOrder?.overallDiscountType || discountType;
            const disc = calcDiscount(gross, editOverallDisc, editDiscType);
            return (
              <div style={{ marginTop: 12, background: '#ecfdf5', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: disc > 0 ? 8 : 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>
                    Overall Discount {editDiscType === 'PERCENT' ? '(%)' : '(₹)'}
                  </span>
                  <InputNumber size="small" min={0} style={{ width: 120 }} placeholder="0"
                    prefix={editDiscType === 'AMOUNT' ? '₹' : undefined}
                    value={editOverallDisc ?? undefined}
                    max={editDiscType === 'PERCENT' ? 100 : undefined}
                    onChange={(v) => setEditOverallDisc(v as number)} />
                  {disc > 0 && <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>− ₹{disc.toFixed(2)}</span>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#059669' }}>
                  <span>Total ({editItems.length} items)</span>
                  <span>₹{(gross - disc).toFixed(2)}</span>
                </div>
              </div>
            );
          })()}
        </div>
      </Modal>

      {/* ── Adjust Delivered Price Modal (Admin-only) ── */}
      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 16 }}>Adjust Price — #{adjustPriceOrder?.orderNumber}</span>}
        open={adjustPriceModal} onOk={handleAdjustPrice} onCancel={() => setAdjustPriceModal(false)}
        confirmLoading={adjustingPrice} width={isMobile ? '98vw' : 720} okText="Save Price Adjustment" okButtonProps={{ size: 'middle' }}
        destroyOnClose
      >
        {adjustPriceOrder && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a', fontSize: 13, color: '#92400e' }}>
            Delivered order — quantity and products are locked. Only price and discount can be corrected here.
          </div>
        )}
        <div>
          {adjustPriceItems.map((item, index) => {
            const priceError = isPriceOutOfRange(item.unitPrice, item.minSaleRate, item.maxSaleRate);
            const rangeLabel = item.minSaleRate != null || item.maxSaleRate != null
              ? `${item.minSaleRate != null ? `₹${Number(item.minSaleRate).toFixed(2)}` : ''}${item.minSaleRate != null && item.maxSaleRate != null ? ' – ' : ''}${item.maxSaleRate != null ? `₹${Number(item.maxSaleRate).toFixed(2)}` : ''}`
              : null;
            return (
              <Card key={item.itemId} size="small" style={{ marginBottom: 8, borderRadius: 8 }}>
                <Row gutter={10} align="middle">
                  <Col span={8}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{item.productName}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>Qty {item.quantity}</div>
                  </Col>
                  <Col span={6}>
                    <InputNumber placeholder="Rate ₹" precision={2} min={0} value={item.unitPrice}
                      style={{ width: '100%', borderColor: priceError ? '#ef4444' : undefined }}
                      onChange={(v) => updateAdjustPriceItem(index, 'unitPrice', v ?? 0)} />
                    {rangeLabel && (
                      <div style={{ fontSize: 10, marginTop: 2, color: priceError ? '#ef4444' : '#9ca3af' }}>
                        {rangeLabel}
                      </div>
                    )}
                  </Col>
                  <Col span={6}>
                    {discountType === 'AMOUNT' ? (
                      <InputNumber placeholder="Discount ₹" precision={2} min={0} value={item.discountAmount}
                        style={{ width: '100%' }} onChange={(v) => updateAdjustPriceItem(index, 'discountAmount', v ?? 0)} />
                    ) : (
                      <InputNumber placeholder="Discount %" precision={2} min={0} max={100} value={item.discountPercent}
                        style={{ width: '100%' }} onChange={(v) => updateAdjustPriceItem(index, 'discountPercent', v ?? 0)} />
                    )}
                  </Col>
                  <Col span={4}><span style={{ color: '#059669', fontWeight: 700, fontSize: 12 }}>
                    ₹{((item.unitPrice || 0) * (item.quantity || 0)).toFixed(0)}
                  </span></Col>
                </Row>
              </Card>
            );
          })}
          {adjustPriceItems.length > 0 && (
            <>
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Overall Discount {discountType === 'AMOUNT' ? '(₹)' : '(%)'}
                </span>
                <InputNumber min={0} precision={2} style={{ width: 140 }} placeholder="0"
                  max={discountType === 'PERCENT' ? 100 : undefined}
                  {...(discountType === 'AMOUNT' ? { prefix: '₹' } : { suffix: '%' })}
                  value={adjustOverallDisc ?? undefined}
                  onChange={(v) => setAdjustOverallDisc(v as number)} />
              </div>
              {calcAdjustOverallDiscount() > 0 && (
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#dc2626' }}>
                  <span>Less: Discount</span>
                  <span>−₹{calcAdjustOverallDiscount().toFixed(2)}</span>
                </div>
              )}
              <div style={{ marginTop: 8, background: '#ecfdf5', borderRadius: 8, padding: '10px 14px', fontWeight: 600, color: '#059669' }}>
                New Total: ₹{calcAdjustPriceTotal().toFixed(2)}
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ── Order Detail Modal ── */}
      <Modal
        title={selectedOrder ? `${selectedOrder.orderNumber} — ${selectedOrder.customer?.businessName}` : ''}
        open={detailModal} onCancel={() => setDetailModal(false)}
        footer={[
          <Button key="print" icon={<PrinterOutlined />} onClick={() => handlePrint(selectedOrder)}>
            Print Invoice
          </Button>,
          selectedOrder?.status === 'DELIVERED' && (
            <Button key="return" icon={<RollbackOutlined />} danger onClick={() => setReturnModal(true)}>
              Return Items
            </Button>
          ),
          isAdmin && selectedOrder && selectedOrder.status !== 'CANCELLED' && !selectedOrder.openingBalance && (
            <Select key="status" placeholder="Change Status…" style={{ width: 170, textAlign: 'left' }}
              value={undefined} loading={changingStatus} onChange={handleChangeStatus}
              options={['SUBMITTED', 'APPROVED', 'PACKING', 'PACKED', 'DISPATCHED', 'DELIVERED']
                .filter(s => s !== selectedOrder.status)
                .map(s => ({ value: s, label: STATUS_CONFIG[s]?.label || s }))} />
          ),
          <Button key="close" type="primary" onClick={() => setDetailModal(false)}>Close</Button>,
        ]}
        width={isMobile ? '98vw' : 720}
      >
        {selectedOrder && (
          <>
            <Descriptions bordered size="small" column={isMobile ? 1 : 2} style={{ marginTop: 12 }}>
              <Descriptions.Item label="Customer">{selectedOrder.customer?.businessName}</Descriptions.Item>
              <Descriptions.Item label="Phone">{selectedOrder.customer?.phone}</Descriptions.Item>
              <Descriptions.Item label="Date">{dayjs(selectedOrder.orderDate).format('DD MMM YYYY')}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <StatusPill status={selectedOrder.status} />
                {anyReturned && (
                  <span style={{
                    marginLeft: 8, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                    background: fullyReturned ? '#fef2f2' : '#fff7ed',
                    color: fullyReturned ? '#dc2626' : '#c2410c',
                    border: `1px solid ${fullyReturned ? '#fecaca' : '#fed7aa'}`,
                  }}>
                    {fullyReturned ? 'Fully Returned' : 'Partially Returned'}
                  </span>
                )}
              </Descriptions.Item>
              {Number(selectedOrder.overallDiscountAmount) > 0 && (
                <Descriptions.Item label="Overall Discount" span={2}>
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>−{formatINR(selectedOrder.overallDiscountAmount)}</span>
                  {selectedOrder.overallDiscountType === 'PERCENT' && selectedOrder.overallDiscountValue
                    ? ` (${Number(selectedOrder.overallDiscountValue)}%)` : ''}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Total">{formatINR(selectedOrder.totalAmount)}</Descriptions.Item>
              <Descriptions.Item label="Paid">{formatINR(selectedOrder.paidAmount)}</Descriptions.Item>
              <Descriptions.Item label="Balance" span={2}>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>{formatINR(selectedOrder.balanceAmount)}</span>
              </Descriptions.Item>
            </Descriptions>
            <div style={{ fontWeight: 700, color: '#1a1d2e', margin: '16px 0 8px' }}>Items</div>
            <Table size="small" dataSource={selectedOrder.items || []} rowKey="id" pagination={false}
              columns={[
                { title: 'Product', dataIndex: ['product', 'name'], key: 'name' },
                { title: 'HSN', dataIndex: ['product', 'hsnCode'], key: 'hsn', width: 80, render: (v: string) => v || '—' },
                { title: 'Qty', dataIndex: 'quantity', key: 'qty', width: 60 },
                ...(anyReturned ? [{
                  title: 'Returned', key: 'returned', width: 80,
                  render: (_: any, r: any) => {
                    const ret = returnInfo.qtyByProduct[r.product?.id] || 0;
                    return ret > 0
                      ? <span style={{ color: '#dc2626', fontWeight: 600 }}>{ret}</span>
                      : <span style={{ color: '#9ca3af' }}>—</span>;
                  },
                }] : []),
                { title: 'Rate', dataIndex: 'unitPrice', key: 'rate', render: (v: number) => `₹${v?.toFixed(2)}` },
                { title: 'Disc', dataIndex: 'discountAmount', key: 'disc', render: (v: number) => v && v > 0 ? `₹${Number(v).toFixed(2)}` : '—' },
                { title: 'GST', dataIndex: 'gstAmount', key: 'gst', render: (v: number) => `₹${v?.toFixed(2)}` },
                { title: 'Total', dataIndex: 'lineTotal', key: 'total', render: (v: number) => <strong style={{ color: '#059669' }}>₹{v?.toFixed(2)}</strong> },
              ]}
            />
            {anyReturned && (
              <div style={{ marginTop: 12, background: '#fafafa', border: '1px solid #eef0f2', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', marginBottom: 6 }}>
                  <span>Original Total</span>
                  <span>{formatINR(originalTotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#dc2626', marginBottom: 6 }}>
                  <span>
                    Less: Returns
                    {returnInfo.verified.length > 0 && (
                      <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: 12 }}>
                        ({returnInfo.verified.map((r: any) => r.returnNumber).join(', ')})
                      </span>
                    )}
                  </span>
                  <span>−{formatINR(returnInfo.returnsValue)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, color: '#0f172a', borderTop: '1px solid #eef0f2', paddingTop: 8 }}>
                  <span>Net Total</span>
                  <span>{formatINR(netTotal)}</span>
                </div>
                {returnInfo.pendingCount > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#c2410c' }}>
                    {returnInfo.pendingCount} return{returnInfo.pendingCount > 1 ? 's' : ''} awaiting warehouse verification — not yet applied to this bill.
                  </div>
                )}
              </div>
            )}
            <div style={{ fontWeight: 700, color: '#1a1d2e', margin: '16px 0 8px' }}>
              Payment History
              {orderPayments.length > 0 && (
                <span style={{ fontWeight: 400, fontSize: 12, color: '#64748b', marginLeft: 8 }}>
                  {orderPayments.length} payment{orderPayments.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {orderPayments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8', fontSize: 13 }}>
                No payments recorded yet
              </div>
            ) : (
              <Table size="small" dataSource={orderPayments} rowKey="id" pagination={false}
                columns={[
                  {
                    title: 'Date', dataIndex: 'collectionDate', key: 'date', width: 110,
                    render: (v: string) => dayjs(v).format('DD MMM YYYY'),
                  },
                  {
                    title: 'Amount', dataIndex: 'amount', key: 'amount', width: 110,
                    render: (v: number) => {
                      const isRefund = Number(v) < 0;
                      return (
                        <strong style={{ color: isRefund ? '#dc2626' : '#059669' }}>
                          {isRefund ? '-' : ''}₹{Math.abs(Number(v)).toFixed(2)}
                        </strong>
                      );
                    },
                  },
                  {
                    title: 'Mode', key: 'mode',
                    render: (_: any, r: any) => {
                      const isRefund = Number(r.amount) < 0;
                      return (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{r.paymentMethodName || r.paymentMode}</span>
                          {isRefund && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '1px 8px' }}>
                              REFUND
                            </span>
                          )}
                        </span>
                      );
                    },
                  },
                  {
                    title: 'Collected By', key: 'collector',
                    render: (_: any, r: any) => (
                      <span style={{ fontSize: 12, color: '#475569' }}>{r.collectedBy?.fullName}</span>
                    ),
                  },
                  {
                    title: 'Ref #', dataIndex: 'referenceNumber', key: 'ref', width: 160,
                    render: (v: string, r: any) => (
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{v || r.notes || '—'}</span>
                    ),
                  },
                  {
                    title: 'Status', key: 'status', width: 90,
                    render: (_: any, r: any) => (
                      r.cleared
                        ? <span style={{ color: '#059669', fontSize: 11, fontWeight: 700 }}>✓ Cleared</span>
                        : r.submitted
                          ? <span style={{ color: '#d97706', fontSize: 11, fontWeight: 700 }}>Submitted</span>
                          : <span style={{ color: '#94a3b8', fontSize: 11 }}>Collected</span>
                    ),
                  },
                ]}
              />
            )}
            <div style={{ fontWeight: 700, color: '#1a1d2e', margin: '16px 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
              Audit History
              <AuditHistoryButton entityType="ORDER" entityId={selectedOrder.id} title={`Audit — Order #${selectedOrder.orderNumber}`} />
            </div>
          </>
        )}
      </Modal>

      {/* ── Verify Items Modal ── */}
      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 16 }}>Verify Items — #{selectedOrder?.orderNumber}</span>}
        open={verifyModal} onOk={handleVerifyAndPrepare} onCancel={() => setVerifyModal(false)}
        confirmLoading={verifying} okText="Verify & Mark Packed" width={isMobile ? '98vw' : 640}
        okButtonProps={{ size: 'middle', style: { background: '#06b6d4', borderColor: '#06b6d4' } }}
      >
        <div style={{ marginTop: 8, color: '#6b7280', fontSize: 13, marginBottom: 12 }}>
          Check each item against the order and click <strong>Verify & Mark Packed</strong> to confirm.
        </div>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '1fr auto auto', padding: '6px 0',
          borderBottom: '2px solid #e2e8f0', fontSize: 11, fontWeight: 700, color: '#64748b',
          textTransform: 'uppercase', letterSpacing: 0.5, gap: 16 }}>
          <span>Product</span>
          <span style={{ textAlign: 'right' }}>Rate</span>
          <span style={{ textAlign: 'right', minWidth: 60 }}>Qty</span>
        </div>
        {(selectedOrder?.items || []).map((item: any, idx: number) => (
          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto',
            alignItems: 'center', padding: '11px 0', gap: 16,
            borderBottom: idx < (selectedOrder?.items?.length - 1) ? '1px solid #f1f5f9' : 'none' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#1a1d2e', fontSize: 14 }}>{item.product?.name}</div>
              {item.product?.brand && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{item.product.brand}</div>}
            </div>
            <div style={{ textAlign: 'right', fontSize: 13, color: '#475569' }}>
              ₹{item.unitPrice?.toFixed(2)}
            </div>
            <div style={{ textAlign: 'right', minWidth: 72 }}>
              <span style={{ fontWeight: 800, fontSize: 18, color: '#059669' }}>{item.quantity}</span>
              {item.product?.unit && (
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginLeft: 4 }}>{item.product.unit}</span>
              )}
            </div>
          </div>
        ))}
        <div style={{ marginTop: 14, background: '#ecfdf5', borderRadius: 8, padding: '10px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#065f46' }}>{selectedOrder?.items?.length} item(s) · Total</span>
          <span style={{ fontWeight: 800, color: '#059669', fontSize: 15 }}>₹{selectedOrder?.totalAmount?.toFixed(2)}</span>
        </div>
      </Modal>

      {/* ── Return Items Modal ── */}
      {selectedOrder && (
        <ReturnFromOrderModal
          order={selectedOrder}
          open={returnModal}
          onClose={() => setReturnModal(false)}
        />
      )}

    </div>
  );
};

export default OrdersPage;
