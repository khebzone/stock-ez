-- Cheque / Bank-transfer realisation lifecycle on payments.
-- Cash & UPI settle instantly (REALISED at collection). Instruments (cheque, NEFT, RTGS)
-- pass through PENDING -> DEPOSITED -> REALISED, or -> BOUNCED.
-- Existing rows already reduced their order balances, so they backfill as REALISED.

ALTER TABLE payments
    ADD COLUMN status          VARCHAR(20)   NOT NULL DEFAULT 'REALISED',
    ADD COLUMN instrument_date DATE,
    ADD COLUMN deposit_date    DATE,
    ADD COLUMN realised_date   DATE,
    ADD COLUMN drawee_bank     VARCHAR(150),
    ADD COLUMN deposit_bank    VARCHAR(150),
    ADD COLUMN bounce_reason   VARCHAR(300),
    ADD COLUMN bank_charges    NUMERIC(14,2);

CREATE INDEX idx_payments_status ON payments (tenant_id, status);
CREATE INDEX idx_payments_mode_status ON payments (tenant_id, payment_mode, status);
