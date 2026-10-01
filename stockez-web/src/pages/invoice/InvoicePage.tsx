import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Spin, Table, Button, Tag } from 'antd';
import { PrinterOutlined, DownloadOutlined } from '@ant-design/icons';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface ProductInfo { id: string; name: string; brand: string; unit: string; imageUrl?: string; hsnCode?: string; }
interface OrderItem {
  id: string; product: ProductInfo; quantity: number;
  unitPrice: number; discountPercent?: number; discountAmount?: number;
  gstPercent?: number; gstAmount?: number; lineTotal: number;
  batchNumber?: string; batchExpiryDate?: string;
}
interface CustomerInfo { businessName?: string; ownerName?: string; phone?: string; address?: string; }
interface PersonInfo { id: string; fullName: string; phone?: string; }
interface OrderResponse {
  id: string; orderNumber: string; status: string; orderDate: string;
  customer?: CustomerInfo;
  salesPerson?: PersonInfo;
  items: OrderItem[];
  subTotal: number; totalGst: number; roundOffAmount?: number; totalAmount: number;
  paidAmount: number; balanceAmount: number; notes?: string;
  createdAt: string;
}
interface CompanyInfo {
  name: string; ownerName?: string; phone?: string; email?: string;
  address?: string; city?: string; state?: string; pinCode?: string;
  gstin?: string; fssaiNumber?: string; logoUrl?: string;
}
interface PublicInvoiceResponse {
  order: OrderResponse; company: CompanyInfo; pdfUrl?: string;
}

const fmt = (v: number | undefined) =>
  v != null ? `₹${Number(v).toFixed(2)}` : '₹0.00';

const fmtDate = (d: string | undefined) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusColor: Record<string, string> = {
  DRAFT: 'default', SUBMITTED: 'blue', APPROVED: 'cyan',
  PACKING: 'orange', PACKED: 'lime', DISPATCHED: 'purple',
  DELIVERED: 'green', CANCELLED: 'red',
};

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function numToWords(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + numToWords(n % 100) : '');
  if (n < 100000) return numToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
  if (n < 10000000) return numToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + numToWords(n % 100000) : '');
  return numToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + numToWords(n % 10000000) : '');
}

function toWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let result = (numToWords(rupees) || 'Zero') + ' Rupees';
  if (paise > 0) result += ' and ' + numToWords(paise) + ' Paise';
  return result + ' Only';
}

const InvoicePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PublicInvoiceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/public/invoice/${id}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setData(res.data);
        else setError(res.message || 'Failed to load invoice');
      })
      .catch(() => setError('Could not connect to server'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/public/invoice/${id}/pdf`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data?.order?.orderNumber || 'invoice'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#d97706' }}>Invoice not found</div>
          <div style={{ color: '#64748b', marginTop: 8 }}>{error || 'This invoice could not be loaded.'}</div>
        </div>
      </div>
    );
  }

  const { order, company } = data;
  const customerName = order.customer?.businessName || order.customer?.ownerName || '—';
  const customerPhone = order.customer?.phone;
  const customerAddress = order.customer?.address;
  const companyAddress = [company.address, company.city, company.state, company.pinCode].filter(Boolean).join(', ');

  // GST breakdown by rate for CGST/SGST summary
  const gstBreakdown = order.items.reduce((acc, item) => {
    const rate = item.gstPercent || 0;
    if (!acc[rate]) acc[rate] = { taxable: 0, gst: 0 };
    const taxable = item.lineTotal - (item.gstAmount || 0);
    acc[rate].taxable += taxable;
    acc[rate].gst += (item.gstAmount || 0);
    return acc;
  }, {} as Record<number, { taxable: number; gst: number }>);

  const gstRates = Object.keys(gstBreakdown).map(Number).sort((a, b) => a - b);

  const columns = [
    {
      title: '#',
      key: 'idx',
      width: 32,
      render: (_: unknown, __: unknown, i: number) => <span style={{ fontSize: 11 }}>{i + 1}</span>,
    },
    {
      title: 'Product',
      key: 'product',
      render: (r: OrderItem) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 12, lineHeight: '16px' }}>{r.product?.name || '-'}</div>
          {(r.product?.brand || r.product?.unit) && (
            <div style={{ fontSize: 10, color: '#64748b' }}>
              {[r.product.brand, r.product.unit].filter(Boolean).join(' · ')}
            </div>
          )}
          {r.batchNumber && (
            <div style={{ fontSize: 10, color: '#94a3b8' }}>
              Batch: {r.batchNumber}{r.batchExpiryDate ? ` · Exp: ${fmtDate(r.batchExpiryDate)}` : ''}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'HSN',
      key: 'hsn',
      align: 'center' as const,
      width: 70,
      render: (r: OrderItem) => <span style={{ fontSize: 11 }}>{r.product?.hsnCode || '—'}</span>,
    },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      key: 'qty',
      align: 'center' as const,
      width: 44,
      render: (v: number) => <span style={{ fontSize: 12 }}>{v}</span>,
    },
    {
      title: 'Rate',
      dataIndex: 'unitPrice',
      key: 'rate',
      align: 'right' as const,
      width: 72,
      render: (v: number) => <span style={{ fontSize: 12 }}>{fmt(v)}</span>,
    },
    {
      title: 'Disc',
      dataIndex: 'discountAmount',
      key: 'disc',
      align: 'right' as const,
      width: 64,
      render: (v?: number) => <span style={{ fontSize: 12 }}>{v && v > 0 ? fmt(v) : '-'}</span>,
    },
    {
      title: 'GST%',
      dataIndex: 'gstPercent',
      key: 'gst',
      align: 'right' as const,
      width: 50,
      render: (v?: number) => <span style={{ fontSize: 12 }}>{v ? `${v}%` : '-'}</span>,
    },
    {
      title: 'Amount',
      dataIndex: 'lineTotal',
      key: 'total',
      align: 'right' as const,
      width: 84,
      render: (v: number) => <strong style={{ fontSize: 12 }}>{fmt(v)}</strong>,
    },
  ];

  return (
    <div style={{ background: '#e8eaf0', minHeight: '100vh', padding: '20px 12px' }}>
      {/* Action bar — hidden on print */}
      <div className="no-print" style={{ maxWidth: 780, margin: '0 auto 12px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button icon={<DownloadOutlined />} onClick={handleDownloadPdf} loading={pdfLoading}>
          Download PDF
        </Button>
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
          Print
        </Button>
      </div>

      {/* Invoice sheet — fluid width, scales with whatever paper size chosen in print dialog */}
      <div className="invoice-sheet" style={{
        maxWidth: 780, margin: '0 auto', background: '#fff',
        borderRadius: 4, padding: '28px 32px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
      }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          {/* Company */}
          <div style={{ flex: 1, paddingRight: 24 }}>
            {company.logoUrl && (
              <img src={company.logoUrl} alt="logo" style={{ height: 44, marginBottom: 8, display: 'block' }} />
            )}
            <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>{company.name}</div>
            {company.gstin && <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>GSTIN: {company.gstin}</div>}
            {company.fssaiNumber && <div style={{ fontSize: 11, color: '#475569' }}>FSSAI: {company.fssaiNumber}</div>}
            {companyAddress && <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, maxWidth: 280 }}>{companyAddress}</div>}
            {company.phone && <div style={{ fontSize: 11, color: '#64748b' }}>Ph: {company.phone}</div>}
            {company.email && <div style={{ fontSize: 11, color: '#64748b' }}>{company.email}</div>}
          </div>

          {/* Invoice meta */}
          <div style={{ textAlign: 'right', minWidth: 180 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Tax Invoice
            </div>
            <table style={{ marginTop: 10, marginLeft: 'auto', fontSize: 11, borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ color: '#64748b', paddingRight: 10, paddingBottom: 3 }}>Invoice No</td>
                  <td style={{ fontWeight: 700, textAlign: 'right', paddingBottom: 3 }}>{order.orderNumber}</td>
                </tr>
                <tr>
                  <td style={{ color: '#64748b', paddingRight: 10, paddingBottom: 3 }}>Date</td>
                  <td style={{ fontWeight: 600, textAlign: 'right', paddingBottom: 3 }}>{fmtDate(order.orderDate)}</td>
                </tr>
                <tr>
                  <td style={{ color: '#64748b', paddingRight: 10, paddingBottom: 3 }}>Status</td>
                  <td style={{ textAlign: 'right', paddingBottom: 3 }}>
                    <Tag color={statusColor[order.status] || 'default'} style={{ margin: 0, fontSize: 10 }}>
                      {order.status}
                    </Tag>
                  </td>
                </tr>
                {order.salesPerson && (
                  <tr>
                    <td style={{ color: '#64748b', paddingRight: 10 }}>Sales Rep</td>
                    <td style={{ fontWeight: 600, textAlign: 'right' }}>{order.salesPerson.fullName}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Thick rule */}
        <div style={{ height: 2, background: '#1e293b', marginBottom: 14 }} />

        {/* ── Bill To ── */}
        <div style={{
          marginBottom: 16, padding: '10px 14px',
          background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 3,
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 5 }}>
            Bill To
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{customerName}</div>
          {customerPhone && <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Ph: {customerPhone}</div>}
          {customerAddress && <div style={{ fontSize: 11, color: '#475569' }}>{customerAddress}</div>}
        </div>

        {/* ── Items table ── */}
        <Table
          dataSource={order.items}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
          bordered
          style={{ marginBottom: 14 }}
        />

        {/* ── Totals + GST breakdown ── */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 20 }}>

          {/* GST breakdown */}
          <div style={{ flex: 1 }}>
            {gstRates.length > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                  GST Summary
                </div>
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      {['GST Rate', 'Taxable', 'CGST', 'SGST', 'Total GST'].map(h => (
                        <th key={h} style={{
                          padding: '4px 8px', border: '1px solid #e2e8f0', fontWeight: 600,
                          textAlign: h === 'GST Rate' ? 'left' : 'right',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gstRates.map(rate => {
                      const v = gstBreakdown[rate];
                      return (
                        <tr key={rate}>
                          <td style={{ padding: '3px 8px', border: '1px solid #e2e8f0' }}>{rate}%</td>
                          <td style={{ padding: '3px 8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{fmt(v.taxable)}</td>
                          <td style={{ padding: '3px 8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{fmt(v.gst / 2)}</td>
                          <td style={{ padding: '3px 8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{fmt(v.gst / 2)}</td>
                          <td style={{ padding: '3px 8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{fmt(v.gst)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}

            {/* Amount in words */}
            <div style={{ marginTop: 12, fontSize: 11, color: '#475569', lineHeight: '18px' }}>
              <span style={{ fontWeight: 700 }}>Amount in Words: </span>
              {toWords(order.totalAmount)}
            </div>
          </div>

          {/* Total summary */}
          <div style={{ width: 220, flexShrink: 0 }}>
            {[
              { label: 'Subtotal (excl. GST)', value: order.subTotal, signed: false },
              { label: 'Total GST', value: order.totalGst, signed: false },
              ...(order.roundOffAmount ? [{ label: 'Round Off', value: order.roundOffAmount, signed: true }] : []),
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, color: '#475569' }}>
                <span>{row.label}</span>
                <span>{row.signed ? (row.value >= 0 ? '+' : '-') : ''}{fmt(row.signed ? Math.abs(row.value) : row.value)}</span>
              </div>
            ))}
            <div style={{ height: 1, background: '#e2e8f0', margin: '6px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
              <span>Total</span>
              <span>{fmt(order.totalAmount)}</span>
            </div>
            <div style={{ height: 1, background: '#e2e8f0', margin: '6px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12 }}>
              <span style={{ color: '#475569' }}>Paid</span>
              <span style={{ color: '#16a34a', fontWeight: 600 }}>{fmt(order.paidAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12 }}>
              <span style={{ color: '#475569' }}>Balance Due</span>
              <span style={{ color: order.balanceAmount > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                {fmt(order.balanceAmount)}
              </span>
            </div>
          </div>
        </div>

        {order.notes && (
          <div style={{ marginBottom: 16, fontSize: 11, color: '#64748b' }}>
            <span style={{ fontWeight: 600 }}>Notes: </span>{order.notes}
          </div>
        )}

        {/* ── Footer: Terms + Signatory ── */}
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ fontSize: 10, color: '#64748b', lineHeight: '16px', maxWidth: 360 }}>
            <div style={{ fontWeight: 700, color: '#475569', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Terms & Conditions</div>
            <div>1. Goods once sold will not be taken back or exchanged.</div>
            <div>2. Interest @ 18% p.a. on overdue payments.</div>
            <div>3. Subject to local jurisdiction only.</div>
          </div>

          <div style={{ textAlign: 'center', minWidth: 160 }}>
            <div style={{ height: 40 }} />
            <div style={{ borderTop: '1px solid #475569', paddingTop: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>Authorized Signatory</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>{company.name}</div>
            </div>
          </div>
        </div>

        {/* Generated note */}
        <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 10, borderTop: '1px solid #f1f5f9', fontSize: 10, color: '#cbd5e1' }}>
          This is a computer generated invoice
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            /* No size declared — print dialog picks A4/A5/etc. */
            margin: 10mm 12mm;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print { display: none !important; }
          .invoice-sheet {
            box-shadow: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .ant-table-row { page-break-inside: avoid; }
          .ant-table-thead > tr > th { background: #f1f5f9 !important; }
        }
      `}</style>
    </div>
  );
};

export default InvoicePage;
