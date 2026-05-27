import React from 'react';
import { useGetCompanyProfileQuery } from '../store/api/supplierApi';

interface Props { purchase: any; }

const PurchasePrint: React.FC<Props> = ({ purchase }) => {
  const { data: profileData } = useGetCompanyProfileQuery();
  const company = profileData?.data;
  if (!purchase) return null;
  const items = purchase.items || [];

  return (
    <div className="print-invoice" style={{ padding: 32, fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#000', background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, borderBottom: '2px solid #1c2b36', paddingBottom: 20 }}>
        <div>
          {company?.logoUrl && <img src={company.logoUrl} alt="logo" style={{ height: 40, marginBottom: 6, display: 'block' }} />}
          <div style={{ fontSize: 18, fontWeight: 900, color: '#1c2b36' }}>{company?.name || 'Distribution Company'}</div>
          {company?.address && <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>{company.address}</div>}
          {(company?.city || company?.state) && (
            <div style={{ fontSize: 11, color: '#555' }}>{[company.city, company.state, company.pinCode].filter(Boolean).join(', ')}</div>
          )}
          {company?.phone && <div style={{ fontSize: 11, color: '#555' }}>Ph: {company.phone}</div>}
          {company?.gstin && <div style={{ fontSize: 11, color: '#555', fontWeight: 700 }}>GSTIN: {company.gstin}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1c2b36', letterSpacing: 1 }}>PURCHASE ENTRY</div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>Entry No: <strong>{purchase.entryNumber}</strong></div>
          <div style={{ fontSize: 12, color: '#555' }}>Date: <strong>{purchase.purchaseDate}</strong></div>
          {purchase.invoiceNumber && <div style={{ fontSize: 12, color: '#555' }}>Supplier Inv: <strong>{purchase.invoiceNumber}</strong></div>}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Supplier</div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{purchase.supplierName}</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: 11 }}>
        <thead>
          <tr style={{ background: '#1c2b36', color: '#fff' }}>
            {['#', 'Product', 'Batch', 'Expiry', 'Qty', 'MRP', 'Pur. Rate', 'Taxable', 'CGST', 'SGST', 'Amount'].map(h => (
              <th key={h} style={{ padding: '7px 8px', textAlign: h === '#' || h === 'Qty' || h === 'Batch' || h === 'Expiry' ? 'center' : h === 'Product' ? 'left' : 'right' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, i: number) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e8ecf0' }}>
              <td style={{ padding: '6px 8px', textAlign: 'center', color: '#555' }}>{i + 1}</td>
              <td style={{ padding: '6px 8px' }}>
                <div style={{ fontWeight: 600 }}>{item.product?.name}</div>
                <div style={{ fontSize: 10, color: '#888' }}>{item.product?.brand} · {item.product?.unit}</div>
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'center', color: '#555' }}>{item.batchNumber}</td>
              <td style={{ padding: '6px 8px', textAlign: 'center', color: '#555' }}>{item.expiryDate || '—'}</td>
              <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>₹{Number(item.mrp).toFixed(2)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>₹{Number(item.purchaseRate).toFixed(2)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>₹{Number(item.taxableAmount || 0).toFixed(2)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#555' }}>₹{Number(item.cgstAmount || 0).toFixed(2)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#555' }}>₹{Number(item.sgstAmount || 0).toFixed(2)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>₹{Number(item.amount).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <div style={{ minWidth: 260 }}>
          {[
            { label: 'Taxable Amount', value: purchase.totalTaxable },
            { label: 'CGST', value: purchase.totalCgst },
            { label: 'SGST', value: purchase.totalSgst },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e8ecf0', fontSize: 13 }}>
              <span style={{ color: '#555' }}>{r.label}</span>
              <span>₹{Number(r.value || 0).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 15, fontWeight: 800, color: '#1c2b36', borderTop: '2px solid #1c2b36', marginTop: 4 }}>
            <span>Net Total</span>
            <span>₹{Number(purchase.totalAmount).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {purchase.notes && (
        <div style={{ background: '#f8fafc', border: '1px solid #e8ecf0', borderRadius: 4, padding: '6px 12px', marginBottom: 16, fontSize: 12 }}>
          <span style={{ color: '#888' }}>Notes: </span>{purchase.notes}
        </div>
      )}

      <div style={{ borderTop: '1px solid #e8ecf0', marginTop: 20, paddingTop: 12, textAlign: 'center', fontSize: 10, color: '#aaa' }}>
        Generated by StockEz • Enterprise Distribution Platform
      </div>
    </div>
  );
};

export default PurchasePrint;
