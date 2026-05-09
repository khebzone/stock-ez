-- DistroIQ V2 — Minimal Seed Data
-- Only the platform SUPER_ADMIN and one tenant with its Admin user.
-- All other data (team, routes, customers, products) must be created through the app.

-- Default development tenant
INSERT INTO tenants (id, name, schema_name, subdomain, owner_name, phone, email, address, city, state, status)
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
    'ACTIVE'
) ON CONFLICT (subdomain) DO NOTHING;

-- SUPER_ADMIN — platform owner (password: Admin@1234)
INSERT INTO users (id, tenant_id, full_name, phone, email, password_hash, role, active, must_change_password)
VALUES (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Super Admin',
    '9999999999',
    'super@distroiq.com',
    '$2b$12$iliAXUR9qos2jR6XP6c2xuuC6T5DzLC/oMw0jCzvA6Iefr32DIPEG',
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
    '$2b$12$iliAXUR9qos2jR6XP6c2xuuC6T5DzLC/oMw0jCzvA6Iefr32DIPEG',
    'ADMIN',
    TRUE,
    FALSE
) ON CONFLICT DO NOTHING;
