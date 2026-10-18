import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Form, Input, InputNumber, Select, Modal, Skeleton, message, Grid, Table, Popconfirm, DatePicker } from 'antd';
import { FileExcelOutlined, WalletOutlined, ArrowLeftOutlined, SearchOutlined, TeamOutlined, UserOutlined, EnvironmentOutlined, DownloadOutlined, PrinterOutlined, InboxOutlined, DeleteOutlined, ProfileOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetOutstandingSummaryQuery,
  useGetCustomerOrdersQuery,
  useGetCustomerPaymentHistoryQuery,
  useCollectPaymentMutation,
  useGetSalesmanOutstandingQuery,
  useGetRouteOutstandingQuery,
} from '../../store/api/paymentApi';
import { useDeleteOpeningBalanceMutation } from '../../store/api/orderApi';
import { useGetPaymentMethodsQuery } from '../../store/api/paymentMethodApi';
import { useGetRoutesQuery } from '../../store/api/routeApi';
import { exportToXLSX } from '../../components/TableToolbar';
import { formatINR } from '../../utils/format';
import PaymentActions from '../../components/PaymentActions';
import { hasAnyPermission, hasPermission } from '../../utils/permissions';

const canRecordPayment = hasAnyPermission('PAYMENTS_CREATE', 'DELIVERY_UPDATE');
const canDeleteOpeningBalance = hasPermission('OPENING_BALANCE_DELETE');

const { useBreakpoint } = Grid;

const REQUIRES_REFERENCE = ['UPI', 'CHEQUE', 'NEFT', 'RTGS'];
const MODE_COLOR: Record<string, string> = {
  CASH: '#059669', UPI: '#7c3aed', CHEQUE: '#d97706', NEFT: '#0891b2', RTGS: '#2563eb', CREDIT: '#ef4444',
};

