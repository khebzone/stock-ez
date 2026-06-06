-- DistroIQ — Complete Schema (consolidated)
-- PostgreSQL 15+

-- =========== TENANTS ===========
CREATE TABLE tenants (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(100) NOT NULL UNIQUE,
    schema_name  VARCHAR(50)  NOT NULL UNIQUE,
    subdomain    VARCHAR(100) NOT NULL UNIQUE,
    owner_name   VARCHAR(50)  NOT NULL,
    phone        VARCHAR(15)  NOT NULL UNIQUE,
    email        VARCHAR(100) NOT NULL UNIQUE,
    gstin        VARCHAR(15),
    fssai_number VARCHAR(20),
    pan_number   VARCHAR(10),
    address      VARCHAR(500),
    city         VARCHAR(100),
    state        VARCHAR(50),
    pin_code     VARCHAR(10),
    status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    logo_url        VARCHAR(500),
    trial_ends_at   TIMESTAMPTZ,
    plan            VARCHAR(20)  NOT NULL DEFAULT 'TRIAL',
    billing_cycle   VARCHAR(10)  NOT NULL DEFAULT 'MONTHLY',
    plan_end_date   DATE,
    max_users       INT          NOT NULL DEFAULT 5,
    notes           TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

-- =========== TENANT SETTINGS ===========
CREATE TABLE tenant_settings (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                       UUID NOT NULL UNIQUE REFERENCES tenants(id),
    invoice_approval_required       BOOLEAN NOT NULL DEFAULT true,
    picklist_enabled                BOOLEAN NOT NULL DEFAULT true,
    goods_return_approval_required  BOOLEAN NOT NULL DEFAULT false,
    credit_limit_enforcement        VARCHAR(20) NOT NULL DEFAULT 'HARD_BLOCK',
    max_discount_percent            DECIMAL(5,2),
    lock_billing_after_checkout     BOOLEAN NOT NULL DEFAULT false,
    separate_delivery_allocation    BOOLEAN NOT NULL DEFAULT false,
    discount_type                   VARCHAR(10) NOT NULL DEFAULT 'PERCENT',
    updated_at                      TIMESTAMPTZ
);

-- =========== SUPPLIERS ===========
CREATE TABLE suppliers (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id),
    name             VARCHAR(200) NOT NULL,
    contact_person   VARCHAR(100),
    phone            VARCHAR(15)  NOT NULL,
    alt_phone        VARCHAR(15),
    email            VARCHAR(100),
    address          VARCHAR(500),
    city             VARCHAR(100),
    state            VARCHAR(50),
    gstin            VARCHAR(15),
    fssai_number     VARCHAR(20),
    bank_name        VARCHAR(100),
    bank_account     VARCHAR(30),
    bank_ifsc        VARCHAR(15),
    opening_balance  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_supplier_phone_per_tenant ON suppliers (tenant_id, phone) WHERE active = true;

-- =========== USERS ===========
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    full_name           VARCHAR(100) NOT NULL,
    phone               VARCHAR(15)  NOT NULL,
    email               VARCHAR(100),
    password_hash       VARCHAR(255) NOT NULL,
    role                VARCHAR(20)  NOT NULL,
    custom_role_id      UUID,
    profile_image_url   VARCHAR(500),
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    salary              DECIMAL(12,2),
    employment_type     VARCHAR(20),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ,
    UNIQUE(phone, tenant_id),
    UNIQUE(email, tenant_id)
);

