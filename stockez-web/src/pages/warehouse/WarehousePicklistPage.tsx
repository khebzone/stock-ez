import React, { useState } from 'react';
import {
  DatePicker, Table, Spin, message, Popconfirm, Grid, Tag, Button,
} from 'antd';
import {
  CheckCircleOutlined, PlayCircleOutlined, ArrowLeftOutlined,
  EnvironmentOutlined, InboxOutlined, DownloadOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import {
  useGetRoutePicklistQuery,
  useRouteStartPreparingMutation,
  useRouteMarkPreparedMutation,
} from '../../store/api/orderApi';
import PageHeader from '../../components/PageHeader';

const { useBreakpoint } = Grid;

const STATUS_COLOR: Record<string, { color: string; bg: string; label: string }> = {
  APPROVED:  { color: '#059669', bg: '#ecfdf5',  label: 'Approved'  },
  PREPARING: { color: '#f97316', bg: '#fff7ed',  label: 'Preparing' },
  PREPARED:  { color: '#06b6d4', bg: '#ecfeff',  label: 'Prepared'  },
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS_COLOR[status] || { color: '#6b7280', bg: '#f3f4f6', label: status };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700,
      padding: '2px 8px', borderRadius: 12, border: `1px solid ${cfg.color}30`,
    }}>
      {cfg.label}
    </span>
  );
};

function buildRouteHtml(route: any, date: string): string {
  const dateLabel = dayjs(date).format('DD MMM YYYY');
  const pickRows = (route.pickList || []).map((item: any) => `
    <tr>
      <td>
        <div style="font-weight:600">${item.productName}</div>
        ${item.brand ? `<div style="font-size:10px;color:#888">${item.brand}</div>` : ''}
      </td>
      <td>${item.unit || ''}</td>
      <td class="right qty">${item.totalQuantity}</td>
      <td style="font-size:10px;color:#555">
        ${(item.breakdown || []).map((b: any) =>
          `${b.businessName}: <strong>${b.quantity}</strong> <span style="color:#aaa">(${b.orderNumber})</span>`
        ).join('<br/>')}
      </td>
    </tr>`).join('');

  const orderRows = (route.orders || []).map((o: any) => `
    <tr>
      <td style="font-family:monospace;font-size:11px">${o.orderNumber}</td>
      <td>${o.customerName}</td>
      <td class="right">${o.itemCount}</td>
      <td class="right">&#8377;${Number(o.totalAmount || 0).toFixed(2)}</td>
      <td>${o.status}</td>
    </tr>`).join('');

  return `
    <div class="route-block">
      <div class="route-title">${route.routeName}</div>
      <div class="route-meta">${dateLabel} &nbsp;·&nbsp; ${route.totalOrders} order${route.totalOrders !== 1 ? 's' : ''} &nbsp;·&nbsp; ${route.pickList?.length || 0} products</div>

      <div class="section-label">Consolidated Pick List</div>
      <table>
        <thead>
          <tr>
            <th>Product</th><th>Unit</th><th class="right">Total Qty</th><th>Order Breakdown</th>
          </tr>
        </thead>
        <tbody>${pickRows}</tbody>
      </table>

      <div class="section-label" style="margin-top:16px">Orders (${route.totalOrders})</div>
      <table>
        <thead>
          <tr>
            <th>Order #</th><th>Customer</th><th class="right">Items</th><th class="right">Amount</th><th>Status</th>
          </tr>
        </thead>
        <tbody>${orderRows}</tbody>
      </table>
    </div>`;
}

