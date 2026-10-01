import React from 'react';
import { createPortal } from 'react-dom';
import { useGetDebitNoteQuery } from '../store/api/goodsReturnApi';

/**
 * DEBIT NOTE for goods sent back to a supplier.
 *
 * A purchase return is a debit note, not an invoice — it carries its own PRN serial, the supplier
 * invoice it relates to, and the HSN / taxable / CGST-SGST split the supplier's accountant needs
 * to pass the credit. Reuses the `print-invoice` isolation class from index.css.
 */

const fmt = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const pct = (v: any) => `${Number(v || 0)}%`;

function toWords(num: number): string {
  if (!num) return 'Zero Rupees Only';
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

const SETTLEMENT_TEXT: Record<string, string> = {
  ADJUST_AGAINST_BILL: 'Adjusted against our outstanding bill with you.',
  CASH_REFUND: 'Amount refunded to us.',
  GOODS_REPLACED: 'Settled — replacement goods of equal value received.',
};

const label: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#666',
  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4,
};
const th: React.CSSProperties = {
  border: '1px solid #ccc', padding: '6px 7px', fontSize: 11, fontWeight: 700,
  background: '#f4f4f4', color: '#333', textAlign: 'left',
};
const td: React.CSSProperties = {
  border: '1px solid #ddd', padding: '6px 7px', fontSize: 12, color: '#222',
};
const tdR: React.CSSProperties = { ...td, textAlign: 'right' };

