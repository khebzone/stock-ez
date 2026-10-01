// How a supplier settled a purchase return. Only ADJUST_AGAINST_BILL leaves our payable to them
// reduced — the other two hand the value back as cash or as goods, so the bill stands in full.
// Mirrors GoodsReturn.SettlementMode on the backend.

export type SettlementKey = 'ADJUST_AGAINST_BILL' | 'CASH_REFUND' | 'GOODS_REPLACED';

export const SETTLEMENT_OPTIONS: { value: SettlementKey; label: string; hint: string }[] = [
  {
    value: 'ADJUST_AGAINST_BILL',
    label: 'Adjusted against their bill',
    hint: 'Knocked off what we owe them — our payable stays reduced by this amount.',
  },
  {
    value: 'GOODS_REPLACED',
    label: 'Replaced with goods',
    hint: 'They sent stock of the same value. Stock is added back now and the bill stands in full.',
  },
  {
    value: 'CASH_REFUND',
    label: 'Refunded the money',
    hint: 'They paid us back, so the bill stands in full.',
  },
];

export const SETTLEMENT_LABEL: Record<SettlementKey, string> = {
  ADJUST_AGAINST_BILL: 'Adjusted vs bill',
  GOODS_REPLACED: 'Goods replaced',
  CASH_REFUND: 'Cash refunded',
};

export const SETTLED_MESSAGE: Record<SettlementKey, (amount: string) => string> = {
  ADJUST_AGAINST_BILL: (a) => `${a} knocked off the supplier's outstanding`,
  GOODS_REPLACED: (a) => `Replacement goods worth ${a} received — stock updated`,
  CASH_REFUND: (a) => `${a} received back from the supplier`,
};

/**
 * Downloads the debit note PDF for a supplier return.
 *
 * Goes through fetch rather than RTK Query because the response is a binary blob, and the endpoint
 * is authenticated — so the JWT and tenant headers have to be attached by hand, the same way
 * baseApi does it.
 */
export async function downloadDebitNotePdf(returnId: string, returnNumber: string): Promise<void> {
  const res = await fetch(
    `${import.meta.env.VITE_API_URL || ''}/api/v1/goods-returns/${returnId}/debit-note/pdf`,
    {
      headers: {
        authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        'X-Tenant-Id': localStorage.getItem('tenantId') || '',
      },
    },
  );
  if (!res.ok) throw new Error(`Could not generate the debit note (${res.status})`);

  const url = URL.createObjectURL(await res.blob());
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${returnNumber}.pdf`;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