function buildFullHtml(routes: any[], date: string, title: string): string {
  const dateLabel = dayjs(date).format('DD MMM YYYY');
  const body = routes.map(r => buildRouteHtml(r, date)).join('<div class="page-break"></div>');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title} — ${dateLabel}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:Arial,sans-serif; font-size:12px; color:#111; padding:20px 24px; }
    h1 { font-size:16px; font-weight:800; margin-bottom:2px; }
    .doc-meta { font-size:11px; color:#555; margin-bottom:18px; }
    .route-block { margin-bottom:24px; }
    .route-title { font-size:15px; font-weight:800; color:#000; margin-bottom:2px; }
    .route-meta { font-size:11px; color:#555; margin-bottom:10px; }
    .section-label { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px;
                     color:#555; margin:12px 0 5px; border-bottom:1px solid #ccc; padding-bottom:3px; }
    table { width:100%; border-collapse:collapse; margin-bottom:6px; }
    th { background:#f5f5f5; text-align:left; padding:5px 8px; font-size:10px; border:1px solid #ccc; }
    td { padding:4px 8px; border:1px solid #ddd; vertical-align:top; font-size:11px; }
    .right { text-align:right; }
    .qty { font-weight:800; font-size:14px; }
    .page-break { page-break-after:always; }
    @media print {
      body { padding:8px; }
      .page-break { page-break-after:always; }
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="doc-meta">${dateLabel} &nbsp;·&nbsp; ${routes.length} route${routes.length !== 1 ? 's' : ''} &nbsp;·&nbsp; ${routes.reduce((s: number, r: any) => s + (r.totalOrders || 0), 0)} orders</div>
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

const WarehousePicklistPage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [date, setDate]                   = useState<Dayjs>(dayjs());
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [showDetail, setShowDetail]       = useState(false);

  const dateStr = date.format('YYYY-MM-DD');

  const { data, isLoading, refetch } = useGetRoutePicklistQuery(dateStr);
  const [routeStartPreparing, { isLoading: starting }] = useRouteStartPreparingMutation();
  const [routeMarkPrepared,   { isLoading: marking  }] = useRouteMarkPreparedMutation();

  const routes: any[] = data?.data || [];
  const selected = routes.find(r => r.routeId === selectedRouteId);

  const handleStartPreparing = async () => {
    if (!selectedRouteId) return;
    try {
      await routeStartPreparing({ routeId: selectedRouteId, date: dateStr }).unwrap();
      message.success('Preparation started for all approved orders');
      refetch();
    } catch {
      message.error('Failed to start preparation');
    }
  };

  const handleMarkPrepared = async () => {
    if (!selectedRouteId) return;
    try {
      await routeMarkPrepared({ routeId: selectedRouteId, date: dateStr }).unwrap();
      message.success('All orders marked as prepared');
      refetch();
    } catch {
      message.error('Failed to mark as prepared');
    }
  };

  const handleDownloadRoute = () => {
    if (!selected) return;
    const html = buildFullHtml([selected], dateStr, `Pick List — ${selected.routeName}`);
    downloadHtml(html, `picklist-${selected.routeName.replace(/\s+/g, '-')}-${dateStr}.html`);
  };

  const handleDownloadAll = () => {
    if (!routes.length) return;
    const html = buildFullHtml(routes, dateStr, 'Pick List — All Routes');
    downloadHtml(html, `picklist-all-routes-${dateStr}.html`);
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

  const orderColumns = [
    {
      title: 'Order #',
      dataIndex: 'orderNumber',
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
    { title: 'Customer', dataIndex: 'customerName', ellipsis: true },
    { title: 'Items', dataIndex: 'itemCount', width: 60, align: 'right' as const },
    {
      title: 'Total',
      dataIndex: 'totalAmount',
      width: 100,
      align: 'right' as const,
      render: (v: number) => `₹${Number(v || 0).toFixed(2)}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (s: string) => <StatusBadge status={s} />,
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
              {selected.approvedCount  > 0 && <Tag color="green">{selected.approvedCount} Approved</Tag>}
              {selected.preparingCount > 0 && <Tag color="orange">{selected.preparingCount} Preparing</Tag>}
              {selected.preparedCount  > 0 && <Tag color="cyan">{selected.preparedCount} Prepared</Tag>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button icon={<DownloadOutlined />} onClick={handleDownloadRoute}>
              Download
            </Button>
            {selected.approvedCount > 0 && (
              <Popconfirm
                title={`Start preparing ${selected.approvedCount} approved order(s) for ${selected.routeName}?`}
                onConfirm={handleStartPreparing}
                okText="Start"
              >
                <Button
                  loading={starting}
                  style={{ background: '#f97316', borderColor: '#f97316', color: '#fff' }}
                  icon={<PlayCircleOutlined />}
                >
                  Start Preparing
                </Button>
              </Popconfirm>
            )}
            {selected.preparingCount > 0 && (
              <Popconfirm
                title={`Mark all ${selected.preparingCount} preparing order(s) as prepared?`}
                onConfirm={handleMarkPrepared}
                okText="Confirm"
              >
                <Button
                  loading={marking}
                  style={{ background: '#06b6d4', borderColor: '#06b6d4', color: '#fff' }}
                  icon={<CheckCircleOutlined />}
                >
                  Mark All Prepared
                </Button>
              </Popconfirm>
            )}
          </div>
        </div>
      </div>

      {/* Consolidated Pick List */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Pick List — {selected.pickList?.length || 0} Products
          </span>
        </div>
        <Table
          dataSource={selected.pickList || []}
          columns={pickListColumns}
          rowKey="productId"
          size="small"
          pagination={false}
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
      </div>

      {/* Orders Table */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Orders ({selected.totalOrders})
          </span>
        </div>
        <Table
          dataSource={selected.orders || []}
          columns={orderColumns}
          rowKey="orderId"
          size="small"
          pagination={false}
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
        title="Warehouse Pick List"
        subtitle="Consolidated route-wise picking for warehouse preparation"
      />
      <div style={{ padding: '0 24px 24px' }}>

        {/* Date selector + Download All */}
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <DatePicker
            value={date}
            onChange={d => { if (d) { setDate(d); setSelectedRouteId(null); } }}
            format="DD MMM YYYY"
            allowClear={false}
            style={{ width: 180 }}
          />
          {routes.length > 0 && (
            <Button
              icon={<DownloadOutlined />}
              onClick={handleDownloadAll}
            >
              Download All Routes
            </Button>
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
                  <div style={{ fontSize: 13 }}>No routes with pending orders on this date</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {routes.map(route => {
                    const isSelected = route.routeId === selectedRouteId;
                    const allDone = route.approvedCount === 0 && route.preparingCount === 0;
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
                          {route.approvedCount  > 0 && <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>{route.approvedCount} approved</span>}
                          {route.preparingCount > 0 && <span style={{ fontSize: 11, color: '#f97316', fontWeight: 600 }}>{route.preparingCount} preparing</span>}
                          {route.preparedCount  > 0 && <span style={{ fontSize: 11, color: '#06b6d4', fontWeight: 600 }}>{route.preparedCount} prepared</span>}
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
