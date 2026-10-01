import React, { useState } from 'react';
import { Badge, Popover, Divider } from 'antd';
import { BellOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useGetNotificationSummaryQuery } from '../store/api/notificationApi';
import { hasPermission, isAdmin } from '../utils/permissions';

interface NotifItem {
  label: string;
  count: number;
  path: string;
  permission: string | null;
  color: string;
}

const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data } = useGetNotificationSummaryQuery(undefined, { pollingInterval: 60000 });
  const s = data?.data;

  const items: NotifItem[] = [
    { label: 'Pending Invoice Approvals', count: s?.pendingInvoiceApprovals ?? 0, path: '/invoice/approver', permission: 'INVOICE_APPROVE', color: '#7c3aed' },
    { label: 'Orders to Pick / Pack',     count: s?.pendingPicklists ?? 0,        path: '/warehouse/picklist', permission: 'PICKLIST_VIEW', color: '#0369a1' },
    { label: 'Delivery Returns',          count: s?.deliveryReturns ?? 0,         path: '/warehouse/returns',  permission: 'PICKLIST_UPDATE', color: '#b45309' },
    { label: 'Payments to Verify',        count: s?.pendingPaymentVerifications ?? 0, path: '/payments', permission: 'PAYMENTS_VERIFY', color: '#dc2626' },
    { label: 'Bank Instruments Pending',  count: s?.pendingBankInstruments ?? 0,  path: '/bank-clearance', permission: 'BANK_CLEARANCE_VIEW', color: '#0369a1' },
    { label: 'Returns to Verify',         count: s?.pendingGoodsReturnVerification ?? 0, path: '/goods-return', permission: 'RETURNS_APPROVE', color: '#7c3aed' },
    { label: 'Supplier Claims Pending',   count: s?.pendingSupplierClaims ?? 0,   path: '/refunds-claims', permission: 'PAYMENTS_VIEW', color: '#16a34a' },
    { label: 'Near-Expiry Batches',       count: s?.nearExpiryBatches ?? 0,       path: '/purchases', permission: 'PURCHASE_VIEW', color: '#b45309' },
  ];

  const visible = items.filter(i => (i.permission === null || isAdmin() || hasPermission(i.permission)) && i.count > 0);
  const totalCount = visible.reduce((sum, i) => sum + i.count, 0);

  const handleClick = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const content = (
    <div style={{ width: 300 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', padding: '4px 0 10px' }}>
        Notifications
      </div>
      <Divider style={{ margin: '0 0 10px' }} />
      {visible.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', gap: 8 }}>
          <CheckCircleOutlined style={{ fontSize: 28, color: '#059669' }} />
          <div style={{ fontSize: 13, color: '#64748b' }}>All caught up!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {visible.map((item, idx) => (
            <div
              key={idx}
              onClick={() => handleClick(item.path)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <span style={{ fontSize: 13, color: '#334155' }}>{item.label}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, color: '#fff',
                background: item.color, borderRadius: 10,
                padding: '2px 8px', minWidth: 22, textAlign: 'center',
              }}>
                {item.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      arrow={false}
      overlayStyle={{ paddingTop: 4 }}
      overlayInnerStyle={{ padding: '12px 14px', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}
    >
      <Badge count={totalCount} size="small" offset={[-4, 4]} overflowCount={99}>
        <div style={{
          cursor: 'pointer', width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 8, color: open ? '#3b82f6' : '#64748b', fontSize: 16,
          transition: 'all 0.2s',
          background: open ? '#eff6ff' : 'transparent',
        }}>
          <BellOutlined />
        </div>
      </Badge>
    </Popover>
  );
};

export default NotificationBell;
