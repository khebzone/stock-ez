import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  DatePicker, Table, Spin, message, Popconfirm, Grid, Tag, Button, Tabs, Segmented,
} from 'antd';
import {
  CheckCircleOutlined, PlayCircleOutlined, ArrowLeftOutlined,
  EnvironmentOutlined, InboxOutlined, DownloadOutlined, PrinterOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { noFutureDates } from '../../utils/date';
import {
  useGetRoutePicklistQuery,
  useGetRoutePicklistHistoryQuery,
  useGetMyWarehouseTasksQuery,
  useRouteStartPackingMutation,
  useRouteMarkPackedMutation,
} from '../../store/api/orderApi';
import { useGetCompanyProfileQuery } from '../../store/api/tenantApi';
import PageHeader from '../../components/PageHeader';
import { isAdmin, hasPermission } from '../../utils/permissions';

const { useBreakpoint } = Grid;


function buildRouteHtml(route: any, date: string): string {
  const dateLabel = dayjs(date).format('DD MMM YYYY');
  const pickRows = (route.pickList || []).map((item: any, idx: number) => `
    <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
      <td class="sno">${idx + 1}</td>
      <td>
        <div class="prod-name">${item.productName}</div>
        ${item.brand ? `<div class="prod-brand">${item.brand}</div>` : ''}
      </td>
      <td class="center">${item.unit || ''}</td>
      <td class="right qty">${item.totalQuantity}</td>
      <td class="center pick-cell">&#9633;</td>
    </tr>`).join('');

  return `
    <div class="route-block">
      <div class="route-header">
        <div>
          <span class="route-title">${route.routeName}</span>
          <span class="route-meta">&nbsp;&nbsp;${dateLabel} &nbsp;·&nbsp; ${route.totalOrders} order${route.totalOrders !== 1 ? 's' : ''} &nbsp;·&nbsp; ${route.pickList?.length || 0} products</span>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:36px">#</th>
            <th>Product</th>
            <th class="center" style="width:64px">Unit</th>
            <th class="right" style="width:80px">Total Qty</th>
            <th class="center" style="width:60px">Pick &#10003;</th>
          </tr>
        </thead>
        <tbody>${pickRows}</tbody>
      </table>
      <div class="footer-sign">
        <span>Picked by: ___________________________</span>
        <span>Checked by: ___________________________</span>
        <span>Time: _______________</span>
      </div>
    </div>`;
}

function buildCustomerChecklistHtml(routes: any[], date: string, title: string, company?: any): string {
  const dateLabel = dayjs(date).format('DD MMM YYYY');

  const companyName = company?.name || '';
  const companyPhone = company?.phone ? `Ph: ${company.phone}` : '';
  const companyGstin = company?.gstin ? `GSTIN: ${company.gstin}` : '';
  const companyAddr = [company?.address, company?.city, company?.state, company?.pinCode].filter(Boolean).join(', ');
  const companyMeta = [companyPhone, companyGstin].filter(Boolean).join('&nbsp;&nbsp;|&nbsp;&nbsp;');

  const routeBlocks = routes.map(route => {
    const orderMap: Record<string, { businessName: string; orderNumber: string; totalAmount: number; status: string; items: { productName: string; brand: string; unit: string; quantity: number }[] }> = {};

    for (const pickItem of route.pickList || []) {
      for (const b of pickItem.breakdown || []) {
        if (!orderMap[b.orderNumber]) {
          orderMap[b.orderNumber] = { businessName: b.businessName, orderNumber: b.orderNumber, totalAmount: 0, status: '', items: [] };
        }
        orderMap[b.orderNumber].items.push({ productName: pickItem.productName, brand: pickItem.brand, unit: pickItem.unit || '', quantity: b.quantity });
      }
    }
    for (const o of route.orders || []) {
      if (orderMap[o.orderNumber]) {
        orderMap[o.orderNumber].totalAmount = o.totalAmount || 0;
        orderMap[o.orderNumber].status = o.status || '';
      }
    }

    const customerBlocks = Object.values(orderMap).map(order => {
      const rows = order.items.map(item => `
        <tr>
          <td><div style="font-weight:600">${item.productName}</div>${item.brand ? `<div style="font-size:10px;color:#888">${item.brand}</div>` : ''}</td>
          <td>${item.unit}</td>
          <td class="right qty">${item.quantity}</td>
        </tr>`).join('');
      return `
        <div class="cust-block">
          <div class="cust-header">
            <div class="cust-name">${order.businessName}</div>
            <div class="cust-meta">${order.orderNumber} &nbsp;·&nbsp; &#8377;${Number(order.totalAmount).toFixed(2)} &nbsp;·&nbsp; ${order.status}</div>
          </div>
          <table><thead><tr><th>Product</th><th>Unit</th><th class="right">Qty</th></tr></thead><tbody>${rows}</tbody></table>
        </div>`;
    }).join('');

    return `<div class="route-label">${route.routeName}</div>${customerBlocks}`;
  }).join('<div class="page-break"></div>');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title} — ${dateLabel}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:Arial,sans-serif; font-size:12px; color:#111; padding:16px 20px; }
    .company-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #1e3a5f; padding-bottom:10px; margin-bottom:14px; }
    .company-name { font-size:18px; font-weight:800; color:#1e3a5f; }
    .company-addr { font-size:10px; color:#555; margin-top:2px; }
    .company-meta { font-size:10px; color:#555; margin-top:1px; }
    .doc-right { text-align:right; }
    .doc-title { font-size:14px; font-weight:800; color:#1e3a5f; text-transform:uppercase; letter-spacing:1px; }
    .doc-date  { font-size:11px; color:#555; margin-top:3px; }
    .route-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#1e3a5f; border-bottom:2px solid #1e3a5f; padding-bottom:4px; margin:16px 0 10px; }
    .cust-block { margin-bottom:14px; border:1px solid #c8d6e5; border-radius:4px; overflow:hidden; }
    .cust-header { background:#f0f4f8; padding:7px 10px; border-bottom:1px solid #c8d6e5; display:flex; justify-content:space-between; align-items:center; }
    .cust-name { font-weight:800; font-size:13px; color:#1e3a5f; }
    .cust-meta { font-size:10px; color:#555; }
    table { width:100%; border-collapse:collapse; }
    th { background:#fafbfc; text-align:left; padding:5px 8px; font-size:10px; font-weight:700; color:#1e3a5f; border-bottom:1px solid #dde4ec; text-transform:uppercase; letter-spacing:0.4px; }
    td { padding:5px 8px; border-bottom:1px solid #f0f0f0; vertical-align:top; font-size:11px; }
    tr:last-child td { border-bottom:none; }
    .right { text-align:right; }
    .qty { font-weight:800; font-size:14px; color:#1e3a5f; }
    .page-break { page-break-after:always; height:0; }
    @media print { body { padding:8px 10px; } .page-break { page-break-after:always; } }
  </style>
</head>
<body>
  <div class="company-header">
    <div>
      <div class="company-name">${companyName}</div>
      ${companyAddr ? `<div class="company-addr">${companyAddr}</div>` : ''}
      ${companyMeta ? `<div class="company-meta">${companyMeta}</div>` : ''}
    </div>
    <div class="doc-right">
      <div class="doc-title">Customer Checklist</div>
      <div class="doc-date">${dateLabel}</div>
    </div>
  </div>
  ${routeBlocks}
  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}

function buildFullHtml(routes: any[], date: string, title: string, company?: any): string {
  const dateLabel = dayjs(date).format('DD MMM YYYY');
  const totalOrders = routes.reduce((s: number, r: any) => s + (r.totalOrders || 0), 0);
  const body = routes.map(r => buildRouteHtml(r, date)).join('<div class="page-break"></div>');

  const companyName = company?.name || '';
  const companyPhone = company?.phone ? `Ph: ${company.phone}` : '';
  const companyGstin = company?.gstin ? `GSTIN: ${company.gstin}` : '';
  const companyAddr = [company?.address, company?.city, company?.state, company?.pinCode].filter(Boolean).join(', ');
  const companyMeta = [companyPhone, companyGstin].filter(Boolean).join('&nbsp;&nbsp;|&nbsp;&nbsp;');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title} — ${dateLabel}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:Arial,sans-serif; font-size:12px; color:#111; padding:16px 20px; }

    /* Company header */
    .company-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #1e3a5f; padding-bottom:10px; margin-bottom:14px; }
    .company-left .company-name { font-size:18px; font-weight:800; color:#1e3a5f; letter-spacing:-0.3px; }
    .company-left .company-addr { font-size:10px; color:#555; margin-top:2px; }
    .company-left .company-meta { font-size:10px; color:#555; margin-top:1px; }
    .company-right { text-align:right; }
    .company-right .doc-title { font-size:14px; font-weight:800; color:#1e3a5f; text-transform:uppercase; letter-spacing:1px; }
    .company-right .doc-date { font-size:11px; color:#555; margin-top:3px; }
    .company-right .doc-summary { font-size:10px; color:#888; margin-top:2px; }

    /* Route block */
    .route-block { margin-bottom:20px; }
    .route-header { background:#1e3a5f; color:#fff; padding:7px 10px; border-radius:3px 3px 0 0; margin-bottom:0; display:flex; align-items:baseline; }
    .route-title { font-size:13px; font-weight:800; color:#fff; }
    .route-meta { font-size:10px; color:#a8c0d6; }

    /* Table */
    table { width:100%; border-collapse:collapse; }
    th { background:#f0f4f8; text-align:left; padding:6px 8px; font-size:10px; font-weight:700; color:#1e3a5f; border:1px solid #c8d6e5; text-transform:uppercase; letter-spacing:0.4px; }
    td { padding:5px 8px; border:1px solid #dde4ec; vertical-align:middle; font-size:11px; }
    .row-even { background:#fff; }
    .row-odd  { background:#f8fafc; }
    .sno { color:#94a3b8; font-size:10px; text-align:center; width:28px; }
    .prod-name { font-weight:600; color:#111; }
    .prod-brand { font-size:10px; color:#888; margin-top:1px; }
    .center { text-align:center; }
    .right { text-align:right; }
    .qty { font-weight:800; font-size:15px; color:#1e3a5f; }
    .pick-cell { font-size:16px; color:#ccc; }

    /* Footer signature */
    .footer-sign { display:flex; justify-content:space-between; margin-top:10px; padding-top:8px; border-top:1px dashed #ccc; font-size:10px; color:#555; }

    /* Page break */
    .page-break { page-break-after:always; height:0; }

    @media print {
      body { padding:8px 10px; }
      .page-break { page-break-after:always; }
    }
  </style>
</head>
<body>
  <div class="company-header">
    <div class="company-left">
      <div class="company-name">${companyName}</div>
      ${companyAddr ? `<div class="company-addr">${companyAddr}</div>` : ''}
      ${companyMeta ? `<div class="company-meta">${companyMeta}</div>` : ''}
    </div>
    <div class="company-right">
      <div class="doc-title">Pick List</div>
      <div class="doc-date">${dateLabel}</div>
      <div class="doc-summary">${routes.length} route${routes.length !== 1 ? 's' : ''} &nbsp;·&nbsp; ${totalOrders} order${totalOrders !== 1 ? 's' : ''}</div>
    </div>
  </div>
  ${body}
  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}

function downloadHtml(html: string, filename: string) {
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

function printHtml(html: string) {
  const win = window.open('', '_blank');
  if (!win) { return; }
  win.document.write(html);
  win.document.close();
}

const WarehousePicklistPage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const location = useLocation();
  const isMyTasksView = location.pathname === '/warehouse/my-tasks';

  const [date, setDate]                   = useState<Dayjs>(dayjs());
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [showDetail, setShowDetail]       = useState(false);
  const [viewMode, setViewMode]           = useState<'live' | 'history'>('live');
  const isHistoryView = !isMyTasksView && viewMode === 'history';

  const dateStr = date.format('YYYY-MM-DD');

  const picklistResult    = useGetRoutePicklistQuery(dateStr,        { refetchOnMountOrArgChange: true, skip: isMyTasksView || isHistoryView });
  const historyResult     = useGetRoutePicklistHistoryQuery(dateStr, { refetchOnMountOrArgChange: true, skip: !isHistoryView });
  const myTasksResult     = useGetMyWarehouseTasksQuery(dateStr,     { refetchOnMountOrArgChange: true, skip: !isMyTasksView });
  const { data, isLoading, refetch } = isMyTasksView ? myTasksResult : (isHistoryView ? historyResult : picklistResult);

  const [routeStartPacking, { isLoading: starting }] = useRouteStartPackingMutation();
  const [routeMarkPacked,     { isLoading: marking  }] = useRouteMarkPackedMutation();
  const { data: profileData } = useGetCompanyProfileQuery();
  const company = profileData?.data;

  const routes: any[] = data?.data || [];
  const selected = routes.find(r => r.routeId === selectedRouteId);

  // Auto-select when exactly one route comes back (My Tasks view — user has one allocation)
  useEffect(() => {
    if (isMyTasksView && routes.length === 1 && !selectedRouteId) {
      setSelectedRouteId(routes[0].routeId);
      setShowDetail(true);
    }
  }, [routes, isMyTasksView, selectedRouteId]);

  const handleStartPacking = async () => {
    if (!selectedRouteId) return;
    try {
      await routeStartPacking({ routeId: selectedRouteId, date: dateStr }).unwrap();
      message.success('Packing started for all approved orders');
      refetch();
    } catch {
      message.error('Failed to start packing');
    }
  };

  const handleMarkPacked = async () => {
    if (!selectedRouteId) return;
    try {
      await routeMarkPacked({ routeId: selectedRouteId, date: dateStr }).unwrap();
      message.success('All orders marked as packed');
      refetch();
    } catch {
      message.error('Failed to mark as packed');
    }
  };

  const handleDownloadRoute = () => {
    if (!selected) return;
    const html = buildFullHtml([selected], dateStr, `Pick List — ${selected.routeName}`, company);
    downloadHtml(html, `picklist-${selected.routeName.replace(/\s+/g, '-')}-${dateStr}.html`);
  };

  const handleDownloadAll = () => {
    if (!routes.length) return;
    const html = buildFullHtml(routes, dateStr, 'Pick List — All Routes', company);
    downloadHtml(html, `picklist-all-routes-${dateStr}.html`);
  };

  const handleDownloadCustomerChecklist = () => {
    if (!selected) return;
    const html = buildCustomerChecklistHtml([selected], dateStr, `Customer Checklist — ${selected.routeName}`, company);
    downloadHtml(html, `customer-checklist-${selected.routeName.replace(/\s+/g, '-')}-${dateStr}.html`);
  };

  const handleDownloadAllCustomerChecklists = () => {
    if (!routes.length) return;
    const html = buildCustomerChecklistHtml(routes, dateStr, 'Customer Checklist — All Routes', company);
    downloadHtml(html, `customer-checklist-all-routes-${dateStr}.html`);
  };

  const handlePrintRoute = () => {
    if (!selected) return;
    printHtml(buildFullHtml([selected], dateStr, `Pick List — ${selected.routeName}`, company));
  };

  const handlePrintAll = () => {
    if (!routes.length) return;
    printHtml(buildFullHtml(routes, dateStr, 'Pick List — All Routes', company));
  };

  const handlePrintCustomerChecklist = () => {
    if (!selected) return;
    printHtml(buildCustomerChecklistHtml([selected], dateStr, `Customer Checklist — ${selected.routeName}`, company));
  };

  const handlePrintAllCustomerChecklists = () => {
    if (!routes.length) return;
    printHtml(buildCustomerChecklistHtml(routes, dateStr, 'Customer Checklist — All Routes', company));
  };

  const pickListColumns = [
    {
      title: 'Product',
      dataIndex: 'productName',
      render: (name: string, row: any) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{name}</div>
          {row.brand && <div style={{ fontSize: 11, color: '#94a3b8' }}>{row.brand}</div>}
        </div>
      ),
    },
    { title: 'Unit', dataIndex: 'unit', width: 70 },
    {
      title: 'Total Qty',
      dataIndex: 'totalQuantity',
      width: 90,
      align: 'right' as const,
      render: (qty: number) => (
        <span style={{ fontWeight: 800, color: '#0f172a', fontSize: 15 }}>{qty}</span>
      ),
    },
  ];


  const detailPanel = selected ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Route header */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', rowGap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <EnvironmentOutlined style={{ color: '#059669' }} />
              <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>{selected.routeName}</span>
              <span style={{ fontSize: 12, color: '#64748b' }}>{dayjs(selected.date).format('DD MMM YYYY')}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {selected.submittedCount > 0 && <Tag color="default">{selected.submittedCount} Awaiting Approval</Tag>}
              {selected.approvedCount  > 0 && <Tag color="green">{selected.approvedCount} Approved</Tag>}
              {selected.packingCount > 0 && <Tag color="orange">{selected.packingCount} Packing</Tag>}
              {selected.packedCount  > 0 && <Tag color="cyan">{selected.packedCount} Packed</Tag>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button icon={<DownloadOutlined />} onClick={handleDownloadRoute}>Pick List</Button>
            <Button icon={<PrinterOutlined />} onClick={handlePrintRoute}>Print Pick List</Button>
            <Button icon={<DownloadOutlined />} onClick={handleDownloadCustomerChecklist}>Customer Checklist</Button>
            <Button icon={<PrinterOutlined />} onClick={handlePrintCustomerChecklist}>Print Checklist</Button>
            {!isHistoryView && selected.approvedCount > 0 && hasPermission('PICKLIST_UPDATE') && (
              <Popconfirm
                title={`Start packing ${selected.approvedCount} approved order(s) for ${selected.routeName}?`}
                onConfirm={handleStartPacking}
                okText="Start"
              >
                <Button
                  loading={starting}
                  style={{ background: '#f97316', borderColor: '#f97316', color: '#fff' }}
                  icon={<PlayCircleOutlined />}
                >
                  Start Packing
                </Button>
              </Popconfirm>
            )}
            {!isHistoryView && selected.packingCount > 0 && hasPermission('PICKLIST_UPDATE') && (
              <Popconfirm
                title={`Mark all ${selected.packingCount} packing order(s) as packed?`}
                onConfirm={handleMarkPacked}
                okText="Confirm"
              >
                <Button
                  loading={marking}
                  style={{ background: '#06b6d4', borderColor: '#06b6d4', color: '#fff' }}
                  icon={<CheckCircleOutlined />}
                >
                  Mark All Packed
                </Button>
              </Popconfirm>
            )}
          </div>
        </div>
      </div>

      {/* Pick List & Customer Orders tabs */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        <Tabs
          defaultActiveKey="picklist"
          size="small"
          style={{ padding: '0 16px' }}
          items={[
            {
              key: 'picklist',
              label: `Pick List (${selected.pickList?.length || 0} products)`,
              children: (
                <Table
                  dataSource={selected.pickList || []}
                  columns={pickListColumns}
                  rowKey="productId"
                  size="small"
                  pagination={false}
                  style={{ marginTop: -8 }}
                  expandable={{
                    expandedRowRender: (record: any) => (
                      <div style={{ padding: '6px 12px 6px 36px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {record.breakdown?.map((b: any) => (
                          <span key={b.customerId + b.orderNumber} style={{
                            fontSize: 12, padding: '3px 10px', borderRadius: 20,
                            background: '#f1f5f9', color: '#334155', fontWeight: 500,
                          }}>
                            {b.businessName}: <strong>{b.quantity}</strong>
                            <span style={{ color: '#94a3b8', marginLeft: 4 }}>({b.orderNumber})</span>
                          </span>
                        ))}
                      </div>
                    ),
                    rowExpandable: (record: any) => record.breakdown?.length > 0,
                  }}
                />
              ),
            },
            {
              key: 'orders',
              label: `Customer Orders (${selected.orders?.length || 0})`,
              children: (
                <Table
                  dataSource={(selected.orders || []).map((o: any, i: number) => ({ ...o, key: i }))}
                  size="small"
                  pagination={false}
                  style={{ marginTop: -8 }}
                  expandable={{
                    expandedRowRender: (record: any) => (
                      <div style={{ padding: '6px 12px 6px 36px' }}>
                        <Table
                          dataSource={(record.items || []).map((it: any, idx: number) => ({ ...it, key: idx }))}
                          size="small"
                          pagination={false}
                          columns={[
                            { title: 'Product', dataIndex: 'productName', render: (v: string, r: any) => <div><div style={{ fontWeight: 600 }}>{v}</div>{r.brand && <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.brand}</div>}</div> },
                            { title: 'Unit', dataIndex: 'unit', width: 70 },
                            { title: 'Qty', dataIndex: 'quantity', width: 70, align: 'right' as const, render: (v: number) => <span style={{ fontWeight: 700 }}>{v}</span> },
                            { title: 'Unit Price', dataIndex: 'unitPrice', width: 100, align: 'right' as const, render: (v: number) => `₹${Number(v || 0).toFixed(2)}` },
                            { title: 'Amount', width: 110, align: 'right' as const, render: (_: any, r: any) => <span style={{ fontWeight: 600 }}>₹{(r.quantity * r.unitPrice).toFixed(2)}</span> },
                          ]}
                        />
                      </div>
                    ),
                    rowExpandable: (record: any) => record.items?.length > 0,
                    expandRowByClick: true,
                  }}
                  columns={[
                    { title: 'Order #', dataIndex: 'orderNumber', width: 150, render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
                    { title: 'Customer', key: 'customer', render: (_: any, r: any) => <div><div style={{ fontWeight: 600, color: '#0f172a' }}>{r.customerName}</div><div style={{ fontSize: 11, color: '#94a3b8' }}>{r.customerPhone}</div></div> },
                    { title: 'Items', dataIndex: 'itemCount', width: 60, align: 'center' as const, render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span> },
                    { title: 'Total', dataIndex: 'totalAmount', width: 120, align: 'right' as const, render: (v: number) => <span style={{ fontWeight: 600 }}>₹{Number(v || 0).toFixed(2)}</span> },
                    { title: 'Status', dataIndex: 'status', width: 120, render: (s: string) => {
                      const colors: Record<string, string> = { SUBMITTED: '#94a3b8', APPROVED: '#059669', PACKING: '#f97316', PACKED: '#06b6d4' };
                      const labels: Record<string, string> = { SUBMITTED: 'Awaiting Approval' };
                      return <span style={{ fontSize: 12, fontWeight: 600, color: colors[s] || '#64748b' }}>{labels[s] || s}</span>;
                    }},
                  ]}
                />
              ),
            },
          ]}
        />
      </div>

    </div>
  ) : (
    <div style={{
      height: '60vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', color: '#94a3b8',
    }}>
      <InboxOutlined style={{ fontSize: 48, marginBottom: 12 }} />
      <div style={{ fontSize: 14, fontWeight: 500 }}>Select a route to view its pick list</div>
    </div>
  );

  if (isMobile && showDetail && selected) {
    return (
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          onClick={() => setShowDetail(false)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#059669', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 0 }}
        >
          <ArrowLeftOutlined /> Back to Routes
        </button>
        {detailPanel}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isMyTasksView ? 'My Tasks' : 'Warehouse Pick List'}
        subtitle={isMyTasksView ? "Your allocated route's outstanding orders" : 'Consolidated route-wise picking for warehouse preparation'}
      />
      <div style={{ padding: '0 24px 24px' }}>

        {/* Date selector + Download All */}
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <DatePicker
            value={date}
            onChange={d => { if (d) { setDate(d); setSelectedRouteId(null); } }}
            format="DD MMM YYYY"
            allowClear={false}
            disabledDate={noFutureDates}
            style={{ width: 180 }}
          />
          {!isMyTasksView && (
            <Segmented
              value={viewMode}
              onChange={v => { setViewMode(v as 'live' | 'history'); setSelectedRouteId(null); }}
              options={[
                { label: 'Live', value: 'live' },
                { label: 'History', value: 'history' },
              ]}
            />
          )}
          {isHistoryView && (
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              Read-only — shows what was picked regardless of current order status
            </span>
          )}
          {routes.length > 0 && (
            <>
              <Button icon={<DownloadOutlined />} onClick={handleDownloadAll}>All Pick Lists</Button>
              <Button icon={<PrinterOutlined />} onClick={handlePrintAll}>Print All Pick Lists</Button>
              <Button icon={<DownloadOutlined />} onClick={handleDownloadAllCustomerChecklists}>All Customer Checklists</Button>
              <Button icon={<PrinterOutlined />} onClick={handlePrintAllCustomerChecklists}>Print All Checklists</Button>
            </>
          )}
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
        ) : (
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

            {/* Left panel — route list */}
            <div style={{ width: isMobile ? '100%' : 280, flexShrink: 0 }}>
              {routes.length === 0 ? (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                  <InboxOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                  <div style={{ fontSize: 13 }}>
                    {isMyTasksView
                      ? 'You are not allocated to any route today. Ask admin to assign you via Warehouse Gate Pass.'
                      : isHistoryView
                        ? 'No orders were picked for any route on this date'
                        : 'No routes with pending orders on this date'}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {routes.map(route => {
                    const isSelected = route.routeId === selectedRouteId;
                    const allDone = route.approvedCount === 0 && route.packingCount === 0;
                    return (
                      <div
                        key={route.routeId}
                        onClick={() => {
                          setSelectedRouteId(route.routeId);
                          if (isMobile) setShowDetail(true);
                        }}
                        style={{
                          background: isSelected ? '#ecfdf5' : '#fff',
                          border: `1px solid ${isSelected ? '#059669' : '#e2e8f0'}`,
                          borderRadius: 8, padding: '12px 14px', cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{route.routeName}</span>
                          {allDone
                            ? <CheckCircleOutlined style={{ color: '#06b6d4' }} />
                            : <EnvironmentOutlined style={{ color: '#059669' }} />}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: '#64748b' }}>{route.totalOrders} orders</span>
                          {route.submittedCount > 0 && <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{route.submittedCount} awaiting approval</span>}
                          {route.approvedCount  > 0 && <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>{route.approvedCount} approved</span>}
                          {route.packingCount > 0 && <span style={{ fontSize: 11, color: '#f97316', fontWeight: 600 }}>{route.packingCount} packing</span>}
                          {route.packedCount  > 0 && <span style={{ fontSize: 11, color: '#06b6d4', fontWeight: 600 }}>{route.packedCount} packed</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right panel — pick list detail */}
            {!isMobile && (
              <div style={{ flex: 1, minWidth: 0 }}>
                {detailPanel}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WarehousePicklistPage;
