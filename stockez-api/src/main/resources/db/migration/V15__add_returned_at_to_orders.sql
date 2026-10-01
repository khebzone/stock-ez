ALTER TABLE orders ADD COLUMN returned_at TIMESTAMPTZ;

UPDATE orders SET returned_at = updated_at
WHERE status = 'RETURN_TO_WAREHOUSE' AND returned_at IS NULL;