-- =========== PRODUCT MASTERS ===========
CREATE TABLE product_masters (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    type        VARCHAR(30)  NOT NULL,
    name        VARCHAR(150) NOT NULL,
    parent_name VARCHAR(150),
    value       VARCHAR(50),
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE UNIQUE INDEX uq_master_type_name_per_tenant
    ON product_masters (tenant_id, type, lower(name), lower(coalesce(parent_name, ''))) WHERE active = true;

-- =========== PRODUCTS ===========
CREATE TABLE products (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES tenants(id),
    name                 VARCHAR(200) NOT NULL,
    hsn_code             VARCHAR(50),
    brand                VARCHAR(100),
    category             VARCHAR(100),
    sub_category         VARCHAR(100),
    unit                 VARCHAR(20),
    mrp                  NUMERIC(10,2) NOT NULL,
    purchase_rate        NUMERIC(10,2) NOT NULL,
    min_sale_rate        NUMERIC(10,2),
    max_sale_rate        NUMERIC(10,2),
    purchase_gst_percent NUMERIC(5,2)  NOT NULL DEFAULT 0,
    sales_gst_percent    NUMERIC(5,2)  NOT NULL,
    cgst_percent         NUMERIC(5,2)  DEFAULT 0,
    sgst_percent         NUMERIC(5,2)  DEFAULT 0,
    image_url            VARCHAR(500),
    description          VARCHAR(1000),
    stock_quantity       INT DEFAULT 0,
    mfg_date             DATE,
    expiry_date          DATE,
    active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ
);

-- =========== VEHICLES ===========
CREATE TABLE vehicles (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenants(id),
    vehicle_number           VARCHAR(20)  NOT NULL,
    vehicle_type             VARCHAR(50)  NOT NULL DEFAULT 'VAN',
    model                    VARCHAR(100),
    fc_expiry_date           DATE,
    insurance_number         VARCHAR(50),
    insurance_expiry_date    DATE,
    puc_expiry_date          DATE,
    goods_permit_expiry_date DATE,
    last_service_date        DATE,
    next_service_due_date    DATE,
    active                   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_vehicle_number_per_tenant
    ON vehicles (tenant_id, upper(vehicle_number)) WHERE active = true;

-- =========== ROUTES ===========
CREATE TABLE routes (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenants(id),
    name                     VARCHAR(100) NOT NULL,
    description              VARCHAR(500),
    active                   BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_sales_person_id UUID REFERENCES users(id),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_route_name_active_per_tenant
    ON routes (tenant_id, lower(name)) WHERE active = true;

-- =========== ROUTE PLACES ===========
CREATE TABLE route_places (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id    UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    sort_order  INTEGER NOT NULL DEFAULT 0,
    active      BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE UNIQUE INDEX uq_place_name_active_per_route
    ON route_places (route_id, lower(name)) WHERE active = true;

-- =========== CUSTOMERS ===========
CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    business_name   VARCHAR(200) NOT NULL,
    owner_name      VARCHAR(100) NOT NULL,
    phone           VARCHAR(15)  NOT NULL,
    alt_phone       VARCHAR(15),
    email           VARCHAR(100),
    address         VARCHAR(500),
    gstin           VARCHAR(15),
    route_id        UUID NOT NULL REFERENCES routes(id),
    route_place_id  UUID NOT NULL REFERENCES route_places(id),
    credit_allowed  BOOLEAN NOT NULL DEFAULT FALSE,
    credit_days     INT DEFAULT 0,
    credit_limit    NUMERIC(10,2) DEFAULT 0,
    visit_order     INTEGER NOT NULL DEFAULT 0,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    owner_image_url VARCHAR(500),
    shop_image_url  VARCHAR(500),
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_customer_phone_active_per_tenant
    ON customers (tenant_id, phone) WHERE active = true;

-- =========== ROUTE ALLOCATIONS (Gate Passes) ===========
CREATE TABLE route_allocations (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    route_id              UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    allocation_date       DATE NOT NULL,
    sales_person_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    delivery_person_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    sales_vehicle_id      UUID REFERENCES vehicles(id),
    delivery_vehicle_id   UUID REFERENCES vehicles(id),
    sales_start_km        INTEGER,
    sales_end_km          INTEGER,
    delivery_start_km     INTEGER,
    delivery_end_km       INTEGER,
    warehouse_person_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    status                VARCHAR(20) DEFAULT 'ACTIVE',
    notes                 TEXT,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_route_per_day UNIQUE (tenant_id, route_id, allocation_date)
);

-- =========== ORDERS ===========
CREATE TABLE orders (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES tenants(id),
    order_number       VARCHAR(50) NOT NULL UNIQUE,
    customer_id        UUID NOT NULL REFERENCES customers(id),
    sales_person_id    UUID NOT NULL REFERENCES users(id),
    delivery_person_id UUID REFERENCES users(id),
    approved_by_id     UUID REFERENCES users(id),
    order_date         DATE NOT NULL,
    status             VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    sub_total          NUMERIC(10,2) DEFAULT 0,
    total_gst          NUMERIC(10,2) DEFAULT 0,
    total_amount       NUMERIC(10,2) DEFAULT 0,
    paid_amount        NUMERIC(10,2) DEFAULT 0,
    balance_amount     NUMERIC(10,2) DEFAULT 0,
    notes              VARCHAR(1000),
    invoice_url        VARCHAR(500),
    approved_at        TIMESTAMPTZ,
    prepared_at        TIMESTAMPTZ,
    dispatched_at      TIMESTAMPTZ,
    delivered_at       TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ
);

-- =========== ORDER ITEMS ===========
CREATE TABLE order_items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id       UUID NOT NULL REFERENCES products(id),
    quantity         INT NOT NULL,
    unit_price       NUMERIC(10,2) NOT NULL,
    discount_percent NUMERIC(5,2)  NOT NULL DEFAULT 0,
    discount_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
    gst_percent      NUMERIC(5,2)  NOT NULL,
    gst_amount       NUMERIC(10,2) NOT NULL,
    line_total       NUMERIC(10,2) NOT NULL,
    batch_number     VARCHAR(100),
    batch_expiry_date DATE,
    verified         BOOLEAN NOT NULL DEFAULT FALSE,
    verified_quantity INT
);

-- =========== PAYMENT METHODS ===========
CREATE TABLE payment_methods (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    name        VARCHAR(100) NOT NULL,
    mode        VARCHAR(30)  NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE UNIQUE INDEX uq_payment_method_per_tenant
    ON payment_methods (tenant_id, lower(name)) WHERE active = true;

-- =========== PAYMENTS ===========
CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    order_id            UUID NOT NULL REFERENCES orders(id),
    collected_by_id     UUID NOT NULL REFERENCES users(id),
    verified_by_id      UUID REFERENCES users(id),
    amount              NUMERIC(10,2) NOT NULL,
    payment_mode        VARCHAR(20) NOT NULL,
    payment_method_name VARCHAR(100),
    reference_number    VARCHAR(200),
    collection_date     DATE NOT NULL,
    cleared             BOOLEAN NOT NULL DEFAULT FALSE,
    cleared_at          TIMESTAMPTZ,
    submitted           BOOLEAN NOT NULL DEFAULT FALSE,
    submitted_at        TIMESTAMP WITH TIME ZONE,
    notes               VARCHAR(500),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========== PURCHASE ENTRIES ===========
CREATE TABLE purchase_entries (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES tenants(id),
    entry_number   VARCHAR(50) NOT NULL UNIQUE,
    supplier_id    UUID REFERENCES suppliers(id),
    supplier_name  VARCHAR(200) NOT NULL,
    purchase_date  DATE NOT NULL,
    invoice_number VARCHAR(50),
    total_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_taxable  NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_cgst     NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_sgst     NUMERIC(12,2) NOT NULL DEFAULT 0,
    notes          VARCHAR(1000),
    created_by_id  UUID NOT NULL REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========== PURCHASE ITEMS ===========
CREATE TABLE purchase_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_entry_id UUID NOT NULL REFERENCES purchase_entries(id) ON DELETE CASCADE,
    product_id        UUID NOT NULL REFERENCES products(id),
    batch_number      VARCHAR(100) NOT NULL,
    mrp               NUMERIC(10,2) NOT NULL,
    rate_excl_gst     NUMERIC(10,4) NOT NULL DEFAULT 0,
    discount_percent  NUMERIC(5,2)  NOT NULL DEFAULT 0,
    discount_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
    taxable_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
    gst_percent       NUMERIC(5,2)  NOT NULL DEFAULT 0,
    gst_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
    cgst_percent      NUMERIC(5,2)  NOT NULL DEFAULT 0,
    sgst_percent      NUMERIC(5,2)  NOT NULL DEFAULT 0,
    cgst_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
    sgst_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
    purchase_rate     NUMERIC(10,4) NOT NULL,
    mfg_date          DATE,
    expiry_date       DATE,
    quantity          INTEGER NOT NULL,
    amount            NUMERIC(12,2) NOT NULL
);

-- =========== STOCK BATCHES ===========
CREATE TABLE stock_batches (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES tenants(id),
    product_id         UUID NOT NULL REFERENCES products(id),
    purchase_item_id   UUID REFERENCES purchase_items(id),
    batch_number       VARCHAR(100) NOT NULL,
    mrp                NUMERIC(10,2) NOT NULL,
    purchase_rate      NUMERIC(10,2) NOT NULL,
    min_sale_rate      NUMERIC(10,2),
    max_sale_rate      NUMERIC(10,2),
    mfg_date           DATE,
    expiry_date        DATE,
    quantity_received  INTEGER NOT NULL,
    quantity_available INTEGER NOT NULL DEFAULT 0,
    received_date      DATE NOT NULL,
    active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========== SALES TARGETS ===========
CREATE TABLE sales_targets (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES tenants(id),
    user_id        UUID NOT NULL REFERENCES users(id),
    month          INTEGER NOT NULL,
    year           INTEGER NOT NULL,
    target_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
    target_orders  INTEGER NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id, month, year)
);

-- =========== DAY CLOSURES ===========
CREATE TABLE day_closures (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES tenants(id),
    closure_date          DATE NOT NULL,
    opening_cash          NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_cash            NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_upi             NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_cheque          NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_neft            NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_collected       NUMERIC(12,2) NOT NULL DEFAULT 0,
    expected_cash_closing NUMERIC(12,2) NOT NULL DEFAULT 0,
    physical_cash_entered NUMERIC(12,2) NOT NULL DEFAULT 0,
    difference            NUMERIC(12,2) NOT NULL DEFAULT 0,
    status                VARCHAR(10) NOT NULL DEFAULT 'CLOSED',
    notes                 VARCHAR(500),
    closed_by             VARCHAR(200),
    closed_at             TIMESTAMP WITH TIME ZONE,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uq_day_closure_tenant_date UNIQUE (tenant_id, closure_date)
);

-- =========== GOODS RETURNS ===========
CREATE TABLE goods_returns (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES tenants(id),
    return_number        VARCHAR(50) NOT NULL UNIQUE,
    type                 VARCHAR(20) NOT NULL,
    order_id             UUID REFERENCES orders(id),
    supplier_name        VARCHAR(200),
    return_date          DATE NOT NULL,
    reason               VARCHAR(500),
    total_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
    refund_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
    refund_status        VARCHAR(20) NOT NULL DEFAULT 'NONE',
    refund_date          DATE,
    refund_mode          VARCHAR(20),
    refund_processed_by  UUID REFERENCES users(id),
    refund_processed_at  TIMESTAMPTZ,
    refund_notes         VARCHAR(500),
    created_by_id        UUID REFERENCES users(id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE goods_return_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goods_return_id UUID NOT NULL REFERENCES goods_returns(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    batch_number    VARCHAR(100),
    quantity        INT NOT NULL,
    unit_rate       NUMERIC(10,2) NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    reason          VARCHAR(200)
);

-- =========== INDEXES ===========
CREATE INDEX idx_users_tenant             ON users(tenant_id);
CREATE INDEX idx_users_phone              ON users(phone);
CREATE INDEX idx_products_tenant          ON products(tenant_id);
CREATE INDEX idx_products_category        ON products(category);
CREATE INDEX idx_products_brand           ON products(brand);
CREATE INDEX idx_products_active          ON products(active);
CREATE INDEX idx_routes_tenant            ON routes(tenant_id);
CREATE INDEX idx_route_places_route       ON route_places(route_id);
CREATE INDEX idx_customers_tenant         ON customers(tenant_id);
CREATE INDEX idx_customers_route          ON customers(route_id);
CREATE INDEX idx_customers_place          ON customers(route_place_id);
CREATE INDEX idx_vehicle_tenant           ON vehicles(tenant_id);
CREATE INDEX idx_allocation_tenant        ON route_allocations(tenant_id);
CREATE INDEX idx_allocation_date          ON route_allocations(allocation_date);
CREATE INDEX idx_allocation_sales_person  ON route_allocations(sales_person_id);
CREATE INDEX idx_allocation_delivery      ON route_allocations(delivery_person_id);
CREATE INDEX idx_allocation_route         ON route_allocations(route_id);
CREATE INDEX idx_allocation_sales_vehicle ON route_allocations(sales_vehicle_id);
CREATE INDEX idx_allocation_del_vehicle   ON route_allocations(delivery_vehicle_id);
CREATE INDEX idx_allocation_warehouse     ON route_allocations(warehouse_person_id);
CREATE INDEX idx_orders_tenant            ON orders(tenant_id);
CREATE INDEX idx_orders_status            ON orders(status);
CREATE INDEX idx_orders_date              ON orders(order_date);
CREATE INDEX idx_orders_sales_person      ON orders(sales_person_id);
CREATE INDEX idx_orders_delivery_person   ON orders(delivery_person_id);
CREATE INDEX idx_order_items_order        ON order_items(order_id);
CREATE INDEX idx_payments_tenant          ON payments(tenant_id);
CREATE INDEX idx_payments_order           ON payments(order_id);
CREATE INDEX idx_payments_collector       ON payments(collected_by_id);
CREATE INDEX idx_payments_date            ON payments(collection_date);
CREATE INDEX idx_payments_cleared         ON payments(cleared);
CREATE INDEX idx_payment_submitted        ON payments(tenant_id, submitted, cleared);
CREATE INDEX idx_purchase_tenant          ON purchase_entries(tenant_id);
CREATE INDEX idx_purchase_date            ON purchase_entries(purchase_date);
CREATE INDEX idx_purchaseitem_entry       ON purchase_items(purchase_entry_id);
CREATE INDEX idx_batch_tenant             ON stock_batches(tenant_id);
CREATE INDEX idx_batch_product            ON stock_batches(product_id);
CREATE INDEX idx_batch_expiry             ON stock_batches(expiry_date);
CREATE INDEX idx_batch_active             ON stock_batches(active);
CREATE INDEX idx_day_closure_tenant_date  ON day_closures(tenant_id, closure_date DESC);
CREATE INDEX idx_goods_return_tenant      ON goods_returns(tenant_id, return_date DESC);
CREATE INDEX idx_goods_return_type        ON goods_returns(tenant_id, type);
CREATE INDEX idx_goods_return_item        ON goods_return_items(goods_return_id);

-- =========== EXPENSE CATEGORIES ===========
CREATE TABLE expense_categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    name        VARCHAR(100) NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- =========== EXPENSES ===========
CREATE TABLE expenses (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id),
    expense_date     DATE NOT NULL,
    category_id      UUID NOT NULL REFERENCES expense_categories(id),
    description      VARCHAR(500),
    amount           DECIMAL(12,2) NOT NULL,
    payment_mode     VARCHAR(20) NOT NULL DEFAULT 'CASH',
    reference_number VARCHAR(100),
    recorded_by      UUID REFERENCES users(id),
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ
);

CREATE INDEX idx_expense_tenant_date   ON expenses(tenant_id, expense_date DESC);
CREATE INDEX idx_expense_category      ON expenses(category_id);
CREATE INDEX idx_expense_cat_tenant    ON expense_categories(tenant_id);

-- =========== AUDIT LOG ===========
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID         NOT NULL REFERENCES tenants(id),
    entity_type     VARCHAR(50)  NOT NULL,
    entity_id       UUID         NOT NULL,
    action          VARCHAR(50)  NOT NULL,
    description     TEXT         NOT NULL,
    performed_by    VARCHAR(100),
    performed_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_entity ON audit_logs (tenant_id, entity_type, entity_id, performed_at DESC);
CREATE INDEX idx_audit_tenant  ON audit_logs (tenant_id, performed_at DESC);

-- =========== SUPPLIER PAYMENTS ===========
CREATE TABLE supplier_payments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id),
    purchase_entry_id UUID REFERENCES purchase_entries(id),
    supplier_name     VARCHAR(200) NOT NULL,
    amount            NUMERIC(12,2) NOT NULL,
    payment_date      DATE NOT NULL,
    payment_method    VARCHAR(30) NOT NULL DEFAULT 'CASH',
    reference_number  VARCHAR(100),
    notes             VARCHAR(500),
    created_by_id     UUID NOT NULL REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_supplier_payments_tenant ON supplier_payments (tenant_id, payment_date DESC);
CREATE INDEX idx_supplier_payments_entry  ON supplier_payments (purchase_entry_id);

-- =========== PERFORMANCE INDEXES ===========
-- Composite for the most common orders filter: tenant + date + status
CREATE INDEX idx_orders_tenant_date_status ON orders(tenant_id, order_date, status);
-- customer_id is missing from the SQL-level indexes (only in JPA @Index annotation)
CREATE INDEX idx_orders_customer           ON orders(customer_id);
-- Composite for customer outstanding query (tenant + customer + balance filter)
CREATE INDEX idx_orders_tenant_customer    ON orders(tenant_id, customer_id);
-- Partial index for unpaid orders only — dramatically shrinks the working set
CREATE INDEX idx_orders_balance_unpaid     ON orders(tenant_id, balance_amount) WHERE balance_amount > 0;
-- product_id on order_items — needed for sales analysis and route picklist joins
CREATE INDEX idx_order_items_product       ON order_items(product_id);
-- product_id on purchase_items — needed for purchase history joins
CREATE INDEX idx_purchase_items_product    ON purchase_items(product_id);
-- Composite covering index for the FIFO query — the hottest query in the system
CREATE INDEX idx_batches_fifo ON stock_batches(tenant_id, product_id, active, quantity_available) WHERE active = true;
-- Active customers filter — most customer queries include WHERE active = true
CREATE INDEX idx_customers_active          ON customers(tenant_id, active) WHERE active = true;

-- =========== ATTENDANCE SETTINGS ===========
CREATE TABLE attendance_settings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) UNIQUE,
    office_latitude     DOUBLE PRECISION,
    office_longitude    DOUBLE PRECISION,
    geofence_radius_m   INTEGER NOT NULL DEFAULT 100,
    late_threshold_time TIME NOT NULL DEFAULT '09:00:00',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ
);

-- =========== ATTENDANCE ===========
CREATE TABLE attendance (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    attendance_date DATE NOT NULL,
    check_in_time   TIMESTAMPTZ,
    check_out_time  TIMESTAMPTZ,
    check_in_lat    DOUBLE PRECISION,
    check_in_lng    DOUBLE PRECISION,
    status          VARCHAR(20) NOT NULL DEFAULT 'ABSENT',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ,
    UNIQUE(tenant_id, user_id, attendance_date)
);
CREATE INDEX idx_attendance_tenant_date ON attendance (tenant_id, attendance_date);
CREATE INDEX idx_attendance_user        ON attendance (tenant_id, user_id);

-- =========== BRAND TARGETS ===========
CREATE TABLE brand_targets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    sales_person_id UUID NOT NULL REFERENCES users(id),
    brand           VARCHAR(200) NOT NULL,
    target_month    INTEGER NOT NULL CHECK (target_month BETWEEN 1 AND 12),
    target_year     INTEGER NOT NULL,
    target_value    NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ,
    UNIQUE(tenant_id, sales_person_id, brand, target_month, target_year)
);
CREATE INDEX idx_brand_target_tenant     ON brand_targets(tenant_id);
CREATE INDEX idx_brand_target_person     ON brand_targets(tenant_id, sales_person_id);
CREATE INDEX idx_brand_target_period     ON brand_targets(tenant_id, target_month, target_year);

-- =========== INCENTIVE SLABS ===========
CREATE TABLE incentive_slabs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id),
    brand            VARCHAR(200) NOT NULL,
    from_pct         INTEGER NOT NULL,
    to_pct           INTEGER,
    incentive_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ,
    UNIQUE(tenant_id, brand, from_pct)
);
CREATE INDEX idx_incentive_slab_tenant ON incentive_slabs(tenant_id);
CREATE INDEX idx_incentive_slab_brand  ON incentive_slabs(tenant_id, brand);

