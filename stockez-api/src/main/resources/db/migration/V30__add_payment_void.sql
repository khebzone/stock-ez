ALTER TABLE payments
    ADD COLUMN voided        BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN voided_at     TIMESTAMPTZ,
    ADD COLUMN voided_by_id  UUID REFERENCES users(id),
    ADD COLUMN void_reason   VARCHAR(300);

CREATE INDEX idx_payments_voided ON payments(tenant_id) WHERE voided = TRUE;
