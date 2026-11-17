-- Voiding a bill or removing a line reverses its batch to 0 received (kept, inactive);
-- the old > 0 rule made every such void fail.
ALTER TABLE stock_batches DROP CONSTRAINT IF EXISTS chk_batch_qty_received_pos;
ALTER TABLE stock_batches
    ADD CONSTRAINT chk_batch_qty_received_nonneg CHECK (quantity_received >= 0) NOT VALID;