-- =========== INCENTIVE CREDITS ===========
CREATE TABLE incentive_credits (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id),
    sales_person_id  UUID NOT NULL REFERENCES users(id),
    brand            VARCHAR(200) NOT NULL,
    target_month     INTEGER NOT NULL,
    target_year      INTEGER NOT NULL,
    target_value     NUMERIC(14,2) NOT NULL,
    achieved_value   NUMERIC(14,2) NOT NULL,
    achievement_pct  NUMERIC(6,2) NOT NULL,
    incentive_amount NUMERIC(14,2) NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    credited_at      TIMESTAMPTZ,
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ,
    UNIQUE(tenant_id, sales_person_id, brand, target_month, target_year)
);
CREATE INDEX idx_incentive_credit_tenant ON incentive_credits(tenant_id);
CREATE INDEX idx_incentive_credit_person ON incentive_credits(tenant_id, sales_person_id);
CREATE INDEX idx_incentive_credit_period ON incentive_credits(tenant_id, target_month, target_year);

-- =========== COLLECTION TARGETS ===========
CREATE TABLE collection_targets (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id),
    sales_person_id  UUID NOT NULL REFERENCES users(id),
    target_month     INT NOT NULL,
    target_year      INT NOT NULL,
    target_value     DECIMAL(14,2) NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ,
    UNIQUE(tenant_id, sales_person_id, target_month, target_year)
);
CREATE INDEX idx_collection_target_tenant ON collection_targets(tenant_id);
CREATE INDEX idx_collection_target_person ON collection_targets(tenant_id, sales_person_id);

