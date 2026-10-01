import React from 'react';
import {
  Spin, Tag, Button, Table, Popconfirm, message, Grid,
} from 'antd';
import {
  CheckCircleOutlined, PlayCircleOutlined, EnvironmentOutlined,
  InboxOutlined, DownloadOutlined, PrinterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetMyTodayAllocationQuery } from '../../store/api/routeAllocationApi';
import {
  useGetRoutePicklistQuery,
  useRouteStartPackingMutation,
  useRouteMarkPackedMutation,
} from '../../store/api/orderApi';
import { useGetCompanyProfileQuery } from '../../store/api/tenantApi';
import { hasPermission } from '../../utils/permissions';

const { useBreakpoint } = Grid;

function buildPicklistHtml(route: any, date: string, company?: any): string {
  const dateLabel = dayjs(date).format('DD MMM YYYY');
  const companyName = company?.name || '';
  const companyPhone = company?.phone ? `Ph: ${company.phone}` : '';
  const companyGstin = company?.gstin ? `GSTIN: ${company.gstin}` : '';
  const companyAddr = [company?.address, company?.city, company?.state, company?.pinCode].filter(Boolean).join(', ');
  const companyMeta = [companyPhone, companyGstin].filter(Boolean).join('&nbsp;&nbsp;|&nbsp;&nbsp;');

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

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Pick List — ${route.routeName} — ${dateLabel}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:Arial,sans-serif; font-size:12px; color:#111; padding:16px 20px; }
    .company-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #1e3a5f; padding-bottom:10px; margin-bottom:14px; }
    .company-left .company-name { font-size:18px; font-weight:800; color:#1e3a5f; }
    .company-left .company-addr { font-size:10px; color:#555; margin-top:2px; }
    .company-left .company-meta { font-size:10px; color:#555; margin-top:1px; }
    .company-right { text-align:right; }
    .company-right .doc-title { font-size:14px; font-weight:800; color:#1e3a5f; text-transform:uppercase; letter-spacing:1px; }
    .company-right .doc-date { font-size:11px; color:#555; margin-top:3px; }
    .route-block { margin-bottom:20px; }
    .route-header { background:#1e3a5f; color:#fff; padding:7px 10px; border-radius:3px 3px 0 0; display:flex; align-items:baseline; }
    .route-title { font-size:13px; font-weight:800; color:#fff; }
    .route-meta { font-size:10px; color:#a8c0d6; }
    table { width:100%; border-collapse:collapse; }
    th { background:#f0f4f8; text-align:left; padding:6px 8px; font-size:10px; font-weight:700; color:#1e3a5f; border:1px solid #c8d6e5; text-transform:uppercase; }
    td { padding:5px 8px; border:1px solid #dde4ec; vertical-align:middle; font-size:11px; }
    .row-even { background:#fff; }
    .row-odd  { background:#f8fafc; }
    .sno { color:#94a3b8; font-size:10px; text-align:center; width:28px; }
    .prod-name { font-weight:600; }
    .prod-brand { font-size:10px; color:#888; margin-top:1px; }
    .center { text-align:center; }
    .right { text-align:right; }
    .qty { font-weight:800; font-size:15px; color:#1e3a5f; }
    .pick-cell { font-size:16px; color:#ccc; }
    .footer-sign { display:flex; justify-content:space-between; margin-top:10px; padding-top:8px; border-top:1px dashed #ccc; font-size:10px; color:#555; }
    @media print { body { padding:8px 10px; } }
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
    </div>
  </div>
  <div class="route-block">
    <div class="route-header">
      <span class="route-title">${route.routeName}</span>
      <span class="route-meta">&nbsp;&nbsp;${dateLabel} &nbsp;·&nbsp; ${route.totalOrders} order${route.totalOrders !== 1 ? 's' : ''} &nbsp;·&nbsp; ${route.pickList?.length || 0} products</span>
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
  </div>
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
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

const WarehouseDashboardPage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const today = dayjs().format('YYYY-MM-DD');

  const { data: allocData, isLoading: allocLoading } = useGetMyTodayAllocationQuery();
  const { data: picklistData, isLoading: pickLoading, refetch } = useGetRoutePicklistQuery(today, {
    refetchOnMountOrArgChange: true,
  });
  const { data: profileData } = useGetCompanyProfileQuery();

  const [routeStartPacking, { isLoading: starting }] = useRouteStartPackingMutation();
  const [routeMarkPacked, { isLoading: marking }] = useRouteMarkPackedMutation();

  const alloc = allocData?.data;
  const company = profileData?.data;
  // Backend auto-filters route picklist to only the warehouse person's assigned route
  const routes: any[] = picklistData?.data || [];
  const myRoute = routes[0] || null;

  const isWarehouse = alloc?.warehouse ?? alloc?.isWarehouse ?? false;
  const isAllocated = alloc?.allocated && isWarehouse;
  const routeName = alloc?.allocation?.routeName || myRoute?.routeName;
  const routeId = alloc?.allocation?.routeId || myRoute?.routeId;

  const handleStartPacking = async () => {
    if (!routeId) return;
    try {
      await routeStartPacking({ routeId, date: today }).unwrap();
      message.success('Packing started for all approved orders');
      refetch();
    } catch {
      message.error('Failed to start packing');
    }
  };

  const handleMarkPacked = async () => {
    if (!routeId) return;
    try {
      await routeMarkPacked({ routeId, date: today }).unwrap();
      message.success('All orders marked as packed');
      refetch();
    } catch {
      message.error('Failed to mark as packed');
    }
  };

  const handleDownload = () => {
    if (!myRoute) return;
    const html = buildPicklistHtml(myRoute, today, company);
    downloadHtml(html, `picklist-${myRoute.routeName.replace(/\s+/g, '-')}-${today}.html`);
  };

  const handlePrint = () => {
    if (!myRoute) return;
    printHtml(buildPicklistHtml(myRoute, today, company));
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
      title: 'Qty',
      dataIndex: 'totalQuantity',
      width: 80,
      align: 'right' as const,
      render: (qty: number) => (
        <span style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>{qty}</span>
      ),
    },
  ];

  if (allocLoading || pickLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isAllocated && !myRoute) {
    return (
      <div style={{ padding: isMobile ? 16 : 24 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#0f172a' }}>My Work Today</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>{dayjs().format('DD MMM YYYY')}</div>
        </div>
        <div style={{
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
          padding: 48, textAlign: 'center',
        }}>
          <InboxOutlined style={{ fontSize: 48, color: '#94a3b8', marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>Not assigned to any route today</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
            Contact your manager to get a route assignment for {dayjs().format('DD MMM YYYY')}.
          </div>
        </div>
      </div>
    );
  }

  const allDone = myRoute && myRoute.approvedCount === 0 && myRoute.packingCount === 0;

  return (
    <div style={{ padding: isMobile ? 16 : 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Page title */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 18, color: '#0f172a' }}>My Work Today</div>
        <div style={{ fontSize: 13, color: '#64748b' }}>{dayjs().format('DD MMM YYYY')}</div>
      </div>

      {/* Route assignment card */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <EnvironmentOutlined style={{ color: '#059669' }} />
          <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{routeName || '—'}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {myRoute?.approvedCount  > 0 && <Tag color="green">{myRoute.approvedCount} Approved</Tag>}
          {myRoute?.packingCount > 0 && <Tag color="orange">{myRoute.packingCount} Packing</Tag>}
          {myRoute?.packedCount  > 0 && <Tag color="cyan">{myRoute.packedCount} Packed</Tag>}
          {!myRoute && <span style={{ color: '#94a3b8', fontSize: 13 }}>No pending orders</span>}
          {allDone && myRoute && <Tag color="blue">{myRoute.packedCount} Packed — Ready for dispatch</Tag>}
        </div>
      </div>

      {/* Action buttons */}
      {myRoute && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button icon={<DownloadOutlined />} onClick={handleDownload}>Download Pick List</Button>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>Print Pick List</Button>
          {myRoute.approvedCount > 0 && hasPermission('PICKLIST_UPDATE') && (
            <Popconfirm
              title={`Start packing ${myRoute.approvedCount} approved order(s) for ${routeName}?`}
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
          {myRoute.packingCount > 0 && hasPermission('PICKLIST_UPDATE') && (
            <Popconfirm
              title={`Mark all ${myRoute.packingCount} order(s) as packed?`}
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
      )}

      {/* Pick list */}
      {myRoute && (myRoute.pickList?.length > 0) ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Pick List — {myRoute.pickList.length} Products &nbsp;·&nbsp; {myRoute.totalOrders} Orders
            </span>
          </div>
          <Table
            dataSource={myRoute.pickList}
            columns={pickListColumns}
            rowKey="productId"
            size="small"
            pagination={false}
            expandable={{
              expandedRowRender: (record: any) => (
                <div style={{ padding: '6px 12px 6px 36px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {record.breakdown?.map((b: any) => (
                    <span
                      key={b.customerId + b.orderNumber}
                      style={{
                        fontSize: 12, padding: '3px 10px', borderRadius: 20,
                        background: '#f1f5f9', color: '#334155', fontWeight: 500,
                      }}
                    >
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
      ) : myRoute ? (
        <div style={{
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
          padding: 32, textAlign: 'center',
        }}>
          <CheckCircleOutlined style={{ fontSize: 32, color: '#06b6d4', marginBottom: 8 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>All orders packed</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Ready for dispatch by delivery team</div>
        </div>
      ) : null}

    </div>
  );
};

export default WarehouseDashboardPage;
