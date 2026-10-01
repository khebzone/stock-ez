import React from 'react';
import { createPortal } from 'react-dom';
import { useGetCompanyProfileQuery } from '../store/api/supplierApi';

interface InvoicePrintProps {
  order: any;
  company?: any;
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

const InvoiceContent: React.FC<{ order: any; company?: any }> = ({ order, company: companyProp }) => {
  const { data: profileData } = useGetCompanyProfileQuery();
  const company = companyProp ?? profileData?.data;

  if (!order) return null;

  const items = order.items || [];
  const totalGst = items.reduce((s: number, i: any) => s + (i.gstAmount || 0), 0);
  const total = order.totalAmount || items.reduce((s: number, i: any) => s + (i.lineTotal != null ? i.lineTotal : (i.unitPrice || 0) * (i.quantity || 0)), 0);
  const roundOff = order.roundOffAmount || 0;
  const paidAmount = order.paidAmount || 0;
  const overallDiscount = Number(order.overallDiscountAmount || 0);
  const grossInclusive = items.reduce((s: number, i: any) => s + ((i.unitPrice || 0) * (i.quantity || 0) - (i.discountAmount || 0)), 0);
  const balanceAmount = order.balanceAmount != null ? order.balanceAmount : total - paidAmount;

  // GST rate-wise grouping
  const gstGroups: Record<number, { taxable: number; gst: number }> = {};
  items.forEach((item: any) => {
    const rate = item.gstPercent || 0;
    const lineAmt = item.lineTotal != null ? item.lineTotal : (item.unitPrice || 0) * (item.quantity || 0);
    const gstAmt = item.gstAmount || 0;
    if (!gstGroups[rate]) gstGroups[rate] = { taxable: 0, gst: 0 };
    gstGroups[rate].taxable += lineAmt - gstAmt;
    gstGroups[rate].gst += gstAmt;
  });
  const gstRates = Object.keys(gstGroups).map(Number).sort((a, b) => a - b);

  const totalCgst = Math.round((totalGst / 2) * 100) / 100;
  const totalSgst = Math.round((totalGst / 2) * 100) / 100;
  const totalTaxable = order.subTotal != null ? order.subTotal : total - totalGst - roundOff;

  const thStyle: React.CSSProperties = { padding: '7px 8px', textAlign: 'right', fontSize: 13, fontWeight: 700, background: '#1c2b36', color: '#fff', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '6px 8px', textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#111', borderBottom: '1px solid #e8ecf0' };

  return (
    <div style={{ padding: 24, fontFamily: 'Arial, sans-serif', fontSize: 15, fontWeight: 500, color: '#111', background: '#fff' }}>
      <style>{`
        @media print {
          @page { margin: 8mm; }
          .print-invoice, .print-invoice * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'nowrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 20, borderBottom: '2px solid #1c2b36', paddingBottom: 16 }}>
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          {company?.logoUrl && (
            <img src={company.logoUrl} alt="logo" style={{ height: 42, marginBottom: 6, display: 'block' }} />
          )}
          <div style={{ fontSize: 22, fontWeight: 900, color: '#1c2b36', letterSpacing: -0.5 }}>{company?.name || 'Distribution Company'}</div>
          {company?.ownerName && <div style={{ fontSize: 13, color: '#1c2b36', fontWeight: 700, marginTop: 3 }}>Prop: {company.ownerName}</div>}
          {company?.address && <div style={{ fontSize: 13, fontWeight: 500, color: '#222', marginTop: 2 }}>{company.address}</div>}
          {(company?.city || company?.state) && (
            <div style={{ fontSize: 13, fontWeight: 500, color: '#222' }}>
              {[company.city, company.state, company.pinCode].filter(Boolean).join(', ')}
            </div>
          )}
          {company?.phone && <div style={{ fontSize: 13, color: '#1c2b36', fontWeight: 700, marginTop: 3 }}>Ph: {company.phone}</div>}
          {company?.gstin && <div style={{ fontSize: 13, color: '#1c2b36', fontWeight: 700 }}>GSTIN: {company.gstin}</div>}
          {company?.fssaiNumber && <div style={{ fontSize: 13, color: '#1c2b36', fontWeight: 700 }}>FSSAI: {company.fssaiNumber}</div>}
          {company?.panNumber && <div style={{ fontSize: 13, color: '#1c2b36', fontWeight: 700 }}>PAN: {company.panNumber}</div>}
          {company?.state && company?.stateCode && (
            <div style={{ fontSize: 13, fontWeight: 500, color: '#222' }}>State Name: {company.state}, Code: {company.stateCode}</div>
          )}
        </div>
        {company?.extraImageUrl && (
          <div style={{ flexShrink: 0, alignSelf: 'center' }}>
            <img src={company.extraImageUrl} alt="" style={{ height: 78, maxWidth: 90, objectFit: 'contain', display: 'block' }} />
          </div>
        )}
        <div style={{ textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1c2b36', letterSpacing: 1 }}>TAX INVOICE</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#222', marginTop: 4 }}>Invoice No: <strong style={{ color: '#1c2b36' }}>#{order.orderNumber}</strong></div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#222' }}>Date: <strong style={{ color: '#1c2b36' }}>{new Date(order.orderDate || order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
          {order.salesPerson?.fullName && (
            <div style={{ fontSize: 14, fontWeight: 500, color: '#222' }}>Salesman: <strong style={{ color: '#1c2b36' }}>{order.salesPerson.fullName}</strong></div>
          )}
          <div style={{ fontSize: 14, fontWeight: 500, color: '#222' }}>
            Term: <strong style={{ color: '#1c2b36' }}>{Number(order.balanceAmount || 0) > 0 ? 'CREDIT' : 'CASH'}</strong>
          </div>
        </div>
      </div>

      {/* Billed To / Order Info */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, marginBottom: 20, fontSize: 13 }}>
        <div style={{ flex: '1 1 220px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Billed To</div>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#1a1d2e' }}>{order.customer?.businessName}</div>
          <div style={{ fontWeight: 500, color: '#222', marginTop: 2 }}>{order.customer?.ownerName}</div>
          <div style={{ fontWeight: 500, color: '#222' }}>{order.customer?.phone}</div>
          {order.customer?.address && <div style={{ fontWeight: 500, color: '#222', marginTop: 2 }}>{order.customer.address}</div>}
          {(order.customer?.city || order.customer?.state || order.customer?.pinCode) && (
            <div style={{ fontWeight: 500, color: '#222' }}>
              {[order.customer.city, order.customer.state, order.customer.pinCode].filter(Boolean).join(', ')}
            </div>
          )}
          {order.customer?.gstin && <div style={{ color: '#1c2b36', marginTop: 4, fontWeight: 700 }}>GSTIN: {order.customer.gstin}</div>}
        </div>
        <div style={{ flex: '1 1 220px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Order Info</div>
          {order.customer?.routeName && <div style={{ fontWeight: 500, color: '#222' }}>Route: <strong style={{ color: '#1a1d2e' }}>{order.customer.routeName}</strong></div>}
          {order.customer?.routePlaceName && <div style={{ fontWeight: 500, color: '#222' }}>Place: <strong style={{ color: '#1a1d2e' }}>{order.customer.routePlaceName}</strong></div>}
          {order.salesPerson && (
            <div style={{ fontWeight: 500, color: '#222' }}>
              Sales By: <strong style={{ color: '#1a1d2e' }}>{order.salesPerson.fullName}</strong>
              {order.salesPerson.phone && <span style={{ color: '#444' }}> · {order.salesPerson.phone}</span>}
            </div>
          )}
          {order.deliveryPerson && <div style={{ fontWeight: 500, color: '#222' }}>Delivery By: <strong style={{ color: '#1a1d2e' }}>{order.deliveryPerson.fullName}</strong></div>}
          <div style={{ fontWeight: 500, color: '#222', marginTop: 4 }}>Status: <strong style={{ color: '#0f8a5f' }}>{order.status?.replace(/_/g, ' ')}</strong></div>
        </div>
      </div>

      {/* Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead>
          <tr style={{ background: '#1c2b36', color: '#fff' }}>
            <th style={{ ...thStyle, textAlign: 'left' }}>#</th>
            <th style={{ ...thStyle, textAlign: 'left' }}>Product</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>HSN</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Qty</th>
            <th style={{ ...thStyle }}>MRP</th>
            <th style={{ ...thStyle }}>Rate</th>
            <th style={{ ...thStyle }}>Disc</th>
            <th style={{ ...thStyle }}>GST%</th>
            <th style={{ ...thStyle }}>GST Amt</th>
            <th style={{ ...thStyle }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, i: number) => {
            const mrp = item.product?.mrp ?? item.mrp;
            return (
              <tr key={i} style={{ background: '#fff', borderBottom: '1px solid #e8ecf0' }}>
                <td style={{ padding: '7px 8px', fontWeight: 500, color: '#222', fontSize: 13 }}>{i + 1}</td>
                <td style={{ padding: '7px 8px' }}>
                  <div style={{ fontWeight: 700, color: '#1a1d2e', fontSize: 13 }}>{item.product?.name || item.productName}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#555' }}>{item.product?.brand}</div>
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 500, color: '#222', fontSize: 13 }}>
                  {item.product?.hsnCode || '—'}
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 700, fontSize: 13, color: '#1a1d2e' }}>
                  {item.quantity} {item.product?.unit || ''}
                </td>
                <td style={{ ...tdStyle }}>{mrp != null ? `₹${Number(mrp).toFixed(2)}` : '—'}</td>
                <td style={{ ...tdStyle }}>₹{(item.unitPrice || 0).toFixed(2)}</td>
                <td style={{ ...tdStyle }}>{item.discountAmount && item.discountAmount > 0 ? `₹${Number(item.discountAmount).toFixed(2)}` : '—'}</td>
                <td style={{ ...tdStyle }}>{item.gstPercent || 0}%</td>
                <td style={{ ...tdStyle }}>₹{(item.gstAmount || 0).toFixed(2)}</td>
                <td style={{ ...tdStyle, fontWeight: 700, color: '#1a1d2e' }}>₹{((item.unitPrice || 0) * (item.quantity || 0) - (item.discountAmount || 0)).toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* GST Summary + Totals */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 24 }}>
        {/* GST rate-wise table */}
        <div style={{ flex: '1 1 300px', maxWidth: 430 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Tax Summary</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: '#222', border: '1px solid #dde3ea' }}>Tax%</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#222', border: '1px solid #dde3ea' }}>Taxable</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#222', border: '1px solid #dde3ea' }}>CGST</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#222', border: '1px solid #dde3ea' }}>SGST</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#222', border: '1px solid #dde3ea' }}>Total GST</th>
              </tr>
            </thead>
            <tbody>
              {gstRates.map(rate => {
                const g = gstGroups[rate];
                const cgst = Math.round((g.gst / 2) * 100) / 100;
                const sgst = Math.round((g.gst / 2) * 100) / 100;
                return (
                  <tr key={rate}>
                    <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 500, color: '#222', border: '1px solid #dde3ea' }}>{rate}%</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 500, color: '#222', border: '1px solid #dde3ea' }}>₹{g.taxable.toFixed(2)}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 500, color: '#222', border: '1px solid #dde3ea' }}>₹{cgst.toFixed(2)}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 500, color: '#222', border: '1px solid #dde3ea' }}>₹{sgst.toFixed(2)}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 500, color: '#222', border: '1px solid #dde3ea' }}>₹{(cgst + sgst).toFixed(2)}</td>
                  </tr>
                );
              })}
              {gstRates.length > 1 && (
                <tr style={{ background: '#f1f5f9', fontWeight: 700, color: '#1a1d2e' }}>
                  <td style={{ padding: '5px 8px', textAlign: 'center', border: '1px solid #dde3ea' }}>Total</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #dde3ea' }}>₹{totalTaxable.toFixed(2)}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #dde3ea' }}>₹{totalCgst.toFixed(2)}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #dde3ea' }}>₹{totalSgst.toFixed(2)}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #dde3ea' }}>₹{(totalCgst + totalSgst).toFixed(2)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals block */}
        <div style={{ flex: '0 0 300px', minWidth: 260 }}>
          <div style={{ border: '1px solid #dde3ea', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px' }}>
              {overallDiscount > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14, fontWeight: 500 }}>
                    <span style={{ color: '#444' }}>Items Total (incl. GST)</span>
                    <span style={{ color: '#111' }}>₹{grossInclusive.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14, fontWeight: 600 }}>
                    <span style={{ color: '#dc2626' }}>
                      Less: Discount{order.overallDiscountType === 'PERCENT' && order.overallDiscountValue ? ` (${Number(order.overallDiscountValue)}%)` : ''}
                    </span>
                    <span style={{ color: '#dc2626' }}>−₹{overallDiscount.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14, fontWeight: 500 }}>
                <span style={{ color: '#444' }}>{overallDiscount > 0 ? 'Taxable Value' : 'Sub Total'}</span>
                <span style={{ color: '#111' }}>₹{totalTaxable.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14, fontWeight: 500 }}>
                <span style={{ color: '#444' }}>CGST</span>
                <span style={{ color: '#111' }}>₹{totalCgst.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14, fontWeight: 500 }}>
                <span style={{ color: '#444' }}>SGST</span>
                <span style={{ color: '#111' }}>₹{totalSgst.toFixed(2)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#1c2b36', color: '#fff', fontSize: 18, fontWeight: 800 }}>
              <span>Total Amount</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
            <div style={{ padding: '8px 14px' }}>
              {paidAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 14, fontWeight: 700, color: '#0f8a5f' }}>
                  <span>Paid</span>
                  <span>₹{paidAmount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 14, fontWeight: 700, color: balanceAmount > 0 ? '#dc2626' : '#0f8a5f' }}>
                <span>Balance Due</span>
                <span>₹{balanceAmount.toFixed(2)}</span>
              </div>
              {order.customer?.customerOutstanding != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0 2px', fontSize: 13, fontWeight: 700, color: Number(order.customer.customerOutstanding) > 0 ? '#dc2626' : '#222', borderTop: '1px dashed #dde3ea', marginTop: 5 }}>
                  <span>Total Outstanding</span>
                  <span>₹{Number(order.customer.customerOutstanding).toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Amount in words */}
      <div style={{ background: '#f8fafc', border: '1px solid #e8ecf0', borderRadius: 6, padding: '9px 14px', marginBottom: 20, fontSize: 14 }}>
        <span style={{ color: '#444', fontWeight: 500 }}>Amount in words: </span>
        <strong style={{ color: '#1a1d2e' }}>{toWords(total)}</strong>
      </div>

      {/* Notes + Signature */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 16 }}>
        <div style={{ maxWidth: 300 }}>
          {order.notes && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Notes</div>
              <div style={{ fontWeight: 500, color: '#222', fontSize: 13 }}>{order.notes}</div>
            </>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 40 }}>Authorized Signatory</div>
          <div style={{ borderTop: '1px solid #1a1d2e', paddingTop: 6, fontSize: 13, fontWeight: 700, color: '#1a1d2e' }}>
            {company?.name || 'StockEz'}
          </div>
        </div>
      </div>

      {/* Bank details & payment QR */}
      {(company?.bankName || company?.bankAccountNumber || company?.bankIfsc || company?.paymentQrImageUrl) && (
        <div style={{ display: 'flex', gap: 16, background: '#f8fafc', border: '1px solid #e8ecf0', borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>
          <div style={{ flex: '1 1 auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>Bank Details</div>
            {company?.bankName && <div style={{ fontSize: 13, color: '#222' }}>Bank: <strong style={{ color: '#1c2b36' }}>{company.bankName}</strong></div>}
            {company?.bankAccountName && <div style={{ fontSize: 13, color: '#222' }}>Account Name: <strong style={{ color: '#1c2b36' }}>{company.bankAccountName}</strong></div>}
            {company?.bankAccountNumber && <div style={{ fontSize: 13, color: '#222' }}>Account No: <strong style={{ color: '#1c2b36' }}>{company.bankAccountNumber}</strong></div>}
            {company?.bankBranch && <div style={{ fontSize: 13, color: '#222' }}>Branch: <strong style={{ color: '#1c2b36' }}>{company.bankBranch}</strong></div>}
            {company?.bankIfsc && <div style={{ fontSize: 13, color: '#222' }}>IFSC Code: <strong style={{ color: '#1c2b36' }}>{company.bankIfsc}</strong></div>}
          </div>
          {company?.paymentQrImageUrl && (
            <div style={{ flexShrink: 0, textAlign: 'center' }}>
              <img src={company.paymentQrImageUrl} alt="Payment QR" style={{ height: 88, width: 88, objectFit: 'contain', display: 'block' }} />
              <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>Scan to pay</div>
            </div>
          )}
        </div>
      )}

      {/* Terms & Conditions */}
      {company?.invoiceTerms && (
        <div style={{ background: '#f8fafc', border: '1px solid #e8ecf0', borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>Terms &amp; Conditions</div>
          <div style={{ fontWeight: 500, color: '#222', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{company.invoiceTerms}</div>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: '1px solid #e8ecf0', marginTop: 12, paddingTop: 10, textAlign: 'center' }}>
        {company?.invoiceFooterNote && (
          <div style={{ fontSize: 13, color: '#1c2b36', fontWeight: 500, lineHeight: 1.6, whiteSpace: 'pre-line', marginBottom: 6 }}>
            {company.invoiceFooterNote}
          </div>
        )}
        <div style={{ fontSize: 11, fontWeight: 500, color: '#888' }}>
          Generated by StockEz • Enterprise Distribution Platform
        </div>
      </div>
    </div>
  );
};

const InvoicePrint: React.FC<InvoicePrintProps> = ({ order, company }) => {
  if (!order) return null;
  return createPortal(
    <div className="print-invoice"><InvoiceContent order={order} company={company} /></div>,
    document.body,
  );
};

/** Print every invoice for a whole delivery run in one job — one bill per page. */
export const BulkInvoicePrint: React.FC<{ orders: any[]; company?: any }> = ({ orders, company }) => {
  if (!orders || orders.length === 0) return null;
  return createPortal(
    <div className="print-invoice">
      {orders.map((o: any, i: number) => (
        <div key={o.id} style={{ pageBreakAfter: i < orders.length - 1 ? 'always' : 'auto' }}>
          <InvoiceContent order={o} company={company} />
        </div>
      ))}
    </div>,
    document.body,
  );
};

export default InvoicePrint;