-- =========== COLLECTION INCENTIVE SLABS ===========
CREATE TABLE collection_incentive_slabs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id),
    from_pct         INT NOT NULL,
    to_pct           INT,
    incentive_amount DECIMAL(10,2) NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_collection_slab_tenant ON collection_incentive_slabs(tenant_id);

-- =========== COLLECTION INCENTIVE CREDITS ===========
CREATE TABLE collection_incentive_credits (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id),
    sales_person_id  UUID NOT NULL REFERENCES users(id),
    target_month     INT NOT NULL,
    target_year      INT NOT NULL,
    target_value     DECIMAL(14,2) NOT NULL,
    achieved_value   DECIMAL(14,2) NOT NULL,
    achievement_pct  DECIMAL(6,2) NOT NULL,
    incentive_amount DECIMAL(10,2) NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    credited_at      TIMESTAMPTZ,
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ,
    UNIQUE(tenant_id, sales_person_id, target_month, target_year)
);
CREATE INDEX idx_collection_credit_tenant ON collection_incentive_credits(tenant_id);
CREATE INDEX idx_collection_credit_person ON collection_incentive_credits(tenant_id, sales_person_id);
CREATE INDEX idx_collection_credit_period ON collection_incentive_credits(tenant_id, target_month, target_year);

-- =========== CUSTOM ROLES ===========
CREATE TABLE custom_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    name        VARCHAR(100) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ,
    UNIQUE(tenant_id, name)
);

CREATE TABLE role_permissions (
    role_id    UUID NOT NULL REFERENCES custom_roles(id) ON DELETE CASCADE,
    permission VARCHAR(50) NOT NULL,
    PRIMARY KEY (role_id, permission)
);

ALTER TABLE users ADD CONSTRAINT fk_user_custom_role
    FOREIGN KEY (custom_role_id) REFERENCES custom_roles(id) ON DELETE SET NULL;

CREATE INDEX idx_custom_roles_tenant     ON custom_roles(tenant_id);
CREATE INDEX idx_role_permissions_role   ON role_permissions(role_id);
CREATE INDEX idx_users_custom_role       ON users(custom_role_id);
