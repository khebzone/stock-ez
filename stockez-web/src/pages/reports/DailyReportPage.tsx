import React, { useState } from 'react';
import { DatePicker, Skeleton, Grid, Button } from 'antd';
import { FileExcelOutlined, ShoppingOutlined, WalletOutlined, CarOutlined, RollbackOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { noFutureDates } from '../../utils/date';
import { useGetDailyReportQuery } from '../../store/api/reportApi';
import { exportToXLSX } from '../../components/TableToolbar';

const { useBreakpoint } = Grid;

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft', SUBMITTED: 'Submitted', APPROVED: 'Approved',
  PACKING: 'Packing', PACKED: 'Packed', DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#94a3b8', SUBMITTED: '#3b82f6', APPROVED: '#8b5cf6',
  PACKING: '#f59e0b', PACKED: '#f97316', DISPATCHED: '#06b6d4',
  DELIVERED: '#059669', CANCELLED: '#ef4444',
};

const fmt = (v: number) =>
  `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const fmtBal = (v: number) => (v > 0 ? fmt(v) : '—');

const DailyReportPage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [date, setDate] = useState(dayjs());

  const { data, isLoading } = useGetDailyReportQuery(date.format('YYYY-MM-DD'));
  const report = data?.data || {};
  const summary = report.summary || {};
  const sales: any[] = report.sales || [];
  const collections: any[] = report.collections || [];
  const refunds: any[] = report.refunds || [];
  const deliveries: any[] = report.deliveries || [];

  const handleExportSales = () => {
    const rows: any[] = [];
    sales.forEach((sp: any) => {
      sp.orders.forEach((o: any) => {
        rows.push({
          salesperson: sp.salespersonName,
          route: sp.routeName,
          orderNumber: o.orderNumber,
          customer: o.customerName,
          status: STATUS_LABEL[o.status] || o.status,
          amount: o.totalAmount,
          paid: o.paidAmount,
          balance: o.balanceAmount,
        });
      });
    });
    exportToXLSX(
      rows,
      [
        { title: 'Salesperson', key: 'salesperson', dataIndex: 'salesperson' },
        { title: 'Route',       key: 'route',       dataIndex: 'route' },
        { title: 'Order #',     key: 'orderNumber', dataIndex: 'orderNumber' },
        { title: 'Customer',    key: 'customer',    dataIndex: 'customer' },
        { title: 'Status',      key: 'status',      dataIndex: 'status' },
        { title: 'Amount',      key: 'amount',      dataIndex: 'amount' },
        { title: 'Paid',        key: 'paid',        dataIndex: 'paid' },
        { title: 'Balance',     key: 'balance',     dataIndex: 'balance' },
      ],
      `daily-sales-${date.format('YYYY-MM-DD')}`
    );
  };

  const handleExportDeliveries = () => {
    const rows: any[] = [];
    deliveries.forEach((dp: any) => {
      dp.orders.forEach((o: any) => {
        rows.push({
          deliveryPerson: dp.deliveryPersonName,
          route: dp.routeName,
          orderNumber: o.orderNumber,
          customer: o.customerName,
          status: STATUS_LABEL[o.status] || o.status,
          amount: o.totalAmount,
          paid: o.paidAmount,
          balance: o.balanceAmount,
        });
      });
    });
    exportToXLSX(
      rows,
      [
        { title: 'Delivery Person', key: 'deliveryPerson', dataIndex: 'deliveryPerson' },
        { title: 'Route',           key: 'route',          dataIndex: 'route' },
        { title: 'Order #',         key: 'orderNumber',    dataIndex: 'orderNumber' },
        { title: 'Customer',        key: 'customer',       dataIndex: 'customer' },
        { title: 'Status',          key: 'status',         dataIndex: 'status' },
        { title: 'Amount',          key: 'amount',         dataIndex: 'amount' },
        { title: 'Paid',            key: 'paid',           dataIndex: 'paid' },
        { title: 'Balance',         key: 'balance',        dataIndex: 'balance' },
      ],
      `daily-deliveries-${date.format('YYYY-MM-DD')}`
    );
  };

  const handleExportCollections = () => {
    const rows: any[] = [];
    collections.forEach((cg: any) => {
      cg.payments.forEach((p: any) => {
        rows.push({
          collector: cg.collectorName,
          orderNumber: p.orderNumber,
          customer: p.customerName,
          mode: p.paymentMethodName || p.paymentMode,
          amount: p.amount,
        });
      });
    });
    exportToXLSX(
      rows,
      [
        { title: 'Collector',  key: 'collector',   dataIndex: 'collector' },
        { title: 'Invoice #',  key: 'orderNumber', dataIndex: 'orderNumber' },
        { title: 'Customer',   key: 'customer',    dataIndex: 'customer' },
        { title: 'Mode',       key: 'mode',        dataIndex: 'mode' },
        { title: 'Amount',     key: 'amount',      dataIndex: 'amount' },
      ],
      `daily-collections-${date.format('YYYY-MM-DD')}`
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5 }}>Daily Report</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>Sales and collections for the selected date</div>
        </div>
        <DatePicker
          value={date}
          onChange={(d) => d && setDate(d)}
          format="DD MMM YYYY"
          allowClear={false}
          disabledDate={noFutureDates}
          style={{ borderRadius: 8 }}
        />
      </div>

      {/* KPI Strip */}
      {isLoading ? <Skeleton active paragraph={{ rows: 1 }} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : `repeat(${Number(summary.totalRefunds) > 0 ? 5 : 4}, 1fr)`, gap: 12 }}>
          {[
            { label: 'Total Orders',     value: summary.totalOrders || 0,     isCount: true, color: '#2563eb' },
            { label: 'Total Invoiced',   value: summary.totalInvoiced || 0,   color: '#059669' },
            { label: 'Total Collected',  value: summary.totalCollected || 0,  color: '#7c3aed' },
            ...(Number(summary.totalRefunds) > 0 ? [{ label: 'Refunds Paid', value: summary.totalRefunds, color: '#dc2626' }] : []),
            { label: 'Outstanding',      value: summary.totalOutstanding || 0, color: '#dc2626' },
          ].map(card => (
            <div key={card.label} style={{
              background: '#fff', borderRadius: 14,
              border: '1px solid #e2e8f0', padding: '16px 18px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {card.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: card.color, marginTop: 6 }}>
                {(card as any).isCount ? card.value : fmt(Number(card.value))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Salesperson Summary Table */}
      {!isLoading && sales.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingOutlined style={{ color: '#2563eb' }} /> Salesperson Summary
            </div>
            <Button size="small" icon={<FileExcelOutlined />} onClick={handleExportSales} style={{ borderRadius: 6 }}>Export Sales</Button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1.2fr 1.2fr', padding: '10px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', minWidth: 500 }}>
              {['Salesperson', 'Orders', 'Invoiced', 'Collected', 'Balance'].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
              ))}
            </div>
            {sales.map((sp: any) => (
              <div key={sp.salespersonId} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1.2fr 1.2fr', padding: '12px 20px', borderBottom: '1px solid #f1f5f9', minWidth: 500 }}>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{sp.salespersonName}</div>
                <div style={{ color: '#475569', fontSize: 13 }}>{sp.orderCount}</div>
                <div style={{ fontWeight: 600, color: '#059669', fontSize: 13 }}>{fmt(sp.totalInvoiced)}</div>
                <div style={{ fontWeight: 600, color: '#7c3aed', fontSize: 13 }}>{fmt(sp.totalCollected)}</div>
                <div style={{ fontWeight: 600, color: sp.balance > 0 ? '#dc2626' : '#94a3b8', fontSize: 13 }}>{fmtBal(sp.balance)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delivery Person Summary Table */}
      {!isLoading && deliveries.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CarOutlined style={{ color: '#0891b2' }} /> Delivery Person Summary
            </div>
            <Button size="small" icon={<FileExcelOutlined />} onClick={handleExportDeliveries} style={{ borderRadius: 6 }}>Export Deliveries</Button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr 1.2fr', padding: '10px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', minWidth: 600 }}>
              {['Delivery Person', 'Orders', 'Delivered', 'Dispatched', 'Total Amount', 'Collected'].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
              ))}
            </div>
            {deliveries.map((dp: any) => (
              <div key={dp.deliveryPersonId} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr 1.2fr', padding: '12px 20px', borderBottom: '1px solid #f1f5f9', minWidth: 600 }}>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{dp.deliveryPersonName}</div>
                <div style={{ color: '#475569', fontSize: 13 }}>{dp.orderCount}</div>
                <div style={{ fontWeight: 600, color: '#059669', fontSize: 13 }}>{dp.deliveredCount}</div>
                <div style={{ fontWeight: 600, color: '#f97316', fontSize: 13 }}>{dp.dispatchedCount}</div>
                <div style={{ fontWeight: 600, color: '#0891b2', fontSize: 13 }}>{fmt(dp.totalAmount)}</div>
                <div style={{ fontWeight: 600, color: '#7c3aed', fontSize: 13 }}>{fmt(dp.totalCollected)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two-column detail: Order Detail (+ Delivery Detail stacked below) | Collections */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* Sales Detail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>Order Detail</div>
          {isLoading ? <Skeleton active paragraph={{ rows: 5 }} /> : (
            sales.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                No orders for this date
              </div>
            ) : (
              sales.map((sp: any) => (
                <div key={`${sp.salespersonId}-${sp.routeId || 'none'}`} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  {/* Group header */}
                  <div style={{ padding: '11px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{sp.salespersonName}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{sp.routeName}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{sp.orderCount} orders · {fmt(sp.totalInvoiced)}</div>
                  </div>
                  {/* Column headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.5fr 0.8fr 1fr 1fr', padding: '8px 16px', borderBottom: '1px solid #f1f5f9' }}>
                    {['Order #', 'Customer', 'Status', 'Amount', 'Balance'].map(h => (
                      <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</div>
                    ))}
                  </div>
                  {/* Rows */}
                  {sp.orders.map((o: any) => (
                    <div key={o.orderId} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.5fr 0.8fr 1fr 1fr', padding: '10px 16px', borderBottom: '1px solid #f8fafc' }}>
                      <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>{o.orderNumber}</div>
                      <div style={{ fontSize: 12, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.customerName}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[o.status] || '#64748b' }}>{STATUS_LABEL[o.status] || o.status}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{fmt(o.totalAmount)}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: o.balanceAmount > 0 ? '#dc2626' : '#94a3b8' }}>{fmtBal(o.balanceAmount)}</div>
                    </div>
                  ))}
                  {/* Group subtotal */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.5fr 0.8fr 1fr 1fr', padding: '10px 16px', background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', gridColumn: '1 / 4' }}>Total</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#059669' }}>{fmt(sp.totalInvoiced)}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: sp.balance > 0 ? '#dc2626' : '#94a3b8' }}>{fmtBal(sp.balance)}</div>
                  </div>
                </div>
              ))
            )
          )}

          {/* Delivery Detail — stacked under Order Detail, same column */}
          {!isLoading && deliveries.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4 }}>Delivery Detail</div>
              {deliveries.map((dp: any) => (
                <div key={`${dp.deliveryPersonId}-${dp.routeId || 'none'}`} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={{ padding: '11px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CarOutlined style={{ color: '#0891b2' }} /> {dp.deliveryPersonName}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, marginLeft: 20 }}>{dp.routeName}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {dp.deliveredCount > 0 && <span style={{ color: '#059669', fontWeight: 600 }}>{dp.deliveredCount} delivered</span>}
                      {dp.deliveredCount > 0 && dp.dispatchedCount > 0 && <span style={{ color: '#94a3b8' }}> · </span>}
                      {dp.dispatchedCount > 0 && <span style={{ color: '#f97316', fontWeight: 600 }}>{dp.dispatchedCount} dispatched</span>}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.5fr 0.8fr 1fr 1fr', padding: '8px 16px', borderBottom: '1px solid #f1f5f9' }}>
                    {['Order #', 'Customer', 'Status', 'Amount', 'Balance'].map(h => (
                      <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</div>
                    ))}
                  </div>
                  {dp.orders.map((o: any) => (
                    <div key={o.orderId} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.5fr 0.8fr 1fr 1fr', padding: '10px 16px', borderBottom: '1px solid #f8fafc' }}>
                      <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>{o.orderNumber}</div>
                      <div style={{ fontSize: 12, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.customerName}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[o.status] || '#64748b' }}>{STATUS_LABEL[o.status] || o.status}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{fmt(o.totalAmount)}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: o.balanceAmount > 0 ? '#dc2626' : '#94a3b8' }}>{fmtBal(o.balanceAmount)}</div>
                    </div>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.5fr 0.8fr 1fr 1fr', padding: '10px 16px', background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', gridColumn: '1 / 4' }}>Total</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#0891b2' }}>{fmt(dp.totalAmount)}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Collections Detail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>Collections</div>
            {collections.length > 0 && (
              <Button size="small" icon={<FileExcelOutlined />} onClick={handleExportCollections} style={{ borderRadius: 6 }}>Export</Button>
            )}
          </div>
          {isLoading ? <Skeleton active paragraph={{ rows: 5 }} /> : (
            collections.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                No collections for this date
              </div>
            ) : (
              collections.map((cg: any) => (
                <div key={cg.collectorId} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  {/* Collector header */}
                  <div style={{ padding: '11px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <WalletOutlined style={{ color: '#7c3aed' }} /> {cg.collectorName}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>{fmt(cg.total)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                      <div style={{ fontSize: 12, color: '#64748b' }}>Cash: <span style={{ fontWeight: 700, color: '#059669' }}>{fmt(cg.cashTotal)}</span></div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>Digital: <span style={{ fontWeight: 700, color: '#7c3aed' }}>{fmt(cg.digitalTotal)}</span></div>
                    </div>
                  </div>
                  {/* Column headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.8fr 0.9fr 1fr', padding: '8px 16px', borderBottom: '1px solid #f1f5f9' }}>
                    {['Invoice #', 'Customer', 'Mode', 'Amount'].map(h => (
                      <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</div>
                    ))}
                  </div>
                  {/* Rows */}
                  {cg.payments.map((p: any, i: number) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.8fr 0.9fr 1fr', padding: '10px 16px', borderBottom: '1px solid #f8fafc' }}>
                      <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>{p.orderNumber}</div>
                      <div style={{ fontSize: 12, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.customerName}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: p.paymentMode === 'CASH' ? '#059669' : '#7c3aed' }}>
                        {p.paymentMethodName || p.paymentMode}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{fmt(p.amount)}</div>
                    </div>
                  ))}
                </div>
              ))
            )
          )}

          {/* Refunds Paid Out — money going out, kept separate from collections */}
          {!isLoading && refunds.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4 }}>Refunds Paid Out</div>
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #fecaca', overflow: 'hidden' }}>
                <div style={{ padding: '11px 16px', background: '#fef2f2', borderBottom: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <RollbackOutlined /> Cash paid back to customers
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#dc2626' }}>−{fmt(Number(summary.totalRefunds) || 0)}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.6fr 1fr 1fr', padding: '8px 16px', borderBottom: '1px solid #f1f5f9' }}>
                  {['Invoice #', 'Customer', 'By', 'Amount'].map(h => (
                    <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</div>
                  ))}
                </div>
                {refunds.map((r: any, i: number) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.6fr 1fr 1fr', padding: '10px 16px', borderBottom: '1px solid #f8fafc' }}>
                    <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>{r.orderNumber || '—'}</div>
                    <div style={{ fontSize: 12, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.customerName}</div>
                    <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.processedByName || '—'}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>−{fmt(r.amount)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default DailyReportPage;