const DebitNoteContent: React.FC<{ note: any }> = ({ note }) => {
  if (!note) return null;
  const c = note.company || {};
  const lines: any[] = note.lines || [];
  const slabs: any[] = note.gstSummary || [];

  const stateLine = [c.state, c.stateCode ? `(${c.stateCode})` : ''].filter(Boolean).join(' ');
  const address = [c.address, c.city, c.state].filter(Boolean).join(', ')
    + (c.pinCode ? ` - ${c.pinCode}` : '');

  const settled = note.refundStatus === 'PROCESSED' && note.settlementMode;

  return (
    <div style={{ padding: 24, fontFamily: 'Arial, sans-serif', color: '#1c2b36', background: '#fff' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, borderBottom: '2px solid #1c2b36', paddingBottom: 12 }}>
        <div style={{ flex: '1 1 58%' }}>
          {c.logoUrl && (
            <img src={c.logoUrl} alt="" style={{ height: 52, objectFit: 'contain', display: 'block', marginBottom: 6 }} />
          )}
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>{c.name}</div>
          {address.trim() !== '-' && <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{address}</div>}
          {c.phone && <div style={{ fontSize: 12, color: '#555' }}>Ph: {c.phone}</div>}
          {c.gstin && <div style={{ fontSize: 12, color: '#555' }}>GSTIN: <strong>{c.gstin}</strong></div>}
          {c.fssaiNumber && <div style={{ fontSize: 12, color: '#555' }}>FSSAI: {c.fssaiNumber}</div>}
        </div>
        <div style={{ flex: '0 0 38%', textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1 }}>DEBIT NOTE</div>
          <div style={{ fontSize: 11, color: '#777', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            (Purchase Return)
          </div>
          <table style={{ marginLeft: 'auto', fontSize: 12, borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ color: '#666', paddingRight: 8, textAlign: 'right' }}>No.</td>
                <td style={{ fontWeight: 700, textAlign: 'right' }}>{note.returnNumber}</td>
              </tr>
              <tr>
                <td style={{ color: '#666', paddingRight: 8, textAlign: 'right' }}>Date</td>
                <td style={{ textAlign: 'right' }}>{date(note.returnDate)}</td>
              </tr>
              {note.againstInvoiceNumber && (
                <tr>
                  <td style={{ color: '#666', paddingRight: 8, textAlign: 'right' }}>Against Invoice</td>
                  <td style={{ textAlign: 'right' }}>{note.againstInvoiceNumber}</td>
                </tr>
              )}
              {note.againstInvoiceDate && (
                <tr>
                  <td style={{ color: '#666', paddingRight: 8, textAlign: 'right' }}>Invoice Date</td>
                  <td style={{ textAlign: 'right' }}>{date(note.againstInvoiceDate)}</td>
                </tr>
              )}
              {note.againstEntryNumber && (
                <tr>
                  <td style={{ color: '#666', paddingRight: 8, textAlign: 'right' }}>Purchase Entry</td>
                  <td style={{ textAlign: 'right' }}>{note.againstEntryNumber}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Parties */}
      <div style={{ display: 'flex', gap: 14, margin: '14px 0' }}>
        <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: 4, padding: '10px 12px' }}>
          <div style={label}>Debit To (Supplier)</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{note.supplierName || '—'}</div>
          {note.supplierRefNumber && (
            <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>Supplier Ref: {note.supplierRefNumber}</div>
          )}
        </div>
        <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: 4, padding: '10px 12px' }}>
          <div style={label}>Returned By</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</div>
          {stateLine && <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>State: {stateLine}</div>}
          {note.createdByName && <div style={{ fontSize: 12, color: '#555' }}>Prepared by: {note.createdByName}</div>}
        </div>
      </div>

      {/* Items */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 32 }}>#</th>
            <th style={th}>Product</th>
            <th style={{ ...th, width: 70 }}>HSN</th>
            <th style={{ ...th, width: 110 }}>Batch</th>
            <th style={{ ...th, width: 70, textAlign: 'right' }}>Qty</th>
            <th style={{ ...th, width: 80, textAlign: 'right' }}>Rate</th>
            <th style={{ ...th, width: 90, textAlign: 'right' }}>Taxable</th>
            <th style={{ ...th, width: 55, textAlign: 'right' }}>GST%</th>
            <th style={{ ...th, width: 95, textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td style={td}>{i + 1}</td>
              <td style={td}>
                <div style={{ fontWeight: 600 }}>{l.productName}</div>
                {l.reason && <div style={{ fontSize: 11, color: '#777' }}>{l.reason}</div>}
              </td>
              <td style={td}>{l.hsnCode || '—'}</td>
              <td style={td}>{l.batchNumber || '—'}</td>
              <td style={tdR}>{l.quantity}{l.unitName ? ` ${l.unitName}` : ''}</td>
              <td style={tdR}>{fmt(l.unitRate)}</td>
              <td style={tdR}>{fmt(l.taxableAmount)}</td>
              <td style={tdR}>{pct(l.gstPercent)}</td>
              <td style={{ ...tdR, fontWeight: 600 }}>{fmt(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* GST break-up + totals */}
      <div style={{ display: 'flex', gap: 16, marginTop: 14, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 52%' }}>
          {slabs.length > 0 && (
            <>
              <div style={label}>GST Break-up</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 60 }}>Rate</th>
                    <th style={{ ...th, textAlign: 'right' }}>Taxable</th>
                    <th style={{ ...th, textAlign: 'right' }}>CGST</th>
                    <th style={{ ...th, textAlign: 'right' }}>SGST</th>
                  </tr>
                </thead>
                <tbody>
                  {slabs.map((s, i) => (
                    <tr key={i}>
                      <td style={td}>{pct(s.gstPercent)}</td>
                      <td style={tdR}>{fmt(s.taxableAmount)}</td>
                      <td style={tdR}>{fmt(s.cgst)}</td>
                      <td style={tdR}>{fmt(s.sgst)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div style={{ flex: '1 1 48%' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 0', color: '#555', textAlign: 'right' }}>Taxable Value</td>
                <td style={{ padding: '4px 0', textAlign: 'right', width: 120 }}>{fmt(note.totalTaxable)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0', color: '#555', textAlign: 'right' }}>Total GST</td>
                <td style={{ padding: '4px 0', textAlign: 'right' }}>{fmt(note.totalGst)}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0 4px', borderTop: '2px solid #1c2b36', fontWeight: 800, textAlign: 'right' }}>
                  Total Debited
                </td>
                <td style={{ padding: '8px 0 4px', borderTop: '2px solid #1c2b36', fontWeight: 800, fontSize: 16, textAlign: 'right' }}>
                  {fmt(note.totalAmount)}
                </td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: '#666', textAlign: 'right', marginTop: 4, fontStyle: 'italic' }}>
            {toWords(Number(note.totalAmount || 0))}
          </div>
        </div>
      </div>

      {note.reason && (
        <div style={{ marginTop: 14, fontSize: 12, color: '#444' }}>
          <span style={{ fontWeight: 700 }}>Reason for return:</span> {note.reason}
        </div>
      )}

      {/* Settlement */}
      <div style={{ marginTop: 14, border: '1px solid #ddd', borderRadius: 4, padding: '10px 12px', background: '#fafafa' }}>
        <div style={label}>Settlement</div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          {settled
            ? (SETTLEMENT_TEXT[note.settlementMode] || 'Settled.')
            : 'Outstanding — please credit our account or replace the goods.'}
        </div>
        {settled && note.refundDate && (
          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Settled on {date(note.refundDate)}</div>
        )}
      </div>

      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48 }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 12, color: '#888' }}>____________________</div>
          <div style={label}>Supplier's Acknowledgement</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: '#888' }}>____________________</div>
          <div style={label}>For {c.name}</div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #e8ecf0', marginTop: 20, paddingTop: 8, textAlign: 'center', fontSize: 11, color: '#999' }}>
        Generated by StockEz • Enterprise Distribution Platform
      </div>
    </div>
  );
};

/**
 * Fetches the debit note for `returnId` and renders it into the print layer.
 * The caller fires window.print() once `onReady` reports the data has landed —
 * printing before then would hand the user a blank page.
 */
const DebitNotePrint: React.FC<{ returnId: string | null; onReady?: () => void }> = ({ returnId, onReady }) => {
  const { data, isSuccess } = useGetDebitNoteQuery(returnId!, { skip: !returnId });
  const note = data?.data;

  React.useEffect(() => {
    if (isSuccess && note && onReady) onReady();
  }, [isSuccess, note, onReady]);

  if (!returnId || !note) return null;
  return createPortal(
    <div className="print-invoice"><DebitNoteContent note={note} /></div>,
    document.body,
  );
};

export default DebitNotePrint;
