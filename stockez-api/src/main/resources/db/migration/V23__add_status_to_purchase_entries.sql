-- V23: Purchase entry voiding — corrects a fully-mistaken entry without a hard delete, so
-- entry numbering (PUR-YYYY-NNNNN) and audit history stay intact. Same convention as the
-- existing goods-return cancellation (V20).
ALTER TABLE purchase_entries ADD COLUMN IF NOT EXISTS status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE';
