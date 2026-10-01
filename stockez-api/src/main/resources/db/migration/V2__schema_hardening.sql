-- StockEz — V2 schema hardening (post go-live)
-- Additive only. No table drops, no data loss.
-- CHECK constraints are added NOT VALID: enforced on every new INSERT/UPDATE,
-- but existing rows are not scanned, so this migration cannot fail on legacy data.
-- (Run "ALTER TABLE ... VALIDATE CONSTRAINT ..." later, after cleaning any old violations.)

-- =========== #3 Non-negative quantities / amounts ===========
ALTER TABLE order_items
    ADD CONSTRAINT chk_order_items_qty_pos CHECK (quantity > 0) NOT VALID;

ALTER TABLE purchase_items
    ADD CONSTRAINT chk_purchase_items_qty_pos CHECK (quantity > 0) NOT VALID;

ALTER TABLE goods_return_items
    ADD CONSTRAINT chk_goods_return_items_qty_pos CHECK (quantity > 0) NOT VALID;

ALTER TABLE stock_batches
    ADD CONSTRAINT chk_batch_qty_received_pos  CHECK (quantity_received > 0)   NOT VALID;
ALTER TABLE stock_batches
    ADD CONSTRAINT chk_batch_qty_avail_nonneg  CHECK (quantity_available >= 0) NOT VALID;

ALTER TABLE products
    ADD CONSTRAINT chk_products_stock_nonneg CHECK (stock_quantity >= 0) NOT VALID;

-- =========== #4 Case-insensitive uniqueness ===========
-- App compares names case-insensitively; the original UNIQUE(tenant_id, name) is
-- case-sensitive, so "Manager" and "manager" could both be stored. These stricter
-- indexes close that gap. The original constraints stay (now redundant subsets).
CREATE UNIQUE INDEX uq_custom_roles_tenant_lower_name
    ON custom_roles (tenant_id, lower(name));

CREATE UNIQUE INDEX uq_expense_categories_tenant_lower_name
    ON expense_categories (tenant_id, lower(name))
    WHERE active = true;

-- =========== #5 FIFO costing precision ===========
-- Batch is what FIFO costs against; purchase_items already store 4 decimals.
ALTER TABLE stock_batches
    ALTER COLUMN purchase_rate TYPE NUMERIC(14,4);

-- =========== #6 Month-range checks (parity with brand_targets) ===========
ALTER TABLE sales_targets
    ADD CONSTRAINT chk_sales_targets_month CHECK (month BETWEEN 1 AND 12) NOT VALID;

ALTER TABLE incentive_credits
    ADD CONSTRAINT chk_incentive_credits_month CHECK (target_month BETWEEN 1 AND 12) NOT VALID;

ALTER TABLE collection_targets
    ADD CONSTRAINT chk_collection_targets_month CHECK (target_month BETWEEN 1 AND 12) NOT VALID;

ALTER TABLE collection_incentive_credits
    ADD CONSTRAINT chk_collection_credits_month CHECK (target_month BETWEEN 1 AND 12) NOT VALID;