const SalesmanOutstandingView: React.FC = () => {
  const { data, isLoading, refetch } = useGetSalesmanOutstandingQuery();
  const salesmen: any[] = data?.data || [];
  const [search, setSearch] = useState('');
  const [deleteOpeningBalance] = useDeleteOpeningBalanceMutation();

  const handleDeleteOpeningBalance = async (orderId: string) => {
    try {
      await deleteOpeningBalance(orderId).unwrap();
      message.success('Opening balance entry deleted');
      refetch();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to delete');
    }
  };

  const filtered = salesmen.filter(s =>
    !search || s.salesPersonName?.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search)
  );
  const grandTotal = salesmen.reduce((sum: number, s: any) => sum + (Number(s.totalPending) || 0), 0);

  const handleExport = () => {
    const rows: any[] = [];
    filtered.forEach((s: any) => {
      (s.orders || []).forEach((o: any) => {
        rows.push({
          salesman: s.salesPersonName,
          phone: s.phone,
          customer: o.customerName,
          route: o.routeName,
          orderNumber: o.orderNumber,
          orderDate: dayjs(o.orderDate).format('DD MMM YYYY'),
          totalAmount: o.totalAmount,
          paidAmount: o.paidAmount,
          balanceAmount: o.balanceAmount,
          daysOutstanding: dayjs().diff(dayjs(o.orderDate), 'day'),
        });
      });
    });
    exportToXLSX(
      rows,
      [
        { title: 'Salesman', key: 'salesman', dataIndex: 'salesman' },
        { title: 'Phone', key: 'phone', dataIndex: 'phone' },
        { title: 'Customer', key: 'customer', dataIndex: 'customer' },
        { title: 'Route', key: 'route', dataIndex: 'route' },
        { title: 'Order #', key: 'orderNumber', dataIndex: 'orderNumber' },
        { title: 'Order Date', key: 'orderDate', dataIndex: 'orderDate' },
        { title: 'Total Amount', key: 'totalAmount', dataIndex: 'totalAmount' },
        { title: 'Paid Amount', key: 'paidAmount', dataIndex: 'paidAmount' },
        { title: 'Balance', key: 'balanceAmount', dataIndex: 'balanceAmount' },
        { title: 'Days Outstanding', key: 'daysOutstanding', dataIndex: 'daysOutstanding' },
      ],
      `salesman-credit-outstanding-${dayjs().format('YYYY-MM-DD')}`
    );
  };

  const expandedRowRender = (record: any) => {
    const orders: any[] = record.orders || [];
    return (
      <div style={{ background: '#f8fafc', padding: '0 0 8px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 1fr 1fr 70px 40px', padding: '8px 16px', borderBottom: '1px solid #e2e8f0' }}>
          {['Date', 'Order #', 'Customer', 'Route', 'Balance', 'Days', ''].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.7 }}>{h}</div>
          ))}
        </div>
        {orders.map((o: any, i: number) => {
          const days = dayjs().diff(dayjs(o.orderDate), 'day');
          const daysColor = days > 30 ? '#dc2626' : days > 15 ? '#d97706' : '#64748b';
          return (
            <div key={o.orderId} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 1fr 1fr 70px 40px', padding: '9px 16px', alignItems: 'center', borderBottom: i < orders.length - 1 ? '1px solid #f1f5f9' : 'none', background: '#fff' }}>
              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{dayjs(o.orderDate).format('DD MMM YYYY')}</div>
              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{o.orderNumber}</div>
              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{o.customerName}</div>
              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{o.routeName || '—'}</div>
              <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 13 }}>{formatINR(o.balanceAmount)}</div>
              <div style={{ fontWeight: 700, color: daysColor, fontSize: 13 }}>{days === 0 ? 'Today' : `${days}d`}</div>
              <div>
                {o.openingBalance && canDeleteOpeningBalance && (
                  <Popconfirm
                    title="Delete this opening balance entry?"
                    description="This removes it permanently and reduces the customer's outstanding."
                    onConfirm={() => handleDeleteOpeningBalance(o.orderId)}
                    okText="Delete" okButtonProps={{ danger: true }}
                  >
                    <Button danger size="small" icon={<DeleteOutlined />} style={{ borderRadius: 7 }} />
                  </Popconfirm>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const columns = [
    {
      title: 'Salesman',
      dataIndex: 'salesPersonName',
      key: 'salesPersonName',
      render: (name: string, record: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#475569', fontSize: 13, flexShrink: 0 }}>
            {name?.[0]}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{name}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{record.phone}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Customers',
      dataIndex: 'customerCount',
      key: 'customerCount',
      render: (v: number) => <span style={{ fontWeight: 600, color: '#0f172a' }}>{v}</span>,
    },
    {
      title: 'Orders',
      dataIndex: 'orderCount',
      key: 'orderCount',
      render: (v: number) => <span style={{ fontWeight: 600, color: '#0f172a' }}>{v}</span>,
    },
    {
      title: 'Total Credit Given',
      dataIndex: 'totalCreditGiven',
      key: 'totalCreditGiven',
      render: (v: any) => <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatINR(v)}</span>,
    },
    {
      title: 'Collected',
      dataIndex: 'totalCollected',
      key: 'totalCollected',
      render: (v: any) => <span style={{ fontWeight: 700, color: '#059669' }}>{formatINR(v)}</span>,
    },
    {
      title: 'Pending',
      dataIndex: 'totalPending',
      key: 'totalPending',
      render: (v: any) => <span style={{ fontWeight: 800, color: '#dc2626', fontSize: 14 }}>{formatINR(v)}</span>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Pending', value: formatINR(grandTotal), color: '#dc2626' },
            { label: 'Salesmen', value: `${salesmen.length}`, color: '#0f172a' },
          ].map(stat => (
            <div key={stat.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>{stat.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Input
            placeholder="Search salesman..."
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ borderRadius: 10, width: 220 }}
            allowClear
          />
          <Button icon={<FileExcelOutlined />} onClick={refetch} style={{ borderRadius: 10, height: 40 }}>Refresh</Button>
          <Button type="primary" icon={<FileExcelOutlined />} disabled={filtered.length === 0} onClick={handleExport}
            style={{ borderRadius: 10, height: 40, fontWeight: 700, background: '#059669' }}>
            Export
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>
          No salesman credit outstanding
        </div>
      ) : (
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="salesPersonId"
          expandable={{ expandedRowRender, expandRowByClick: true }}
          pagination={false}
          size="middle"
          style={{ background: '#fff', borderRadius: 12, overflow: 'hidden' }}
        />
      )}
    </div>
  );
};

function buildRouteOutstandingHtml(route: any): string {
  const today = dayjs().format('DD MMM YYYY');
  const rows = (route.customers || []).map((c: any, i: number) => {
    const days = c.oldestUnpaidOrderDate ? dayjs().diff(dayjs(c.oldestUnpaidOrderDate), 'day') : null;
    return `<tr>
      <td class="center">${i + 1}</td>
      <td>
        <div style="font-weight:600">${c.businessName}</div>
        ${c.ownerName ? `<div style="font-size:10px;color:#888">${c.ownerName}</div>` : ''}
      </td>
      <td>${c.phone || ''}</td>
      <td class="center">${c.orderCount}</td>
      <td class="right amount">&#8377;${Number(c.outstanding).toFixed(2)}</td>
      <td class="center age">${days !== null ? (days === 0 ? 'Today' : `${days}d`) : '—'}</td>
    </tr>`;
  }).join('');

  return `
    <div class="route-block">
      <div class="route-title">${route.routeName}</div>
      <div class="route-meta">Generated: ${today} &nbsp;&middot;&nbsp; ${route.customerCount} customer${route.customerCount !== 1 ? 's' : ''} &nbsp;&middot;&nbsp; Total: &#8377;${Number(route.totalOutstanding).toFixed(2)}</div>
      <table>
        <thead>
          <tr>
            <th class="center">#</th>
            <th>Customer</th>
            <th>Phone</th>
            <th class="center">Orders</th>
            <th class="right">Outstanding</th>
            <th class="center">Age</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="4" class="right total-label">TOTAL</td>
            <td class="right total-amount">&#8377;${Number(route.totalOutstanding).toFixed(2)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

function buildRouteOutstandingFullHtml(routeList: any[], title: string): string {
  const today = dayjs().format('DD MMM YYYY');
  const body = routeList.map(r => buildRouteOutstandingHtml(r)).join('<div class="page-break"></div>');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:Arial,sans-serif; font-size:12px; color:#111; padding:20px 24px; }
    h1 { font-size:16px; font-weight:800; margin-bottom:2px; }
    .doc-meta { font-size:11px; color:#555; margin-bottom:18px; }
    .route-block { margin-bottom:24px; }
    .route-title { font-size:15px; font-weight:800; color:#000; margin-bottom:2px; }
    .route-meta { font-size:11px; color:#555; margin-bottom:10px; }
    table { width:100%; border-collapse:collapse; margin-bottom:6px; }
    th { background:#f5f5f5; text-align:left; padding:5px 8px; font-size:10px; border:1px solid #ccc; }
    td { padding:4px 8px; border:1px solid #ddd; vertical-align:top; font-size:11px; }
    .right { text-align:right; }
    .center { text-align:center; }
    .amount { font-weight:700; }
    .age { color:#b45309; font-weight:600; }
    .total-label { font-weight:700; font-size:11px; background:#f5f5f5; }
    .total-amount { font-weight:800; font-size:13px; background:#f5f5f5; color:#dc2626; }
    tfoot td { border-top:2px solid #999; }
    .page-break { page-break-after:always; }
    @media print { body { padding:8px; } .page-break { page-break-after:always; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="doc-meta">Generated on ${today} &nbsp;&middot;&nbsp; ${routeList.length} route${routeList.length !== 1 ? 's' : ''}</div>
  ${body}
  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}

function downloadRouteHtml(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function printRouteHtml(html: string) {
  const win = window.open('', '_blank');
  if (!win) { message.warning('Allow popups to print'); return; }
  win.document.write(html);
  win.document.close();
}

const RouteOutstandingView: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { data, isLoading } = useGetRouteOutstandingQuery();
  const routes: any[] = data?.data || [];
  const [selectedRouteKey, setSelectedRouteKey] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const selected = routes.find(r => (r.routeId ?? r.routeName) === selectedRouteKey);
  const grandTotal = routes.reduce((s: number, r: any) => s + (Number(r.totalOutstanding) || 0), 0);

  const handleDownload = () => {
    if (!selected) return;
    const html = buildRouteOutstandingFullHtml([selected], `Outstanding — ${selected.routeName}`);
    downloadRouteHtml(html, `outstanding-${selected.routeName.replace(/\s+/g, '-')}-${dayjs().format('YYYY-MM-DD')}.html`);
  };

  const handlePrint = () => {
    if (!selected) return;
    const html = buildRouteOutstandingFullHtml([selected], `Outstanding — ${selected.routeName}`);
    printRouteHtml(html);
  };

  const customerColumns = [
    {
      title: '#',
      key: 'seq',
      width: 44,
      render: (_: any, __: any, i: number) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{i + 1}</span>,
    },
    {
      title: 'Customer',
      dataIndex: 'businessName',
      render: (name: string, r: any) => (
        <div>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{name}</div>
          {r.ownerName && <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.ownerName}</div>}
        </div>
      ),
    },
    { title: 'Phone', dataIndex: 'phone', width: 120 },
    { title: 'Orders', dataIndex: 'orderCount', width: 70, align: 'right' as const },
    {
      title: 'Outstanding',
      dataIndex: 'outstanding',
      width: 130,
      align: 'right' as const,
      render: (v: any) => <span style={{ fontWeight: 800, color: '#dc2626', fontSize: 13 }}>{formatINR(v)}</span>,
    },
    {
      title: 'Age',
      dataIndex: 'oldestUnpaidOrderDate',
      width: 70,
      align: 'center' as const,
      render: (d: string) => {
        if (!d) return <span style={{ color: '#94a3b8' }}>—</span>;
        const days = dayjs().diff(dayjs(d), 'day');
        const color = days > 30 ? '#dc2626' : days > 15 ? '#d97706' : '#64748b';
        return <span style={{ fontWeight: 700, color, fontSize: 12 }}>{days === 0 ? 'Today' : `${days}d`}</span>;
      },
    },
  ];

  const detailPanel = selected ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', rowGap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <EnvironmentOutlined style={{ color: '#059669' }} />
              <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>{selected.routeName}</span>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>{selected.customerCount} customers</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#dc2626' }}>{formatINR(selected.totalOutstanding)} outstanding</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>Print</Button>
            <Button icon={<DownloadOutlined />} onClick={handleDownload}>Download</Button>
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Customers — {selected.customerCount}
          </span>
        </div>
        <Table
          dataSource={selected.customers || []}
          columns={customerColumns}
          rowKey="customerId"
          size="small"
          pagination={false}
          scroll={{ x: 600 }}
        />
      </div>
    </div>
  ) : (
    <div style={{ height: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
      <InboxOutlined style={{ fontSize: 48, marginBottom: 12 }} />
      <div style={{ fontSize: 14, fontWeight: 500 }}>Select a route to view outstanding details</div>
    </div>
  );

  if (isMobile && showDetail && selected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button onClick={() => setShowDetail(false)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#059669', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 0 }}>
          <ArrowLeftOutlined /> Back to Routes
        </button>
        {detailPanel}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!isLoading && routes.length > 0 && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Outstanding', value: formatINR(grandTotal), color: '#dc2626' },
            { label: 'Routes', value: `${routes.length}`, color: '#0f172a' },
          ].map(stat => (
            <div key={stat.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>{stat.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : routes.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>
          No outstanding balances across any route
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ width: isMobile ? '100%' : 260, flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {routes.map(route => {
                const key = route.routeId ?? route.routeName;
                const isSelected = key === selectedRouteKey;
                return (
                  <div key={key} onClick={() => { setSelectedRouteKey(key); if (isMobile) setShowDetail(true); }}
                    style={{ background: isSelected ? '#ecfdf5' : '#fff', border: `1px solid ${isSelected ? '#059669' : '#e2e8f0'}`, borderRadius: 8, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{route.routeName}</span>
                      <EnvironmentOutlined style={{ color: '#059669' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#64748b' }}>{route.customerCount} customers</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#dc2626' }}>{formatINR(route.totalOutstanding)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {!isMobile && (
            <div style={{ flex: 1, minWidth: 0 }}>
              {detailPanel}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CustomerOutstandingPage: React.FC = () => {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isLargeDesktop = screens.xl;
  const [activeTab, setActiveTab] = useState<'customer' | 'salesman' | 'route'>('customer');

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const [collectModal, setCollectModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [routeFilter, setRouteFilter] = useState<string | undefined>();
  const [placeFilter, setPlaceFilter] = useState<string | undefined>();
  const [form] = Form.useForm();

  const { data: summaryData, isLoading: summaryLoading, refetch: refetchSummary } = useGetOutstandingSummaryQuery();
  const allSummaries: any[] = summaryData?.data || [];
  const summaries = allSummaries
    .filter(s => !search || s.businessName.toLowerCase().includes(search.toLowerCase()) || s.phone.includes(search))
    .filter(s => !routeFilter || s.routeId === routeFilter)
    .filter(s => !placeFilter || s.routePlaceId === placeFilter);
  const totalOutstanding = allSummaries.reduce((sum: number, s: any) => sum + (Number(s.outstanding) || 0), 0);

  const { data: routesData } = useGetRoutesQuery(undefined);
  const routes: any[] = routesData?.data || [];
  const getPlacesForRoute = (routeId: string) => {
    const route = routes.find((r: any) => r.id === routeId);
    return [...(route?.places || [])].sort((a: any, b: any) => a.sortOrder - b.sortOrder);
  };

  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useGetCustomerOrdersQuery(
    selectedCustomerId!,
    { skip: !selectedCustomerId }
  );
  const unpaidOrders: any[] = ordersData?.data || [];

  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useGetCustomerPaymentHistoryQuery(
    selectedCustomerId!,
    { skip: !selectedCustomerId }
  );
  const paymentHistory: any[] = historyData?.data || [];

  const { data: methodsData } = useGetPaymentMethodsQuery();
  const methods: any[] = (methodsData?.data || []).filter((m: any) => m.mode !== 'CREDIT');

  const [collectPayment, { isLoading: collecting }] = useCollectPaymentMutation();
  const [deleteOpeningBalance] = useDeleteOpeningBalanceMutation();

  const handleDeleteOpeningBalance = async (orderId: string) => {
    try {
      await deleteOpeningBalance(orderId).unwrap();
      message.success('Opening balance entry deleted');
      refetchSummary();
      refetchOrders();
    } catch (err: any) {
      message.error(err?.data?.message || 'Failed to delete');
    }
  };

  const selected = allSummaries.find(s => s.customerId === selectedCustomerId);
  const shouldShowList = !isMobile || !selectedCustomerId;
  const shouldShowDetail = !!selectedCustomerId;

  const collectAmount = Form.useWatch('amount', form);
  const selectedMethodId = Form.useWatch('paymentMethodId', form);
  const selectedMethod = methods.find(m => m.id === selectedMethodId);
  const needsRef = selectedMethod && REQUIRES_REFERENCE.includes(selectedMethod.mode);
  const isPartial = collectAmount != null && selectedOrder && collectAmount < selectedOrder.balanceAmount;

  const openCollect = (order: any) => {
    setSelectedOrder(order);
    form.resetFields();
    form.setFieldsValue({ amount: order.balanceAmount, collectionDate: dayjs() });
    setCollectModal(true);
  };

  const handleCollect = async () => {
    try {
      const values = await form.validateFields();
      if (values.amount > selectedOrder?.balanceAmount) {
        message.error(`Amount cannot exceed balance of ${formatINR(selectedOrder?.balanceAmount)}`);
        return;
      }
      await collectPayment({
        orderId: selectedOrder.id,
        amount: values.amount,
        paymentMethodId: values.paymentMethodId,
        referenceNumber: values.referenceNumber || null,
        collectionDate: values.collectionDate ? values.collectionDate.format('YYYY-MM-DD') : undefined,
        notes: values.notes || null,
        autoSubmit: true,
      }).unwrap();
      message.success(isPartial ? 'Partial payment recorded' : 'Payment recorded');
      setCollectModal(false);
      refetchSummary();
      refetchOrders();
      refetchHistory();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.data?.message || 'Failed to record payment');
    }
  };

  const tableContainerStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 16,
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  };

  // Only show all columns on large screens
  const listColumns = isLargeDesktop ? '2fr 1fr 1fr 1fr' : '1fr 120px';

  const tableHeaderStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: listColumns,
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    padding: '12px 20px',
  };

  const tableRowStyle = (isSelected: boolean): React.CSSProperties => ({
    display: 'grid',
    gridTemplateColumns: listColumns,
    padding: '13px 20px',
    alignItems: 'center',
    background: isSelected ? '#eff6ff' : '#fff',
    cursor: 'pointer',
    transition: 'background 0.15s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, padding: '4px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {isMobile && selectedCustomerId && (
            <button onClick={() => setSelectedCustomerId(null)}
              style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, width: 38, height: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
              <ArrowLeftOutlined />
            </button>
          )}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', fontSize: 18, flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <WalletOutlined />
          </div>
          <div>
            <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>Customer Outstanding</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: 500 }}>
              {isMobile ? 'Track and record collections' : 'Track amounts owed by each customer and record collections'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, width: isMobile ? '100%' : 'auto' }}>
          {activeTab === 'customer' && (
          <Input
            placeholder="Search customer..."
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ borderRadius: 10, width: isMobile ? '100%' : 220 }}
            allowClear
          />
          )}
          {activeTab === 'customer' && (
          <Select
            placeholder="All routes"
            allowClear
            value={routeFilter}
            onChange={(v) => { setRouteFilter(v); setPlaceFilter(undefined); }}
            style={{ borderRadius: 10, width: isMobile ? '100%' : 170 }}
            options={routes.map((r: any) => ({ value: r.id, label: r.name }))}
          />
          )}
          {activeTab === 'customer' && routeFilter && (
          <Select
            placeholder="All stops"
            allowClear
            value={placeFilter}
            onChange={setPlaceFilter}
            style={{ borderRadius: 10, width: isMobile ? '100%' : 170 }}
            options={getPlacesForRoute(routeFilter).map((p: any) => ({ value: p.id, label: p.name }))}
          />
          )}
          {!isMobile && activeTab === 'customer' && (
            <Button
              type="primary"
              icon={<FileExcelOutlined />}
              disabled={summaries.length === 0}
              onClick={() => exportToXLSX(
                [
                  ...summaries.map((s: any) => ({
                    customer: s.businessName,
                    owner: s.ownerName,
                    phone: s.phone,
                    route: s.routeName,
                    ordered: s.totalOrdered,
                    paid: s.totalPaid,
                    outstanding: s.outstanding,
                    daysOutstanding: s.oldestUnpaidOrderDate ? dayjs().diff(dayjs(s.oldestUnpaidOrderDate), 'day') : '',
                    lastOrder: s.lastOrderDate ? dayjs(s.lastOrderDate).format('DD MMM YYYY') : '',
                    lastPayment: s.lastPaymentDate ? dayjs(s.lastPaymentDate).format('DD MMM YYYY') : '',
                  })),
                  { customer: 'TOTAL', owner: '', phone: '', route: '', ordered: '', paid: '', outstanding: totalOutstanding, daysOutstanding: '', lastOrder: '', lastPayment: '' },
                ],
                [
                  { title: 'Customer', key: 'customer', dataIndex: 'customer' },
                  { title: 'Owner', key: 'owner', dataIndex: 'owner' },
                  { title: 'Phone', key: 'phone', dataIndex: 'phone' },
                  { title: 'Route', key: 'route', dataIndex: 'route' },
                  { title: 'Total Ordered', key: 'ordered', dataIndex: 'ordered' },
                  { title: 'Total Paid', key: 'paid', dataIndex: 'paid' },
                  { title: 'Outstanding', key: 'outstanding', dataIndex: 'outstanding' },
                  { title: 'Days Outstanding', key: 'daysOutstanding', dataIndex: 'daysOutstanding' },
                  { title: 'Last Order', key: 'lastOrder', dataIndex: 'lastOrder' },
                  { title: 'Last Payment', key: 'lastPayment', dataIndex: 'lastPayment' },
                ],
                `customer-outstanding-${dayjs().format('YYYY-MM-DD')}`
              )}
              style={{ borderRadius: 10, height: 40, fontWeight: 700, background: '#059669' }}
            >
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {[
          { key: 'customer', label: 'By Customer', icon: <UserOutlined /> },
          { key: 'salesman', label: 'By Salesman', icon: <TeamOutlined /> },
          { key: 'route', label: 'By Route', icon: <EnvironmentOutlined /> },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
              background: activeTab === tab.key ? '#fff' : 'transparent',
              color: activeTab === tab.key ? '#0f172a' : '#64748b',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'salesman' && <SalesmanOutstandingView />}

      {activeTab === 'route' && <RouteOutstandingView />}

      {activeTab === 'customer' && !summaryLoading && allSummaries.length > 0 && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Outstanding', value: formatINR(totalOutstanding), color: '#dc2626' },
            { label: 'Customers', value: `${allSummaries.length}`, color: '#0f172a' },
          ].map(stat => (
            <div key={stat.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>{stat.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'customer' && <div style={{
        display: 'grid',
        gridTemplateColumns: shouldShowDetail && !isMobile ? '6fr 6fr' : '1fr',
        gap: 20,
        alignItems: 'start',
      }}>

        {/* Customer List — always left, always full remaining width */}
        {shouldShowList && (
          <div style={tableContainerStyle}>
            <div style={tableHeaderStyle}>
              {isLargeDesktop ? (
                ['Customer', 'Ordered', 'Paid', 'Outstanding'].map(h => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
                ))
              ) : (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>Customer</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'right' }}>Outstanding</div>
                </>
              )}
            </div>
            {summaryLoading ? (
              <div style={{ padding: 20 }}><Skeleton active paragraph={{ rows: 5 }} /></div>
            ) : summaries.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>No outstanding balances</div>
            ) : summaries.map((s: any, i: number) => {
              const isSelected = s.customerId === selectedCustomerId;
              return (
                <div key={s.customerId} onClick={() => {
                  setSelectedCustomerId(isSelected && !isMobile ? null : s.customerId);
                  if (!isSelected) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                }}
                  style={{ ...tableRowStyle(isSelected), borderBottom: i < summaries.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: isSelected ? '#fff' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#475569', fontSize: 13, flexShrink: 0 }}>
                      {s.businessName?.[0]}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, wordBreak: 'break-word' }}>{s.businessName}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{s.routeName}</div>
                    </div>
                  </div>
                  {isLargeDesktop ? (
                    <>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{formatINR(s.totalOrdered)}</div>
                      <div style={{ fontWeight: 600, color: '#059669', fontSize: 13 }}>{formatINR(s.totalPaid)}</div>
                      <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 13 }}>{formatINR(s.outstanding)}</div>
                    </>
                  ) : (
                    <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 13, textAlign: 'right' }}>{formatINR(s.outstanding)}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Detail Panel — fixed 440px on the right */}
        {shouldShowDetail && (
          <div ref={detailRef} style={{ display: 'flex', flexDirection: 'column', gap: 16, scrollMarginTop: 80 }}>
            {selected && (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{selected.businessName}</div>
                    <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                      {selected.ownerName} · {selected.phone}
                      {selected.lastPaymentDate && <div style={{ marginTop: 2 }}>Last paid: {dayjs(selected.lastPaymentDate).format('DD MMM YYYY')}</div>}
                    </div>
                    <Button
                      size="small" type="link" icon={<ProfileOutlined />} style={{ padding: 0, marginTop: 6, height: 'auto' }}
                      onClick={() => navigate(`/reports/ledger?tab=history&customerId=${selected.customerId}`)}
                    >
                      View Full Ledger
                    </Button>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    {[
                      { label: 'Ordered', value: formatINR(selected.totalOrdered), color: '#0f172a' },
                      { label: 'Paid', value: formatINR(selected.totalPaid), color: '#059669' },
                      { label: 'Due', value: formatINR(selected.outstanding), color: '#dc2626' },
                    ].map(stat => (
                      <div key={stat.label} style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: stat.color, marginTop: 2 }}>{stat.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, marginLeft: 4 }}>Unpaid Orders</div>
            {ordersLoading ? <Skeleton active paragraph={{ rows: 3 }} /> : (
              <div style={{ ...tableContainerStyle, overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr 65px 120px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '10px 14px', minWidth: 460 }}>
                  {['Date', 'Order', 'Total', 'Balance', 'Days', ''].map(h => (
                    <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
                  ))}
                </div>
                {unpaidOrders.length === 0 ? (
                  <div style={{ padding: '24px 14px', textAlign: 'center', color: '#94a3b8' }}>No unpaid orders</div>
                ) : unpaidOrders.map((o: any, i: number) => {
                  const days = dayjs().diff(dayjs(o.orderDate), 'day');
                  const daysColor = days > 30 ? '#dc2626' : days > 15 ? '#d97706' : '#64748b';
                  return (
                    <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr 65px 120px', padding: '11px 14px', alignItems: 'center', borderBottom: i < unpaidOrders.length - 1 ? '1px solid #f1f5f9' : 'none', minWidth: 460 }}>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{dayjs(o.orderDate).format('DD MMM YYYY')}</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 12 }}>{o.orderNumber}</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 12 }}>{formatINR(o.totalAmount)}</div>
                      <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 12 }}>{formatINR(o.balanceAmount)}</div>
                      <div style={{ fontWeight: 700, color: daysColor, fontSize: 12 }}>{days === 0 ? 'Today' : `${days}d`}</div>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                        {canRecordPayment && (
                          <Button type="primary" size="small" icon={<WalletOutlined />} onClick={() => openCollect(o)}
                            style={{ borderRadius: 7, fontSize: 11, fontWeight: 700, background: '#059669', padding: '0 8px' }}>
                            Collect
                          </Button>
                        )}
                        <div style={{ width: 28, display: 'flex', justifyContent: 'center' }}>
                          {o.openingBalance && canDeleteOpeningBalance && (
                            <Popconfirm
                              title="Delete this opening balance entry?"
                              description="This removes it permanently and reduces the customer's outstanding."
                              onConfirm={() => handleDeleteOpeningBalance(o.id)}
                              okText="Delete" okButtonProps={{ danger: true }}
                              placement="topRight"
                            >
                              <Button danger size="small" icon={<DeleteOutlined />} style={{ borderRadius: 7, padding: '0 8px' }} />
                            </Popconfirm>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, marginTop: 4, marginLeft: 4 }}>Payment History</div>
            {historyLoading ? <Skeleton active paragraph={{ rows: 3 }} /> : (
              <div style={{ ...tableContainerStyle, overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.4fr 1.6fr 1fr 40px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '10px 14px', minWidth: 0 }}>
                  {['Date', 'Amount', 'Method', 'Order', 'Status', ''].map(h => (
                    <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
                  ))}
                </div>
                {paymentHistory.length === 0 ? (
                  <div style={{ padding: '24px 14px', textAlign: 'center', color: '#94a3b8' }}>No payments recorded</div>
                ) : paymentHistory.slice().reverse().map((p: any, i: number) => (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.4fr 1.6fr 1fr 40px', padding: '10px 14px', alignItems: 'center', borderBottom: i < paymentHistory.length - 1 ? '1px solid #f1f5f9' : 'none', minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{dayjs(p.collectionDate).format('DD MMM YYYY')}</div>
                    <div style={{ fontWeight: 800, color: '#059669', fontSize: 12 }}>{formatINR(p.amount)}</div>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${MODE_COLOR[p.paymentMode] || '#6b7280'}18`, color: MODE_COLOR[p.paymentMode] || '#6b7280' }}>
                        {p.paymentMethodName || p.paymentMode}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#475569' }}>{p.order?.orderNumber}</div>
                    <div style={{ fontSize: 11, color: p.cleared ? '#059669' : p.submitted ? '#0891b2' : '#d97706', fontWeight: 700 }}>
                      {p.cleared ? 'Cleared' : p.submitted ? 'Submitted' : 'Pending'}
                    </div>
                    <div>{Number(p.amount) > 0 && <PaymentActions payment={p} />}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>}

      {activeTab === 'customer' && <Modal
        title={
          <div style={{ paddingBottom: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#0f172a' }}>Collect Payment</div>
            {selectedOrder && (
              <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 500, marginTop: 4 }}>
                Order #{selectedOrder.orderNumber} · {selectedOrder.customerName || selected?.businessName}
              </div>
            )}
          </div>
        }
        open={collectModal}
        onOk={handleCollect}
        onCancel={() => setCollectModal(false)}
        confirmLoading={collecting}
        okText={isPartial ? 'Record Partial' : 'Record Payment'}
        okButtonProps={{ style: { background: isPartial ? '#d97706' : '#059669', borderColor: isPartial ? '#d97706' : '#059669', fontWeight: 800, height: 42, borderRadius: 10 } }}
        cancelButtonProps={{ style: { height: 42, borderRadius: 10, fontWeight: 600 } }}
        width={460}
        centered
      >
        {selectedOrder && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
              {[
                { label: 'Order Total', value: formatINR(selectedOrder.totalAmount), color: '#0f172a' },
                { label: 'Paid So Far', value: formatINR(selectedOrder.paidAmount || 0), color: '#059669' },
                { label: 'Balance Due', value: formatINR(selectedOrder.balanceAmount), color: '#dc2626' },
              ].map(col => (
                <div key={col.label} style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 10px', textAlign: 'center', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, marginBottom: 5, textTransform: 'uppercase' }}>{col.label}</div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: col.color }}>{col.value}</div>
                </div>
              ))}
            </div>

            <Form form={form} layout="vertical" requiredMark={false}>
              <Form.Item name="amount" label={<span style={{ fontWeight: 700, color: '#475569' }}>Amount to Collect</span>}
                rules={[
                  { required: true, message: 'Please enter amount' },
                  { type: 'number', min: 0.01, message: 'Must be greater than zero' },
                  { validator: (_, v) => v && v > (selectedOrder?.balanceAmount || 0) ? Promise.reject('Cannot exceed balance') : Promise.resolve() },
                ]}
              >
                <InputNumber style={{ width: '100%' }} min={0.01} precision={2} prefix="₹" placeholder="0.00" size="large" controls={false} />
              </Form.Item>

              {isPartial && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 12.5, color: '#92400e', fontWeight: 500 }}>
                  Partial Payment — {formatINR((selectedOrder.balanceAmount - (collectAmount || 0)))} will remain due.
                </div>
              )}

              <Form.Item name="paymentMethodId" label={<span style={{ fontWeight: 700, color: '#475569' }}>Payment Method</span>} rules={[{ required: true, message: 'Please select a method' }]}>
                <Select size="large" placeholder="Select payment method" style={{ borderRadius: 10 }}>
                  {methods.map((m: any) => (
                    <Select.Option key={m.id} value={m.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: MODE_COLOR[m.mode] || '#6b7280', display: 'inline-block' }} />
                        <span style={{ fontWeight: 600 }}>{m.name}</span>
                        <span style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase' }}>{m.mode}</span>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              {needsRef && (
                <Form.Item name="referenceNumber" label={<span style={{ fontWeight: 700, color: '#475569' }}>Reference Number</span>} rules={[{ required: true, message: 'Please enter reference' }]}>
                  <Input size="large" placeholder="Transaction ID / UTR" />
                </Form.Item>
              )}

              <Form.Item name="collectionDate"
                label={<span style={{ fontWeight: 700, color: '#475569' }}>Collection Date</span>}
                extra="Back-date if this payment was collected on an earlier day"
                rules={[{ required: true, message: 'Please pick the collection date' }]}>
                <DatePicker size="large" style={{ width: '100%' }} format="DD MMM YYYY" allowClear={false}
                  disabledDate={(d) => d && d.isAfter(dayjs(), 'day')} />
              </Form.Item>

              <Form.Item name="notes" label={<span style={{ fontWeight: 700, color: '#475569' }}>Notes (Optional)</span>} style={{ marginBottom: 0 }}>
                <Input.TextArea rows={2} placeholder="Any additional details..." style={{ borderRadius: 10 }} />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>}
    </div>
  );
};

export default CustomerOutstandingPage;
