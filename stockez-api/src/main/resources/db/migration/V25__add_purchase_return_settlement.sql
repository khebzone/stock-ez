-- A purchase return is a debit note: the supplier owes us the returned value.
-- How it gets settled decides whether our payable to them actually drops.
--
--   ADJUST_AGAINST_BILL  knocked off what we owe them        → payable stays reduced
--   CASH_REFUND          they paid the money back            → payable returns to full
--   GOODS_REPLACED       they sent goods of the same value   → payable returns to full, stock comes back
--
-- NULL means not settled yet: we are holding an open credit, so the payable is reduced.

ALTER TABLE goods_returns ADD COLUMN IF NOT EXISTS settlement_mode       VARCHAR(30);
ALTER TABLE goods_returns ADD COLUMN IF NOT EXISTS supplier_ref_number   VARCHAR(60);
ALTER TABLE goods_returns ADD COLUMN IF NOT EXISTS replacement_restocked BOOLEAN NOT NULL DEFAULT FALSE;

-- Returns already marked received before this migration were settled with no effect on the
-- payable, so they are recorded as CASH_REFUND to keep every existing supplier balance exactly
-- where it is today. Re-classify them by hand if a supplier in fact knocked it off a bill.
UPDATE goods_returns
   SET settlement_mode = 'CASH_REFUND'
 WHERE settlement_mode IS NULL
   AND refund_status = 'PROCESSED'
   AND (type = 'PURCHASE_RETURN' OR (type = 'DAMAGE' AND damage_source = 'SUPPLIER'));

-- Supplier-credit lookups run per supplier name and per referenced bill.
CREATE INDEX IF NOT EXISTS idx_goods_return_supplier_credit
    ON goods_returns (tenant_id, supplier_name, type);

CREATE INDEX IF NOT EXISTS idx_goods_return_purchase_entry
    ON goods_returns (tenant_id, purchase_entry_id);
