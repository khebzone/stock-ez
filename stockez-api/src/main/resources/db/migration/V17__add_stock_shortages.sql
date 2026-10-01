-- Tracks inventory that left the warehouse (via a return or an undelivered order)
-- and never physically came back, so it stops being an invisible loss buried in
-- an audit-log sentence and becomes a queryable, reportable record.
CREATE TABLE stock_shortages (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              UUID NOT NULL REFERENCES tenants(id),
    product_id             UUID NOT NULL REFERENCES products(id),
    batch_number           VARCHAR(100),
    quantity_short         INTEGER NOT NULL,
    unit_rate              NUMERIC(10,2) NOT NULL,
    loss_value             NUMERIC(12,2) NOT NULL,
    source_type            VARCHAR(20) NOT NULL,   -- SALES_RETURN | UNDELIVERED_ORDER
    reference_number       VARCHAR(50) NOT NULL,   -- RTN-... or ORD-...
    reference_id           UUID NOT NULL,
    route_id               UUID REFERENCES routes(id),
    route_name             VARCHAR(150),
    responsible_person_id  UUID REFERENCES users(id),
    verified_by_id         UUID NOT NULL REFERENCES users(id),
    shortage_date          DATE NOT NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_shortage_tenant_date   ON stock_shortages(tenant_id, shortage_date DESC);
CREATE INDEX idx_stock_shortage_route         ON stock_shortages(tenant_id, route_id);
CREATE INDEX idx_stock_shortage_person        ON stock_shortages(tenant_id, responsible_person_id);
