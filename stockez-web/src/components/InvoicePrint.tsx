import React from 'react';
import { useGetCompanyProfileQuery } from '../store/api/supplierApi';

interface InvoicePrintProps {
  order: any;
  tenant?: any;
}

function toWords(num: number): string {
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function helper(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '') + ' ';
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred ' + helper(n % 100);
    if (n < 100000) return helper(Math.floor(n / 1000)) + 'Thousand ' + helper(n % 1000);
    if (n < 10000000) return helper(Math.floor(n / 100000)) + 'Lakh ' + helper(n % 100000);
    return helper(Math.floor(n / 10000000)) + 'Crore ' + helper(n % 10000000);
  }

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  let result = helper(rupees).trim() + ' Rupees';
  if (paise > 0) result += ' and ' + helper(paise).trim() + ' Paise';
  return result + ' Only';
}

const InvoicePrint: React.FC<InvoicePrintProps> = ({ order }) => {
  const { data: profileData } = useGetCompanyProfileQuery();
  const company = profileData?.data;

  if (!order) return null;

  const items = order.items || [];
  const subTotal = items.reduce((s: number, i: any) => s + ((i.unitPrice || 0) * (i.quantity || 0)), 0);
  const totalGst = items.reduce((s: number, i: any) => s + (i.gstAmount || 0), 0);
  const total = order.totalAmount || (subTotal + totalGst);

  return (
    <div className="print-invoice" style={{ padding: 32, fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#000', background: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, borderBottom: '2px solid #1c2b36', paddingBottom: 20 }}>
        <div>
          {company?.logoUrl && (
            <img src={company.logoUrl} alt="logo" style={{ height: 40, marginBottom: 6, display: 'block' }} />
          )}
          <div style={{ fontSize: 18, fontWeight: 900, color: '#1c2b36', letterSpacing: -0.5 }}>{company?.name || 'Distribution Company'}</div>
          {company?.ownerName && <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>Prop: {company.ownerName}</div>}
          {company?.address && <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>{company.address}</div>}
          {(company?.city || company?.state) && (
            <div style={{ fontSize: 11, color: '#555' }}>
              {[company.city, company.state, company.pinCode].filter(Boolean).join(', ')}
            </div>
          )}
          {company?.phone && <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Ph: {company.phone}</div>}
          {company?.gstin && <div style={{ fontSize: 11, color: '#555', fontWeight: 700 }}>GSTIN: {company.gstin}</div>}
          {company?.fssaiNumber && <div style={{ fontSize: 11, color: '#555' }}>FSSAI: {company.fssaiNumber}</div>}
          {company?.panNumber && <div style={{ fontSize: 11, color: '#555' }}>PAN: {company.panNumber}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1c2b36', letterSpacing: 1 }}>TAX INVOICE</div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>Invoice No: <strong>#{order.orderNumber}</strong></div>
          <div style={{ fontSize: 12, color: '#555' }}>Date: <strong>{new Date(order.orderDate || order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
        </div>
      </div>

      {/* Billed To / From */}
      <div style={{ display: 'flex', gap: 48, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Billed To</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1d2e' }}>{order.customer?.businessName}</div>
          <div style={{ color: '#555', marginTop: 2 }}>{order.customer?.ownerName}</div>
          <div style={{ color: '#555' }}>{order.customer?.phone}</div>
          {order.customer?.address && <div style={{ color: '#555', marginTop: 2 }}>{order.customer.address}</div>}
          {order.customer?.gstin && <div style={{ color: '#555', marginTop: 4 }}>GSTIN: <strong>{order.customer.gstin}</strong></div>}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Delivery Info</div>
          <div style={{ color: '#555' }}>Route: <strong>{order.customer?.route?.name || '—'}</strong></div>
          <div style={{ color: '#555' }}>Place: <strong>{order.customer?.routePlace?.name || '—'}</strong></div>
          {order.deliveryPerson && <div style={{ color: '#555' }}>Delivery By: <strong>{order.deliveryPerson.fullName}</strong></div>}
          <div style={{ color: '#555', marginTop: 4 }}>Status: <strong style={{ color: '#10b981' }}>{order.status?.replace(/_/g, ' ')}</strong></div>
        </div>
      </div>

      {/* Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead>
          <tr style={{ background: '#1c2b36', color: '#fff' }}>
            <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11 }}>#</th>
            <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11 }}>Product</th>
            <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11 }}>HSN</th>
            <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11 }}>Qty</th>
            <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11 }}>Rate</th>
            <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11 }}>GST%</th>
            <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11 }}>GST Amt</th>
            <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, i: number) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e8ecf0' }}>
              <td style={{ padding: '7px 10px', color: '#555' }}>{i + 1}</td>
              <td style={{ padding: '7px 10px' }}>
                <div style={{ fontWeight: 600, color: '#1a1d2e' }}>{item.product?.name || item.productName}</div>
                <div style={{ fontSize: 10, color: '#888' }}>{item.product?.brand}</div>
              </td>
              <td style={{ padding: '7px 10px', textAlign: 'center', color: '#555', fontSize: 11 }}>
                {item.product?.hsnCode || '—'}
              </td>
              <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 600 }}>
                {item.quantity} {item.product?.unit || ''}
              </td>
              <td style={{ padding: '7px 10px', textAlign: 'right' }}>₹{(item.unitPrice || 0).toFixed(2)}</td>
              <td style={{ padding: '7px 10px', textAlign: 'right', color: '#555' }}>{item.gstPercent || 0}%</td>
              <td style={{ padding: '7px 10px', textAlign: 'right', color: '#555' }}>₹{(item.gstAmount || 0).toFixed(2)}</td>
              <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>₹{(item.lineTotal || ((item.unitPrice || 0) * (item.quantity || 0) + (item.gstAmount || 0))).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <div style={{ minWidth: 260 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #e8ecf0', fontSize: 13 }}>
            <span style={{ color: '#555' }}>Sub Total</span>
            <span>₹{subTotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #e8ecf0', fontSize: 13 }}>
            <span style={{ color: '#555' }}>CGST</span>
            <span>₹{(totalGst / 2).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #e8ecf0', fontSize: 13 }}>
            <span style={{ color: '#555' }}>SGST</span>
            <span>₹{(totalGst / 2).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 15, fontWeight: 800, color: '#1c2b36', borderTop: '2px solid #1c2b36', marginTop: 4 }}>
            <span>Total Amount</span>
            <span>₹{total.toFixed(2)}</span>
          </div>
          {order.paidAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: '#10b981' }}>
              <span>Paid</span>
              <span>₹{(order.paidAmount || 0).toFixed(2)}</span>
            </div>
          )}
          {order.balanceAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, fontWeight: 700, color: '#ef4444' }}>
              <span>Balance Due</span>
              <span>₹{(order.balanceAmount || 0).toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Amount in words */}
      <div style={{ background: '#f8fafc', border: '1px solid #e8ecf0', borderRadius: 6, padding: '8px 14px', marginBottom: 24, fontSize: 12 }}>
        <span style={{ color: '#888' }}>Amount in words: </span>
        <strong>{toWords(total)}</strong>
      </div>

      {/* Notes + Signature */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ maxWidth: 300 }}>
          {order.notes && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Notes</div>
              <div style={{ color: '#555', fontSize: 12 }}>{order.notes}</div>
            </>
          )}
          <div style={{ marginTop: 12, fontSize: 11, color: '#888' }}>
            Payment due within 30 days. Thank you for your business.
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 40 }}>Authorized Signatory</div>
          <div style={{ borderTop: '1px solid #1a1d2e', paddingTop: 6, fontSize: 12, fontWeight: 600, color: '#1a1d2e' }}>
            {company?.name || 'StockEz'}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #e8ecf0', marginTop: 20, paddingTop: 12, textAlign: 'center', fontSize: 10, color: '#aaa' }}>
        Generated by StockEz • Enterprise Distribution Platform
      </div>
    </div>
  );
};

export default InvoicePrint;
