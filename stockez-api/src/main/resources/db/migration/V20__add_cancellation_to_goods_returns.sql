-- Allow voiding a Sales Return that's still PENDING_VERIFICATION (nothing has moved yet,
-- so cancellation is a plain status flip — no stock/balance/payment reversal needed).
ALTER TABLE goods_returns ADD COLUMN cancelled_by_id UUID REFERENCES users(id);
ALTER TABLE goods_returns ADD COLUMN cancelled_at TIMESTAMP;
ALTER TABLE goods_returns ADD COLUMN cancellation_reason VARCHAR(500);
