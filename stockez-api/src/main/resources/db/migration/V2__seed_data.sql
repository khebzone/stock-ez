-- StockEz V2 — Seed Data
-- Tenant + Admin user only. Custom roles are created by each tenant admin.

-- Default development tenant
INSERT INTO tenants (id, name, schema_name, subdomain, owner_name, phone, email, address, city, state, status, plan, billing_cycle, max_users)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'My Distributors',
    'tenant_main',
    'main',
    'Admin User',
    '9876543210',
    'admin@mydistributors.com',
    'No.1, Trade Centre',
    'Chennai',
    'Tamil Nadu',
    'ACTIVE',
    'PREMIUM',
    'MONTHLY',
    999
) ON CONFLICT (subdomain) DO NOTHING;

-- SUPER_ADMIN — platform owner (password: Admin@1234)
INSERT INTO users (id, tenant_id, full_name, phone, email, password_hash, role, active, must_change_password)
VALUES (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Super Admin',
    '9999999999',
    'super@distroiq.com',
    '$2b$12$0id5T66ER.miFmb5BsoBruGfZg/6S0hW9SgTrr0SAHPoqTV0t3WRe',
    'SUPER_ADMIN',
    TRUE,
    FALSE
) ON CONFLICT DO NOTHING;

-- Tenant ADMIN — first login for the tenant (password: Admin@1234)
INSERT INTO users (id, tenant_id, full_name, phone, email, password_hash, role, active, must_change_password)
VALUES (
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Admin User',
    '9876543210',
    'admin@mydistributors.com',
    '$2b$12$0id5T66ER.miFmb5BsoBruGfZg/6S0hW9SgTrr0SAHPoqTV0t3WRe',
    'ADMIN',
    TRUE,
    FALSE
) ON CONFLICT DO NOTHING;

-- =========== 5 DEMO TENANTS FOR TESTING ===========
-- Password for all: Admin@1234
-- Hash: $2b$12$0id5T66ER.miFmb5BsoBruGfZg/6S0hW9SgTrr0SAHPoqTV0t3WRe

-- Demo Tenant 1
INSERT INTO tenants (id, name, schema_name, subdomain, owner_name, phone, email, city, state, status)
VALUES (
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d11',
    'Annai Distributors',
    'tenant_demo1',
    'demo1',
    'Karthik Raja',
    '9000000001',
    'demo1@distroiq.com',
    'Madurai',
    'Tamil Nadu',
    'ACTIVE'
) ON CONFLICT (subdomain) DO NOTHING;

INSERT INTO users (id, tenant_id, full_name, phone, email, password_hash, role, active, must_change_password)
VALUES (
    gen_random_uuid(),
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d11',
    'Admin Demo 1',
    '9000000001',
    'demo1@distroiq.com',
    '$2b$12$0id5T66ER.miFmb5BsoBruGfZg/6S0hW9SgTrr0SAHPoqTV0t3WRe',
    'ADMIN',
    TRUE,
    FALSE
) ON CONFLICT DO NOTHING;

-- Demo Tenant 2
INSERT INTO tenants (id, name, schema_name, subdomain, owner_name, phone, email, city, state, status)
VALUES (
    'd2eebc99-9c0b-4ef8-bb6d-6bb9bd380d12',
    'Sri Krishna Agency',
    'tenant_demo2',
    'demo2',
    'Senthil Kumar',
    '9000000002',
    'demo2@distroiq.com',
    'Coimbatore',
    'Tamil Nadu',
    'ACTIVE'
) ON CONFLICT (subdomain) DO NOTHING;

INSERT INTO users (id, tenant_id, full_name, phone, email, password_hash, role, active, must_change_password)
VALUES (
    gen_random_uuid(),
    'd2eebc99-9c0b-4ef8-bb6d-6bb9bd380d12',
    'Admin Demo 2',
    '9000000002',
    'demo2@distroiq.com',
    '$2b$12$0id5T66ER.miFmb5BsoBruGfZg/6S0hW9SgTrr0SAHPoqTV0t3WRe',
    'ADMIN',
    TRUE,
    FALSE
) ON CONFLICT DO NOTHING;

-- Demo Tenant 3
INSERT INTO tenants (id, name, schema_name, subdomain, owner_name, phone, email, city, state, status)
VALUES (
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380d13',
    'Vasanth & Co FMCG',
    'tenant_demo3',
    'demo3',
    'Vijay Anand',
    '9000000003',
    'demo3@distroiq.com',
    'Trichy',
    'Tamil Nadu',
    'ACTIVE'
) ON CONFLICT (subdomain) DO NOTHING;

INSERT INTO users (id, tenant_id, full_name, phone, email, password_hash, role, active, must_change_password)
VALUES (
    gen_random_uuid(),
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380d13',
    'Admin Demo 3',
    '9000000003',
    'demo3@distroiq.com',
    '$2b$12$0id5T66ER.miFmb5BsoBruGfZg/6S0hW9SgTrr0SAHPoqTV0t3WRe',
    'ADMIN',
    TRUE,
    FALSE
) ON CONFLICT DO NOTHING;

-- Demo Tenant 4
INSERT INTO tenants (id, name, schema_name, subdomain, owner_name, phone, email, city, state, status)
VALUES (
    'd4eebc99-9c0b-4ef8-bb6d-6bb9bd380d14',
    'Raja Trading Corp',
    'tenant_demo4',
    'demo4',
    'Raja Sekhar',
    '9000000004',
    'demo4@distroiq.com',
    'Salem',
    'Tamil Nadu',
    'ACTIVE'
) ON CONFLICT (subdomain) DO NOTHING;

INSERT INTO users (id, tenant_id, full_name, phone, email, password_hash, role, active, must_change_password)
VALUES (
    gen_random_uuid(),
    'd4eebc99-9c0b-4ef8-bb6d-6bb9bd380d14',
    'Admin Demo 4',
    '9000000004',
    'demo4@distroiq.com',
    '$2b$12$0id5T66ER.miFmb5BsoBruGfZg/6S0hW9SgTrr0SAHPoqTV0t3WRe',
    'ADMIN',
    TRUE,
    FALSE
) ON CONFLICT DO NOTHING;

-- Demo Tenant 5
INSERT INTO tenants (id, name, schema_name, subdomain, owner_name, phone, email, city, state, status)
VALUES (
    'd5eebc99-9c0b-4ef8-bb6d-6bb9bd380d15',
    'Mega Distributors',
    'tenant_demo5',
    'demo5',
    'Mohamed Ali',
    '9000000005',
    'demo5@distroiq.com',
    'Tirunelveli',
    'Tamil Nadu',
    'ACTIVE'
) ON CONFLICT (subdomain) DO NOTHING;

INSERT INTO users (id, tenant_id, full_name, phone, email, password_hash, role, active, must_change_password)
VALUES (
    gen_random_uuid(),
    'd5eebc99-9c0b-4ef8-bb6d-6bb9bd380d15',
    'Admin Demo 5',
    '9000000005',
    'demo5@distroiq.com',
    '$2b$12$0id5T66ER.miFmb5BsoBruGfZg/6S0hW9SgTrr0SAHPoqTV0t3WRe',
    'ADMIN',
    TRUE,
    FALSE
) ON CONFLICT DO NOTHING;

