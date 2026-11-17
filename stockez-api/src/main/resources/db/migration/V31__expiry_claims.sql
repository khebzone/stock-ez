-- Expiry claims: expired (or near-expiry) batches claimed back from the supplier.
-- An expiry claim is a supplier-caused DAMAGE return flagged expiry_claim, so the supplier
-- payable, debit note and Refunds & Claims screens keep working unchanged.
ALTER TABLE goods_returns ADD COLUMN IF NOT EXISTS expiry_claim BOOLEAN NOT NULL DEFAULT FALSE;

-- Part of a supplier claim the supplier refused (partial acceptance or outright rejection).
-- It is a loss to us and never reduces what we owe them.
ALTER TABLE goods_returns ADD COLUMN IF NOT EXISTS written_off_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Units the supplier accepted on each claim line; NULL until the claim is settled.
ALTER TABLE goods_return_items ADD COLUMN IF NOT EXISTS accepted_qty INTEGER;

CREATE INDEX IF NOT EXISTS idx_goods_return_expiry_claim
    ON goods_returns (tenant_id, return_date DESC) WHERE expiry_claim = TRUE;
