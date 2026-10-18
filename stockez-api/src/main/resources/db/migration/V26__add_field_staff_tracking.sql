-- Field staff location tracking and visit log.
-- Tracking defaults to OFF: this is a live system with real staff, so the owner opts in explicitly.

ALTER TABLE tenant_settings
    ADD COLUMN IF NOT EXISTS location_tracking_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS location_ping_interval_seconds INTEGER NOT NULL DEFAULT 90,
    ADD COLUMN IF NOT EXISTS track_only_when_checked_in    BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS location_retention_days       INTEGER NOT NULL DEFAULT 90;

-- Breadcrumb trail. One row per accepted ping; the client suppresses pings that have not moved,
-- so row growth tracks actual movement rather than elapsed time.
CREATE TABLE IF NOT EXISTS staff_locations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    user_id     UUID NOT NULL REFERENCES users(id),
    recorded_at TIMESTAMPTZ NOT NULL,
    latitude    DOUBLE PRECISION NOT NULL CHECK (latitude  BETWEEN -90  AND 90),
    longitude   DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    accuracy_m  DOUBLE PRECISION,
    source      VARCHAR(20) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_loc_user_time ON staff_locations (tenant_id, user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_loc_purge     ON staff_locations (recorded_at);

-- Visit log. Exists so that "went, no order" and "never went" stop being the same absence of a row.
CREATE TABLE IF NOT EXISTS customer_visits (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES tenants(id),
    user_id              UUID NOT NULL REFERENCES users(id),
    customer_id          UUID NOT NULL REFERENCES customers(id),
    route_allocation_id  UUID REFERENCES route_allocations(id),
    visit_date           DATE NOT NULL,
    visited_at           TIMESTAMPTZ NOT NULL,
    outcome              VARCHAR(25) NOT NULL,
    order_id             UUID REFERENCES orders(id),
    payment_id           UUID REFERENCES payments(id),
    latitude             DOUBLE PRECISION,
    longitude            DOUBLE PRECISION,
    accuracy_m           DOUBLE PRECISION,
    distance_from_shop_m INTEGER,
    location_status      VARCHAR(20) NOT NULL,
    reason               VARCHAR(200),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_user_date  ON customer_visits (tenant_id, user_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_visit_customer   ON customer_visits (tenant_id, customer_id, visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_visit_tenant_day ON customer_visits (tenant_id, visit_date);
