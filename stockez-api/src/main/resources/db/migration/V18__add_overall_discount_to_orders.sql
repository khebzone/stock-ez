-- Bill-level (overall) discount on sales orders / counter sales.
-- Applied before GST and apportioned across lines in the service layer, so the
-- customer sees a single discount line while GST stays correct.
ALTER TABLE orders ADD COLUMN overall_discount_type VARCHAR(10);
ALTER TABLE orders ADD COLUMN overall_discount_value NUMERIC(12, 2);
ALTER TABLE orders ADD COLUMN overall_discount_amount NUMERIC(12, 2) DEFAULT 0;
