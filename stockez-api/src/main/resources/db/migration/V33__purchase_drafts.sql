CREATE TABLE IF NOT EXISTS purchase_drafts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    created_by      UUID REFERENCES users(id),
    created_by_name VARCHAR(200),
    updated_by_name VARCHAR(200),
    supplier_name   VARCHAR(200),
    invoice_number  VARCHAR(50),
    purchase_date   DATE,
    line_count      INTEGER NOT NULL DEFAULT 0,
    total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
    payload         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_drafts_tenant ON purchase_drafts (tenant_id, updated_at DESC);
