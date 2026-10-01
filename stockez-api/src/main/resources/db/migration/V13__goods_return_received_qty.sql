-- Warehouse verification now captures the actual quantity physically received
-- (vs the quantity filed), so shortfalls handed over by the delivery person are recorded.
ALTER TABLE goods_return_items
    ADD COLUMN received_qty INTEGER;

ALTER TABLE goods_returns
    ADD COLUMN verified_by_id UUID REFERENCES users(id),
    ADD COLUMN verified_at    TIMESTAMPTZ;
