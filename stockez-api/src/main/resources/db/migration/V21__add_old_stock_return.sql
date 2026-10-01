-- Open / Legacy "Old Stock Return": an order-less sales return for goods that were sold
-- before the StockEz migration (or otherwise never registered as an order). It credits the
-- customer's opening balance (excess -> pending cash refund). Sellable goods create a fresh
-- batch; expired goods are written off (no stock movement — they were never in our stock).

ALTER TABLE goods_returns
    ADD COLUMN customer_id UUID REFERENCES customers(id);

-- Per-item condition and the batch pricing captured when restocking sellable legacy goods.
-- Null for all existing/normal return rows.
ALTER TABLE goods_return_items
    ADD COLUMN item_condition VARCHAR(20),
    ADD COLUMN mrp            NUMERIC(10,2),
    ADD COLUMN min_sale_rate  NUMERIC(10,2),
    ADD COLUMN max_sale_rate  NUMERIC(10,2),
    ADD COLUMN purchase_rate  NUMERIC(10,2),
    ADD COLUMN expiry_date    DATE;
