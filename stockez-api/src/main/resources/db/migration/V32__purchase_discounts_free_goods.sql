-- Purchase bill adjustments: bill discount (before GST, spread over lines), cash discount (after GST,
-- payable only), freight (added to landed cost), round-off, and the supplier's own invoice total.
ALTER TABLE purchase_entries ADD COLUMN IF NOT EXISTS bill_discount_type     VARCHAR(10);
ALTER TABLE purchase_entries ADD COLUMN IF NOT EXISTS bill_discount_value    NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE purchase_entries ADD COLUMN IF NOT EXISTS bill_discount_amount   NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE purchase_entries ADD COLUMN IF NOT EXISTS cash_discount_type     VARCHAR(10);
ALTER TABLE purchase_entries ADD COLUMN IF NOT EXISTS cash_discount_value    NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE purchase_entries ADD COLUMN IF NOT EXISTS cash_discount_amount   NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE purchase_entries ADD COLUMN IF NOT EXISTS freight_amount         NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE purchase_entries ADD COLUMN IF NOT EXISTS round_off_amount       NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE purchase_entries ADD COLUMN IF NOT EXISTS supplier_invoice_total NUMERIC(12,2);

-- Free goods (scheme) units, and each line's share of the bill discount and freight.
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS free_qty             INTEGER       NOT NULL DEFAULT 0;
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS bill_discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS freight_amount       NUMERIC(12,2) NOT NULL DEFAULT 0;

-- A line may now be entirely free (paid qty 0, e.g. "buy shampoo, get comb free").
ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS chk_purchase_items_qty_pos;
ALTER TABLE purchase_items
    ADD CONSTRAINT chk_purchase_items_units_pos
    CHECK (quantity >= 0 AND free_qty >= 0 AND quantity + free_qty > 0) NOT VALID;
