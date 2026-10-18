-- Customer returns: of the units the warehouse receives back, some may be damaged. Those are credited to
-- the customer but never restocked; they are written off through the shortage / loss report.
ALTER TABLE goods_return_items ADD COLUMN IF NOT EXISTS damaged_qty INTEGER NOT NULL DEFAULT 0;
ALTER TABLE goods_return_items ADD CONSTRAINT chk_goods_return_items_damaged_nonneg CHECK (damaged_qty >= 0);
